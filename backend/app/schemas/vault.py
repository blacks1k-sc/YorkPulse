"""Vault (anonymous forum) schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.models.vault import VaultCategory, VaultPostStatus
from app.schemas.user import UserMinimal


class VaultPostCreate(BaseModel):
    """Schema for creating a vault post."""

    title: Annotated[str, Field(min_length=3, max_length=200)]
    content: Annotated[str, Field(min_length=10, max_length=10000)]
    category: VaultCategory
    is_anonymous: bool = True


class VaultPostUpdate(BaseModel):
    """Schema for updating a vault post."""

    title: Annotated[str | None, Field(min_length=3, max_length=200)] = None
    content: Annotated[str | None, Field(min_length=10, max_length=10000)] = None
    category: VaultCategory | None = None


class VaultPostResponse(BaseModel):
    """Response schema for a vault post."""

    id: str
    title: str
    content: str
    category: VaultCategory
    is_anonymous: bool
    status: VaultPostStatus
    comment_count: int
    upvote_count: int
    flag_count: int
    author: UserMinimal | None  # None if anonymous
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VaultPostListResponse(BaseModel):
    """Response for list of vault posts."""

    items: list[VaultPostResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


class VaultCommentCreate(BaseModel):
    """Schema for creating a comment."""

    content: Annotated[str, Field(min_length=1, max_length=2000)]
    is_anonymous: bool = True
    parent_id: str | None = None  # For threaded replies


class VaultCommentUpdate(BaseModel):
    """Schema for updating a comment."""

    content: Annotated[str, Field(min_length=1, max_length=2000)]


class VaultCommentResponse(BaseModel):
    """Response schema for a comment."""

    id: str
    post_id: str
    content: str
    is_anonymous: bool
    is_hidden: bool
    parent_id: str | None
    author: UserMinimal | None  # None if anonymous
    created_at: datetime

    class Config:
        from_attributes = True


class VaultCommentListResponse(BaseModel):
    """Response for list of comments."""

    items: list[VaultCommentResponse]
    total: int


class FlagRequest(BaseModel):
    """Request to flag content."""

    reason: Annotated[str, Field(min_length=5, max_length=500)]
