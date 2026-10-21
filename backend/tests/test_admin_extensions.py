"""Tests for the P2 admin backend additions.

Covers: transport booking/driver/vehicle monitor, subscriptions join, escrow
holdings totals, transactions & crops reports, master-data CRUD layered over
static reference data, ad moderation + ads pricing, referrals config,
tree-survival coin mint idempotency, carbon & land-records config (key
masking), grace window + pickup exceptions, chatbot intents/fallback config,
KYC request-more, sellers join, marketplace categories CRUD, and the advisory
article CMS + farmer-facing read.
"""
from datetime import datetime, timedelta, timezone

from tests.test_diary import auth, seed_user

ADMIN_HEADERS = {"Authorization": "Bearer admin-token"}
ADMIN_MUTATION_HEADERS = {
    **ADMIN_HEADERS,
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "admin extensions test",
}
PLAIN_HEADERS = {"Authorization": "Bearer plain-token"}

NOW = datetime.now(timezone.utc)


def _past_iso(minutes: int) -> str:
    return (NOW - timedelta(minutes=minutes)).isoformat()


# ---------------------------------------------------------------------------
# Transport monitor (admin_sop_logistics)
# ---------------------------------------------------------------------------

async def test_transport_booking_detail_with_offers_expenses_escrow(client, user_store):
    seed_user(user_store, uid="u-farmer-1")
    seed_user(user_store, uid="u-transporter-1", active_profile="transport")
    user_store["transport_bookings/tb-1"] = {
        "id": "tb-1",
        "status": "accepted",
        "userId": "u-farmer-1",
        "transporterId": "u-transporter-1",
        "fare": 4200,
        "escrow": {"status": "held", "amountPaise": 420000, "fundedAt": _past_iso(120)},
        "waypointsLog": [{"waypoint": "accepted", "time": _past_iso(100)}],
        "lastLocation": {"lat": 19.99, "lng": 73.79, "updatedAt": _past_iso(5)},
        "pod": {"photos": ["https://img/pod1.jpg"], "receiverName": "Ramesh"},
        "createdAt": _past_iso(200),
    }
    user_store["transport_bookings/tb-1/offers/of-1"] = {
        "id": "of-1", "bookingId": "tb-1", "amountPaise": 400000, "createdAt": _past_iso(150)
    }
    user_store["transport_bookings/tb-1/expenses/exp-1"] = {
        "id": "exp-1", "bookingId": "tb-1", "category": "diesel", "amount": 1500,
        "createdAt": _past_iso(60),
    }

    resp = await client.get("/v1/admin/transport/bookings/tb-1", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["booking"]["id"] == "tb-1"
    assert body["booking"]["fare"] == 4200
    assert body["escrow"]["status"] == "held"
    assert body["escrow"]["amountPaise"] == 420000
    assert len(body["offers"]) == 1
    assert body["offers"][0]["amountPaise"] == 400000
    assert len(body["expenses"]) == 1
    assert len(body["waypointsLog"]) == 1
    assert body["lastLocation"]["lat"] == 19.99
    assert body["podPhotos"] == ["https://img/pod1.jpg"]
    assert body["parties"]["u-farmer-1"]["name"] == "Ram Patil"

    resp = await client.get("/v1/admin/transport/bookings/nope", headers=ADMIN_HEADERS)
    assert resp.status_code == 404


async def test_transport_drivers_joined_with_transporter(client, user_store):
    seed_user(user_store, uid="u-owner-1", active_profile="transport")
    user_store["users/u-owner-1"].update({"name": "Fleet Owner", "phone": "+919800000001"})
    user_store["users/drv-1"] = {
        "id": "drv-1",
        "name": "Kailash Driver",
        "phone": "+919800000002",
        "linkedProfiles": ["driver"],
        "primaryProfile": "driver",
        "fleetOwnerId": "u-owner-1",
        "active": True,
        "createdAt": _past_iso(50),
    }
    resp = await client.get("/v1/admin/transport/drivers", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    row = body["data"][0]
    assert row["id"] == "drv-1"
    assert row["transporterName"] == "Fleet Owner"
    assert row["transporterPhone"] == "+919800000001"

    resp = await client.get("/v1/admin/transport/drivers", headers=PLAIN_HEADERS)
    assert resp.status_code == 403


async def test_transport_vehicles_validity_fields_and_driver(client, user_store):
    seed_user(user_store, uid="u-owner-2", active_profile="transport")
    user_store["vehicles/veh-1"] = {
        "id": "veh-1",
        "ownerId": "u-owner-2",
        "vehicleType": "Tata Ace",
        "registrationNo": "MH-12-AB-1234",
        "docStatus": "verified",
        "rcStatus": "valid",
        "insuranceExpiry": "2027-01-01T00:00:00+00:00",
        "permitExpiry": "2026-12-01T00:00:00+00:00",
        "fitnessExpiry": "2026-11-01T00:00:00+00:00",
        "pucExpiry": "2027-02-01T00:00:00+00:00",
        "driverName": "Kailash Driver",
        "driverPhone": "+919800000002",
        "active": True,
        "createdAt": _past_iso(40),
    }
    resp = await client.get("/v1/admin/transport/vehicles", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    row = resp.json()["data"][0]
    assert row["insuranceExpiry"] == "2027-01-01T00:00:00+00:00"
    assert row["permitExpiry"] == "2026-12-01T00:00:00+00:00"
    assert row["fitnessExpiry"] == "2026-11-01T00:00:00+00:00"
    assert row["rcStatus"] == "valid"
    assert row["assignedDriverName"] == "Kailash Driver"
    assert row["ownerName"] == "Ram Patil"

    resp = await client.get(
        "/v1/admin/transport/vehicles", params={"status": "pending"}, headers=ADMIN_HEADERS
    )
    assert resp.json()["total"] == 0


async def test_grace_window_roundtrip_and_pickup_exceptions(client, user_store):
    resp = await client.put(
        "/v1/admin/platform-config/grace-window",
        json={"pickupGraceMinutes": 30, "dropGraceMinutes": 45, "autoCancelEnabled": True},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/admin/platform-config/grace-window", headers=ADMIN_HEADERS)
    assert resp.json()["pickupGraceMinutes"] == 30
    assert resp.json()["autoCancelEnabled"] is True

    user_store["transport_bookings/stuck-1"] = {
        "id": "stuck-1",
        "status": "accepted",
        "pickupTime": _past_iso(120),
        "pickup": "Nashik",
    }
    user_store["transport_bookings/fresh-1"] = {
        "id": "fresh-1",
        "status": "requested",
        "pickupTime": _past_iso(10),
    }
    user_store["transport_bookings/enroute-1"] = {
        "id": "enroute-1",
        "status": "enRoute",
        "pickupTime": _past_iso(500),
    }

    resp = await client.get("/v1/admin/exceptions/pickup", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    row = body["data"][0]
    assert row["bookingId"] == "stuck-1"
    assert row["minutesOverdue"] >= 119
    assert row["graceMinutes"] == 30
    assert row["autoCancelEnabled"] is True

    resp = await client.get("/v1/admin/exceptions/pickup", headers=PLAIN_HEADERS)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Subscriptions / escrow / reports (admin_sop_finance)
# ---------------------------------------------------------------------------

async def test_subscriptions_joined_with_user_and_plan(client, user_store):
    seed_user(user_store, uid="u-sub-1", active_profile="seller")
    user_store["users/u-sub-1"].update({"name": "Seller Sub", "phone": "+919811112222"})
    user_store["plans/pro_seller"] = {
        "planId": "pro_seller", "name": "Seller Pro", "tier": "pro", "priceMonthlyPaisa": 49900
    }
    user_store["subscriptions/sub-1"] = {
        "subId": "sub-1",
        "userId": "u-sub-1",
        "planId": "pro_seller",
        "status": "active",
        "provider": "razorpay_sub",
        "createdAt": _past_iso(30),
    }
    resp = await client.get("/v1/admin/subscriptions", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    row = resp.json()["data"][0]
    assert row["userName"] == "Seller Sub"
    assert row["userPhone"] == "+919811112222"
    assert row["persona"] == "seller"
    assert row["plan"]["name"] == "Seller Pro"

    resp = await client.get(
        "/v1/admin/subscriptions", params={"persona": "farmer"}, headers=ADMIN_HEADERS
    )
    assert resp.json()["total"] == 0

    resp = await client.get("/v1/admin/subscriptions", headers=PLAIN_HEADERS)
    assert resp.status_code == 403


async def test_escrow_holdings_totals(client, user_store):
    seed_user(user_store, uid="u-buyer-1")
    user_store["purchases/pur-1"] = {
        "id": "pur-1",
        "buyerId": "u-buyer-1",
        "farmerName": "Ram Patil",
        "escrow": {"status": "held", "amount": 1000.0, "fundedAt": _past_iso(300)},
        "createdAt": _past_iso(400),
    }
    user_store["purchases/pur-2"] = {
        "id": "pur-2",
        "buyerId": "u-buyer-1",
        "escrow": {"status": "released", "amount": 500.0, "fundedAt": _past_iso(500)},
        "createdAt": _past_iso(600),
    }
    user_store["transport_bookings/tb-esc"] = {
        "id": "tb-esc",
        "userId": "u-buyer-1",
        "escrow": {"status": "held", "amountPaise": 50000, "fundedAt": _past_iso(100)},
        "createdAt": _past_iso(120),
    }

    resp = await client.get("/v1/admin/escrow/holdings", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    totals = body["totals"]
    assert totals["totalAmountPaise"] == 1000 * 100 + 50000
    assert totals["byKind"]["purchase"]["count"] == 1
    assert totals["byKind"]["purchase"]["amountPaise"] == 100000
    assert totals["byKind"]["transport_booking"]["amountPaise"] == 50000
    kinds = {r["refId"]: r["kind"] for r in body["data"]}
    assert kinds == {"pur-1": "purchase", "tb-esc": "transport_booking"}

    resp = await client.get("/v1/admin/escrow/holdings", headers=PLAIN_HEADERS)
    assert resp.status_code == 403


async def test_transactions_report_json_and_csv(client, user_store):
    day_in = (NOW - timedelta(days=2)).date().isoformat()
    day_out = (NOW - timedelta(days=10)).date().isoformat()
    user_store["transport_bookings/tb-r"] = {
        "id": "tb-r", "status": "delivered", "fare": 1500,
        "createdAt": f"{day_in}T10:00:00+00:00",
    }
    user_store["orders/ord-r"] = {
        "id": "ord-r", "status": "delivered", "total": 999.0, "finalTotal": 899.0,
        "createdAt": f"{day_in}T11:00:00+00:00", "userId": "u-1",
    }
    user_store["settlements/stl-r"] = {
        "id": "stl-r", "status": "paid", "netRupees": 700.0,
        "createdAt": f"{day_out}T09:00:00+00:00",
    }

    resp = await client.get(
        "/v1/admin/reports/transactions",
        params={"from": day_in, "to": day_in},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    amounts = {r["kind"]: r["amountPaise"] for r in body["data"]}
    assert amounts["transport_booking"] == 150000
    assert amounts["order"] == 89900

    resp = await client.get(
        "/v1/admin/reports/transactions",
        params={"from": day_in, "to": day_in, "format": "csv"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "transport_booking" in resp.text


async def test_crops_report_aggregates_lots(client, user_store):
    user_store["market_lots/lot-1"] = {
        "id": "lot-1", "crop": "Onion", "quantityQuintals": 100.0, "expectedRate": 1500
    }
    user_store["market_lots/lot-2"] = {
        "id": "lot-2", "crop": "Onion", "quantityQuintals": 50.0, "expectedRate": 1600
    }
    user_store["market_lots/lot-3"] = {
        "id": "lot-3", "crop": "Wheat", "quantityQuintals": 200.0, "expectedRate": 2400
    }
    resp = await client.get("/v1/admin/reports/crops", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    rows = {r["crop"]: r for r in resp.json()["data"]}
    assert rows["Onion"]["lots"] == 2
    assert rows["Onion"]["volumeQuintals"] == 150.0
    assert rows["Onion"]["valueRupees"] == 100 * 1500 + 50 * 1600
    assert rows["Wheat"]["volumeQuintals"] == 200.0

    resp = await client.get("/v1/admin/reports/crops", params={"format": "csv"}, headers=ADMIN_HEADERS)
    assert resp.headers["content-type"].startswith("text/csv")


# ---------------------------------------------------------------------------
# Master data management (admin_sop_platform)
# ---------------------------------------------------------------------------

async def test_master_merge_override_over_static(client, user_store):
    resp = await client.get("/v1/admin/master/states", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 28
    assert all(r["source"] == "static" for r in body["data"])
    mah = next(r for r in body["data"] if r["code"] == "maharashtra")
    assert mah["name"] == "Maharashtra"

    resp = await client.post(
        "/v1/admin/master/states",
        json={"code": "maharashtra", "name": "Maharashtra (override)", "extra": {"region": "west"}},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 201
    assert resp.json()["created"] is True

    resp = await client.get("/v1/admin/master/states", headers=ADMIN_HEADERS)
    body = resp.json()
    assert body["total"] >= 28
    mah = next(r for r in body["data"] if r["code"] == "maharashtra")
    assert mah["name"] == "Maharashtra (override)"
    assert mah["source"] == "firestore"
    assert mah["region"] == "west"

    resp = await client.get("/v1/admin/master/not_a_collection", headers=ADMIN_HEADERS)
    assert resp.status_code == 422


async def test_master_update_and_soft_delete(client, user_store):
    resp = await client.post(
        "/v1/admin/master/crops",
        json={"code": "quinoa", "name": "Quinoa"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 201

    resp = await client.put(
        "/v1/admin/master/crops/quinoa",
        json={"name": "Quinoa (Peru)"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["entry"]["name"] == "Quinoa (Peru)"

    resp = await client.delete(
        "/v1/admin/master/crops/quinoa", headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 200
    assert resp.json()["active"] is False

    resp = await client.get("/v1/admin/master/crops", headers=ADMIN_HEADERS)
    codes = [r["code"] for r in resp.json()["data"]]
    assert "quinoa" not in codes

    resp = await client.get(
        "/v1/admin/master/crops", params={"includeInactive": True}, headers=ADMIN_HEADERS
    )
    row = next(r for r in resp.json()["data"] if r["code"] == "quinoa")
    assert row["active"] is False

    resp = await client.delete(
        "/v1/admin/master/crops/ghost", headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 404


async def test_master_static_soft_delete_excluded_from_merge(client, user_store):
    resp = await client.delete(
        "/v1/admin/master/units/kg", headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/admin/master/units", headers=ADMIN_HEADERS)
    codes = [r["code"] for r in resp.json()["data"]]
    assert "kg" not in codes


async def test_master_import_bulk_upsert(client, user_store):
    rows = [{"code": f"mandi_{i}", "name": f"Mandi {i}"} for i in range(3)]
    rows.append({"code": "broken"})
    resp = await client.post(
        "/v1/admin/master/mandis/import", json={"rows": rows}, headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] == 3
    assert body["updated"] == 0
    assert len(body["errors"]) == 1
    assert body["errors"][0]["code"] == "broken"

    resp = await client.post(
        "/v1/admin/master/mandis/import",
        json={"rows": [{"code": "mandi_1", "name": "Mandi One Updated"}]},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.json()["updated"] == 1

    too_many = [{"code": f"c{i}", "name": "x"} for i in range(501)]
    resp = await client.post(
        "/v1/admin/master/mandis/import", json={"rows": too_many}, headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 422

    resp = await client.get("/v1/admin/master/mandis", headers=ADMIN_HEADERS)
    names = {r["code"]: r["name"] for r in resp.json()["data"]}
    assert names["mandi_1"] == "Mandi One Updated"


# ---------------------------------------------------------------------------
# Advertisement moderation (admin_sop_trade)
# ---------------------------------------------------------------------------

def _seed_ad(user_store, ad_id, status, advertiser="u-adv-1"):
    user_store[f"ad_campaigns/{ad_id}"] = {
        "id": ad_id,
        "advertiserId": advertiser,
        "advertiserName": "Advertiser One",
        "title": "Test campaign",
        "status": status,
        "budgetRupees": 1000.0,
        "spentRupees": 100.0,
        "impressions": 500,
        "clicks": 25,
        "createdAt": _past_iso(20),
        "updatedAt": _past_iso(20),
    }


async def test_ads_list_approve_reject_and_409(client, user_store):
    seed_user(user_store, uid="u-adv-1", active_profile="instructor")
    _seed_ad(user_store, "ad-1", "pending_approval")
    _seed_ad(user_store, "ad-2", "pending_approval")

    resp = await client.get("/v1/admin/ads", params={"status": "pending_approval"}, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2
    assert resp.json()["data"][0]["advertiserName"] == "Advertiser One"

    resp = await client.post("/v1/admin/ads/ad-1/approve", headers=ADMIN_MUTATION_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"
    assert user_store["ad_campaigns/ad-1"]["status"] == "active"

    resp = await client.post("/v1/admin/ads/ad-1/approve", headers=ADMIN_MUTATION_HEADERS)
    assert resp.status_code == 409

    resp = await client.post(
        "/v1/admin/ads/ad-2/reject",
        json={"reason": "misleading claims"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "paused"
    assert user_store["ad_campaigns/ad-2"]["reviewReason"] == "misleading claims"

    resp = await client.post("/v1/admin/ads/nope/approve", headers=ADMIN_MUTATION_HEADERS)
    assert resp.status_code == 404

    resp = await client.get("/v1/admin/ads", headers=PLAIN_HEADERS)
    assert resp.status_code == 403


async def test_ads_analytics_and_pricing_roundtrip(client, user_store):
    _seed_ad(user_store, "ad-3", "active")
    resp = await client.get("/v1/admin/ads/ad-3/analytics", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["impressions"] == 500
    assert body["clicks"] == 25
    assert body["ctrPercent"] == 5.0
    assert body["remainingBudgetRupees"] == 900.0

    resp = await client.put(
        "/v1/admin/platform-config/ads-pricing",
        json={"cpcPaise": 250, "minBudgetPaise": 75000, "targetingOptions": ["state", "persona"]},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/admin/platform-config/ads-pricing", headers=ADMIN_HEADERS)
    body = resp.json()
    assert body["cpcPaise"] == 250
    assert body["cpmPaise"] == 50000  # default kept
    assert body["minBudgetPaise"] == 75000
    assert body["targetingOptions"] == ["state", "persona"]


# ---------------------------------------------------------------------------
# Rewards & referral config + tree survival mint (admin_sop_economy)
# ---------------------------------------------------------------------------

async def test_referrals_config_roundtrip(client, user_store):
    resp = await client.get("/v1/admin/platform-config/referrals", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["referrerRewardCoins"] == 100

    resp = await client.put(
        "/v1/admin/platform-config/referrals",
        json={
            "referrerRewardCoins": 150,
            "refereeRewardCoins": 75,
            "maxReferralsPerMonth": 10,
            "enabled": False,
            "minKycTier": 1,
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/admin/platform-config/referrals", headers=ADMIN_HEADERS)
    body = resp.json()
    assert body["referrerRewardCoins"] == 150
    assert body["enabled"] is False
    assert body["minKycTier"] == 1


async def test_tree_survival_verified_mints_coins_idempotently(client, user_store):
    seed_user(user_store, uid="u-tree-farmer")
    user_store["sapling_requests/req-1"] = {
        "id": "req-1",
        "userId": "u-tree-farmer",
        "treeType": "Neem",
        "status": "dispatched",
        "createdAt": _past_iso(2000),
    }

    resp = await client.put(
        "/v1/admin/tree/requests/req-1/status",
        json={"status": "survival_verified"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "survival_verified"
    assert body["reward"]["coins"] == 50
    assert user_store["users/u-tree-farmer"]["agriCoins"] == 50
    assert user_store["sapling_requests/req-1"]["survivalRewardMintedAt"]
    notifs = [d for k, d in user_store.items() if k.startswith("notifications/")]
    assert any(n["type"] == "tree_survival_reward" for n in notifs)

    # Replaying the same transition is rejected by the state machine (409) and
    # no second mint ever happens.
    resp = await client.put(
        "/v1/admin/tree/requests/req-1/status",
        json={"status": "survival_verified"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 409
    assert user_store["users/u-tree-farmer"]["agriCoins"] == 50


async def test_tree_full_lifecycle_to_survival(client, user_store):
    seed_user(user_store, uid="u-tree-2")
    user_store["sapling_requests/req-2"] = {
        "id": "req-2", "userId": "u-tree-2", "status": "pending", "createdAt": _past_iso(100)
    }
    for status in ("approved", "dispatched", "survival_verified"):
        resp = await client.put(
            "/v1/admin/tree/requests/req-2/status",
            json={"status": status},
            headers=ADMIN_MUTATION_HEADERS,
        )
        assert resp.status_code == 200, status
    assert user_store["users/u-tree-2"]["agriCoins"] == 50


# ---------------------------------------------------------------------------
# Carbon + land-records config (admin_sop_farm / finance status)
# ---------------------------------------------------------------------------

async def test_carbon_config_roundtrip(client, user_store):
    resp = await client.put(
        "/v1/admin/platform-config/carbon",
        json={
            "kgCo2PerTreePerYear": 25.0,
            "creditPricePaisePerKg": 90,
            "ecoCoinsPerCredit": 12,
            "payoutThresholdCredits": 20,
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/admin/platform-config/carbon", headers=ADMIN_HEADERS)
    body = resp.json()
    assert body["kgCo2PerTreePerYear"] == 25.0
    assert body["creditPricePaisePerKg"] == 90
    assert body["ecoCoinsPerCredit"] == 12
    assert body["payoutThresholdCredits"] == 20


async def test_land_records_config_masks_api_key(client, user_store):
    resp = await client.put(
        "/v1/admin/land-records/config",
        json={
            "provider": "mahabhulekh",
            "apiUrl": "https://api.example.gov/712",
            "apiKey": "super-secret-key-1234",
            "syncEnabled": True,
            "syncCron": "0 2 * * *",
            "timeoutMs": 5000,
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["apiKeyMasked"] == "****1234"
    assert "apiKey" not in resp.json()

    resp = await client.get("/v1/admin/land-records/config", headers=ADMIN_HEADERS)
    body = resp.json()
    assert body["provider"] == "mahabhulekh"
    assert body["apiKeyMasked"] == "****1234"
    assert "apiKey" not in body
    assert body["syncEnabled"] is True
    assert body["syncCron"] == "0 2 * * *"

    # Stored doc keeps the real key; reads always mask.
    assert user_store["platform_config/land_records_config"]["apiKey"] == "super-secret-key-1234"

    # Omitting apiKey keeps the stored one.
    resp = await client.put(
        "/v1/admin/land-records/config",
        json={"timeoutMs": 8000},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert user_store["platform_config/land_records_config"]["apiKey"] == "super-secret-key-1234"

    resp = await client.get("/v1/admin/land-records/status", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["integration"]["configured"] is True
    assert resp.json()["integration"]["provider"] == "mahabhulekh"


# ---------------------------------------------------------------------------
# Chatbot CMS (admin_sop_chatbot)
# ---------------------------------------------------------------------------

async def test_chatbot_intents_and_fallback_roundtrip(client, user_store):
    intents = [
        {
            "intent": "mandi_price",
            "samplePhrases": ["bhav kya hai", "today rate"],
            "response": "Today's mandi rates are…",
            "enabled": True,
        }
    ]
    resp = await client.put(
        "/v1/admin/chatbot/intents", json={"intents": intents}, headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/admin/chatbot/intents", headers=ADMIN_HEADERS)
    body = resp.json()
    assert body["total"] == 1
    assert body["intents"][0]["intent"] == "mandi_price"

    resp = await client.put(
        "/v1/admin/chatbot/fallback-config",
        json={"fallbackMessages": ["samajh nahi aaya"], "escalateAfter": 2, "handoffMessage": "expert"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/admin/chatbot/fallback-config", headers=ADMIN_HEADERS)
    body = resp.json()
    assert body["fallbackMessages"] == ["samajh nahi aaya"]
    assert body["escalateAfter"] == 2
    assert body["handoffMessage"] == "expert"

    resp = await client.get("/v1/admin/chatbot/intents", headers=PLAIN_HEADERS)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# KYC request-more (admin.py)
# ---------------------------------------------------------------------------

async def test_kyc_request_more_then_verify_flow(client, user_store):
    seed_user(user_store, uid="u-kyc-1")
    case_id = "kyc_u-kyc-1_seller"
    user_store[f"kyc_cases/{case_id}"] = {
        "caseId": case_id,
        "userId": "u-kyc-1",
        "persona": "seller",
        "status": "pending",
        "docs": [
            {
                "docId": f"{case_id}:gst",
                "type": "gst",
                "status": "pending",
                "storagePath": "kyc/gst.pdf",
            }
        ],
        "submittedAt": _past_iso(60),
    }

    resp = await client.post(
        "/v1/admin/kyc/kyc_u-kyc-1_seller:gst/request-more",
        json={"note": "GST certificate is blurry, please re-upload"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "resubmission_requested"
    assert body["caseStatus"] == "pending"

    case = user_store[f"kyc_cases/{case_id}"]
    assert case["docs"][0]["status"] == "resubmission_requested"
    assert case["docs"][0]["reason"] == "GST certificate is blurry, please re-upload"
    notifs = [d for k, d in user_store.items() if k.startswith("notifications/")]
    assert any(n["type"] == "kyc_resubmission_requested" for n in notifs)

    # Verify flow keeps working after a request-more.
    resp = await client.post(
        "/v1/admin/kyc/kyc_u-kyc-1_seller:gst/verify",
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "verified"
    assert user_store[f"kyc_cases/{case_id}"]["status"] == "verified"

    # A verified doc cannot be sent back.
    resp = await client.post(
        "/v1/admin/kyc/kyc_u-kyc-1_seller:gst/request-more",
        json={"note": "change of mind"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# E-market admin — sellers + categories (admin_sop_trade)
# ---------------------------------------------------------------------------

async def test_sellers_join_products_orders_revenue(client, user_store):
    seed_user(user_store, uid="u-seller-1", active_profile="seller")
    user_store["users/u-seller-1"].update({"vyapariVerified": True})
    seed_user(user_store, uid="u-farmer-x", active_profile="farmer")
    user_store["products/pr-1"] = {
        "id": "pr-1", "sellerId": "u-seller-1", "title": "Urea", "discountedPrice": 450, "mrp": 500
    }
    user_store["orders/ord-1"] = {
        "id": "ord-1", "status": "delivered",
        "items": [{"productId": "pr-1", "quantity": 2}],
        "createdAt": _past_iso(10),
    }
    resp = await client.get("/v1/admin/sellers", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    row = resp.json()["data"][0]
    assert row["id"] == "u-seller-1"
    assert row["productCount"] == 1
    assert row["orderCount"] == 1
    assert row["revenueRupees"] == 900.0
    assert row["vyapariVerified"] is True


async def test_marketplace_categories_crud(client, user_store):
    resp = await client.post(
        "/v1/admin/marketplace/categories",
        json={"name": "Seeds"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 201
    cat = resp.json()["category"]
    assert cat["active"] is True

    resp = await client.post(
        "/v1/admin/marketplace/categories",
        json={"name": "seeds"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 409

    resp = await client.put(
        f"/v1/admin/marketplace/categories/{cat['id']}",
        json={"name": "Quality Seeds", "active": False},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["category"]["name"] == "Quality Seeds"
    assert resp.json()["category"]["active"] is False

    resp = await client.delete(
        f"/v1/admin/marketplace/categories/{cat['id']}", headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 200

    resp = await client.get("/v1/admin/marketplace/categories", headers=ADMIN_HEADERS)
    stored = resp.json()["data"][0]
    assert stored["active"] is False

    resp = await client.put(
        "/v1/admin/marketplace/categories/nope",
        json={"name": "x"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Advisory CMS + farmer-facing read (admin_sop_farm + advisory.py)
# ---------------------------------------------------------------------------

async def test_advisory_articles_crud_push_and_farmer_read(client, user_store):
    seed_user(user_store, uid="u-farmer-mh", active_profile="farmer", state="Maharashtra")
    seed_user(user_store, uid="u-farmer-ka", active_profile="farmer", state="Karnataka")
    seed_user(user_store, uid="u-ins-1", active_profile="instructor")

    resp = await client.post(
        "/v1/admin/advisory/articles",
        json={
            "crop": "Grapes",
            "region": "Maharashtra",
            "season": "kharif",
            "title": "Downy mildew alert",
            "body": "Spray copper oxychloride…",
            "status": "draft",
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 201
    article_id = resp.json()["article"]["articleId"]

    # Draft cannot be pushed.
    resp = await client.post(
        f"/v1/admin/advisory/articles/{article_id}/push", headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 409

    # Farmer cannot see drafts (token for the Maharashtra farmer seeded above;
    # re-seeding the same uid only refreshes the token).
    mh_headers = auth(seed_user(user_store, uid="u-farmer-mh", active_profile="farmer", state="Maharashtra"))
    resp = await client.get("/v1/advisory/articles", headers=mh_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

    resp = await client.put(
        f"/v1/admin/advisory/articles/{article_id}",
        json={"status": "published"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200

    resp = await client.post(
        f"/v1/admin/advisory/articles/{article_id}/push", headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 200
    assert resp.json()["notified"] == 1  # only the Maharashtra farmer

    notifs = [d for k, d in user_store.items() if k.startswith("notifications/")]
    article_notifs = [n for n in notifs if n["type"] == "advisory_article"]
    assert len(article_notifs) == 1
    assert article_notifs[0]["userId"] == "u-farmer-mh"

    # Farmer-facing read: region-filtered by default.
    resp = await client.get(
        "/v1/advisory/articles",
        headers=auth(seed_user(user_store, uid="u-f-mh3", active_profile="farmer", state="Maharashtra")),
    )
    assert resp.json()["total"] == 1
    resp = await client.get(
        "/v1/advisory/articles",
        headers=auth(seed_user(user_store, uid="u-f-ka3", active_profile="farmer", state="Karnataka")),
    )
    assert resp.json()["total"] == 0
    # Explicit region param widens the match.
    resp = await client.get(
        "/v1/advisory/articles",
        params={"region": "Maharashtra"},
        headers=auth(seed_user(user_store, uid="u-f-ka4", active_profile="farmer", state="Karnataka")),
    )
    assert resp.json()["total"] == 1

    # Crop filter.
    resp = await client.get(
        "/v1/advisory/articles",
        params={"crop": "wheat"},
        headers=auth(seed_user(user_store, uid="u-f-mh4", active_profile="farmer", state="Maharashtra")),
    )
    assert resp.json()["total"] == 0

    # Delete soft-removes from the farmer feed.
    resp = await client.delete(
        f"/v1/admin/advisory/articles/{article_id}", headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 200
    resp = await client.get(
        "/v1/advisory/articles",
        headers=auth(seed_user(user_store, uid="u-f-mh5", active_profile="farmer", state="Maharashtra")),
    )
    assert resp.json()["total"] == 0
