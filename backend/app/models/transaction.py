"""Marketplace transaction model."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class MarketplaceTransaction(Base, UUIDMixin, TimestampMixin):
    """Transaction record for marketplace sales."""

    __tablename__ = "marketplace_transactions"

    # Link to the listing being sold
    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("marketplace_listings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One transaction per listing
    )

    # Seller (listing owner)
    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Buyer
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Final agreed price
    final_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    # Confirmation flags
    seller_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    buyer_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Completion timestamp (set when both confirm)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    listing: Mapped["MarketplaceListing"] = relationship(
        "MarketplaceListing",
        back_populates="transaction",
    )
    seller: Mapped["User"] = relationship(
        "User",
        foreign_keys=[seller_id],
        back_populates="sales_transactions",
    )
    buyer: Mapped["User"] = relationship(
        "User",
        foreign_keys=[buyer_id],
        back_populates="purchase_transactions",
    )
    reviews: Mapped[list["MarketplaceReview"]] = relationship(
        "MarketplaceReview",
        back_populates="transaction",
        lazy="dynamic",
    )

    __table_args__ = (
        # Ensure seller and buyer are different users
        CheckConstraint("seller_id != buyer_id", name="check_different_parties"),
    )

    def __repr__(self) -> str:
        return f"<MarketplaceTransaction {self.id} - Listing {self.listing_id}>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
from app.models.marketplace import MarketplaceListing  # noqa: E402, F401
from app.models.marketplace_review import MarketplaceReview  # noqa: E402, F401
