from tests.test_diary import seed_user
from tests.test_users import _auth

PRODUCT_BODY = {
    "title": "Organic Neem Oil (1L)",
    "category": "Pesticide (जैविक)",
    "brand": "Agro Naturals",
    "mrp": 450,
    "discountedPrice": 399,
    "stock": 25,
    "unit": "1L bottle",
    "description": "Cold-pressed neem oil",
    "imageUrl": "https://img.example/neem.png",
}


async def test_seller_creates_product(client, user_store):
    token = seed_user(user_store, uid="seller-1", active_profile="seller", name="Amit Agro")
    resp = await client.post("/v1/seller/products", json=PRODUCT_BODY, headers=_auth(token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["sellerId"] == "seller-1"
    assert body["sellerName"] == "Amit Agro"
    assert body["dealerName"] == "Amit Agro"
    assert body["stock"] == 25
    assert body["batchNo"].startswith("SLR-")
    assert body["discountedPrice"] == 399


async def test_seller_lists_only_own_products(client, user_store):
    token = seed_user(user_store, uid="seller-1", active_profile="seller", name="Amit Agro")
    other = seed_user(user_store, uid="seller-2", active_profile="seller", name="Ravi Traders")
    await client.post("/v1/seller/products", json=PRODUCT_BODY, headers=_auth(token))
    await client.post("/v1/seller/products", json={**PRODUCT_BODY, "title": "Second"}, headers=_auth(token))
    await client.post("/v1/seller/products", json=PRODUCT_BODY, headers=_auth(other))
    resp = await client.get("/v1/seller/products", headers=_auth(token))
    assert resp.json()["total"] == 2
    assert all(p["sellerId"] == "seller-1" for p in resp.json()["data"])


async def test_seller_updates_own_product(client, user_store):
    token = seed_user(user_store, uid="seller-1", active_profile="seller", name="Amit Agro")
    product_id = (await client.post("/v1/seller/products", json=PRODUCT_BODY, headers=_auth(token))).json()["id"]
    resp = await client.put(
        f"/v1/seller/products/{product_id}",
        json={"discountedPrice": 349, "stock": 20},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["discountedPrice"] == 349
    assert resp.json()["stock"] == 20
    assert resp.json()["title"] == PRODUCT_BODY["title"]


async def test_other_seller_cannot_update_product(client, user_store):
    token = seed_user(user_store, uid="seller-1", active_profile="seller", name="Amit Agro")
    other = seed_user(user_store, uid="seller-2", active_profile="seller", name="Ravi Traders")
    product_id = (await client.post("/v1/seller/products", json=PRODUCT_BODY, headers=_auth(token))).json()["id"]
    resp = await client.put(
        f"/v1/seller/products/{product_id}", json={"stock": 0}, headers=_auth(other)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_non_seller_cannot_create_product(client, user_store):
    token = seed_user(user_store, uid="farmer-1", active_profile="farmer")
    resp = await client.post("/v1/seller/products", json=PRODUCT_BODY, headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_update_unknown_product_404(client, user_store):
    token = seed_user(user_store, uid="seller-1", active_profile="seller", name="Amit Agro")
    resp = await client.put("/v1/seller/products/prod_nope", json={"stock": 1}, headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


async def test_buyer_view_hides_stock_but_seller_view_shows(client, user_store):
    seller = seed_user(user_store, uid="seller-1", active_profile="seller", name="Amit Agro")
    buyer = seed_user(user_store, uid="buyer-1", active_profile="farmer")
    product_id = (
        await client.post("/v1/seller/products", json=PRODUCT_BODY, headers=_auth(seller))
    ).json()["id"]
    resp = await client.get(f"/v1/products/{product_id}", headers=_auth(buyer))
    assert "stock" not in resp.json()
    assert resp.json()["inStock"] is True
    resp = await client.get("/v1/seller/products", headers=_auth(seller))
    assert resp.json()["data"][0]["stock"] == 25
