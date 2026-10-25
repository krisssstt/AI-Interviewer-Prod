import json
import time
import uuid

from pydantic import ValidationError
from sqlalchemy import and_, or_, select, update

from ..errors import RuleError
from ..knowledge.adapters import OllamaEmbedder
from ..knowledge.service import search
from .domain import InvalidArtifact, validate_assessment, validate_lesson
from .models import AiAttempt, AiSource, AiTask
from .prompts import PROMPT_VERSIONS, messages
from .providers import ProviderFailure
from .quota import reserve, settle
from .schemas import AssessmentOutput, LessonOutput


def claim(db, settings):
    now = time.time()
    db.execute(update(AiTask).where(AiTask.status == 'running', AiTask.lease_until < now,
                                   AiTask.attempts >= settings.ai_attempt_limit).values(
        status='failed', error_code='worker_lease_exhausted', lease_token=None, lease_until=None))
    available = or_(and_(AiTask.status.in_(['queued', 'retry']), AiTask.available_at <= now),
                    and_(AiTask.status == 'running', AiTask.lease_until < now))
    task = db.scalar(select(AiTask).where(available, AiTask.attempts < settings.ai_attempt_limit)
                     .order_by(AiTask.available_at).with_for_update(skip_locked=True).limit(1))
    if not task:
        db.commit()
        return None
    token = str(uuid.uuid4())
    updated = db.execute(update(AiTask).where(AiTask.id == task.id, available).values(
        status='running', attempts=AiTask.attempts + 1, lease_token=token,
        lease_until=now + settings.llm_timeout_seconds * 3 + 120)
        .execution_options(synchronize_session=False))
    db.commit()
    return (task.id, token) if updated.rowcount == 1 else None


def fail(db, task_id, token, code, retryable, settings, attempt_id=None):
    task = db.get(AiTask, task_id)
    if not task or task.lease_token != token:
        return
    task.status = 'retry' if retryable and task.attempts < settings.ai_attempt_limit else 'failed'
    task.error_code, task.lease_token, task.lease_until = code, None, None
    task.available_at = time.time() + min(300, 5 * 2 ** task.attempts)
    if attempt_id:
        attempt = db.get(AiAttempt, attempt_id)
        if attempt:
            attempt.status, attempt.error_code, attempt.finished_at = 'failed', code, time.time()
    db.commit()


def process_one(sessions, settings, model, embedder=None):
    """Durable bounded processing: a failed model call never becomes a zero grade."""
    with sessions() as db:
        claimed = claim(db, settings)
        if not claimed:
            return False
        task_id, token = claimed
        task = db.get(AiTask, task_id)
        kind, payload = task.kind, task.request
        if kind == 'lesson' and not task.sources:
            try:
                found = search(db, task.user_id, payload['query'], payload['competency_id'],
                               'hybrid' if db.bind.dialect.name == 'postgresql' else 'lexical',
                               embedder or OllamaEmbedder(settings), limit=4,
                               include_private=payload['include_private'])
            except RuleError:
                fail(db, task_id, token, 'retrieval_unavailable', True, settings)
                return True
            if not found['sources']:
                task.status, task.error_code = 'no_sources', 'no_verified_sources'
                task.lease_token, task.lease_until = None, None
                db.commit()
                return True
            task.sources = found['sources']
            for source in task.sources:
                db.add(AiSource(task_id=task.id, chunk_id=source['id'], version_id=source['document_version_id']))
        sources = task.sources
        schema_class = LessonOutput if kind == 'lesson' else AssessmentOutput
        prompt = messages(kind, payload, sources)
        schema = schema_class.model_json_schema()
        # Bounded source context plus provider context/token limits. This is a
        # conservative byte guard, not a claim of exact tokenizer equivalence.
        serialized = json.dumps({'messages': prompt, 'schema': schema}, ensure_ascii=False)
        if len(serialized.encode()) > settings.llm_context_tokens * 3:
            fail(db, task_id, token, 'context_budget_exceeded', False, settings)
            return True
        reserved = reserve(db, task.user_id, settings)
        if not reserved:
            fail(db, task_id, token, 'daily_ai_budget_exhausted', False, settings)
            return True
        day, token_budget = reserved
        parameters = {'temperature': 0, 'seed': 42, 'num_predict': settings.llm_max_output_tokens,
                      'num_ctx': settings.llm_context_tokens}
        # Expired previous attempt remains in the audit trail and consumes budget.
        db.execute(update(AiAttempt).where(AiAttempt.task_id == task_id, AiAttempt.status == 'running')
                   .values(status='interrupted', error_code='worker_restart', finished_at=time.time()))
        attempt = AiAttempt(task_id=task_id, number=task.attempts, model=model.model,
            model_digest=model.digest, prompt_version=PROMPT_VERSIONS[kind], parameters=parameters,
            input_snapshot={'messages': prompt, 'schema': schema}, reserved_tokens=token_budget, quota_day=day)
        db.add(attempt)
        db.commit()
        attempt_id, owner_id = attempt.id, task.user_id
    # Provider call has no open DB transaction and is safe to lose on restart.
    try:
        completion = model.complete(prompt, schema, parameters)
        if completion.model != model.model or completion.digest != model.digest:
            raise ProviderFailure('completion_model_mismatch', retryable=False)
        output = schema_class.model_validate_json(completion.content)
        if kind == 'lesson':
            validate_lesson(output, payload, sources)
            result = output.model_dump()
        else:
            score = validate_assessment(output, payload['question_snapshot'], payload['answer'], sources)
            result = {**output.model_dump(), 'score': score,
                      'grounding_check': 'source_ids_and_exact_quotes_only'}
    except ProviderFailure as error:
        with sessions() as db:
            fail(db, task_id, token, error.code, error.retryable, settings, attempt_id)
        return True
    except (ValidationError, InvalidArtifact, ValueError) as error:
        code = str(error) if isinstance(error, InvalidArtifact) else 'invalid_structured_output'
        with sessions() as db:
            attempt = db.get(AiAttempt, attempt_id)
            if attempt:
                attempt.raw_response = completion.content[:131072]
                attempt.input_tokens, attempt.output_tokens = completion.input_tokens, completion.output_tokens
                settle(db, owner_id, attempt, completion.input_tokens + completion.output_tokens)
            fail(db, task_id, token, code, True, settings, attempt_id)
        return True
    with sessions() as db:
        task = db.scalar(select(AiTask).where(AiTask.id == task_id).with_for_update())
        if not task or task.lease_token != token or task.lease_until < time.time():
            return True  # Source/user deletion or replacement lease: discard provider output.
        attempt = db.get(AiAttempt, attempt_id)
        attempt.raw_response, attempt.status = completion.content, 'completed'
        attempt.input_tokens, attempt.output_tokens = completion.input_tokens, completion.output_tokens
        attempt.finished_at = time.time()
        settle(db, owner_id, attempt, completion.input_tokens + completion.output_tokens)
        task.output, task.status, task.completed_at = result, 'completed', time.time()
        task.lease_token, task.lease_until, task.error_code = None, None, None
        db.commit()
    return True
