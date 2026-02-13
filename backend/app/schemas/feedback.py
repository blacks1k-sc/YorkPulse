"""Feedback/suggestion schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.models.feedback import FeedbackType, FeedbackStatus


class FeedbackCreate(BaseModel):
    """Create a new feedback submission."""

    type: FeedbackType
    subject: Annotated[str, Field(min_length=5, max_length=200)]
    message: Annotated[str, Field(min_length=20, max_length=2000)]


class FeedbackAuthor(BaseModel):
    """Minimal author info for feedback."""

    id: str
    name: str
    email: str

    class Config:
        from_attributes = True


class FeedbackResponse(BaseModel):
    """Feedback submission response."""

    id: str
    type: FeedbackType
    subject: str
    message: str
    status: FeedbackStatus
    admin_response: str | None
    responded_at: datetime | None
    created_at: datetime
    user: FeedbackAuthor

    class Config:
        from_attributes = True


class FeedbackListResponse(BaseModel):
    """List of feedback submissions."""

    items: list[FeedbackResponse]
    total: int


class FeedbackCreateResponse(BaseModel):
    """Response after creating feedback."""

    feedback: FeedbackResponse
    message: str
