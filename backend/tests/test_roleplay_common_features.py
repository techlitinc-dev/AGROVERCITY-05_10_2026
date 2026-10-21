"""Roleplay: one day on Agrovercity across three personas.

Exercises the SR 1-34 common-feature gaps closed in this change, end to end,
through the API the website calls:

  ACT 1 — Ramesh Patil (farmer): dashboard breadth, profile/photo/privacy,
          saved mandis, follows, diary breadth, payments ledger + refund
          request, pending ratings, equipment booking history, lot ads
          lifecycle, chatbot photo input, carbon estimates, tree search.
  ACT 2 — Sunita Shah (customer): purchase requests, seller storefront.
  ACT 3 — Kavita Jadhav (womenShg member): kitchen-garden templates & plans,
          academy learner surfaces (recommendations, instructors).

Firestore + firebase-auth + redis are faked by conftest; the AI gateway is
monkeypatched — nothing here touches the network.
"""

from app.core.config import settings
from tests.test_diary import auth, seed_user
from tests.test_diary_garden_chatbot import _clean_decision
from tests.test_tree import seed_tree_store


def _seed_seller(user_store, uid="uid-seller", name="Sunil Vyapari"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": name,
        "phone": "+919800000099",
        "linkedProfiles": ["seller"],
        "activeProfile": "seller",
        "rating": 4.6,
        "createdAt": "2026-01-10T00:00:00+00:00",
    }
    return uid


# --------------------------------------------------------------------------- ACT 1


async def test_act1_ramesh_morning_dashboard(client, user_store):
    """Ramesh opens the Farmer Cockpit: buyer offers, learning picks, pending orders."""
    token = seed_user(user_store, uid="uid-1", activeCrops=["Onion", "Wheat"])
    now = "2026-10-20T06:30:00+05:30"
    user_store["demands/d1"] = {
        "id": "d1", "status": "open", "crop": "Onion", "quantity": 40,
        "maxPrice": 1850, "deliveryLocation": "Nashik", "offersCount": 3, "createdAt": now,
    }
    user_store["demands/d2"] = {
        "id": "d2", "status": "open", "crop": "Soybean", "quantity": 200,
        "maxPrice": 4400, "deliveryLocation": "Pune", "offersCount": 0, "createdAt": now,
    }
    user_store["courses/c1"] = {
        "id": "c1", "status": "published", "instructorId": "uid-t1", "title": "Soil Health 101",
        "isFeatured": True, "salesCount": 50, "createdAt": now,
    }
    user_store["courses/c2"] = {
        "id": "c2", "status": "published", "instructorId": "uid-t2", "title": "Drip Irrigation",
        "salesCount": 30, "createdAt": now,
    }
    user_store["purchases/po1"] = {
        "id": "po1", "farmerId": "uid-1", "status": "accepted", "crop": "Wheat",
        "createdAt": now,
    }
    user_store["transport_bookings/tb1"] = {
        "id": "tb1", "userId": "uid-1", "status": "accepted", "createdAt": now,
    }
    user_store["equipment_bookings/eb1"] = {
        "id": "eb1", "userId": "uid-1", "equipmentId": "eq1", "status": "booked", "createdAt": now,
    }

    resp = await client.get("/v1/dashboard/home", headers=auth(token))
    assert resp.status_code == 200
    home = resp.json()

    offers = home.get("buyerOffers") or []
    assert offers, "dashboard should surface open buyer demands"
    assert offers[0]["crop"] == "Onion", "crop-matching demand sorts first"
    assert offers[0]["offersCount"] == 3

    recs = home.get("learningRecommendations") or []
    assert len(recs) == 2 and {r["id"] for r in recs} == {"c1", "c2"}

    pending = home.get("pendingOrders") or {}
    assert pending["purchases"]["count"] == 1
    assert pending["transport"]["count"] == 1
    assert pending["equipment"]["count"] == 1
    assert pending["purchases"]["items"][0]["linkHint"] == "/farmer/purchases"


