"""FastAPI middleware for rate limiting and other cross-cutting concerns."""

import time
import logging

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.redis import rate_limiter, redis_service

logger = logging.getLogger(__name__)

# Auth endpoints get a much stricter limit than the global one.
# 10 requests per 10 minutes per IP — allows a real user to retry a few
# times but makes a flood script hit the wall almost immediately.
AUTH_RATE_LIMIT_REQUESTS = 5
AUTH_RATE_LIMIT_WINDOW = 600   # 10 minutes
AUTH_ENDPOINTS = {
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/auth/resend-otp",
    "/api/v1/auth/verify-otp",
}

# In-process fallback for when Redis is unavailable
_ip_request_counts: dict[str, list[float]] = {}

# Global signup rate limit — caps total /signup requests across ALL IPs.
# Stops distributed botnet attacks where each IP sends only 1-2 requests.
GLOBAL_SIGNUP_LIMIT = 20   # max signups per window across all IPs
GLOBAL_SIGNUP_WINDOW = 60  # 1 minute
_global_signup_times: list[float] = []  # in-process fallback


def _get_real_ip(request: Request) -> str:
    """
    Extract the real client IP from X-Forwarded-For.
    Render's load balancer PREPENDS the real client IP as the first entry.
    Any entries after the first were set by the client or intermediate proxies
    and cannot be trusted. Taking the first entry gives us the real public IP.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # First entry = real client IP prepended by Render's LB
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    return ip


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
    Two-tier rate limiting:
      1. Auth endpoints: strict — 10 req / 10 min per real IP
      2. Everything else: relaxed — 100 req / 60 sec per real IP or user ID
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        real_ip = _get_real_ip(request)
        path = request.url.path

        # Global signup rate limit — blocks distributed botnets rotating IPs
        if path == "/api/v1/auth/signup":
            globally_blocked = await self._check_global_signup_limit()
            if globally_blocked:
                logger.warning("GLOBAL SIGNUP FLOOD: ip=%s blocked", real_ip)
                return Response(
                    content='{"detail": "Signup temporarily unavailable. Please try again in a minute."}',
                    status_code=429,
                    media_type="application/json",
                    headers={"Retry-After": str(GLOBAL_SIGNUP_WINDOW)},
                )

        # Strict limit on auth endpoints
        if path in AUTH_ENDPOINTS:
            blocked = await self._check_auth_limit(real_ip, path)
            if blocked:
                logger.warning(
                    "AUTH RATE LIMIT EXCEEDED: ip=%s path=%s", real_ip, path
                )
                return Response(
                    content='{"detail": "Too many requests. Please wait 10 minutes."}',
                    status_code=429,
                    media_type="application/json",
                    headers={"Retry-After": str(AUTH_RATE_LIMIT_WINDOW)},
                )

        # Global limit for everything
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
        Returns True (blocked) if this IP has exceeded 10 requests
        to auth endpoints in the last 10 minutes.
        Uses Redis sliding window; falls back to in-process list.
        """
        key = f"auth_rate:{ip}"
        try:
            current = await redis_service.incr(key)
            if current == 1:
                await redis_service.expire(key, AUTH_RATE_LIMIT_WINDOW)
            if current > AUTH_RATE_LIMIT_REQUESTS:
                logger.warning(
                    "AUTH FLOOD DETECTED: ip=%s count=%d path=%s",
                    ip, current, path,
                )
            return current > AUTH_RATE_LIMIT_REQUESTS
        except Exception:
            # Redis unavailable — sliding window in process memory
            now = time.time()
            window_start = now - AUTH_RATE_LIMIT_WINDOW
            times = _ip_request_counts.get(ip, [])
            times = [t for t in times if t > window_start]  # prune old
            times.append(now)
            _ip_request_counts[ip] = times
            return len(times) > AUTH_RATE_LIMIT_REQUESTS

    async def _check_global_signup_limit(self) -> bool:
        """
        Returns True (blocked) if more than GLOBAL_SIGNUP_LIMIT signups
        have been attempted across ALL IPs in the last GLOBAL_SIGNUP_WINDOW seconds.
        Defeats distributed botnets that rotate IPs to bypass per-IP limits.
        """
        key = "global_signup_rate"
        try:
            current = await redis_service.incr(key)
            if current == 1:
                await redis_service.expire(key, GLOBAL_SIGNUP_WINDOW)
            if current > GLOBAL_SIGNUP_LIMIT:
                logger.warning("GLOBAL SIGNUP FLOOD DETECTED: count=%d", current)
            return current > GLOBAL_SIGNUP_LIMIT
        except Exception:
            # Redis unavailable — sliding window in process memory
            global _global_signup_times
            now = time.time()
            window_start = now - GLOBAL_SIGNUP_WINDOW
            _global_signup_times = [t for t in _global_signup_times if t > window_start]
            _global_signup_times.append(now)
            return len(_global_signup_times) > GLOBAL_SIGNUP_LIMIT

    def _get_identifier(self, request: Request, real_ip: str) -> str:
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        return f"ip:{real_ip}"
