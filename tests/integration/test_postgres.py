"""Real PostgreSQL/pgvector queries. Synthetic vectors only test SQL/ACL, not AI quality."""
import os
import uuid

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url

from backend.app.config import Settings
from backend.app.identity.models import User
from backend.app.knowledge.models import Chunk, Embedding
from backend.app.knowledge.service import search
from backend.app.main import create_app
from backend.app.seed import seed
from tests.conftest import account


@pytest.fixture
def postgres_app():
    value = os.getenv('TEST_DATABASE_URL')
    if not value:
        pytest.skip('TEST_DATABASE_URL not configured; PostgreSQL was not tested')
    url = make_url(value)
    if not url.database or not url.database.endswith('_test'):
        pytest.fail('TEST_DATABASE_URL database name must end with _test')
    operator = create_engine(url)
    schema = 'qa_test_' + uuid.uuid4().hex
    with operator.begin() as db:
        db.execute(text('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public'))
        db.execute(text(f'CREATE SCHEMA {schema}'))
    test_url = url.update_query_dict({'options': f'-csearch_path={schema},public'})
    config = Config('alembic.ini')
    config.attributes['database_url'] = test_url.render_as_string(hide_password=False)
    application = None
    try:
        command.upgrade(config, 'head')
        application = create_app(Settings(database_url=test_url.render_as_string(hide_password=False)))
        with application.state.sessions() as db:
            seed(db)
        yield application
    finally:
        if application:
            application.state.engine.dispose()
        with operator.begin() as db:
            # schema is generated locally from UUID, never from a user-supplied identifier.
            db.execute(text(f'DROP SCHEMA {schema} CASCADE'))
        operator.dispose()


class SqlTestEmbedder:
    model_key = 'sql-contract-only:3'

    def embed(self, texts):
        return [[1.0, 0.0, 0.0] for _ in texts]


def test_real_pgvector_and_hybrid_sql(postgres_app):
    with TestClient(postgres_app) as client:
        user = account(client)
        with postgres_app.state.sessions() as db:
            actor = db.get(User, user['id'])
            for chunk in db.scalars(select(Chunk)):
                db.add(Embedding(chunk_id=chunk.id, model_key=SqlTestEmbedder.model_key,
                                 vector=[1.0, 0.0, 0.0]))
            db.commit()
            for mode in ['lexical', 'vector', 'hybrid']:
                result = search(db, actor.id, 'GET', 'qa-http-methods', mode, SqlTestEmbedder())
                assert result['sources'], mode
                assert all(s['competency_id'] == 'qa-http-methods' for s in result['sources'])
        assert client.get('/api/health').status_code == 200
