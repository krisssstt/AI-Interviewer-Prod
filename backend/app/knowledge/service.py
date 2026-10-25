import hashlib
import time

from pgvector.sqlalchemy import Vector
from sqlalchemy import cast, delete, exists, func, or_, select

from ..ai.retention import purge_private_document
from ..competencies.models import Competency
from ..errors import RuleError
from .domain import clean_text, terms
from .models import Chunk, Document, DocumentVersion, Embedding, IngestionJob, VersionCompetency


def access(user_id):
    return or_(Document.scope == 'public', Document.owner_id == user_id)


def editable(db, actor, document_id):
    document = db.scalar(select(Document).where(Document.id == document_id).with_for_update())
    if not document or not (document.owner_id == actor.id if document.scope == 'private' else actor.is_admin):
        raise RuleError('Документ не найден или изменение недоступно.', 404)
    return document


def upload(db, actor, data, model_key, document_id=None):
    if data.scope == 'public' and not actor.is_admin:
        raise RuleError('Общую базу знаний обновляет администратор.', 403)
    if not db.get(Competency, data.competency_id):
        raise RuleError('Компетенция не найдена.', 422)
    text = clean_text(data.text)
    if document_id:
        document = editable(db, actor, document_id)
        if document.scope != data.scope:
            raise RuleError('Область доступа версии менять нельзя.', 422)
        document.current_version += 1
        document.title = data.title
    else:
        document = Document(owner_id=actor.id, title=data.title, scope=data.scope)
        db.add(document)
        db.flush()
    version = DocumentVersion(document_id=document.id, version=document.current_version,
                               source_title=data.title, text=text,
                               content_hash=hashlib.sha256(text.encode()).hexdigest(),
                               source_url=str(data.source_url) if data.source_url else None,
                               language=data.language, competency_id=data.competency_id,
                               license=data.license)
    db.add(version)
    db.flush()
    job = IngestionJob(version_id=version.id, model_key=model_key)
    db.add(job)
    db.commit()
    return {'id': document.id, 'version_id': version.id, 'version': version.version,
            'status': version.status, 'job_id': job.id}


def list_documents(db, actor):
    rows = db.execute(select(Document, DocumentVersion).join(DocumentVersion).where(
        access(actor.id), DocumentVersion.version == Document.current_version)
        .order_by(Document.created_at.desc()).limit(100)).all()
    return [{'id': doc.id, 'title': doc.title, 'scope': doc.scope, 'version': version.version,
             'version_id': version.id, 'status': version.status, 'competency_id': version.competency_id,
             'can_edit': doc.owner_id == actor.id if doc.scope == 'private' else actor.is_admin}
            for doc, version in rows]


def detail(db, actor_id, document_id):
    row = db.execute(select(Document, DocumentVersion).join(DocumentVersion).where(
        Document.id == document_id, access(actor_id),
        DocumentVersion.version == Document.current_version)).first()
    if not row:
        raise RuleError('Документ не найден.', 404)
    document, version = row
    return {'id': document.id, 'title': version.source_title, 'version': version.version,
            'text': version.text, 'scope': document.scope, 'competency_id': version.competency_id,
            'source_url': version.source_url, 'language': version.language, 'license': version.license,
            'status': version.status, 'content_hash': version.content_hash}


def remove(db, actor, document_id):
    document = editable(db, actor, document_id)
    purge_private_document(db, document)
    db.execute(delete(Document).where(Document.id == document_id))
    db.commit()  # FK cascade deletes versions, raw text, chunks, embeddings and jobs.


def retry(db, actor, document_id, model_key):
    document = editable(db, actor, document_id)
    version = db.scalar(select(DocumentVersion).where(DocumentVersion.document_id == document.id,
                        DocumentVersion.version == document.current_version))
    job = db.scalar(select(IngestionJob).where(IngestionJob.version_id == version.id,
                     IngestionJob.model_key == model_key).with_for_update())
    if job and job.status == 'running' and job.lease_until > time.time():
        raise RuleError('Документ уже обрабатывается.')
    if not job:
        job = IngestionJob(version_id=version.id, model_key=model_key)
        db.add(job)
    else:
        job.status, job.attempts, job.error_code = 'queued', 0, None
        job.available_at, job.lease_until, job.lease_token = time.time(), None, None
    db.commit()
    return {'job_id': job.id, 'status': job.status}


