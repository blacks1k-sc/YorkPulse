"""Review schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.models.review import ReviewType
from app.schemas.user import UserMinimal


class ReviewCreate(BaseModel):
    """Schema for creating a review."""

    reviewed_id: str  # User being reviewed
    rating: Annotated[int, Field(ge=1, le=5)]
    comment: Annotated[str | None, Field(max_length=1000)] = None
    review_type: ReviewType
    reference_id: str | None = None  # Listing or buddy request ID


class ReviewResponse(BaseModel):
    """Response schema for a review."""

    id: str
    reviewer: UserMinimal
    rating: int
    comment: str | None
    review_type: ReviewType
    reference_id: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewListResponse(BaseModel):
    """Response for list of reviews."""

    items: list[ReviewResponse]
    total: int
    average_rating: float


class UserRatingSummary(BaseModel):
    """Summary of a user's ratings."""

    user_id: str
    marketplace_rating: float | None
    marketplace_count: int
    buddy_rating: float | None
    buddy_count: int
    overall_rating: float | None
    total_reviews: int
