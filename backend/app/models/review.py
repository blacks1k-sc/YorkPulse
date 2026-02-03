import enum
import uuid

from sqlalchemy import String, Text, ForeignKey, Integer, Enum, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class ReviewType(str, enum.Enum):
    """Type of review."""

    MARKETPLACE = "marketplace"
    BUDDY = "buddy"


class Review(Base, UUIDMixin, TimestampMixin):
    """Reviews for marketplace transactions and buddy activities."""

    __tablename__ = "reviews"

    # Reviewer and reviewed
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reviewed_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Rating (1-5 stars)
    rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Optional comment
    comment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Type of review
    review_type: Mapped[ReviewType] = mapped_column(
        Enum(ReviewType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )

    # Reference to the transaction/activity
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )  # marketplace_listing_id or buddy_request_id

    # Relationships
    reviewer: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reviewer_id],
        back_populates="reviews_given",
    )
    reviewed: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reviewed_id],
        back_populates="reviews_received",
    )

    __table_args__ = (
        # Ensure rating is between 1 and 5
        CheckConstraint("rating >= 1 AND rating <= 5", name="check_rating_range"),
        # Prevent self-reviews
        CheckConstraint("reviewer_id != reviewed_id", name="check_no_self_review"),
        # Unique review per transaction
        Index(
            "ix_reviews_unique_transaction",
            "reviewer_id",
            "reviewed_id",
            "review_type",
            "reference_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<Review {self.id} - {self.rating}/5>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
