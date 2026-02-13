import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime, Enum, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class ConversationStatus(str, enum.Enum):
    """Status for conversations."""

    PENDING = "pending"  # User1 sent request, waiting for User2 to accept
    ACTIVE = "active"  # Both users can message
    BLOCKED = "blocked"  # One user blocked the other


class Conversation(Base, UUIDMixin, TimestampMixin):
    """Request-based DM conversations."""

    __tablename__ = "conversations"

    # Participants
    user1_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user2_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Status
    status: Mapped[ConversationStatus] = mapped_column(
        Enum(ConversationStatus, values_callable=lambda x: [e.value for e in x]),
        default=ConversationStatus.PENDING,
        nullable=False,
    )

    # Who initiated (for pending state)
    initiated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Blocking info
    blocked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Context (optional - where the conversation started)
    context_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )  # "marketplace", "buddy", "profile"
    context_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Relationships
    user1: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user1_id],
    )
    user2: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user2_id],
    )
    initiator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[initiated_by],
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        lazy="dynamic",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    # Composite index for finding conversations between two users
    __table_args__ = (
        Index("ix_conversations_users", "user1_id", "user2_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Conversation {self.id} - {self.status.value}>"


class Message(Base, UUIDMixin, TimestampMixin):
    """Messages within conversations."""

    __tablename__ = "messages"

    # Content
    content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Relations
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Read status
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Soft delete (for "unsend" feature)
    is_deleted: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages",
    )
    sender: Mapped["User"] = relationship(
        "User",
    )

    __table_args__ = (
        CheckConstraint(
            "content IS NOT NULL OR image_url IS NOT NULL",
            name="ck_messages_has_content",
        ),
    )

    def __repr__(self) -> str:
        return f"<Message {self.id}>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
