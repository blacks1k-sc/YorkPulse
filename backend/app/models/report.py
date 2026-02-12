"""User report model for safety-focused moderation."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class ReportReason(str, enum.Enum):
    """Reasons for reporting a user."""

    HARASSMENT_SAFETY = "harassment_safety"
    SCAM_FRAUD = "scam_fraud"
    NO_SHOW_PATTERN = "no_show_pattern"
    SPAM_BOT = "spam_bot"
    OTHER = "other"


class ReportStatus(str, enum.Enum):
    """Status of a user report."""

    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class UserReport(Base, UUIDMixin, TimestampMixin):
    """Reports submitted by users for moderation."""

    __tablename__ = "user_reports"

    # Reporter
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Reported user
    reported_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Report details
    reason: Mapped[ReportReason] = mapped_column(
        Enum(ReportReason, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    explanation: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Status tracking
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, values_callable=lambda x: [e.value for e in x]),
        default=ReportStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Admin handling
    admin_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    reporter: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reporter_id],
        back_populates="reports_submitted",
    )
    reported_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reported_user_id],
        back_populates="reports_received",
    )
    resolved_by_admin: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[resolved_by],
    )

    __table_args__ = (
        # Prevent self-reports
        CheckConstraint(
            "reporter_id != reported_user_id",
            name="check_no_self_report",
        ),
    )

    def __repr__(self) -> str:
        return f"<UserReport {self.id} - {self.reason.value}>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
