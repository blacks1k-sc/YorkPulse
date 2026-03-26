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


def _get_vapid_private_key() -> str:
    """
    Return the VAPID private key as a raw base64url scalar string.
    Handles both PEM blocks and plain base64url strings.
    """
    raw = settings.vapid_private_key.replace("\\n", "\n").strip()
    if not raw:
        logger.error("PUSH [key] VAPID_PRIVATE_KEY is not set — push disabled")
        return ""
    if "BEGIN" in raw:
        logger.info("PUSH [key] PEM format detected, converting to base64url scalar")
        try:
            import base64
            from cryptography.hazmat.primitives.serialization import load_pem_private_key
            key = load_pem_private_key(raw.encode(), password=None)
            scalar = key.private_numbers().private_value.to_bytes(32, "big")  # type: ignore[union-attr]
            result = base64.urlsafe_b64encode(scalar).rstrip(b"=").decode()
            logger.info("PUSH [key] PEM converted OK, scalar length=%d", len(result))
            return result
        except Exception as exc:
            logger.error("PUSH [key] PEM parse failed: %s", exc)
            return ""
    logger.info("PUSH [key] base64url format detected, length=%d", len(raw))
    return raw


def _send_webpush_sync(endpoint: str, p256dh: str, auth: str, payload: str) -> None:
    """Synchronous webpush call — run in a thread via asyncio.to_thread."""
    from pywebpush import webpush, WebPushException

    private_key = _get_vapid_private_key()
    if not private_key:
        raise RuntimeError("No VAPID private key available")

    logger.info("PUSH [send] → endpoint=%s", endpoint[:60])
    try:
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth},
            },
            data=payload,
            vapid_private_key=private_key,
            vapid_claims={"sub": f"mailto:{settings.vapid_contact_email}"},
        )
        logger.info("PUSH [send] ✓ delivered to endpoint=%s", endpoint[:60])
    except WebPushException as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        body = exc.response.text if exc.response is not None else str(exc)
        logger.error("PUSH [send] WebPushException status=%s body=%s endpoint=%s", status_code, body, endpoint[:60])
        raise _WebPushError(status_code) from exc
    except Exception as exc:
        logger.error("PUSH [send] unexpected error: %s", exc)
        raise


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
            logger.info("PUSH [deliver] removed expired sub %s", sub.id)
        else:
            logger.error("PUSH [deliver] failed sub=%s status=%s", sub.id, exc.status_code)
    except Exception as exc:
        logger.error("PUSH [deliver] error sub=%s: %s", sub.id, exc)


async def send_push_to_user(
    user_id: uuid.UUID,
    title: str,
    body: str,
    url: str,
    conversation_id: str | None = None,
) -> None:
    """Send push notification to all subscriptions for a specific user."""
    logger.info("PUSH [to_user] user=%s title=%r url=%s", user_id, title, url)

    if not settings.vapid_private_key:
        logger.error("PUSH [to_user] aborted — VAPID_PRIVATE_KEY not set")
        return

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "conversationId": conversation_id or "",
    })

    try:
        async with async_session_maker() as db:
            result = await db.execute(
                select(PushSubscription).where(PushSubscription.user_id == user_id)
            )
            subs = result.scalars().all()
            logger.info("PUSH [to_user] found %d subscription(s) for user=%s", len(subs), user_id)
            for sub in subs:
                await _deliver(sub, payload, db)
    except Exception as exc:
        logger.error("PUSH [to_user] db error: %s", exc)


async def send_push_broadcast(
    exclude_user_id: uuid.UUID | None,
    title: str,
    body: str,
    url: str,
) -> None:
    """Send push notification to all subscriptions except the triggering user."""
    logger.info("PUSH [broadcast] exclude=%s title=%r url=%s", exclude_user_id, title, url)

    if not settings.vapid_private_key:
        logger.error("PUSH [broadcast] aborted — VAPID_PRIVATE_KEY not set")
        return

    payload = json.dumps({"title": title, "body": body, "url": url, "conversationId": ""})

    try:
        async with async_session_maker() as db:
            query = select(PushSubscription)
            if exclude_user_id is not None:
                query = query.where(PushSubscription.user_id != exclude_user_id)
            result = await db.execute(query)
            subs = result.scalars().all()
            logger.info("PUSH [broadcast] found %d subscription(s)", len(subs))
            for sub in subs:
                await _deliver(sub, payload, db)
    except Exception as exc:
        logger.error("PUSH [broadcast] db error: %s", exc)
