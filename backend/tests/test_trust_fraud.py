"""WS-03 trust & safety / M8 fraud + payout-anomaly tests."""
from app.services.ai import config_store
from app.services.settlements import run_settlements
from tests.test_admin import ADMIN_HEADERS
from tests.test_diary import auth, seed_user

PERIOD = ("2026-10-01", "2026-10-07")
ADMIN_MUTATION = {**ADMIN_HEADERS, "X-Admin-Role": "superadmin", "X-Audit-Reason": "review"}


def _seed_ring(user_store):
    """A circular-bidding ring: reciprocated broker deals + two shared devices."""
    for uid in ("ring-a", "ring-b", "ring-c"):
        seed_user(user_store, uid=uid, active_profile="broker")
    # all six directed edges → each member has two reciprocal counterparties
    for a, b in (
        ("ring-a", "ring-b"), ("ring-b", "ring-a"),
        ("ring-a", "ring-c"), ("ring-c", "ring-a"),
        ("ring-b", "ring-c"), ("ring-c", "ring-b"),
    ):
        user_store[f"broker_deals/deal_{a}_{b}"] = {
            "id": f"deal_{a}_{b}", "brokerId": a, "sellerUid": b, "status": "completed",
            "grossAmount": 1000, "createdAt": "2026-10-02T00:00:00+00:00",
        }
    # two device tokens shared by all three accounts
    for token in ("shared-token-1", "shared-token-2"):
        for uid in ("ring-a", "ring-b", "ring-c"):
            user_store[f"users/{uid}/devices/{token}"] = {
                "id": token, "token": token, "platform": "web",
            }
    for uid in ("ring-a", "ring-b", "ring-c"):
        user_store[f"settlements/st_{uid}"] = {
            "id": f"st_{uid}", "role": "broker", "entityId": uid,
            "status": "pending", "netRupees": 5000, "createdAt": "2026-10-02T00:00:00+00:00",
        }


async def test_fraud_scan_catches_seeded_ring(client, user_store):
    config_store.clear_cache()
    _seed_ring(user_store)

    resp = await client.post("/v1/jobs/fraud_scan")
    assert resp.status_code == 200

    for uid in ("ring-a", "ring-b", "ring-c"):
        assert user_store[f"settlements/st_{uid}"]["softHold"] is True
        queued = user_store[f"fraud_queue/fraud_{uid}"]
        assert queued["status"] == "open"
        assert queued["decisionId"]
        assert queued["reason"]
        assert float(queued["risk"]) > 0.8
        assert queued["pattern"] == "circular_bidding"
    config_store.clear_cache()


async def test_fraud_scan_flag_off_no_holds(client, user_store):
    _seed_ring(user_store)
    user_store["platform_config/ai"] = {
        "modules": {"trust_fraud": False}, "thresholds": {}, "automation": {},
    }
    config_store.clear_cache()

    resp = await client.post("/v1/jobs/fraud_scan")
    assert resp.status_code == 200
    assert not any(k.startswith("fraud_queue/") for k in user_store)
    assert not user_store["settlements/st_ring-a"].get("softHold")
    config_store.clear_cache()


async def test_legit_batch_unaffected(client, user_store):
    config_store.clear_cache()
    seed_user(user_store, uid="legit-1", active_profile="broker")
    user_store["settlements/st_legit"] = {
        "id": "st_legit", "role": "broker", "entityId": "legit-1",
        "status": "pending", "netRupees": 5000, "createdAt": "2026-10-02T00:00:00+00:00",
    }
    await client.post("/v1/jobs/fraud_scan")
    assert not user_store["settlements/st_legit"].get("softHold")
    assert not any(k.startswith("fraud_queue/") for k in user_store)
    config_store.clear_cache()


async def test_payout_anomaly_hold_and_release(client, user_store):
    config_store.clear_cache()
    # Anomalous line: a huge transport fare (net > ₹5,00,000) → held.
    user_store["vehicles/veh-big"] = {"id": "veh-big", "ownerId": "owner-big"}
    user_store["transport_bookings/tb-big"] = {
        "id": "tb-big", "status": "delivered", "date": "2026-10-02", "vehicleId": "veh-big",
        "fare": 6000000,
    }
    # Legit line stays under the anomaly threshold and settles.
    user_store["vehicles/veh-small"] = {"id": "veh-small", "ownerId": "owner-small"}
    user_store["transport_bookings/tb-small"] = {
        "id": "tb-small", "status": "delivered", "date": "2026-10-02", "vehicleId": "veh-small",
        "fare": 10000,
    }

    await run_settlements(*PERIOD)

    lines = {
        d["entityId"]: d
        for k, d in user_store.items()
        if k.startswith("settlements/") and d.get("role") == "transport"
    }
    big = lines["owner-big"]
    small = lines["owner-small"]
    assert big["held"] is True
    assert big["holdReason"] and big["decisionId"] and big["holdRole"] == "finance_admin"
    assert small.get("held") is not True

    # Release with a reason → audit_logs entry written.
    resp = await client.post(
        f"/v1/settlements/holds/{big['id']}/release",
        json={"reason": "verified legitimate payout"},
        headers=ADMIN_MUTATION,
    )
    assert resp.status_code == 200
    assert user_store[f"settlements/{big['id']}"]["held"] is False
    assert any(
        isinstance(v, dict) and v.get("action") == "settlement_hold_released" and v.get("reason")
        for v in user_store.values()
    )

    # Release without a reason → 422.
    user_store[f"settlements/{big['id']}"]["held"] = True
    resp = await client.post(
        f"/v1/settlements/holds/{big['id']}/release", json={"reason": ""}, headers=ADMIN_MUTATION
    )
    assert resp.status_code == 422
    config_store.clear_cache()


async def test_admin_fraud_queue_endpoint(client, user_store):
    user_store["fraud_queue/fraud_x"] = {
        "userId": "ring-a", "pattern": "circular_bidding", "risk": 0.9,
        "decisionId": "dec-1", "reason": "risk 0.9", "status": "open",
        "createdAt": "2026-10-02T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/fraud-queue", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert any(item["userId"] == "ring-a" for item in resp.json()["data"])

    resp = await client.get("/v1/admin/fraud-queue", headers=auth("plain-token"))
    assert resp.status_code == 403
