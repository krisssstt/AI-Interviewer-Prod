import time

from sqlalchemy import JSON, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base
from ..identity.models import uid


class LearningPlan(Base):
    __tablename__ = 'learning_plans'
    __table_args__ = (UniqueConstraint('user_id', 'version'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    version: Mapped[int]
    rules_version: Mapped[str] = mapped_column(String(30), default='rules-v1')
    items: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[float] = mapped_column(default=time.time)


class Favorite(Base):
    __tablename__ = 'favorites'
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    competency_id: Mapped[str] = mapped_column(ForeignKey('competencies.id'), primary_key=True)

