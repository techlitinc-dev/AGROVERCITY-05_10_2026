from app.services.tokens import create_access_token
from tests.test_users import _auth, _register

BUYER_PROFILE = {"companyName": "Shree Traders", "buyerType": "wholesaler", "gstin": "27AAACS1234A1Z5"}


async def _register_buyer(client, **overrides):
    body = {
        "profiles": ["directBuyer"],
        "primaryProfile": "directBuyer",
        "roleProfiles": {"directBuyer": BUYER_PROFILE},
    }
    body.update(overrides)
    return await _register(client, **body)


def _seed_user(user_store, uid, name, active="farmer", **extra):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": name,
        "phone": "+919876543210",
        "state": "Maharashtra",
        "district": "Nashik",
        "village": "Pimplas",
        "linkedProfiles": ["farmer"],
        "primaryProfile": "farmer",
        "activeProfile": active,
        **extra,
    }
    return create_access_token(uid)


def _purchase(pid, buyer, farmer, farmer_name, crop, qty, price, status, created, **extra):
    doc = {
        "id": pid,
        "buyerId": buyer,
        "buyerName": "Buyer",
        "farmerId": farmer,
        "farmerName": farmer_name,
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


# ---- role registration ----


async def test_direct_buyer_is_valid_profile(client):
    resp = await _register_buyer(client)
    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["linkedProfiles"] == ["directBuyer"]
    assert user["activeProfile"] == "directBuyer"


async def test_direct_buyer_role_profile_doc_created(client, user_store):
    await _register_buyer(client)
    doc = user_store.get("users/uid-1/role_profiles/directBuyer")
    assert doc is not None
    assert doc["companyName"] == "Shree Traders"
    assert doc["buyerType"] == "wholesaler"
    assert doc["capacityPerMonth"] == 0
    assert doc["operatingStates"] == []


async def test_direct_buyer_invalid_buyer_type_rejected(client):
    resp = await _register_buyer(
        client,
        roleProfiles={"directBuyer": {"companyName": "X", "buyerType": "gambler"}},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_ROLE_PROFILE"


async def test_direct_buyer_default_home_route(client):
    resp = await _register(client, profiles=["farmer", "directBuyer"], primaryProfile="farmer")
    token = resp.json()["accessToken"]
    resp = await client.post("/v1/users/me/profiles/directBuyer/activate", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["defaultHomeRoute"] == "directBuyerHome"


async def test_demands_require_direct_buyer_role(client):
    token = (await _register(client)).json()["accessToken"]
    body = {"crop": "Tomato", "quantity": 10, "maxPrice": 2000}
    resp = await client.post("/v1/demands", json=body, headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


# ---- profile ----


async def test_buyer_profile_includes_stats(client, user_store):
    token = (await _register_buyer(client)).json()["accessToken"]
    user_store["purchases/pur_a"] = _purchase(
        "pur_a", "uid-1", "uid-f1", "Ram", "Tomato", 10, 2000, "completed", "2026-09-01T00:00:00+00:00",
        payments=[{"id": "p", "kind": "full", "amount": 20000, "method": "upi", "reference": "", "at": ""}],
        finalAmount=20000,
    )
    resp = await client.get("/v1/direct-buyer/profile", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["roleProfile"]["companyName"] == "Shree Traders"
    assert body["stats"]["totalPurchases"] == 1
    assert body["stats"]["totalSpend"] == 20000
    assert body["stats"]["completedPurchases"] == 1


async def test_buyer_profile_forbidden_for_farmer(client):
    token = (await _register(client)).json()["accessToken"]
    resp = await client.get("/v1/direct-buyer/profile", headers=_auth(token))
    assert resp.status_code == 403


# ---- analytics ----


def _seed_analytics(user_store):
    user_store["purchases/pur_1"] = _purchase(
        "pur_1", "uid-1", "uid-f1", "Ram", "Tomato", 10, 2000, "completed", "2026-09-02T00:00:00+00:00",
        payments=[
            {"id": "p1", "kind": "advance", "amount": 5000, "method": "upi", "reference": "", "at": ""},
            {"id": "p2", "kind": "balance", "amount": 15000, "method": "upi", "reference": "", "at": ""},
        ],
        finalAmount=20000,
        qc={"grade": "A", "acceptedQty": 10, "rejectedQty": 0, "note": "", "at": ""},
        invoice={"number": "INV-1", "issuedAt": ""},
    )
    user_store["purchases/pur_2"] = _purchase(
        "pur_2", "uid-1", "uid-f1", "Ram", "Tomato", 10, 3000, "qcDisputed", "2026-09-05T00:00:00+00:00",
        payments=[{"id": "p3", "kind": "advance", "amount": 10000, "method": "upi", "reference": "", "at": ""}],
        finalAmount=24000,
        qc={"grade": "B", "acceptedQty": 8, "rejectedQty": 2, "note": "", "at": ""},
    )
    user_store["purchases/pur_3"] = _purchase(
        "pur_3", "uid-1", "uid-f2", "Sham", "Onion", 5, 1000, "completed", "2026-08-11T00:00:00+00:00",
        finalAmount=5000,
        rating={"buyerToFarmer": {"rating": 4, "review": "ok", "at": ""}, "farmerToBuyer": None},
    )
    user_store["purchases/pur_4"] = _purchase(
        "pur_4", "uid-1", "uid-f2", "Sham", "Dragonfruit", 1, 1000, "completed", "2026-08-12T00:00:00+00:00",
        finalAmount=1000,
    )
    user_store["purchases/pur_5"] = _purchase(
        "pur_5", "uid-1", "uid-f2", "Sham", "Onion", 5, 1000, "cancelled", "2026-08-13T00:00:00+00:00"
    )
    user_store["mandi_prices/m1"] = {
        "id": "m1", "commodity": "Tomato (टमाटर)", "modalPrice": 1950, "mandiName": "Pimpalgaon", "distanceKm": 4,
    }
    user_store["mandi_prices/m2"] = {
        "id": "m2", "commodity": "Tomato (टमाटर)", "modalPrice": 2150, "mandiName": "Nashik", "distanceKm": 18,
    }
    user_store["mandi_prices/m3"] = {
        "id": "m3", "commodity": "Onion (प्याज)", "modalPrice": 2120, "mandiName": "Lasalgaon", "distanceKm": 28,
    }
    user_store["demands/dem_open"] = {
        "id": "dem_open", "buyerId": "uid-1", "status": "open", "crop": "Tomato", "offersCount": 0,
        "createdAt": "", "updatedAt": "",
    }
    user_store["demands/dem_closed"] = {
        "id": "dem_closed", "buyerId": "uid-1", "status": "closed", "crop": "Onion", "offersCount": 0,
        "createdAt": "", "updatedAt": "",
    }
    user_store["offers/off_pending"] = {
        "id": "off_pending", "fromId": "uid-1", "toId": "uid-f1", "targetType": "lot", "targetId": "lot_x",
        "status": "pending", "pricePerUnit": 100, "quantity": 1, "unit": "quintal", "message": "",
        "counter": None, "createdAt": "", "updatedAt": "",
    }
    user_store["offers/off_countered"] = {
        "id": "off_countered", "fromId": "uid-1", "toId": "uid-f1", "targetType": "lot", "targetId": "lot_y",
        "status": "countered", "pricePerUnit": 100, "quantity": 1, "unit": "quintal", "message": "",
        "counter": {"pricePerUnit": 90, "by": "uid-f1", "note": "", "at": ""}, "createdAt": "", "updatedAt": "",
    }
    user_store["offers/off_done"] = {
        "id": "off_done", "fromId": "uid-1", "toId": "uid-f1", "targetType": "lot", "targetId": "lot_z",
        "status": "accepted", "pricePerUnit": 100, "quantity": 1, "unit": "quintal", "message": "",
        "counter": None, "createdAt": "", "updatedAt": "",
    }


async def test_buyer_analytics_shape_and_values(client, user_store):
    token = (await _register_buyer(client)).json()["accessToken"]
    _seed_analytics(user_store)
    resp = await client.get("/v1/direct-buyer/analytics", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["totalSpend"] == 50000
    assert body["totalVolume"] == 26
    assert body["activeDemands"] == 1
    assert body["openOffers"] == 2
    assert body["purchasesByStatus"] == {"completed": 3, "qcDisputed": 1}
    assert len(body["monthlyProcurement"]) == 12
    month_map = {m["month"]: m for m in body["monthlyProcurement"]}
    assert month_map["2026-09"]["spend"] == 44000
    assert month_map["2026-08"]["spend"] == 6000
    crops = {c["crop"]: c for c in body["cropBreakdown"]}
    assert crops["Tomato"]["spend"] == 44000
    assert crops["Tomato"]["volume"] == 20
    assert crops["Tomato"]["avgPrice"] == 2200
    mandi = {c["crop"]: c["mandiModalPrice"] for c in body["avgPriceVsMandi"]}
    assert mandi["Tomato"] == 2050
    assert mandi["Onion"] == 2120
    assert mandi["Dragonfruit"] is None
    suppliers = {s["farmerId"]: s for s in body["topSuppliers"]}
    assert suppliers["uid-f1"]["spend"] == 44000
    assert suppliers["uid-f1"]["purchases"] == 2
    assert suppliers["uid-f2"]["spend"] == 6000
    assert body["qcRejectionRate"] == 0.1
    assert body["completionRate"] == 0.75
    assert body["pendingBalance"] == 20000


async def test_buyer_analytics_forbidden_for_farmer(client):
    token = (await _register(client)).json()["accessToken"]
    resp = await client.get("/v1/direct-buyer/analytics", headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


# ---- saved farmers ----


async def test_saved_farmers_crud(client, user_store):
    token = (await _register_buyer(client)).json()["accessToken"]
    _seed_user(user_store, "uid-f1", "Ram Patel")
    resp = await client.post("/v1/direct-buyer/saved-farmers", json={"farmerId": "uid-f1"}, headers=_auth(token))
    assert resp.status_code == 201
    replay = await client.post("/v1/direct-buyer/saved-farmers", json={"farmerId": "uid-f1"}, headers=_auth(token))
    assert replay.status_code == 201
    resp = await client.get("/v1/direct-buyer/saved-farmers", headers=_auth(token))
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["farmerName"] == "Ram Patel"
    assert data[0]["village"] == "Pimplas"
    resp = await client.delete("/v1/direct-buyer/saved-farmers/uid-f1", headers=_auth(token))
    assert resp.status_code == 204
    resp = await client.get("/v1/direct-buyer/saved-farmers", headers=_auth(token))
    assert resp.json()["total"] == 0


async def test_saved_farmer_unknown_farmer_404(client):
    token = (await _register_buyer(client)).json()["accessToken"]
    resp = await client.post("/v1/direct-buyer/saved-farmers", json={"farmerId": "uid-nope"}, headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "FARMER_NOT_FOUND"


async def test_saved_farmer_rating_from_purchases(client, user_store):
    token = (await _register_buyer(client)).json()["accessToken"]
    _seed_user(user_store, "uid-f1", "Ram Patel")
    user_store["purchases/pur_r1"] = _purchase(
        "pur_r1", "uid-1", "uid-f1", "Ram Patel", "Tomato", 5, 2000, "completed", "2026-09-01T00:00:00+00:00",
        rating={"buyerToFarmer": {"rating": 5, "review": "", "at": ""}, "farmerToBuyer": None},
    )
    user_store["purchases/pur_r2"] = _purchase(
        "pur_r2", "uid-1", "uid-f1", "Ram Patel", "Tomato", 5, 2000, "completed", "2026-09-02T00:00:00+00:00",
        rating={"buyerToFarmer": {"rating": 3, "review": "", "at": ""}, "farmerToBuyer": None},
    )
    await client.post("/v1/direct-buyer/saved-farmers", json={"farmerId": "uid-f1"}, headers=_auth(token))
    resp = await client.get("/v1/direct-buyer/saved-farmers", headers=_auth(token))
    assert resp.json()["data"][0]["rating"] == 4.0


# ---- feed ----


def _lot(lot_id, farmer_id, crop, created):
    return {
        "id": lot_id,
        "farmerId": farmer_id,
        "crop": crop,
        "quantityQuintals": 10,
        "expectedRate": 2000,
        "harvestDate": "2026-09-10",
        "photos": [],
        "location": {"lat": 20.0, "lng": 73.8},
        "status": "open",
        "createdAt": created,
    }


async def test_feed_matches_demand_crops_and_saved_farmers(client, user_store):
    token = (await _register_buyer(client)).json()["accessToken"]
    _seed_user(user_store, "uid-f1", "Ram Patel")
    _seed_user(user_store, "uid-f2", "Sham Rao")
    _seed_user(user_store, "uid-f3", "Kisan Yadav")
    resp = await client.post(
        "/v1/demands",
        json={"crop": "Tomato", "quantity": 10, "maxPrice": 2500},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    user_store["market_lots/lot_t"] = _lot("lot_t", "uid-f1", "Tomato", "2026-09-20T00:00:00+00:00")
    user_store["market_lots/lot_o"] = _lot("lot_o", "uid-f3", "Onion", "2026-09-21T00:00:00+00:00")
    user_store["market_lots/lot_g"] = _lot("lot_g", "uid-f2", "Grapes", "2026-09-19T00:00:00+00:00")
    await client.post("/v1/direct-buyer/saved-farmers", json={"farmerId": "uid-f2"}, headers=_auth(token))
    resp = await client.get("/v1/direct-buyer/feed", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    ids = {l["id"] for l in data}
    assert ids == {"lot_t", "lot_g"}
    by_id = {l["id"]: l for l in data}
    assert by_id["lot_t"]["farmerName"] == "Ram Patel"
    assert by_id["lot_t"]["farmerVillage"] == "Pimplas"
    assert resp.json()["total"] == 2


async def test_feed_empty_without_signals(client):
    token = (await _register_buyer(client)).json()["accessToken"]
    resp = await client.get("/v1/direct-buyer/feed", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["data"] == []
    assert resp.json()["total"] == 0
