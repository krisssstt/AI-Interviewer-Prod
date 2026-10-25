# AI Interviewer

Учебная QA-платформа с серверными оценками и будущим RAG. Первый выпуск: только QA Engineer; остальные направления — backlog. Эргономическое исследование не выполнять.

Перед продолжением читать `docs/project-state.md`, `docs/implementation-plan.md`, `docs/architecture.md`; проверить `git status` и изменения. Не уничтожать чужие изменения.

Сохранять HTML/CSS/JS в `front/`. Backend — модульный монолит `backend/app/`: предметные правила отдельно от HTTP, транзакции на прикладных сценариях. PostgreSQL — целевая БД, SQLite — только локальная проверка. Сервер — источник истины. Не раскрывать ключи ответов до разрешённого разбора. Не подменять отсутствие LLM успешной имитацией.

Команды из корня (PowerShell): `.venv/Scripts/python -m pytest`, `.venv/Scripts/python -m alembic upgrade head`, `.venv/Scripts/python -m backend.app.seed`, `.venv/Scripts/python -m uvicorn backend.app.main:app --reload`, `npm test`.

Корпус/worker: `backend/app/knowledge/`, команда `.venv/Scripts/python -m backend.app.worker --watch`. SQLite — только lexical search, vector/hybrid требуют PostgreSQL. Нельзя добавлять fake embeddings в production. При замене весов изменить embedding revision и переиндексировать. Development experiment: `.venv/Scripts/python -m evaluation.retrieval`; final split не использовать для настройки.

Секреты только через окружение/.env (не коммитить). Логи без паролей, токенов и содержимого частных документов. Тесты не используют платные API. Live-проверки отдельно, с бюджетом и сохранением результата.

После изменений обновлять требования, связанные ADR и `docs/project-state.md`; записывать только фактически выполненные проверки. Коммитить небольшие проверенные этапы. Не объявлять весь выпуск готовым по результатам одного сценария.
