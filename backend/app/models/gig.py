import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Text, ForeignKey, Integer, DateTime, Boolean, Enum, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class GigType(str, enum.Enum):
    """Type of gig post."""
    OFFERING = "offering"  # I can help
    NEED_HELP = "need_help"  # Looking for someone


class GigCategory(str, enum.Enum):
    """Categories for gigs."""
    ACADEMIC = "academic"  # Tutoring, notes, study partner
    MOVING = "moving"  # Furniture, boxes, transport
    TECH_HELP = "tech_help"  # Fix laptop, setup software
    ERRANDS = "errands"  # Pickup, delivery, queue
    CREATIVE = "creative"  # Design, photography, writing
    OTHER = "other"


class GigPriceType(str, enum.Enum):
    """Pricing type for gigs."""
    FIXED = "fixed"
    HOURLY = "hourly"
    NEGOTIABLE = "negotiable"


class GigLocation(str, enum.Enum):
    """Location type for gigs."""
    ON_CAMPUS = "on_campus"
    OFF_CAMPUS = "off_campus"
    ONLINE = "online"


class GigStatus(str, enum.Enum):
    """Status of a gig."""
    ACTIVE = "active"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class GigResponseStatus(str, enum.Enum):
    """Status of a response to a gig."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COMPLETED = "completed"


class GigTransactionStatus(str, enum.Enum):
    """Status of a gig transaction."""
    PENDING = "pending"
    COMPLETED = "completed"
    DISPUTED = "disputed"


class Gig(Base, UUIDMixin, TimestampMixin):
    """Quick Gigs marketplace posts."""

    __tablename__ = "gigs"

    # Poster
    poster_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Gig type (offering vs need_help)
    gig_type: Mapped[GigType] = mapped_column(
        Enum(GigType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )

    # Category
    category: Mapped[GigCategory] = mapped_column(
        Enum(GigCategory, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )

    # Content
    title: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Pricing
    price_min: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    price_max: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    price_type: Mapped[GigPriceType | None] = mapped_column(
        Enum(GigPriceType, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )

    # Location
    location: Mapped[GigLocation | None] = mapped_column(
        Enum(GigLocation, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    location_details: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    # Deadline (for need_help posts)
    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Status
    status: Mapped[GigStatus] = mapped_column(
        Enum(GigStatus, values_callable=lambda x: [e.value for e in x]),
        default=GigStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    # Metrics
    view_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    response_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Relationships
    poster: Mapped["User"] = relationship(
        "User",
        back_populates="gigs",
    )
    responses: Mapped[list["GigResponse"]] = relationship(
        "GigResponse",
        back_populates="gig",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    transactions: Mapped[list["GigTransaction"]] = relationship(
        "GigTransaction",
        back_populates="gig",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return f"<Gig {self.id} - {self.title}>"


class GigResponse(Base, UUIDMixin, TimestampMixin):
    """Responses to gig posts."""

    __tablename__ = "gig_responses"

    # Relations
    gig_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gigs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    responder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Response content
    message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    proposed_price: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    # Status
    status: Mapped[GigResponseStatus] = mapped_column(
        Enum(GigResponseStatus, values_callable=lambda x: [e.value for e in x]),
        default=GigResponseStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Relationships
    gig: Mapped["Gig"] = relationship(
        "Gig",
        back_populates="responses",
    )
    responder: Mapped["User"] = relationship(
        "User",
        back_populates="gig_responses",
    )
    transaction: Mapped["GigTransaction | None"] = relationship(
        "GigTransaction",
        back_populates="response",
        uselist=False,
    )

    def __repr__(self) -> str:
        return f"<GigResponse {self.id}>"


class GigTransaction(Base, UUIDMixin, TimestampMixin):
    """Transaction records for completed gigs."""

    __tablename__ = "gig_transactions"

    # Relations
    gig_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gigs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gig_responses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Transaction details
    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    payment_method: Mapped[str] = mapped_column(
        String(50),
        default="etransfer",
        nullable=False,
    )

    # Status
    status: Mapped[GigTransactionStatus] = mapped_column(
        Enum(GigTransactionStatus, values_callable=lambda x: [e.value for e in x]),
        default=GigTransactionStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Completion tracking
    provider_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    client_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    gig: Mapped["Gig | None"] = relationship(
        "Gig",
        back_populates="transactions",
    )
    response: Mapped["GigResponse | None"] = relationship(
        "GigResponse",
        back_populates="transaction",
    )
    provider: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[provider_id],
        back_populates="gig_transactions_as_provider",
    )
    client: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[client_id],
        back_populates="gig_transactions_as_client",
    )
    ratings: Mapped[list["GigRating"]] = relationship(
        "GigRating",
        back_populates="transaction",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<GigTransaction {self.id}>"


class GigRating(Base, UUIDMixin, TimestampMixin):
    """Ratings for completed gig transactions."""

    __tablename__ = "gig_ratings"

    # Relations
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gig_transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rater_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ratee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Ratings (1-5)
    rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    reliability: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    communication: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    quality: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Review text
    review_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    transaction: Mapped["GigTransaction"] = relationship(
        "GigTransaction",
        back_populates="ratings",
    )
    rater: Mapped["User"] = relationship(
        "User",
        foreign_keys=[rater_id],
        back_populates="gig_ratings_given",
    )
    ratee: Mapped["User"] = relationship(
        "User",
        foreign_keys=[ratee_id],
        back_populates="gig_ratings_received",
    )

    def __repr__(self) -> str:
        return f"<GigRating {self.id}>"


# Import for type hints
from app.models.user import User  # noqa: E402, F401
