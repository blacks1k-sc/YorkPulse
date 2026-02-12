"""Transaction API routes."""

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, VerifiedUser
from app.models.marketplace import ListingStatus, MarketplaceListing
from app.models.transaction import MarketplaceTransaction
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionListResponse,
    TransactionResponse,
)
from app.schemas.user import UserMinimal

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _transaction_to_response(txn: MarketplaceTransaction) -> TransactionResponse:
    """Convert transaction model to response."""
    return TransactionResponse(
        id=str(txn.id),
        listing_id=str(txn.listing_id),
        listing_title=txn.listing.title,
        seller=UserMinimal(
            id=str(txn.seller.id),
            name=txn.seller.name,
            avatar_url=txn.seller.avatar_url,
        ),
        buyer=UserMinimal(
            id=str(txn.buyer.id),
            name=txn.buyer.name,
            avatar_url=txn.buyer.avatar_url,
        ),
        final_price=txn.final_price,
        seller_confirmed=txn.seller_confirmed,
        buyer_confirmed=txn.buyer_confirmed,
        completed_at=txn.completed_at,
        created_at=txn.created_at,
    )


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    request: TransactionCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a transaction (seller initiates)."""
    # Validate listing ID
    try:
        listing_uuid = uuid.UUID(request.listing_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid listing ID format")

    # Validate buyer ID
    try:
        buyer_uuid = uuid.UUID(request.buyer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid buyer ID format")

    # Check buyer is not the seller
    if buyer_uuid == user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot create transaction with yourself",
        )

    # Get the listing
    result = await db.execute(
        select(MarketplaceListing)
        .options(selectinload(MarketplaceListing.seller))
        .where(MarketplaceListing.id == listing_uuid)
    )
    listing = result.scalar_one_or_none()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Check user is the seller
    if listing.user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the seller can initiate a transaction",
        )

    # Check listing is active
    if listing.status != ListingStatus.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail="Listing is not available for transaction",
        )

    # Check no existing transaction
    existing = await db.execute(
        select(MarketplaceTransaction).where(
            MarketplaceTransaction.listing_id == listing_uuid
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Transaction already exists for this listing",
        )

    # Verify buyer exists
    buyer_result = await db.execute(select(User).where(User.id == buyer_uuid))
    buyer = buyer_result.scalar_one_or_none()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")

    # Create transaction
    transaction = MarketplaceTransaction(
        id=uuid.uuid4(),
        listing_id=listing_uuid,
        seller_id=user.id,
        buyer_id=buyer_uuid,
        final_price=request.final_price,
        seller_confirmed=True,  # Seller confirms by creating
    )

    # Update listing status to reserved
    listing.status = ListingStatus.RESERVED

    db.add(transaction)
    await db.commit()

    # Refresh with relationships
    result = await db.execute(
        select(MarketplaceTransaction)
        .options(
            selectinload(MarketplaceTransaction.listing),
            selectinload(MarketplaceTransaction.seller),
            selectinload(MarketplaceTransaction.buyer),
        )
        .where(MarketplaceTransaction.id == transaction.id)
    )
    transaction = result.scalar_one()

    return _transaction_to_response(transaction)


@router.get("/my", response_model=TransactionListResponse)
async def get_my_transactions(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    role: str | None = None,  # "seller", "buyer", or None for both
    completed: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """Get current user's transactions."""
    query = (
        select(MarketplaceTransaction)
        .options(
            selectinload(MarketplaceTransaction.listing),
            selectinload(MarketplaceTransaction.seller),
            selectinload(MarketplaceTransaction.buyer),
        )
    )

    # Filter by role
    if role == "seller":
        query = query.where(MarketplaceTransaction.seller_id == user.id)
    elif role == "buyer":
        query = query.where(MarketplaceTransaction.buyer_id == user.id)
    else:
        query = query.where(
            or_(
                MarketplaceTransaction.seller_id == user.id,
                MarketplaceTransaction.buyer_id == user.id,
            )
        )

    # Filter by completion status
    if completed is True:
        query = query.where(MarketplaceTransaction.completed_at.isnot(None))
    elif completed is False:
        query = query.where(MarketplaceTransaction.completed_at.is_(None))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(MarketplaceTransaction.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    transactions = result.scalars().all()

    return TransactionListResponse(
        items=[_transaction_to_response(t) for t in transactions],
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total,
    )


@router.post("/{transaction_id}/confirm", response_model=TransactionResponse)
async def confirm_transaction(
    transaction_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Confirm a transaction (buyer or seller)."""
    # Validate transaction ID
    try:
        txn_uuid = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction ID format")

    # Get transaction
    result = await db.execute(
        select(MarketplaceTransaction)
        .options(
            selectinload(MarketplaceTransaction.listing),
            selectinload(MarketplaceTransaction.seller),
            selectinload(MarketplaceTransaction.buyer),
        )
        .where(MarketplaceTransaction.id == txn_uuid)
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Check user is involved
    is_seller = transaction.seller_id == user.id
    is_buyer = transaction.buyer_id == user.id

    if not is_seller and not is_buyer:
        raise HTTPException(
            status_code=403,
            detail="You are not part of this transaction",
        )

    # Already completed?
    if transaction.completed_at:
        raise HTTPException(
            status_code=400,
            detail="Transaction already completed",
        )

    # Confirm based on role
    if is_seller:
        if transaction.seller_confirmed:
            raise HTTPException(
                status_code=400,
                detail="Seller has already confirmed",
            )
        transaction.seller_confirmed = True
    else:
        if transaction.buyer_confirmed:
            raise HTTPException(
                status_code=400,
                detail="Buyer has already confirmed",
            )
        transaction.buyer_confirmed = True

    # Check if both confirmed - complete transaction
    if transaction.seller_confirmed and transaction.buyer_confirmed:
        transaction.completed_at = datetime.now(timezone.utc)

        # Update listing status to SOLD
        transaction.listing.status = ListingStatus.SOLD

        # Increment completed_transactions for both users
        seller = await db.get(User, transaction.seller_id)
        buyer = await db.get(User, transaction.buyer_id)
        if seller:
            seller.completed_transactions += 1
        if buyer:
            buyer.completed_transactions += 1

    await db.commit()

    # Refresh
    result = await db.execute(
        select(MarketplaceTransaction)
        .options(
            selectinload(MarketplaceTransaction.listing),
            selectinload(MarketplaceTransaction.seller),
            selectinload(MarketplaceTransaction.buyer),
        )
        .where(MarketplaceTransaction.id == txn_uuid)
    )
    transaction = result.scalar_one()

    return _transaction_to_response(transaction)


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a specific transaction."""
    # Validate transaction ID
    try:
        txn_uuid = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction ID format")

    # Get transaction
    result = await db.execute(
        select(MarketplaceTransaction)
        .options(
            selectinload(MarketplaceTransaction.listing),
            selectinload(MarketplaceTransaction.seller),
            selectinload(MarketplaceTransaction.buyer),
        )
        .where(MarketplaceTransaction.id == txn_uuid)
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Check user is involved
    if transaction.seller_id != user.id and transaction.buyer_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not part of this transaction",
        )

    return _transaction_to_response(transaction)
