# AI Interviewer — QA learning platform

Учебный проект: серверная подготовка к ИТ-интервью с будущим RAG и оцениванием по критериям. **Текущая версия — промежуточный этап, не законченный первый выпуск.** Эргономическое исследование в текущий объём не входит.

Работают: регистрация, вход/выход, профиль, 12 QA-компетенций и 12 авторских объективных заданий, диагностика, тематическая практика, контроль с серверным таймером, пауза/продолжение, разбор с сохранёнными ссылками, история, аналитика по режимам, версии учебного плана и избранное. Данные хранятся в БД, пароли — Argon2id. Исходный интерфейс сохранён в `front/`; сервер подключает отдельный API-клиент и отключает локальные расчёты.

**Пока не реализованы:** индексированный RAG-корпус, embeddings/pgvector-поиск, вызовы LLM, открытые ответы, загрузка документов и административный интерфейс. Эти экраны честно показывают недоступность. QA-направление ещё не соответствует полной приёмке. Другие профессии — backlog. Исходный прототип не является доказательством серверной реализации.

## Быстрый запуск — PowerShell

Нужны Python 3.12 и Git; для браузерных тестов Node.js 22+.

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.lock
Copy-Item .env.example .env
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m backend.app.seed
.venv/Scripts/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Открыть [приложение](http://127.0.0.1:8000) и создать собственный аккаунт. Встроенного пароля нет. На Linux команды такие же с `.venv/bin/python`; окружение создаётся `python3 -m venv .venv`. API: `/docs`, readiness: `/api/health`. `.env` должен находиться в корне, команды запускаются оттуда. `APP_ORIGIN` должен совпадать с адресом браузера, включая host и port.

SQLite по умолчанию — для локальной разработки. PostgreSQL — целевое хранилище; его проверка ещё обязательна. Подготовлен `compose.yaml`; Docker в текущем окружении отсутствует, Compose здесь не запускался. Подробнее [operations](docs/operations.md).

## Проверки

```powershell
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m ruff check backend tests
.venv/Scripts/python -m alembic check
npm ci
npx playwright install chromium
npm test
npm run test:legacy
```

`npm test` сам создаёт временную БД, выполняет миграции/seed и запускает API на 8050. Результаты проверок и известные проблемы — в [project-state](docs/project-state.md). Подробности — [testing](docs/testing.md).

## Модели и конфигурация

В этой версии LLM/embedding адаптеры ещё не реализованы. Ключ модели не требуется и не используется; демонстрационные ответы вместо модели не выдаются. Контракт, ограничения стоимости и конфигурация провайдера будут добавлены на этапах 4–6. Внешний платный API обычными тестами не вызывается. Секреты не добавлять в Git.

Миграции — `backend/migrations/`; seed — `backend/app/seed.py`, повторный запуск не меняет существующие версии вопросов. Обновлять вопрос новой версией, а не исправлять старый JSON в рабочей БД. Сервер сохраняет снимок задания и источников в сессии.

## Документация

[Текущее состояние](docs/project-state.md) · [План](docs/implementation-plan.md) · [Требования](docs/requirements.md) · [Архитектура](docs/architecture.md) · [Модель данных](docs/data-model.md) · [Компетенции](docs/competencies.md) · [ADR](docs/decisions/) · [Оценка ИИ](docs/ai-evaluation.md) · [Аудит](docs/audit.md).

Историческая документация интерфейса: [front/README.md](front/README.md), [UI-CHANGES](front/UI-CHANGES.md). Для отдельного просмотра старого локального прототипа: `python -m http.server 8040 --directory front`; его оценки не импортируются на сервер.
