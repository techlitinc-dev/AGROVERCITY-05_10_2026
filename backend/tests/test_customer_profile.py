from tests.test_marketplace import seeded  # noqa: F401
from tests.test_orders import _place
from tests.test_users import _auth, _register


async def _register_customer(client, **overrides):
    body = {
        "profiles": ["customer"],
        "primaryProfile": "customer",
        "roleProfiles": {"customer": {"interests": ["seeds"], "preferredCategories": ["Fertilizer (खाद)"]}},
    }
    body.update(overrides)
    return await _register(client, **body)


async def test_register_customer_profile(client):
    resp = await _register_customer(client)
    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["linkedProfiles"] == ["customer"]
    assert user["activeProfile"] == "customer"


async def test_register_customer_role_profile_doc(client, user_store):
    await _register_customer(client)
    doc = user_store.get("users/uid-1/role_profiles/customer")
    assert doc is not None
    assert doc["interests"] == ["seeds"]


async def test_customer_can_browse_and_place_orders(client, seeded):
    token = (await _register_customer(client)).json()["accessToken"]
    headers = _auth(token)
    resp = await client.get("/v1/products", headers=headers)
    assert resp.status_code == 200
    resp = await _place(client, token)
    assert resp.status_code == 200
    assert resp.json()["orderId"]


async def test_customer_can_use_wishlist(client, seeded):
    token = (await _register_customer(client)).json()["accessToken"]
    resp = await client.post("/v1/wishlist/items", json={"productId": "prod-1"}, headers=_auth(token))
    assert resp.status_code == 201


async def test_customer_role_gating_blocks_seller_endpoints(client, seeded):
    token = (await _register_customer(client)).json()["accessToken"]
    body = {"title": "Urea", "category": "Fertilizer (खाद)", "mrp": 400, "discountedPrice": 350, "stock": 10}
    resp = await client.post("/v1/seller/products", json=body, headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_farmer_still_rejected_from_seller_products(client, seeded):
    resp = await _register(client)
    token = resp.json()["accessToken"]
    body = {"title": "Urea", "category": "Fertilizer (खाद)", "mrp": 400, "discountedPrice": 350, "stock": 10}
    resp = await client.post("/v1/seller/products", json=body, headers=_auth(token))
    assert resp.status_code == 403
