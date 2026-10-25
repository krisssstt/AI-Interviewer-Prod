import time
import uuid

from sqlalchemy import ForeignKey, String, false
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


def uid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    name: Mapped[str] = mapped_column(String(60))
    direction: Mapped[str] = mapped_column(String(40), default='qa')
    is_admin: Mapped[bool] = mapped_column(default=False, server_default=false())
    created_at: Mapped[float] = mapped_column(default=time.time)


class AuthSession(Base):
    __tablename__ = 'auth_sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    csrf: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[float] = mapped_column(index=True)


class RateWindow(Base):
    __tablename__ = 'rate_windows'
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int]
    expires_at: Mapped[float] = mapped_column(index=True)

