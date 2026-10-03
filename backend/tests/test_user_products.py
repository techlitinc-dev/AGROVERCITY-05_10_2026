from tests.test_diary import seed_user
from tests.test_users import _auth

PRODUCT_BODY = {
    "title": "Organic Neem Oil (1L)",
    "category": "Pesticide (जैविक)",
    "brand": "Agro Naturals",
    "vernacularTitle": "नीम तेल",
    "description": "Cold-pressed neem oil",
    "mrp": 450,
    "discountedPrice": 399,
    "stock": 25,
    "unit": "1L bottle",
    "imageUrl": "https://img.example/neem.png",
    "batchNo": "",
}


async def test_user_creates_product_with_system_fields(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    resp = await client.post("/v1/my-products", json=PRODUCT_BODY, headers=_auth(token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["sellerId"] == "farmer-1"
    assert body["sellerName"] == "Amit Agro"
    assert body["dealerName"] == "Amit Agro"
    assert body["rating"] == 0.0
    assert body["reviewsCount"] == 0
    assert body["distanceKm"] == 0.0
    assert body["bnplAvailable"] is False
    assert body["createdAt"]
    assert body["stock"] == 25
    assert body["discountedPrice"] == 399
    assert body["vernacularTitle"] == "नीम तेल"
    assert body["batchNo"].startswith("USR-")


async def test_user_create_respects_client_batch_no(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    resp = await client.post(
        "/v1/my-products",
        json={**PRODUCT_BODY, "batchNo": "BATCH-77"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["batchNo"] == "BATCH-77"


async def test_create_with_discounted_price_above_mrp_422(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    resp = await client.post(
        "/v1/my-products",
        json={**PRODUCT_BODY, "mrp": 100, "discountedPrice": 150},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "discountedPrice" in resp.json()["error"]["fieldErrors"]


async def test_user_lists_only_own_products_newest_first(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    other = seed_user(user_store, uid="farmer-2", name="Ravi Patil")
    await client.post("/v1/my-products", json=PRODUCT_BODY, headers=_auth(token))
    await client.post("/v1/my-products", json={**PRODUCT_BODY, "title": "Second"}, headers=_auth(token))
    await client.post("/v1/my-products", json=PRODUCT_BODY, headers=_auth(other))
    resp = await client.get("/v1/my-products", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert resp.json()["total"] == 2
    assert all(p["sellerId"] == "farmer-1" for p in data)
    assert data[0]["title"] == "Second"


async def test_user_updates_own_product(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    product_id = (await client.post("/v1/my-products", json=PRODUCT_BODY, headers=_auth(token))).json()["id"]
    resp = await client.put(
        f"/v1/my-products/{product_id}",
        json={"discountedPrice": 349, "stock": 20},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["discountedPrice"] == 349
    assert body["stock"] == 20
    assert body["mrp"] == 450
    assert body["title"] == PRODUCT_BODY["title"]
    assert body["updatedAt"]


async def test_other_user_cannot_update_product(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    other = seed_user(user_store, uid="farmer-2", name="Ravi Patil")
    product_id = (await client.post("/v1/my-products", json=PRODUCT_BODY, headers=_auth(token))).json()["id"]
    resp = await client.put(
        f"/v1/my-products/{product_id}", json={"stock": 0}, headers=_auth(other)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_update_unknown_product_404(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    resp = await client.put("/v1/my-products/prod_nope", json={"stock": 1}, headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


async def test_update_discounted_price_above_existing_mrp_422(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    product_id = (await client.post("/v1/my-products", json=PRODUCT_BODY, headers=_auth(token))).json()["id"]
    resp = await client.put(
        f"/v1/my-products/{product_id}", json={"discountedPrice": 500}, headers=_auth(token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_user_deletes_own_product(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    buyer = seed_user(user_store, uid="farmer-2", name="Ravi Patil")
    product_id = (await client.post("/v1/my-products", json=PRODUCT_BODY, headers=_auth(token))).json()["id"]
    resp = await client.delete(f"/v1/my-products/{product_id}", headers=_auth(token))
    assert resp.status_code == 204
    resp = await client.get(f"/v1/products/{product_id}", headers=_auth(buyer))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


async def test_other_user_cannot_delete_product(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    other = seed_user(user_store, uid="farmer-2", name="Ravi Patil")
    product_id = (await client.post("/v1/my-products", json=PRODUCT_BODY, headers=_auth(token))).json()["id"]
    resp = await client.delete(f"/v1/my-products/{product_id}", headers=_auth(other))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_delete_unknown_product_404(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    resp = await client.delete("/v1/my-products/prod_nope", headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


async def test_delete_blocked_by_active_order(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    product_id = (await client.post("/v1/my-products", json=PRODUCT_BODY, headers=_auth(token))).json()["id"]
    user_store["orders/ord_1"] = {
        "id": "ord_1",
        "userId": "buyer-1",
        "items": [{"productId": product_id, "quantity": 1}],
        "status": "placed",
    }
    resp = await client.delete(f"/v1/my-products/{product_id}", headers=_auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PRODUCT_HAS_ORDERS"


async def test_delete_allowed_when_only_cancelled_order_references(client, user_store):
    token = seed_user(user_store, uid="farmer-1", name="Amit Agro")
    product_id = (await client.post("/v1/my-products", json=PRODUCT_BODY, headers=_auth(token))).json()["id"]
    user_store["orders/ord_1"] = {
        "id": "ord_1",
        "userId": "buyer-1",
        "items": [{"productId": product_id, "quantity": 1}],
        "status": "cancelled",
    }
    resp = await client.delete(f"/v1/my-products/{product_id}", headers=_auth(token))
    assert resp.status_code == 204


async def test_unauthenticated_requests_rejected(client):
    resp = await client.post("/v1/my-products", json=PRODUCT_BODY)
    assert resp.status_code == 401
    resp = await client.get("/v1/my-products")
    assert resp.status_code == 401
    resp = await client.put("/v1/my-products/prod_x", json={"stock": 1})
    assert resp.status_code == 401
    resp = await client.delete("/v1/my-products/prod_x")
    assert resp.status_code == 401
