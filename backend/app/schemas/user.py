"""User schemas."""

from datetime import datetime

from pydantic import BaseModel


class UserBase(BaseModel):
    """Base user schema."""

    email: str
    name: str


class UserCreate(UserBase):
    """Schema for creating a user."""

    pass


class UserInDB(UserBase):
    """User schema as stored in database."""

    id: str
    email_verified: bool
    name_verified: bool
    program: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    campus_days: list[str] | None = None
    interests: list[str] | None = None
    is_active: bool
    is_banned: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserPublic(BaseModel):
    """Public user information (for other users to see)."""

    id: str
    name: str
    program: str | None = None
    avatar_url: str | None = None
    interests: list[str] | None = None

    class Config:
        from_attributes = True


class UserMinimal(BaseModel):
    """Minimal user info for listings, posts, etc."""

    id: str
    name: str
    avatar_url: str | None = None

    class Config:
        from_attributes = True
