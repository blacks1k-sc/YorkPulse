"""Side Quests (buddy matching) API routes."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, VerifiedUser
from app.models.buddy import (
    BuddyCategory,
    BuddyParticipant,
    BuddyRequest,
    BuddyRequestStatus,
    ParticipantStatus,
    VibeLevel,
)
from app.schemas.buddy import (
    BuddyRequestCreate,
    BuddyRequestListResponse,
    BuddyRequestResponse,
    BuddyRequestUpdate,
    JoinRequestCreate,
    ParticipantAction,
    ParticipantListResponse,
    ParticipantResponse,
)
from app.schemas.user import UserMinimal

router = APIRouter(prefix="/quests", tags=["Side Quests"])


def _request_to_response(request: BuddyRequest) -> BuddyRequestResponse:
    """Convert buddy request model to response."""
    return BuddyRequestResponse(
        id=str(request.id),
        category=request.category,
        custom_category=request.custom_category,
        activity=request.activity,
        description=request.description,
        start_time=request.start_time,
        end_time=request.end_time,
        location=request.location,
        latitude=request.latitude,
        longitude=request.longitude,
        vibe_level=request.vibe_level,
        max_participants=request.max_participants,
        current_participants=request.current_participants,
        requires_approval=request.requires_approval,
        status=request.status,
        host=UserMinimal(
            id=str(request.host.id),
            name=request.host.name,
            avatar_url=request.host.avatar_url,
        ),
        created_at=request.created_at,
    )


def _participant_to_response(participant: BuddyParticipant) -> ParticipantResponse:
    """Convert participant model to response."""
    return ParticipantResponse(
        id=str(participant.id),
        user=UserMinimal(
            id=str(participant.user.id),
            name=participant.user.name,
            avatar_url=participant.user.avatar_url,
        ),
        status=participant.status,
        message=participant.message,
        created_at=participant.created_at,
    )


@router.get("", response_model=BuddyRequestListResponse)
async def list_quests(
    db: Annotated[AsyncSession, Depends(get_db)],
    category: BuddyCategory | None = None,
    status: BuddyRequestStatus | None = None,
    vibe_level: VibeLevel | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: Annotated[str, Query(pattern=r"^(newest|starting_soon|most_spots)$")] = "starting_soon",
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """List side quests with filters and sorting."""
    now = datetime.now(timezone.utc)

    query = (
        select(BuddyRequest)
        .options(selectinload(BuddyRequest.host))
    )

    # Status filter - default to OPEN if not specified
    if status:
        query = query.where(BuddyRequest.status == status)
    else:
        query = query.where(BuddyRequest.status == BuddyRequestStatus.OPEN)
        query = query.where(BuddyRequest.start_time > now)  # Only future events for open

    if category:
        query = query.where(BuddyRequest.category == category)

    if vibe_level:
        query = query.where(BuddyRequest.vibe_level == vibe_level)

    if date_from:
        query = query.where(BuddyRequest.start_time >= date_from)

    if date_to:
        query = query.where(BuddyRequest.start_time <= date_to)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Sorting options
    if sort_by == "newest":
        query = query.order_by(BuddyRequest.created_at.desc())
    elif sort_by == "starting_soon":
        query = query.order_by(BuddyRequest.start_time.asc())
    elif sort_by == "most_spots":
        # Order by available spots (max - current) descending
        query = query.order_by(
            (BuddyRequest.max_participants - BuddyRequest.current_participants).desc()
        )

    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    requests = result.scalars().all()

    return BuddyRequestListResponse(
        items=[_request_to_response(r) for r in requests],
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total,
    )


@router.post("", response_model=BuddyRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_quest(
    request: BuddyRequestCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new side quest."""
    # Set default end_time to 1 week from start_time if not provided
    end_time = request.end_time
    if end_time is None:
        end_time = request.start_time + timedelta(weeks=1)

    buddy_request = BuddyRequest(
        id=uuid.uuid4(),
        user_id=user.id,
        category=request.category,
        custom_category=request.custom_category,
        activity=request.activity,
        description=request.description,
        start_time=request.start_time,
        end_time=end_time,
        location=request.location,
        latitude=request.latitude,
        longitude=request.longitude,
        vibe_level=request.vibe_level,
        max_participants=request.max_participants,
        requires_approval=request.requires_approval,
        current_participants=1,  # Host counts as 1
    )

    db.add(buddy_request)
    await db.commit()
    await db.refresh(buddy_request, ["host"])

    return _request_to_response(buddy_request)


