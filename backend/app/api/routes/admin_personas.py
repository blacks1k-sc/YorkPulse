"""Admin endpoints for persona management — seeding and inbox control."""

import re
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.routes.buddy import _participant_to_response, _request_to_response
from app.api.routes.messaging import _message_to_response
from app.core.database import get_db
from app.core.dependencies import AdminUser
from app.models.buddy import (
    BuddyCategory,
    BuddyParticipant,
    BuddyRequest,
    BuddyRequestStatus,
    ParticipantStatus,
    VibeLevel,
)
from app.models.messaging import Conversation, ConversationStatus, Message
from app.models.user import User
from app.schemas.buddy import BuddyRequestResponse, ParticipantAction, ParticipantResponse

router = APIRouter(prefix="/admin", tags=["Admin — Personas"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class PersonaCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    program: str | None = Field(None, max_length=200)
    bio: str | None = Field(None, max_length=500)


class PersonaResponse(BaseModel):
    id: str
    name: str
    email: str
    program: str | None
    bio: str | None
    avatar_url: str | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PersonaQuestCreate(BaseModel):
    category: BuddyCategory
    custom_category: str | None = None
    activity: str = Field(min_length=3, max_length=200)
    description: str | None = Field(None, max_length=1000)
    start_time: datetime
    end_time: datetime | None = None
    location: str = Field(min_length=2, max_length=200)
    latitude: float | None = None
    longitude: float | None = None
    vibe_level: VibeLevel = VibeLevel.CHILL
    custom_vibe_level: str | None = None
    max_participants: int = Field(default=2, ge=1, le=100)
    requires_approval: bool = True


class ReplyAsPersonaRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class PendingRequestItem(BaseModel):
    participant_id: str
    quest_id: str
    quest_activity: str
    persona_id: str
    persona_name: str
    requester_id: str
    requester_name: str
    requester_avatar: str | None
    message: str | None
    requested_at: datetime


class PersonaConversationItem(BaseModel):
    conversation_id: str
    persona_id: str
    persona_name: str
    other_user_id: str
    other_user_name: str
    other_user_avatar: str | None
    last_message_content: str | None
    last_message_at: datetime | None
    status: str


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _slug(name: str) -> str:
    """Convert a name to a URL-safe slug."""
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug


async def _get_persona(persona_id: str, db: AsyncSession) -> User:
    result = await db.execute(
        select(User).where(User.id == persona_id).where(User.is_persona == True)
    )
    persona = result.scalar_one_or_none()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona


# ---------------------------------------------------------------------------
# Persona CRUD — fixed paths first, then parametric
# ---------------------------------------------------------------------------

@router.get("/personas/quest-requests", response_model=list[PendingRequestItem])
async def list_pending_quest_requests(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """All pending join requests across all persona-hosted quests."""
    result = await db.execute(
        select(BuddyParticipant)
        .options(
            selectinload(BuddyParticipant.user),
            selectinload(BuddyParticipant.buddy_request).selectinload(BuddyRequest.host),
        )
        .join(BuddyRequest, BuddyRequest.id == BuddyParticipant.buddy_request_id)
        .join(User, User.id == BuddyRequest.user_id)
        .where(BuddyParticipant.status == ParticipantStatus.PENDING)
        .where(User.is_persona == True)
        .order_by(BuddyParticipant.created_at.asc())
    )
    participants = result.scalars().all()

    return [
        PendingRequestItem(
            participant_id=str(p.id),
            quest_id=str(p.buddy_request_id),
            quest_activity=p.buddy_request.activity,
            persona_id=str(p.buddy_request.host.id),
            persona_name=p.buddy_request.host.name,
            requester_id=str(p.user.id),
            requester_name=p.user.name,
            requester_avatar=p.user.avatar_url,
            message=p.message,
            requested_at=p.created_at,
        )
        for p in participants
    ]


@router.get("/personas/conversations", response_model=list[PersonaConversationItem])
async def list_persona_conversations(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """All DM conversations where one participant is a persona."""
    result = await db.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.user1),
            selectinload(Conversation.user2),
        )
        .join(User, or_(User.id == Conversation.user1_id, User.id == Conversation.user2_id))
        .where(User.is_persona == True)
        .where(Conversation.status != ConversationStatus.BLOCKED)
        .order_by(Conversation.updated_at.desc())
    )
    convs = result.scalars().unique().all()

    items = []
    for conv in convs:
        if conv.user1.is_persona:
            persona, other = conv.user1, conv.user2
        else:
            persona, other = conv.user2, conv.user1

        # Last message
        msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .where(Message.is_deleted == False)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = msg_result.scalar_one_or_none()

        items.append(PersonaConversationItem(
            conversation_id=str(conv.id),
            persona_id=str(persona.id),
            persona_name=persona.name,
            other_user_id=str(other.id),
            other_user_name=other.name,
            other_user_avatar=other.avatar_url,
            last_message_content=last_msg.content if last_msg and not last_msg.is_deleted else None,
            last_message_at=last_msg.created_at if last_msg else None,
            status=conv.status.value,
        ))

    return items


@router.get("/personas", response_model=list[PersonaResponse])
async def list_personas(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all persona accounts."""
    result = await db.execute(
        select(User)
        .where(User.is_persona == True)
        .order_by(User.created_at.asc())
    )
    return [
        PersonaResponse(
            id=str(u.id),
            name=u.name,
            email=u.email,
            program=u.program,
            bio=u.bio,
            avatar_url=u.avatar_url,
            is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in result.scalars().all()
    ]


@router.post("/personas", response_model=PersonaResponse, status_code=status.HTTP_201_CREATED)
async def create_persona(
    body: PersonaCreate,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new persona account."""
    base_slug = _slug(body.name)
    # Find a unique email
    for attempt in range(10):
        suffix = str(uuid.uuid4().int)[:4]
        email = f"persona_{base_slug}_{suffix}@internal.yorkpulse.com"
        existing = await db.execute(select(User).where(User.email == email))
        if not existing.scalar_one_or_none():
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique persona email")

    persona = User(
        id=uuid.uuid4(),
        email=email,
        name=body.name,
        program=body.program,
        bio=body.bio,
        avatar_url=None,
        email_verified=True,
        name_verified=True,
        is_active=True,
        is_banned=False,
        is_admin=False,
        is_founder=False,
        is_persona=True,
    )
    db.add(persona)
    await db.commit()
    await db.refresh(persona)

    return PersonaResponse(
        id=str(persona.id),
        name=persona.name,
        email=persona.email,
        program=persona.program,
        bio=persona.bio,
        avatar_url=persona.avatar_url,
        is_active=persona.is_active,
        created_at=persona.created_at,
    )


@router.delete("/personas/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_persona(
    persona_id: str,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Soft-deactivate a persona (historical quests remain)."""
    persona = await _get_persona(persona_id, db)
    persona.is_active = False
    await db.commit()


@router.post("/personas/{persona_id}/quests", response_model=BuddyRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_persona_quest(
    persona_id: str,
    body: PersonaQuestCreate,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Post a Side Quest as a persona."""
    persona = await _get_persona(persona_id, db)

    from datetime import timedelta
    end_time = body.end_time or (body.start_time + timedelta(weeks=1))

    quest = BuddyRequest(
        id=uuid.uuid4(),
        user_id=persona.id,
        category=body.category,
        custom_category=body.custom_category,
        activity=body.activity,
        description=body.description,
        start_time=body.start_time,
        end_time=end_time,
        location=body.location,
        latitude=body.latitude,
        longitude=body.longitude,
        vibe_level=body.vibe_level,
        custom_vibe_level=body.custom_vibe_level,
        max_participants=body.max_participants,
        requires_approval=body.requires_approval,
        current_participants=1,
    )

    db.add(quest)
    await db.commit()
    await db.refresh(quest, ["host"])

    return _request_to_response(quest)


# ---------------------------------------------------------------------------
# Quest participant decisions
# ---------------------------------------------------------------------------

@router.post("/quests/{quest_id}/participants/{participant_id}/decide", response_model=ParticipantResponse)
async def decide_join_request(
    quest_id: str,
    participant_id: str,
    action: ParticipantAction,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Accept or reject a join request for a persona-hosted quest."""
    quest_result = await db.execute(
        select(BuddyRequest)
        .join(User, User.id == BuddyRequest.user_id)
        .where(BuddyRequest.id == quest_id)
        .where(User.is_persona == True)
    )
    quest = quest_result.scalar_one_or_none()
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found or not persona-hosted")

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
        raise HTTPException(status_code=400, detail="Already processed")

    if action.action == "accept":
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


# ---------------------------------------------------------------------------
# DM replies as persona
# ---------------------------------------------------------------------------

@router.post("/conversations/{conv_id}/reply-as/{persona_id}")
async def reply_as_persona(
    conv_id: str,
    persona_id: str,
    body: ReplyAsPersonaRequest,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a DM message as a persona."""
    persona = await _get_persona(persona_id, db)

    conv_result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.user1), selectinload(Conversation.user2))
        .where(Conversation.id == conv_id)
        .where(
            or_(
                Conversation.user1_id == persona.id,
                Conversation.user2_id == persona.id,
            )
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found or persona is not a participant")

    if conv.status == ConversationStatus.BLOCKED:
        raise HTTPException(status_code=403, detail="Conversation is blocked")

    # Auto-accept pending conversations when persona replies
    if conv.status == ConversationStatus.PENDING:
        conv.status = ConversationStatus.ACTIVE

    message = Message(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        sender_id=persona.id,
        content=body.content,
    )
    db.add(message)
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(message)

    return _message_to_response(message)
