"""API routes for Quick Gigs marketplace."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.gig import (
    Gig,
    GigResponse as GigResponseModel,
    GigTransaction,
    GigRating,
    GigType,
    GigCategory,
    GigPriceType,
    GigLocation,
    GigStatus,
    GigResponseStatus,
    GigTransactionStatus,
)
from app.schemas.gig import (
    GigCreate,
    GigUpdate,
    GigResponse,
    GigListResponse,
    GigResponseCreate,
    GigResponseItem,
    GigResponsesListResponse,
    GigResponseActionResult,
    GigTransactionResponse,
    GigTransactionListResponse,
    GigCompleteResult,
    GigRatingCreate,
    GigRatingResponse,
    GigRatingListResponse,
    GigProfileResponse,
    GigUserInfo,
    GigUserMinimal,
)

router = APIRouter(prefix="/gigs", tags=["gigs"])


def _user_to_info(user: User) -> dict:
    """Convert user to GigUserInfo dict."""
    return {
        "id": str(user.id),
        "name": user.name,
        "avatar_url": user.avatar_url,
        "email_verified": user.email_verified,
        "name_verified": user.name_verified,
        "gig_rating_avg": float(user.gig_rating_avg),
        "gigs_completed": user.gigs_completed,
    }


def _user_to_minimal(user: User) -> dict:
    """Convert user to GigUserMinimal dict."""
    return {
        "id": str(user.id),
        "name": user.name,
        "avatar_url": user.avatar_url,
    }


def _gig_to_response(gig: Gig) -> dict:
    """Convert gig to response dict."""
    return {
        "id": str(gig.id),
        "poster_id": str(gig.poster_id),
        "gig_type": gig.gig_type.value,
        "category": gig.category.value,
        "title": gig.title,
        "description": gig.description,
        "price_min": float(gig.price_min) if gig.price_min else None,
        "price_max": float(gig.price_max) if gig.price_max else None,
        "price_type": gig.price_type.value if gig.price_type else None,
        "location": gig.location.value if gig.location else None,
        "location_details": gig.location_details,
        "deadline": gig.deadline,
        "status": gig.status.value,
        "view_count": gig.view_count,
        "response_count": gig.response_count,
        "created_at": gig.created_at,
        "updated_at": gig.updated_at,
        "poster": _user_to_info(gig.poster),
    }


# Browse gigs
@router.get("", response_model=GigListResponse)
async def get_gigs(
    gig_type: Literal["offering", "need_help"] | None = None,
    category: Literal["academic", "moving", "tech_help", "errands", "creative", "other"] | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    location: Literal["on_campus", "off_campus", "online"] | None = None,
    search: str | None = None,
    sort: Literal["recent", "price_low", "price_high", "highest_rated"] = "recent",
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Browse gigs with filters."""
    query = select(Gig).options(selectinload(Gig.poster))

    # Only show active gigs by default
    query = query.where(Gig.status == GigStatus.ACTIVE)

    # Apply filters
    if gig_type:
        query = query.where(Gig.gig_type == GigType(gig_type))
    if category:
        query = query.where(Gig.category == GigCategory(category))
    if location:
        query = query.where(Gig.location == GigLocation(location))
    if min_price is not None:
        query = query.where(or_(Gig.price_min >= min_price, Gig.price_max >= min_price))
    if max_price is not None:
        query = query.where(or_(Gig.price_min <= max_price, Gig.price_max <= max_price))
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Gig.title.ilike(search_term),
                Gig.description.ilike(search_term),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Sort
    if sort == "recent":
        query = query.order_by(Gig.created_at.desc())
    elif sort == "price_low":
        query = query.order_by(Gig.price_min.asc().nulls_last())
    elif sort == "price_high":
        query = query.order_by(Gig.price_max.desc().nulls_last())
    elif sort == "highest_rated":
        query = query.join(User, Gig.poster_id == User.id).order_by(User.gig_rating_avg.desc())

    # Paginate
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    gigs = result.scalars().all()

    return {
        "items": [_gig_to_response(g) for g in gigs],
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": offset + len(gigs) < total,
    }


