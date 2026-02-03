"""Marketplace schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from app.models.marketplace import MarketplaceCategory, ListingStatus, ListingCondition
from app.schemas.user import UserMinimal


class ListingCreate(BaseModel):
    """Schema for creating a marketplace listing."""

    title: Annotated[str, Field(min_length=3, max_length=200)]
    description: Annotated[str, Field(min_length=10, max_length=5000)]
    price: Annotated[Decimal, Field(ge=0, le=100000)]
    is_negotiable: bool = False
    category: MarketplaceCategory
    condition: ListingCondition | None = None
    course_codes: list[str] | None = None
    images: list[str] | None = None
    preferred_meetup_location: Annotated[str | None, Field(max_length=200)] = None

    @field_validator("course_codes")
    @classmethod
    def validate_course_codes(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        # Clean and validate course codes (e.g., "EECS 1001", "MATH 1300")
        cleaned = []
        for code in v[:5]:  # Max 5 course codes
            code = code.upper().strip()[:20]
            if code:
                cleaned.append(code)
        return cleaned if cleaned else None

    @field_validator("images")
    @classmethod
    def validate_images(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        # Max 5 images
        return v[:5]


class ListingUpdate(BaseModel):
    """Schema for updating a listing."""

    title: Annotated[str | None, Field(min_length=3, max_length=200)] = None
    description: Annotated[str | None, Field(min_length=10, max_length=5000)] = None
    price: Annotated[Decimal | None, Field(ge=0, le=100000)] = None
    is_negotiable: bool | None = None
    category: MarketplaceCategory | None = None
    condition: ListingCondition | None = None
    course_codes: list[str] | None = None
    images: list[str] | None = None
    preferred_meetup_location: Annotated[str | None, Field(max_length=200)] = None
    status: ListingStatus | None = None


class ListingResponse(BaseModel):
    """Response schema for a listing."""

    id: str
    title: str
    description: str
    price: Decimal
    is_negotiable: bool
    category: MarketplaceCategory
    condition: ListingCondition | None
    course_codes: list[str] | None
    images: list[str] | None
    status: ListingStatus
    preferred_meetup_location: str | None
    view_count: int
    seller: UserMinimal
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ListingListResponse(BaseModel):
    """Response for list of listings."""

    items: list[ListingResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


class ListingFilters(BaseModel):
    """Query filters for listings."""

    category: MarketplaceCategory | None = None
    condition: ListingCondition | None = None
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    course_code: str | None = None
    search: str | None = None
    status: ListingStatus = ListingStatus.ACTIVE


class ImageUploadRequest(BaseModel):
    """Request for image upload URL."""

    filename: str
    content_type: Annotated[str, Field(pattern=r"^image/(jpeg|png|webp)$")]


class ImageUploadResponse(BaseModel):
    """Response with presigned upload URL."""

    upload_url: str
    file_key: str
    public_url: str
    expires_in: int
