import pytest

from tests.test_users import _auth


async def _token(client):
    resp = await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    return resp.json()["accessToken"]


@pytest.fixture
def weather_mocks(monkeypatch):
    store = {}
    calls = {"n": 0}

    async def fake_cache_get(key):
        return store.get(key)

    async def fake_cache_set(key, value, ttl_seconds):
        store[key] = value

    async def fake_fetch(lat, lng):
        calls["n"] += 1
        return {
            "tempC": 31,
            "rainProbability": 40,
            "condition": "Partly Cloudy",
            "radarAvailable": True,
            "forecast": [
                {"day": "Today", "tempC": 31, "rainProbability": 40},
                {"day": "Tomorrow", "tempC": 30, "rainProbability": 55},
            ],
        }

    monkeypatch.setattr("app.routers.weather.cache_get", fake_cache_get)
    monkeypatch.setattr("app.routers.weather.cache_set", fake_cache_set)
    monkeypatch.setattr("app.routers.weather.fetch_weather", fake_fetch)
    return calls


async def test_weather_shape(client, weather_mocks):
    token = await _token(client)
    resp = await client.get("/v1/weather", params={"lat": 20.0, "lng": 73.8}, headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    for key in ("tempC", "rainProbability", "condition", "radarAvailable", "forecast"):
        assert key in body


async def test_weather_caches(client, weather_mocks):
    token = await _token(client)
    headers = _auth(token)
    await client.get("/v1/weather", params={"lat": 20.0, "lng": 73.8}, headers=headers)
    await client.get("/v1/weather", params={"lat": 20.0, "lng": 73.8}, headers=headers)
    assert weather_mocks["n"] == 1
    await client.get("/v1/weather", params={"lat": 21.0, "lng": 73.8}, headers=headers)
    assert weather_mocks["n"] == 2


async def test_weather_requires_auth(client):
    resp = await client.get("/v1/weather", params={"lat": 20.0, "lng": 73.8})
    assert resp.status_code == 401
