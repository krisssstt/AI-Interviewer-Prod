from datetime import UTC, datetime

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from .models import AiQuota


def reserve(db, user_id, settings):
    day = datetime.now(UTC).date().isoformat()
    upper_bound = settings.llm_context_tokens + settings.llm_max_output_tokens
    if not db.get(AiQuota, (user_id, day)):
        try:
            with db.begin_nested():
                db.add(AiQuota(user_id=user_id, day=day, requests=0, tokens=0))
                db.flush()
        except IntegrityError:
            pass
    updated = db.execute(update(AiQuota).where(AiQuota.user_id == user_id, AiQuota.day == day,
        AiQuota.requests < settings.ai_daily_request_limit,
        AiQuota.tokens + upper_bound <= settings.ai_daily_token_budget).values(
            requests=AiQuota.requests + 1, tokens=AiQuota.tokens + upper_bound))
    if updated.rowcount != 1:
        return None
    return day, upper_bound


def settle(db, user_id, attempt, actual_tokens):
    # A failed/unknown provider call keeps its full reservation. No free retry storm.
    refund = max(0, attempt.reserved_tokens - actual_tokens)
    db.execute(update(AiQuota).where(AiQuota.user_id == user_id, AiQuota.day == attempt.quota_day,
                                    AiQuota.tokens >= refund).values(tokens=AiQuota.tokens - refund))
