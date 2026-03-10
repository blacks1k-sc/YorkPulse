"""Residence chat schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field


class ResidenceResponse(BaseModel):
    id: str
    name: str
    campus: str
    member_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ResidenceListResponse(BaseModel):
    keele: list[ResidenceResponse]
    glendon: list[ResidenceResponse]


class ResidenceChannelResponse(BaseModel):
    id: str
    residence_id: str
    name: str
    member_count: int
    created_at: datetime
    unread_count: int = 0

    class Config:
        from_attributes = True


class JoinResidenceResponse(BaseModel):
    residence: ResidenceResponse
    channel: ResidenceChannelResponse
    message: str


class LeaveResidenceResponse(BaseModel):
    message: str


class ResidenceMessageAuthor(BaseModel):
    id: str
    name: str
    avatar_url: str | None


class ResidenceReplyInfo(BaseModel):
    id: str
    message: str | None
    image_url: str | None
    author: ResidenceMessageAuthor

    class Config:
        from_attributes = True


class ResidenceMessageResponse(BaseModel):
    id: str
    channel_id: str
    message: str | None
    image_url: str | None
    author: ResidenceMessageAuthor
    reply_to: ResidenceReplyInfo | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ResidenceMessageCreate(BaseModel):
    message: Annotated[str | None, Field(default=None, max_length=500)] = None
    image_url: Annotated[str | None, Field(default=None, max_length=500)] = None
    reply_to_id: str | None = None

    def model_post_init(self, __context) -> None:
        if not self.message and not self.image_url:
            raise ValueError("Message must have either text or an image (or both)")


class ResidenceMessageListResponse(BaseModel):
    messages: list[ResidenceMessageResponse]
    has_more: bool


class ResidenceMembershipResponse(BaseModel):
    residence: ResidenceResponse
    channel: ResidenceChannelResponse
    joined_at: datetime
    unread_count: int = 0


class MyResidencesResponse(BaseModel):
    residences: list[ResidenceMembershipResponse]


class ResidenceParticipant(BaseModel):
    id: str
    name: str
    avatar_url: str | None


class ResidenceParticipantsResponse(BaseModel):
    participants: list[ResidenceParticipant]
    total: int


class SeedResidencesResponse(BaseModel):
    residences_created: int
    channels_created: int
    message: str
