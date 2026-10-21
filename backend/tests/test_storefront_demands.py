"""SR 16 / SR 30 — seller storefront, customer demands, product-scoped chat.

Locks the website-facing contracts this gap batch builds on:
  - GET  /v1/customer/storefronts/{farmer_id}  (open lots + verified credentials)
  - POST /v1/customer/demands                   (CustomerDemandIn field names)
  - GET/DELETE /v1/customer/demands[/{id}]
  - POST /v1/chat/direct {productId}           (mall product -> seller room)
"""
from tests.test_diary import auth, seed_user


def _seed_farmer(user_store, uid="farmer-1", **overrides):
    return seed_user(user_store, uid=uid, active_profile="farmer", **overrides)


def _seed_market_lot(user_store, lot_id, farmer_id, *, status="open", crop="Tomato",
                     grade="A", quantity=25.0, rate=1800.0, harvest_date="2026-10-15"):
    user_store[f"market_lots/{lot_id}"] = {
        "id": lot_id,
        "farmerId": farmer_id,
        "status": status,
        "crop": crop,
        "grade": grade,
        "quantityQuintals": quantity,
        "expectedRate": rate,
        "harvestDate": harvest_date,
        "createdAt": "2026-10-15T08:00:00+00:00",
    }


DEMAND_PAYLOAD = {
    "crop": "Organic Sharbati Wheat",
    "variety": "Sharbati",
    "grade": "A",
    "quantityQuintals": 120.0,
    "targetMinPrice": 3100,
    "targetMaxPrice": 3350,
    "recurringFrequency": "Weekly",
    "deliveryWindow": "Needed by 2026-11-05",
    "district": "Nashik",
    "notes": "Moisture content < 11% strictly required.",
}


# --------------------------------------------------------------------------
# Storefront (SR 16)
# --------------------------------------------------------------------------


