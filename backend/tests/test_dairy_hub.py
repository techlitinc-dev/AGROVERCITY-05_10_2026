"""Dairy trade hub: dairy/farmer cards, dashboards, self ratings, live
demand/bid feeds, standing orders with full specs, receipts with the
buyer-side commission rule, commission structure, post-acceptance chat.

All assertions run against docs created through the API or real collection
docs seeded into the store — no demo/fake fallback data.
"""

from datetime import datetime, timezone

from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _dairy_user(user_store, uid="uid-d1", name="Prabhat Dairy", **extra):
    extra.setdefault("state", "Maharashtra")
    extra.setdefault("district", "Nashik")
    return seed_user(
        user_store, uid=uid, active_profile="dairyManager",
        linkedProfiles=["dairyManager"], primaryProfile="dairyManager",
        name=name, **extra,
    )


def _farmer(user_store, uid="uid-f1", name="Ram Patil", **extra):
    extra.setdefault("state", "Maharashtra")
    extra.setdefault("village", "Pimplas")
    return seed_user(user_store, uid=uid, active_profile="farmer", name=name, **extra)


def _dairy_purchase(user_store, pid, buyer, farmer, status="confirmed", created=None, **extra):
    doc = {
        "id": pid,
        "buyerId": buyer,
        "buyerName": "Prabhat Dairy",
        "farmerId": farmer,
        "farmerName": "Ram Patil",
        "source": {"type": "dairy", "refId": "dm_x", "category": "milk"},
        "crop": "Milk",
        "variety": "Buffalo",
        "category": "milk",
        "quantity": 50.0,
        "unit": "litre",
        "agreedPricePerUnit": 6600,  # paise per litre (₹66)
        "totalAmount": 330000,  # paisa
        "status": status,
        "pickup": None,
        "payments": [],
        "qc": None,
        "finalAmount": None,
        "rating": {"buyerToFarmer": None, "farmerToBuyer": None},
        "createdAt": created or _now(),
        "updatedAt": created or _now(),
    }
    doc.update(extra)
    user_store[f"purchases/{pid}"] = doc
    return doc


def _notifications_for(user_store, uid, ntype):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/")
        and doc.get("userId") == uid
        and doc.get("type") == ntype
    ]


STANDING_BODY = {
    "milkType": "Buffalo",
    "minFatPercent": 6.0,
    "minSnfPercent": 9.0,
    "quantityPerSlotLiters": 500,
    "frequency": "daily",
    "minRatePerLiter": 62,
    "maxRatePerLiter": 68,
    "startDate": "2026-11-01",
    "endDate": "2026-12-31",
    "procurementZone": "Nashik Rural",
    "pickupSlot": "Morning",
}


# ---------------- public cards ----------------


