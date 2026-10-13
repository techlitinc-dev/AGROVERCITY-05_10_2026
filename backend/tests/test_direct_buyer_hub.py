"""Direct-buyer hub: profile cards, dashboards, ratings, standing orders,
receipts, chat gating, commission structure, subscription history.

All payloads are asserted against docs created through the API (or real
collection docs seeded into the store) — no demo/fake fallback data.
"""

from datetime import datetime, timezone

from app.services.tokens import create_access_token
from tests.test_direct_buyer import BUYER_PROFILE, _register_buyer
from tests.test_users import _auth, _register

LOT_BODY = {
    "crop": "Tomato",
    "quantityQuintals": 20,
    "expectedRate": 2000,
    "harvestDate": "2026-12-01",
    "photos": [],
    "location": {"lat": 20.0, "lng": 73.8},
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _seed(user_store, uid, name, active="farmer", **extra):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": name,
        "phone": "+919876543210",
        "state": "Maharashtra",
        "district": "Nashik",
        "tehsil": "Niphad",
        "village": "Pimplas",
        "pincode": "422303",
        "addressLine": "Gat 12",
        "linkedProfiles": [active],
        "primaryProfile": active,
        "activeProfile": active,
        **extra,
    }
    return create_access_token(uid)


def _purchase(pid, buyer, farmer, crop, qty, price, status, created, **extra):
    doc = {
        "id": pid,
        "buyerId": buyer,
        "buyerName": "Buyer Co",
        "farmerId": farmer,
        "farmerName": "Ram Patel",
        "source": {"type": "lot", "refId": "lot_x"},
        "crop": crop,
        "variety": "",
        "quantity": qty,
        "unit": "quintal",
        "agreedPricePerUnit": price,
        "totalAmount": round(price * qty),
        "advancePaid": 0,
        "status": status,
        "pickup": None,
        "payments": [],
        "qc": None,
        "finalAmount": None,
        "invoice": None,
        "events": [],
        "rating": {"buyerToFarmer": None, "farmerToBuyer": None},
        "createdAt": created,
        "updatedAt": created,
    }
    doc.update(extra)
    return doc


def _notifications_for(user_store, uid, ntype):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/")
        and doc.get("userId") == uid
        and doc.get("type") == ntype
    ]


# ---------------- profile cards ----------------


