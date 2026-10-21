"""Per-product alert subscriptions + seller-side notification producers (SR 13).

The product_alerts router is registered by the integration owner in main.py;
it is included here as well so these tests exercise the live endpoints without
touching main.py.
"""
from app.main import app
from app.routers import product_alerts as product_alerts_router
from tests.test_diary import seed_user
from tests.test_users import _auth

app.include_router(product_alerts_router.router, prefix="/v1")

PRODUCT_BODY = {
    "title": "Organic Neem Oil (1L)",
    "category": "Pesticide (जैविक)",
    "brand": "Agro Naturals",
    "mrp": 450,
    "discountedPrice": 399,
    "stock": 0,
    "unit": "1L bottle",
    "description": "Cold-pressed neem oil",
}

SINCE = "2026-10-01T00:00:00+00:00"


def _seed_product(user_store, product_id="prod-1", **overrides):
    doc = {
        "id": product_id,
        "title": "Organic Neem Oil (1L)",
        "category": "Pesticide (जैविक)",
        "brand": "Agro Naturals",
        "sellerId": "seller-1",
        "sellerName": "Amit Agro",
        "mrp": 450,
        "discountedPrice": 399,
        "stock": 10,
        "batchNo": "SLR-TEST-0001",
        **overrides,
    }
    user_store[f"products/{product_id}"] = doc
    return doc


def _seed_alert(user_store, uid, product_id, kinds, doc_id=None):
    doc = {
        "userId": uid,
        "productId": product_id,
        "kinds": kinds,
        "createdAt": SINCE,
    }
    user_store[f"product_alerts/{doc_id or f'{uid}_{product_id}'}"] = doc
    return doc


def _notifications(user_store):
    return [d for key, d in user_store.items() if key.startswith("notifications/")]


# ---------------------------------------------------------------- subscribe