async def test_storefront_returns_open_lots_with_credentials(client, user_store):
    customer = seed_user(user_store, uid="cust-1", active_profile="customer")
    _seed_farmer(user_store, uid="farmer-1", name="Sita Devi", rating=4.6)
    _seed_market_lot(user_store, "lot-open-1", "farmer-1", crop="Tomato", rate=1800.0)
    _seed_market_lot(user_store, "lot-open-2", "farmer-1", crop="Onion", rate=2100.0)
    _seed_market_lot(user_store, "lot-sold", "farmer-1", status="sold")
    _seed_market_lot(user_store, "lot-other", "farmer-2")
    user_store["kyc_cases/kyc-farmer-1"] = {
        "caseId": "kyc-farmer-1",
        "userId": "farmer-1",
        "persona": "farmer",
        "docs": [{"type": "soil_health", "status": "verified", "reviewedAt": "2026-09-01T00:00:00+00:00"}],
    }

    resp = await client.get("/v1/customer/storefronts/farmer-1", headers=auth(customer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["farmerId"] == "farmer-1"
    assert body["farmerName"] == "Sita Devi"
    assert body["farmerRating"] == 4.6
    lot_ids = {lot["lotId"] for lot in body["lots"]}
    assert lot_ids == {"lot-open-1", "lot-open-2"}
    by_id = {lot["lotId"]: lot for lot in body["lots"]}
    assert by_id["lot-open-1"]["pricePaisa"] == 180000
    assert by_id["lot-open-2"]["pricePaisa"] == 210000
    assert by_id["lot-open-1"]["crop"] == "Tomato"
    assert by_id["lot-open-1"]["qtyAvailable"] == 25.0
    assert any(c["type"] == "soil_health" for c in body["credentials"])


async def test_storefront_unknown_farmer_is_404(client, user_store):
    customer = seed_user(user_store, uid="cust-2", active_profile="customer")
    resp = await client.get("/v1/customer/storefronts/nope-404", headers=auth(customer))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "FARMER_NOT_FOUND"


# --------------------------------------------------------------------------
# Customer demands (SR 30)
# --------------------------------------------------------------------------


async def test_customer_demand_create_list_and_delete(client, user_store):
    customer = seed_user(user_store, uid="cust-3", active_profile="customer")

    resp = await client.post("/v1/customer/demands", json=DEMAND_PAYLOAD, headers=auth(customer))
    assert resp.status_code == 201
    demand = resp.json()
    assert demand["crop"] == DEMAND_PAYLOAD["crop"]
    assert demand["status"] == "open"
    assert demand["bidsCount"] == 0
    assert demand["district"] == "Nashik"
    demand_id = demand["id"]

    resp = await client.get("/v1/customer/demands", headers=auth(customer))
    assert resp.status_code == 200
    listed = resp.json()
    assert listed["total"] == 1
    assert listed["data"][0]["id"] == demand_id

    resp = await client.delete(f"/v1/customer/demands/{demand_id}", headers=auth(customer))
    assert resp.status_code == 204

    resp = await client.get("/v1/customer/demands", headers=auth(customer))
    assert resp.json()["total"] == 0


async def test_customer_demand_requires_positive_price_band(client, user_store):
    customer = seed_user(user_store, uid="cust-4", active_profile="customer")
    bad = {**DEMAND_PAYLOAD, "targetMaxPrice": 0}
    resp = await client.post("/v1/customer/demands", json=bad, headers=auth(customer))
    assert resp.status_code == 422

    missing = {k: v for k, v in DEMAND_PAYLOAD.items() if k != "targetMinPrice"}
    resp = await client.post("/v1/customer/demands", json=missing, headers=auth(customer))
    assert resp.status_code == 422


# --------------------------------------------------------------------------
# Product-scoped direct chat (SR 16 "Ask seller")
# --------------------------------------------------------------------------


def _seed_product(user_store, product_id, seller_id, *, category="Seeds", title="Hybrid Maize Seed"):
    user_store[f"products/{product_id}"] = {
        "id": product_id,
        "sellerId": seller_id,
        "sellerName": "Krishi Mall Seller",
        "category": category,
        "title": title,
        "discountedPrice": 450,
    }


async def test_chat_direct_with_product_id_opens_seller_room(client, user_store):
    customer = seed_user(user_store, uid="cust-5", active_profile="customer")
    seed_user(user_store, uid="seller-1", active_profile="seller", name="Gopal Traders")
    _seed_product(user_store, "prod-1", "seller-1")

    resp = await client.post("/v1/chat/direct", json={"productId": "prod-1"}, headers=auth(customer))
    assert resp.status_code == 200
    room = resp.json()
    assert room["kind"] == "direct"
    assert room["farmerId"] == "seller-1"
    assert room["buyerId"] == "cust-5"
    assert room["crop"] == "Seeds"

    # Idempotent: same pair returns the same stable room.
    again = await client.post("/v1/chat/direct", json={"productId": "prod-1"}, headers=auth(customer))
    assert again.status_code == 200
    assert again.json()["id"] == room["id"]


async def test_chat_direct_product_id_guards(client, user_store):
    customer = seed_user(user_store, uid="cust-6", active_profile="customer")
    seller = seed_user(user_store, uid="seller-2", active_profile="seller", name="Asha Agro")
    _seed_product(user_store, "prod-own", "cust-6")
    _seed_product(user_store, "prod-2", "seller-2")

    own = await client.post("/v1/chat/direct", json={"productId": "prod-own"}, headers=auth(customer))
    assert own.status_code == 400
    assert own.json()["error"]["code"] == "OWN_LISTING"

    missing = await client.post("/v1/chat/direct", json={"productId": "prod-missing"}, headers=auth(seller))
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "PRODUCT_NOT_FOUND"

    empty = await client.post("/v1/chat/direct", json={}, headers=auth(customer))
    assert empty.status_code == 422
    assert empty.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_chat_direct_lot_id_regression(client, user_store):
    customer = seed_user(user_store, uid="cust-7", active_profile="customer")
    _seed_farmer(user_store, uid="farmer-9", name="Lot Farmer")
    _seed_market_lot(user_store, "lot-chat-1", "farmer-9", crop="Wheat")

    resp = await client.post("/v1/chat/direct", json={"lotId": "lot-chat-1"}, headers=auth(customer))
    assert resp.status_code == 200
    room = resp.json()
    assert room["kind"] == "direct"
    assert room["farmerId"] == "farmer-9"
    assert room["buyerId"] == "cust-7"
    assert room["crop"] == "Wheat"
