from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "YorkPulse API"
    debug: bool = False
    allow_test_emails: bool = False  # Set to True to allow non-York emails for testing
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/yorkpulse"
    db_password: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379"

    # JWT
    jwt_secret_key: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120  # 2 hours
    refresh_token_expire_days: int = 7

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "yorkpulse-uploads"

    # Gemini AI
    gemini_api_key: str = ""

    # Resend (Email)
    resend_api_key: str = ""

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
