"""Reviews API routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, VerifiedUser
from app.models.review import Review, ReviewType
from app.models.user import User
from app.schemas.review import (
    ReviewCreate,
    ReviewListResponse,
    ReviewResponse,
    UserRatingSummary,
)
from app.schemas.user import UserMinimal

router = APIRouter(prefix="/reviews", tags=["Reviews"])


def _review_to_response(review: Review) -> ReviewResponse:
    """Convert review model to response."""
    return ReviewResponse(
        id=str(review.id),
        reviewer=UserMinimal(
            id=str(review.reviewer.id),
            name=review.reviewer.name,
            avatar_url=review.reviewer.avatar_url,
        ),
        rating=review.rating,
        comment=review.comment,
        review_type=review.review_type,
        reference_id=str(review.reference_id) if review.reference_id else None,
        created_at=review.created_at,
    )


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    request: ReviewCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a review for a user."""
    reviewed_id = uuid.UUID(request.reviewed_id)

    if reviewed_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot review yourself")

    # Check reviewed user exists
    reviewed_result = await db.execute(
        select(User).where(User.id == reviewed_id)
    )
    if not reviewed_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    # Check for duplicate review
    existing = await db.execute(
        select(Review)
        .where(Review.reviewer_id == user.id)
        .where(Review.reviewed_id == reviewed_id)
        .where(Review.review_type == request.review_type)
        .where(Review.reference_id == (uuid.UUID(request.reference_id) if request.reference_id else None))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already reviewed this transaction")

    review = Review(
        id=uuid.uuid4(),
        reviewer_id=user.id,
        reviewed_id=reviewed_id,
        rating=request.rating,
        comment=request.comment,
        review_type=request.review_type,
        reference_id=uuid.UUID(request.reference_id) if request.reference_id else None,
    )

    db.add(review)
    await db.commit()
    await db.refresh(review, ["reviewer"])

    return _review_to_response(review)


@router.get("/user/{user_id}", response_model=ReviewListResponse)
async def get_user_reviews(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    review_type: ReviewType | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """Get reviews for a user."""
    query = (
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(Review.reviewed_id == user_id)
    )

    if review_type:
        query = query.where(Review.review_type == review_type)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Calculate average
    avg_query = select(func.avg(Review.rating)).where(Review.reviewed_id == user_id)
    if review_type:
        avg_query = avg_query.where(Review.review_type == review_type)
    avg_result = await db.execute(avg_query)
    average_rating = float(avg_result.scalar() or 0)

    # Paginate
    query = query.order_by(Review.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    reviews = result.scalars().all()

    return ReviewListResponse(
        items=[_review_to_response(r) for r in reviews],
        total=total,
        average_rating=round(average_rating, 1),
    )


@router.get("/user/{user_id}/summary", response_model=UserRatingSummary)
async def get_user_rating_summary(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get rating summary for a user."""
    # Marketplace ratings
    marketplace_result = await db.execute(
        select(
            func.avg(Review.rating),
            func.count(Review.id),
        )
        .where(Review.reviewed_id == user_id)
        .where(Review.review_type == ReviewType.MARKETPLACE)
    )
    marketplace_row = marketplace_result.one()
    marketplace_rating = float(marketplace_row[0]) if marketplace_row[0] else None
    marketplace_count = marketplace_row[1] or 0

    # Buddy ratings
    buddy_result = await db.execute(
        select(
            func.avg(Review.rating),
            func.count(Review.id),
        )
        .where(Review.reviewed_id == user_id)
        .where(Review.review_type == ReviewType.BUDDY)
    )
    buddy_row = buddy_result.one()
    buddy_rating = float(buddy_row[0]) if buddy_row[0] else None
    buddy_count = buddy_row[1] or 0

    # Overall
    total_count = marketplace_count + buddy_count
    overall_rating = None
    if total_count > 0:
        overall_result = await db.execute(
            select(func.avg(Review.rating))
            .where(Review.reviewed_id == user_id)
        )
        overall_rating = float(overall_result.scalar() or 0)

    return UserRatingSummary(
        user_id=user_id,
        marketplace_rating=round(marketplace_rating, 1) if marketplace_rating else None,
        marketplace_count=marketplace_count,
        buddy_rating=round(buddy_rating, 1) if buddy_rating else None,
        buddy_count=buddy_count,
        overall_rating=round(overall_rating, 1) if overall_rating else None,
        total_reviews=total_count,
    )


@router.get("/my-reviews", response_model=ReviewListResponse)
async def get_my_reviews(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    direction: Annotated[str, Query(pattern=r"^(given|received)$")] = "received",
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """Get reviews given by or received by current user."""
    if direction == "given":
        query = (
            select(Review)
            .options(selectinload(Review.reviewer))
            .where(Review.reviewer_id == user.id)
        )
    else:
        query = (
            select(Review)
            .options(selectinload(Review.reviewer))
            .where(Review.reviewed_id == user.id)
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Calculate average (only for received)
    average_rating = 0.0
    if direction == "received":
        avg_result = await db.execute(
            select(func.avg(Review.rating)).where(Review.reviewed_id == user.id)
        )
        average_rating = float(avg_result.scalar() or 0)

    # Paginate
    query = query.order_by(Review.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    reviews = result.scalars().all()

    return ReviewListResponse(
        items=[_review_to_response(r) for r in reviews],
        total=total,
        average_rating=round(average_rating, 1),
    )


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a review (author only)."""
    result = await db.execute(
        select(Review).where(Review.id == review_id)
    )
    review = result.scalar_one_or_none()

    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if str(review.reviewer_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(review)
    await db.commit()
