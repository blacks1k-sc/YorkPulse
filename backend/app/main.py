import asyncio
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.middleware import RateLimitMiddleware
from app.api.routes import auth, buddy, health, marketplace, messaging, reviews, vault
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
                print(f"Quest cleanup completed: {result}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Quest cleanup error: {e}")
            # Wait a bit before retrying on error
            await asyncio.sleep(60)


# Store the background task reference
cleanup_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global cleanup_task

    # Startup
    print(f"Starting {settings.app_name}...")

    # Run initial cleanup on startup
    try:
        from app.services.quest_cleanup import cleanup_quests
        async with async_session_maker() as db:
            result = await cleanup_quests(db)
            print(f"Initial quest cleanup: {result}")
    except Exception as e:
        print(f"Initial cleanup failed: {e}")

    # Start background cleanup task
    cleanup_task = asyncio.create_task(run_quest_cleanup_task())

    yield

    # Shutdown
    print(f"Shutting down {settings.app_name}...")

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
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (add after CORS)
# Uncomment when Redis is available:
# app.add_middleware(RateLimitMiddleware)

# Routes
app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(vault.router, prefix=settings.api_prefix)
app.include_router(marketplace.router, prefix=settings.api_prefix)
app.include_router(buddy.router, prefix=settings.api_prefix)
app.include_router(messaging.router, prefix=settings.api_prefix)
app.include_router(reviews.router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    return {
        "message": "Welcome to YorkPulse API",
        "docs": "/api/docs",
        "version": "1.0.0",
    }
