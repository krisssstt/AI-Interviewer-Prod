from sqlalchemy import select

from . import models  # noqa: F401
from .competencies.models import Competency, QuestionVersion
from .competencies.seed_data import records
from .config import Settings
from .db import database


def seed(db):
    for competency, question in records():
        if not db.get(Competency, competency['id']):
            db.add(Competency(**competency))
            db.flush()
        if not db.get(QuestionVersion, question['id']):
            db.add(QuestionVersion(**question))
    db.commit()
    return len(db.scalars(select(Competency)).all())


if __name__ == '__main__':
    engine, sessions = database(Settings().database_url)
    with sessions() as db:
        print(f'Seed complete: {seed(db)} competencies. Existing versions preserved.')
    engine.dispose()

