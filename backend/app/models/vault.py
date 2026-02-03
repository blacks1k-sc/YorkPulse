import enum
import uuid

from sqlalchemy import String, Boolean, Text, ForeignKey, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class VaultCategory(str, enum.Enum):
    """Categories for Vault posts."""

    MENTAL_HEALTH = "mental_health"
    ACADEMICS = "academics"
    SOCIAL = "social"
    SAFETY = "safety"
    HOUSING = "housing"
    GENERAL = "general"


class VaultPostStatus(str, enum.Enum):
    """Status for Vault posts."""

    ACTIVE = "active"
    HIDDEN = "hidden"  # Hidden due to flags
    DELETED = "deleted"


class VaultPost(Base, UUIDMixin, TimestampMixin):
    """Anonymous forum posts in The Vault."""

    __tablename__ = "vault_posts"

    # Content
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    category: Mapped[VaultCategory] = mapped_column(
        Enum(VaultCategory, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )

    # Anonymity
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Author (stored for moderation, not exposed when anonymous)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Moderation
    status: Mapped[VaultPostStatus] = mapped_column(
        Enum(VaultPostStatus, values_callable=lambda x: [e.value for e in x]),
        default=VaultPostStatus.ACTIVE,
        nullable=False,
    )
    flag_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Counts (denormalized for performance)
    comment_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    upvote_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Relationships
    author: Mapped["User"] = relationship(
        "User",
        back_populates="vault_posts",
    )
    comments: Mapped[list["VaultComment"]] = relationship(
        "VaultComment",
        back_populates="post",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<VaultPost {self.id} - {self.category.value}>"


class VaultComment(Base, UUIDMixin, TimestampMixin):
    """Comments on Vault posts."""

    __tablename__ = "vault_comments"

    # Content
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Anonymity (independent of post's anonymity setting)
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relations
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vault_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Optional parent comment for threading
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vault_comments.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Moderation
    flag_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    is_hidden: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    post: Mapped["VaultPost"] = relationship(
        "VaultPost",
        back_populates="comments",
    )
    author: Mapped["User"] = relationship(
        "User",
        back_populates="vault_comments",
    )
    replies: Mapped[list["VaultComment"]] = relationship(
        "VaultComment",
        back_populates="parent",
        lazy="dynamic",
    )
    parent: Mapped["VaultComment | None"] = relationship(
        "VaultComment",
        back_populates="replies",
        remote_side="VaultComment.id",
    )

    def __repr__(self) -> str:
        return f"<VaultComment {self.id}>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
