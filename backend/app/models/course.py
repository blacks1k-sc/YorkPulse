"""Course chat room models."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    String,
    Text,
    ForeignKey,
    DateTime,
    Enum,
    Index,
    Integer,
    Boolean,
    Numeric,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class ChannelType(str, enum.Enum):
    """Type of course channel."""

    GENERAL = "general"
    PROFESSOR = "professor"


class Course(Base, UUIDMixin, TimestampMixin):
    """Course information from York University catalog."""

    __tablename__ = "courses"

    code: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    faculty: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )
    programs: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        default=list,
    )
    year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )
    credits: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    campus: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )
    member_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Relationships
    channels: Mapped[list["CourseChannel"]] = relationship(
        "CourseChannel",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    members: Mapped[list["CourseMember"]] = relationship(
        "CourseMember",
        back_populates="course",
        cascade="all, delete-orphan",
    )
    votes: Mapped[list["ChannelCreationVote"]] = relationship(
        "ChannelCreationVote",
        back_populates="course",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_courses_faculty_year", "faculty", "year"),
        CheckConstraint("year >= 1 AND year <= 4", name="ck_courses_year_range"),
    )

    def __repr__(self) -> str:
        return f"<Course {self.code}: {self.name}>"


class CourseChannel(Base, UUIDMixin, TimestampMixin):
    """Discord-style channels within courses."""

    __tablename__ = "course_channels"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    type: Mapped[ChannelType] = mapped_column(
        Enum(ChannelType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    # Metadata for professor channels: {prof_name, semester, section}
    prof_name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )
    semester: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )
    member_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relationships
    course: Mapped["Course"] = relationship(
        "Course",
        back_populates="channels",
    )
    messages: Mapped[list["CourseMessage"]] = relationship(
        "CourseMessage",
        back_populates="channel",
        cascade="all, delete-orphan",
        lazy="dynamic",
        order_by="CourseMessage.created_at.desc()",
    )
    channel_members: Mapped[list["ChannelMember"]] = relationship(
        "ChannelMember",
        back_populates="channel",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("course_id", "name", name="uq_course_channels_course_name"),
    )

    def __repr__(self) -> str:
        return f"<CourseChannel #{self.name} in {self.course_id}>"


class CourseMember(Base, UUIDMixin):
    """User membership in courses."""

    __tablename__ = "course_members"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="course_memberships")
    course: Mapped["Course"] = relationship("Course", back_populates="members")

    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_course_members_user_course"),
    )

    def __repr__(self) -> str:
        return f"<CourseMember {self.user_id} in {self.course_id}>"


class ChannelMember(Base, UUIDMixin):
    """User membership in specific channels (mainly for professor channels)."""

    __tablename__ = "channel_members"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User")
    channel: Mapped["CourseChannel"] = relationship(
        "CourseChannel", back_populates="channel_members"
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id", "channel_id", name="uq_channel_members_user_channel"
        ),
    )

    def __repr__(self) -> str:
        return f"<ChannelMember {self.user_id} in {self.channel_id}>"


class CourseMessage(Base, UUIDMixin):
    """Messages in course channels."""

    __tablename__ = "course_messages"

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )

    # Relationships
    channel: Mapped["CourseChannel"] = relationship(
        "CourseChannel", back_populates="messages"
    )
    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("ix_course_messages_channel_created", "channel_id", "created_at"),
        CheckConstraint(
            "message IS NOT NULL OR image_url IS NOT NULL",
            name="ck_course_messages_has_content",
        ),
        CheckConstraint(
            "message IS NULL OR LENGTH(message) <= 500",
            name="ck_course_messages_length",
        ),
    )

    def __repr__(self) -> str:
        return f"<CourseMessage {self.id}>"


class ChannelCreationVote(Base, UUIDMixin):
    """Votes for creating professor-specific channels."""

    __tablename__ = "channel_creation_votes"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prof_name_normalized: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    voter_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    semester: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )

    # Relationships
    course: Mapped["Course"] = relationship("Course", back_populates="votes")
    voter: Mapped["User"] = relationship("User")

    __table_args__ = (
        UniqueConstraint(
            "course_id",
            "voter_user_id",
            "semester",
            name="uq_channel_votes_user_course_semester",
        ),
        Index(
            "ix_channel_votes_course_prof",
            "course_id",
            "prof_name_normalized",
            "semester",
        ),
    )

    def __repr__(self) -> str:
        return f"<ChannelCreationVote {self.voter_user_id} for {self.prof_name_normalized}>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
