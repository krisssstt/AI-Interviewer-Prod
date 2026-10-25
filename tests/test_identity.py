from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.identity.models import AuthSession, User

from .conftest import account


def test_registration_login_logout_profile_and_hash(app):
    with TestClient(app) as client:
        user = account(client)
        assert 'HttpOnly' in client.cookies.jar._cookies['testserver.local']['/']['ai_session']._rest
        token = client.cookies.get('ai_session')
        with app.state.sessions() as db:
            record = db.get(User, user['id'])
            assert record.password_hash.startswith('$argon2id$')
            session = db.scalar(select(AuthSession))
            assert token not in session.token_hash
        response = client.patch('/api/me', json={'name': 'Мария'})
        assert response.json()['name'] == 'Мария'
        assert client.post('/api/auth/logout', json={}).status_code == 204
        assert client.get('/api/me').status_code == 401
        client.cookies.set('ai_session', token)
        assert client.get('/api/me').status_code == 401
        client.cookies.clear()
        response = client.post('/api/auth/login', json={'email': 'QA@example.com', 'password': 'test-password-123'})
        assert response.status_code == 200
        assert response.json()['name'] == 'Мария'


def test_csrf_origin_and_validation(client):
    assert client.patch('/api/me', json={'name': 'Мария'}, headers={'X-CSRF-Token': 'bad'}).status_code == 403
    assert client.post('/api/auth/login', json={'email': 'qa@example.com', 'password': '12345678'},
                       headers={'Origin': 'https://evil.example'}).status_code == 403
    response = client.post('/api/auth/login', json={'email': 'bad', 'password': 'private-password'})
    assert response.status_code == 422
    assert 'private-password' not in response.text
    assert client.patch('/api/me', json={'name': 'Мария', 'direction': 'admin'}).status_code == 422
    assert client.post('/api/auth/login', content='x'*65537,
                       headers={'content-type': 'application/json'}).status_code == 413


def test_failed_login_limited_in_database(app):
    with TestClient(app) as client:
        for _ in range(10):
            assert client.post('/api/auth/login', json={'email': 'none@example.com',
                               'password': 'invalid-password'}).status_code == 401
        response = client.post('/api/auth/login', json={'email': 'none@example.com', 'password': 'invalid-password'})
        assert response.status_code == 429
        assert response.headers['retry-after'] == '60'


def test_duplicate_email_and_expired_session(client, app):
    response = client.post('/api/auth/register', json={'email': 'QA@example.com',
                           'password': 'another-password', 'name': 'Мария'})
    assert response.status_code == 409
    with app.state.sessions() as db:
        session = db.scalar(select(AuthSession))
        session.expires_at = 1
        db.commit()
    assert client.get('/api/me').status_code == 401


def test_password_reset_does_not_claim_mail_sent(app):
    with TestClient(app) as client:
        response = client.post('/api/auth/password-reset', json={'email': 'qa@example.com'})
        assert response.status_code == 503
        assert 'не отправлено' in response.json()['detail']

