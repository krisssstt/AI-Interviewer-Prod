import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError

from . import models  # noqa: F401
from .competencies.http import router as competencies
from .config import Settings
from .db import database
from .errors import RuleError
from .identity.http import router as identity
from .learning.http import router as learning
from .training.http import router as training

ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT / 'front'


def create_app(settings=None):
    settings = settings or Settings()
    engine, sessions = database(settings.database_url)

    @asynccontextmanager
    async def lifespan(app):
        yield
        engine.dispose()

    app = FastAPI(title='QA Interviewer', version='0.1.0', lifespan=lifespan)
    app.state.settings, app.state.engine, app.state.sessions = settings, engine, sessions

    @app.exception_handler(RuleError)
    async def rules(request, exc):
        return JSONResponse({'detail': exc.message}, status_code=exc.status,
                            headers={'Retry-After': '60'} if exc.status == 429 else {})

    @app.exception_handler(RequestValidationError)
    async def validation(request, exc):
        # Default validation includes submitted values; never reflect passwords.
        return JSONResponse({'detail': 'Проверьте поля формы.',
                             'fields': [{'loc': e['loc'], 'type': e['type']} for e in exc.errors()]}, 422)

    @app.exception_handler(IntegrityError)
    async def conflict(request, exc):
        return JSONResponse({'detail': 'Данные изменились параллельно. Повторите запрос с тем же ключом.'}, 409)

    @app.middleware('http')
    async def security(request: Request, call_next):
        if request.url.path.startswith('/api/') and request.method not in {'GET', 'HEAD', 'OPTIONS'}:
            origin = request.headers.get('origin')
            if origin and origin != settings.app_origin:
                return JSONResponse({'detail': 'Недопустимый источник запроса.'}, 403)
            if request.headers.get('content-type', '').split(';')[0] != 'application/json':
                return JSONResponse({'detail': 'Требуется application/json.'}, 415)
            data = bytearray()
            async for chunk in request.stream():
                data.extend(chunk)
                if len(data) > 65536:
                    return JSONResponse({'detail': 'Слишком большой запрос.'}, 413)
            request._body = bytes(data)
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'same-origin'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; "
            "base-uri 'self'; form-action 'self'")
        return response

    for router in [identity, competencies, training, learning]:
        app.include_router(router)

    @app.get('/api/health')
    def health():
        try:
            with engine.connect() as connection:
                revision = connection.execute(text('SELECT version_num FROM alembic_version')).scalar()
            return {'status': 'ok', 'schema': revision, 'ai': 'not_integrated'}
        except OperationalError:
            return JSONResponse({'status': 'not_ready', 'detail': 'Выполните миграции.'}, 503)

    @app.get('/')
    def index():
        return RedirectResponse('/pages/login.html')

    @app.get('/pages/{page}')
    def page(page: str):
        path = FRONT / 'pages' / page
        if not re.fullmatch(r'[a-z0-9-]+\.html', page) or not path.is_file():
            return HTMLResponse('Страница не найдена', 404)
        html = path.read_text(encoding='utf-8')
        # Never run local grading/auth alongside server integration.
        html = re.sub(r'<script\b[^>]*>.*?</script>', '', html, flags=re.DOTALL)
        if page not in {'login.html', 'register.html'}:
            html = re.sub(r'<main\b.*?</main>',
                          '<main class="screen fixed"><p role="status">Загрузка…</p></main>', html, flags=re.DOTALL)
        html = html.replace('</head>', '<link rel="stylesheet" href="/css/server.css">'
                            '<script src="/js/theme.js"></script>'
                            '<script src="/js/api.js" defer></script>'
                            '<script src="/js/server-ui.js" defer></script></head>')
        return HTMLResponse(html)

    @app.get('/js/{name}')
    def javascript(name: str):
        if name not in {'theme.js', 'api.js', 'server-ui.js'}:
            return JSONResponse({'detail': 'Скрипт прототипа недоступен в серверном режиме.'}, 404)
        return FileResponse(FRONT / 'js' / name, media_type='text/javascript')

    for directory in ['css', 'fonts', 'images']:
        app.mount('/' + directory, StaticFiles(directory=FRONT / directory), name=directory)
    return app


app = create_app()
