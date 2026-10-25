from sqlalchemy import JSON, CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class Competency(Base):
    __tablename__ = 'competencies'
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    topic: Mapped[str] = mapped_column(String(60), index=True)
    description: Mapped[str]
    prerequisites: Mapped[list] = mapped_column(JSON)
    levels: Mapped[list] = mapped_column(JSON)
    task_types: Mapped[list] = mapped_column(JSON)
    criteria: Mapped[list] = mapped_column(JSON)
    sources: Mapped[list] = mapped_column(JSON)
    direction: Mapped[str] = mapped_column(String(40), default='qa')


class QuestionVersion(Base):
    __tablename__ = 'question_versions'
    __table_args__ = (UniqueConstraint('slug', 'version'), CheckConstraint('version > 0'))
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    slug: Mapped[str] = mapped_column(String(60))
    version: Mapped[int]
    competency_id: Mapped[str] = mapped_column(ForeignKey('competencies.id'), index=True)
    published: Mapped[bool] = mapped_column(default=True)
    content: Mapped[dict] = mapped_column(JSON)

