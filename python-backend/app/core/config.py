from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://kwg:kwg@localhost:5432/kwg_assistant"
    gemini_api_key: str = ""
    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 60
    rag_similarity_floor: float = 0.55
    rag_top_k: int = 5

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_from_email: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
