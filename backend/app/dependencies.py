"""Request-scoped dependencies: optional API key auth and an in-memory rate limiter.

Both are *ready hooks* rather than enterprise systems: when ``API_KEY`` is unset
authentication is disabled; when ``RATE_LIMIT_PER_MINUTE`` is 0 the limiter is
inactive. Swapping in JWT/OAuth or a Redis limiter later only touches this file.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, Header, Request

from backend.app.config import Settings, get_settings
from backend.app.errors import APIError


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_s: float = 60.0) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window_s:
                q.popleft()
            if len(q) >= limit:
                raise APIError(429, "rate_limited", f"Rate limit of {limit} requests/minute exceeded. Retry shortly.")
            q.append(now)


_limiter = SlidingWindowRateLimiter()


def rate_limit(request: Request, settings: Settings = Depends(get_settings)) -> None:
    if settings.rate_limit_per_minute <= 0:
        return
    client = request.client.host if request.client else "anonymous"
    _limiter.check(client, settings.rate_limit_per_minute)


def require_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    settings: Settings = Depends(get_settings),
) -> str | None:
    """Enforced only when ``API_KEY`` is configured. Returns the client identity (future: user)."""
    if not settings.api_key:
        return None
    if x_api_key != settings.api_key:
        raise APIError(401, "unauthorized", "Missing or invalid X-API-Key header")
    return "api-key-client"
