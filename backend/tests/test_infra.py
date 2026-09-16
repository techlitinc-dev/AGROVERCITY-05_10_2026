import httpx
import pytest
import redis.exceptions

from app.core.cache import cache_delete, cache_get, cache_set, get_redis
from app.core.config import settings
from app.main import app


def test_settings_load():
    assert settings.jwt_algorithm == "HS256"


@pytest.mark.asyncio
async def test_health():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/v1/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_cache_roundtrip():
    try:
        r = await get_redis()
        await r.ping()
    except redis.exceptions.ConnectionError:
        pytest.skip("Redis not reachable")
    await cache_set("test:k", "v", 60)
    assert await cache_get("test:k") == "v"
    await cache_delete("test:k")
