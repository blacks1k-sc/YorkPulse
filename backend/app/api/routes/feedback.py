"""Feedback/suggestion API routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, VerifiedUser, AdminUser
from app.models.feedback import UserFeedback, FeedbackStatus
from app.schemas.feedback import (
    FeedbackCreate,
    FeedbackResponse,
    FeedbackListResponse,
    FeedbackCreateResponse,
    FeedbackAuthor,
)

router = APIRouter(prefix="/feedback", tags=["Feedback"])


def _feedback_to_response(feedback: UserFeedback) -> FeedbackResponse:
    """Convert feedback model to response."""
    return FeedbackResponse(
        id=str(feedback.id),
        type=feedback.type,
        subject=feedback.subject,
        message=feedback.message,
        status=feedback.status,
        admin_response=feedback.admin_response,
        responded_at=feedback.responded_at,
        created_at=feedback.created_at,
        user=FeedbackAuthor(
            id=str(feedback.user.id),
            name=feedback.user.name,
            email=feedback.user.email,
        ),
    )


@router.post("", response_model=FeedbackCreateResponse, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    request: FeedbackCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit feedback or suggestion."""
    feedback = UserFeedback(
        id=uuid.uuid4(),
        user_id=user.id,
        type=request.type,
        subject=request.subject,
        message=request.message,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    # Load user relationship
    result = await db.execute(
        select(UserFeedback)
        .options(selectinload(UserFeedback.user))
        .where(UserFeedback.id == feedback.id)
    )
    feedback = result.scalar_one()

    return FeedbackCreateResponse(
        feedback=_feedback_to_response(feedback),
        message="Thank you for your feedback! We'll review it soon.",
    )


@router.get("/my", response_model=FeedbackListResponse)
async def get_my_feedback(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """Get user's own feedback submissions."""
    offset = (page - 1) * per_page

    # Count total
    count_result = await db.execute(
        select(func.count())
        .select_from(UserFeedback)
        .where(UserFeedback.user_id == user.id)
    )
    total = count_result.scalar() or 0

    # Get feedback
    result = await db.execute(
        select(UserFeedback)
        .options(selectinload(UserFeedback.user))
        .where(UserFeedback.user_id == user.id)
        .order_by(UserFeedback.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    feedback_list = result.scalars().all()

    return FeedbackListResponse(
        items=[_feedback_to_response(f) for f in feedback_list],
        total=total,
    )


@router.get("/admin", response_model=FeedbackListResponse)
async def get_all_feedback(
    user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
    status_filter: FeedbackStatus | None = None,
):
    """Get all feedback submissions (admin only)."""
    offset = (page - 1) * per_page

    # Build base query
    base_query = select(UserFeedback)
    count_query = select(func.count()).select_from(UserFeedback)

    if status_filter:
        base_query = base_query.where(UserFeedback.status == status_filter)
        count_query = count_query.where(UserFeedback.status == status_filter)

    # Count total
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Get feedback
    result = await db.execute(
        base_query
        .options(selectinload(UserFeedback.user))
        .order_by(UserFeedback.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    feedback_list = result.scalars().all()

    return FeedbackListResponse(
        items=[_feedback_to_response(f) for f in feedback_list],
        total=total,
    )
