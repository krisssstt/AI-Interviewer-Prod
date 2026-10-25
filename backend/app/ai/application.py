import copy
import hashlib
import json
import time

from sqlalchemy import func, select, update

from ..competencies.models import Competency
from ..errors import RuleError
from .models import AiSource, AiTask


def owned(db, user_id, task_id):
    task = db.scalar(select(AiTask).where(AiTask.id == task_id, AiTask.user_id == user_id))
    if not task:
        raise RuleError('Учебное задание не найдено.', 404)
    return task


def enqueue(db, user_id, kind, payload, request_key, parent_id=None, sources=None):
    fingerprint = hashlib.sha256(json.dumps({'kind': kind, 'payload': payload, 'parent': parent_id},
                                          sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    old = db.scalar(select(AiTask).where(AiTask.user_id == user_id, AiTask.request_key == request_key))
    if old:
        if old.request_hash != fingerprint:
            raise RuleError('Ключ запроса уже использован с другими параметрами.')
        return old
    active = db.scalar(select(func.count()).select_from(AiTask).where(
        AiTask.user_id == user_id, AiTask.status.in_(['queued', 'running', 'retry'])))
    if active >= 4:
        raise RuleError('Уже обрабатываются четыре задания. Дождитесь результата.', 429)
    task = AiTask(user_id=user_id, kind=kind, parent_id=parent_id, request=copy.deepcopy(payload),
                  request_key=request_key, request_hash=fingerprint, sources=copy.deepcopy(sources or []))
    db.add(task)
    db.flush()
    for source in sources or []:
        db.add(AiSource(task_id=task.id, chunk_id=source['id'], version_id=source['document_version_id']))
    db.commit()
    return task


def create_lesson(db, user_id, data):
    competency = db.get(Competency, data.competency_id)
    if not competency or data.difficulty not in competency.levels:
        raise RuleError('Компетенция или уровень недоступны.', 422)
    payload = {'competency_id': data.competency_id, 'difficulty': data.difficulty,
               'query': data.query or competency.description,
               'include_private': data.include_private, 'description': competency.description}
    parent_id = None
    if data.previous_submission_id:
        previous = owned(db, user_id, data.previous_submission_id)
        if previous.kind != 'evaluation' or previous.status != 'completed':
            raise RuleError('Сначала дождитесь завершённого разбора ответа.')
        lesson = owned(db, user_id, previous.parent_id)
        if lesson.request['competency_id'] != data.competency_id:
            raise RuleError('Закрепление должно относиться к той же компетенции.', 422)
        payload['previous_feedback'] = previous.output
        parent_id = previous.id
    return enqueue(db, user_id, 'lesson', payload, data.request_key, parent_id)


def submit(db, user_id, lesson_id, answer, request_key):
    lesson = owned(db, user_id, lesson_id)
    if lesson.kind != 'lesson' or lesson.status != 'completed':
        raise RuleError('Учебное упражнение ещё не подготовлено.')
    if not answer.strip():
        raise RuleError('Введите непустой ответ.', 422)
    snapshot = copy.deepcopy(lesson.output['exercise'])
    payload = {'answer': answer, 'question_snapshot': snapshot,
               'question_version_id': lesson.id + ':v1',
               'competency_id': lesson.request['competency_id'],
               'difficulty': lesson.request['difficulty'], 'hint_used': lesson.hints_used > 0}
    # Freeze hint fact on first commit. A network replay after a later hint must
    # return the original submission rather than silently reclassify independence.
    previous = db.scalar(select(AiTask).where(AiTask.user_id == user_id, AiTask.request_key == request_key))
    if previous:
        if (previous.kind != 'evaluation' or previous.parent_id != lesson_id or
                previous.request['answer'] != answer):
            raise RuleError('Повторный ключ запроса с другим ответом.')
        return previous
    return enqueue(db, user_id, 'evaluation', payload, request_key, lesson.id, lesson.sources)


def get_hint(db, user_id, lesson_id):
    lesson = owned(db, user_id, lesson_id)
    if lesson.kind != 'lesson' or lesson.status != 'completed':
        raise RuleError('Упражнение ещё не готово.')
    hints = lesson.output['exercise']['hints']
    count = lesson.hints_used
    if count >= len(hints):
        return {'text': hints[-1], 'used': count, 'remaining': 0}
    result = db.execute(update(AiTask).where(AiTask.id == lesson.id, AiTask.hints_used == count)
                        .values(hints_used=count + 1).execution_options(synchronize_session=False))
    if result.rowcount != 1:
        raise RuleError('Подсказка уже открыта в другом запросе. Повторите действие.')
    db.commit()
    return {'text': hints[count], 'used': count + 1, 'remaining': len(hints) - count - 1}


def retry(db, user_id, task_id, max_attempts):
    task = owned(db, user_id, task_id)
    if task.status not in {'failed', 'retry', 'no_sources'} or task.attempts >= max_attempts:
        raise RuleError('Повтор недоступен или исчерпан лимит попыток.')
    task.status, task.available_at, task.error_code = 'queued', time.time(), None
    db.commit()
    return task


def view(db, task):
    result = {'id': task.id, 'kind': task.kind, 'parent_id': task.parent_id, 'status': task.status,
              'attempts': task.attempts, 'error_code': task.error_code, 'created_at': task.created_at,
              'completed_at': task.completed_at, 'competency_id': task.request['competency_id'],
              'difficulty': task.request['difficulty'], 'hint_used': task.hints_used > 0,
              'output': None, 'sources': [], 'score': None}
    if task.status != 'completed':
        return result
    result['sources'] = [{k: v for k, v in source.items() if k not in {'text', 'rank_score'}}
                         for source in task.sources]
    if task.kind == 'lesson':
        output = task.output
        exercise = {k: output['exercise'][k] for k in ['title', 'kind', 'support']}
        graded = db.scalar(select(AiTask.id).where(AiTask.parent_id == task.id,
                           AiTask.kind == 'evaluation', AiTask.status == 'completed').limit(1))
        if graded:
            exercise.update({k: output['exercise'][k] for k in ['criteria', 'expected_elements', 'expected_answer']})
        result['output'] = {**{k: output[k] for k in ['explanation', 'examples', 'common_mistakes']},
                            'exercise': exercise}
    else:
        result['output'] = task.output
        result['score'] = task.output['score']
        result['hint_used'] = task.request['hint_used']
        result['answer'] = task.request['answer']
        result['question_version_id'] = task.request['question_version_id']
        result['rubric'] = task.request['question_snapshot']['criteria']
        result['expected_answer'] = task.request['question_snapshot']['expected_answer']
    result['notice'] = ('Учебная ИИ-оценка требует валидации качества. Проверка ссылок и цитат '
                        'сама по себе не доказывает правильность объяснения.')
    return result
