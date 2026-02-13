"""User feedback/suggestion model."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
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


class FeedbackType(str, enum.Enum):
    """Type of feedback submission."""

    SUGGESTION = "suggestion"
    BUG = "bug"
    PROBLEM = "problem"
    OTHER = "other"


class FeedbackStatus(str, enum.Enum):
    """Status of feedback submission."""

    PENDING = "pending"
    REVIEWED = "reviewed"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class UserFeedback(Base, UUIDMixin, TimestampMixin):
    """Feedback and suggestions submitted by users."""

    __tablename__ = "user_feedback"

    # Submitter
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Feedback details
    type: Mapped[FeedbackType] = mapped_column(
        Enum(FeedbackType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Status tracking
    status: Mapped[FeedbackStatus] = mapped_column(
        Enum(FeedbackStatus, values_callable=lambda x: [e.value for e in x]),
        default=FeedbackStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Admin response
    admin_response: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="feedback_submissions",
    )

    def __repr__(self) -> str:
        return f"<UserFeedback {self.id} - {self.type.value}: {self.subject[:30]}>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
