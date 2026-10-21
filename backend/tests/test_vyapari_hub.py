"""Vyapari hub — endpoint tests for the Task 1-10 gaps.

Covers: seller business profile round-trip + merge, lot photos/coords +
submit-for-review + admin moderation, browse distance math, pickup agent CRUD
+ pickup scheduling (agentId/graceMinutes), pickup reminder cron idempotency,
sourcing recommendation ranking, rating tags, ad product/demand targeting,
diary CSV export and the seller -> direct-buyer directory. Role gates
(seller/farmer/admin) are asserted throughout.
"""
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user
from tests.test_users import _auth, _register

ADMIN = {"Authorization": "Bearer admin-token"}
ADMIN_MUTATION = {
    **ADMIN,
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "vyapari hub test",
}
CRON_SECRET = {"X-Cron-Secret": "s3cret"}

LOT_BODY = {
    "crop": "Soybean",
    "quantityQuintals": 40,
    "expectedRate": 4500,
    "harvestDate": "2026-10-25",
}


async def _seller_token(client):
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    return resp.json()["accessToken"]


async def _farmer_token(client, **overrides):
    resp = await _register(client, **overrides)
    return resp.json()["accessToken"]


def _mk_farmer(user_store, uid="uid-ramesh", name="Ramesh Jadhav", **extra):
    return seed_user(
        user_store,
        uid=uid,
        active_profile="farmer",
        name=name,
        state="Maharashtra",
        district="Pune",
        village="Khed",
        **extra,
    )


def _seed_lot(user_store, lot_id, farmer_id="uid-ramesh", **overrides):
    doc = {
        "id": lot_id,
        "farmerId": farmer_id,
        "crop": "Soybean",
        "variety": "Grade A",
        "grade": "A",
        "quantityQuintals": 40.0,
        "expectedRate": 4500,
        "status": "open",
        "createdAt": "2026-10-18T00:00:00+00:00",
    }
    doc.update(overrides)
    user_store[f"market_lots/{lot_id}"] = doc
    return doc


def _notifications(user_store, ntype):
    """Inbox notification docs for a type (digest queue rows excluded — those
    carry `uid` instead of `userId`)."""
    return [
        doc for doc in user_store.values()
        if isinstance(doc, dict) and doc.get("type") == ntype and "userId" in doc
    ]


# ---------------------------------------------------------------------------
# Task 1 — seller business profile
# ---------------------------------------------------------------------------

