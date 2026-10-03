import logging

from fastapi import HTTPException, Request

from app.core.cache import REDIS_ERRORS, get_redis

log = logging.getLogger(__name__)


async def hit(scope: str, ident: str, limit: int, window_seconds: int):
    """Token-bucket-ish fixed-window counter; key rl:<scope>:<ident>.
    429 with the standard error envelope when over limit. Fails open when
    Redis is unavailable (dev), matching core/cache.py semantics."""
    try:
        r = await get_redis()
        n = await r.incr(f"rl:{scope}:{ident}")
        if n == 1:
            await r.expire(f"rl:{scope}:{ident}", window_seconds)
    except REDIS_ERRORS as exc:
        log.warning("rate limiter unavailable (%s): %s", scope, exc)
        return
    if n > limit:
        raise HTTPException(
            status_code=429,
            detail={"code": "RATE_LIMITED", "message": "too many requests — try again later", "fieldErrors": {}},
        )


def rate_limit_ip(scope: str, limit: int, window_seconds: int):
    async def dep(request: Request):
        ident = request.client.host if request.client else "unknown"
        await hit(scope, ident, limit, window_seconds)
    return dep
