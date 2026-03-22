import logging
from functools import lru_cache
from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


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

    # -------------------------------------------------------------------------
    # DATABASE — REQUIRED, no default.
    # Why no default: "localhost" inside a container means the container itself,
    # not the database host. A localhost default silently connects nowhere and
    # causes cryptic connection errors instead of a clear startup failure.
    # Set via DATABASE_URL env var → Supabase connection string in production
    # (injected from AWS Secrets Manager into the ECS task at runtime).
    # -------------------------------------------------------------------------
    database_url: Optional[str] = None
    db_password: str = ""

    # -------------------------------------------------------------------------
    # REDIS — OPTIONAL. App degrades gracefully if not set.
    # If REDIS_URL is not provided: rate limiting is disabled, all requests
    # are allowed through (see redis.py — RateLimiter.is_allowed fails open).
    # Set via REDIS_URL env var → ElastiCache endpoint in production.
    # -------------------------------------------------------------------------
    redis_url: Optional[str] = None

    # -------------------------------------------------------------------------
    # JWT — REQUIRED, no default.
    # Why no default: a weak hardcoded default (e.g. "change-me-in-production")
    # is a silent security failure — the app starts and signs tokens normally,
    # but any attacker who knows the default key can forge valid JWTs.
    # Set via JWT_SECRET_KEY env var → from AWS Secrets Manager in production.
    # Generate a strong key: python -c "import secrets; print(secrets.token_hex(32))"
    # -------------------------------------------------------------------------
    jwt_secret_key: Optional[str] = None
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120  # 2 hours
    refresh_token_expire_days: int = 7

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""

    # -------------------------------------------------------------------------
    # AWS — region only. Credentials removed.
    # aws_access_key_id, aws_secret_access_key, s3_bucket_name were removed
    # because the project migrated from S3 to Supabase Storage. The dead
    # s3.py service still references them but is never imported by any route
    # or main.py — it is unreachable code. aws_region is kept because it will
    # be needed in Phase 2 when the ECS task calls Secrets Manager and
    # ElastiCache using the AWS SDK (boto3/aiobotocore) with IAM role auth
    # (no static credentials needed — ECS task role handles authentication).
    # -------------------------------------------------------------------------
    aws_region: str = "us-east-1"

    # Resend API key — legacy fallback email provider.
    # The resend Python SDK package is not installed in production.
    # email.py calls the Resend REST API directly via httpx if this key is set,
    # falling back to SMTP otherwise. Safe to leave empty in production.
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
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60

    @model_validator(mode="after")
    def validate_required_and_warn_optional(self) -> "Settings":
        """Validate required secrets and warn about missing optional ones.

        Runs once at startup after all fields are loaded from env / .env file.
        Raises ValueError (wrapped in pydantic ValidationError) if a required
        secret is missing. Logs WARNING for optional missing configuration.
        """
        # --- REQUIRED: DATABASE_URL ---
        # Fail loud and early — a missing DB URL causes every request to fail
        # with a cryptic asyncpg connection error buried in a stack trace.
        # A clear startup crash is infinitely better than a running-but-broken app.
        if not self.database_url:
            raise ValueError(
                "DATABASE_URL environment variable is required. "
                "Set it to the Supabase PostgreSQL connection string "
                "(e.g. postgresql+asyncpg://user:pass@host:5432/db). "
                "In production this is injected from AWS Secrets Manager."
            )

        # --- REQUIRED: JWT_SECRET_KEY ---
        # Fail loud — a missing or weak JWT key means every token is either
        # unverifiable or forgeable. There is no safe fallback.
        if not self.jwt_secret_key:
            raise ValueError(
                "JWT_SECRET_KEY environment variable is required. "
                "Generate a strong key with: "
                "python -c \"import secrets; print(secrets.token_hex(32))\". "
                "In production this is injected from AWS Secrets Manager."
            )

        # --- OPTIONAL: REDIS_URL ---
        # Warn but continue — rate limiting degrades gracefully without Redis.
        # The RateLimiter.is_allowed() method catches all Redis exceptions and
        # returns (True, ...) so requests are never blocked due to missing Redis.
        if not self.redis_url:
            logger.warning(
                "REDIS_URL is not set. Rate limiting will be disabled and all "
                "requests will be allowed through. Set REDIS_URL to the "
                "ElastiCache endpoint in production for full functionality."
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
