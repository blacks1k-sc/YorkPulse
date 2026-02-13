"""Messaging schemas."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.models.messaging import ConversationStatus


class ParticipantInfo(BaseModel):
    """Minimal user info for conversation participants."""

    id: str
    name: str
    avatar_url: str | None


class MessageResponse(BaseModel):
    """Response schema for a message."""

    id: str
    conversation_id: str
    sender_id: str
    content: str | None
    image_url: str | None
    is_deleted: bool
    is_read: bool
    read_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    """Schema for starting a conversation (sending a DM request)."""

    recipient_id: str
    initial_message: Annotated[str, Field(min_length=1, max_length=2000)]
    context_type: Literal["marketplace", "buddy", "profile"] | None = None
    context_id: str | None = None


class ConversationResponse(BaseModel):
    """Response schema for a conversation."""

    id: str
    participants: list[ParticipantInfo]
    initiator_id: str
    status: ConversationStatus
    last_message: MessageResponse | None
    last_message_at: datetime | None
    unread_count: int
    context_type: str | None
    context_id: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    """Response for list of conversations."""

    items: list[ConversationResponse]
    total: int


class PendingRequestsResponse(BaseModel):
    """Response for pending requests."""

    requests: list[ConversationResponse]


class ConversationDetailResponse(BaseModel):
    """Detailed conversation with all info."""

    id: str
    participants: list[ParticipantInfo]
    initiator_id: str
    status: ConversationStatus
    last_message: MessageResponse | None
    last_message_at: datetime | None
    unread_count: int
    context_type: str | None
    context_id: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    """Schema for sending a message."""

    content: Annotated[str | None, Field(default=None, max_length=2000)] = None
    image_url: Annotated[str | None, Field(default=None, max_length=500)] = None

    def model_post_init(self, __context) -> None:
        """Validate that at least one of content or image_url is provided."""
        if not self.content and not self.image_url:
            raise ValueError("Message must have either text or an image (or both)")


class ChatImageUploadRequest(BaseModel):
    """Request for chat image upload URL."""

    filename: str
    content_type: Annotated[str, Field(pattern=r"^image/(jpeg|png|gif|webp)$")]


class ChatImageUploadResponse(BaseModel):
    """Response with presigned upload URL."""

    upload_url: str
    file_url: str
    expires_in: int


class MessageListResponse(BaseModel):
    """Response for list of messages."""

    messages: list[MessageResponse]
    has_more: bool


class MarkReadRequest(BaseModel):
    """Request to mark messages as read."""

    message_ids: list[str] | None = None  # None = mark all as read


class ConversationAction(BaseModel):
    """Schema for accepting/rejecting a conversation request."""

    action: Literal["accept", "reject"]