async def test_seller_profile_defaults_then_roundtrip_and_merge(client):
    token = await _seller_token(client)
    resp = await client.get("/v1/seller/profile", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["found"] is False
    assert body["operatingStates"] == []
    assert body["mandis"] == []
    assert body["businessType"] is None

    put_body = {
        "shopName": "Vijay Traders",
        "businessType": "wholesaler",
        "buyingCapacityBand": "2l_10l",
        "operatingStates": ["MH", "GJ"],
        "mandis": ["Pune", "Nasik"],
        "logoPath": "logos/vijay.png",
        "yearsInTrade": 12,
    }
    resp = await client.put("/v1/seller/profile", json=put_body, headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["found"] is True
    for key, value in put_body.items():
        assert body[key] == value

    # merge: gstNumber added, everything else preserved
    resp = await client.put(
        "/v1/seller/profile", json={"gstNumber": "27AAAAA0000A1Z5"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["gstNumber"] == "27AAAAA0000A1Z5"
    assert body["shopName"] == "Vijay Traders"
    assert body["operatingStates"] == ["MH", "GJ"]

    resp = await client.get("/v1/seller/profile", headers=_auth(token))
    assert resp.json()["businessType"] == "wholesaler"


async def test_seller_profile_write_doc_matches_persona_setup_doc(client, user_store):
    token = await _seller_token(client)
    await client.put(
        "/v1/seller/profile",
        json={"shopName": "Vijay Traders", "apmcLicense": "APMC-123"},
        headers=_auth(token),
    )
    doc = user_store["users/uid-1/role_profiles/seller"]
    assert doc["shopName"] == "Vijay Traders"
    assert doc["apmcLicense"] == "APMC-123"


async def test_seller_profile_requires_shop_name_on_first_write(client):
    token = await _seller_token(client)
    resp = await client.put(
        "/v1/seller/profile", json={"businessType": "retailer"}, headers=_auth(token)
    )
    assert resp.status_code == 422


async def test_seller_profile_role_gates(client, user_store):
    farmer = await _farmer_token(client)
    resp = await client.get("/v1/seller/profile", headers=_auth(farmer))
    assert resp.status_code == 403
    resp = await client.put(
        "/v1/seller/profile", json={"shopName": "X"}, headers=_auth(farmer)
    )
    assert resp.status_code == 403
    # unauthenticated
    resp = await client.get("/v1/seller/profile")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Task 2 — lot photos/coords, submit-for-review, moderation, browse distance
# ---------------------------------------------------------------------------

async def test_lot_photos_coords_roundtrip(client):
    token = await _farmer_token(client)
    resp = await client.post(
        "/v1/market/lots",
        json={
            **LOT_BODY,
            "photos": ["lots/p1.jpg", "lots/p2.jpg"],
            "lat": 18.52,
            "lng": 73.86,
            "village": "Khed",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["photos"] == ["lots/p1.jpg", "lots/p2.jpg"]
    assert body["lat"] == 18.52
    assert body["lng"] == 73.86
    assert body["village"] == "Khed"
    assert body["status"] == "open"

    resp = await client.get(f"/v1/market/lots/{body['id']}", headers=_auth(token))
    assert resp.json()["lat"] == 18.52

    # edit without lat/lng leaves coords untouched (merge write)
    resp = await client.put(
        f"/v1/market/lots/{body['id']}",
        json={**LOT_BODY, "expectedRate": 4600},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["expectedRate"] == 4600
    assert resp.json()["lat"] == 18.52
    assert resp.json()["village"] == "Khed"


async def test_lot_create_submit_for_review_goes_to_pending(client):
    token = await _farmer_token(client)
    resp = await client.post(
        "/v1/market/lots",
        json={**LOT_BODY, "submitForReview": True},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending_review"


async def test_submit_for_review_transitions_and_owner_only(client, user_store):
    token = await _farmer_token(client)
    lot = (await client.post("/v1/market/lots", json=LOT_BODY, headers=_auth(token))).json()

    # seller role cannot submit (farmer-only)
    seller = seed_user(user_store, uid="uid-vijay", active_profile="seller", name="Vijay")
    resp = await client.post(
        f"/v1/market/lots/{lot['id']}/submit-for-review", headers=auth(seller)
    )
    assert resp.status_code == 403

    # another farmer gets 404 (no existence leak)
    other = _mk_farmer(user_store, uid="uid-other", name="Other Farmer")
    resp = await client.post(
        f"/v1/market/lots/{lot['id']}/submit-for-review", headers=auth(other)
    )
    assert resp.status_code == 404

    # owner submits: open -> pending_review
    resp = await client.post(
        f"/v1/market/lots/{lot['id']}/submit-for-review", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending_review"

    # already pending -> 409
    resp = await client.post(
        f"/v1/market/lots/{lot['id']}/submit-for-review", headers=_auth(token)
    )
    assert resp.status_code == 409

    # rejected lot can be resubmitted
    user_store[f"market_lots/{lot['id']}"]["status"] = "rejected"
    resp = await client.post(
        f"/v1/market/lots/{lot['id']}/submit-for-review", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending_review"


async def test_admin_moderate_requires_reason_and_notifies(client, user_store):
    token = await _farmer_token(client)
    lot = (
        await client.post(
            "/v1/market/lots",
            json={**LOT_BODY, "submitForReview": True},
            headers=_auth(token),
        )
    ).json()

    # non-admin cannot moderate
    resp = await client.post(
        f"/v1/admin/market/lots/{lot['id']}/moderate",
        json={"action": "approve"},
        headers=_auth(token),
    )
    assert resp.status_code == 403

    # reject without reason -> 422
    resp = await client.post(
        f"/v1/admin/market/lots/{lot['id']}/moderate",
        json={"action": "reject"},
        headers=ADMIN_MUTATION,
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "reason" in resp.json()["error"]["fieldErrors"]

    # reject with reason -> rejected + moderation audit + owner notification
    resp = await client.post(
        f"/v1/admin/market/lots/{lot['id']}/moderate",
        json={"action": "reject", "reason": "photos not clear"},
        headers=ADMIN_MUTATION,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "rejected"
    assert body["previousStatus"] == "pending_review"
    assert body["moderation"]["action"] == "reject"
    assert body["moderation"]["reason"] == "photos not clear"

    lot_doc = user_store[f"market_lots/{lot['id']}"]
    assert lot_doc["status"] == "rejected"
    assert lot_doc["moderation"]["by"] == "uid-admin-test"

    notes = _notifications(user_store, "lot_moderated")
    assert len(notes) == 1
    assert notes[0]["userId"] == "uid-1"
    assert "rejected" in notes[0]["body"]

    # approving a rejected lot -> 409
    resp = await client.post(
        f"/v1/admin/market/lots/{lot['id']}/moderate",
        json={"action": "approve"},
        headers=ADMIN_MUTATION,
    )
    assert resp.status_code == 409

    # farmer resubmits, admin approves with a note -> open
    await client.post(
        f"/v1/market/lots/{lot['id']}/submit-for-review", headers=_auth(token)
    )
    resp = await client.post(
        f"/v1/admin/market/lots/{lot['id']}/moderate",
        json={"action": "approve", "reason": "looks good"},
        headers=ADMIN_MUTATION,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "open"
    assert user_store[f"market_lots/{lot['id']}"]["moderation"]["action"] == "approve"

    # takedown requires reason, works from open
    resp = await client.post(
        f"/v1/admin/market/lots/{lot['id']}/moderate",
        json={"action": "takedown"},
        headers=ADMIN_MUTATION,
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/v1/admin/market/lots/{lot['id']}/moderate",
        json={"action": "takedown", "reason": "policy violation"},
        headers=ADMIN_MUTATION,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "taken_down"
    assert user_store[f"market_lots/{lot['id']}"]["moderation"]["action"] == "takedown"


async def test_browse_distance_filter_math(client, user_store):
    token = await _farmer_token(client)
    _seed_lot(user_store, "lot-near", lat=18.53, lng=73.87)          # ~1.4 km from origin
    _seed_lot(user_store, "lot-far", lat=21.15, lng=79.09)           # Nagpur, ~700 km
    _seed_lot(user_store, "lot-nocoords")                            # skipped entirely
    _seed_lot(user_store, "lot-own", farmer_id="uid-1", lat=18.52, lng=73.86)

    resp = await client.get(
        "/v1/market/lots/browse",
        params={"lat": 18.52, "lng": 73.86, "maxDistanceKm": 100},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    ids = {d["id"] for d in data}
    assert ids == {"lot-near"}
    near = data[0]
    assert 0 < near["distanceKm"] < 5
    assert near["lat"] == 18.53
    assert near.get("village") is None  # not seeded, stays absent


async def test_browse_default_still_hides_pending_and_taken_down(client, user_store):
    token = await _farmer_token(client)
    _seed_lot(user_store, "lot-open")
    _seed_lot(user_store, "lot-pending", status="pending_review")
    _seed_lot(user_store, "lot-down", status="taken_down")
    _seed_lot(user_store, "lot-rejected", status="rejected")
    resp = await client.get("/v1/market/lots/browse", headers=_auth(token))
    assert {d["id"] for d in resp.json()["data"]} == {"lot-open"}
    # explicit status narrows differently
    resp = await client.get(
        "/v1/market/lots/browse", params={"status": "pending_review"}, headers=_auth(token)
    )
    assert {d["id"] for d in resp.json()["data"]} == {"lot-pending"}


# ---------------------------------------------------------------------------
# Task 3 — pickup agents + pickup scheduling + reminder cron
# ---------------------------------------------------------------------------

def _agent_body(**overrides):
    body = {
        "name": "Sham Driver",
        "phone": "+919876543210",
        "vehicleType": "Bolero Pickup",
        "vehicleNumber": "MH-12-AB-1234",
        "areas": ["Pune", "Khed"],
    }
    body.update(overrides)
    return body


async def test_pickup_agent_admin_crud_and_area_filter(client, user_store):
    farmer = _mk_farmer(user_store)
    # unauthenticated + non-admin are both rejected
    resp = await client.get("/v1/admin/pickup-agents")
    assert resp.status_code == 401
    resp = await client.get("/v1/admin/pickup-agents", headers=auth(farmer))
    assert resp.status_code == 403

    resp = await client.post(
        "/v1/admin/pickup-agents", json=_agent_body(), headers=ADMIN
    )
    assert resp.status_code == 201
    agent = resp.json()
    assert agent["active"] is True
    assert agent["rating"] == 0
    assert agent["id"].startswith("pa_")

    resp = await client.post(
        "/v1/admin/pickup-agents",
        json=_agent_body(name="Inactive Agent", areas=["Nagpur"]),
        headers=ADMIN,
    )
    inactive_id = resp.json()["id"]

    # public list: active only + area filter
    resp = await client.get("/v1/pickup/agents", headers=auth(farmer))
    assert resp.status_code == 200
    assert {a["id"] for a in resp.json()["items"]} == {agent["id"], inactive_id}
    resp = await client.get(
        "/v1/pickup/agents", params={"area": "khed"}, headers=auth(farmer)
    )
    assert [a["id"] for a in resp.json()["items"]] == [agent["id"]]
    resp = await client.get("/v1/pickup/agents")
    assert resp.status_code == 401

    # deactivate -> hidden from the public list, visible in admin list
    resp = await client.patch(
        f"/v1/admin/pickup-agents/{inactive_id}",
        json={"active": False},
        headers=ADMIN,
    )
    assert resp.status_code == 200
    assert resp.json()["active"] is False
    resp = await client.get("/v1/pickup/agents", headers=auth(farmer))
    assert {a["id"] for a in resp.json()["items"]} == {agent["id"]}
    resp = await client.get(
        "/v1/admin/pickup-agents", params={"active": "false"}, headers=ADMIN
    )
    assert [a["id"] for a in resp.json()["items"]] == [inactive_id]

    resp = await client.patch(
        "/v1/admin/pickup-agents/nope", json={"active": False}, headers=ADMIN
    )
    assert resp.status_code == 404


async def _purchase_with_pickup(client, user_store, pickup_extra=None, seed_config=None):
    """Buyer uid-1 books Ramesh's lot, pays advance, schedules pickup."""
    buyer = (await _register(client)).json()["accessToken"]
    _mk_farmer(user_store)
    _seed_lot(user_store, "lot-pick", quantityQuintals=10, expectedRate=2000)
    if seed_config is not None:
        user_store["app_config/current"] = seed_config
    purchase = (
        await client.post(
            "/v1/purchases", json={"lotId": "lot-pick"}, headers=_auth(buyer)
        )
    ).json()
    await client.post(
        f"/v1/purchases/{purchase['id']}/advance",
        json={"amount": 2000, "method": "upi"},
        headers=_auth(buyer),
    )
    body = {
        "date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "vehicleType": "Bolero Pickup",
        "address": "Khed, Pune",
    }
    body.update(pickup_extra or {})
    resp = await client.post(
        f"/v1/purchases/{purchase['id']}/pickup",
        json=body,
        headers=_auth(buyer),
    )
    return buyer, purchase["id"], resp


async def test_pickup_with_agent_and_default_grace(client, user_store):
    resp = await client.post(
        "/v1/admin/pickup-agents", json=_agent_body(), headers=ADMIN
    )
    agent_id = resp.json()["id"]

    buyer, purchase_id, resp = await _purchase_with_pickup(
        client, user_store, {"agentId": agent_id, "vehicleNumber": "MH-12-AB-1234"}
    )
    assert resp.status_code == 200
    pickup = resp.json()["pickup"]
    assert pickup["agentId"] == agent_id
    assert pickup["vehicleNumber"] == "MH-12-AB-1234"
    assert pickup["graceMinutes"] == 60  # no app_config doc -> default 60

    # app_config pickupGraceMinutes is honoured
    buyer2 = seed_user(user_store, uid="uid-buyer2", active_profile="seller", name="B2")
    _seed_lot(user_store, "lot-pick2", quantityQuintals=5, expectedRate=2000)
    user_store["app_config/current"] = {"id": "current", "pickupGraceMinutes": 90}
    purchase2 = (
        await client.post(
            "/v1/purchases", json={"lotId": "lot-pick2"}, headers=auth(buyer2)
        )
    ).json()
    await client.post(
        f"/v1/purchases/{purchase2['id']}/advance",
        json={"amount": 1000},
        headers=auth(buyer2),
    )
    resp = await client.post(
        f"/v1/purchases/{purchase2['id']}/pickup",
        json={"date": "2026-10-21T07:00:00+00:00"},
        headers=auth(buyer2),
    )
    assert resp.json()["pickup"]["graceMinutes"] == 90

    # explicit graceMinutes wins
    buyer3 = seed_user(user_store, uid="uid-buyer3", active_profile="seller", name="B3")
    _seed_lot(user_store, "lot-pick3", quantityQuintals=5, expectedRate=2000)
    purchase3 = (
        await client.post(
            "/v1/purchases", json={"lotId": "lot-pick3"}, headers=auth(buyer3)
        )
    ).json()
    await client.post(
        f"/v1/purchases/{purchase3['id']}/advance",
        json={"amount": 1000},
        headers=auth(buyer3),
    )
    resp = await client.post(
        f"/v1/purchases/{purchase3['id']}/pickup",
        json={"date": "2026-10-21T07:00:00+00:00", "graceMinutes": 45},
        headers=auth(buyer3),
    )
    assert resp.json()["pickup"]["graceMinutes"] == 45


async def test_pickup_unknown_or_inactive_agent_rejected(client, user_store):
    resp = await client.post(
        "/v1/admin/pickup-agents", json=_agent_body(), headers=ADMIN
    )
    agent_id = resp.json()["id"]

    _, _, resp = await _purchase_with_pickup(client, user_store, {"agentId": "pa-nope"})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PICKUP_AGENT_NOT_FOUND"

    await client.patch(
        f"/v1/admin/pickup-agents/{agent_id}", json={"active": False}, headers=ADMIN
    )
    _, _, resp = await _purchase_with_pickup(client, user_store, {"agentId": agent_id})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PICKUP_AGENT_INACTIVE"


async def test_pickup_reminders_cron_idempotent(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    buyer, purchase_id, resp = await _purchase_with_pickup(
        client,
        user_store,
        {"date": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()},
    )
    assert resp.status_code == 200

    # wrong secret -> 401
    resp = await client.post(
        "/v1/jobs/pickup/reminders", headers={"X-Cron-Secret": "wrong"}
    )
    assert resp.status_code == 401

    resp = await client.post("/v1/jobs/pickup/reminders", headers=CRON_SECRET)
    assert resp.status_code == 200
    body = resp.json()
    assert body["reminders24h"] == 2
    assert body["reminders2h"] == 0

    # deterministic ids — one per trade party
    note_buyer = user_store[f"notifications/pickup24_{purchase_id}_uid-1"]
    note_farmer = user_store[f"notifications/pickup24_{purchase_id}_uid-ramesh"]
    assert note_buyer["type"] == "pickup_reminder_24h"
    assert note_farmer["type"] == "pickup_reminder_24h"
    assert (note_buyer["data"] or {}).get("deepLink") == "/dashboard/p/purchases"

    # second run is idempotent
    resp = await client.post("/v1/jobs/pickup/reminders", headers=CRON_SECRET)
    assert resp.json()["reminders24h"] == 0
    notes = _notifications(user_store, "pickup_reminder_24h")
    assert len(notes) == 2


async def test_pickup_reminders_2h_window(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    _, purchase_id, resp = await _purchase_with_pickup(
        client,
        user_store,
        {"date": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()},
    )
    assert resp.status_code == 200
    resp = await client.post("/v1/jobs/pickup/reminders", headers=CRON_SECRET)
    body = resp.json()
    assert body["reminders24h"] == 0
    assert body["reminders2h"] == 2
    assert user_store[f"notifications/pickup2_{purchase_id}_uid-1"]["type"] == "pickup_reminder_2h"


# ---------------------------------------------------------------------------
# Task 4 — sourcing recommendations
# ---------------------------------------------------------------------------

def _seller_with_profile(user_store, with_profile=True):
    token = seed_user(
        user_store,
        uid="uid-vijay",
        active_profile="seller",
        name="Vijay Vyapari",
        lat=18.52,
        lng=73.86,
    )
    if with_profile:
        profile = {
            "shopName": "Vijay Traders",
            "businessType": "wholesaler",
            "operatingStates": ["MH"],
            "mandis": ["Pune"],
        }
        user_store["users/uid-vijay/role_profiles/seller"] = profile
    return token


async def test_sourcing_ranking_order_and_reasons(client, user_store):
    token = _seller_with_profile(user_store)
    # purchase history: soybean
    user_store["users/uid-vijay/seller_procurement/proc-1"] = {
        "id": "proc-1", "sellerId": "uid-vijay", "crop": "Soybean",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    now = "2026-10-19T00:00:00+00:00"
    _seed_lot(user_store, "lot-perfect", state="MH", village="Pune",
              lat=18.53, lng=73.87, createdAt=now)
    _seed_lot(user_store, "lot-state", state="MH", village="Nagpur",
              lat=21.15, lng=79.09, createdAt=now)
    _seed_lot(user_store, "lot-plain", state="KA", village="Hubli", crop="Onion",
              lat=15.36, lng=75.12, createdAt=now)
    _seed_lot(user_store, "lot-no-coords", state="KA", village="Belgaum", createdAt=now)
    _seed_lot(user_store, "lot-own", farmer_id="uid-vijay", state="MH", createdAt=now)

    resp = await client.get("/v1/seller/sourcing-recommendations", headers=auth(token))
    assert resp.status_code == 200
    items = resp.json()["items"]
    ids = [i["lotId"] for i in items]
    assert ids[0] == "lot-perfect"
    assert ids.index("lot-state") < ids.index("lot-plain")
    assert "lot-own" not in ids

    top = items[0]
    assert top["matchScore"] == 8  # 3 state + 2 mandi + 2 crop + 1 coords
    assert top["pricePaisa"] == 4500 * 100
    assert top["distanceKm"] is not None
    assert any("operating state" in r for r in top["reasons"])
    assert any("mandi" in r for r in top["reasons"])
    assert any("traded Soybean" in r for r in top["reasons"])

    plain = next(i for i in items if i["lotId"] == "lot-plain")
    assert plain["matchScore"] == 1  # coords only (Onion not in trade history)
    assert plain["reasons"] == []
    no_coords = next(i for i in items if i["lotId"] == "lot-no-coords")
    assert no_coords["matchScore"] == 2  # soybean history, no coords
    assert no_coords["distanceKm"] is None


async def test_sourcing_empty_profile_still_returns_lots_by_recency(client, user_store):
    token = _seller_with_profile(user_store, with_profile=False)
    _seed_lot(user_store, "lot-new", createdAt="2026-10-19T00:00:00+00:00")
    _seed_lot(user_store, "lot-old", createdAt="2026-10-10T00:00:00+00:00")
    resp = await client.get("/v1/seller/sourcing-recommendations", headers=auth(token))
    items = resp.json()["items"]
    assert [i["lotId"] for i in items] == ["lot-new", "lot-old"]
    assert all(i["reasons"] == [] for i in items)


async def test_sourcing_role_gate(client):
    farmer = await _farmer_token(client)
    resp = await client.get("/v1/seller/sourcing-recommendations", headers=_auth(farmer))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Task 5 — rating tags
# ---------------------------------------------------------------------------

def _transport_booking(user_store, booking_id="trb-tags", user_id="uid-1",
                       transporter_id="uid-ramesh"):
    user_store[f"transport_bookings/{booking_id}"] = {
        "id": booking_id,
        "userId": user_id,
        "vehicleType": "Tata Ace",
        "status": "delivered",
        "transporterId": transporter_id,
        "fare": 850,
        "createdAt": "2026-10-15T10:00:00+00:00",
    }


async def test_rating_tags_stored_and_returned(client, user_store):
    token = seed_user(user_store, uid="uid-1", active_profile="farmer", name="Vijay")
    ratee = _mk_farmer(user_store)
    _transport_booking(user_store)
    resp = await client.post(
        "/v1/ratings",
        json={
            "bookingKind": "transport",
            "bookingId": "trb-tags",
            "stars": 5,
            "comment": "on time",
            "tags": ["fair_price", "on_time"],
        },
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["tags"] == ["fair_price", "on_time"]
    rating_id = resp.json()["id"]

    # ratee sees tags on /ratings/mine
    resp = await client.get("/v1/ratings/mine", headers=auth(ratee))
    assert resp.status_code == 200
    recent = resp.json()["recent"]
    assert recent[0]["tags"] == ["fair_price", "on_time"]

    # ratee replies, rater sees tags on /ratings/given
    resp = await client.post(
        f"/v1/ratings/{rating_id}/reply",
        json={"reply": "thank you!"},
        headers=auth(ratee),
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/ratings/given", headers=auth(token))
    assert resp.json()["items"][0]["tags"] == ["fair_price", "on_time"]


async def test_rating_tags_validation(client, user_store):
    token = seed_user(user_store, uid="uid-1", active_profile="farmer")
    _transport_booking(user_store)
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": "trb-tags", "stars": 4,
              "tags": ["x"]},
        headers=auth(token),
    )
    assert resp.status_code == 422
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": "trb-tags", "stars": 4,
              "tags": ["a", "b", "c", "d", "e", "f"]},
        headers=auth(token),
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Task 6 — ad targeting product/demand
# ---------------------------------------------------------------------------

_AD_BODY = {
    "title": "Soybean surplus sale",
    "headline": "Fresh stock from Vijay Traders",
    "description": "grade A soybean",
    "bannerUrl": "https://cdn.example.com/banner.png",
}


async def test_ad_product_target_validation(client, user_store):
    token = _seller_with_profile(user_store)
    resp = await client.post(
        "/v1/ads",
        json={**_AD_BODY, "targetType": "product", "targetId": "prod-missing"},
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "AD_TARGET_NOT_FOUND"

    user_store["products/prod-1"] = {
        "id": "prod-1", "title": "Soybean 45kg", "sellerId": "uid-vijay",
    }
    resp = await client.post(
        "/v1/ads",
        json={**_AD_BODY, "targetType": "product", "targetId": "prod-1"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["targetType"] == "product"


async def test_ad_demand_target_validation_and_update(client, user_store):
    token = _seller_with_profile(user_store)
    user_store["demands/dmd-1"] = {
        "id": "dmd-1", "buyerId": "uid-vijay", "crop": "Soybean", "status": "open",
    }
    resp = await client.post(
        "/v1/ads",
        json={**_AD_BODY, "targetType": "demand", "targetId": "dmd-1"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    ad_id = resp.json()["id"]

    # update to a missing demand -> 404
    resp = await client.put(
        f"/v1/ads/{ad_id}",
        json={"targetType": "demand", "targetId": "dmd-nope"},
        headers=auth(token),
    )
    assert resp.status_code == 404

    resp = await client.put(
        f"/v1/ads/{ad_id}",
        json={"targetType": "demand", "targetId": "dmd-1"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["targetId"] == "dmd-1"


# ---------------------------------------------------------------------------
# Task 7 — diary CSV export
# ---------------------------------------------------------------------------

async def test_diary_csv_export(client):
    token = await _farmer_token(client)
    for entry in (
        {"title": "Urea 1 bag", "category": "fertilizer", "type": "expense",
         "amount": 450, "date": "2026-10-02", "party": "Krishi Kendra",
         "tradeType": "buy", "quantity": 1, "unit": "bag", "cropName": "Soybean"},
        {"title": "Soybean sale", "category": "produce_sale", "type": "income",
         "amount": 18000, "date": "2026-10-05", "party": "Vijay Traders",
         "tradeType": "sell", "quantity": 4, "unit": "quintal",
         "cropName": "Soybean", "notes": "grade A"},
    ):
        resp = await client.post("/v1/diary/entries", json=entry, headers=_auth(token))
        assert resp.status_code == 201

    resp = await client.get(
        "/v1/diary/report.csv?from=2026-10-01&to=2026-10-31", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert 'attachment; filename="diary-report.csv"' in resp.headers["content-disposition"]
    text = resp.text
    header = text.splitlines()[0]
    assert header == "date,title,category,type,tradeType,quantity,unit,amountPaisa,party,cropName,notes"
    assert "Soybean sale" in text
    assert "1800000" in text  # ₹18,000 -> 1,800,000 paisa
    assert "45000" in text    # ₹450 -> 45,000 paisa
    # outside the window -> excluded
    await client.post(
        "/v1/diary/entries",
        json={"title": "Old entry", "category": "misc", "type": "expense",
              "amount": 10, "date": "2026-09-01"},
        headers=_auth(token),
    )
    resp = await client.get(
        "/v1/diary/report.csv?from=2026-10-01&to=2026-10-31", headers=_auth(token)
    )
    assert "Old entry" not in resp.text


async def test_diary_csv_role_gate(client, user_store):
    # The diary CSV report is gated to diary-enabled personas; a broker has none.
    token = seed_user(user_store, active_profile="broker")
    resp = await client.get("/v1/diary/report.csv", headers=auth(token))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Task 8 — saved-search alert cron
# ---------------------------------------------------------------------------

async def test_saved_search_alert_cron(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    token = _seller_with_profile(user_store)
    resp = await client.post(
        "/v1/saved-searches",
        json={"crop": "soybean", "state": "MH", "minPrice": 1000},
        headers=auth(token),
    )
    assert resp.status_code == 201
    search_id = resp.json()["id"]

    # matching + non-matching lots in the last 24h
    _seed_lot(user_store, "lot-match", state="MH", expectedRate=4500,
              createdAt=datetime.now(timezone.utc).isoformat())
    # state mismatch (search is MH-only)
    _seed_lot(user_store, "lot-ka", state="KA", expectedRate=4500,
              createdAt=datetime.now(timezone.utc).isoformat())
    # too old for the 24h window
    _seed_lot(user_store, "lot-old", state="MH", expectedRate=4500,
              createdAt="2026-10-01T00:00:00+00:00")
    # the search owner's own lot must never alert them
    _seed_lot(user_store, "lot-own-seller", farmer_id="uid-vijay", state="MH",
              createdAt=datetime.now(timezone.utc).isoformat())

    resp = await client.post("/v1/jobs/saved-search-alerts", headers=CRON_SECRET)
    assert resp.status_code == 200
    assert resp.json()["alerts"] == 1

    note = user_store[f"notifications/savedalert_{search_id}_lot-match"]
    assert note["type"] == "saved_search_alert"
    assert note["userId"] == "uid-vijay"
    assert "Soybean" in note["body"] and "4500" in note["body"]

    # idempotent rerun
    resp = await client.post("/v1/jobs/saved-search-alerts", headers=CRON_SECRET)
    assert resp.json()["alerts"] == 0
    alerts = _notifications(user_store, "saved_search_alert")
    assert len(alerts) == 1


async def test_saved_search_alert_respects_disabled_config(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    token = _seller_with_profile(user_store)
    resp = await client.post(
        "/v1/saved-searches", json={"crop": "soybean"}, headers=auth(token)
    )
    search_id = resp.json()["id"]
    await client.post(
        f"/v1/saved-searches/{search_id}/alerts",
        json={"enabled": False},
        headers=auth(token),
    )
    _seed_lot(user_store, "lot-match", state="MH",
              createdAt=datetime.now(timezone.utc).isoformat())
    resp = await client.post("/v1/jobs/saved-search-alerts", headers=CRON_SECRET)
    assert resp.json()["alerts"] == 0


# ---------------------------------------------------------------------------
# Task 9 — seller -> direct-buyer directory
# ---------------------------------------------------------------------------

def _seed_direct_buyer(user_store, uid="uid-hotel", name="Hotel Owner",
                       business="Shree Foods", categories=("vegetables",),
                       state="Maharashtra", with_kyc=True):
    seed_user(
        user_store, uid=uid, active_profile="directBuyer", name=name,
        state=state, district="Pune", village="Camp",
    )
    user_store[f"users/{uid}/role_profiles/directBuyer"] = {
        "companyName": business,
        "buyerType": "hotel",
        "categories": list(categories),
    }
    if with_kyc:
        user_store[f"kyc_cases/kyc_{uid[:8]}_directBuyer"] = {
            "caseId": f"kyc_{uid[:8]}_directBuyer",
            "userId": uid,
            "persona": "directBuyer",
            "status": "verified",
            "docs": [],
        }


async def test_seller_buyers_directory_shape_and_filters(client, user_store):
    token = _seller_with_profile(user_store)
    _seed_direct_buyer(user_store)
    _seed_direct_buyer(user_store, uid="uid-proc", name="Processor Owner",
                       business="Agro Processor", categories=("grains",),
                       state="Gujarat", with_kyc=False)
    user_store["demands/dmd-1"] = {
        "id": "dmd-1", "buyerId": "uid-hotel", "crop": "Soybean", "status": "open",
    }
    user_store["demands/dmd-2"] = {
        "id": "dmd-2", "buyerId": "uid-hotel", "crop": "Onion", "status": "closed",
    }

    resp = await client.get("/v1/seller/buyers", headers=auth(token))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 2
    # verified buyer first
    hotel = items[0]
    assert hotel["uid"] == "uid-hotel"
    assert hotel["businessName"] == "Shree Foods"
    assert hotel["name"] == "Hotel Owner"
    assert hotel["categories"] == ["vegetables"]
    assert hotel["state"] == "Maharashtra"
    assert hotel["city"] == "Pune"
    assert hotel["verified"] is True
    assert hotel["requirementsCount"] == 1  # open demand only
    assert hotel["pastDealingsCount"] == 0

    processor = items[1]
    assert processor["verified"] is False
    assert processor["requirementsCount"] == 0

    # filters
    resp = await client.get("/v1/seller/buyers", params={"state": "gujarat"},
                            headers=auth(token))
    assert [b["uid"] for b in resp.json()["items"]] == ["uid-proc"]
    resp = await client.get("/v1/seller/buyers", params={"category": "grains"},
                            headers=auth(token))
    assert [b["uid"] for b in resp.json()["items"]] == ["uid-proc"]
    resp = await client.get("/v1/seller/buyers", params={"q": "shree"},
                            headers=auth(token))
    assert [b["uid"] for b in resp.json()["items"]] == ["uid-hotel"]
    resp = await client.get("/v1/seller/buyers", params={"q": "zzz"},
                            headers=auth(token))
    assert resp.json()["items"] == []


async def test_seller_buyers_role_gate(client, user_store):
    farmer = _mk_farmer(user_store)
    resp = await client.get("/v1/seller/buyers", headers=auth(farmer))
    assert resp.status_code == 403


async def test_seller_buyers_past_dealings(client, user_store):
    token = _seller_with_profile(user_store)
    _seed_direct_buyer(user_store)
    # a completed purchase between the seller (as farmer side) and the buyer
    user_store["purchases/pur-1"] = {
        "id": "pur-1", "buyerId": "uid-hotel", "farmerId": "uid-vijay",
        "crop": "Soybean", "status": "completed",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["purchases/pur-2"] = {
        "id": "pur-2", "buyerId": "uid-hotel", "farmerId": "uid-vijay",
        "crop": "Soybean", "status": "advancePaid",
        "createdAt": "2026-10-02T00:00:00+00:00",
    }
    resp = await client.get("/v1/seller/buyers", headers=auth(token))
    hotel = resp.json()["items"][0]
    assert hotel["pastDealingsCount"] == 1  # completed only


# ---------------------------------------------------------------------------
# Task 10 — notification types registered
# ---------------------------------------------------------------------------

async def test_new_notification_types_have_deep_links_and_category(client, user_store):
    from app.services.notify import DEEP_LINKS, TYPE_CATEGORY

    for ntype in ("lot_moderated", "pickup_reminder_24h", "pickup_reminder_2h",
                  "saved_search_alert"):
        assert ntype in DEEP_LINKS, ntype
        assert ntype in TYPE_CATEGORY, ntype
