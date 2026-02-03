"""Quest cleanup service for auto-expiring and deleting old quests."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.buddy import BuddyRequest, BuddyRequestStatus


async def expire_past_quests(db: AsyncSession) -> int:
    """
    Mark quests as completed if their end_time has passed.
    Returns the number of quests expired.
    """
    now = datetime.now(timezone.utc)

    # Find all open/in_progress quests that have passed their end_time
    result = await db.execute(
        update(BuddyRequest)
        .where(
            BuddyRequest.status.in_([BuddyRequestStatus.OPEN, BuddyRequestStatus.IN_PROGRESS, BuddyRequestStatus.FULL]),
            BuddyRequest.end_time <= now,
        )
        .values(status=BuddyRequestStatus.COMPLETED)
        .returning(BuddyRequest.id)
    )

    expired_ids = result.fetchall()
    await db.commit()

    return len(expired_ids)


async def get_quests_to_delete(db: AsyncSession, days_after_completion: int = 7) -> list[dict]:
    """
    Get quests that should be deleted (completed for more than X days).
    Returns list of quest info for notification purposes.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_after_completion)

    result = await db.execute(
        select(BuddyRequest)
        .options(selectinload(BuddyRequest.host))
        .where(
            BuddyRequest.status.in_([BuddyRequestStatus.COMPLETED, BuddyRequestStatus.CANCELLED]),
            BuddyRequest.updated_at <= cutoff_date,
        )
    )

    quests = result.scalars().all()

    return [
        {
            "id": str(quest.id),
            "activity": quest.activity,
            "host_id": str(quest.user_id),
            "host_name": quest.host.name if quest.host else "Unknown",
            "host_email": quest.host.email if quest.host else None,
        }
        for quest in quests
    ]


async def delete_old_quests(db: AsyncSession, days_after_completion: int = 7) -> int:
    """
    Delete quests that have been completed/cancelled for more than X days.
    Returns the number of quests deleted.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_after_completion)

    result = await db.execute(
        delete(BuddyRequest)
        .where(
            BuddyRequest.status.in_([BuddyRequestStatus.COMPLETED, BuddyRequestStatus.CANCELLED]),
            BuddyRequest.updated_at <= cutoff_date,
        )
        .returning(BuddyRequest.id)
    )

    deleted_ids = result.fetchall()
    await db.commit()

    return len(deleted_ids)


async def cleanup_quests(db: AsyncSession) -> dict:
    """
    Run full cleanup: expire past quests and delete old completed ones.
    Returns summary of actions taken.
    """
    # First, expire any quests that have passed their end_time
    expired_count = await expire_past_quests(db)

    # Then, delete quests that have been completed for more than 7 days
    deleted_count = await delete_old_quests(db, days_after_completion=7)

    return {
        "expired": expired_count,
        "deleted": deleted_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
