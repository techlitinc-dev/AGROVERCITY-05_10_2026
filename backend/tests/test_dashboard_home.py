"""Dashboard home breadth (SR 1) — buyer offers, learning recommendations and
pending orders/bookings hydrate GET /dashboard/home, each degrading to a safe
empty value instead of ever 500-ing the payload."""
from tests.test_diary import auth, seed_user

NOW = "2026-10-20T00:00:00+00:00"


def _demand(doc_id, crop, created_at, **overrides):
    return {
        "id": doc_id,
        "crop": crop,
        "quantity": 10.0,
        "unit": "quintal",
        "maxPrice": 2200,
        "deliveryLocation": "Nashik APMC",
        "state": "Maharashtra",
        "status": "open",
        "offersCount": 3,
        "createdAt": created_at,
        **overrides,
    }


def _course(doc_id, instructor_id, created_at, **overrides):
    return {
        "id": doc_id,
        "instructorId": instructor_id,
        "title": "Tomato IPM",
        "instructorName": "Guru Shinde",
        "category": "Pest Management",
        "priceRupees": 199.0,
        "status": "published",
        "salesCount": 0,
        "isFeatured": False,
        "isBestseller": False,
        "createdAt": created_at,
        **overrides,
    }


async def test_home_requires_auth(client):
    resp = await client.get("/v1/dashboard/home")
    assert resp.status_code in (401, 403)


