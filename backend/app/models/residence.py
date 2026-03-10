"""Residence chat models."""

import uuid
from datetime import datetime

from sqlalchemy import (
    String,
    Text,
    ForeignKey,
    DateTime,
    Integer,
    CheckConstraint,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Residence(Base, UUIDMixin, TimestampMixin):
    """York University on-campus residence."""

    __tablename__ = "residences"

    name: Mapped[str] = mapped_column(
        String(200),
        unique=True,
        nullable=False,
        index=True,
    )
    campus: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    member_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Relationships
    channel: Mapped["ResidenceChannel"] = relationship(
        "ResidenceChannel",
        back_populates="residence",
        cascade="all, delete-orphan",
        uselist=False,
    )
    members: Mapped[list["ResidenceMember"]] = relationship(
        "ResidenceMember",
        back_populates="residence",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Residence {self.name}>"


class ResidenceChannel(Base, UUIDMixin, TimestampMixin):
    """Single general chat channel for a residence."""

    __tablename__ = "residence_channels"

    residence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("residences.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="general",
    )
    member_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Relationships
    residence: Mapped["Residence"] = relationship(
        "Residence",
        back_populates="channel",
    )
    messages: Mapped[list["ResidenceMessage"]] = relationship(
        "ResidenceMessage",
        back_populates="channel",
        cascade="all, delete-orphan",
        lazy="dynamic",
        order_by="ResidenceMessage.created_at.desc()",
    )
    channel_members: Mapped[list["ResidenceChannelMember"]] = relationship(
        "ResidenceChannelMember",
        back_populates="channel",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("residence_id", "name", name="uq_residence_channels_residence_name"),
    )

    def __repr__(self) -> str:
        return f"<ResidenceChannel #{self.name} in {self.residence_id}>"


class ResidenceMember(Base, UUIDMixin):
    """User membership in a residence."""

    __tablename__ = "residence_members"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    residence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("residences.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="residence_memberships")
    residence: Mapped["Residence"] = relationship("Residence", back_populates="members")

    __table_args__ = (
        UniqueConstraint("user_id", "residence_id", name="uq_residence_members_user_residence"),
        Index("ix_residence_members_user_residence", "user_id", "residence_id"),
    )


class ResidenceChannelMember(Base, UUIDMixin):
    """User membership in a residence channel (for unread tracking)."""

    __tablename__ = "residence_channel_members"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("residence_channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )
    last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    channel: Mapped["ResidenceChannel"] = relationship("ResidenceChannel", back_populates="channel_members")

    __table_args__ = (
        UniqueConstraint("user_id", "channel_id", name="uq_residence_channel_members_user_channel"),
    )


class ResidenceMessage(Base, UUIDMixin):
    """Message in a residence channel."""

    __tablename__ = "residence_messages"

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("residence_channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("residence_messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )

    # Relationships
    channel: Mapped["ResidenceChannel"] = relationship("ResidenceChannel", back_populates="messages")
    user: Mapped["User"] = relationship("User")
    reply_to: Mapped["ResidenceMessage | None"] = relationship(
        "ResidenceMessage",
        remote_side="ResidenceMessage.id",
        foreign_keys=[reply_to_id],
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint("message IS NOT NULL OR image_url IS NOT NULL", name="ck_residence_messages_content"),
        CheckConstraint("message IS NULL OR LENGTH(message) <= 500", name="ck_residence_messages_length"),
        Index("ix_residence_messages_channel_created", "channel_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<ResidenceMessage {self.id} in {self.channel_id}>"


# Circular import resolution
from app.models.user import User  # noqa: E402, F401
