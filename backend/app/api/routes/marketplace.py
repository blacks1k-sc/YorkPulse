"""Marketplace API routes."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, CurrentUserOptional, VerifiedUser
from app.models.marketplace import (
    ListingCondition,
    ListingStatus,
    MarketplaceCategory,
    MarketplaceListing,
)
from app.models.marketplace_review import MarketplaceReview
from app.models.transaction import MarketplaceTransaction
from app.models.user import User
from app.schemas.marketplace import (
    ImageUploadRequest,
    ImageUploadResponse,
    ListingCreate,
    ListingListResponse,
    ListingResponse,
    ListingUpdate,
)
from app.schemas.marketplace_review import (
    MarketplaceReputationResponse,
    MarketplaceReviewCreate,
    MarketplaceReviewResponse,
    PendingReviewResponse,
    PendingReviewsListResponse,
)
from app.schemas.user import UserMinimal
from app.services.s3 import s3_service

# Review window in days
REVIEW_WINDOW_DAYS = 7
# Grace period - reviews hidden until this many completed transactions
GRACE_PERIOD_TRANSACTIONS = 3

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


def _listing_to_response(listing: MarketplaceListing) -> ListingResponse:
    """Convert listing model to response."""
    return ListingResponse(
        id=str(listing.id),
        title=listing.title,
        description=listing.description,
        price=listing.price,
        is_negotiable=listing.is_negotiable,
        category=listing.category,
        condition=listing.condition,
        course_codes=listing.course_codes,
        images=listing.images,
        status=listing.status,
        preferred_meetup_location=listing.preferred_meetup_location,
        view_count=listing.view_count,
        seller=UserMinimal(
            id=str(listing.seller.id),
            name=listing.seller.name,
            avatar_url=listing.seller.avatar_url,
        ),
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


@router.get("", response_model=ListingListResponse)
async def list_listings(
    db: Annotated[AsyncSession, Depends(get_db)],
    category: MarketplaceCategory | None = None,
    condition: ListingCondition | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    course_code: str | None = None,
    search: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """List marketplace listings with filters."""
    query = (
        select(MarketplaceListing)
        .options(selectinload(MarketplaceListing.seller))
        .where(MarketplaceListing.status == ListingStatus.ACTIVE)
    )

    # Apply filters
    if category:
        query = query.where(MarketplaceListing.category == category)

    if condition:
        query = query.where(MarketplaceListing.condition == condition)

    if min_price is not None:
        query = query.where(MarketplaceListing.price >= min_price)

    if max_price is not None:
        query = query.where(MarketplaceListing.price <= max_price)

    if course_code:
        # Search in course_codes array
        query = query.where(
            MarketplaceListing.course_codes.any(course_code.upper())
        )

    if search:
        # Search in title and description
        search_term = f"%{search}%"
        query = query.where(
            or_(
                MarketplaceListing.title.ilike(search_term),
                MarketplaceListing.description.ilike(search_term),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(MarketplaceListing.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    listings = result.scalars().all()

    return ListingListResponse(
        items=[_listing_to_response(l) for l in listings],
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total,
    )


@router.post("", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(
    request: ListingCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new marketplace listing."""
    listing = MarketplaceListing(
        id=uuid.uuid4(),
        user_id=user.id,
        title=request.title,
        description=request.description,
        price=request.price,
        is_negotiable=request.is_negotiable,
        category=request.category,
        condition=request.condition,
        course_codes=request.course_codes,
        images=request.images,
        preferred_meetup_location=request.preferred_meetup_location,
    )

    db.add(listing)
    await db.commit()
    await db.refresh(listing, ["seller"])

    return _listing_to_response(listing)


