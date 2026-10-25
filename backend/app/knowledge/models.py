import time

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base
from ..identity.models import uid


class Document(Base):
    __tablename__ = 'knowledge_documents'
    __table_args__ = (CheckConstraint("scope IN ('public','private')"),
                     CheckConstraint("scope != 'private' OR owner_id IS NOT NULL"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    scope: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(200))
    current_version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[float] = mapped_column(default=time.time)


class DocumentVersion(Base):
    __tablename__ = 'document_versions'
    __table_args__ = (UniqueConstraint('document_id', 'version'), CheckConstraint('version > 0'))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    document_id: Mapped[str] = mapped_column(ForeignKey('knowledge_documents.id', ondelete='CASCADE'), index=True)
    version: Mapped[int]
    text: Mapped[str]
    source_title: Mapped[str] = mapped_column(String(200))
    content_hash: Mapped[str] = mapped_column(String(64))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    language: Mapped[str] = mapped_column(String(10), default='ru')
    competency_id: Mapped[str] = mapped_column(ForeignKey('competencies.id'), index=True)
    license: Mapped[str] = mapped_column(String(200))
    received_at: Mapped[float] = mapped_column(default=time.time)
    status: Mapped[str] = mapped_column(String(30), default='queued')
    chunker_version: Mapped[str] = mapped_column(String(30), default='paragraph-v1')


class Chunk(Base):
    __tablename__ = 'knowledge_chunks'
    __table_args__ = (UniqueConstraint('version_id', 'ordinal'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    version_id: Mapped[str] = mapped_column(ForeignKey('document_versions.id', ondelete='CASCADE'), index=True)
    ordinal: Mapped[int]
    section: Mapped[str] = mapped_column(String(300))
    start_offset: Mapped[int]
    end_offset: Mapped[int]
    text: Mapped[str]


class VersionCompetency(Base):
    __tablename__ = 'document_competencies'
    version_id: Mapped[str] = mapped_column(ForeignKey('document_versions.id', ondelete='CASCADE'), primary_key=True)
    competency_id: Mapped[str] = mapped_column(ForeignKey('competencies.id'), primary_key=True, index=True)


class Embedding(Base):
    __tablename__ = 'chunk_embeddings'
    __table_args__ = (UniqueConstraint('chunk_id', 'model_key'),
                     Index('ix_embeddings_model', 'model_key'))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    chunk_id: Mapped[str] = mapped_column(ForeignKey('knowledge_chunks.id', ondelete='CASCADE'))
    model_key: Mapped[str] = mapped_column(String(200))
    # Dimension is part of model_key; unconstrained pgvector avoids mixing model migrations.
    vector: Mapped[list] = mapped_column(JSON().with_variant(Vector(), 'postgresql'))


class IngestionJob(Base):
    __tablename__ = 'ingestion_jobs'
    __table_args__ = (UniqueConstraint('version_id', 'model_key'),
                     CheckConstraint("status IN ('queued','running','retry','completed','failed')"),
                     Index('ix_jobs_claim', 'status', 'available_at', 'lease_until'))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    version_id: Mapped[str] = mapped_column(ForeignKey('document_versions.id', ondelete='CASCADE'))
    model_key: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default='queued')
    attempts: Mapped[int] = mapped_column(default=0)
    available_at: Mapped[float] = mapped_column(default=time.time)
    lease_until: Mapped[float | None]
    lease_token: Mapped[str | None] = mapped_column(String(36))
    error_code: Mapped[str | None] = mapped_column(String(60))
