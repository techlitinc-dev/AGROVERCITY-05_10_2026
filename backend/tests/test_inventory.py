import pytest

from tests.test_marketplace import PRODUCTS
from tests.test_users import _auth, _register


@pytest.fixture
def stocked(user_store):
    for doc in PRODUCTS:
        user_store[f"products/{doc['id']}"] = dict(doc)
    user_store["products/prod-1"]["stock"] = 5
    return user_store


async def _token(client):
    resp = await _register(client)
    return resp.json()["accessToken"]


async def test_order_exceeding_stock_409(client, stocked):
    token = await _token(client)
    body = {
        "items": [{"productId": "prod-1", "quantity": 10}],
        "paymentMethod": "cod",
        "idempotencyKey": "key-over",
    }
    resp = await client.post("/v1/orders", json=body, headers=_auth(token))
    assert resp.status_code == 409
    error = resp.json()["error"]
    assert error["code"] == "OUT_OF_STOCK"
    assert "prod-1" in error["fieldErrors"]


async def test_stock_decrements_after_order(client, stocked):
    token = await _token(client)
    body = {
        "items": [{"productId": "prod-1", "quantity": 2}],
        "paymentMethod": "cod",
        "idempotencyKey": "key-dec",
    }
    resp = await client.post("/v1/orders", json=body, headers=_auth(token))
    assert resp.status_code == 200
    assert stocked["products/prod-1"]["stock"] == 3


async def test_cancel_restores_stock(client, stocked):
    token = await _token(client)
    body = {
        "items": [{"productId": "prod-1", "quantity": 2}],
        "paymentMethod": "cod",
        "idempotencyKey": "key-restore",
    }
    order_id = (await client.post("/v1/orders", json=body, headers=_auth(token))).json()["orderId"]
    assert stocked["products/prod-1"]["stock"] == 3
    await client.post(f"/v1/orders/{order_id}/cancel", headers=_auth(token))
    assert stocked["products/prod-1"]["stock"] == 5


async def test_products_never_leak_stock_numbers(client, stocked):
    token = await _token(client)
    headers = _auth(token)
    resp = await client.get("/v1/products", headers=headers)
    for product in resp.json()["data"]:
        assert "stock" not in product
        assert product["inStock"] is True
    resp = await client.get("/v1/products/prod-1", headers=headers)
    assert "stock" not in resp.json()
    assert resp.json()["inStock"] is True
    stocked["products/prod-1"]["stock"] = 0
    resp = await client.get("/v1/products/prod-1", headers=headers)
    assert resp.json()["inStock"] is False


async def test_cart_hides_stock(client, stocked):
    token = await _token(client)
    headers = _auth(token)
    resp = await client.post("/v1/cart/items", json={"productId": "prod-1", "quantity": 1}, headers=headers)
    product = resp.json()["data"][0]["product"]
    assert "stock" not in product
    assert product["inStock"] is True


async def test_products_without_stock_field_unlimited(client, stocked):
    token = await _token(client)
    body = {
        "items": [{"productId": "prod-2", "quantity": 500}],
        "paymentMethod": "cod",
        "idempotencyKey": "key-unlimited",
    }
    resp = await client.post("/v1/orders", json=body, headers=_auth(token))
    assert resp.status_code == 200
