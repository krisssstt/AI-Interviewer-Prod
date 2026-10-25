# Проверки

## Автоматические

Из корня: `.venv/Scripts/python -m pytest -q`, `.venv/Scripts/python -m ruff check backend tests`, `.venv/Scripts/python -m alembic check`, `.venv/Scripts/python -m pip check`.

Каждый backend-тест получает отдельную временную SQLite БД через **реальные Alembic-миграции**, затем seed. Проверяются auth, CSRF/origin/лимиты, изоляция чужих сессий/истории/плана/избранного, конкурентная и повторная отправка, пауза, контроль без подсказок и с серверным сроком, атомарный план, версии вопроса и источников, повторный запуск приложения. Манипулятивный текст в choice отклоняется как неверный формат; это ещё не доказательство защиты LLM-оценщика.

Браузер: `npm ci`, `npx playwright install chromium`, `npm test`. Тест запускает настоящий Uvicorn, миграции и seed во временной БД на порту 8050. Нужен свободный порт. БД создаётся в системном temp и остаётся там для диагностики; содержит только искусственный тестовый аккаунт. Проверяет регистрация → план → практика → hint → pause/reload/resume → восстановимая ошибка → retry → разбор → история → favorites → профиль → exam → темы/ширины → logout/login. Искусственный 503 применяется только для проверки восстановления формы, успешная оценка приходит от реального API. Скриншоты — `front/tests/artifacts/` (не в Git).

Legacy: `npm run test:legacy` и `npm run test:legacy:flow`, остальные `node front/tests/*.cjs`. Эти тесты раздают исходный UI собственным HTTP-сервером и проверяют прежнюю локальную версию; они не доказывают backend/RAG. Порты 8040–8045 не должны конфликтовать. Первоначальный старт без Chromium оставил сервер на 8043; остановлен только процесс нашего теста. `interface-flow` исправлен: раскрывать список тем перед SQL; теперь проходит. Из 5 legacy-скриптов проходят 4, `review-polish` падает на исчезающей подсказке React. Итоги в project-state.

Дополнительно `tests/test_knowledge.py`: ACL private/public, роль администратора, неизменность старой версии текста, очистка дерева документа (включая удаление во время provider call), lease recovery после остановки worker, bounded retries, валидность/timeout embedding adapter, chunk offsets/code/table, повреждённый/неподдерживаемый формат, idempotent seed. `tests/test_migrations.py` проверяет upgrade существующего пользователя без случайного назначения admin, а также offline PostgreSQL DDL. Тесты используют test-only embedder/HTTP transport; production не возвращает синтетические векторы.

Live-попытка worker на локальной конфигурации действительно выполнялась: embeddings не получены, задание перешло в retry с `embedding_provider_unavailable_or_invalid`. PostgreSQL/pgvector и Compose не запускались. Не заменять их зелёным SQLite-тестом.

## Live AI

Генеративные LLM-проверки пока не запускались. До первого запуска: отдельная команда с явным opt-in, max requests/tokens/cost, timeout, модель и prompt version, сохранение run metadata и отчёта; независимый final split не использовать при настройке. Ключи только в окружении. Обычный pytest не должен автоматически обращаться к внешней модели. Development retrieval experiment: `.venv/Scripts/python -m evaluation.retrieval` (временная БД, без модели); отчёт `docs/experiments/retrieval-development.json`. Подробные метрики и пороги — [ai-evaluation](ai-evaluation.md).