async def test_home_empty_store_returns_safe_empties(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/dashboard/home", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    # Existing keys still present.
    assert "weather" in body
    assert "urgentTask" in body
    assert body["mandiRates"] == []
    assert body["banners"] == []
    # New keys degrade to empty values, never an error.
    assert body["buyerOffers"] == []
    assert body["learningRecommendations"] == []
    assert body["pendingOrders"] == {
        "purchases": {"count": 0, "items": []},
        "transport": {"count": 0, "items": []},
        "equipment": {"count": 0, "items": []},
    }


async def test_buyer_offers_prioritize_active_crops_and_limit_five(client, user_store):
    token = seed_user(user_store, crops=["Onion"], activeCrops=["Onion"])
    for i in range(6):
        user_store[f"demands/dem_other_{i}"] = _demand(
            f"dem_other_{i}", "Soybean", f"2026-10-1{i}T00:00:00+00:00"
        )
    user_store["demands/dem_old_onion"] = _demand(
        "dem_old_onion", "Onion", "2026-10-05T00:00:00+00:00"
    )
    user_store["demands/dem_new_onion"] = _demand(
        "dem_new_onion", "Onion", "2026-10-19T00:00:00+00:00", offersCount=7
    )
    user_store["demands/dem_closed"] = _demand(
        "dem_closed", "Onion", "2026-10-20T00:00:00+00:00", status="closed"
    )

    resp = await client.get("/v1/dashboard/home", headers=auth(token))
    assert resp.status_code == 200
    offers = resp.json()["buyerOffers"]
    assert len(offers) == 5
    # Matching-crop demands first, newest first; closed demand excluded.
    assert [o["id"] for o in offers[:2]] == ["dem_new_onion", "dem_old_onion"]
    assert all(o["id"] != "dem_closed" for o in offers)
    first = offers[0]
    assert first["crop"] == "Onion"
    assert first["quantity"] == 10.0
    assert first["unit"] == "quintal"
    assert first["budgetPerQuintal"] == 2200
    assert first["location"] == "Nashik APMC"
    assert first["offersCount"] == 7


async def test_learning_recommendations_exclude_own_courses(client, user_store):
    token = seed_user(user_store)
    user_store["courses/course_mine"] = _course(
        "course_mine", "uid-1", "2026-10-19T00:00:00+00:00", isFeatured=True
    )
    user_store["courses/course_featured"] = _course(
        "course_featured", "uid-instructor", "2026-10-01T00:00:00+00:00",
        isFeatured=True, salesCount=5,
    )
    user_store["courses/course_plain_a"] = _course(
        "course_plain_a", "uid-instructor", "2026-10-15T00:00:00+00:00"
    )
    user_store["courses/course_plain_b"] = _course(
        "course_plain_b", "uid-instructor", "2026-10-10T00:00:00+00:00"
    )
    user_store["courses/course_draft"] = _course(
        "course_draft", "uid-instructor", "2026-10-20T00:00:00+00:00",
        status="pendingReview",
    )

    resp = await client.get("/v1/dashboard/home", headers=auth(token))
    assert resp.status_code == 200
    recs = resp.json()["learningRecommendations"]
    ids = [r["id"] for r in recs]
    assert "course_mine" not in ids
    assert "course_draft" not in ids
    assert len(recs) == 3
    # Featured first, then newest published.
    assert ids[0] == "course_featured"
    assert ids[1:] == ["course_plain_a", "course_plain_b"]
    assert recs[0]["title"] == "Tomato IPM"
    assert recs[0]["instructorName"] == "Guru Shinde"
    assert recs[0]["priceRupees"] == 199.0


async def test_pending_orders_counts_active_only(client, user_store):
    token = seed_user(user_store)
    user_store["purchases/pur_active"] = {
        "id": "pur_active", "farmerId": "uid-1", "buyerName": "Vyapari Verma",
        "crop": "Tomato", "variety": "Desi", "quantity": 12.0, "unit": "quintal",
        "status": "confirmed", "createdAt": NOW,
    }
    user_store["purchases/pur_done"] = {
        "id": "pur_done", "farmerId": "uid-1", "crop": "Onion",
        "status": "completed", "createdAt": NOW,
    }
    user_store["purchases/pur_cancelled"] = {
        "id": "pur_cancelled", "farmerId": "uid-1", "crop": "Wheat",
        "status": "cancelled", "createdAt": NOW,
    }
    user_store["purchases/pur_other_farmer"] = {
        "id": "pur_other_farmer", "farmerId": "uid-2", "crop": "Cotton",
        "status": "confirmed", "createdAt": NOW,
    }
    user_store["transport_bookings/trb_active"] = {
        "id": "trb_active", "userId": "uid-1", "commodity": "Tomato",
        "pickup": "Nashik", "drop": "Pune", "date": "2026-10-22",
        "status": "requested", "createdAt": NOW,
    }
    user_store["transport_bookings/trb_delivered"] = {
        "id": "trb_delivered", "userId": "uid-1", "commodity": "Onion",
        "status": "delivered", "createdAt": NOW,
    }
    user_store["equipment/eq_1"] = {
        "id": "eq_1", "name": "John Deere Tractor", "ownerId": "uid-9",
    }
    user_store["equipment_bookings/eqb_pending"] = {
        "id": "eqb_pending", "userId": "uid-1", "equipmentId": "eq_1",
        "slotName": "Morning", "date": "2026-10-25",
        "status": "pending", "createdAt": NOW,
    }
    user_store["equipment_bookings/eqb_rejected"] = {
        "id": "eqb_rejected", "userId": "uid-1", "equipmentId": "eq_1",
        "status": "rejected", "createdAt": NOW,
    }

    resp = await client.get("/v1/dashboard/home", headers=auth(token))
    assert resp.status_code == 200
    pending = resp.json()["pendingOrders"]

    assert pending["purchases"]["count"] == 1
    purchase_item = pending["purchases"]["items"][0]
    assert purchase_item["id"] == "pur_active"
    assert purchase_item["status"] == "confirmed"
    assert purchase_item["linkHint"] == "/farmer/purchases"
    assert "Tomato" in purchase_item["label"]
    assert "Vyapari Verma" in purchase_item["label"]

    assert pending["transport"]["count"] == 1
    transport_item = pending["transport"]["items"][0]
    assert transport_item["id"] == "trb_active"
    assert "Nashik → Pune" in transport_item["label"]
    assert transport_item["linkHint"] == "/farmer/transport"

    assert pending["equipment"]["count"] == 1
    equipment_item = pending["equipment"]["items"][0]
    assert equipment_item["id"] == "eqb_pending"
    assert "John Deere Tractor" in equipment_item["label"]
    assert equipment_item["linkHint"] == "/farmer/equipment"
