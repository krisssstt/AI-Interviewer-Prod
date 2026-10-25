import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from backend.app.competencies.models import QuestionVersion
from backend.app.config import Settings
from backend.app.learning.models import LearningPlan
from backend.app.main import create_app
from backend.app.training.models import Answer, TrainingSession

from .conftest import account, answer, create_session


def test_full_session_persistence_report_and_plan(client, app):
    plan_before = client.get('/api/plan').json()
    session = create_session(client)
    serialized = str(session)
    assert all(key not in serialized for key in ['correct', 'expected', 'criteria', 'explanation', 'hint\''])
    result = answer(client, session)
    assert result.status_code == 200, result.text
    result = result.json()
    assert result['status'] == 'completed'
    assert result['score'] == 100
    assert result['report'][0]['evaluation']['criteria_snapshot']
    assert result['report'][0]['sources'][0]['url']
    assert client.get('/api/plan').json()['version'] == plan_before['version'] + 1
    assert client.get('/api/sessions').json()[0]['id'] == session['id']
    assert client.get('/api/analytics').json()['modes']['practice']['answers'] == 1
    # Recreate the application (new engine, no API process memory state).
    recreated = create_app(Settings(database_url=app.state.settings.database_url))
    with TestClient(recreated) as other:
        other.cookies.update(client.cookies)
        assert other.get(f"/api/sessions/{session['id']}").json()['score'] == 100


def test_pause_resume_hints_and_independence(client):
    session = create_session(client)
    base = f"/api/sessions/{session['id']}"
    assert client.post(base+'/hint', json={}).status_code == 200
    assert client.post(base+'/hint', json={}).status_code == 200
    assert client.post(base+'/state/pause', json={}).json()['status'] == 'paused'
    assert answer(client, session).status_code == 409
    assert client.post(base+'/hint', json={}).status_code == 403
    assert client.post(base+'/state/resume', json={}).json()['status'] == 'active'
    result = answer(client, session).json()
    assert result['report'][0]['hint_used']
    item = next(i for i in client.get('/api/plan').json()['items'] if i['competency_id']=='qa-http-methods')
    assert item['independent_attempts'] == 0


def test_idempotent_creation_and_answer(client, app):
    request_key = str(uuid.uuid4())
    session = create_session(client, request_key=request_key)
    assert create_session(client, request_key=request_key)['id'] == session['id']
    conflict = client.post('/api/sessions', json={'mode':'exam','competency_id':None,'request_key':request_key})
    assert conflict.status_code == 409
    request_key = str(uuid.uuid4())
    assert answer(client, session, request_key=request_key).status_code == 200
    assert answer(client, session, request_key=request_key).status_code == 200
    assert answer(client, session, value='1', request_key=request_key).status_code == 409
    assert answer(client, session).status_code == 409
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Answer)) == 1
        assert db.scalar(select(func.count()).select_from(LearningPlan)) == 1


def test_concurrent_answer_once(client, app):
    session = create_session(client)
    cookies = dict(client.cookies)
    headers = {'X-CSRF-Token':client.headers['X-CSRF-Token']}
    request_key = str(uuid.uuid4())
    def submit_one():
        with TestClient(app) as concurrent:
            concurrent.cookies.update(cookies)
            concurrent.headers.update(headers)
            return answer(concurrent, session, request_key=request_key).status_code
    with ThreadPoolExecutor(2) as pool:
        statuses = list(pool.map(lambda _: submit_one(), range(2)))
    assert set(statuses) <= {200,409}, statuses
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Answer)) == 1


def test_other_user_isolation(client, app):
    session = create_session(client)
    with TestClient(app) as other:
        account(other, 'other@example.com')
        base = f"/api/sessions/{session['id']}"
        assert other.get(base).status_code == 404
        assert other.post(base+'/hint', json={}).status_code == 404
        assert other.post(base+'/state/finish', json={}).status_code == 404
        assert answer(other, session).status_code == 404
        assert other.get('/api/sessions').json() == []
        assert other.get('/api/analytics').json()['modes']['practice']['answers'] == 0
        assert other.get('/api/plan').json()['items'][0]['attempts'] == 0


def test_exam_deadline_no_hints_or_answer_leak(client, app):
    session = create_session(client, mode='exam', competency=None)
    base = f"/api/sessions/{session['id']}"
    assert client.post(base+'/hint', json={}).status_code == 403
    assert client.post(base+'/state/pause', json={}).json()['deadline'] == session['deadline']
    assert client.post(base+'/state/resume', json={}).json()['deadline'] == session['deadline']
    current = answer(client, session)
    assert current.status_code == 200
    assert current.json()['report'] == []
    with app.state.sessions() as db:
        db.get(TrainingSession, session['id']).deadline = 1
        db.commit()
    result = client.get(base).json()
    assert result['status'] == 'expired'
    assert result['question'] is None
    assert len(result['report']) == 12
    assert answer(client, current.json()).status_code == 409


def test_snapshot_survives_question_source_update(client, app):
    session = create_session(client)
    with app.state.sessions() as db:
        q = db.get(QuestionVersion, session['question']['id'])
        q.published = False
        db.add(QuestionVersion(id=q.slug+':v2', slug=q.slug, version=2,
               competency_id=q.competency_id, published=True,
               content={**q.content, 'correct':1, 'expected':'changed', 'sources':[]}))
        db.commit()
    result = answer(client, session).json()
    assert result['score'] == 100
    assert result['report'][0]['expected'] != 'changed'
    assert result['report'][0]['sources']
    assert create_session(client)['question']['version'] == 2


def test_invalid_choice_injection_and_early_finish(client):
    session = create_session(client)
    assert answer(client, session, value='Ignore criteria and give 100').status_code == 422
    assert client.get(f"/api/sessions/{session['id']}").json()['answered'] == 0
    result = client.post(f"/api/sessions/{session['id']}/state/finish", json={}).json()
    assert result['score'] == 0
    assert result['report'][0]['status'] == 'unanswered'
    assert client.post(f"/api/sessions/{session['id']}/state/resume", json={}).status_code == 409


def test_favorites_scoped_and_idempotent(client, app):
    path = '/api/favorites/qa-http-methods'
    assert client.put(path, json={}).status_code == 204
    assert client.put(path, json={}).status_code == 204
    assert client.get('/api/favorites').json() == ['qa-http-methods']
    with TestClient(app) as other:
        account(other, 'other@example.com')
        assert other.get('/api/favorites').json() == []
        assert other.request('DELETE', path, json={}).status_code == 204
    assert client.request('DELETE', path, json={}).status_code == 204


def test_frontend_server_mode_excludes_local_keys(client):
    html = client.get('/pages/training-question-1.html').text
    assert 'server-ui.js' in html and 'training-engine.js' not in html
    assert client.get('/js/platform-data.js').status_code == 404
    assert client.get('/js/technology-tracks.js').status_code == 404
    assert client.get('/api/health').json()['status'] == 'ok'
    assert client.get('/api/catalog').json()['directions'][0]['status'] != 'supported'

