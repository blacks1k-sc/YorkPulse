"""Marketplace review schemas with multi-category ratings."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.schemas.user import UserMinimal


class MarketplaceReviewCreate(BaseModel):
    """Schema for creating a marketplace review."""

    transaction_id: str
    item_accuracy: Annotated[int, Field(ge=1, le=5)]
    communication: Annotated[int, Field(ge=1, le=5)]
    punctuality: Annotated[int, Field(ge=1, le=5)]
    text_feedback: Annotated[str | None, Field(max_length=2000)] = None


class MarketplaceReviewResponse(BaseModel):
    """Response schema for a marketplace review."""

    id: str
    transaction_id: str
    reviewer: UserMinimal
    reviewee: UserMinimal
    item_accuracy: int
    communication: int
    punctuality: int
    average_rating: float
    text_feedback: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class MarketplaceReviewListResponse(BaseModel):
    """Response for list of marketplace reviews."""

    items: list[MarketplaceReviewResponse]
    total: int


class PendingReviewResponse(BaseModel):
    """Response for a pending review."""

    transaction_id: str
    listing_title: str
    other_party: UserMinimal
    role: str  # "buyer" or "seller"
    completed_at: datetime
    review_deadline: datetime


class PendingReviewsListResponse(BaseModel):
    """Response for list of pending reviews."""

    items: list[PendingReviewResponse]


class MarketplaceReputationResponse(BaseModel):
    """Response schema for a user's marketplace reputation."""

    user_id: str
    # Averages across all reviews (None if no reviews)
    avg_item_accuracy: float | None
    avg_communication: float | None
    avg_punctuality: float | None
    overall_average: float | None
    total_reviews: int
    # Grace period flag - reviews hidden until 3 transactions
    reviews_visible: bool
    # Individual reviews (only if reviews_visible is True)
    reviews: list[MarketplaceReviewResponse] | None