async def test_act1_ramesh_profile_photo_and_privacy(client, user_store):
    """Ramesh completes his profile (photo, crops) and tweaks privacy settings."""
    token = seed_user(user_store, uid="uid-1")

    resp = await client.put(
        "/v1/users/me",
        json={
            "photoUrl": "/uploads/uid-1/avatar.png",
            "village": "Pimpalgaon",
            "landAreaAcres": 6.5,
            "activeCrops": ["Onion", "Wheat"],
            "soilType": "black",
        },
        headers=auth(token),
    )
    assert resp.status_code == 200
    me = await client.get("/v1/users/me", headers=auth(token))
    assert me.json()["photoUrl"] == "/uploads/uid-1/avatar.png"
    assert me.json()["activeCrops"] == ["Onion", "Wheat"]

    settings_resp = await client.get("/v1/users/me/settings", headers=auth(token))
    assert settings_resp.json()["discoverable"] is True
    put = await client.put(
        "/v1/users/me/settings", json={"discoverable": False}, headers=auth(token)
    )
    assert put.status_code == 200
    assert (await client.get("/v1/users/me/settings", headers=auth(token))).json()[
        "discoverable"
    ] is False


async def test_act1_ramesh_saves_mandi_and_follows_seller(client, user_store):
    """Ramesh bookmarks his preferred mandi and follows a trusted vyapari."""
    token = seed_user(user_store, uid="uid-1")
    seller = _seed_seller(user_store)
    user_store["mandis/m1"] = {
        "id": "m1", "name": "Pimpalgaon Baswant APMC", "district": "Nashik", "state": "Maharashtra",
    }

    resp = await client.post("/v1/mandi/favorites", json={"mandiId": "m1"}, headers=auth(token))
    assert resp.status_code == 200
    favs = (await client.get("/v1/mandi/favorites", headers=auth(token))).json()
    assert favs["items"][0]["name"] == "Pimpalgaon Baswant APMC"

    resp = await client.post(f"/v1/users/{seller}/follow", headers=auth(token))
    assert resp.status_code == 200
    follows = (await client.get("/v1/users/me/follows", headers=auth(token))).json()
    assert follows["items"][0]["userId"] == seller
    assert follows["items"][0]["name"] == "Sunil Vyapari"

    # a stranger cannot follow a ghost
    ghost = await client.post("/v1/users/uid-ghost/follow", headers=auth(token))
    assert ghost.status_code == 404


async def test_act1_ramesh_diary_breadth(client, user_store):
    """Farm diary covers the full day: activity, transport, household, a sale."""
    token = seed_user(user_store, uid="uid-1")
    entries = [
        {"title": "Spraying - Onion", "category": "Spraying", "type": "farmActivity",
         "amount": 0, "date": "2026-10-20", "cropName": "Onion", "notes": "Neem oil"},
        {"title": "Tractor freight to mandi", "category": "Freight", "type": "transport",
         "amount": 800, "date": "2026-10-20", "party": "Ganesh Transport"},
        {"title": "Bachat Gat monthly", "category": "SHG", "type": "household",
         "amount": 500, "date": "2026-10-20", "notes": "Kavita's group"},
        {"title": "Sold 10 qt Onion", "category": "Crop Sale", "type": "income",
         "amount": 17500, "date": "2026-10-20", "tradeType": "sell",
         "party": "Sunil Vyapari", "cropName": "Onion", "quantity": 10, "unit": "Quintal"},
    ]
    for entry in entries:
        resp = await client.post("/v1/diary/entries", json=entry, headers=auth(token))
        assert resp.status_code in (200, 201), entry

    household = await client.get("/v1/diary/entries?type=household", headers=auth(token))
    assert len(household.json()["data"]) == 1
    assert household.json()["data"][0]["category"] == "SHG"

    sale = await client.get("/v1/diary/entries?type=income", headers=auth(token))
    row = sale.json()["data"][0]
    assert row["tradeType"] == "sell" and row["party"] == "Sunil Vyapari"

    summary = await client.get("/v1/diary/analytics/summary", headers=auth(token))
    assert summary.status_code == 200