@router.get("/my-listings", response_model=ListingListResponse)
async def get_my_listings(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: ListingStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """Get current user's listings."""
    query = (
        select(MarketplaceListing)
        .options(selectinload(MarketplaceListing.seller))
        .where(MarketplaceListing.user_id == user.id)
        .where(MarketplaceListing.status != ListingStatus.DELETED)
    )

    if status_filter:
        query = query.where(MarketplaceListing.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(MarketplaceListing.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    listings = result.scalars().all()

    return ListingListResponse(
        items=[_listing_to_response(l) for l in listings],
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total,
    )


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(
    listing_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUserOptional,
):
    """Get a single listing."""
    # Validate UUID format
    try:
        listing_uuid = uuid.UUID(listing_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid listing ID format")

    result = await db.execute(
        select(MarketplaceListing)
        .options(selectinload(MarketplaceListing.seller))
        .where(MarketplaceListing.id == listing_uuid)
    )
    listing = result.scalar_one_or_none()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.status == ListingStatus.DELETED:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Ensure seller is loaded
    if not listing.seller:
        raise HTTPException(status_code=500, detail="Listing seller data not found")

    # Increment view count (don't count own views)
    if not user or str(user.id) != str(listing.user_id):
        listing.view_count += 1
        await db.commit()

        # Re-query to ensure seller relationship is loaded after commit
        result = await db.execute(
            select(MarketplaceListing)
            .options(selectinload(MarketplaceListing.seller))
            .where(MarketplaceListing.id == listing_uuid)
        )
        listing = result.scalar_one_or_none()

    return _listing_to_response(listing)


@router.patch("/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: str,
    request: ListingUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a listing (seller only)."""
    try:
        listing_uuid = uuid.UUID(listing_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid listing ID format")

    result = await db.execute(
        select(MarketplaceListing)
        .options(selectinload(MarketplaceListing.seller))
        .where(MarketplaceListing.id == listing_uuid)
    )
    listing = result.scalar_one_or_none()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if str(listing.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Update fields
    if request.title is not None:
        listing.title = request.title
    if request.description is not None:
        listing.description = request.description
    if request.price is not None:
        listing.price = request.price
    if request.is_negotiable is not None:
        listing.is_negotiable = request.is_negotiable
    if request.category is not None:
        listing.category = request.category
    if request.condition is not None:
        listing.condition = request.condition
    if request.course_codes is not None:
        listing.course_codes = request.course_codes
    if request.images is not None:
        listing.images = request.images
    if request.preferred_meetup_location is not None:
        listing.preferred_meetup_location = request.preferred_meetup_location
    if request.status is not None:
        listing.status = request.status

    await db.commit()

    # Re-query to ensure seller relationship is loaded after commit
    result = await db.execute(
        select(MarketplaceListing)
        .options(selectinload(MarketplaceListing.seller))
        .where(MarketplaceListing.id == listing_uuid)
    )
    listing = result.scalar_one_or_none()

    return _listing_to_response(listing)


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(
    listing_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a listing (seller only)."""
    try:
        listing_uuid = uuid.UUID(listing_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid listing ID format")

    result = await db.execute(
        select(MarketplaceListing).where(MarketplaceListing.id == listing_uuid)
    )
    listing = result.scalar_one_or_none()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if str(listing.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    listing.status = ListingStatus.DELETED
    await db.commit()


@router.post("/upload-image", response_model=ImageUploadResponse)
async def get_image_upload_url(
    request: ImageUploadRequest,
    user: VerifiedUser,
):
    """Get presigned URL to upload a listing image."""
    try:
        upload_url, file_key = s3_service.generate_upload_url(
            folder="marketplace",
            filename=request.filename,
            content_type=request.content_type,
            expires_in=300,
        )

        # Generate public URL (via CloudFront or S3)
        public_url = f"https://{s3_service.bucket_name}.s3.{s3_service.region}.amazonaws.com/{file_key}"

        return ImageUploadResponse(
            upload_url=upload_url,
            file_key=file_key,
            public_url=public_url,
            expires_in=300,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/upload-image-direct")
async def upload_image_direct(
    user: VerifiedUser,
    file: UploadFile = File(...),
):
    """Upload an image directly through the backend (avoids CORS issues)."""
    # Validate content type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG, PNG, and WebP are allowed.",
        )

    # Validate file size (max 5MB)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB.",
        )

    try:
        # Generate file key
        from datetime import datetime
        import uuid as uuid_module
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        unique_id = str(uuid_module.uuid4())[:8]
        extension = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
        file_key = f"marketplace/{timestamp}/{unique_id}.{extension}"

        # Upload to S3
        s3_service.client.put_object(
            Bucket=s3_service.bucket_name,
            Key=file_key,
            Body=content,
            ContentType=file.content_type,
        )

        # Generate public URL
        public_url = f"https://{s3_service.bucket_name}.s3.{s3_service.region}.amazonaws.com/{file_key}"

        return {"public_url": public_url, "file_key": file_key}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}",
        )


@router.post("/{listing_id}/mark-sold", response_model=ListingResponse)
async def mark_as_sold(
    listing_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark a listing as sold."""
    result = await db.execute(
        select(MarketplaceListing)
        .options(selectinload(MarketplaceListing.seller))
        .where(MarketplaceListing.id == listing_id)
    )
    listing = result.scalar_one_or_none()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if str(listing.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    listing.status = ListingStatus.SOLD
    await db.commit()
    await db.refresh(listing)

    return _listing_to_response(listing)


# =====================
# Marketplace Reviews
# =====================


def _review_to_response(review: MarketplaceReview) -> MarketplaceReviewResponse:
    """Convert marketplace review model to response."""
    return MarketplaceReviewResponse(
        id=str(review.id),
        transaction_id=str(review.transaction_id),
        reviewer=UserMinimal(
            id=str(review.reviewer.id),
            name=review.reviewer.name,
            avatar_url=review.reviewer.avatar_url,
        ),
        reviewee=UserMinimal(
            id=str(review.reviewee.id),
            name=review.reviewee.name,
            avatar_url=review.reviewee.avatar_url,
        ),
        item_accuracy=review.item_accuracy,
        communication=review.communication,
        punctuality=review.punctuality,
        average_rating=review.average_rating,
        text_feedback=review.text_feedback,
        created_at=review.created_at,
    )


@router.post("/reviews", response_model=MarketplaceReviewResponse, status_code=status.HTTP_201_CREATED)
async def submit_marketplace_review(
    request: MarketplaceReviewCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit a marketplace review for a completed transaction."""
    # Validate transaction ID
    try:
        txn_uuid = uuid.UUID(request.transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction ID format")

    # Get transaction
    result = await db.execute(
        select(MarketplaceTransaction)
        .options(
            selectinload(MarketplaceTransaction.seller),
            selectinload(MarketplaceTransaction.buyer),
        )
        .where(MarketplaceTransaction.id == txn_uuid)
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Check user is part of transaction
    is_seller = transaction.seller_id == user.id
    is_buyer = transaction.buyer_id == user.id

    if not is_seller and not is_buyer:
        raise HTTPException(
            status_code=403,
            detail="You are not part of this transaction",
        )

    # Check transaction is completed
    if not transaction.completed_at:
        raise HTTPException(
            status_code=400,
            detail="Cannot review an incomplete transaction",
        )

    # Check 7-day review window
    review_deadline = transaction.completed_at + timedelta(days=REVIEW_WINDOW_DAYS)
    now = datetime.now(timezone.utc)
    if now > review_deadline:
        raise HTTPException(
            status_code=403,
            detail="Review window has expired (7 days after transaction)",
        )

    # Determine reviewee
    reviewee_id = transaction.buyer_id if is_seller else transaction.seller_id

    # Check for existing review
    existing = await db.execute(
        select(MarketplaceReview).where(
            MarketplaceReview.transaction_id == txn_uuid,
            MarketplaceReview.reviewer_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="You have already reviewed this transaction",
        )

    # Create review
    review = MarketplaceReview(
        id=uuid.uuid4(),
        transaction_id=txn_uuid,
        reviewer_id=user.id,
        reviewee_id=reviewee_id,
        item_accuracy=request.item_accuracy,
        communication=request.communication,
        punctuality=request.punctuality,
        text_feedback=request.text_feedback,
    )

    db.add(review)
    await db.commit()

    # Refresh with relationships
    result = await db.execute(
        select(MarketplaceReview)
        .options(
            selectinload(MarketplaceReview.reviewer),
            selectinload(MarketplaceReview.reviewee),
        )
        .where(MarketplaceReview.id == review.id)
    )
    review = result.scalar_one()

    return _review_to_response(review)


@router.get("/reviews/pending", response_model=PendingReviewsListResponse)
async def get_pending_reviews(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get transactions that user can still review."""
    now = datetime.now(timezone.utc)
    review_cutoff = now - timedelta(days=REVIEW_WINDOW_DAYS)

    # Find completed transactions where user hasn't reviewed yet
    query = (
        select(MarketplaceTransaction)
        .options(
            selectinload(MarketplaceTransaction.listing),
            selectinload(MarketplaceTransaction.seller),
            selectinload(MarketplaceTransaction.buyer),
        )
        .where(
            MarketplaceTransaction.completed_at.isnot(None),
            MarketplaceTransaction.completed_at > review_cutoff,
            or_(
                MarketplaceTransaction.seller_id == user.id,
                MarketplaceTransaction.buyer_id == user.id,
            ),
        )
    )

    result = await db.execute(query)
    transactions = result.scalars().all()

    pending = []
    for txn in transactions:
        # Check if user already reviewed this transaction
        existing = await db.execute(
            select(MarketplaceReview).where(
                MarketplaceReview.transaction_id == txn.id,
                MarketplaceReview.reviewer_id == user.id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        # Determine role and other party
        is_seller = txn.seller_id == user.id
        role = "seller" if is_seller else "buyer"
        other_party = txn.buyer if is_seller else txn.seller

        pending.append(
            PendingReviewResponse(
                transaction_id=str(txn.id),
                listing_title=txn.listing.title,
                other_party=UserMinimal(
                    id=str(other_party.id),
                    name=other_party.name,
                    avatar_url=other_party.avatar_url,
                ),
                role=role,
                completed_at=txn.completed_at,
                review_deadline=txn.completed_at + timedelta(days=REVIEW_WINDOW_DAYS),
            )
        )

    return PendingReviewsListResponse(items=pending)


@router.get("/users/{user_id}/reputation", response_model=MarketplaceReputationResponse)
async def get_user_marketplace_reputation(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a user's marketplace reputation."""
    # Validate user ID
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    # Get user
    result = await db.execute(select(User).where(User.id == user_uuid))
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check grace period
    reviews_visible = target_user.completed_transactions >= GRACE_PERIOD_TRANSACTIONS

    # Get all reviews for this user
    result = await db.execute(
        select(MarketplaceReview)
        .options(
            selectinload(MarketplaceReview.reviewer),
            selectinload(MarketplaceReview.reviewee),
        )
        .where(MarketplaceReview.reviewee_id == user_uuid)
        .order_by(MarketplaceReview.created_at.desc())
    )
    reviews = result.scalars().all()

    total_reviews = len(reviews)

    # Calculate averages
    if total_reviews > 0:
        avg_item_accuracy = sum(r.item_accuracy for r in reviews) / total_reviews
        avg_communication = sum(r.communication for r in reviews) / total_reviews
        avg_punctuality = sum(r.punctuality for r in reviews) / total_reviews
        overall_average = (avg_item_accuracy + avg_communication + avg_punctuality) / 3
    else:
        avg_item_accuracy = None
        avg_communication = None
        avg_punctuality = None
        overall_average = None

    # Build response
    review_list = None
    if reviews_visible:
        review_list = [_review_to_response(r) for r in reviews]

    return MarketplaceReputationResponse(
        user_id=user_id,
        avg_item_accuracy=round(avg_item_accuracy, 2) if avg_item_accuracy else None,
        avg_communication=round(avg_communication, 2) if avg_communication else None,
        avg_punctuality=round(avg_punctuality, 2) if avg_punctuality else None,
        overall_average=round(overall_average, 2) if overall_average else None,
        total_reviews=total_reviews,
        reviews_visible=reviews_visible,
        reviews=review_list,
    )
