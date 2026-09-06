from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://kwg:kwg@localhost:5432/kwg_assistant"
    gemini_api_key: str = ""
    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 60
    password_reset_expire_minutes: int = 30
    rag_similarity_floor: float = 0.4
    rag_top_k: int = 5

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_from_email: str = ""

    app_base_url: str = ""

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, v: str) -> str:
        # Managed Postgres providers (Render, Heroku, ...) hand out plain
        # postgres:// / postgresql:// URLs; SQLAlchemy needs the +psycopg
        # driver suffix to use psycopg3 instead of defaulting to psycopg2.
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix) and not v.startswith("postgresql+psycopg://"):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
