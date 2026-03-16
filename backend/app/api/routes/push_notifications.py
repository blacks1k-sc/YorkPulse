"""Push notification subscription management routes."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/push", tags=["Push Notifications"])


class SubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    request: SubscribeRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a push subscription for the current user."""
    # Upsert: if this endpoint already exists, update keys
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == request.endpoint)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.p256dh = request.p256dh
        existing.auth = request.auth
        existing.user_id = user.id
    else:
        sub = PushSubscription(
            user_id=user.id,
            endpoint=request.endpoint,
            p256dh=request.p256dh,
            auth=request.auth,
        )
        db.add(sub)

    await db.commit()
    return {"message": "Subscribed"}


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    request: UnsubscribeRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Remove a push subscription."""
    await db.execute(
        delete(PushSubscription)
        .where(PushSubscription.endpoint == request.endpoint)
        .where(PushSubscription.user_id == user.id)
    )
    await db.commit()
