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
    access_token_expire_minutes: int = 1440  # 24 hours
    refresh_token_expire_days: int = 30     # 1 month — reduces OTP email frequency

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

    # Resend (Email) - Legacy, kept for backwards compatibility
    resend_api_key: str = ""

    # SMTP (Gmail)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""
    admin_email: str = ""  # Admin email for failure alerts
    admin_emails: str = "yorkpulse.app@gmail.com"  # Comma-separated emails that bypass York validation
    admin_password: str = ""  # Password for admin account (bypasses OTP)

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://yorkpulse.com",
        "https://www.yorkpulse.com",
    ]

    # Web Push (VAPID)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_contact_email: str = "yorkpulse.app@gmail.com"

    # Rate Limiting
    rate_limit_requests: int = 12              # General endpoints: 12 req / 60s per IP
    rate_limit_window_seconds: int = 60
    rate_limit_auth_requests: int = 5          # Auth per-email: 5 req / 60s (brute-force guard)
    rate_limit_auth_ip_requests: int = 30      # Auth per-IP: 30 req / 60s (campus shared IPs)
    rate_limit_auth_window_seconds: int = 60
    rate_limit_whitelist_ips: str = ""         # Comma-separated IPs exempt from all rate limits
    blocked_ips: str = ""                      # Comma-separated IPs permanently blocked (403)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
