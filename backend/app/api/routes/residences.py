"""Residence chat API routes."""

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import AdminUser, CurrentUser, VerifiedUser
from app.models.residence import (
    Residence,
    ResidenceChannel,
    ResidenceMember,
    ResidenceChannelMember,
    ResidenceMessage,
)
from app.models.user import User
from app.schemas.residence import (
    JoinResidenceResponse,
    LeaveResidenceResponse,
    MyResidencesResponse,
    ResidenceChannelResponse,
    ResidenceListResponse,
    ResidenceMembershipResponse,
    ResidenceMessageAuthor,
    ResidenceMessageCreate,
    ResidenceMessageListResponse,
    ResidenceMessageResponse,
    ResidenceParticipant,
    ResidenceParticipantsResponse,
    ResidenceReplyInfo,
    ResidenceResponse,
    SeedResidencesResponse,
)
from app.services.storage import storage_service

router = APIRouter(prefix="/residences", tags=["Residences"])

YORK_RESIDENCES = [
    {"name": "Bethune College Residence",    "campus": "Keele"},
    {"name": "Calumet College Residence",    "campus": "Keele"},
    {"name": "Founders College Residence",   "campus": "Keele"},
    {"name": "McLaughlin College Residence", "campus": "Keele"},
    {"name": "Vanier College Residence",     "campus": "Keele"},
    {"name": "Winters College Residence",    "campus": "Keele"},
    {"name": "Stong College Residence",      "campus": "Keele"},
    {"name": "Pond Road Residence",          "campus": "Keele"},
    {"name": "The Village at York",          "campus": "Keele"},
    {"name": "Tatham Hall",                  "campus": "Glendon"},
]


def _residence_to_response(r: Residence) -> ResidenceResponse:
    return ResidenceResponse(
        id=str(r.id),
        name=r.name,
        campus=r.campus,
        member_count=r.member_count,
        created_at=r.created_at,
    )


def _channel_to_response(c: ResidenceChannel, unread_count: int = 0) -> ResidenceChannelResponse:
    return ResidenceChannelResponse(
        id=str(c.id),
        residence_id=str(c.residence_id),
        name=c.name,
        member_count=c.member_count,
        created_at=c.created_at,
        unread_count=unread_count,
    )


def _message_to_response(msg: ResidenceMessage, user: User) -> ResidenceMessageResponse:
    reply_info = None
    if msg.reply_to and msg.reply_to.user:
        reply_info = ResidenceReplyInfo(
            id=str(msg.reply_to.id),
            message=msg.reply_to.message,
            image_url=msg.reply_to.image_url,
            author=ResidenceMessageAuthor(
                id=str(msg.reply_to.user.id),
                name=msg.reply_to.user.name,
                avatar_url=msg.reply_to.user.avatar_url,
            ),
        )
    return ResidenceMessageResponse(
        id=str(msg.id),
        channel_id=str(msg.channel_id),
        message=msg.message,
        image_url=msg.image_url,
        author=ResidenceMessageAuthor(
            id=str(user.id),
            name=user.name,
            avatar_url=user.avatar_url,
        ),
        reply_to=reply_info,
        created_at=msg.created_at,
    )