async def test_farmer_card_details(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(
        user_store, "uid-f1", "Ram Patel",
        activeCrops=["Tomato", "Onion"],
    )
    user_store["market_lots/lot1"] = {
        **LOT_BODY, "id": "lot1", "farmerId": "uid-f1", "status": "open",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-1", "uid-f1", "Tomato", 10, 2000, "completed", "2026-10-02T00:00:00+00:00",
        finalAmount=20000,
        rating={"buyerToFarmer": {"rating": 5, "review": "great quality", "at": "2026-10-02T01:00:00+00:00"},
                "farmerToBuyer": None},
    )
    resp = await client.get("/v1/direct-buyer/farmers/uid-f1", headers=_auth(buyer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Ram Patel"
    assert body["address"]["village"] == "Pimplas"
    assert body["address"]["district"] == "Nashik"
    assert set(body["products"]) == {"Tomato", "Onion"}
    assert body["availability"]["openLots"] == 1
    assert body["availability"]["byCrop"][0]["crop"] == "Tomato"
    assert body["rating"] == {"average": 5.0, "count": 1}
    assert body["recentReviews"][0]["review"] == "great quality"
    assert body["recentReviews"][0]["fromName"] == "Buyer Co"


async def test_farmer_card_not_found(client):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    resp = await client.get("/v1/direct-buyer/farmers/uid-nope", headers=_auth(buyer_token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "FARMER_NOT_FOUND"


async def test_buyer_card_details(client, user_store):
    farmer_token = (await _register(client, profiles=["farmer"], primaryProfile="farmer")).json()["accessToken"]
    _seed(
        user_store, "uid-b1", "Suresh Traders", active="directBuyer",
        linkedProfiles=["directBuyer"], primaryProfile="directBuyer", vyapariVerified=True,
    )
    user_store["users/uid-b1/role_profiles/directBuyer"] = {
        **BUYER_PROFILE,
        "capacityPerMonth": 500,
        "capacityPerDay": 25,
        "serviceRadiusKm": 40,
        "serviceAreaAddress": "Nashik APMC",
        "products": ["Tomato"],
    }
    user_store["kyc_cases/kyc_uid-b1"] = {
        "caseId": "kyc_uid-b1", "userId": "uid-b1", "persona": "directBuyer", "status": "verified",
    }
    user_store["demands/dem1"] = {
        "id": "dem1", "buyerId": "uid-b1", "status": "open", "crop": "Onion", "offersCount": 0,
        "createdAt": "2026-10-01T00:00:00+00:00", "updatedAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["purchases/pur2"] = _purchase(
        "pur2", "uid-b1", "uid-f9", "Tomato", 10, 2000, "completed", "2026-10-03T00:00:00+00:00",
        rating={"buyerToFarmer": None,
                "farmerToBuyer": {"rating": 4, "review": "prompt payment", "at": "2026-10-03T01:00:00+00:00"}},
    )
    resp = await client.get("/v1/direct-buyer/buyers/uid-b1", headers=_auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Suresh Traders"
    assert body["companyName"] == "Shree Traders"
    assert body["verifiedBadge"] == {"vyapariVerified": True, "kycVerified": True}
    assert body["serviceRadiusKm"] == 40
    assert body["capacityPerDay"] == 25
    assert body["capacityPerMonth"] == 500
    assert set(body["products"]) == {"Tomato", "Onion"}
    assert body["rating"] == {"average": 4.0, "count": 1}
    assert body["recentReviews"][0]["review"] == "prompt payment"


async def test_buyer_card_not_found(client):
    farmer_token = (await _register(client, profiles=["farmer"], primaryProfile="farmer")).json()["accessToken"]
    resp = await client.get("/v1/direct-buyer/buyers/uid-nope", headers=_auth(farmer_token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "BUYER_NOT_FOUND"


# ---------------- farmer home ----------------


async def test_farmer_home_daily_buyers_recent_purchases_posts(client, user_store):
    farmer_token = (await _register(client, profiles=["farmer"], primaryProfile="farmer")).json()["accessToken"]
    _seed(user_store, "uid-b1", "Suresh Traders", active="directBuyer",
          linkedProfiles=["directBuyer"], primaryProfile="directBuyer")
    user_store["users/uid-b1/role_profiles/directBuyer"] = {**BUYER_PROFILE}
    resp = await client.post("/v1/market/lots", json=LOT_BODY, headers=_auth(farmer_token))
    lot_id = resp.json()["id"]
    # buyer bids on my lot today
    bid = await client.post(
        "/v1/offers",
        json={"targetType": "lot", "targetId": lot_id, "pricePerUnit": 2100, "quantity": 5},
        headers=_auth(create_access_token("uid-b1")),
    )
    assert bid.status_code == 201
    # buyer purchases from me today
    resp = await client.post("/v1/purchases", json={"lotId": lot_id, "quantity": 4},
                             headers=_auth(create_access_token("uid-b1")))
    assert resp.status_code == 201
    # buyer posts a demand matching my crop today
    resp = await client.post(
        "/v1/demands", json={"crop": "Tomato", "quantity": 10, "maxPrice": 2500},
        headers=_auth(create_access_token("uid-b1")),
    )
    assert resp.status_code == 201
    resp = await client.get("/v1/direct-buyer/farmer/home", headers=_auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    kinds = {a["kind"] for b in body["dailyBuyers"] for a in b["activities"]}
    assert kinds == {"offer_received", "purchase", "demand_posted"}
    entry = next(b for b in body["dailyBuyers"] if b["buyerName"] == "Suresh Traders")
    assert entry["buyerCompany"] == "Shree Traders"
    assert len(entry["activities"]) == 3
    assert body["recentPurchases"][0]["buyerName"] == "Suresh Traders"
    assert body["recentPurchases"][0]["crop"] == "Tomato"
    assert body["recentPosts"][0]["crop"] == "Tomato"
    assert body["stats"]["openLots"] == 1
    assert body["stats"]["liveDemands"] == 1


async def test_farmer_home_forbidden_for_buyer(client):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    resp = await client.get("/v1/direct-buyer/farmer/home", headers=_auth(buyer_token))
    assert resp.status_code == 403


# ---------------- buyer dashboard ----------------


async def test_buyer_dashboard(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(user_store, "uid-f1", "Ram Patel")
    resp = await client.post(
        "/v1/demands",
        json={"crop": "Tomato", "quantity": 10, "maxPrice": 2500, "neededBy": _today()},
        headers=_auth(buyer_token),
    )
    assert resp.status_code == 201
    user_store["purchases/pur9"] = _purchase(
        "pur9", "uid-1", "uid-f1", "Onion", 5, 1000, "completed", "2026-10-05T00:00:00+00:00",
        finalAmount=5000,
    )
    resp = await client.post(
        "/v1/direct-buyer/standing-orders",
        json={
            "crop": "Potato", "minPrice": 800, "maxPrice": 1200,
            "quantityPerSlot": 50, "frequency": "weekly",
            "startDate": "2026-10-01", "endDate": "2026-12-31",
            "serviceArea": {"address": "Nashik", "radiusKm": 30},
        },
        headers=_auth(buyer_token),
    )
    assert resp.status_code == 201
    resp = await client.get("/v1/direct-buyer/dashboard", headers=_auth(buyer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["todaysLiveDemands"]) == 1
    assert body["todaysLiveDemands"][0]["crop"] == "Tomato"
    assert body["recentPurchases"][0]["id"] == "pur9"
    assert body["recentPosts"][0]["crop"] == "Tomato"
    assert body["standingOrders"]["active"] == 1
    assert body["stats"]["activeDemands"] == 1


# ---------------- self ratings ----------------


async def test_farmer_self_ratings_from_real_collections(client, user_store):
    farmer_token = (await _register(client, profiles=["farmer"], primaryProfile="farmer")).json()["accessToken"]
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-b1", "uid-1", "Tomato", 10, 2000, "completed", "2026-10-02T00:00:00+00:00",
        rating={"buyerToFarmer": {"rating": 5, "review": "nice", "at": "2026-10-02T01:00:00+00:00"},
                "farmerToBuyer": None},
    )
    user_store["purchases/pur2"] = _purchase(
        "pur2", "uid-b2", "uid-1", "Onion", 5, 1000, "completed", "2026-10-03T00:00:00+00:00",
        rating={"buyerToFarmer": {"rating": 3, "review": "", "at": "2026-10-03T01:00:00+00:00"},
                "farmerToBuyer": None},
    )
    user_store["ratings/rat1"] = {
        "id": "rat1", "bookingKind": "lot_sale", "bookingId": "pur3", "stars": 4,
        "comment": "solid", "raterId": "uid-b3", "providerId": "uid-1",
        "createdAt": "2026-10-04T00:00:00+00:00",
    }
    resp = await client.get("/v1/direct-buyer/farmer/ratings", headers=_auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 3
    assert body["average"] == 4.0
    reviews = {r["purchaseId"]: r for r in body["reviews"]}
    assert reviews["pur1"]["review"] == "nice"
    assert reviews["pur3"]["review"] == "solid"


async def test_buyer_self_ratings_from_real_collections(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-1", "uid-f1", "Tomato", 10, 2000, "completed", "2026-10-02T00:00:00+00:00",
        rating={"buyerToFarmer": None,
                "farmerToBuyer": {"rating": 4, "review": "paid on time", "at": "2026-10-02T01:00:00+00:00"}},
    )
    user_store["ratings/rat1"] = {
        "id": "rat1", "bookingKind": "lot_purchase", "bookingId": "pur4", "stars": 5,
        "comment": "bulk buyer", "raterId": "uid-f2", "providerId": "uid-1",
        "createdAt": "2026-10-04T00:00:00+00:00",
    }
    resp = await client.get("/v1/direct-buyer/ratings", headers=_auth(buyer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 2
    assert body["average"] == 4.5
    assert any(r["review"] == "bulk buyer" for r in body["reviews"])


# ---------------- live feeds ----------------


async def test_demands_browse_enriched_buyer_summary(client, user_store):
    farmer_token = (await _register(client, profiles=["farmer"], primaryProfile="farmer")).json()["accessToken"]
    _seed(user_store, "uid-b1", "Suresh Traders", active="directBuyer",
          linkedProfiles=["directBuyer"], primaryProfile="directBuyer", vyapariVerified=True)
    user_store["users/uid-b1/role_profiles/directBuyer"] = {
        **BUYER_PROFILE, "capacityPerMonth": 500, "serviceRadiusKm": 40,
    }
    user_store["purchases/purx"] = _purchase(
        "purx", "uid-b1", "uid-f8", "Tomato", 5, 2000, "completed", "2026-10-01T00:00:00+00:00",
        rating={"buyerToFarmer": None,
                "farmerToBuyer": {"rating": 5, "review": "", "at": ""}},
    )
    user_store["demands/dem1"] = {
        "id": "dem1", "buyerId": "uid-b1", "status": "open", "crop": "Tomato",
        "quantity": 10, "maxPrice": 2500, "state": "Maharashtra", "offersCount": 0,
        "createdAt": "2026-10-01T00:00:00+00:00", "updatedAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["demands/dem2"] = {
        "id": "dem2", "buyerId": "uid-b1", "status": "closed", "crop": "Onion",
        "quantity": 5, "maxPrice": 1500, "state": "Maharashtra", "offersCount": 0,
        "createdAt": "2026-10-01T00:00:00+00:00", "updatedAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/demands/browse", headers=_auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1  # closed demand not in the live feed
    summary = body["data"][0]["buyerSummary"]
    assert summary["companyName"] == "Shree Traders"
    assert summary["verified"] is True
    assert summary["capacityPerMonth"] == 500
    assert summary["serviceRadiusKm"] == 40
    assert summary["ratingAvg"] == 5.0


async def test_farmer_posts_live_enriched(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(user_store, "uid-f1", "Ram Patel", activeCrops=["Tomato"], vyapariVerified=False)
    user_store["market_lots/lot1"] = {
        **LOT_BODY, "id": "lot1", "farmerId": "uid-f1", "status": "open",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["purchases/purp"] = _purchase(
        "purp", "uid-3", "uid-f1", "Tomato", 5, 2000, "completed", "2026-10-01T00:00:00+00:00",
        rating={"buyerToFarmer": {"rating": 5, "review": "", "at": ""}, "farmerToBuyer": None},
    )
    resp = await client.get("/v1/direct-buyer/farmer-posts", headers=_auth(buyer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    lot = body["data"][0]
    assert lot["farmerName"] == "Ram Patel"
    assert lot["farmerVillage"] == "Pimplas"
    assert lot["farmerRating"] == 5.0
    assert lot["farmerReviewCount"] == 1


# ---------------- standing orders ----------------


STANDING_BODY = {
    "crop": "Potato",
    "minPrice": 800,
    "maxPrice": 1200,
    "quantityPerSlot": 50,
    "frequency": "weekly",
    "startDate": "2026-10-01",
    "endDate": "2026-12-31",
    "serviceArea": {"address": "Nashik", "lat": 20.0, "lng": 73.8, "radiusKm": 30},
    "deliveryLocation": "Nashik APMC",
}


async def test_standing_order_crud(client):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    resp = await client.post("/v1/direct-buyer/standing-orders", json=STANDING_BODY,
                             headers=_auth(buyer_token))
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["id"].startswith("sod_")
    assert doc["status"] == "open"
    assert doc["buyerCompany"] == "Shree Traders"
    assert doc["state"] == "Maharashtra"
    order_id = doc["id"]

    resp = await client.get("/v1/direct-buyer/standing-orders", headers=_auth(buyer_token))
    assert resp.json()["total"] == 1

    resp = await client.put(f"/v1/direct-buyer/standing-orders/{order_id}",
                            json={"maxPrice": 1400, "quantityPerSlot": 60},
                            headers=_auth(buyer_token))
    assert resp.status_code == 200
    assert resp.json()["maxPrice"] == 1400
    assert resp.json()["quantityPerSlot"] == 60

    resp = await client.post(f"/v1/direct-buyer/standing-orders/{order_id}/close",
                             headers=_auth(buyer_token))
    assert resp.json()["status"] == "closed"

    resp = await client.put(f"/v1/direct-buyer/standing-orders/{order_id}",
                            json={"maxPrice": 1500}, headers=_auth(buyer_token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "STANDING_ORDER_CLOSED"


async def test_standing_order_validation(client):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    resp = await client.post(
        "/v1/direct-buyer/standing-orders",
        json={**STANDING_BODY, "minPrice": 1500, "maxPrice": 1200},
        headers=_auth(buyer_token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_PRICE_BAND"
    resp = await client.post(
        "/v1/direct-buyer/standing-orders",
        json={**STANDING_BODY, "startDate": "2026-12-31", "endDate": "2026-10-01"},
        headers=_auth(buyer_token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"


async def test_standing_order_foreign_404(client):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    resp = await client.post("/v1/direct-buyer/standing-orders/sod_nope/close",
                             headers=_auth(buyer_token))
    assert resp.status_code == 404


async def test_standing_order_forbidden_for_farmer(client):
    farmer_token = (await _register(client, profiles=["farmer"], primaryProfile="farmer")).json()["accessToken"]
    resp = await client.post("/v1/direct-buyer/standing-orders", json=STANDING_BODY,
                             headers=_auth(farmer_token))
    assert resp.status_code == 403


async def test_demands_standing_feed(client, user_store):
    farmer_token = (await _register(client, profiles=["farmer"], primaryProfile="farmer")).json()["accessToken"]
    _seed(user_store, "uid-b1", "Suresh Traders", active="directBuyer",
          linkedProfiles=["directBuyer"], primaryProfile="directBuyer")
    user_store["users/uid-b1/role_profiles/directBuyer"] = {**BUYER_PROFILE}
    user_store["standing_orders/sod1"] = {
        **STANDING_BODY, "id": "sod1", "buyerId": "uid-b1", "buyerName": "Suresh Traders",
        "state": "Maharashtra", "status": "open", "endDate": "2999-01-01",
        "createdAt": "2026-10-01T00:00:00+00:00", "updatedAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["standing_orders/sod2"] = {
        **STANDING_BODY, "id": "sod2", "buyerId": "uid-b1", "buyerName": "Suresh Traders",
        "state": "Maharashtra", "status": "closed", "endDate": "2999-01-01",
        "createdAt": "2026-10-01T00:00:00+00:00", "updatedAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["standing_orders/sod3"] = {
        **STANDING_BODY, "id": "sod3", "buyerId": "uid-b1", "buyerName": "Suresh Traders",
        "state": "Maharashtra", "status": "open", "endDate": "2020-01-01",
        "createdAt": "2026-10-01T00:00:00+00:00", "updatedAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/demands/standing", headers=_auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    entry = body["data"][0]
    assert entry["id"] == "sod1"
    assert entry["minPrice"] == 800 and entry["maxPrice"] == 1200
    assert entry["frequency"] == "weekly"
    assert entry["serviceArea"]["address"] == "Nashik"
    assert entry["buyerSummary"]["companyName"] == "Shree Traders"


# ---------------- receipt ----------------


async def test_purchase_receipt(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(user_store, "uid-f1", "Ram Patel")
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-1", "uid-f1", "Tomato", 10, 2000, "completed", "2026-10-02T00:00:00+00:00",
        finalAmount=20000,
        pickup={"date": "2026-10-05", "vehicleType": "", "address": "", "notes": "", "mode": "buyerPicksup", "slot": ""},
        payments=[{"id": "p1", "kind": "full", "amount": 20000, "method": "upi", "reference": "upi1", "at": "2026-10-02T01:00:00+00:00"}],
        qc={"grade": "A", "acceptedQty": 10, "rejectedQty": 0, "note": "", "at": ""},
        invoice={"number": "INV-XXXXXXXX-2610", "issuedAt": "2026-10-02T01:00:00+00:00", "lines": [], "totalAmount": 20000},
    )
    resp = await client.get("/v1/purchases/pur1/receipt", headers=_auth(buyer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["receiptNo"].startswith("RCP-")
    assert body["tradeDate"] == "2026-10-02"
    assert body["pickupDate"] == "2026-10-05"
    assert body["product"] == {"crop": "Tomato", "variety": "", "quantity": 10, "unit": "quintal", "qualityGrade": "A"}
    assert body["ratePerUnit"] == 2000
    assert body["amounts"] == {"tradeTotal": 20000, "finalAmount": 20000, "paid": 20000, "due": 0}
    # commission charged from the buyer side, farmer gets the full trade value minus platform commission
    assert body["commission"]["chargedFrom"] == "buyer"
    assert body["commission"]["amount"] == max(50, round(20000 * 0.02))
    assert body["commission"]["farmerPayout"] == 20000 - body["commission"]["amount"]
    assert body["buyer"]["name"] != ""
    assert body["farmer"]["name"] == "Ram Patel"
    assert body["invoiceNumber"] == "INV-XXXXXXXX-2610"


async def test_purchase_receipt_cancelled_409(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(user_store, "uid-f1", "Ram Patel")
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-1", "uid-f1", "Tomato", 10, 2000, "cancelled", "2026-10-02T00:00:00+00:00",
    )
    resp = await client.get("/v1/purchases/pur1/receipt", headers=_auth(buyer_token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PURCHASE_CANCELLED"


async def test_purchase_receipt_non_participant_403(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(user_store, "uid-f1", "Ram Patel")
    _seed(user_store, "uid-x1", "Rando")
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-x1", "uid-f1", "Tomato", 10, 2000, "completed", "2026-10-02T00:00:00+00:00",
    )
    resp = await client.get("/v1/purchases/pur1/receipt", headers=_auth(buyer_token))
    assert resp.status_code == 403


# ---------------- purchase chat room (post-acceptance) ----------------


async def test_purchase_chat_room(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(user_store, "uid-f1", "Ram Patel")
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-1", "uid-f1", "Tomato", 10, 2000, "confirmed", "2026-10-02T00:00:00+00:00",
    )
    resp = await client.get("/v1/purchases/pur1/chat-room", headers=_auth(buyer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["purchaseId"] == "pur1"
    assert body["room"]["id"] == "pur1"
    assert body["room"]["kind"] == "purchase"
    farmer_resp = await client.get(
        "/v1/purchases/pur1/chat-room", headers=_auth(create_access_token("uid-f1"))
    )
    assert farmer_resp.status_code == 200


async def test_purchase_chat_room_cancelled_409(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(user_store, "uid-f1", "Ram Patel")
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-1", "uid-f1", "Tomato", 10, 2000, "cancelled", "2026-10-02T00:00:00+00:00",
    )
    resp = await client.get("/v1/purchases/pur1/chat-room", headers=_auth(buyer_token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CHAT_NOT_AVAILABLE"


async def test_chat_direct_with_purchase_id(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(user_store, "uid-f1", "Ram Patel")
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-1", "uid-f1", "Tomato", 10, 2000, "confirmed", "2026-10-02T00:00:00+00:00",
    )
    resp = await client.post("/v1/chat/direct", json={"purchaseId": "pur1"},
                             headers=_auth(buyer_token))
    assert resp.status_code == 200
    assert resp.json()["id"] == "pur1"
    assert resp.json()["kind"] == "purchase"


async def test_chat_direct_purchase_forbidden(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(user_store, "uid-f1", "Ram Patel")
    _seed(user_store, "uid-x1", "Rando")
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-x1", "uid-f1", "Tomato", 10, 2000, "confirmed", "2026-10-02T00:00:00+00:00",
    )
    resp = await client.post("/v1/chat/direct", json={"purchaseId": "pur1"},
                             headers=_auth(buyer_token))
    assert resp.status_code == 403


# ---------------- commission structure ----------------


async def test_commission_structure_charged_from_buyer(client):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    resp = await client.get("/v1/direct-buyer/commission-structure", headers=_auth(buyer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["trade"] == "directBuyer"
    assert 1 <= body["commissionPercent"] <= 2
    assert body["chargedFrom"] == "buyer"
    assert body["farmerSidePercent"] == 0
    assert body["minRupees"] >= 0


# ---------------- subscription history ----------------


async def test_billing_subscription_history(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    user_store["plans/directBuyer_pro"] = {
        "planId": "directBuyer_pro",
        "persona": "directBuyer",
        "tier": "pro",
        "priceMonthlyPaisa": 99900,
        "limits": {},
        "features": ["qcSuite", "priceAlerts"],
    }
    resp = await client.get("/v1/billing/subscriptions", headers=_auth(buyer_token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
    assert resp.json()["currentStatus"] == "none"

    resp = await client.post("/v1/billing/subscribe", json={"planId": "directBuyer_pro"},
                             headers=_auth(buyer_token))
    assert resp.status_code == 201
    resp = await client.get("/v1/billing/subscriptions", headers=_auth(buyer_token))
    body = resp.json()
    assert body["total"] == 1
    assert body["currentStatus"] == "active"
    entry = body["data"][0]
    assert entry["planId"] == "directBuyer_pro"
    assert entry["plan"]["persona"] == "directBuyer"


# ---------------- notifications ----------------


async def test_notifications_type_filter(client, user_store):
    token = (await _register(client)).json()["accessToken"]
    uid = "uid-1"
    for ntype in ("request_accepted", "payment_successful", "price_alert"):
        await client.post(
            "/v1/notifications",
            json={"userId": uid, "title": f"t-{ntype}", "body": "b", "type": ntype},
            headers=_auth(token),
        )
    resp = await client.get(
        "/v1/notifications?type=request_accepted,payment_successful", headers=_auth(token)
    )
    assert resp.status_code == 200
    types = {n["type"] for n in resp.json()["data"]}
    assert types == {"request_accepted", "payment_successful"}
    assert resp.json()["total"] == 2


async def test_request_accepted_notification_flow(client, user_store):
    """Farmer posts a lot, buyer bids, farmer accepts → buyer (the offer maker)
    gets a request_accepted notification and the purchase chat room exists."""
    farmer_token = (await _register(client, profiles=["farmer"], primaryProfile="farmer")).json()["accessToken"]
    _seed(user_store, "uid-b1", "Suresh Traders", active="directBuyer",
          linkedProfiles=["directBuyer"], primaryProfile="directBuyer")
    buyer_headers = _auth(create_access_token("uid-b1"))
    resp = await client.post("/v1/market/lots", json=LOT_BODY, headers=_auth(farmer_token))
    lot_id = resp.json()["id"]
    resp = await client.post(
        "/v1/offers",
        json={"targetType": "lot", "targetId": lot_id, "pricePerUnit": 2100, "quantity": 5},
        headers=buyer_headers,
    )
    offer_id = resp.json()["id"]
    resp = await client.post(f"/v1/offers/{offer_id}/accept", headers=_auth(farmer_token))
    assert resp.status_code == 200
    notes = _notifications_for(user_store, "uid-b1", "request_accepted")
    assert len(notes) == 1
    assert notes[0]["data"]["deepLink"].startswith("/dashboard/p/purchases/")
    # the accepted request has an open chat room (chat opens after acceptance)
    purchase_id = resp.json()["purchase"]["id"]
    resp = await client.post("/v1/chat/direct", json={"purchaseId": purchase_id},
                             headers=buyer_headers)
    assert resp.status_code == 200


async def test_payment_successful_notification_flow(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    _seed(user_store, "uid-f1", "Ram Patel")
    user_store["purchases/pur1"] = _purchase(
        "pur1", "uid-1", "uid-f1", "Tomato", 10, 2000, "confirmed", "2026-10-02T00:00:00+00:00",
    )
    resp = await client.post(
        "/v1/purchases/pur1/pay",
        json={"amount": 5000, "method": "upi", "reference": "x", "kind": "balance"},
        headers=_auth(buyer_token),
    )
    assert resp.status_code == 200
    assert len(_notifications_for(user_store, "uid-1", "payment_successful")) == 1
    assert len(_notifications_for(user_store, "uid-f1", "payment_received")) == 1
