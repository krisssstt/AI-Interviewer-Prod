import hashlib
import secrets
import time

from pwdlib import PasswordHash
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError

from ..errors import RuleError
from .models import AuthSession, RateWindow, User

passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash('unused-comparison-secret')


def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


def rate_limit(db, key: str, limit=10, seconds=60):
    """Independent committed transaction: failed login must still consume the limit."""
    now = time.time()
    key = digest(f'{key}:{int(now // seconds)}')
    db.execute(delete(RateWindow).where(RateWindow.expires_at < now))
    row = db.get(RateWindow, key)
    if row is None:
        try:
            with db.begin_nested():
                db.add(RateWindow(key=key, count=0, expires_at=now + seconds))
                db.flush()
        except IntegrityError:
            pass
    result = db.execute(update(RateWindow).where(RateWindow.key == key,
                         RateWindow.count < limit).values(count=RateWindow.count + 1))
    db.commit()
    if result.rowcount != 1:
        raise RuleError('Слишком много запросов. Повторите через минуту.', 429)


def register(db, email, password, name):
    user = User(email=email.lower(), password_hash=passwords.hash(password), name=name.strip())
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise RuleError('Этот email уже зарегистрирован.', 409) from None
    return user


def login(db, email, password):
    user = db.scalar(select(User).where(User.email == email.lower()))
    valid = passwords.verify(password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        raise RuleError('Неверный email или пароль.', 401)
    return user


def issue_session(db, user, hours, previous_token=None):
    if previous_token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == digest(previous_token)))
    token = secrets.token_urlsafe(32)
    session = AuthSession(token_hash=digest(token), user_id=user.id,
                          csrf=secrets.token_hex(32), expires_at=time.time() + hours * 3600)
    db.add(session)
    db.commit()
    return token, session


def authenticate(db, token):
    session = db.get(AuthSession, digest(token)) if token else None
    if not session or session.expires_at <= time.time():
        raise RuleError('Авторизация истекла. Войдите снова.', 401)
    return db.get(User, session.user_id), session

