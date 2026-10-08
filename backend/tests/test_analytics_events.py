"""WS-09 analytics taxonomy tests — ingest dedupe, PII guard, north-star metrics."""
from datetime import datetime, timezone

from app.services.settlements import process_payouts
from tests.test_admin import ADMIN_HEADERS
from tests.test_diary import auth, seed_user


def _event(event_id, name, props=None, persona=None):
    return {"eventId": event_id, "name": name, "props": props or {}, "persona": persona}


async def test_ingest_and_dedupe(client, user_store):
    token = seed_user(user_store)
    batch = {
        "events": [
            _event("e1", "screen_view"),
            _event("e2", "task_shown"),
            _event("e3", "task_completed"),
        ]
    }
    resp = await client.post("/v1/analytics/events", json=batch, headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["applied"] == 3
    assert user_store["analytics_events/e1"]["serverTs"]
    assert user_store["analytics_events/e1"]["userId"] == "uid-1"

    resp = await client.post("/v1/analytics/events", json=batch, headers=auth(token))
    assert resp.json() == {"applied": 0, "duplicates": 3}
    events = [k for k in user_store if k.startswith("analytics_events/")]
    assert len(events) == 3


async def test_unknown_event_rejected(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/analytics/events", json={"events": [_event("x", "hacked_event")]}, headers=auth(token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "ANALYTICS_UNKNOWN_EVENT"


async def test_pii_in_props_rejected(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/analytics/events",
        json={"events": [_event("x", "screen_view", {"phone": "9876543210"})]},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "ANALYTICS_PII_BLOCKED"


async def test_north_star_metrics(client, user_store):
    now = datetime.now(timezone.utc).isoformat()

    def seed(event_id, name, uid, persona, props):
        user_store[f"analytics_events/{event_id}"] = {
            "eventId": event_id, "userId": uid, "persona": persona,
            "name": name, "props": props, "serverTs": now,
        }

    seed("t1", "transaction_completed", "u1", "farmer", {"gmv_paisa": 100000, "take_rate_paisa": 2000, "marketplace": "mandi"})
    seed("t2", "transaction_completed", "u2", "farmer", {"gmv_paisa": 50000, "take_rate_paisa": 1000, "marketplace": "mandi"})
    seed("p1", "plan_upgraded", "u1", None, {"plan": "pro"})
    seed("ts1", "task_shown", "u1", None, {})
    seed("ts2", "task_shown", "u2", None, {})
    seed("tc1", "task_completed", "u1", None, {})
    seed("ns1", "notification_sent", "u1", None, {})
    seed("dl1", "deep_link_completed", "u1", None, {})

    resp = await client.get("/v1/analytics/north-star", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["weeklyTransactingFarmers"] == 2
    assert body["gmvPerMarketplace"] == {"mandi": 150000}
    assert body["takeRateRevenuePaisa"] == 3000
    assert body["paidPlanConversion"] == 0.5
    assert body["tasksPerUserPerWeek"] == 0.5
    assert body["deepLinkCompletionRate"] == 1.0


async def test_settlement_emits_transaction_completed(client, user_store):
    user_store["settlements/st1"] = {
        "id": "st1", "role": "broker", "entityId": "u1", "status": "pending",
        "periodStart": "2026-10-01", "periodEnd": "2026-10-07",
        "grossRupees": 1000, "commissionRupees": 20, "netRupees": 980,
    }
    user_store["users/u1/bank_accounts/ac1"] = {
        "id": "ac1", "verifyStatus": "verified", "razorpayFundAccountId": "fa1", "isPrimary": True,
    }
    result = await process_payouts("2026-10-01", "2026-10-07")
    assert result["paid"] == 1

    event = user_store["analytics_events/txn_st1"]
    assert event["name"] == "transaction_completed"
    assert event["props"]["gmv_paisa"] == 100000
    assert event["props"]["take_rate_paisa"] == 2000
