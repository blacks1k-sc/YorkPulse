"""Transaction schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field

from app.schemas.user import UserMinimal


class TransactionCreate(BaseModel):
    """Schema for creating a transaction (seller initiates)."""

    listing_id: str
    buyer_id: str
    final_price: Annotated[Decimal, Field(gt=0)]


class TransactionConfirm(BaseModel):
    """Schema for confirming a transaction."""

    # No additional fields needed - auth determines who is confirming
    pass


class TransactionResponse(BaseModel):
    """Response schema for a transaction."""

    id: str
    listing_id: str
    listing_title: str
    seller: UserMinimal
    buyer: UserMinimal
    final_price: Decimal
    seller_confirmed: bool
    buyer_confirmed: bool
    completed_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    """Response for list of transactions."""

    items: list[TransactionResponse]
    total: int
    page: int
    per_page: int
    has_more: bool
