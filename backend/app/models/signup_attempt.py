from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin


class SignupAttempt(Base, UUIDMixin):
    """Logs every /auth/signup hit for forensic tracking."""

    __tablename__ = "signup_attempts"

    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False, index=True)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    # True if the request was blocked by rate limiting before OTP was sent
    was_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<SignupAttempt {self.email} {self.ip_address}>"
