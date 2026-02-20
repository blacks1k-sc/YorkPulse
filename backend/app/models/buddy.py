import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, Integer, DateTime, Boolean, Enum, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class BuddyCategory(str, enum.Enum):
    """Default categories for Side Quests."""

    GYM = "gym"
    FOOD = "food"
    GAME = "game"
    COMMUTE = "commute"
    STUDY = "study"
    CUSTOM = "custom"


class VibeLevel(str, enum.Enum):
    """Intensity/vibe level for Side Quests."""

    CHILL = "chill"
    INTERMEDIATE = "intermediate"
    HIGH_ENERGY = "high_energy"
    INTENSE = "intense"
    CUSTOM = "custom"


class BuddyRequestStatus(str, enum.Enum):
    """Status for buddy requests."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    FULL = "full"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class BuddyRequest(Base, UUIDMixin, TimestampMixin):
    """Side Quest activity requests."""

    __tablename__ = "buddy_requests"

    # Activity details
    category: Mapped[BuddyCategory] = mapped_column(
        Enum(BuddyCategory, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    custom_category: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    activity: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Vibe/intensity level
    vibe_level: Mapped[VibeLevel] = mapped_column(
        Enum(VibeLevel, values_callable=lambda x: [e.value for e in x]),
        default=VibeLevel.CHILL,
        nullable=False,
    )
    custom_vibe_level: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    # When and where
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    location: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    # Map coordinates for York campus
    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        index=True,
    )
    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        index=True,
    )

    # Participants (peer_limit in UI, 1-10 people)
    max_participants: Mapped[int] = mapped_column(
        Integer,
        default=2,
        nullable=False,
    )
    current_participants: Mapped[int] = mapped_column(
        Integer,
        default=1,  # Host counts as 1
        nullable=False,
    )

    # Join settings
    requires_approval: Mapped[bool] = mapped_column(
        Boolean,
        default=True,  # Default to approval required for safety
        nullable=False,
    )

    # Status
    status: Mapped[BuddyRequestStatus] = mapped_column(
        Enum(BuddyRequestStatus, values_callable=lambda x: [e.value for e in x]),
        default=BuddyRequestStatus.OPEN,
        nullable=False,
        index=True,
    )

    # Host
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    host: Mapped["User"] = relationship(
        "User",
        back_populates="buddy_requests",
    )
    participants: Mapped[list["BuddyParticipant"]] = relationship(
        "BuddyParticipant",
        back_populates="buddy_request",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<BuddyRequest {self.id} - {self.activity}>"


class ParticipantStatus(str, enum.Enum):
    """Status for participants in a buddy request."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class BuddyParticipant(Base, UUIDMixin, TimestampMixin):
    """Participants in Side Quest activities."""

    __tablename__ = "buddy_participants"

    # Relations
    buddy_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("buddy_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Status
    status: Mapped[ParticipantStatus] = mapped_column(
        Enum(ParticipantStatus, values_callable=lambda x: [e.value for e in x]),
        default=ParticipantStatus.PENDING,
        nullable=False,
    )

    # Optional message when requesting to join
    message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    buddy_request: Mapped["BuddyRequest"] = relationship(
        "BuddyRequest",
        back_populates="participants",
    )
    user: Mapped["User"] = relationship(
        "User",
    )

    def __repr__(self) -> str:
        return f"<BuddyParticipant {self.user_id} - {self.status.value}>"


class QuestMessage(Base, UUIDMixin, TimestampMixin):
    """Group chat messages for Side Quest activities."""

    __tablename__ = "quest_messages"

    # Content
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Relations
    quest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("buddy_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Reply to another message
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quest_messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    quest: Mapped["BuddyRequest"] = relationship(
        "BuddyRequest",
    )
    sender: Mapped["User"] = relationship(
        "User",
    )
    reply_to: Mapped["QuestMessage | None"] = relationship(
        "QuestMessage",
        remote_side="QuestMessage.id",
        foreign_keys=[reply_to_id],
    )

    def __repr__(self) -> str:
        return f"<QuestMessage {self.id}>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
