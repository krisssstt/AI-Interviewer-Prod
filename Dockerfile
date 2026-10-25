FROM python:3.12-slim
WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY backend ./backend
COPY front ./front
COPY corpus ./corpus
COPY alembic.ini ./
RUN useradd --create-home app
USER app
EXPOSE 8000
CMD ["sh", "-c", "python -m alembic upgrade head && python -m backend.app.seed && python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"]
