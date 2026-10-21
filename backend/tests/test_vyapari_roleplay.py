"""Vyapari hub end-to-end roleplay — one story across five acts.

Act 1  Vijay (vyapari/seller persona) sets up his business profile — wholesaler,
       GSTIN, 2l_10l capacity band, operating states MH+GJ, mandis Pune+Nasik.
Act 2  Vijay browses lots around Pune, saves the "soybean-mh" search with
       alerts on, gets sourcing recommendations, and checks the mandi forecast,
       compare (₹12/km transport) and smart-select for soybean.
Act 3  Ramesh (farmer) lists a soybean lot with photos + coords and submits it
       for review; the admin rejects without a reason (422), then approves with
       a moderation note; Vijay's saved-search cron fires a saved_search_alert.
Act 4  Vijay books Ramesh's lot, pays an advance and schedules tomorrow's 7am
       pickup with agent Sham (vehicle MH-12-AB-1234, 60-minute grace); the
       pickup-reminder cron pings both parties with deterministic ids.
Act 5  Vijay rates Ramesh (fair_price, on_time), Ramesh replies, Vijay exports
       his diary CSV, runs an ad against his own demand and browses the
       direct-buyer directory for a verified hotel buyer.

Uses the shared conftest fixtures (in-memory Firestore monkeypatch) exactly
like tests/test_women_hub_roleplay.py: `client`, `user_store`, `seed_user`,
`auth`.
"""
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.services.mandi_forecast import CACHE_COLLECTION, forecast_doc_id
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user
from tests.test_users import _register

ADMIN = {"Authorization": "Bearer admin-token"}
ADMIN_MUTATION = {
    **ADMIN,
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "vyapari roleplay",
}
CRON = {"X-Cron-Secret": "s3cret"}
PUNE = {"lat": 18.52, "lng": 73.86}


def _seed_farmer_lot(user_store, lot_id, farmer_id, created_at, **overrides):
    doc = {
        "id": lot_id,
        "farmerId": farmer_id,
        "crop": "Soybean",
        "variety": "Grade A",
        "grade": "A",
        "quantityQuintals": 40.0,
        "expectedRate": 4500,
        "status": "open",
        "createdAt": created_at,
    }
    doc.update(overrides)
    user_store[f"market_lots/{lot_id}"] = doc
    return doc


