from sqlalchemy import String, Boolean, ARRAY, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    """User model for York University students."""

    __tablename__ = "users"

    # Authentication
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Profile (name is immutable after verification)
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    name_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Optional profile fields
    program: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )
    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Arrays for preferences
    campus_days: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(20)),
        nullable=True,
    )
    interests: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(50)),
        nullable=True,
    )

    # Account status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    is_banned: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    vault_posts: Mapped[list["VaultPost"]] = relationship(
        "VaultPost",
        back_populates="author",
        lazy="dynamic",
    )
    vault_comments: Mapped[list["VaultComment"]] = relationship(
        "VaultComment",
        back_populates="author",
        lazy="dynamic",
    )
    marketplace_listings: Mapped[list["MarketplaceListing"]] = relationship(
        "MarketplaceListing",
        back_populates="seller",
        lazy="dynamic",
    )
    buddy_requests: Mapped[list["BuddyRequest"]] = relationship(
        "BuddyRequest",
        back_populates="host",
        lazy="dynamic",
    )
    reviews_given: Mapped[list["Review"]] = relationship(
        "Review",
        foreign_keys="Review.reviewer_id",
        back_populates="reviewer",
        lazy="dynamic",
    )
    reviews_received: Mapped[list["Review"]] = relationship(
        "Review",
        foreign_keys="Review.reviewed_id",
        back_populates="reviewed",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"


# Import for type hints (avoid circular imports)
from app.models.vault import VaultPost, VaultComment  # noqa: E402, F401
from app.models.marketplace import MarketplaceListing  # noqa: E402, F401
from app.models.buddy import BuddyRequest  # noqa: E402, F401
from app.models.review import Review  # noqa: E402, F401
