import secrets

from fastapi import Depends, Request

from .errors import RuleError
from .identity.service import authenticate, rate_limit


def get_db(request: Request):
    with request.app.state.sessions() as db:
        yield db


def current(request: Request, db=Depends(get_db)):
    user, session = authenticate(db, request.cookies.get('ai_session'))
    if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
        if not secrets.compare_digest(request.headers.get('X-CSRF-Token', ''), session.csrf):
            raise RuleError('Недействительный CSRF-токен. Обновите страницу.', 403)
        rate_limit(db, f'api:{user.id}', limit=120)
    return user, session

