"""Pydantic schemas for Quick Gigs marketplace."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# Enums as literals for API
GigTypeEnum = Literal["offering", "need_help"]
GigCategoryEnum = Literal["academic", "moving", "tech_help", "errands", "creative", "other"]
GigPriceTypeEnum = Literal["fixed", "hourly", "negotiable"]
GigLocationEnum = Literal["on_campus", "off_campus", "online"]
GigStatusEnum = Literal["active", "in_progress", "completed", "cancelled", "expired"]
GigResponseStatusEnum = Literal["pending", "accepted", "rejected", "completed"]
GigTransactionStatusEnum = Literal["pending", "completed", "disputed"]


# User info for gig responses
class GigUserInfo(BaseModel):
    id: str
    name: str
    avatar_url: str | None
    email_verified: bool
    name_verified: bool
    gig_rating_avg: float
    gigs_completed: int

    model_config = {"from_attributes": True}


class GigUserMinimal(BaseModel):
    id: str
    name: str
    avatar_url: str | None

    model_config = {"from_attributes": True}


# Gig schemas
class GigCreate(BaseModel):
    gig_type: GigTypeEnum
    category: GigCategoryEnum
    title: str = Field(..., min_length=5, max_length=100)
    description: str = Field(..., min_length=20, max_length=1000)
    price_min: Decimal | None = Field(None, ge=0)
    price_max: Decimal | None = Field(None, ge=0)
    price_type: GigPriceTypeEnum | None = None
    location: GigLocationEnum | None = None
    location_details: str | None = Field(None, max_length=200)
    deadline: datetime | None = None

    @field_validator("price_max")
    @classmethod
    def price_max_gte_min(cls, v: Decimal | None, info) -> Decimal | None:
        price_min = info.data.get("price_min")
        if v is not None and price_min is not None and v < price_min:
            raise ValueError("price_max must be >= price_min")
        return v


class GigUpdate(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=100)
    description: str | None = Field(None, min_length=20, max_length=1000)
    price_min: Decimal | None = Field(None, ge=0)
    price_max: Decimal | None = Field(None, ge=0)
    price_type: GigPriceTypeEnum | None = None
    location: GigLocationEnum | None = None
    location_details: str | None = Field(None, max_length=200)
    deadline: datetime | None = None
    status: GigStatusEnum | None = None


class GigResponse(BaseModel):
    id: str
    poster_id: str
    gig_type: GigTypeEnum
    category: GigCategoryEnum
    title: str
    description: str
    price_min: float | None
    price_max: float | None
    price_type: GigPriceTypeEnum | None
    location: GigLocationEnum | None
    location_details: str | None
    deadline: datetime | None
    status: GigStatusEnum
    view_count: int
    response_count: int
    created_at: datetime
    updated_at: datetime
    poster: GigUserInfo

    model_config = {"from_attributes": True}


class GigListResponse(BaseModel):
    items: list[GigResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


# Gig response (application) schemas
class GigResponseCreate(BaseModel):
    message: str | None = Field(None, max_length=500)
    proposed_price: Decimal | None = Field(None, ge=0)


class GigResponseItem(BaseModel):
    id: str
    gig_id: str
    responder_id: str
    message: str | None
    proposed_price: float | None
    status: GigResponseStatusEnum
    created_at: datetime
    responder: GigUserInfo

    model_config = {"from_attributes": True}


class GigResponsesListResponse(BaseModel):
    items: list[GigResponseItem]
    total: int


class GigResponseActionResult(BaseModel):
    success: bool
    message: str
    response_id: str
    status: GigResponseStatusEnum
    transaction_id: str | None = None


# Transaction schemas
class GigTransactionResponse(BaseModel):
    id: str
    gig_id: str | None
    response_id: str | None
    provider_id: str | None
    client_id: str | None
    amount: float
    payment_method: str
    status: GigTransactionStatusEnum
    provider_confirmed: bool
    client_confirmed: bool
    completed_at: datetime | None
    created_at: datetime
    gig: GigResponse | None = None
    provider: GigUserMinimal | None = None
    client: GigUserMinimal | None = None

    model_config = {"from_attributes": True}


class GigTransactionListResponse(BaseModel):
    items: list[GigTransactionResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


class GigCompleteResult(BaseModel):
    success: bool
    message: str
    transaction_id: str
    both_confirmed: bool
    status: GigTransactionStatusEnum


# Rating schemas
class GigRatingCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    reliability: int = Field(..., ge=1, le=5)
    communication: int = Field(..., ge=1, le=5)
    quality: int = Field(..., ge=1, le=5)
    review_text: str | None = Field(None, max_length=500)


class GigRatingResponse(BaseModel):
    id: str
    transaction_id: str
    rater_id: str
    ratee_id: str
    rating: int
    reliability: int
    communication: int
    quality: int
    review_text: str | None
    created_at: datetime
    rater: GigUserMinimal

    model_config = {"from_attributes": True}


class GigRatingListResponse(BaseModel):
    items: list[GigRatingResponse]
    total: int
    average_rating: float
    average_reliability: float
    average_communication: float
    average_quality: float


# User gig profile
class GigProfileResponse(BaseModel):
    user_id: str
    gig_rating_avg: float
    gigs_completed: int
    total_earned: float
    recent_ratings: list[GigRatingResponse]
    active_offerings: int
    active_requests: int


# My gigs response
class MyGigsResponse(BaseModel):
    posted: list[GigResponse]
    responded: list[GigResponseItem]


# Filters for browse
class GigFilters(BaseModel):
    gig_type: GigTypeEnum | None = None
    category: GigCategoryEnum | None = None
    min_price: float | None = None
    max_price: float | None = None
    location: GigLocationEnum | None = None
    search: str | None = None
    sort: Literal["recent", "price_low", "price_high", "highest_rated"] = "recent"
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=50)
