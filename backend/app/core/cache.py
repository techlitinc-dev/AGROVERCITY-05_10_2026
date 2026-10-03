import logging

import redis.asyncio as aioredis
from redis.exceptions import RedisError

from app.core.config import settings

log = logging.getLogger(__name__)

_redis = None

# connection-level failures when the server is down/unreachable
REDIS_ERRORS = (RedisError, OSError)


async def get_redis():
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cache_get(key: str) -> str | None:
    try:
        return await (await get_redis()).get(key)
    except REDIS_ERRORS as exc:
        log.warning("redis unavailable (get %s): %s", key, exc)
        return None


async def cache_set(key: str, value: str, ttl_seconds: int):
    try:
        await (await get_redis()).set(key, value, ex=ttl_seconds)
    except REDIS_ERRORS as exc:
        log.warning("redis unavailable (set %s): %s", key, exc)


async def cache_delete(key: str):
    try:
        await (await get_redis()).delete(key)
    except REDIS_ERRORS as exc:
        log.warning("redis unavailable (delete %s): %s", key, exc)
