# Состояние на 2026-10-25

## Реализовано

Сохранён прототип front/, инициализирован Git. Аудит, требования, ADR, архитектура, модель данных, план и инструкции. FastAPI/SQLAlchemy/Alembic, 12 QA-компетенций/choice-заданий, idempotent seed. Auth: Argon2id, HttpOnly cookie-сеансы, CSRF, Origin, DB rate limits, профиль/logout. Сессии diagnostic/practice/exam, snapshots, серверный deadline, hints, pause/resume/finish, request_key/revision. История, аналитика режимов, версии плана, favorites. API-клиент и серверный UI без legacy-оценивания/выдачи локальных ключей.

Этап 4: 12 реальных авторских текстовых материалов; Document/Version/Chunk/Embedding, public/private ACL, административная роль и CLI назначения. TXT/Markdown upload/read/update/delete/reindex UI/API, provenance, lexical search, Ollama embedder, PostgreSQL vector/hybrid SQL. Durable worker с lease/backoff/3 attempts, batch/watch, восстановлением после остановки и защитой от воскрешения удалённого документа. Миграции до 75baf8ae2130. Compose включает отдельный worker; запуск контейнеров не проверен.

## Фактически выполненные проверки

- Python 3.12.6, Node 24.21.0. Зависимости и Chromium установлены после сетевых retry, версии в lock-файлах.
- alembic upgrade head и seed: выполнены на SQLite. Повторный seed не меняет существующие вопросы/материалы.
- python -m pytest -q: 28 passed; один upstream warning Starlette/httpx deprecation.
- ruff check backend tests evaluation: All checks passed.
- alembic check: No new upgrade operations detected; pip check: No broken requirements found.
- npm test: SERVER FLOW PASS, включая upload/readiness, поиск, auth/profile/favorites, pause/reload/retry/report/exam, светлую/тёмную темы и ширины 320–1440.
- npm run test:legacy: V3 SCENARIOS PASS. npm run test:legacy:flow: PASS после исправления теста (раскрывать список тем перед SQL). Production legacy-код не менялся.
- node front/tests/theme-profile.cjs: PASS; node front/tests/last-adjustments.cjs: PASS.
- node front/tests/review-polish.cjs: FAIL — исчезающий React skill suggestion, click timeout на строке 13; не считать весь legacy suite зелёным.
- python -m backend.app.worker --limit 1: фактический вызов embedder; embeddings не получены. Job retry, attempts=1, error_code=embedding_provider_unavailable_or_invalid. Успешной live-проверки модели нет.
- python -m evaluation.retrieval: 800/1600/2400 символов, 6 development-запросов, document Recall@5=1.0, MRR@5≈0.867. Авторские, не экспертные метки. Final split не запускался. Отчёт docs/experiments/retrieval-development.json. После исправления случайного UUID tie-break ранги детерминированы.
- PostgreSQL DDL компилируется offline; upgrade существующего пользователя, ACL, cascade delete, lease recovery, embedding timeout/invalid JSON и удаление во время provider call проверены автоматическими тестами.

## Текущий этап и границы

Этап 4 реализован на SQLite/contract-уровне; PostgreSQL и успешные embeddings ещё не подтверждены. Этапы 2–3 и части 7–8 работают. Это НЕ готовый выпуск. QA-направление ещё не соответствует полному определению готовности. Банк содержит по одному вопросу на компетенцию; повторение того же вопроса не подтверждает знание. Пороги плана и chunk size остаются рабочими допущениями. Полного генеративного RAG ещё нет.

## Незавершённое и блокеры

1. Проверить PostgreSQL/pgvector/Compose и успешный embedding provider. Docker не установлен. Offline SQL не доказывает runtime. Model digest пока автоматически не фиксируется; менять revision и переиндексировать при смене весов.
2. Расширить корпус официальными извлечёнными текстами с соблюдением лицензий. Сейчас собственные краткие материалы; внешние ссылки не копируются. SQLite retrieval ограничен 1000 candidates. PDF/DOCX/OCR отсутствуют, TXT/Markdown работают.
3. Этапы 5–6: реальный LLM port/adapter, AI runs, structured teaching outputs, budget/timeout, генерируемые упражнения и rubric evaluation с retry. Открытые ответы недоступны. До private RAG принять политику удаления связанных ИИ-артефактов.
4. Этап 7: расширить проверенный банк и критерии, вынести пороги в конфигурацию, учитывать сложность/давность и недостаток данных. Полная персонализация ещё не готова.
5. Этапы 8–10: резюме, полная UI-интеграция, AI experiments, PostgreSQL integration, backup/restore и нагрузка. Upload пока без request_key: сетевой повтор может создать дополнительный документ/версию; ответы и сессии идемпотентны.
6. Экспертная разметка не получена. Генеративные live-запуски не выполнялись. Нет имитации успешной модели.

В корне есть посторонний untracked-файл с именем, похожим на PowerShell activation command; не относится к коду. Не добавлен и не удалён. Временные БД и screenshots исключены из Git. Не перезаписывать чужие изменения.

## Следующие действия

Прочитать AGENTS → этот файл → implementation-plan; проверить git status/diff и код. Продолжить этап 5, независимо от недоступной внешней части: LLM adapter и сохранение запусков/источников, контракты ошибок и лимиты, затем интеграция учебного цикла. При доступном окружении закрыть PostgreSQL/embedding live-проверку этапа 4. Контекст и ограничения поддерживать здесь, а не только в чате.