import time

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base
from ..identity.models import uid


class TrainingSession(Base):
    __tablename__ = 'training_sessions'
    __table_args__ = (
        CheckConstraint("status IN ('active','paused','completed','expired')"),
        CheckConstraint("mode IN ('diagnostic','practice','exam')"),
        CheckConstraint('position >= 0 AND revision >= 0'),
        Index('ix_training_owner_created', 'user_id', 'created_at'),
        UniqueConstraint('user_id', 'request_key'),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    request_key: Mapped[str] = mapped_column(String(64))
    request_payload: Mapped[dict] = mapped_column(JSON)
    mode: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default='active')
    position: Mapped[int] = mapped_column(default=0)
    revision: Mapped[int] = mapped_column(default=0)
    questions: Mapped[list] = mapped_column(JSON)
    hinted: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[float] = mapped_column(default=time.time)
    deadline: Mapped[float | None]
    finished_at: Mapped[float | None]


class Answer(Base):
    __tablename__ = 'answers'
    __table_args__ = (
        UniqueConstraint('session_id', 'question_version_id'),
        UniqueConstraint('session_id', 'request_key'),
        CheckConstraint('score >= 0 AND score <= 100'),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey('training_sessions.id', ondelete='CASCADE'), index=True)
    question_version_id: Mapped[str] = mapped_column(ForeignKey('question_versions.id'))
    request_key: Mapped[str] = mapped_column(String(64))
    value: Mapped[str] = mapped_column(String(10000))
    score: Mapped[int]
    hint_used: Mapped[bool]
    evaluation: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[float] = mapped_column(default=time.time)

