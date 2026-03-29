"""FastAPI middleware for rate limiting and other cross-cutting concerns."""

import time
import logging

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.services.redis import rate_limiter, redis_service

logger = logging.getLogger(__name__)

# Auth endpoints get a much stricter per-IP limit.
AUTH_ENDPOINTS = {
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/auth/resend-otp",
    "/api/v1/auth/verify-otp",
    "/api/v1/auth/admin-login",
}

# Health check is always exempt — ALB probes should never be rate-limited.
EXEMPT_ENDPOINTS = {"/api/v1/health"}

# In-process fallback for when Redis is unavailable
_ip_request_counts: dict[str, list[float]] = {}


def _get_real_ip(request: Request) -> str:
    """
    Extract the real client IP.
    Priority: CF-Connecting-IP (Cloudflare) → X-Forwarded-For first entry → direct.
    CF-Connecting-IP is the most trustworthy when behind Cloudflare.
    X-Forwarded-For first entry is used when behind ALB only.
    """
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _parse_whitelist() -> set[str]:
    """Parse whitelisted IPs from config (comma-separated)."""
    raw = settings.rate_limit_whitelist_ips
    return {ip.strip() for ip in raw.split(",") if ip.strip()}


class TimingMiddleware(BaseHTTPMiddleware):
    """Log request timing and real client IP on every request."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        real_ip = _get_real_ip(request)

        # Store real IP on request state so routes can access it
        request.state.real_ip = real_ip

        response = await call_next(request)

        process_time = time.time() - start_time

        if process_time > 1.0:
            logger.warning(
                "SLOW REQUEST: %s %s took %.2fs (ip=%s)",
                request.method, request.url.path, process_time, real_ip,
            )

        response.headers["X-Process-Time"] = f"{process_time:.3f}"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Three-tier rate limiting:
      1. Whitelisted IPs (admin/dev): no limit at all.
      2. Auth endpoints: strict — settings.rate_limit_auth_requests / settings.rate_limit_auth_window_seconds per IP.
      3. Everything else: relaxed — settings.rate_limit_requests / settings.rate_limit_window_seconds per IP.
    """

    def __init__(self, app):
        super().__init__(app)
        self._whitelist = _parse_whitelist()

    async def dispatch(self, request: Request, call_next) -> Response:
        real_ip = _get_real_ip(request)
        path = request.url.path

        # Health checks always pass through
        if path in EXEMPT_ENDPOINTS:
            return await call_next(request)

        # Whitelisted IPs bypass all rate limits
        if real_ip in self._whitelist:
            return await call_next(request)

        # Strict limit on auth endpoints
        if path in AUTH_ENDPOINTS:
            blocked = await self._check_auth_limit(real_ip, path)
            if blocked:
                logger.warning(
                    "AUTH RATE LIMIT EXCEEDED: ip=%s path=%s", real_ip, path
                )
                return Response(
                    content='{"detail": "Too many requests. Please wait before trying again."}',
                    status_code=429,
                    media_type="application/json",
                    headers={"Retry-After": str(settings.rate_limit_auth_window_seconds)},
                )

        # Global limit for all other endpoints
        identifier = self._get_identifier(request, real_ip)
        is_allowed, info = await rate_limiter.is_allowed(identifier, path)

        if not is_allowed:
            logger.warning(
                "GLOBAL RATE LIMIT EXCEEDED: ip=%s path=%s", real_ip, path
            )
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

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(info["reset_in"])
        return response

    async def _check_auth_limit(self, ip: str, path: str) -> bool:
        """
        Returns True (blocked) if this IP has exceeded the auth rate limit.
        Uses Redis; falls back to in-process sliding window if Redis is down.
        """
        limit = settings.rate_limit_auth_requests
        window = settings.rate_limit_auth_window_seconds
        key = f"auth_rate:{window}:{ip}"
        try:
            current = await redis_service.incr(key)
            if current == 1:
                await redis_service.expire(key, window)
            if current > limit:
                logger.warning(
                    "AUTH FLOOD DETECTED: ip=%s count=%d path=%s", ip, current, path,
                )
            return current > limit
        except Exception:
            now = time.time()
            window_start = now - window
            times = _ip_request_counts.get(ip, [])
            times = [t for t in times if t > window_start]
            times.append(now)
            _ip_request_counts[ip] = times
            return len(times) > limit

    def _get_identifier(self, request: Request, real_ip: str) -> str:
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        return f"ip:{real_ip}"
