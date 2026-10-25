"""Test-only worker for the browser's isolated temporary database, never production."""
from pathlib import Path

from sqlalchemy.engine import make_url

from backend.app.ai.worker import process_one
from backend.app.config import Settings
from backend.app.db import database
from tests.test_ai import ContractModel

settings=Settings()
url=make_url(settings.database_url)
path=Path(url.database).resolve()
if url.drivername!='sqlite' or path.name!='e2e.db' or not path.parent.name.startswith('qa-interviewer-'):
    raise RuntimeError('This test worker is restricted to its isolated E2E database')
engine,sessions=database(settings.database_url)
try:
    for _ in range(4):
        if not process_one(sessions,settings,ContractModel()):
            break
finally:
    engine.dispose()