@router.get("/my-quests", response_model=BuddyRequestListResponse)
async def get_my_quests(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    role: Annotated[str, Query(pattern=r"^(host|participant|pending|all)$")] = "all",
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """Get quests I'm hosting or participating in."""
    if role == "host":
        query = (
            select(BuddyRequest)
            .options(selectinload(BuddyRequest.host))
            .where(BuddyRequest.user_id == user.id)
        )
    elif role == "participant":
        # Get quests where user is an accepted participant
        query = (
            select(BuddyRequest)
            .options(selectinload(BuddyRequest.host))
            .join(BuddyParticipant)
            .where(BuddyParticipant.user_id == user.id)
            .where(BuddyParticipant.status == ParticipantStatus.ACCEPTED)
        )
    elif role == "pending":
        # Get quests where user has a pending request
        query = (
            select(BuddyRequest)
            .options(selectinload(BuddyRequest.host))
            .join(BuddyParticipant)
            .where(BuddyParticipant.user_id == user.id)
            .where(BuddyParticipant.status == ParticipantStatus.PENDING)
        )
    else:
        # Both
        query = (
            select(BuddyRequest)
            .options(selectinload(BuddyRequest.host))
            .outerjoin(BuddyParticipant)
            .where(
                or_(
                    BuddyRequest.user_id == user.id,
                    and_(
                        BuddyParticipant.user_id == user.id,
                        BuddyParticipant.status == ParticipantStatus.ACCEPTED,
                    ),
                )
            )
        )

    query = query.where(BuddyRequest.status != BuddyRequestStatus.CANCELLED)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(BuddyRequest.start_time.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    requests = result.scalars().unique().all()

    return BuddyRequestListResponse(
        items=[_request_to_response(r) for r in requests],
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total,
    )


@router.get("/{quest_id}", response_model=BuddyRequestResponse)
async def get_quest(
    quest_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a single quest."""
    result = await db.execute(
        select(BuddyRequest)
        .options(selectinload(BuddyRequest.host))
        .where(BuddyRequest.id == quest_id)
    )
    quest = result.scalar_one_or_none()

    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    return _request_to_response(quest)


@router.patch("/{quest_id}", response_model=BuddyRequestResponse)
async def update_quest(
    quest_id: str,
    request: BuddyRequestUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a quest (host only)."""
    result = await db.execute(
        select(BuddyRequest)
        .options(selectinload(BuddyRequest.host))
        .where(BuddyRequest.id == quest_id)
    )
    quest = result.scalar_one_or_none()

    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    if str(quest.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if request.activity is not None:
        quest.activity = request.activity
    if request.description is not None:
        quest.description = request.description
    if request.start_time is not None:
        quest.start_time = request.start_time
    if request.end_time is not None:
        quest.end_time = request.end_time
    if request.location is not None:
        quest.location = request.location
    if request.latitude is not None:
        quest.latitude = request.latitude
    if request.longitude is not None:
        quest.longitude = request.longitude
    if request.vibe_level is not None:
        quest.vibe_level = request.vibe_level
    if request.max_participants is not None:
        quest.max_participants = request.max_participants
    if request.requires_approval is not None:
        quest.requires_approval = request.requires_approval
    if request.status is not None:
        quest.status = request.status

    await db.commit()
    await db.refresh(quest)

    return _request_to_response(quest)


@router.delete("/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_quest(
    quest_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Cancel a quest (host only)."""
    result = await db.execute(
        select(BuddyRequest).where(BuddyRequest.id == quest_id)
    )
    quest = result.scalar_one_or_none()

    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    if str(quest.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    quest.status = BuddyRequestStatus.CANCELLED
    await db.commit()


# Participants

@router.post("/{quest_id}/join", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def join_quest(
    quest_id: str,
    request: JoinRequestCreate,
    user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Request to join a quest."""
    result = await db.execute(
        select(BuddyRequest).where(BuddyRequest.id == quest_id)
    )
    quest = result.scalar_one_or_none()

    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    if quest.status != BuddyRequestStatus.OPEN:
        raise HTTPException(status_code=400, detail="Quest is not open")

    if str(quest.user_id) == str(user.id):
        raise HTTPException(status_code=400, detail="Cannot join your own quest")

    # Check if already participating
    existing = await db.execute(
        select(BuddyParticipant)
        .options(selectinload(BuddyParticipant.user))
        .where(BuddyParticipant.buddy_request_id == quest.id)
        .where(BuddyParticipant.user_id == user.id)
    )
    existing_participant = existing.scalar_one_or_none()

    # If participant exists but was cancelled, allow rejoining
    if existing_participant:
        if existing_participant.status == ParticipantStatus.CANCELLED:
            # Reactivate the cancelled participant
            # Check capacity first
            if quest.current_participants >= quest.max_participants:
                raise HTTPException(status_code=400, detail="Quest is full")

            # Determine new status based on approval setting
            new_status = ParticipantStatus.PENDING if quest.requires_approval else ParticipantStatus.ACCEPTED
            existing_participant.status = new_status
            existing_participant.message = request.message

            # If auto-accept, update participant count
            if not quest.requires_approval:
                quest.current_participants += 1
                if quest.current_participants >= quest.max_participants:
                    quest.status = BuddyRequestStatus.FULL

            await db.commit()
            await db.refresh(existing_participant, ["user"])
            return _participant_to_response(existing_participant)
        else:
            raise HTTPException(status_code=400, detail="Already requested to join")

    # Check capacity
    if quest.current_participants >= quest.max_participants:
        raise HTTPException(status_code=400, detail="Quest is full")

    # Determine status based on approval setting
    initial_status = ParticipantStatus.PENDING if quest.requires_approval else ParticipantStatus.ACCEPTED

    participant = BuddyParticipant(
        id=uuid.uuid4(),
        buddy_request_id=quest.id,
        user_id=user.id,
        status=initial_status,
        message=request.message,
    )

    db.add(participant)

    # If auto-accept, update participant count
    if not quest.requires_approval:
        quest.current_participants += 1
        if quest.current_participants >= quest.max_participants:
            quest.status = BuddyRequestStatus.FULL

    await db.commit()
    await db.refresh(participant, ["user"])

    return _participant_to_response(participant)


@router.get("/{quest_id}/participants", response_model=ParticipantListResponse)
async def list_participants(
    quest_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List participants (host sees all, others see only accepted)."""
    result = await db.execute(
        select(BuddyRequest).where(BuddyRequest.id == quest_id)
    )
    quest = result.scalar_one_or_none()

    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    is_host = str(quest.user_id) == str(user.id)

    query = (
        select(BuddyParticipant)
        .options(selectinload(BuddyParticipant.user))
        .where(BuddyParticipant.buddy_request_id == quest.id)
    )

    # Non-hosts only see accepted participants
    if not is_host:
        query = query.where(BuddyParticipant.status == ParticipantStatus.ACCEPTED)

    result = await db.execute(query.order_by(BuddyParticipant.created_at.asc()))
    participants = result.scalars().all()

    return ParticipantListResponse(
        items=[_participant_to_response(p) for p in participants],
        total=len(participants),
    )


@router.post("/{quest_id}/participants/{participant_id}", response_model=ParticipantResponse)
async def manage_participant(
    quest_id: str,
    participant_id: str,
    action: ParticipantAction,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Accept or reject a participant (host only)."""
    result = await db.execute(
        select(BuddyRequest).where(BuddyRequest.id == quest_id)
    )
    quest = result.scalar_one_or_none()

    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    if str(quest.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    participant_result = await db.execute(
        select(BuddyParticipant)
        .options(selectinload(BuddyParticipant.user))
        .where(BuddyParticipant.id == participant_id)
        .where(BuddyParticipant.buddy_request_id == quest.id)
    )
    participant = participant_result.scalar_one_or_none()

    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    if participant.status != ParticipantStatus.PENDING:
        raise HTTPException(status_code=400, detail="Participant already processed")

    if action.action == "accept":
        # Check capacity
        if quest.current_participants >= quest.max_participants:
            raise HTTPException(status_code=400, detail="Quest is full")

        participant.status = ParticipantStatus.ACCEPTED
        quest.current_participants += 1

        if quest.current_participants >= quest.max_participants:
            quest.status = BuddyRequestStatus.FULL
    else:
        participant.status = ParticipantStatus.REJECTED

    await db.commit()
    await db.refresh(participant)

    return _participant_to_response(participant)


@router.delete("/{quest_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_quest(
    quest_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Leave a quest (participant only)."""
    result = await db.execute(
        select(BuddyParticipant)
        .where(BuddyParticipant.buddy_request_id == quest_id)
        .where(BuddyParticipant.user_id == user.id)
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise HTTPException(status_code=404, detail="Not a participant")

    # Update quest count if was accepted
    if participant.status == ParticipantStatus.ACCEPTED:
        quest_result = await db.execute(
            select(BuddyRequest).where(BuddyRequest.id == quest_id)
        )
        quest = quest_result.scalar_one_or_none()
        if quest:
            quest.current_participants = max(1, quest.current_participants - 1)
            if quest.status == BuddyRequestStatus.FULL:
                quest.status = BuddyRequestStatus.OPEN

    participant.status = ParticipantStatus.CANCELLED
    await db.commit()


@router.post("/{quest_id}/complete", response_model=BuddyRequestResponse)
async def complete_quest(
    quest_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark a quest as completed (host only)."""
    result = await db.execute(
        select(BuddyRequest)
        .options(selectinload(BuddyRequest.host))
        .where(BuddyRequest.id == quest_id)
    )
    quest = result.scalar_one_or_none()

    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    if str(quest.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if quest.status == BuddyRequestStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot complete a cancelled quest")

    if quest.status == BuddyRequestStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Quest is already completed")

    quest.status = BuddyRequestStatus.COMPLETED
    await db.commit()
    await db.refresh(quest)

    return _request_to_response(quest)


@router.delete("/{quest_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participant(
    quest_id: str,
    user_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Remove a participant from a quest (host only)."""
    result = await db.execute(
        select(BuddyRequest).where(BuddyRequest.id == quest_id)
    )
    quest = result.scalar_one_or_none()

    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    if str(quest.user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    participant_result = await db.execute(
        select(BuddyParticipant)
        .where(BuddyParticipant.buddy_request_id == quest.id)
        .where(BuddyParticipant.user_id == user_id)
    )
    participant = participant_result.scalar_one_or_none()

    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    # Update quest count if was accepted
    if participant.status == ParticipantStatus.ACCEPTED:
        quest.current_participants = max(1, quest.current_participants - 1)
        if quest.status == BuddyRequestStatus.FULL:
            quest.status = BuddyRequestStatus.OPEN

    # Delete the participant record
    await db.delete(participant)
    await db.commit()


# Cleanup endpoints (for cron jobs / scheduled tasks)

@router.post("/admin/cleanup", include_in_schema=False)
async def run_quest_cleanup(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Run quest cleanup: expire past quests and delete old completed ones.
    This endpoint should be called by a cron job or scheduled task.
    """
    from app.services.quest_cleanup import cleanup_quests

    result = await cleanup_quests(db)
    return result


@router.post("/admin/expire", include_in_schema=False)
async def expire_quests(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Manually trigger quest expiration."""
    from app.services.quest_cleanup import expire_past_quests

    count = await expire_past_quests(db)
    return {"expired": count}
