"""FastAPI middleware for rate limiting and other cross-cutting concerns."""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.redis import rate_limiter


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting requests."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Get identifier (user ID from token or IP address)
        identifier = self._get_identifier(request)

        # Get endpoint for per-endpoint limiting
        endpoint = request.url.path

        # Check rate limit
        is_allowed, info = await rate_limiter.is_allowed(identifier, endpoint)

        if not is_allowed:
            return Response(
                content='{"detail": "Rate limit exceeded. Please try again later."}',
                status_code=429,
                media_type="application/json",
                headers={
                    "X-RateLimit-Limit": str(info["limit"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(info["reset_in"]),
                    "Retry-After": str(info["reset_in"]),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(info["reset_in"])

        return response

    def _get_identifier(self, request: Request) -> str:
        """Get a unique identifier for the request."""
        # Try to get user ID from request state (set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"

        # Fall back to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"

        return f"ip:{ip}"
