"""Marketplace review model with multi-category ratings."""

import uuid

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class MarketplaceReview(Base, UUIDMixin, TimestampMixin):
    """Reviews for completed marketplace transactions with multi-category ratings."""

    __tablename__ = "marketplace_reviews"

    # Link to the transaction
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("marketplace_transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Reviewer (person writing the review)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Reviewee (person being reviewed)
    reviewee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Multi-category ratings (1-5 stars each)
    item_accuracy: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    communication: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    punctuality: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Optional text feedback
    text_feedback: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    transaction: Mapped["MarketplaceTransaction"] = relationship(
        "MarketplaceTransaction",
        back_populates="reviews",
    )
    reviewer: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reviewer_id],
        back_populates="marketplace_reviews_given",
    )
    reviewee: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reviewee_id],
        back_populates="marketplace_reviews_received",
    )

    __table_args__ = (
        # Unique constraint: one review per transaction per reviewer
        UniqueConstraint(
            "transaction_id",
            "reviewer_id",
            name="uq_transaction_reviewer",
        ),
        # Rating constraints (1-5)
        CheckConstraint(
            "item_accuracy >= 1 AND item_accuracy <= 5",
            name="check_item_accuracy_range",
        ),
        CheckConstraint(
            "communication >= 1 AND communication <= 5",
            name="check_communication_range",
        ),
        CheckConstraint(
            "punctuality >= 1 AND punctuality <= 5",
            name="check_punctuality_range",
        ),
        # Prevent self-reviews
        CheckConstraint(
            "reviewer_id != reviewee_id",
            name="check_no_self_marketplace_review",
        ),
    )

    @property
    def average_rating(self) -> float:
        """Calculate average of all category ratings."""
        return (self.item_accuracy + self.communication + self.punctuality) / 3.0

    def __repr__(self) -> str:
        return f"<MarketplaceReview {self.id} - Transaction {self.transaction_id}>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
from app.models.transaction import MarketplaceTransaction  # noqa: E402, F401