async def test_dairy_card_real_docs(client, user_store):
    _dairy_user(user_store)
    farmer = _farmer(user_store)
    user_store["users/uid-d1/role_profiles/dairyManager"] = {
        "centerName": "Prabhat Dudh Sangh",
        "licenseNumber": "FSSAI-123",
        "dailyCapacityLiters": 2000.0,
        "serviceRadiusKm": 25,
    }
    user_store["dairy_demands/dm1"] = {
        "id": "dm1", "managerId": "uid-d1", "status": "active", "milkType": "Buffalo",
        "createdAt": "2026-10-10T00:00:00+00:00",
    }
    user_store["rate_charts/rc1"] = {
        "id": "rc1", "centerId": "uid-d1", "species": "Cow", "baseRate": 48.0, "active": True,
        "effectiveFrom": "2026-10-01",
    }
    user_store["dairy_stock_items/st1"] = {
        "id": "st1", "centerId": "uid-d1", "name": "A2 Ghee", "category": "ghee",
    }
    _dairy_purchase(user_store, "pur1", "uid-d1", "uid-f1", status="completed",
                    rating={"buyerToFarmer": None,
                            "farmerToBuyer": {"rating": 5, "review": "fair rates", "at": "2026-10-10T01:00:00+00:00"}})
    resp = await client.get("/v1/dairy/dairies/uid-d1", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["dairyName"] == "Prabhat Dudh Sangh"
    assert body["ownerName"] == "Prabhat Dairy"
    assert body["address"]["state"] == "Maharashtra"
    assert body["verifiedBadge"] == {"fssaiVerified": True}
    assert body["serviceRadiusKm"] == 25
    assert body["capacityPerDayLiters"] == 2000.0
    assert body["capacityPerMonthLiters"] == 60000.0
    assert set(body["products"]) == {"Buffalo", "Cow milk", "A2 Ghee"}
    assert body["rating"] == {"average": 5.0, "count": 1}
    assert body["recentReviews"][0]["review"] == "fair rates"


async def test_dairy_card_not_found(client, user_store):
    farmer = _farmer(user_store)
    resp = await client.get("/v1/dairy/dairies/uid-nope", headers=auth(farmer))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DAIRY_NOT_FOUND"


async def test_farmer_card_real_docs(client, user_store):
    _dairy_user(user_store)
    _farmer(user_store, activeCrops=["Tomato"])
    user_store["dairy_bids/b1"] = {
        "id": "b1", "managerId": "uid-d1", "farmerId": "uid-f1", "milkType": "Buffalo",
        "status": "pending", "createdAt": "2026-10-10T00:00:00+00:00",
    }
    user_store["dairy_collections/c1"] = {
        "id": "c1", "managerId": "uid-d1", "farmerId": "uid-f1", "milkType": "Cow",
        "quantityLiters": 40, "collectedAt": "2026-10-10T00:00:00+00:00",
    }
    _dairy_purchase(user_store, "pur1", "uid-d1", "uid-f1", status="completed",
                    rating={"buyerToFarmer": {"rating": 4, "review": "prompt pickup", "at": "2026-10-10T02:00:00+00:00"},
                            "farmerToBuyer": None})
    resp = await client.get("/v1/dairy/farmers/uid-f1", headers=auth(create_access_token("uid-d1")))
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Ram Patil"
    assert set(body["products"]) == {"Buffalo", "Cow", "Tomato"}
    assert body["rating"] == {"average": 4.0, "count": 1}
    assert body["recentReviews"][0]["review"] == "prompt pickup"


# ---------------- farmer home ----------------


async def test_farmer_home_daily_dairies_and_rates(client, user_store):
    _dairy_user(user_store)
    farmer = _farmer(user_store)
    user_store["users/uid-d1/role_profiles/dairyManager"] = {
        "centerName": "Prabhat Dudh Sangh",
    }
    today = _today()
    user_store["dairy_demands/dm1"] = {
        "id": "dm1", "managerId": "uid-d1", "status": "active", "milkType": "Buffalo",
        "dailyQuantityLiters": 600, "targetRatePerLiter": 66.0,
        "createdAt": f"{today}T06:00:00+00:00",
    }
    user_store["dairy_bids/b1"] = {
        "id": "b1", "managerId": "uid-d1", "farmerId": "uid-f1", "milkType": "Buffalo",
        "offeredRatePerLiter": 65.0, "dailyLiters": 50, "status": "accepted",
        "createdAt": f"{today}T06:30:00+00:00", "acceptedAt": f"{today}T07:00:00+00:00",
    }
    user_store["dairy_collections/c1"] = {
        "id": "c1", "managerId": "uid-d1", "farmerId": "uid-f1", "milkType": "Buffalo",
        "quantityLiters": 48, "ratePerLiter": 66.0,
        "collectedAt": f"{today}T08:00:00+00:00",
    }
    user_store["rate_charts/rc1"] = {
        "id": "rc1", "centerId": "uid-d1", "species": "Buffalo", "baseRate": 66.0,
        "active": True, "effectiveFrom": today,
    }
    _dairy_purchase(user_store, "pur1", "uid-d1", "uid-f1")
    resp = await client.get("/v1/dairy/farmer/home", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    entry = body["dailyDairies"][0]
    assert entry["managerId"] == "uid-d1"
    assert entry["dairyName"] == "Prabhat Dudh Sangh"
    kinds = {a["kind"] for a in entry["activities"]}
    assert kinds == {"demand_posted", "bid_sent", "request_accepted", "collected"}
    rates = body["todaysRates"]
    assert rates[0]["species"] == "Buffalo"
    assert rates[0]["baseRate"] == 66.0
    assert body["recentPurchases"][0]["id"] == "pur1"
    assert body["recentPosts"][0]["id"] == "b1"
    assert body["stats"]["liveDemands"] == 1
    assert body["stats"]["todayLitersCollected"] == 48.0


async def test_farmer_home_forbidden_for_manager(client, user_store):
    _dairy_user(user_store)
    resp = await client.get("/v1/dairy/farmer/home", headers=auth(create_access_token("uid-d1")))
    assert resp.status_code == 403


# ---------------- dairy dashboard ----------------


async def test_dairy_dashboard(client, user_store):
    manager = _dairy_user(user_store)
    today = _today()
    user_store["dairy_demands/dm1"] = {
        "id": "dm1", "managerId": "uid-d1", "status": "active", "milkType": "Buffalo",
        "createdAt": f"{today}T06:00:00+00:00",
    }
    user_store["dairy_demands/dm2"] = {
        "id": "dm2", "managerId": "uid-d1", "status": "fulfilled", "milkType": "Cow",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["dairy_standing_orders/dso1"] = {
        **STANDING_BODY, "id": "dso1", "managerId": "uid-d1", "managerName": "Prabhat Dairy",
        "status": "open", "createdAt": "2026-10-10T00:00:00+00:00",
    }
    user_store["dairy_bids/b1"] = {
        "id": "b1", "managerId": "uid-d1", "farmerId": "uid-f1", "status": "pending",
        "createdAt": "2026-10-10T00:00:00+00:00",
    }
    _dairy_purchase(user_store, "pur1", "uid-d1", "uid-f1")
    resp = await client.get("/v1/dairy/dashboard", headers=auth(manager))
    assert resp.status_code == 200
    body = resp.json()
    assert [d["id"] for d in body["todaysLiveDemands"]] == ["dm1"]
    assert body["recentPurchases"][0]["id"] == "pur1"
    assert body["standingOrders"]["active"] == 1
    assert body["liveBids"][0]["id"] == "b1"
    assert body["stats"]["activeDemands"] == 1


# ---------------- self ratings ----------------


async def test_farmer_dairy_ratings(client, user_store):
    farmer = _farmer(user_store)
    _dairy_purchase(user_store, "pur1", "uid-d1", "uid-f1", status="completed",
                    rating={"buyerToFarmer": {"rating": 5, "review": "clean milk", "at": "2026-10-10T01:00:00+00:00"},
                            "farmerToBuyer": None})
    user_store["ratings/rat1"] = {
        "id": "rat1", "bookingKind": "dairy_collection", "bookingId": "ord1",
        "stars": 3, "comment": "avg", "raterId": "uid-d1", "providerId": "uid-f1",
        "createdAt": "2026-10-11T00:00:00+00:00",
    }
    resp = await client.get("/v1/dairy/farmer/ratings", headers=auth(farmer))
    body = resp.json()
    assert body["count"] == 2
    assert body["average"] == 4.0
    texts = {r["review"] for r in body["reviews"]}
    assert texts == {"clean milk", "avg"}


async def test_dairy_ratings(client, user_store):
    manager = _dairy_user(user_store)
    _dairy_purchase(user_store, "pur1", "uid-d1", "uid-f1", status="completed",
                    rating={"buyerToFarmer": None,
                            "farmerToBuyer": {"rating": 4, "review": "paid on time", "at": "2026-10-10T01:00:00+00:00"}})
    resp = await client.get("/v1/dairy/ratings", headers=auth(manager))
    body = resp.json()
    assert body["count"] == 1
    assert body["average"] == 4.0
    assert body["reviews"][0]["fromName"] == "Ram Patil"


# ---------------- live feeds ----------------


async def test_demands_browse_enriched(client, user_store):
    _dairy_user(user_store)
    farmer = _farmer(user_store)
    user_store["users/uid-d1/role_profiles/dairyManager"] = {
        "centerName": "Prabhat Dudh Sangh",
    }
    user_store["dairy_demands/dm1"] = {
        "id": "dm1", "managerId": "uid-d1", "status": "active", "milkType": "Buffalo",
        "dailyQuantityLiters": 500, "targetRatePerLiter": 66.0,
        "createdAt": "2026-10-10T00:00:00+00:00",
    }
    user_store["dairy_demands/dm2"] = {
        "id": "dm2", "managerId": "uid-d1", "status": "fulfilled", "milkType": "Cow",
        "createdAt": "2026-10-10T00:00:00+00:00",
    }
    user_store["dairy_bids/b1"] = {
        "id": "b1", "rfqId": "dm1", "managerId": "uid-d1", "farmerId": "uid-f9",
        "status": "pending", "createdAt": "2026-10-10T01:00:00+00:00",
    }
    user_store["dairy_bids/b2"] = {
        "id": "b2", "rfqId": "dm1", "managerId": "uid-d1", "farmerId": "uid-f8",
        "status": "accepted", "createdAt": "2026-10-10T01:00:00+00:00",
    }
    resp = await client.get("/v1/dairy/demands/browse", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    entry = body["data"][0]
    assert entry["id"] == "dm1"
    assert entry["bidsCount"] == 1  # accepted bid not live
    assert entry["dairySummary"]["dairyName"] == "Prabhat Dudh Sangh"
    assert entry["dairySummary"]["verified"] is True


async def test_bids_browse_for_dairies(client, user_store):
    _dairy_user(user_store)
    _farmer(user_store)
    user_store["dairy_bids/b1"] = {
        "id": "b1", "managerId": "uid-d1", "farmerId": "uid-f1", "milkType": "Buffalo",
        "offeredRatePerLiter": 65.0, "dailyLiters": 50,
        "status": "pending", "createdAt": "2026-10-10T00:00:00+00:00",
    }
    user_store["dairy_bids/b2"] = {
        "id": "b2", "managerId": "uid-d1", "farmerId": "uid-f1",
        "status": "accepted", "createdAt": "2026-10-10T00:00:00+00:00",
    }
    manager_token = create_access_token("uid-d1")
    resp = await client.get("/v1/dairy/bids/browse", headers=auth(manager_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["farmerSummary"]["name"] == "Ram Patil"
    # farmer role cannot browse the dairy-side feed
    resp = await client.get("/v1/dairy/bids/browse", headers=auth(create_access_token("uid-f1")))
    assert resp.status_code == 403


# ---------------- standing orders ----------------


async def test_dairy_standing_order_crud(client, user_store):
    manager = _dairy_user(user_store)
    farmer = _farmer(user_store)
    resp = await client.post("/v1/dairy/standing-orders", json=STANDING_BODY, headers=auth(manager))
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["id"].startswith("dso_")
    assert doc["status"] == "open"
    assert doc["minFatPercent"] == 6.0
    assert doc["minRatePerLiter"] == 62 and doc["maxRatePerLiter"] == 68
    order_id = doc["id"]

    resp = await client.get("/v1/dairy/standing-orders", headers=auth(manager))
    assert resp.json()["total"] == 1

    resp = await client.put(
        f"/v1/dairy/standing-orders/{order_id}",
        json={"maxRatePerLiter": 70, "quantityPerSlotLiters": 550},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    assert resp.json()["maxRatePerLiter"] == 70
    assert resp.json()["quantityPerSlotLiters"] == 550

    resp = await client.post(f"/v1/dairy/standing-orders/{order_id}/close", headers=auth(manager))
    assert resp.json()["status"] == "closed"

    resp = await client.put(
        f"/v1/dairy/standing-orders/{order_id}", json={"maxRatePerLiter": 71}, headers=auth(manager)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "STANDING_ORDER_CLOSED"

    # farmer blocked from the manager surface
    resp = await client.post("/v1/dairy/standing-orders", json=STANDING_BODY, headers=auth(farmer))
    assert resp.status_code == 403


async def test_dairy_standing_order_validation(client, user_store):
    manager = _dairy_user(user_store)
    resp = await client.post(
        "/v1/dairy/standing-orders",
        json={**STANDING_BODY, "minRatePerLiter": 70, "maxRatePerLiter": 68},
        headers=auth(manager),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_PRICE_BAND"
    resp = await client.post(
        "/v1/dairy/standing-orders",
        json={**STANDING_BODY, "startDate": "2026-12-31", "endDate": "2026-11-01"},
        headers=auth(manager),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"


async def test_dairy_standing_browse_live(client, user_store):
    _dairy_user(user_store)
    farmer = _farmer(user_store)
    user_store["dairy_standing_orders/dso1"] = {
        **STANDING_BODY, "id": "dso1", "managerId": "uid-d1", "managerName": "Prabhat Dairy",
        "status": "open", "endDate": "2999-01-01", "createdAt": "2026-10-10T00:00:00+00:00",
    }
    user_store["dairy_standing_orders/dso2"] = {
        **STANDING_BODY, "id": "dso2", "managerId": "uid-d1", "managerName": "Prabhat Dairy",
        "status": "closed", "endDate": "2999-01-01", "createdAt": "2026-10-10T00:00:00+00:00",
    }
    user_store["dairy_standing_orders/dso3"] = {
        **STANDING_BODY, "id": "dso3", "managerId": "uid-d1", "managerName": "Prabhat Dairy",
        "status": "open", "endDate": "2020-01-01", "createdAt": "2026-10-10T00:00:00+00:00",
    }
    resp = await client.get("/v1/dairy/standing/browse", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    entry = body["data"][0]
    assert entry["id"] == "dso1"
    assert entry["minFatPercent"] == 6.0
    assert entry["quantityPerSlotLiters"] == 500
    assert entry["frequency"] == "daily"
    assert entry["dairySummary"]["verified"] is True


# ---------------- receipts & commission ----------------


async def test_dairy_receipt_buyer_side_commission(client, user_store):
    _dairy_user(user_store)
    farmer = _farmer(user_store)
    _dairy_purchase(
        user_store, "pur1", "uid-d1", "uid-f1", status="completed",
        finalAmount=330000,
        pickup={"date": "2026-10-11", "vehicleType": "", "address": "", "notes": "", "mode": "buyerPicksup", "slot": ""},
        payments=[{"id": "p1", "kind": "full", "amount": 330000, "method": "upi", "reference": "u1", "at": "2026-10-10T01:00:00+00:00"}],
    )
    resp = await client.get("/v1/dairy/purchases/pur1/receipt", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["receiptNo"].startswith("DRC-")
    assert body["product"] == {"name": "Buffalo", "quantity": 50.0, "unit": "litre"}
    assert body["dairyRateRupeesPerLiter"] == 66.0
    assert body["amounts"]["tradeTotalRupees"] == 3300.0
    assert body["amounts"]["paidRupees"] == 3300.0
    assert body["amounts"]["dueRupees"] == 0.0
    # commission charged from the dairy side — farmer payout never reduced
    assert body["commission"]["percent"] == 3.0
    assert body["commission"]["amountRupees"] == 99.0
    assert body["commission"]["chargedFrom"] == "dairy"
    assert body["commission"]["farmerPayoutRupees"] == 3201.0
    assert body["dairy"]["name"] == "Prabhat Dairy"
    assert body["farmer"]["name"] == "Ram Patil"


async def test_dairy_receipt_guards(client, user_store):
    _dairy_user(user_store)
    farmer = _farmer(user_store)
    _farmer(user_store, uid="uid-x1", name="Rando")
    _dairy_purchase(user_store, "pur1", "uid-d1", "uid-f1", status="cancelled")
    resp = await client.get("/v1/dairy/purchases/pur1/receipt", headers=auth(create_access_token("uid-x1")))
    assert resp.status_code == 403
    resp = await client.get("/v1/dairy/purchases/pur1/receipt", headers=auth(farmer))
    assert resp.status_code == 409
    # non-dairy purchase not found here
    user_store["purchases/pur2"] = {
        **user_store["purchases/pur1"], "id": "pur2",
        "source": {"type": "lot", "refId": "lot1"}, "status": "confirmed",
    }
    resp = await client.get("/v1/dairy/purchases/pur2/receipt", headers=auth(farmer))
    assert resp.status_code == 404


async def test_dairy_commission_structure(client, user_store):
    farmer = _farmer(user_store)
    resp = await client.get("/v1/dairy/commission-structure", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["trade"] == "dairy"
    assert body["categoryRatesPercent"] == {"milk": 3, "produce": 5, "livestock": 2}
    assert body["chargedFrom"] == "dairy"
    assert body["farmerSidePercent"] == 0


# ---------------- chat gating + accept flow ----------------


async def test_dairy_bid_accept_opens_chat_and_notifies(client, user_store):
    manager = _dairy_user(user_store)
    farmer = _farmer(user_store)
    user_store["dairy_demands/dm1"] = {
        "id": "dm1", "managerId": "uid-d1", "managerName": "Prabhat Dairy",
        "milkType": "Buffalo", "minFatPercent": 6.0, "minSnfPercent": 9.0,
        "dailyQuantityLiters": 500, "targetRatePerLiter": 66.0,
        "status": "active", "createdAt": _now(),
    }
    user_store["dairy_bids/b1"] = {
        "id": "b1", "managerId": "uid-d1", "rfqId": "dm1", "farmerId": "uid-f1",
        "farmerName": "Ram Patil", "milkType": "Buffalo",
        "offeredRatePerLiter": 65.0, "dailyLiters": 50,
        "status": "pending", "negotiationRound": 1, "createdAt": _now(),
    }
    resp = await client.post("/v1/dairy-manager/bids/b1/accept", headers=auth(manager))
    assert resp.status_code == 200
    purchase = resp.json()["purchase"]
    assert purchase["source"]["type"] == "dairy"
    purchase_id = purchase["id"]

    # farmer got the request-accepted notification
    notes = _notifications_for(user_store, "uid-f1", "request_accepted")
    assert len(notes) == 1
    assert notes[0]["data"]["deepLink"].endswith(purchase_id)

    # chat room exists for the accepted deal (both sides)
    resp = await client.get(f"/v1/dairy/purchases/{purchase_id}/chat-room", headers=auth(farmer))
    assert resp.status_code == 200
    assert resp.json()["room"]["kind"] == "purchase"
    resp = await client.get(f"/v1/dairy/purchases/{purchase_id}/chat-room", headers=auth(manager))
    assert resp.status_code == 200

    # dairy pays the farmer -> both payment notifications fire
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/pay",
        json={"amount": 100, "method": "upi", "reference": "r", "kind": "balance"},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    assert len(_notifications_for(user_store, "uid-f1", "payment_received")) == 1
    assert len(_notifications_for(user_store, "uid-d1", "payment_successful")) == 1


async def test_dairy_chat_room_guards(client, user_store):
    _dairy_user(user_store)
    farmer = _farmer(user_store)
    _farmer(user_store, uid="uid-x1", name="Rando")
    _dairy_purchase(user_store, "pur1", "uid-d1", "uid-f1", status="confirmed")
    _dairy_purchase(user_store, "pur9", "uid-d1", "uid-f1", status="cancelled")
    resp = await client.get("/v1/dairy/purchases/pur1/chat-room", headers=auth(create_access_token("uid-x1")))
    assert resp.status_code == 403
    resp = await client.get("/v1/dairy/purchases/pur9/chat-room", headers=auth(farmer))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CHAT_NOT_AVAILABLE"