async def test_subscribe_creates_alert_doc(client, user_store):
    _seed_product(user_store)
    token = seed_user(user_store, uid="buyer-1")
    resp = await client.post(
        "/v1/customer/product-alerts",
        json={"productId": "prod-1", "kinds": ["price_drop", "restock"]},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    doc = user_store["product_alerts/buyer-1_prod-1"]
    assert doc["userId"] == "buyer-1"
    assert doc["productId"] == "prod-1"
    assert doc["kinds"] == ["price_drop", "restock"]
    assert doc["createdAt"]


async def test_subscribe_unknown_product_404(client, user_store):
    token = seed_user(user_store, uid="buyer-1")
    resp = await client.post(
        "/v1/customer/product-alerts",
        json={"productId": "nope", "kinds": ["price_drop"]},
        headers=_auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


async def test_resubscribe_replaces_kinds(client, user_store):
    _seed_product(user_store)
    token = seed_user(user_store, uid="buyer-1")
    headers = _auth(token)
    await client.post(
        "/v1/customer/product-alerts",
        json={"productId": "prod-1", "kinds": ["price_drop"]},
        headers=headers,
    )
    first_since = user_store["product_alerts/buyer-1_prod-1"]["createdAt"]
    resp = await client.post(
        "/v1/customer/product-alerts",
        json={"productId": "prod-1", "kinds": ["restock"]},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["kinds"] == ["restock"]
    doc = user_store["product_alerts/buyer-1_prod-1"]
    assert doc["kinds"] == ["restock"]
    assert doc["createdAt"] == first_since  # upsert keeps original subscription date
    assert len([k for k in user_store if k.startswith("product_alerts/")]) == 1


# ------------------------------------------------------------------ list


async def test_list_joins_product(client, user_store):
    _seed_product(user_store, stock=7)
    token = seed_user(user_store, uid="buyer-1")
    headers = _auth(token)
    await client.post(
        "/v1/customer/product-alerts",
        json={"productId": "prod-1", "kinds": ["price_drop"]},
        headers=headers,
    )
    resp = await client.get("/v1/customer/product-alerts", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    item = items[0]
    assert item["productId"] == "prod-1"
    assert item["name"] == "Organic Neem Oil (1L)"
    assert item["price"] == 399
    assert item["stockQty"] == 7
    assert item["kinds"] == ["price_drop"]
    assert item["since"]


async def test_list_returns_only_own_alerts(client, user_store):
    _seed_product(user_store)
    _seed_alert(user_store, "other-1", "prod-1", ["price_drop"])
    token = seed_user(user_store, uid="buyer-1")
    resp = await client.get("/v1/customer/product-alerts", headers=_auth(token))
    assert resp.json()["items"] == []


# ----------------------------------------------------------------- delete


async def test_delete_alert(client, user_store):
    _seed_product(user_store)
    token = seed_user(user_store, uid="buyer-1")
    headers = _auth(token)
    await client.post(
        "/v1/customer/product-alerts",
        json={"productId": "prod-1", "kinds": ["price_drop"]},
        headers=headers,
    )
    resp = await client.delete("/v1/customer/product-alerts/prod-1", headers=headers)
    assert resp.status_code == 204
    assert "product_alerts/buyer-1_prod-1" not in user_store
    items = (await client.get("/v1/customer/product-alerts", headers=headers)).json()["items"]
    assert items == []


async def test_delete_unknown_alert_404(client, user_store):
    token = seed_user(user_store, uid="buyer-1")
    resp = await client.delete("/v1/customer/product-alerts/prod-1", headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ALERT_NOT_FOUND"


# --------------------------------------------- producer: price drop (PUT)


async def test_price_decrease_notifies_subscriber_only(client, user_store):
    _seed_product(user_store, stock=10)
    _seed_alert(user_store, "buyer-1", "prod-1", ["price_drop"])
    _seed_alert(user_store, "buyer-2", "prod-1", ["restock"])  # wrong kind — must not fire
    seed_user(user_store, uid="buyer-1")
    seed_user(user_store, uid="buyer-2")
    token = seed_user(user_store, uid="seller-1", active_profile="seller", name="Amit Agro")
    resp = await client.put(
        "/v1/seller/products/prod-1",
        json={"discountedPrice": 349},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    notes = _notifications(user_store)
    assert len(notes) == 1
    note = notes[0]
    assert note["userId"] == "buyer-1"
    assert note["type"] == "price_drop"
    assert note["read"] is False
    assert note["id"].startswith("ntf_")
    assert note["title"]
    assert note["createdAt"]
    assert "399" in note["body"] and "349" in note["body"]


async def test_price_increase_notifies_nobody(client, user_store):
    _seed_product(user_store, stock=10)
    _seed_alert(user_store, "buyer-1", "prod-1", ["price_drop"])
    seed_user(user_store, uid="buyer-1")
    token = seed_user(user_store, uid="seller-1", active_profile="seller", name="Amit Agro")
    resp = await client.put(
        "/v1/seller/products/prod-1",
        json={"discountedPrice": 449},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert _notifications(user_store) == []


# ----------------------------------------------- producer: restock (PUT)


async def test_restock_from_zero_notifies_subscriber(client, user_store):
    _seed_product(user_store, stock=0)
    _seed_alert(user_store, "buyer-1", "prod-1", ["restock"])
    seed_user(user_store, uid="buyer-1")
    token = seed_user(user_store, uid="seller-1", active_profile="seller", name="Amit Agro")
    headers = _auth(token)
    resp = await client.put("/v1/seller/products/prod-1", json={"stock": 5}, headers=headers)
    assert resp.status_code == 200
    notes = _notifications(user_store)
    assert len(notes) == 1
    assert notes[0]["userId"] == "buyer-1"
    assert notes[0]["type"] == "restock"
    # 5 -> 8 is a routine top-up, not a back-in-stock event
    resp = await client.put("/v1/seller/products/prod-1", json={"stock": 8}, headers=headers)
    assert resp.status_code == 200
    assert len(_notifications(user_store)) == 1


# -------------------------------------- producer: new listing (POST)


async def test_new_product_notifies_followers_only(client, user_store):
    seed_user(user_store, uid="follower-1")
    seed_user(user_store, uid="non-follower-1")
    user_store["follows/follower-1_seller-1"] = {
        "followerId": "follower-1",
        "targetId": "seller-1",
        "createdAt": SINCE,
    }
    token = seed_user(user_store, uid="seller-1", active_profile="seller", name="Sunil Vyapari")
    resp = await client.post(
        "/v1/seller/products",
        json={**PRODUCT_BODY, "title": "Fresh Nashik Onions"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    notes = _notifications(user_store)
    assert len(notes) == 1
    note = notes[0]
    assert note["userId"] == "follower-1"
    assert note["type"] == "farmer_new_listing"
    assert "Sunil Vyapari" in note["body"]
    assert "Fresh Nashik Onions" in note["body"]
    assert note["read"] is False


# --------------------------------------------- producer resilience


async def test_malformed_subscriber_doc_does_not_break_update(client, user_store):
    _seed_product(user_store, stock=10)
    _seed_alert(user_store, "buyer-1", "prod-1", ["price_drop"])
    user_store["product_alerts/broken_prod-1"] = {
        "productId": "prod-1",
        "kinds": ["price_drop"],
        # missing userId
    }
    seed_user(user_store, uid="buyer-1")
    token = seed_user(user_store, uid="seller-1", active_profile="seller", name="Amit Agro")
    resp = await client.put(
        "/v1/seller/products/prod-1",
        json={"discountedPrice": 349},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    notes = _notifications(user_store)
    assert len(notes) == 1
    assert notes[0]["userId"] == "buyer-1"
