"""Dashboard API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.course import Course
from app.models.marketplace import MarketplaceListing, ListingStatus
from app.models.buddy import BuddyRequest, BuddyRequestStatus
from app.models.vault import VaultPost, VaultPostStatus
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class DashboardStats(BaseModel):
    """Dashboard statistics response."""

    marketplace_listings: int
    side_quests_active: int
    total_courses: int
    vault_posts_today: int
    total_users: int


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get dashboard statistics for the home page."""
    from datetime import datetime, timezone, timedelta

    # Active marketplace listings
    marketplace_result = await db.execute(
        select(func.count())
        .select_from(MarketplaceListing)
        .where(MarketplaceListing.status == ListingStatus.ACTIVE)
    )
    marketplace_count = marketplace_result.scalar() or 0

    # Active side quests (open or in progress)
    quests_result = await db.execute(
        select(func.count())
        .select_from(BuddyRequest)
        .where(
            BuddyRequest.status.in_([
                BuddyRequestStatus.OPEN,
                BuddyRequestStatus.IN_PROGRESS,
            ])
        )
    )
    quests_count = quests_result.scalar() or 0

    # Total courses
    courses_result = await db.execute(
        select(func.count()).select_from(Course)
    )
    courses_count = courses_result.scalar() or 0

    # Vault posts in last 24 hours
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    vault_result = await db.execute(
        select(func.count())
        .select_from(VaultPost)
        .where(VaultPost.created_at >= yesterday)
        .where(VaultPost.status == VaultPostStatus.ACTIVE)
    )
    vault_today = vault_result.scalar() or 0

    # Total active users
    users_result = await db.execute(
        select(func.count())
        .select_from(User)
        .where(User.is_active == True)
        .where(User.email_verified == True)
    )
    users_count = users_result.scalar() or 0

    return DashboardStats(
        marketplace_listings=marketplace_count,
        side_quests_active=quests_count,
        total_courses=courses_count,
        vault_posts_today=vault_today,
        total_users=users_count,
    )
