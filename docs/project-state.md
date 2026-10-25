# Состояние на 2026-10-25

## Реализовано

Сохранён исходный прототип `front/`, инициализирован Git. Есть аудит, требования/план, ADR, архитектура и модель данных. FastAPI/SQLAlchemy/Alembic, миграция 34f69dec8cd4, 12 QA-компетенций и 12 авторских choice-вопросов, idempotent seed. Auth: Argon2id, непрозрачные cookie-сеансы, CSRF, Origin, DB rate limits, server profile/logout. Сессии: diagnostic/practice/exam, snapshots, серверный deadline, hint tracking, pause/resume/finish, idempotency и optimistic revision. Серверные история, аналитика режимов, версии плана и favorites. UI подключён API-клиентом без legacy-оценивания и выдачи локального банка ключей; дополнительные страницы честно ограничены.

## Фактически выполненные проверки

- Python 3.12.6, Node 24.21.0; зависимости установлены после повторения сетевого таймаута; npm Chromium установлен после сетевого retry.
- `python -m alembic upgrade head` и seed: выполнены локально на SQLite, 12 competencies.
- `python -m pytest -q`: 15 passed (до финальной записи этого этапа); один warning upstream Starlette/httpx deprecation, не ошибка.
- `python -m alembic check`: No new upgrade operations detected.
- `python -m pip check`: No broken requirements found.
- `npm run test:legacy`: V3 SCENARIOS PASS, failures/errors пусты.
- `npm run test:legacy:flow`: FAIL — скрытый SQL фильтр после перехода в избранное (`interface-flow.cjs:20`); исходные файлы не менялись. Не считать весь legacy suite зелёным.
- `npm test`: SERVER FLOW PASS. Первый прогон остановился на слишком раннем assert истории; ожидание DOM исправлено. Визуально проверены светлый/тёмный скриншоты, исправлена ширина theme-button, наследовавшая 100% от исходных стилей.
- `ruff check backend tests`: All checks passed; `pip check`: зависимости совместимы. Повторный seed сохраняет 12 записей без перезаписи версий.

## Текущий этап

Этапы 2–3 и части 7–8: стабилизация серверного вертикального сценария. Это **не готовый выпуск**, и QA ещё не объявляется полностью поддержанным. Схема и пороги плана пока ограниченные, по одному вопросу на компетенцию; повторение того же вопроса не должно подтверждать навык.

## Незавершённое и ограничения

1. Серверный vertical flow проверен и готов к коммиту; следующая работа — этап 4.
2. Этап 4: durable ingestion/jobs, source versions, chunking, реальные embeddings + pgvector/hybrid retrieval, ACL и admin upload. Сейчас URL references — не RAG.
3. Этапы 5–6: реальные заменяемые LLM adapters, JSON validation, budget/timeout, обучение/генерация, rubric evaluation и retry. Открытые ответы пока недоступны.
4. Этап 7: расширить проверенный банк, вынести пороги в конфигурацию, учитывать сложность и давность; полная персонализация ещё не готова.
5. Этапы 8–10: документы/администрирование/полная UI-интеграция, AI experiments, PostgreSQL integration, Compose/backup-restore, нагрузка.

Docker не установлен — запуск Compose/PostgreSQL/pgvector не проверен. LLM live не запускался, настройки/ключи не проверялись. Экспертная разметка не получена. Эти факты не заменяются mocks.

В корне появился посторонний untracked-файл с именем, похожим на PowerShell activation command; не относится к реализации, не добавлять и не удалять без выяснения происхождения. Чужие изменения не перезаписывались. Временные тестовые БД/скриншоты исключены из Git.

## Продолжение

Прочитать AGENTS → этот файл → implementation-plan; git status/diff; сверить код. Ближайшее действие: этап 4 по требованиям FR-008/012/013, не начинать с генерации ответов без проверяемого корпуса. PostgreSQL и LLM live остаются непроверенными.
