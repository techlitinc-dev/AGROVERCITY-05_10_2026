import httpx
import pytest

from app.main import app

SEED_DOC = {
    "minSupportedVersion": "1.0.0",
    "forceUpdate": False,
    "featureFlags": {"liveChannels": True, "bnpl": False},
    "maintenanceMode": False,
}


@pytest.fixture
async def client(monkeypatch):
    async def fake_get_doc(collection, doc_id):
        return SEED_DOC

    monkeypatch.setattr("app.routers.app_config.get_doc", fake_get_doc)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_app_config_shape(client):
    resp = await client.get("/v1/app-config")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {
        "minSupportedVersion",
        "forceUpdate",
        "featureFlags",
        "maintenanceMode",
    }
    assert isinstance(body["featureFlags"], dict)
    assert all(isinstance(v, bool) for v in body["featureFlags"].values())


async def test_force_update_computed(client):
    resp = await client.get("/v1/app-config", params={"version": "0.9.0"})
    assert resp.json()["forceUpdate"] is True
    resp = await client.get("/v1/app-config", params={"version": "1.2.0"})
    assert resp.json()["forceUpdate"] is False


async def test_app_config_public(client):
    resp = await client.get("/v1/app-config")
    assert resp.status_code == 200
