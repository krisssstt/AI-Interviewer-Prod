from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = 'sqlite:///./interviewer.db'
    app_origin: str = 'http://127.0.0.1:8000'
    cookie_secure: bool = False
    session_hours: int = 24