async def test_vyapari_market_day_roleplay(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    two_days_ago = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()

    # ------------------------------------------------------------------
    # Act 1 — Vijay, vyapari/seller persona, sets up his business profile.
    # ------------------------------------------------------------------
    vijay = (
        await _register(
            client, profiles=["farmer", "seller"], primaryProfile="seller",
            name="Vijay Vyapari", state="Maharashtra", district="Pune",
            village="Camp",
        )
    ).json()["accessToken"]
    user_store["users/uid-1"].update(PUNE)

    resp = await client.get("/v1/seller/profile", headers=auth(vijay))
    assert resp.status_code == 200
    assert resp.json()["found"] is False  # nothing stored yet

    resp = await client.put(
        "/v1/seller/profile",
        json={
            "shopName": "Vijay Traders",
            "gstNumber": "27AAACV1234A1Z5",
            "businessType": "wholesaler",
            "buyingCapacityBand": "2l_10l",
            "operatingStates": ["MH", "GJ"],
            "mandis": ["Pune", "Nasik"],
            "logoPath": "logos/vijay-traders.png",
        },
        headers=auth(vijay),
    )
    assert resp.status_code == 200
    assert resp.json()["buyingCapacityBand"] == "2l_10l"
    assert user_store["users/uid-1/role_profiles/seller"]["shopName"] == "Vijay Traders"

    # ------------------------------------------------------------------
    # Act 2 — discovery: browse around Pune, saved search, sourcing, mandi.
    # ------------------------------------------------------------------
    seed_user(
        user_store, uid="uid-ramesh", active_profile="farmer", name="Ramesh Jadhav",
        state="Maharashtra", district="Pune", village="Khed",
    )
    # other farmers' listings (two days old — before the saved search existed)
    _seed_farmer_lot(
        user_store, "lot-mh-near", "uid-ramesh", two_days_ago,
        state="Maharashtra", village="Khed", **PUNE,
    )
    _seed_farmer_lot(
        user_store, "lot-mh-far", "uid-ramesh", two_days_ago,
        state="Maharashtra", village="Chandrapur", lat=19.95, lng=79.30,
    )
    _seed_farmer_lot(
        user_store, "lot-ka-near", "uid-ramesh", two_days_ago,
        state="Karnataka", village="Belgaum", lat=18.52, lng=73.87,
    )

    # browse: 100 km radius around Pune keeps only the near MH lot
    resp = await client.get(
        "/v1/market/lots/browse",
        params={"state": "Maharashtra", "lat": PUNE["lat"], "lng": PUNE["lng"],
                "maxDistanceKm": 100},
        headers=auth(vijay),
    )
    assert resp.status_code == 200
    assert [d["id"] for d in resp.json()["data"]] == ["lot-mh-near"]

    # saved search "soybean-mh" with alerts on
    resp = await client.post(
        "/v1/saved-searches",
        json={"queryText": "soybean-mh", "crop": "Soybean", "alertsEnabled": True},
        headers=auth(vijay),
    )
    assert resp.status_code == 201
    search_id = resp.json()["id"]

    # prior trade history: soybean
    user_store["users/uid-1/seller_procurement/proc-prev"] = {
        "id": "proc-prev", "sellerId": "uid-1", "crop": "Soybean",
        "createdAt": two_days_ago,
    }

    # sourcing: his MH + Pune-mandi soybean lot outranks the rest
    resp = await client.get("/v1/seller/sourcing-recommendations", headers=auth(vijay))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items[0]["lotId"] == "lot-mh-near"
    assert items[0]["matchScore"] == 8
    reasons = " | ".join(items[0]["reasons"])
    assert "operating state" in reasons and "mandi" in reasons
    ka_lot = next(i for i in items if i["lotId"] == "lot-ka-near")
    assert ka_lot["matchScore"] < items[0]["matchScore"]

    # mandi board: forecast cache + compare at ₹12/km + smart-select
    mandi_prices = [
        {"id": "mp-pune", "mandiName": "Pune APMC", "commodity": "Soybean (सोयाबीन)",
         "modalPrice": 4600, "distanceKm": 25},
        {"id": "mp-nasik", "mandiName": "Nasik APMC", "commodity": "Soybean (सोयाबीन)",
         "modalPrice": 4620, "distanceKm": 65},
    ]
    for doc in mandi_prices:
        user_store[f"mandi_prices/{doc['id']}"] = doc
    forecast_id = forecast_doc_id("Soybean", "Pune APMC")
    user_store[f"{CACHE_COLLECTION}/{forecast_id}"] = {
        "id": forecast_id, "crop": "Soybean", "mandi": "Pune APMC",
        "bands": [{"horizon_days": 7, "band_low_paisa": 455000,
                   "band_high_paisa": 465000, "confidence_class": "medium"}],
        "source": "fallback", "fallbackUsed": True, "updatedAt": two_days_ago,
    }
    resp = await client.get(
        "/v1/mandi/forecast", params={"crop": "Soybean", "mandi": "Pune APMC"},
        headers=auth(vijay),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["bands"]

    resp = await client.get(
        "/v1/mandi/compare",
        params={"crop": "soybean", "quantityQuintals": 10},
        headers=auth(vijay),
    )
    assert resp.status_code == 200
    by_name = {d["mandiName"]: d for d in resp.json()["data"]}
    assert by_name["Pune APMC"]["transportCost"] == 25 * 12
    assert by_name["Nasik APMC"]["transportCost"] == 65 * 12

    resp = await client.post(
        "/v1/mandi/smart-select",
        json={"crop": "Soybean", "quantityQuintals": 10},
        headers=auth(vijay),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["best"]["mandi"] == "Pune APMC"  # higher net

    # ------------------------------------------------------------------
    # Act 3 — Ramesh lists a soybean lot; the admin moderates it.
    # ------------------------------------------------------------------
    ramesh = create_access_token("uid-ramesh")
    resp = await client.post(
        "/v1/market/lots",
        json={
            "crop": "Soybean", "variety": "Grade A", "quantityQuintals": 40,
            "expectedRate": 4500, "harvestDate": "2026-10-25",
            "photos": ["lots/ramesh-1.jpg", "lots/ramesh-2.jpg"],
            "lat": 18.53, "lng": 73.87, "village": "Khed",
            "submitForReview": True,
        },
        headers=auth(ramesh),
    )
    assert resp.status_code == 201
    lot = resp.json()
    assert lot["status"] == "pending_review"
    assert lot["photos"] == ["lots/ramesh-1.jpg", "lots/ramesh-2.jpg"]
    lot_id = lot["id"]

    # admin rejects without a reason -> 422, then approves with a note
    resp = await client.post(
        f"/v1/admin/market/lots/{lot_id}/moderate",
        json={"action": "reject"},
        headers=ADMIN_MUTATION,
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/v1/admin/market/lots/{lot_id}/moderate",
        json={"action": "approve", "reason": "photos verified, grade A confirmed"},
        headers=ADMIN_MUTATION,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "open"

    # Ramesh sees his lot live again
    resp = await client.get(f"/v1/market/lots/{lot_id}", headers=auth(ramesh))
    assert resp.json()["status"] == "open"
    assert resp.json()["moderation"]["action"] == "approve"

    # Vijay's saved search fires on the fresh lot
    resp = await client.post("/v1/jobs/saved-search-alerts", headers=CRON)
    assert resp.status_code == 200
    assert resp.json()["alerts"] >= 1
    alert = user_store[f"notifications/savedalert_{search_id}_{lot_id}"]
    assert alert["type"] == "saved_search_alert"
    assert alert["userId"] == "uid-1"
    assert "Soybean" in alert["body"]

    # ------------------------------------------------------------------
    # Act 4 — Vijay books the lot, advances, schedules pickup with Sham.
    # ------------------------------------------------------------------
    resp = await client.post(
        "/v1/purchases", json={"lotId": lot_id}, headers=auth(vijay)
    )
    assert resp.status_code == 201
    purchase = resp.json()
    purchase_id = purchase["id"]
    assert purchase["status"] == "confirmed"
    assert purchase["totalAmount"] == 40 * 4500

    resp = await client.post(
        f"/v1/purchases/{purchase_id}/advance",
        json={"amount": 20000, "method": "upi", "reference": "upi-7am-1"},
        headers=auth(vijay),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "advancePaid"

    resp = await client.post(
        "/v1/admin/pickup-agents",
        json={
            "name": "Sham", "phone": "+919812345678", "vehicleType": "Bolero Pickup",
            "vehicleNumber": "MH-12-AB-1234", "areas": ["Pune", "Khed"],
        },
        headers=ADMIN,
    )
    assert resp.status_code == 201
    agent_id = resp.json()["id"]

    pickup_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/pickup",
        json={
            "date": pickup_at, "slot": "07:00-08:00",  # tomorrow, 7am slot
            "mode": "buyerPicksup",
            "agentId": agent_id,
            "vehicleNumber": "MH-12-AB-1234",
            "graceMinutes": 60,
            "address": "Khed, Pune",
        },
        headers=auth(vijay),
    )
    assert resp.status_code == 200
    pickup = resp.json()["pickup"]
    assert pickup["agentId"] == agent_id
    assert pickup["vehicleNumber"] == "MH-12-AB-1234"
    assert pickup["graceMinutes"] == 60

    # Ramesh views the booking
    resp = await client.get(f"/v1/purchases/{purchase_id}", headers=auth(ramesh))
    assert resp.status_code == 200
    assert resp.json()["status"] == "pickupScheduled"
    assert resp.json()["pickup"]["slot"] == "07:00-08:00"

    # the 24h reminder lands on both parties with deterministic ids
    resp = await client.post("/v1/jobs/pickup/reminders", headers=CRON)
    assert resp.status_code == 200
    assert resp.json()["reminders24h"] == 2
    note_vijay = user_store[f"notifications/pickup24_{purchase_id}_uid-1"]
    note_ramesh = user_store[f"notifications/pickup24_{purchase_id}_uid-ramesh"]
    assert note_vijay["type"] == "pickup_reminder_24h"
    assert note_ramesh["userId"] == "uid-ramesh"

    # rerun -> no duplicates
    resp = await client.post("/v1/jobs/pickup/reminders", headers=CRON)
    assert resp.json()["reminders24h"] == 0

    # ------------------------------------------------------------------
    # Act 5 — ratings with tags, diary CSV, own-demand ad, buyer directory.
    # ------------------------------------------------------------------
    # Vijay rates Ramesh's delivery with tags
    user_store["transport_bookings/trb-vijay"] = {
        "id": "trb-vijay", "userId": "uid-1", "vehicleType": "Bolero Pickup",
        "status": "delivered", "transporterId": "uid-ramesh", "fare": 1200,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    resp = await client.post(
        "/v1/ratings",
        json={
            "bookingKind": "transport", "bookingId": "trb-vijay", "stars": 5,
            "comment": "honest weight, on-time pickup",
            "tags": ["fair_price", "on_time"],
        },
        headers=auth(vijay),
    )
    assert resp.status_code == 201
    rating_id = resp.json()["id"]

    # Ramesh sees the tags on his ratings and replies
    resp = await client.get("/v1/ratings/mine", headers=auth(ramesh))
    assert resp.status_code == 200
    assert resp.json()["recent"][0]["tags"] == ["fair_price", "on_time"]
    resp = await client.post(
        f"/v1/ratings/{rating_id}/reply",
        json={"reply": "धन्यवाद, Vijay bhai!"},
        headers=auth(ramesh),
    )
    assert resp.status_code == 200

    # Vijay checks the ratings he gave
    resp = await client.get("/v1/ratings/given", headers=auth(vijay))
    assert resp.json()["items"][0]["tags"] == ["fair_price", "on_time"]

    # Vijay switches to his farmer persona for the farm diary, exports CSV
    resp = await client.post("/v1/users/me/profiles/farmer/activate", headers=auth(vijay))
    assert resp.status_code == 200
    resp = await client.post(
        "/v1/diary/entries",
        json={
            "title": "Soybean sale to Vijay Traders", "category": "produce_sale",
            "type": "income", "amount": 180000, "date": "2026-10-20",
            "party": "Vijay Traders", "tradeType": "sell",
            "quantity": 40, "unit": "quintal", "cropName": "Soybean",
        },
        headers=auth(vijay),
    )
    assert resp.status_code == 201
    resp = await client.get(
        "/v1/diary/report.csv?from=2026-10-01&to=2026-10-31", headers=auth(vijay)
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "Soybean sale to Vijay Traders" in resp.text
    assert "18000000" in resp.text  # ₹1,80,000 -> 1,80,00,000 paisa

    # back to seller persona: own demand + ad campaign targeting it
    resp = await client.post("/v1/users/me/profiles/seller/activate", headers=auth(vijay))
    assert resp.status_code == 200
    resp = await client.post(
        "/v1/demands",
        json={"crop": "Soybean", "quantity": 100, "maxPrice": 4700},
        headers=auth(vijay),
    )
    assert resp.status_code == 201
    demand_id = resp.json()["id"]
    resp = await client.post(
        "/v1/ads",
        json={
            "title": "Soybean wanted - Pune", "headline": "Vijay Traders buys soybean",
            "description": "grade A, 100 qtl", "bannerUrl": "https://cdn.example.com/soy.png",
            "targetType": "demand", "targetId": demand_id,
        },
        headers=auth(vijay),
    )
    assert resp.status_code == 201
    assert resp.json()["targetType"] == "demand"

    # the buyer directory surfaces a verified hotel buyer
    seed_user(
        user_store, uid="uid-hotel", active_profile="directBuyer",
        name="Suresh Shetty", state="Maharashtra", district="Pune", village="Camp",
    )
    user_store["users/uid-hotel/role_profiles/directBuyer"] = {
        "companyName": "Shetty Hotels", "buyerType": "hotel",
        "categories": ["vegetables", "grains"],
    }
    user_store["kyc_cases/kyc_uid-hote_directBuyer"] = {
        "caseId": "kyc_uid-hote_directBuyer", "userId": "uid-hotel",
        "persona": "directBuyer", "status": "verified", "docs": [],
    }
    resp = await client.get("/v1/seller/buyers", headers=auth(vijay))
    assert resp.status_code == 200
    buyers = resp.json()["items"]
    hotel = next(b for b in buyers if b["uid"] == "uid-hotel")
    assert hotel["businessName"] == "Shetty Hotels"
    assert hotel["verified"] is True
    assert hotel["pastDealingsCount"] == 0
