import redis.asyncio as aioredis

from app.core.config import settings

_redis = None


async def get_redis():
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cache_get(key: str) -> str | None:
    return await (await get_redis()).get(key)


async def cache_set(key: str, value: str, ttl_seconds: int):
    await (await get_redis()).set(key, value, ex=ttl_seconds)


async def cache_delete(key: str):
    await (await get_redis()).delete(key)
