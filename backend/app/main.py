import asyncio
import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure logging before anything else so all INFO logs appear in Render
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.core.middleware import RateLimitMiddleware, TimingMiddleware
from app.api.routes import auth, buddy, courses, dashboard, feedback, gigs, health, map, marketplace, messaging, push_notifications, reports, residences, reviews, transactions, vault
from app.services.redis import redis_service
from app.core.database import async_session_maker


async def run_quest_cleanup_task():
    """Background task to periodically clean up expired quests."""
    from app.services.quest_cleanup import cleanup_quests

    while True:
        try:
            # Run cleanup every hour
            await asyncio.sleep(3600)  # 1 hour

            async with async_session_maker() as db:
                result = await cleanup_quests(db)
                logger.info("Quest cleanup completed: %s", result)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Quest cleanup error: %s", e)
            # Wait a bit before retrying on error
            await asyncio.sleep(60)


# Store the background task reference
cleanup_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global cleanup_task

    # Startup
    logger.info("Starting %s...", settings.app_name)

    # Push notification startup diagnostics
    vapid_key = settings.vapid_private_key.strip()
    if not vapid_key:
        logger.error("PUSH [startup] VAPID_PRIVATE_KEY is NOT SET — push notifications disabled")
    elif "BEGIN" in vapid_key:
        logger.warning("PUSH [startup] VAPID_PRIVATE_KEY is PEM format — will auto-convert (replace with base64url scalar for reliability)")
    else:
        logger.info("PUSH [startup] VAPID_PRIVATE_KEY OK (base64url, length=%d)", len(vapid_key))
    try:
        from sqlalchemy import text
        async with async_session_maker() as db:
            result = await db.execute(text("SELECT COUNT(*) FROM push_subscriptions"))
            count = result.scalar()
            logger.info("PUSH [startup] %d push subscription(s) in DB", count)
    except Exception as exc:
        logger.error("PUSH [startup] could not query push_subscriptions: %s", exc)

    # Run initial cleanup on startup (disabled for faster startup)
    # try:
    #     from app.services.quest_cleanup import cleanup_quests
    #     async with async_session_maker() as db:
    #         result = await cleanup_quests(db)
    #         print(f"Initial quest cleanup: {result}")
    # except Exception as e:
    #     print(f"Initial cleanup failed: {e}")

    # Start background cleanup task
    cleanup_task = asyncio.create_task(run_quest_cleanup_task())

    yield

    # Shutdown
    logger.info("Shutting down %s...", settings.app_name)

    # Cancel background task
    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

    await redis_service.close()


app = FastAPI(
    title=settings.app_name,
    description="Community and safety platform for York University students",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Timing middleware (logs slow requests > 1s)
app.add_middleware(TimingMiddleware)

# Rate limiting
app.add_middleware(RateLimitMiddleware)

# Routes
app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(vault.router, prefix=settings.api_prefix)
app.include_router(marketplace.router, prefix=settings.api_prefix)
app.include_router(buddy.router, prefix=settings.api_prefix)
app.include_router(messaging.router, prefix=settings.api_prefix)
app.include_router(reviews.router, prefix=settings.api_prefix)
app.include_router(transactions.router, prefix=settings.api_prefix)
app.include_router(reports.router, prefix=settings.api_prefix)
app.include_router(courses.router, prefix=settings.api_prefix)
app.include_router(dashboard.router, prefix=settings.api_prefix)
app.include_router(feedback.router, prefix=settings.api_prefix)
app.include_router(gigs.router, prefix=settings.api_prefix)
app.include_router(map.router, prefix=settings.api_prefix)
app.include_router(residences.router, prefix=settings.api_prefix)
app.include_router(push_notifications.router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    return {
        "message": "Welcome to YorkPulse API",
        "docs": "/api/docs",
        "version": "1.0.0",
    }
