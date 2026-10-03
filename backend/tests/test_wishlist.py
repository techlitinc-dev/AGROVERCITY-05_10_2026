from tests.test_marketplace import seeded  # noqa: F401
from tests.test_users import _auth, _register


async def _token(client):
    resp = await _register(client)
    return resp.json()["accessToken"]


async def test_wishlist_add_list_remove(client, seeded):
    token = await _token(client)
    headers = _auth(token)
    resp = await client.post("/v1/wishlist/items", json={"productId": "prod-1"}, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["total"] == 1
    resp = await client.post("/v1/wishlist/items", json={"productId": "prod-2"}, headers=headers)
    assert resp.json()["total"] == 2
    resp = await client.get("/v1/wishlist", headers=headers)
    data = resp.json()["data"]
    assert {p["id"] for p in data} == {"prod-1", "prod-2"}
    resp = await client.delete("/v1/wishlist/items/prod-1", headers=headers)
    assert resp.status_code == 204
    resp = await client.get("/v1/wishlist", headers=headers)
    assert [p["id"] for p in resp.json()["data"]] == ["prod-2"]


async def test_wishlist_add_is_idempotent(client, seeded, user_store):
    token = await _token(client)
    headers = _auth(token)
    await client.post("/v1/wishlist/items", json={"productId": "prod-1"}, headers=headers)
    await client.post("/v1/wishlist/items", json={"productId": "prod-1"}, headers=headers)
    assert user_store["wishlists/uid-1"]["items"] == ["prod-1"]
    resp = await client.get("/v1/wishlist", headers=headers)
    assert resp.json()["total"] == 1


async def test_wishlist_unknown_product_404(client, seeded):
    token = await _token(client)
    resp = await client.post("/v1/wishlist/items", json={"productId": "nope"}, headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


async def test_wishlist_available_to_any_logged_in_user(client, seeded):
    token = await _token(client)
    resp = await client.post("/v1/wishlist/items", json={"productId": "prod-3"}, headers=_auth(token))
    assert resp.status_code == 201


async def test_wishlist_product_hides_stock(client, seeded, user_store):
    user_store["products/prod-1"] = {**user_store["products/prod-1"], "stock": 4}
    token = await _token(client)
    headers = _auth(token)
    await client.post("/v1/wishlist/items", json={"productId": "prod-1"}, headers=headers)
    data = (await client.get("/v1/wishlist", headers=headers)).json()["data"]
    assert data[0]["inStock"] is True
    assert "stock" not in data[0]