async def _get_unread_count(
    channel_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> int:
    membership = await db.execute(
        select(ResidenceChannelMember).where(
            and_(
                ResidenceChannelMember.channel_id == channel_id,
                ResidenceChannelMember.user_id == user_id,
            )
        )
    )
    member = membership.scalar_one_or_none()
    if not member:
        return 0
    if not member.last_read_at:
        count = await db.execute(
            select(func.count()).where(ResidenceMessage.channel_id == channel_id)
        )
        return count.scalar() or 0
    count = await db.execute(
        select(func.count()).where(
            and_(
                ResidenceMessage.channel_id == channel_id,
                ResidenceMessage.created_at > member.last_read_at,
            )
        )
    )
    return count.scalar() or 0


# ============ Residence Discovery ============


@router.get("/list", response_model=ResidenceListResponse)
async def list_residences(db: Annotated[AsyncSession, Depends(get_db)]):
    """List all York University residences grouped by campus."""
    result = await db.execute(select(Residence).order_by(Residence.campus, Residence.name))
    residences = result.scalars().all()

    # Live member counts
    counts_result = await db.execute(
        select(ResidenceMember.residence_id, func.count().label("cnt"))
        .group_by(ResidenceMember.residence_id)
    )
    live_counts: dict[uuid.UUID, int] = {row.residence_id: row.cnt for row in counts_result}

    keele = []
    glendon = []
    for r in residences:
        resp = ResidenceResponse(
            id=str(r.id),
            name=r.name,
            campus=r.campus,
            member_count=live_counts.get(r.id, 0),
            created_at=r.created_at,
        )
        if r.campus == "Keele":
            keele.append(resp)
        else:
            glendon.append(resp)

    return ResidenceListResponse(keele=keele, glendon=glendon)


# ============ Membership ============


@router.get("/my/residences", response_model=MyResidencesResponse)
async def get_my_residences(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get the current user's joined residences with unread counts."""
    result = await db.execute(
        select(ResidenceMember)
        .options(selectinload(ResidenceMember.residence).selectinload(Residence.channel))
        .where(ResidenceMember.user_id == current_user.id)
        .order_by(ResidenceMember.joined_at.desc())
    )
    memberships = result.scalars().all()

    items = []
    for m in memberships:
        r = m.residence
        ch = r.channel
        unread = await _get_unread_count(ch.id, current_user.id, db) if ch else 0
        ch_resp = _channel_to_response(ch, unread) if ch else None
        items.append(
            ResidenceMembershipResponse(
                residence=_residence_to_response(r),
                channel=ch_resp,
                joined_at=m.joined_at,
                unread_count=unread,
            )
        )

    return MyResidencesResponse(residences=items)


@router.post("/{residence_id}/join", response_model=JoinResidenceResponse)
async def join_residence(
    residence_id: str,
    current_user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Join a residence. Auto-joins the general channel."""
    result = await db.execute(
        select(Residence)
        .options(selectinload(Residence.channel))
        .where(Residence.id == residence_id)
    )
    residence = result.scalar_one_or_none()
    if not residence:
        raise HTTPException(status_code=404, detail="Residence not found")

    # Check already a member
    existing = await db.execute(
        select(ResidenceMember).where(
            and_(
                ResidenceMember.user_id == current_user.id,
                ResidenceMember.residence_id == residence.id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member of this residence")

    channel = residence.channel
    if not channel:
        raise HTTPException(status_code=500, detail="Residence has no channel — contact admin")

    # Join residence
    db.add(ResidenceMember(user_id=current_user.id, residence_id=residence.id))
    # Join channel
    db.add(ResidenceChannelMember(
        user_id=current_user.id,
        channel_id=channel.id,
        last_read_at=datetime.now(timezone.utc),
    ))
    # Increment counts
    residence.member_count = (residence.member_count or 0) + 1
    channel.member_count = (channel.member_count or 0) + 1

    await db.commit()
    await db.refresh(residence)
    await db.refresh(channel)

    return JoinResidenceResponse(
        residence=_residence_to_response(residence),
        channel=_channel_to_response(channel),
        message=f"Joined {residence.name}",
    )


@router.post("/{residence_id}/leave", response_model=LeaveResidenceResponse)
async def leave_residence(
    residence_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Leave a residence."""
    result = await db.execute(
        select(Residence)
        .options(selectinload(Residence.channel))
        .where(Residence.id == residence_id)
    )
    residence = result.scalar_one_or_none()
    if not residence:
        raise HTTPException(status_code=404, detail="Residence not found")

    membership = await db.execute(
        select(ResidenceMember).where(
            and_(
                ResidenceMember.user_id == current_user.id,
                ResidenceMember.residence_id == residence.id,
            )
        )
    )
    member = membership.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=400, detail="Not a member of this residence")

    channel = residence.channel
    if channel:
        await db.execute(
            delete(ResidenceChannelMember).where(
                and_(
                    ResidenceChannelMember.user_id == current_user.id,
                    ResidenceChannelMember.channel_id == channel.id,
                )
            )
        )
        channel.member_count = max(0, (channel.member_count or 1) - 1)

    await db.delete(member)
    residence.member_count = max(0, (residence.member_count or 1) - 1)
    await db.commit()

    return LeaveResidenceResponse(message=f"Left {residence.name}")


# ============ Channel ============


@router.get("/{residence_id}/channel", response_model=ResidenceChannelResponse)
async def get_residence_channel(
    residence_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get the general channel for a residence."""
    result = await db.execute(
        select(ResidenceChannel).where(ResidenceChannel.residence_id == residence_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    unread = await _get_unread_count(channel.id, current_user.id, db)
    return _channel_to_response(channel, unread)


# ============ Messages ============


@router.get("/channels/{channel_id}/messages", response_model=ResidenceMessageListResponse)
async def get_messages(
    channel_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    before: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
):
    """Get paginated messages for a residence channel. Updates last_read_at."""
    # Verify channel exists
    channel_result = await db.execute(
        select(ResidenceChannel).where(ResidenceChannel.id == channel_id)
    )
    channel = channel_result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    query = (
        select(ResidenceMessage)
        .options(selectinload(ResidenceMessage.user), selectinload(ResidenceMessage.reply_to))
        .where(ResidenceMessage.channel_id == channel_id)
        .order_by(ResidenceMessage.created_at.desc())
        .limit(limit + 1)
    )
    if before:
        try:
            before_dt = datetime.fromisoformat(before.replace("Z", "+00:00"))
            query = query.where(ResidenceMessage.created_at < before_dt)
        except ValueError:
            pass

    result = await db.execute(query)
    msgs = list(result.scalars().all())
    has_more = len(msgs) > limit
    if has_more:
        msgs = msgs[:limit]

    # Update last_read_at
    membership = await db.execute(
        select(ResidenceChannelMember).where(
            and_(
                ResidenceChannelMember.channel_id == channel_id,
                ResidenceChannelMember.user_id == current_user.id,
            )
        )
    )
    member = membership.scalar_one_or_none()
    if member:
        member.last_read_at = datetime.now(timezone.utc)
        await db.commit()

    messages = [_message_to_response(m, m.user) for m in reversed(msgs)]
    return ResidenceMessageListResponse(messages=messages, has_more=has_more)


@router.post("/channels/{channel_id}/messages", response_model=ResidenceMessageResponse)
async def send_message(
    channel_id: str,
    body: ResidenceMessageCreate,
    current_user: VerifiedUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a message in a residence channel."""
    channel_result = await db.execute(
        select(ResidenceChannel).where(ResidenceChannel.id == channel_id)
    )
    channel = channel_result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Must be a member
    membership = await db.execute(
        select(ResidenceChannelMember).where(
            and_(
                ResidenceChannelMember.channel_id == channel_id,
                ResidenceChannelMember.user_id == current_user.id,
            )
        )
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You must be a member to send messages")

    reply_to_id = None
    if body.reply_to_id:
        try:
            reply_to_id = uuid.UUID(body.reply_to_id)
        except ValueError:
            pass

    msg = ResidenceMessage(
        channel_id=uuid.UUID(channel_id),
        user_id=current_user.id,
        message=body.message,
        image_url=body.image_url,
        reply_to_id=reply_to_id,
    )
    db.add(msg)
    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(ResidenceMessage)
        .options(selectinload(ResidenceMessage.user), selectinload(ResidenceMessage.reply_to))
        .where(ResidenceMessage.id == msg.id)
    )
    msg = result.scalar_one()
    await db.commit()

    return _message_to_response(msg, msg.user)


# ============ Image Upload ============


@router.post("/chat/upload-image")
async def get_chat_image_upload_url(
    body: dict,
    current_user: VerifiedUser,
):
    """Get a presigned URL for uploading a chat image."""
    filename = body.get("filename", "")
    content_type = body.get("content_type", "")
    if not filename or not content_type:
        raise HTTPException(status_code=400, detail="filename and content_type required")

    upload_url, file_url = await storage_service.get_chat_image_upload_url(filename, content_type)
    return {"upload_url": upload_url, "file_url": file_url, "expires_in": 3600}


# ============ Participants ============


@router.get("/{residence_id}/participants", response_model=ResidenceParticipantsResponse)
async def get_participants(
    residence_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get participants of a residence. Must be a member."""
    membership = await db.execute(
        select(ResidenceMember).where(
            and_(
                ResidenceMember.residence_id == residence_id,
                ResidenceMember.user_id == current_user.id,
            )
        )
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You must be a member of this residence")

    result = await db.execute(
        select(User)
        .join(ResidenceMember, ResidenceMember.user_id == User.id)
        .where(ResidenceMember.residence_id == residence_id)
        .order_by(User.name)
    )
    users = result.scalars().all()

    return ResidenceParticipantsResponse(
        participants=[
            ResidenceParticipant(id=str(u.id), name=u.name, avatar_url=u.avatar_url)
            for u in users
        ],
        total=len(users),
    )


# ============ Admin ============


@router.post("/admin/seed", response_model=SeedResidencesResponse)
async def seed_residences(
    _: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Seed all York University residences (idempotent)."""
    residences_created = 0
    channels_created = 0

    for data in YORK_RESIDENCES:
        existing = await db.execute(
            select(Residence).where(Residence.name == data["name"])
        )
        if existing.scalar_one_or_none():
            continue

        residence = Residence(
            id=uuid.uuid4(),
            name=data["name"],
            campus=data["campus"],
            member_count=0,
        )
        db.add(residence)
        await db.flush()

        channel = ResidenceChannel(
            id=uuid.uuid4(),
            residence_id=residence.id,
            name="general",
            member_count=0,
        )
        db.add(channel)
        residences_created += 1
        channels_created += 1

    await db.commit()

    return SeedResidencesResponse(
        residences_created=residences_created,
        channels_created=channels_created,
        message=f"Seeded {residences_created} residences with {channels_created} channels",
    )
