from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from ..dependencies import current, get_db
from ..errors import RuleError
from . import service

router = APIRouter(prefix='/api', tags=['identity'])


class Credentials(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=False)
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128, repr=False)


class Registration(Credentials):
    name: str = Field(min_length=2, max_length=60, pattern=r'\S')


class Profile(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=2, max_length=60, pattern=r'\S')


def public_user(user, session):
    return {'id': user.id, 'email': user.email, 'name': user.name,
            'direction': user.direction, 'csrf_token': session.csrf,
            'expires_at': session.expires_at}


def auth_response(request, response, db, data, registering):
    address = request.client.host if request.client else 'unknown'
    service.rate_limit(db, f'auth:ip:{address}', limit=20)
    service.rate_limit(db, f'auth:email:{data.email.lower()}', limit=10)
    user = (service.register(db, str(data.email), data.password, data.name) if registering
            else service.login(db, str(data.email), data.password))
    settings = request.app.state.settings
    token, session = service.issue_session(db, user, settings.session_hours,
                                           request.cookies.get('ai_session'))
    response.set_cookie('ai_session', token, httponly=True, secure=settings.cookie_secure,
                        samesite='lax', max_age=settings.session_hours * 3600, path='/')
    return public_user(user, session)


@router.post('/auth/register', status_code=201)
def register(data: Registration, request: Request, response: Response, db=Depends(get_db)):
    return auth_response(request, response, db, data, True)


@router.post('/auth/login')
def login(data: Credentials, request: Request, response: Response, db=Depends(get_db)):
    return auth_response(request, response, db, data, False)


@router.post('/auth/logout', status_code=204)
def logout(response: Response, actor=Depends(current), db=Depends(get_db)):
    db.delete(actor[1])
    db.commit()
    response.delete_cookie('ai_session', path='/')


@router.get('/me')
def me(actor=Depends(current)):
    return public_user(*actor)


@router.patch('/me')
def profile(data: Profile, actor=Depends(current), db=Depends(get_db)):
    actor[0].name = data.name.strip()
    db.commit()
    return public_user(*actor)


@router.post('/auth/password-reset')
def reset_password():
    raise RuleError('Почтовый сервис пока не подключён. Письмо не отправлено.', 503)

