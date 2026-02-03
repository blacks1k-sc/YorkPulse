"""Marketplace API routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from app.schemas.marketplace import (
    ImageUploadRequest,
    ImageUploadResponse,
    ListingCreate,
    ListingListResponse,
    ListingResponse,
    ListingUpdate,
)
from app.schemas.user import UserMinimal
from app.services.s3 import s3_service

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
