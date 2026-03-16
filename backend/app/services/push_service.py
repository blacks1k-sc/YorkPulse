"""Web Push Notification service using pywebpush."""

import asyncio
import json
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session_maker
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)


def _send_webpush_sync(endpoint: str, p256dh: str, auth: str, payload: str) -> None:
    """Synchronous webpush call — run in a thread via asyncio.to_thread."""
    from pywebpush import webpush, WebPushException

    try:
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth},
            },
            data=payload,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": f"mailto:{settings.vapid_contact_email}"},
        )
    except WebPushException as exc:
        # Return the status code so callers can handle 410 (expired sub)
        status_code = exc.response.status_code if exc.response is not None else None
        raise _WebPushError(status_code) from exc


class _WebPushError(Exception):
    def __init__(self, status_code: int | None) -> None:
        self.status_code = status_code


async def _deliver(sub: PushSubscription, payload: str, db: AsyncSession) -> None:
    """Deliver one push and auto-delete on 410 (subscription expired)."""
    try:
        await asyncio.to_thread(
            _send_webpush_sync,
            sub.endpoint,
            sub.p256dh,
            sub.auth,
            payload,
        )
    except _WebPushError as exc:
        if exc.status_code == 410:
            await db.delete(sub)
            await db.commit()
            logger.info("Removed expired push subscription %s", sub.id)
    except Exception as exc:
        logger.error("Push delivery error for sub %s: %s", sub.id, exc)


async def send_push_to_user(
    user_id: uuid.UUID,
    title: str,
    body: str,
    url: str,
    conversation_id: str | None = None,
) -> None:
    """Send push notification to all subscriptions for a specific user."""
    if not settings.vapid_private_key:
        return

    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "url": url,
            "conversationId": conversation_id or "",
        }
    )

    async with async_session_maker() as db:
        result = await db.execute(
            select(PushSubscription).where(PushSubscription.user_id == user_id)
        )
        subs = result.scalars().all()

        for sub in subs:
            await _deliver(sub, payload, db)


async def send_push_broadcast(
    exclude_user_id: uuid.UUID | None,
    title: str,
    body: str,
    url: str,
) -> None:
    """Send push notification to all subscriptions except the triggering user."""
    if not settings.vapid_private_key:
        return

    payload = json.dumps({"title": title, "body": body, "url": url, "conversationId": ""})

    async with async_session_maker() as db:
        query = select(PushSubscription)
        if exclude_user_id is not None:
            query = query.where(PushSubscription.user_id != exclude_user_id)
        result = await db.execute(query)
        subs = result.scalars().all()

        for sub in subs:
            await _deliver(sub, payload, db)