# Create gig
@router.post("", response_model=GigResponse, status_code=status.HTTP_201_CREATED)
async def create_gig(
    data: GigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new gig."""
    gig = Gig(
        poster_id=current_user.id,
        gig_type=GigType(data.gig_type),
        category=GigCategory(data.category),
        title=data.title,
        description=data.description,
        price_min=data.price_min,
        price_max=data.price_max,
        price_type=GigPriceType(data.price_type) if data.price_type else None,
        location=GigLocation(data.location) if data.location else None,
        location_details=data.location_details,
        deadline=data.deadline,
    )

    db.add(gig)
    await db.commit()
    await db.refresh(gig, ["poster"])

    return _gig_to_response(gig)


# Get single gig
@router.get("/{gig_id}", response_model=GigResponse)
async def get_gig(
    gig_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get gig details and increment view count."""
    query = select(Gig).options(selectinload(Gig.poster)).where(Gig.id == gig_id)
    result = await db.execute(query)
    gig = result.scalar_one_or_none()

    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")

    # Increment view count
    gig.view_count += 1
    await db.commit()

    return _gig_to_response(gig)


# Update gig
@router.patch("/{gig_id}", response_model=GigResponse)
async def update_gig(
    gig_id: uuid.UUID,
    data: GigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update gig (poster only)."""
    query = select(Gig).options(selectinload(Gig.poster)).where(Gig.id == gig_id)
    result = await db.execute(query)
    gig = result.scalar_one_or_none()

    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "price_type" and value:
            value = GigPriceType(value)
        elif field == "location" and value:
            value = GigLocation(value)
        elif field == "status" and value:
            value = GigStatus(value)
        setattr(gig, field, value)

    await db.commit()
    await db.refresh(gig)

    return _gig_to_response(gig)


# Delete gig
@router.delete("/{gig_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gig(
    gig_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete gig (poster only)."""
    query = select(Gig).where(Gig.id == gig_id)
    result = await db.execute(query)
    gig = result.scalar_one_or_none()

    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(gig)
    await db.commit()


# Respond to gig
@router.post("/{gig_id}/respond", response_model=GigResponseItem)
async def respond_to_gig(
    gig_id: uuid.UUID,
    data: GigResponseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Respond to a gig."""
    # Get gig
    query = select(Gig).where(Gig.id == gig_id)
    result = await db.execute(query)
    gig = result.scalar_one_or_none()

    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig.status != GigStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Gig is not active")
    if gig.poster_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot respond to your own gig")

    # Check if already responded
    existing = await db.execute(
        select(GigResponseModel).where(
            and_(
                GigResponseModel.gig_id == gig_id,
                GigResponseModel.responder_id == current_user.id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already responded to this gig")

    # Check response limit (max 5 per gig)
    count_result = await db.execute(
        select(func.count()).select_from(GigResponseModel).where(GigResponseModel.gig_id == gig_id)
    )
    if (count_result.scalar() or 0) >= 5:
        raise HTTPException(status_code=400, detail="Maximum responses reached for this gig")

    # Create response
    response = GigResponseModel(
        gig_id=gig_id,
        responder_id=current_user.id,
        message=data.message,
        proposed_price=data.proposed_price,
    )

    db.add(response)
    gig.response_count += 1
    await db.commit()
    await db.refresh(response, ["responder"])

    return {
        "id": str(response.id),
        "gig_id": str(response.gig_id),
        "responder_id": str(response.responder_id),
        "message": response.message,
        "proposed_price": float(response.proposed_price) if response.proposed_price else None,
        "status": response.status.value,
        "created_at": response.created_at,
        "responder": _user_to_info(response.responder),
    }


# Get responses to a gig (poster only)
@router.get("/{gig_id}/responses", response_model=GigResponsesListResponse)
async def get_gig_responses(
    gig_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all responses to a gig (poster only)."""
    # Check ownership
    query = select(Gig).where(Gig.id == gig_id)
    result = await db.execute(query)
    gig = result.scalar_one_or_none()

    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get responses
    responses_query = (
        select(GigResponseModel)
        .options(selectinload(GigResponseModel.responder))
        .where(GigResponseModel.gig_id == gig_id)
        .order_by(GigResponseModel.created_at.desc())
    )
    responses_result = await db.execute(responses_query)
    responses = responses_result.scalars().all()

    return {
        "items": [
            {
                "id": str(r.id),
                "gig_id": str(r.gig_id),
                "responder_id": str(r.responder_id),
                "message": r.message,
                "proposed_price": float(r.proposed_price) if r.proposed_price else None,
                "status": r.status.value,
                "created_at": r.created_at,
                "responder": _user_to_info(r.responder),
            }
            for r in responses
        ],
        "total": len(responses),
    }


# Accept response
@router.post("/{gig_id}/responses/{response_id}/accept", response_model=GigResponseActionResult)
async def accept_response(
    gig_id: uuid.UUID,
    response_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a response to your gig."""
    # Get gig and response
    gig_query = select(Gig).where(Gig.id == gig_id)
    gig_result = await db.execute(gig_query)
    gig = gig_result.scalar_one_or_none()

    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if gig.status != GigStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Gig is not active")

    response_query = select(GigResponseModel).where(
        and_(GigResponseModel.id == response_id, GigResponseModel.gig_id == gig_id)
    )
    response_result = await db.execute(response_query)
    response = response_result.scalar_one_or_none()

    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    if response.status != GigResponseStatus.PENDING:
        raise HTTPException(status_code=400, detail="Response is not pending")

    # Accept response
    response.status = GigResponseStatus.ACCEPTED
    gig.status = GigStatus.IN_PROGRESS

    # Reject other pending responses
    await db.execute(
        GigResponseModel.__table__.update()
        .where(
            and_(
                GigResponseModel.gig_id == gig_id,
                GigResponseModel.id != response_id,
                GigResponseModel.status == GigResponseStatus.PENDING,
            )
        )
        .values(status=GigResponseStatus.REJECTED)
    )

    # Determine provider and client based on gig type
    if gig.gig_type == GigType.OFFERING:
        # Poster is offering, responder is client
        provider_id = gig.poster_id
        client_id = response.responder_id
    else:
        # Poster needs help, responder is provider
        provider_id = response.responder_id
        client_id = gig.poster_id

    # Create transaction
    amount = response.proposed_price or gig.price_min or Decimal("0")
    transaction = GigTransaction(
        gig_id=gig_id,
        response_id=response_id,
        provider_id=provider_id,
        client_id=client_id,
        amount=amount,
    )

    db.add(transaction)
    await db.commit()

    return {
        "success": True,
        "message": "Response accepted",
        "response_id": str(response_id),
        "status": response.status.value,
        "transaction_id": str(transaction.id),
    }


# Reject response
@router.post("/{gig_id}/responses/{response_id}/reject", response_model=GigResponseActionResult)
async def reject_response(
    gig_id: uuid.UUID,
    response_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject a response to your gig."""
    # Get gig and response
    gig_query = select(Gig).where(Gig.id == gig_id)
    gig_result = await db.execute(gig_query)
    gig = gig_result.scalar_one_or_none()

    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    response_query = select(GigResponseModel).where(
        and_(GigResponseModel.id == response_id, GigResponseModel.gig_id == gig_id)
    )
    response_result = await db.execute(response_query)
    response = response_result.scalar_one_or_none()

    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    if response.status != GigResponseStatus.PENDING:
        raise HTTPException(status_code=400, detail="Response is not pending")

    response.status = GigResponseStatus.REJECTED
    await db.commit()

    return {
        "success": True,
        "message": "Response rejected",
        "response_id": str(response_id),
        "status": response.status.value,
        "transaction_id": None,
    }


# Mark gig as complete
@router.post("/{gig_id}/complete", response_model=GigCompleteResult)
async def complete_gig(
    gig_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark gig as complete (both parties must confirm)."""
    # Get gig and transaction
    gig_query = select(Gig).where(Gig.id == gig_id)
    gig_result = await db.execute(gig_query)
    gig = gig_result.scalar_one_or_none()

    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig.status != GigStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Gig is not in progress")

    transaction_query = select(GigTransaction).where(GigTransaction.gig_id == gig_id)
    transaction_result = await db.execute(transaction_query)
    transaction = transaction_result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Check if user is provider or client
    is_provider = transaction.provider_id == current_user.id
    is_client = transaction.client_id == current_user.id

    if not is_provider and not is_client:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Set confirmation
    if is_provider:
        transaction.provider_confirmed = True
    if is_client:
        transaction.client_confirmed = True

    # Check if both confirmed
    both_confirmed = transaction.provider_confirmed and transaction.client_confirmed

    if both_confirmed:
        transaction.status = GigTransactionStatus.COMPLETED
        transaction.completed_at = datetime.now(timezone.utc)
        gig.status = GigStatus.COMPLETED

        # Update provider stats
        if transaction.provider_id:
            provider_query = select(User).where(User.id == transaction.provider_id)
            provider_result = await db.execute(provider_query)
            provider = provider_result.scalar_one_or_none()
            if provider:
                provider.gigs_completed += 1
                provider.total_earned += transaction.amount

    await db.commit()

    return {
        "success": True,
        "message": "Completion confirmed" if not both_confirmed else "Gig completed",
        "transaction_id": str(transaction.id),
        "both_confirmed": both_confirmed,
        "status": transaction.status.value,
    }


# Rate transaction
@router.post("/transactions/{transaction_id}/rate", response_model=GigRatingResponse)
async def rate_transaction(
    transaction_id: uuid.UUID,
    data: GigRatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rate a completed transaction."""
    # Get transaction
    query = select(GigTransaction).where(GigTransaction.id == transaction_id)
    result = await db.execute(query)
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if transaction.status != GigTransactionStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Transaction is not completed")

    # Determine rater and ratee
    is_provider = transaction.provider_id == current_user.id
    is_client = transaction.client_id == current_user.id

    if not is_provider and not is_client:
        raise HTTPException(status_code=403, detail="Not authorized")

    ratee_id = transaction.client_id if is_provider else transaction.provider_id

    if not ratee_id:
        raise HTTPException(status_code=400, detail="Cannot determine ratee")

    # Check if already rated
    existing = await db.execute(
        select(GigRating).where(
            and_(
                GigRating.transaction_id == transaction_id,
                GigRating.rater_id == current_user.id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already rated this transaction")

    # Create rating
    rating = GigRating(
        transaction_id=transaction_id,
        rater_id=current_user.id,
        ratee_id=ratee_id,
        rating=data.rating,
        reliability=data.reliability,
        communication=data.communication,
        quality=data.quality,
        review_text=data.review_text,
    )

    db.add(rating)

    # Update ratee's average rating
    ratee_query = select(User).where(User.id == ratee_id)
    ratee_result = await db.execute(ratee_query)
    ratee = ratee_result.scalar_one_or_none()

    if ratee:
        # Calculate new average
        ratings_query = select(func.avg(GigRating.rating)).where(GigRating.ratee_id == ratee_id)
        avg_result = await db.execute(ratings_query)
        new_avg = avg_result.scalar() or 0
        ratee.gig_rating_avg = Decimal(str(round(new_avg, 2)))

    await db.commit()
    await db.refresh(rating, ["rater"])

    return {
        "id": str(rating.id),
        "transaction_id": str(rating.transaction_id),
        "rater_id": str(rating.rater_id),
        "ratee_id": str(rating.ratee_id),
        "rating": rating.rating,
        "reliability": rating.reliability,
        "communication": rating.communication,
        "quality": rating.quality,
        "review_text": rating.review_text,
        "created_at": rating.created_at,
        "rater": _user_to_minimal(rating.rater),
    }


# Get my gigs
@router.get("/my-gigs", response_model=None)
async def get_my_gigs(
    type: Literal["posted", "responded", "all"] = "all",
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's gigs (posted or responded to)."""
    offset = (page - 1) * per_page
    result = {}

    if type in ("posted", "all"):
        posted_query = (
            select(Gig)
            .options(selectinload(Gig.poster))
            .where(Gig.poster_id == current_user.id)
            .order_by(Gig.created_at.desc())
            .offset(offset)
            .limit(per_page)
        )
        posted_result = await db.execute(posted_query)
        posted_gigs = posted_result.scalars().all()
        result["posted"] = [_gig_to_response(g) for g in posted_gigs]

    if type in ("responded", "all"):
        responded_query = (
            select(GigResponseModel)
            .options(selectinload(GigResponseModel.responder), selectinload(GigResponseModel.gig))
            .where(GigResponseModel.responder_id == current_user.id)
            .order_by(GigResponseModel.created_at.desc())
            .offset(offset)
            .limit(per_page)
        )
        responded_result = await db.execute(responded_query)
        responses = responded_result.scalars().all()
        result["responded"] = [
            {
                "id": str(r.id),
                "gig_id": str(r.gig_id),
                "responder_id": str(r.responder_id),
                "message": r.message,
                "proposed_price": float(r.proposed_price) if r.proposed_price else None,
                "status": r.status.value,
                "created_at": r.created_at,
                "responder": _user_to_info(r.responder),
            }
            for r in responses
        ]

    return result


# Get user gig profile
@router.get("/users/{user_id}/profile", response_model=GigProfileResponse)
async def get_user_gig_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a user's gig profile (rating, completed gigs, etc.)."""
    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get recent ratings
    ratings_query = (
        select(GigRating)
        .options(selectinload(GigRating.rater))
        .where(GigRating.ratee_id == user_id)
        .order_by(GigRating.created_at.desc())
        .limit(5)
    )
    ratings_result = await db.execute(ratings_query)
    ratings = ratings_result.scalars().all()

    # Count active offerings and requests
    offerings_count = await db.execute(
        select(func.count()).select_from(Gig).where(
            and_(
                Gig.poster_id == user_id,
                Gig.gig_type == GigType.OFFERING,
                Gig.status == GigStatus.ACTIVE,
            )
        )
    )
    requests_count = await db.execute(
        select(func.count()).select_from(Gig).where(
            and_(
                Gig.poster_id == user_id,
                Gig.gig_type == GigType.NEED_HELP,
                Gig.status == GigStatus.ACTIVE,
            )
        )
    )

    return {
        "user_id": str(user.id),
        "gig_rating_avg": float(user.gig_rating_avg),
        "gigs_completed": user.gigs_completed,
        "total_earned": float(user.total_earned),
        "recent_ratings": [
            {
                "id": str(r.id),
                "transaction_id": str(r.transaction_id),
                "rater_id": str(r.rater_id),
                "ratee_id": str(r.ratee_id),
                "rating": r.rating,
                "reliability": r.reliability,
                "communication": r.communication,
                "quality": r.quality,
                "review_text": r.review_text,
                "created_at": r.created_at,
                "rater": _user_to_minimal(r.rater),
            }
            for r in ratings
        ],
        "active_offerings": offerings_count.scalar() or 0,
        "active_requests": requests_count.scalar() or 0,
    }


# Get my transactions
@router.get("/transactions", response_model=GigTransactionListResponse)
async def get_my_transactions(
    status: Literal["pending", "completed", "disputed"] | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's transactions."""
    query = (
        select(GigTransaction)
        .options(
            selectinload(GigTransaction.gig).selectinload(Gig.poster),
            selectinload(GigTransaction.provider),
            selectinload(GigTransaction.client),
        )
        .where(
            or_(
                GigTransaction.provider_id == current_user.id,
                GigTransaction.client_id == current_user.id,
            )
        )
    )

    if status:
        query = query.where(GigTransaction.status == GigTransactionStatus(status))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    offset = (page - 1) * per_page
    query = query.order_by(GigTransaction.created_at.desc()).offset(offset).limit(per_page)

    result = await db.execute(query)
    transactions = result.scalars().all()

    return {
        "items": [
            {
                "id": str(t.id),
                "gig_id": str(t.gig_id) if t.gig_id else None,
                "response_id": str(t.response_id) if t.response_id else None,
                "provider_id": str(t.provider_id) if t.provider_id else None,
                "client_id": str(t.client_id) if t.client_id else None,
                "amount": float(t.amount),
                "payment_method": t.payment_method,
                "status": t.status.value,
                "provider_confirmed": t.provider_confirmed,
                "client_confirmed": t.client_confirmed,
                "completed_at": t.completed_at,
                "created_at": t.created_at,
                "gig": _gig_to_response(t.gig) if t.gig else None,
                "provider": _user_to_minimal(t.provider) if t.provider else None,
                "client": _user_to_minimal(t.client) if t.client else None,
            }
            for t in transactions
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": offset + len(transactions) < total,
    }
