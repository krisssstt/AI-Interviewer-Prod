from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = 'sqlite:///./interviewer.db'
    app_origin: str = 'http://127.0.0.1:8000'
    cookie_secure: bool = False
    session_hours: int = 24
    ollama_url: str = 'http://127.0.0.1:11434'
    embedding_model: str = 'nomic-embed-text'
    embedding_revision: str = 'local-v1'
    embedding_dimensions: int = 768
    ai_timeout_seconds: float = 20
    chunk_max_chars: int = 2400

