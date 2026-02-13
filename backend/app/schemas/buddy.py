"""Side Quests (buddy matching) schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from app.models.buddy import BuddyCategory, BuddyRequestStatus, ParticipantStatus, VibeLevel
from app.schemas.user import UserMinimal


class BuddyRequestCreate(BaseModel):
    """Schema for creating a buddy request (Side Quest)."""

    category: BuddyCategory
    custom_category: Annotated[str | None, Field(max_length=50)] = None
    activity: Annotated[str, Field(min_length=3, max_length=200)]
    description: Annotated[str | None, Field(max_length=1000)] = None
    start_time: datetime
    end_time: datetime | None = None
    location: Annotated[str, Field(min_length=2, max_length=200)]
    latitude: Annotated[float | None, Field(ge=-90, le=90)] = None
    longitude: Annotated[float | None, Field(ge=-180, le=180)] = None
    vibe_level: VibeLevel = VibeLevel.CHILL
    custom_vibe_level: Annotated[str | None, Field(max_length=50)] = None
    max_participants: Annotated[int, Field(ge=1, le=100)] = 2
    requires_approval: bool = True

    @field_validator("custom_category")
    @classmethod
    def validate_custom_category(cls, v: str | None, info) -> str | None:
        # custom_category required if category is CUSTOM
        if info.data.get("category") == BuddyCategory.CUSTOM and not v:
            raise ValueError("custom_category required when category is 'custom'")
        return v

    @field_validator("custom_vibe_level")
    @classmethod
    def validate_custom_vibe_level(cls, v: str | None, info) -> str | None:
        # custom_vibe_level required if vibe_level is CUSTOM
        if info.data.get("vibe_level") == VibeLevel.CUSTOM and not v:
            raise ValueError("custom_vibe_level required when vibe_level is 'custom'")
        return v

    @field_validator("start_time")
    @classmethod
    def validate_start_time(cls, v: datetime) -> datetime:
        from datetime import timedelta
        # Must be in the future (with 30 second tolerance for network latency)
        if v < datetime.now(v.tzinfo) - timedelta(seconds=30):
            raise ValueError("start_time must be in the future")
        return v

    @field_validator("end_time")
    @classmethod
    def validate_end_time(cls, v: datetime | None, info) -> datetime | None:
        # End time must be after start time if provided
        if v is not None:
            start_time = info.data.get("start_time")
            if start_time and v <= start_time:
                raise ValueError("end_time must be after start_time")
        return v


class BuddyRequestUpdate(BaseModel):
    """Schema for updating a buddy request."""

    activity: Annotated[str | None, Field(min_length=3, max_length=200)] = None
    description: Annotated[str | None, Field(max_length=1000)] = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    location: Annotated[str | None, Field(min_length=2, max_length=200)] = None
    latitude: Annotated[float | None, Field(ge=-90, le=90)] = None
    longitude: Annotated[float | None, Field(ge=-180, le=180)] = None
    vibe_level: VibeLevel | None = None
    custom_vibe_level: Annotated[str | None, Field(max_length=50)] = None
    max_participants: Annotated[int | None, Field(ge=1, le=100)] = None
    requires_approval: bool | None = None
    status: BuddyRequestStatus | None = None


class BuddyRequestResponse(BaseModel):
    """Response schema for a buddy request."""

    id: str
    category: BuddyCategory
    custom_category: str | None
    activity: str
    description: str | None
    start_time: datetime
    end_time: datetime | None
    location: str
    latitude: float | None
    longitude: float | None
    vibe_level: VibeLevel
    custom_vibe_level: str | None
    max_participants: int
    current_participants: int
    requires_approval: bool
    status: BuddyRequestStatus
    host: UserMinimal
    created_at: datetime

    class Config:
        from_attributes = True


class BuddyRequestListResponse(BaseModel):
    """Response for list of buddy requests."""

    items: list[BuddyRequestResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


class BuddyRequestFilters(BaseModel):
    """Query filters for buddy requests."""

    category: BuddyCategory | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    location: str | None = None
    status: BuddyRequestStatus = BuddyRequestStatus.OPEN


class JoinRequestCreate(BaseModel):
    """Schema for requesting to join a buddy request."""

    message: Annotated[str | None, Field(max_length=500)] = None


class ParticipantResponse(BaseModel):
    """Response schema for a participant."""

    id: str
    user: UserMinimal
    status: ParticipantStatus
    message: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ParticipantListResponse(BaseModel):
    """Response for list of participants."""

    items: list[ParticipantResponse]
    total: int


class ParticipantAction(BaseModel):
    """Action on a participant (accept/reject)."""

    action: Annotated[str, Field(pattern=r"^(accept|reject)$")]


# Quest Group Chat schemas

class QuestMessageCreate(BaseModel):
    """Schema for sending a message in quest group chat."""

    content: Annotated[str, Field(min_length=1, max_length=2000)]


class QuestMessageResponse(BaseModel):
    """Response schema for a quest message."""

    id: str
    content: str
    sender: UserMinimal
    created_at: datetime
    is_deleted: bool = False

    class Config:
        from_attributes = True


class QuestMessagesResponse(BaseModel):
    """Response for list of quest messages."""

    messages: list[QuestMessageResponse]
    has_more: bool