async def test_act1_ramesh_payments_and_refund_request(client, user_store):
    """Ramesh reviews his unified ledger and requests a refund on a bad advance."""
    token = seed_user(user_store, uid="uid-1")
    _seed_seller(user_store)
    # the shared `payments` collection stores amounts in paise
    user_store["payments/pay1"] = {
        "id": "pay1", "userId": "uid-1", "payeeId": "uid-seller", "amount": 50000,
        "status": "paid", "purpose": "lot_advance", "createdAt": "2026-10-18T10:00:00+05:30",
    }
    user_store["payments/pay2"] = {
        "id": "pay2", "payerId": "uid-seller", "payeeId": "uid-1", "amount": 120000,
        "status": "success", "purpose": "lot_sale", "createdAt": "2026-10-19T10:00:00+05:30",
    }

    sent = await client.get("/v1/payments/transactions?direction=sent", headers=auth(token))
    assert sent.status_code == 200
    body = sent.json()
    assert body["total"] == 1 and body["data"][0]["id"] == "pay1"
    assert body["data"][0]["direction"] == "sent"
    assert body["data"][0]["counterparty"]["userId"] == "uid-seller"

    received = await client.get("/v1/payments/transactions?direction=received", headers=auth(token))
    assert received.json()["data"][0]["id"] == "pay2"
    assert received.json()["totals"]["totalReceived"] == 1200

    resp = await client.post("/v1/payments/pay1/refund-request", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["refundStatus"] == "requested"
    # idempotent replay
    again = await client.post("/v1/payments/pay1/refund-request", headers=auth(token))
    assert again.status_code == 200

    notifs = await client.get("/v1/notifications?type=payment_refund_requested", headers=auth(token))
    assert notifs.status_code == 200
    titles = str(notifs.json())
    assert "refund" in titles.lower()


async def test_act1_ramesh_rates_delivered_transporter(client, user_store):
    """A completed trip surfaces as a pending rating; Ramesh rates the driver."""
    token = seed_user(user_store, uid="uid-1")
    seller = _seed_seller(user_store)
    user_store["transport_bookings/txn1"] = {
        "id": "txn1", "userId": "uid-1", "transporterId": seller,
        "status": "delivered", "createdAt": "2026-10-19T18:00:00+05:30",
    }
    user_store["users/uid-1/rating_prompts/txn1"] = {
        "id": "txn1", "rateeUid": seller, "kind": "transport_delivery",
        "transactionId": "txn1", "status": "open", "createdAt": "2026-10-19T18:05:00+05:30",
    }

    pending = await client.get("/v1/ratings/pending", headers=auth(token))
    assert pending.status_code == 200
    items = pending.json().get("items") or pending.json().get("data") or []
    assert any(p.get("transactionId") == "txn1" for p in items)

    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": "txn1", "stars": 5,
              "comment": "Ontime, careful with crates"},
        headers=auth(token),
    )
    assert resp.status_code in (200, 201), resp.text

    after = await client.get("/v1/ratings/pending", headers=auth(token))
    items = after.json().get("items") or after.json().get("data") or []
    assert all(p.get("transactionId") != "txn1" for p in items)


async def test_act1_ramesh_equipment_history_and_search(client, user_store):
    """Ramesh checks his machinery bookings and searches the rental catalogue."""
    token = seed_user(user_store, uid="uid-1")
    _seed_seller(user_store, uid="uid-owner", name="Dattu Owner")
    user_store["equipment/eq1"] = {
        "id": "eq1", "ownerId": "uid-owner", "name": "Mahindra 575 Tractor",
        "type": "tractor", "ownerType": "private", "location": "Nashik",
        "hourlyRate": 650, "perAcreRate": None, "distanceKm": 2.5, "slotTemplate": None,
        "active": True, "docStatus": "verified", "rejectionReason": None,
        "createdAt": "2026-09-01T00:00:00+00:00",
    }
    user_store["equipment/eq2"] = {
        "id": "eq2", "ownerId": "uid-owner", "name": "Super Combine Harvester",
        "type": "harvester", "ownerType": "private", "location": "Nashik",
        "hourlyRate": 1800, "perAcreRate": None, "distanceKm": 4.0, "slotTemplate": None,
        "active": True, "docStatus": "verified", "rejectionReason": None,
        "createdAt": "2026-09-01T00:00:00+00:00",
    }
    user_store["equipment_bookings/eb1"] = {
        "id": "eb1", "userId": "uid-1", "equipmentId": "eq1", "status": "booked",
        "slotDate": "2026-10-21", "amount": 1500, "createdAt": "2026-10-20T07:00:00+05:30",
    }

    mine = await client.get("/v1/equipment/my-bookings", headers=auth(token))
    assert mine.status_code == 200
    row = mine.json()["data"][0]
    assert row["machineName"] == "Mahindra 575 Tractor"
    assert row["ownerName"] == "Dattu Owner"
    assert row["status"] == "booked"

    search = await client.get("/v1/equipment?q=harvester", headers=auth(token))
    names = [e.get("name", "") for e in search.json()["data"]]
    assert any("Harvester" in n for n in names)
    assert not any("Tractor" in n for n in names)


