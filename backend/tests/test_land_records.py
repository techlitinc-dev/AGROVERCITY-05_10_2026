from app.services.land_records import get_adapter
from app.services.land_records.mock_adapter import MockAdapter
from tests.test_diary import auth, seed_user


async def test_search_by_village_fuzzy(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/land-records/search?village=Ozar", headers=auth(token))
    assert resp.status_code == 200
    villages = [r["village"] for r in resp.json()["data"]]
    assert "Ozarkhed" in villages


async def test_village_too_short_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/land-records/search?village=Oz", headers=auth(token))
    assert resp.status_code == 422


async def test_search_by_gat_exact(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/land-records/search?gatNumber=123", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["id"] == "rec-1"


async def test_missing_params_400(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/land-records/search", headers=auth(token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "MISSING_SEARCH_PARAM"


async def test_import_updates_profile(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/land-records/rec-1/import", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"imported": True, "landAreaAcres": 2.97}
    user = user_store["users/uid-1"]
    assert user["landAreaAcres"] == 2.97
    assert any(r["gatNumber"] == "123" for r in user["landRecords"])


async def test_adapter_swap_env(monkeypatch):
    monkeypatch.setenv("LAND_RECORDS_ADAPTER", "mock")
    assert isinstance(get_adapter(), MockAdapter)
