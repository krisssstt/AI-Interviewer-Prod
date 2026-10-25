import time

from sqlalchemy import select, update

from ..competencies.models import QuestionVersion
from ..errors import RuleError
from ..learning.service import update_plan
from .domain import MODES, evaluate, transition
from .models import Answer, TrainingSession


def owned(db, user_id, session_id):
    session = db.scalar(select(TrainingSession).where(TrainingSession.id == session_id,
                        TrainingSession.user_id == user_id).with_for_update())
    if not session:
        raise RuleError('Сессия не найдена.', 404)
    return session


def revise(db, session, **changes):
    result = db.execute(update(TrainingSession).where(
        TrainingSession.id == session.id, TrainingSession.revision == session.revision)
        .values(**changes, revision=session.revision + 1)
        .execution_options(synchronize_session=False))
    if result.rowcount != 1:
        raise RuleError('Сессия изменена другим запросом. Обновите страницу.', 409)
    db.refresh(session)


def create(db, user_id, mode, competency_id, request_key):
    payload = {'mode': mode, 'competency_id': competency_id}
    existing = db.scalar(select(TrainingSession).where(
        TrainingSession.user_id == user_id, TrainingSession.request_key == request_key))
    if existing:
        if existing.request_payload != payload:
            raise RuleError('Ключ запроса уже использован с другими параметрами.')
        return existing
    if mode not in MODES:
        raise RuleError('Неподдерживаемый режим.', 422)
    query = select(QuestionVersion).where(QuestionVersion.published.is_(True))
    if competency_id:
        query = query.where(QuestionVersion.competency_id == competency_id)
    questions = db.scalars(query.order_by(QuestionVersion.slug, QuestionVersion.version.desc())).all()
    # Exactly one (latest published) version per logical question.
    versions = {}
    for question in questions:
        versions.setdefault(question.slug, question)
    snapshots = [{**q.content, 'id': q.id, 'version': q.version,
                  'competency_id': q.competency_id} for q in versions.values()]
    if not snapshots:
        raise RuleError('Нет опубликованных заданий для выбранной компетенции.', 422)
    # Resource bound for the initial release; diagnostic/exam sample every competency.
    snapshots = snapshots[:24]
    session = TrainingSession(user_id=user_id, request_key=request_key,
                              request_payload=payload, mode=mode, questions=snapshots,
                              deadline=time.time() + 1800 if mode == 'exam' else None)
    db.add(session)
    db.commit()
    return session


def expire(db, session):
    if session.status in {'active', 'paused'} and session.deadline and time.time() >= session.deadline:
        revise(db, session, status='expired', finished_at=time.time())
        update_plan(db, session.user_id)
        db.commit()
    return session


def view(db, session):
    expire(db, session)
    answers = db.scalars(select(Answer).where(Answer.session_id == session.id)
                         .order_by(Answer.created_at)).all()
    finished = session.status in {'completed', 'expired'}
    current = session.questions[session.position] if session.position < len(session.questions) and not finished else None
    public = None
    if current:
        public = {key: current[key] for key in ['id', 'version', 'competency_id', 'type', 'title', 'options']}
    report = []
    if finished:
        for question in session.questions:
            answer = next((a for a in answers if a.question_version_id == question['id']), None)
            report.append({'question_version_id': question['id'], 'title': question['title'],
                           'competency_id': question['competency_id'],
                           'value': answer.value if answer else None,
                           'value_text': (question['options'][int(answer.value)] if answer and
                                          question['type'] == 'choice' else answer.value if answer else None),
                           'score': answer.score if answer else None,
                           'status': 'completed' if answer else 'unanswered',
                           'hint_used': answer.hint_used if answer else False,
                           'expected': question['expected'], 'explanation': question['explanation'],
                           'sources': question['sources'],
                           'evaluation': answer.evaluation if answer else None})
    return {'id': session.id, 'mode': session.mode, 'status': session.status,
            'position': session.position, 'total': len(session.questions),
            'answered': len(answers), 'question': public,
            'deadline': session.deadline, 'server_time': time.time(),
            'created_at': session.created_at, 'finished_at': session.finished_at,
            'score': round(sum(a.score for a in answers) / len(session.questions)) if finished else None,
            'report': report, 'hint_available': session.mode == 'practice' and not finished,
            'unanswered_policy': 'Неотвеченные объективные задания учитываются как 0 только после завершения.'}


def submit(db, user_id, session_id, question_id, value, request_key):
    session = owned(db, user_id, session_id)
    # Check replays before state or expiry: retrying a committed response is safe.
    previous = db.scalar(select(Answer).where(Answer.session_id == session_id,
                         Answer.request_key == request_key))
    if previous:
        if previous.question_version_id != question_id or previous.value != value:
            raise RuleError('Повторный ключ запроса с другим ответом.')
        return session
    expire(db, session)
    if session.status != 'active':
        raise RuleError('Сессия не активна.')
    question = session.questions[session.position]
    if question['id'] != question_id:
        raise RuleError('Этот вопрос уже отвечен или ещё не наступил.')
    score, evaluation = evaluate(question, value)
    evaluation['criteria_snapshot'] = question['criteria']
    evaluation['processing_ms'] = 0  # deterministic calculation, no AI call
    db.add(Answer(session_id=session.id, question_version_id=question_id,
                  request_key=request_key, value=value, score=score,
                  hint_used=question_id in session.hinted, evaluation=evaluation))
    position = session.position + 1
    changes = {'position': position}
    if position == len(session.questions):
        changes.update(status='completed', finished_at=time.time())
    # flush answer + compare-and-swap session are one transaction
    db.flush()
    revise(db, session, **changes)
    if session.status == 'completed':
        update_plan(db, user_id)
    db.commit()
    return session


def change_state(db, user_id, session_id, action):
    session = expire(db, owned(db, user_id, session_id))
    target = {'pause': 'paused', 'resume': 'active', 'finish': 'completed'}[action]
    transition(session.status, target)
    if session.status != target:
        revise(db, session, status=target, **({'finished_at': time.time()} if target == 'completed' else {}))
        if target == 'completed':
            update_plan(db, user_id)
        db.commit()
    return session


def hint(db, user_id, session_id):
    session = expire(db, owned(db, user_id, session_id))
    if session.mode != 'practice' or session.status != 'active':
        raise RuleError('Подсказки доступны только в активной учебной практике.', 403)
    question = session.questions[session.position]
    if question['id'] not in session.hinted:
        revise(db, session, hinted=[*session.hinted, question['id']])
        db.commit()
    return {'text': question['hint'], 'sources': question['sources'],
            'notice': 'Ответ с подсказкой не подтверждает самостоятельное знание.'}