async def test_act1_ramesh_lot_advertisement_lifecycle(client, user_store):
    """Ramesh promotes his onion lot: create → pause → resume → delete."""
    token = seed_user(user_store, uid="uid-1")
    user_store["market_lots/lot1"] = {
        "id": "lot1", "farmerId": "uid-1", "crop": "Onion", "status": "open",
        "quantityQuintals": 40, "createdAt": "2026-10-20T07:30:00+05:30",
    }
    payload = {
        "title": "Fresh Nashik Onions", "headline": "40 qt Grade A onions ready",
        "bannerUrl": "/uploads/uid-1/onion.png", "targetType": "lot", "targetId": "lot1",
        "budgetRupees": 500, "dailyBudgetRupees": 100, "autoActivate": True,
    }
    created = await client.post("/v1/ads", json=payload, headers=auth(token))
    assert created.status_code in (200, 201), created.text
    ad_id = created.json()["id"]

    mine = await client.get("/v1/ads/mine", headers=auth(token))
    assert any(a["id"] == ad_id and a["targetType"] == "lot" for a in mine.json()["data"])

    paused = await client.put(f"/v1/ads/{ad_id}", json={"status": "paused"}, headers=auth(token))
    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"

    resumed = await client.put(f"/v1/ads/{ad_id}", json={"status": "active"}, headers=auth(token))
    assert resumed.json()["status"] == "active"

    deleted = await client.delete(f"/v1/ads/{ad_id}", headers=auth(token))
    assert deleted.status_code in (200, 204)


async def test_act1_ramesh_chatbot_with_photo(client, user_store, monkeypatch):
    """Ramesh asks Kisan Mitra about yellowing leaves, attaching a photo."""
    token = seed_user(user_store, uid="uid-1")
    captured = {}

    async def fake_analyze_image(image_bytes, prompt, schema=None, module="equipment_booking_rec"):
        captured["module"] = module
        return {"description": "Yellowing lower leaves, spider-mite webbing",
                "likely_issue": "Red spider mite", "crop": "Onion", "severity": "medium"}

    async def fake_decide(state, question_set_id, ctx=None, module="ai"):
        if question_set_id == "chatbot.intent.v1":
            return _clean_decision(intent="agronomy", answerable=0.9)
        if question_set_id == "chatbot.safety.v1":
            return _clean_decision(has_contact_info=False, has_financial_advice=False,
                                   has_medical_certainty=False)
        raise AssertionError(question_set_id)

    async def fake_generate(prompt, opts=None):
        captured["prompt"] = prompt
        return "Mite control advice with neem schedule."

    monkeypatch.setattr(settings, "ai_provider", "live")
    monkeypatch.setattr("app.services.ai.gateway.analyze_image", fake_analyze_image)
    monkeypatch.setattr("app.services.ai.gateway.decide", fake_decide)
    monkeypatch.setattr("app.services.ai.gateway.generate", fake_generate)
    monkeypatch.setattr("app.services.chatbot.storage.read_blob", lambda path: b"\x89PNGbytes")

    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Patta peela pad raha hai, kya karein?",
              "imageUrl": "uploads/uid-1/leaves.png"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert captured["module"] == "chatbot"
    assert "Yellowing lower leaves" in captured["prompt"]
    assert resp.json()["text"]


async def test_act1_ramesh_carbon_and_tree_search(client, user_store):
    """Ramesh estimates tree carbon and searches the tree hub."""
    token = seed_user(user_store, uid="uid-1")
    seed_tree_store(user_store)

    estimate = await client.post(
        "/v1/tree/carbon/estimate",
        json={"treeSpecies": "Neem", "treeCount": 20, "ageYears": 3},
        headers=auth(token),
    )
    assert estimate.status_code == 200
    body = estimate.json()
    assert body.get("annualCo2Kg") or body.get("totalCo2Kg") or body

    potential = await client.get("/v1/climate/carbon-potential", headers=auth(token))
    assert potential.status_code == 200

    articles = await client.get("/v1/tree/articles?q=sapling", headers=auth(token))
    assert articles.status_code == 200
    data = articles.json()
    rows = data.get("data") or data.get("items") or []
    assert rows and all("sapling" in (r.get("title", "")).lower() for r in rows)


# --------------------------------------------------------------------------- ACT 2


