import hashlib
import hmac
import json

from app.core.config import settings
from app.services.billing import seed_plans
from tests.test_diary import auth, seed_user
from tests.test_equipment_owner import MACHINE_BODY
from tests.test_transport import VEHICLE_BODY


async def test_plans_seeded_and_listed(client, user_store):
    await seed_plans()
    resp = await client.get("/v1/billing/plans", params={"persona": "transport"})
    assert resp.status_code == 200
    plans = {p["planId"]: p for p in resp.json()["data"]}
    assert {"transport_free", "transport_pro"} <= set(plans)
    assert plans["transport_pro"]["priceMonthlyPaisa"] == 49900
    assert plans["transport_pro"]["commission"] == "10%"


async def test_free_tier_blocks_over_limit_and_upgrade_unlocks(client, user_store):
    await seed_plans()
    token = seed_user(user_store, uid="uid-eq", active_profile="equipmentRental")
    headers = auth(token)

    # WS-04 step 10: Free = 1 machine
    resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=headers)
    assert resp.status_code == 201

    blocked = await client.post("/v1/equipment", json=MACHINE_BODY, headers=headers)
    assert blocked.status_code == 402
    error = blocked.json()["error"]
    assert error["code"] == "ENTITLEMENT_EXCEEDED"
    assert error["limit"] == 1
    assert error["used"] == 1
    assert error["planId"] == "equipmentRental_free"

    subscribed = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "equipmentRental_pro"},
        headers=headers,
    )
    assert subscribed.status_code == 201
    assert subscribed.json()["status"] == "active"

    # Pro = fleet of 5
    for _ in range(4):
        resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=headers)
        assert resp.status_code == 201

    blocked = await client.post("/v1/equipment", json=MACHINE_BODY, headers=headers)
    assert blocked.status_code == 402
    assert blocked.json()["error"]["limit"] == 5


async def test_transport_vehicle_limit_enforced(client, user_store):
    await seed_plans()
    token = seed_user(user_store, uid="uid-tr", active_profile="transport")
    headers = auth(token)

    # robust.md §6.3: Free = 1 vehicle, commission-only
    resp = await client.post("/v1/transport/vehicles", json=VEHICLE_BODY, headers=headers)
    assert resp.status_code == 201

    blocked = await client.post("/v1/transport/vehicles", json=VEHICLE_BODY, headers=headers)
    assert blocked.status_code == 402
    assert blocked.json()["error"]["code"] == "ENTITLEMENT_EXCEEDED"
    assert blocked.json()["error"]["limit"] == 1

    subscribed = await client.post(
        "/v1/billing/subscribe", json={"planId": "transport_pro"}, headers=headers
    )
    assert subscribed.status_code == 201
    # Pro = fleet of 5
    for _ in range(4):
        resp = await client.post("/v1/transport/vehicles", json=VEHICLE_BODY, headers=headers)
        assert resp.status_code == 201

    blocked = await client.post("/v1/transport/vehicles", json=VEHICLE_BODY, headers=headers)
    assert blocked.status_code == 402
    assert blocked.json()["error"]["limit"] == 5


async def test_subscription_status_from_webhook(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_webhook_secret", "whsec_test")
    user_store["subscriptions/sub_1"] = {
        "subId": "sub_1",
        "userId": "uid-1",
        "planId": "transport_pro",
        "status": "past_due",
        "provider": "razorpay_sub",
        "providerRef": "sub_test_1",
        "currentPeriodEnd": "2026-11-01T00:00:00+00:00",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    body = json.dumps(
        {
            "id": "evt_sub_1",
            "event": "subscription.charged",
            "payload": {"subscription": {"entity": {"id": "sub_test_1"}}},
        }
    ).encode()
    signature = hmac.new(b"whsec_test", body, hashlib.sha256).hexdigest()
    resp = await client.post(
        "/v1/payments/webhook", content=body, headers={"X-Razorpay-Signature": signature}
    )
    assert resp.status_code == 200
    assert user_store["subscriptions/sub_1"]["status"] == "active"


async def test_farmer_core_loop_has_no_entitlement_checks(client, user_store):
    await seed_plans()
    token = seed_user(user_store, uid="uid-farmer-b", active_profile="farmer")
    entry = {
        "title": "Sold wheat",
        "category": "sale",
        "type": "income",
        "amount": 5000,
        "date": "2026-09-13",
        "cropName": "Wheat",
    }
    resp = await client.post("/v1/diary/entries", json=entry, headers=auth(token))
    assert resp.status_code == 201

    plans = await client.get("/v1/billing/plans", params={"persona": "farmer"})
    farmer_plan = plans.json()["data"][0]
    assert farmer_plan["priceMonthlyPaisa"] == 0
    assert farmer_plan["limits"] == {}
