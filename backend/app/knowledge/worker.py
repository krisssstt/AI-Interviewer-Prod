import time
import uuid

from sqlalchemy import and_, or_, select, update

from .adapters import EmbeddingUnavailable
from .domain import chunk_text
from .models import Chunk, DocumentVersion, Embedding, IngestionJob

MAX_ATTEMPTS = 3


def claim(db, model_key, lease_seconds=300):
    now = time.time()
    db.execute(update(IngestionJob).where(IngestionJob.status == 'running',
        IngestionJob.lease_until < now, IngestionJob.attempts >= MAX_ATTEMPTS).values(
            status='failed', error_code='worker_lease_exhausted', lease_token=None, lease_until=None))
    available = or_(and_(IngestionJob.status.in_(['queued', 'retry']), IngestionJob.available_at <= now),
                    and_(IngestionJob.status == 'running', IngestionJob.lease_until < now))
    job = db.scalar(select(IngestionJob).where(available, IngestionJob.model_key == model_key,
                    IngestionJob.attempts < MAX_ATTEMPTS)
                    .order_by(IngestionJob.available_at).with_for_update(skip_locked=True).limit(1))
    if not job:
        db.commit()
        return None
    token = str(uuid.uuid4())
    result = db.execute(update(IngestionJob).where(IngestionJob.id == job.id, available).values(
        status='running', lease_token=token, lease_until=now + lease_seconds,
        attempts=IngestionJob.attempts + 1).execution_options(synchronize_session=False))
    db.commit()
    return (job.id, token) if result.rowcount == 1 else None


def finish_job(db, job_id, token, error=None):
    job = db.get(IngestionJob, job_id)
    if not job or job.lease_token != token:
        return False
    job.status = ('failed' if job.attempts >= MAX_ATTEMPTS else 'retry') if error else 'completed'
    job.error_code = error
    job.available_at = time.time() + min(300, 2 ** job.attempts * 5)
    job.lease_until, job.lease_token = None, None
    db.commit()
    return True


def process_one(sessions, embedder, max_chars=2400):
    with sessions() as db:
        claimed = claim(db, embedder.model_key)
        if not claimed:
            return False
        job_id, token = claimed
        job = db.get(IngestionJob, job_id)
        version = db.get(DocumentVersion, job.version_id)
        chunks = db.scalars(select(Chunk).where(Chunk.version_id == version.id).order_by(Chunk.ordinal)).all()
        if not chunks:
            parts = chunk_text(version.text, max_chars)
            if len(parts) > 64 or any(len(part['text']) > 12000 for part in parts):
                version.status = 'failed'
                job.attempts = MAX_ATTEMPTS
                finish_job(db, job_id, token, 'document_structure_limit')
                return True
            chunks = [Chunk(version_id=version.id, **part) for part in parts]
            db.add_all(chunks)
            version.chunker_version = f'paragraph-v1:{max_chars}'
        version.status = 'text_ready'
        db.commit()
        chunk_values = [(chunk.id, chunk.text) for chunk in chunks]
        version_id = version.id
    # No database transaction is held during slow provider calls.
    try:
        vectors = []
        for index in range(0, len(chunk_values), 8):
            vectors.extend(embedder.embed([text for _, text in chunk_values[index:index+8]]))
    except EmbeddingUnavailable:
        with sessions() as db:
            finish_job(db, job_id, token, 'embedding_provider_unavailable_or_invalid')
        return True
    with sessions() as db:
        job = db.scalar(select(IngestionJob).where(IngestionJob.id == job_id).with_for_update())
        # Deleted documents or expired leases must not resurrect data.
        if not job or job.lease_token != token or job.lease_until < time.time():
            return True
        for (chunk_id, _), vector in zip(chunk_values, vectors, strict=True):
            existing = db.scalar(select(Embedding).where(Embedding.chunk_id == chunk_id,
                                 Embedding.model_key == embedder.model_key))
            if not existing:
                db.add(Embedding(chunk_id=chunk_id, model_key=embedder.model_key, vector=vector))
        db.get(DocumentVersion, version_id).status = 'ready'
        finish_job(db, job_id, token)
    return True

