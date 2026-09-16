from datetime import datetime, timedelta, timezone

from tests.test_equipment import EQ_1
from tests.test_users import _auth, _register

IST = timezone(timedelta(hours=5, minutes=30))

FPO = {
    "id": "sahyadri-fpo",
    "name": "Sahyadri Shetkari FPO",
    "memberCount": 214,
    "district": "Nashik",
}

POOL = {
    "id": "pool-1",
    "fpoId": "sahyadri-fpo",
    "fpoName": "Sahyadri Shetkari FPO",
    "item": "Nano Urea (500 ml)",
    "bookedUnits": 380,
    "targetUnits": 500,
    "discountPercent": 18,
    "deadline": "2026-09-26",
    "status": "open",
}


def _seed_fpo(user_store):
    user_store["fpos/sahyadri-fpo"] = dict(FPO)
    user_store["fpo_pools/pool-1"] = dict(POOL)
    user_store["equipment/eq-1"] = dict(EQ_1)


async def _token(client):
    resp = await _register(client)
    return resp.json()["accessToken"]


async def test_fpo_me(client, user_store):
    _seed_fpo(user_store)
    token = await _token(client)
    resp = await client.get("/v1/fpo/me", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Sahyadri Shetkari FPO"
    assert body["memberCount"] == 214
    assert user_store["users/uid-1"]["fpoId"] == "sahyadri-fpo"


async def test_pool_join_increments(client, user_store):
    _seed_fpo(user_store)
    token = await _token(client)
    resp = await client.post(
        "/v1/fpo/pools/pool-1/join", json={"units": 5}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["bookedUnits"] == 385
    member = user_store["fpo_pools/pool-1/members/uid-1"]
    assert member["units"] == 5


async def test_pool_full_409(client, user_store):
    _seed_fpo(user_store)
    token = await _token(client)
    user_store["fpo_pools/pool-1"]["bookedUnits"] = 500
    resp = await client.post(
        "/v1/fpo/pools/pool-1/join", json={"units": 1}, headers=_auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "POOL_FULL"
    resp = await client.post(
        "/v1/fpo/pools/pool-1/join", json={"units": 0}, headers=_auth(token)
    )
    assert resp.status_code == 422


async def test_machinery_calendar(client, user_store):
    _seed_fpo(user_store)
    token = await _token(client)
    resp = await client.get("/v1/fpo/machinery", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    machine = data[0]
    assert machine["equipmentId"] == "eq-1"
    assert machine["name"] == "Mahindra 575 DI Tractor"
    today = datetime.now(IST).date()
    monday = today - timedelta(days=today.weekday())
    expected_dates = {(monday + timedelta(days=i)).isoformat() for i in range(7)}
    assert set(machine["days"].keys()) == expected_dates
    for slots in machine["days"].values():
        assert len(slots) == 4