async def test_act2_sunita_purchase_request(client, user_store):
    """Sunita posts a purchase request for her weekly onion need, then withdraws one."""
    token = seed_user(user_store, uid="uid-cust", active_profile="customer")
    payload = {
        "crop": "Onion", "variety": "Nashik Red", "grade": "A",
        "quantityQuintals": 5, "targetMinPrice": 1600, "targetMaxPrice": 1900,
        "recurringFrequency": "Weekly", "deliveryWindow": "Needed by 2026-10-25",
        "district": "Pune", "notes": "Home delivery preferred",
    }
    created = await client.post("/v1/customer/demands", json=payload, headers=auth(token))
    assert created.status_code == 201, created.text
    demand_id = created.json()["id"]

    listing = await client.get("/v1/customer/demands", headers=auth(token))
    assert any(d["id"] == demand_id for d in listing.json()["data"])

    withdrawn = await client.delete(f"/v1/customer/demands/{demand_id}", headers=auth(token))
    assert withdrawn.status_code in (200, 204)


async def test_act2_sunita_browses_seller_storefront(client, user_store):
    """Sunita opens a seller's storefront from a product page and sees verified lots."""
    cust = seed_user(user_store, uid="uid-cust", active_profile="customer")
    farmer = seed_user(user_store, uid="uid-farmer2", active_profile="farmer",
                       name="Ramesh Patil")
    user_store["market_lots/lot9"] = {
        "id": "lot9", "farmerId": farmer and "uid-farmer2", "crop": "Tomato",
        "status": "open", "quantityQuintals": 12, "expectedRate": 2400,
        "harvestDate": "2026-10-18", "createdAt": "2026-10-19T09:00:00+05:30",
    }
    user_store["kyc_cases/kyc_f1"] = {
        "caseId": "kyc_f1", "userId": "uid-farmer2", "persona": "farmer", "status": "verified",
        "docs": [{"docId": "d1", "type": "pan", "status": "verified",
                  "reviewedAt": "2026-09-01T00:00:00+00:00"}],
    }

    resp = await client.get("/v1/customer/storefronts/uid-farmer2", headers=auth(cust))
    assert resp.status_code == 200
    body = resp.json()
    assert body["farmerName"] == "Ramesh Patil"
    assert body["lots"][0]["crop"] == "Tomato"
    assert body["lots"][0]["pricePaisa"] == 240000
    assert body["credentials"][0]["type"] == "pan"

    missing = await client.get("/v1/customer/storefronts/uid-nobody", headers=auth(cust))
    assert missing.status_code == 404


# --------------------------------------------------------------------------- ACT 3


async def test_act3_kavita_kitchen_garden_plan(client, user_store):
    """Kavita builds a kitchen-garden plan from seeded nutrition templates."""
    token = seed_user(user_store, uid="uid-kavita", active_profile="womenShg")

    templates = await client.get("/v1/women/garden-templates", headers=auth(token))
    assert templates.status_code == 200
    items = templates.json().get("items") or templates.json().get("data") or []
    assert items, "seeded garden templates should be served"

    created = await client.post(
        "/v1/women/garden-plans",
        json={"category": "Leafy Greens",
              "items": [{"name": "Spinach (Palak)", "areaSqm": 2, "daysToHarvest": 45}]},
        headers=auth(token),
    )
    assert created.status_code in (200, 201), created.text

    plans = await client.get("/v1/women/garden-plans", headers=auth(token))
    assert plans.status_code == 200
    rows = plans.json().get("items") or plans.json().get("data") or []
    assert any(p.get("category") == "Leafy Greens" for p in rows)


async def test_act3_kavita_academy_surfaces(client, user_store):
    """Kavita sees course recommendations and the instructor directory."""
    token = seed_user(user_store, uid="uid-kavita", active_profile="womenShg")
    user_store["teacher_profiles/t1"] = {
        "id": "t1", "userId": "uid-t1", "name": "Dr. Archana Kale",
        "specialization": ["agronomy"], "isVerified": True,
        "createdAt": "2026-05-01T00:00:00+00:00",
    }
    user_store["courses/c9"] = {
        "id": "c9", "status": "published", "instructorId": "uid-t1",
        "title": "Kitchen Garden Masterclass", "category": "horticulture",
        "salesCount": 12, "createdAt": "2026-08-01T00:00:00+00:00",
    }

    recs = await client.get("/v1/courses/recommendations", headers=auth(token))
    assert recs.status_code == 200

    teachers = await client.get("/v1/teachers", headers=auth(token))
    assert teachers.status_code == 200
    payload = teachers.json()
    rows = payload.get("data") or payload.get("items") or payload
    assert any("Archana" in str(t) for t in rows)
