import hashlib
import json
from pathlib import Path

from .domain import chunk_text, clean_text
from .models import Chunk, Document, DocumentVersion, IngestionJob, VersionCompetency

CORPUS = Path(__file__).resolve().parents[3] / 'corpus'


def import_corpus(db, model_key, manifest_path=None):
    manifest_path = manifest_path or CORPUS / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    imported = 0
    for entry in manifest['documents']:
        source = (CORPUS / entry['file']).resolve()
        if not source.is_relative_to(CORPUS.resolve()):
            raise ValueError('Corpus file escapes corpus directory')
        text = clean_text(source.read_text(encoding='utf-8'))
        checksum = hashlib.sha256(text.encode()).hexdigest()
        if entry.get('sha256') and checksum != entry['sha256']:
            raise ValueError('Corpus snapshot checksum mismatch: ' + entry['id'])
        existing = db.get(Document, entry['id'])
        if existing:
            from sqlalchemy import select
            old = db.scalar(select(DocumentVersion).where(DocumentVersion.document_id == entry['id'],
                            DocumentVersion.version == entry['version']))
            if old:
                if old.content_hash != checksum:
                    raise ValueError('Changed corpus text requires a new manifest version: ' + entry['id'])
                continue
            existing.current_version = max(existing.current_version, entry['version'])
        else:
            db.add(Document(id=entry['id'], scope='public', title=entry['title'],
                            current_version=entry['version'], owner_id=None))
            db.flush()
        version = DocumentVersion(document_id=entry['id'], version=entry['version'], text=text,
            content_hash=checksum, source_title=entry['title'], source_url=entry['url'],
            language=entry['language'], competency_id=entry['competencies'][0], license=entry['license'],
            status='text_ready', chunker_version='paragraph-v1:2400',
            **({'received_at': entry['received_at']} if 'received_at' in entry else {}))
        db.add(version)
        db.flush()
        db.add_all([VersionCompetency(version_id=version.id, competency_id=comp)
                    for comp in entry['competencies']])
        db.add_all([Chunk(version_id=version.id, **part) for part in chunk_text(text)])
        db.add(IngestionJob(version_id=version.id, model_key=model_key))
        imported += 1
    db.commit()
    return imported
