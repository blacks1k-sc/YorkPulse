"""User report API routes for safety-focused moderation."""

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import AdminUser, VerifiedUser
from app.models.report import ReportReason, ReportStatus, UserReport
from app.models.user import User
from app.schemas.report import (
    ReportAdminResponse,
    ReportAdminUpdate,
    ReportCreate,
    ReportListResponse,
    ReportResponse,
)
from app.schemas.user import UserMinimal

router = APIRouter(tags=["Reports"])


def _report_to_admin_response(report: UserReport) -> ReportAdminResponse:
    """Convert report model to admin response."""
    resolved_by_admin = None
    if report.resolved_by_admin:
        resolved_by_admin = UserMinimal(
            id=str(report.resolved_by_admin.id),
            name=report.resolved_by_admin.name,
            avatar_url=report.resolved_by_admin.avatar_url,
        )

    return ReportAdminResponse(
        id=str(report.id),
        reporter=UserMinimal(
            id=str(report.reporter.id),
            name=report.reporter.name,
            avatar_url=report.reporter.avatar_url,
        ),
        reported_user=UserMinimal(
            id=str(report.reported_user.id),
            name=report.reported_user.name,
            avatar_url=report.reported_user.avatar_url,
        ),
        reason=report.reason,
        explanation=report.explanation,
        status=report.status,
        admin_notes=report.admin_notes,
        resolved_at=report.resolved_at,
        resolved_by=resolved_by_admin,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.post(
    "/users/report",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_report(
    request: ReportCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit a user report."""
    # Validate reported user ID
    try:
        reported_uuid = uuid.UUID(request.reported_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    # Check not reporting self
    if reported_uuid == user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot report yourself",
        )

    # Check reported user exists
    result = await db.execute(select(User).where(User.id == reported_uuid))
    reported_user = result.scalar_one_or_none()
    if not reported_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create report
    report = UserReport(
        id=uuid.uuid4(),
        reporter_id=user.id,
        reported_user_id=reported_uuid,
        reason=request.reason,
        explanation=request.explanation,
    )

    db.add(report)
    await db.commit()
    await db.refresh(report)

    return ReportResponse(
        id=str(report.id),
        reported_user_id=str(report.reported_user_id),
        reason=report.reason,
        status=report.status,
        created_at=report.created_at,
    )


@router.get("/admin/reports", response_model=ReportListResponse)
async def list_reports(
    user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: ReportStatus | None = None,
    reason_filter: ReportReason | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """List all reports (admin only)."""
    query = (
        select(UserReport)
        .options(
            selectinload(UserReport.reporter),
            selectinload(UserReport.reported_user),
            selectinload(UserReport.resolved_by_admin),
        )
    )

    if status_filter:
        query = query.where(UserReport.status == status_filter)

    if reason_filter:
        query = query.where(UserReport.reason == reason_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate - newest first
    query = query.order_by(UserReport.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    reports = result.scalars().all()

    return ReportListResponse(
        items=[_report_to_admin_response(r) for r in reports],
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total,
    )


@router.patch("/admin/reports/{report_id}", response_model=ReportAdminResponse)
async def update_report(
    report_id: str,
    request: ReportAdminUpdate,
    user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a report status (admin only)."""
    # Validate report ID
    try:
        report_uuid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report ID format")

    # Get report
    result = await db.execute(
        select(UserReport)
        .options(
            selectinload(UserReport.reporter),
            selectinload(UserReport.reported_user),
            selectinload(UserReport.resolved_by_admin),
        )
        .where(UserReport.id == report_uuid)
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Update fields
    if request.status is not None:
        old_status = report.status
        report.status = request.status

        # If transitioning to resolved/dismissed, set resolution info
        if request.status in (ReportStatus.RESOLVED, ReportStatus.DISMISSED):
            if old_status not in (ReportStatus.RESOLVED, ReportStatus.DISMISSED):
                report.resolved_at = datetime.now(timezone.utc)
                report.resolved_by = user.id

    if request.admin_notes is not None:
        report.admin_notes = request.admin_notes

    await db.commit()

    # Refresh with relationships
    result = await db.execute(
        select(UserReport)
        .options(
            selectinload(UserReport.reporter),
            selectinload(UserReport.reported_user),
            selectinload(UserReport.resolved_by_admin),
        )
        .where(UserReport.id == report_uuid)
    )
    report = result.scalar_one()

    return _report_to_admin_response(report)


@router.get("/admin/reports/{report_id}", response_model=ReportAdminResponse)
async def get_report(
    report_id: str,
    user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a specific report (admin only)."""
    # Validate report ID
    try:
        report_uuid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report ID format")

    # Get report
    result = await db.execute(
        select(UserReport)
        .options(
            selectinload(UserReport.reporter),
            selectinload(UserReport.reported_user),
            selectinload(UserReport.resolved_by_admin),
        )
        .where(UserReport.id == report_uuid)
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return _report_to_admin_response(report)
