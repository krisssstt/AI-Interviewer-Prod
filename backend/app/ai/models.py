import time

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base
from ..identity.models import uid


class AiTask(Base):
    __tablename__ = 'ai_tasks'
    __table_args__ = (
        UniqueConstraint('user_id', 'request_key'),
        CheckConstraint("kind IN ('lesson','evaluation')"),
        CheckConstraint("status IN ('queued','running','retry','completed','failed','no_sources')"),
        CheckConstraint('attempts >= 0 AND hints_used >= 0'),
        Index('ix_ai_claim', 'status', 'available_at', 'lease_until'),
        Index('ix_ai_owner_created', 'user_id', 'created_at'),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    parent_id: Mapped[str | None] = mapped_column(ForeignKey('ai_tasks.id', ondelete='CASCADE'), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    request_key: Mapped[str] = mapped_column(String(64))
    request_hash: Mapped[str] = mapped_column(String(64))
    request: Mapped[dict] = mapped_column(JSON)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    output: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default='queued')
    attempts: Mapped[int] = mapped_column(default=0)
    hints_used: Mapped[int] = mapped_column(default=0)
    available_at: Mapped[float] = mapped_column(default=time.time)
    lease_until: Mapped[float | None]
    lease_token: Mapped[str | None] = mapped_column(String(36))
    error_code: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[float] = mapped_column(default=time.time)
    completed_at: Mapped[float | None]


class AiSource(Base):
    __tablename__ = 'ai_sources'
    task_id: Mapped[str] = mapped_column(ForeignKey('ai_tasks.id', ondelete='CASCADE'), primary_key=True)
    chunk_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    # Snapshot stays for public history. Private deletion purges dependent tasks first.
    version_id: Mapped[str | None] = mapped_column(
        ForeignKey('document_versions.id', ondelete='SET NULL'), index=True)


class AiAttempt(Base):
    __tablename__ = 'ai_attempts'
    __table_args__ = (UniqueConstraint('task_id', 'number'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    task_id: Mapped[str] = mapped_column(ForeignKey('ai_tasks.id', ondelete='CASCADE'), index=True)
    number: Mapped[int]
    model: Mapped[str] = mapped_column(String(100))
    model_digest: Mapped[str] = mapped_column(String(64))
    prompt_version: Mapped[str] = mapped_column(String(40))
    parameters: Mapped[dict] = mapped_column(JSON)
    input_snapshot: Mapped[dict] = mapped_column(JSON)
    raw_response: Mapped[str | None]
    status: Mapped[str] = mapped_column(String(20), default='running')
    error_code: Mapped[str | None] = mapped_column(String(60))
    input_tokens: Mapped[int | None]
    output_tokens: Mapped[int | None]
    reserved_tokens: Mapped[int]
    quota_day: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[float] = mapped_column(default=time.time)
    finished_at: Mapped[float | None]


class AiQuota(Base):
    __tablename__ = 'ai_quotas'
    __table_args__ = (CheckConstraint('requests >= 0 AND tokens >= 0'),)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    requests: Mapped[int] = mapped_column(default=0)
    tokens: Mapped[int] = mapped_column(default=0)