def job_view(db, actor, job_id):
    job = db.scalar(select(IngestionJob).join(DocumentVersion).join(Document).where(
        IngestionJob.id == job_id, access(actor.id)))
    if not job:
        raise RuleError('Задание обработки не найдено.', 404)
    return {'id': job.id, 'status': job.status, 'attempts': job.attempts,
            'error_code': job.error_code, 'available_at': job.available_at,
            'embedding_model': job.model_key}


def search(db, actor_id, query, competency_id, mode, embedder, limit=5, include_private=True):
    # ACL, active version and competency filters are applied to both candidate queries
    # before sending anything to a model. Raw private text never crosses users.
    base = select(Chunk, DocumentVersion, Document).select_from(Chunk).join(
        DocumentVersion, DocumentVersion.id == Chunk.version_id).join(
        Document, Document.id == DocumentVersion.document_id).where(
        access(actor_id), DocumentVersion.version == Document.current_version,
        DocumentVersion.status.in_(['text_ready', 'ready']))
    if not include_private:
        base = base.where(Document.scope == 'public')
    if competency_id:
        base = base.where(or_(DocumentVersion.competency_id == competency_id, exists().where(
            VersionCompetency.version_id == DocumentVersion.id, VersionCompetency.competency_id == competency_id)))
    query_terms = terms(query)
    lexical = []
    if mode in {'lexical', 'hybrid'}:
        if db.bind.dialect.name == 'postgresql':
            # Portable 'simple' dictionary retains both Russian and technical tokens.
            vector = func.to_tsvector('simple', Chunk.text)
            tsquery = func.plainto_tsquery('simple', query)
            rows = db.execute(base.where(vector.op('@@')(tsquery))
                              .order_by(func.ts_rank_cd(vector, tsquery).desc()).limit(50)).all()
        else:
            rows = db.execute(base.order_by(Document.id, Chunk.ordinal).limit(1000)).all()
        for row in rows:
            overlap = len(query_terms & terms(row[0].text + ' ' + row[0].section))
            if overlap:
                lexical.append((overlap / max(1, len(query_terms)), row))
        lexical.sort(key=lambda item: (-item[0], item[1][2].id, item[1][0].ordinal))
    vector_rows = []
    if mode in {'vector', 'hybrid'}:
        if db.bind.dialect.name != 'postgresql':
            raise RuleError('Векторный и гибридный поиск требуют PostgreSQL с pgvector. Доступен текстовый поиск.', 503)
        from .adapters import EmbeddingUnavailable
        try:
            vector_query = embedder.embed([query])[0]
        except EmbeddingUnavailable:
            raise RuleError('Embedding-сервис недоступен. Можно выбрать текстовый поиск.', 503) from None
        distance = cast(Embedding.vector, Vector()).cosine_distance(vector_query)
        vector_rows = db.execute(base.join(Embedding, Embedding.chunk_id == Chunk.id).where(
            Embedding.model_key == embedder.model_key).order_by(distance).limit(50)).all()
    # Reciprocal rank fusion; no score mixing between incomparable distance/lexical scales.
    ranks, rows_by_id = {}, {}
    for ranked in [[row for _, row in lexical[:50]], vector_rows]:
        for rank, row in enumerate(ranked, 1):
            chunk_id = row[0].id
            ranks[chunk_id] = ranks.get(chunk_id, 0) + 1 / (60 + rank)
            rows_by_id[chunk_id] = row
    results, chars = [], 0
    for chunk_id in sorted(ranks, key=lambda ident: (-ranks[ident], rows_by_id[ident][2].id,
                                                    rows_by_id[ident][0].ordinal)):
        chunk, version, document = rows_by_id[chunk_id]
        if len(results) >= limit:
            break
        if chars + len(chunk.text) > 12000:
            continue
        chars += len(chunk.text)
        results.append({'id': chunk.id, 'text': chunk.text, 'title': version.source_title,
                        'document_id': document.id, 'document_version_id': version.id,
                        'version': version.version, 'url': version.source_url,
                        'section': chunk.section, 'start_offset': chunk.start_offset,
                        'end_offset': chunk.end_offset, 'language': version.language,
                        'received_at': version.received_at, 'license': version.license,
                        'competency_id': competency_id or version.competency_id,
                        'primary_competency_id': version.competency_id,
                        'scope': document.scope, 'rank_score': ranks[chunk_id]})
    return {'mode': mode, 'sources': results, 'context_chars': chars,
            'status': 'found' if results else 'no_sources',
            'embedding_model': embedder.model_key if mode != 'lexical' else None,
            'notice': 'Найденные фрагменты — материалы для проверки, не сгенерированный ответ.'}

