import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.seed import seed


@pytest.fixture
def app(tmp_path):
    url = 'sqlite:///' + (tmp_path / 'test.db').as_posix()
    config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
    config.attributes['database_url'] = url
    command.upgrade(config, 'head')
    application = create_app(Settings(database_url=url))
    with application.state.sessions() as db:
        seed(db)
    yield application
    application.state.engine.dispose()


def account(client, email='qa@example.com'):
    response = client.post('/api/auth/register', json={
        'email': email, 'password': 'test-password-123', 'name': 'Анна'})
    assert response.status_code == 201, response.text
    client.headers['X-CSRF-Token'] = response.json()['csrf_token']
    return response.json()


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        account(client)
        yield client


def create_session(client, mode='practice', competency='qa-http-methods', request_key=None):
    response = client.post('/api/sessions', json={'mode': mode, 'competency_id': competency,
                                                'request_key': request_key or str(uuid.uuid4())})
    assert response.status_code == 201, response.text
    return response.json()


def answer(client, session, value='0', request_key=None):
    return client.post(f"/api/sessions/{session['id']}/answers", json={
        'question_version_id': session['question']['id'], 'value': value,
        'request_key': request_key or str(uuid.uuid4())})

