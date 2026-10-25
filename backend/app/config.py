from pydantic import Field
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
    model_lock_file: str = 'config/model-lock.json'
    embedding_digest: str = ''
    llm_model: str = 'qwen2.5:7b-instruct'
    llm_digest: str = ''
    llm_timeout_seconds: float = Field(default=120, ge=1, le=180)
    llm_max_output_tokens: int = Field(default=2500, ge=256, le=4096)
    llm_context_tokens: int = Field(default=8192, ge=4096, le=16384)
    ai_daily_request_limit: int = Field(default=30, ge=1, le=1000)
    ai_daily_token_budget: int = Field(default=240000, ge=16384)
    ai_attempt_limit: int = Field(default=3, ge=1, le=3)

