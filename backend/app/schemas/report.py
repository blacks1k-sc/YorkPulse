"""Report schemas for user moderation."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.models.report import ReportReason, ReportStatus
from app.schemas.user import UserMinimal


class ReportCreate(BaseModel):
    """Schema for creating a user report."""

    reported_user_id: str
    reason: ReportReason
    explanation: Annotated[str, Field(min_length=10, max_length=2000)]


class ReportResponse(BaseModel):
    """Response schema for a report (minimal info for reporter)."""

    id: str
    reported_user_id: str
    reason: ReportReason
    status: ReportStatus
    created_at: datetime

    class Config:
        from_attributes = True


class ReportAdminResponse(BaseModel):
    """Full report details for admin."""

    id: str
    reporter: UserMinimal
    reported_user: UserMinimal
    reason: ReportReason
    explanation: str
    status: ReportStatus
    admin_notes: str | None
    resolved_at: datetime | None
    resolved_by: UserMinimal | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReportAdminUpdate(BaseModel):
    """Schema for admin updating a report."""

    status: ReportStatus | None = None
    admin_notes: Annotated[str | None, Field(max_length=2000)] = None


class ReportListResponse(BaseModel):
    """Response for list of reports (admin)."""

    items: list[ReportAdminResponse]
    total: int
    page: int
    per_page: int
    has_more: bool
