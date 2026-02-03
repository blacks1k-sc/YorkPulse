import enum
import uuid
from decimal import Decimal

from sqlalchemy import String, Text, ForeignKey, Numeric, ARRAY, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class MarketplaceCategory(str, enum.Enum):
    """Categories for marketplace listings."""

    TEXTBOOKS = "textbooks"
    ELECTRONICS = "electronics"
    SERVICES = "services"
    HOUSING = "housing"
    TICKETS = "tickets"
    CLOTHING = "clothing"
    FURNITURE = "furniture"
    OTHER = "other"


class ListingStatus(str, enum.Enum):
    """Status for marketplace listings."""

    ACTIVE = "active"
    SOLD = "sold"
    RESERVED = "reserved"
    DELETED = "deleted"


class ListingCondition(str, enum.Enum):
    """Condition of items being sold."""

    NEW = "new"
    LIKE_NEW = "like_new"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class MarketplaceListing(Base, UUIDMixin, TimestampMixin):
    """Buy/sell listings in the marketplace."""

    __tablename__ = "marketplace_listings"

    # Basic info
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    is_negotiable: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    # Categorization
    category: Mapped[MarketplaceCategory] = mapped_column(
        Enum(MarketplaceCategory, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    condition: Mapped[ListingCondition | None] = mapped_column(
        Enum(ListingCondition, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )

    # For textbooks
    course_codes: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(20)),
        nullable=True,
    )

    # Images (S3 URLs)
    images: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(500)),
        nullable=True,
    )

    # Status
    status: Mapped[ListingStatus] = mapped_column(
        Enum(ListingStatus, values_callable=lambda x: [e.value for e in x]),
        default=ListingStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    # Location preference
    preferred_meetup_location: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    # Seller
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # View count
    view_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )

    # Relationships
    seller: Mapped["User"] = relationship(
        "User",
        back_populates="marketplace_listings",
    )

    def __repr__(self) -> str:
        return f"<MarketplaceListing {self.id} - {self.title}>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
