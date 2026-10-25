import hashlib

from sqlalchemy import select

from . import models  # noqa: F401
from .competencies.models import Competency, QuestionVersion
from .competencies.seed_data import records
from .config import Settings
from .db import database
from .knowledge.adapters import OllamaEmbedder
from .knowledge.domain import chunk_text
from .knowledge.models import Chunk, Document, DocumentVersion, IngestionJob


def seed(db):
    for competency, question in records():
        if not db.get(Competency, competency['id']):
            db.add(Competency(**competency))
            db.flush()
        if not db.get(QuestionVersion, question['id']):
            db.add(QuestionVersion(**question))
    db.commit()
    # Original project-authored corpus, not copied external documentation. Preserve
    # structured sections and actual text; external links are provenance references.
    model_key = OllamaEmbedder(Settings()).model_key
    for competency, question in records():
        document_id = 'seed-' + competency['id']
        if db.get(Document, document_id):
            continue
        content = question['content']
        text = (f"# {competency['topic']}: {competency['description']}\n\n"
                f"## Основное правило\n\n{content['explanation']}\n\n"
                f"## Применение при проверке\n\n{content['hint']} "
                f"Сначала зафиксируйте ожидаемое поведение по контракту, затем наблюдаемый результат. "
                f"Если данных недостаточно, перечислите предположения и способ их проверки.\n\n"
                f"## Самопроверка\n\n{content['hint']}\n\n"
                f"## Происхождение\n\nАвторский учебный материал проекта. Справочный источник: "
                f"{content['sources'][0]['title']}. Не является экспертной разметкой.")
        db.add(Document(id=document_id, owner_id=None, scope='public', title=competency['description']))
        db.flush()
        version = DocumentVersion(document_id=document_id, version=1,
            source_title=competency['description'], text=text, content_hash=hashlib.sha256(text.encode()).hexdigest(),
            source_url=content['sources'][0]['url'], language='ru', competency_id=competency['id'],
            license='Project-authored educational content; reference URL not copied', status='text_ready',
            chunker_version='paragraph-v1:2400')
        db.add(version)
        db.flush()
        db.add_all([Chunk(version_id=version.id, **part) for part in chunk_text(text)])
        db.add(IngestionJob(version_id=version.id, model_key=model_key))
    db.commit()
    return len(db.scalars(select(Competency)).all())


if __name__ == '__main__':
    engine, sessions = database(Settings().database_url)
    with sessions() as db:
        print(f'Seed complete: {seed(db)} competencies. Existing versions preserved.')
    engine.dispose()

