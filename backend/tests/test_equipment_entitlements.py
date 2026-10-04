"""WS-04 step 10: equipment entitlements — Free = 1 machine; Pro ₹399/mo =
5 machines + analytics + maintenance suite + priority listing; Enterprise =
unlimited fleet + operator management + API."""
from app.services.billing import seed_plans
from tests.test_equipment_owner import MACHINE_BODY, _owner_token
from tests.test_users import _auth


async def _token(client, user_store):
    await seed_plans()
    resp = await _owner_token(client)
    return resp


async def _subscribe(client, token, plan_id):
    resp = await client.post(
        "/v1/billing/subscribe", json={"planId": plan_id}, headers=_auth(token)
    )
    assert resp.status_code == 201
    return resp.json()


async def test_free_tier_one_machine_limit(client, user_store):
    token = await _token(client, user_store)
    resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(token))
    assert resp.status_code == 201

    blocked = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(token))
    assert blocked.status_code == 402
    error = blocked.json()["error"]
    assert error["code"] == "ENTITLEMENT_EXCEEDED"
    assert error["limit"] == 1
    assert error["planId"] == "equipmentRental_free"


async def test_pro_tier_fleet_of_five(client, user_store):
    token = await _token(client, user_store)
    await _subscribe(client, token, "equipmentRental_pro")
    for _ in range(5):
        resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(token))
        assert resp.status_code == 201
    blocked = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(token))
    assert blocked.status_code == 402
    assert blocked.json()["error"]["limit"] == 5


async def test_enterprise_unlimited_fleet(client, user_store):
    token = await _token(client, user_store)
    await _subscribe(client, token, "equipmentRental_enterprise")
    for _ in range(8):
        resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(token))
        assert resp.status_code == 201


async def test_analytics_and_maintenance_are_pro_features(client, user_store):
    token = await _token(client, user_store)
    blocked = await client.get("/v1/equipment/owner/analytics", headers=_auth(token))
    assert blocked.status_code == 402
    assert blocked.json()["error"]["feature"] == "analytics"

    await _subscribe(client, token, "equipmentRental_pro")
    resp = await client.get("/v1/equipment/owner/analytics", headers=_auth(token))
    assert resp.status_code == 200
    assert "fleetSize" in resp.json()


async def test_enterprise_plan_features_listed(client, user_store):
    await seed_plans()
    resp = await client.get("/v1/billing/plans", params={"persona": "equipmentRental"})
    plans = {p["planId"]: p for p in resp.json()["data"]}
    assert "equipmentRental_enterprise" in plans
    assert plans["equipmentRental_enterprise"]["limits"] == {}
    assert "operatorManagement" in plans["equipmentRental_enterprise"]["features"]
    assert "apiAccess" in plans["equipmentRental_enterprise"]["features"]
    assert plans["equipmentRental_free"]["limits"] == {"machines": 1}
