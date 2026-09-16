from tests.test_marketplace import seeded  # noqa: F401
from tests.test_users import _auth, _register

ORDER_BODY = {
    "items": [{"productId": "prod-1", "quantity": 2}],
    "paymentMethod": "cod",
    "deliveryAddress": "Pimplas, Nashik",
    "idempotencyKey": "key-1",
}


async def _token(client):
    resp = await _register(client)
    return resp.json()["accessToken"]


async def _place(client, token, **overrides):
    body = {**ORDER_BODY, **overrides}
    return await client.post("/v1/orders", json=body, headers=_auth(token))


async def test_place_order_and_clears_cart(client, seeded):
    token = await _token(client)
    headers = _auth(token)
    await client.post("/v1/cart/items", json={"productId": "prod-2", "quantity": 1}, headers=headers)
    resp = await _place(client, token)
    assert resp.status_code == 200
    order_id = resp.json()["orderId"]
    assert order_id
    cart = await client.get("/v1/cart", headers=headers)
    assert cart.json()["data"] == []
    order = await client.get(f"/v1/orders/{order_id}", headers=headers)
    assert order.json()["status"] == "placed"
    assert order.json()["total"] == 2 * 570


async def test_order_idempotent(client, seeded):
    token = await _token(client)
    resp1 = await _place(client, token)
    resp2 = await _place(client, token)
    assert resp1.json() == resp2.json()
    orders = await client.get("/v1/orders", headers=_auth(token))
    assert orders.json()["total"] == 1


async def test_bnpl_schedule(client, seeded):
    token = await _token(client)
    resp = await _place(client, token, paymentMethod="bnpl", idempotencyKey="key-bnpl")
    schedule = resp.json()["bnplSchedule"]
    assert len(schedule) == 2
    assert sum(i["amount"] for i in schedule) == resp.json()["total"]


async def test_orders_list_and_detail(client, seeded, user_store):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    headers = _auth(token)
    orders = await client.get("/v1/orders", headers=headers)
    assert any(o["id"] == order_id for o in orders.json()["data"])
    detail = await client.get(f"/v1/orders/{order_id}", headers=headers)
    assert detail.status_code == 200
    user_store["orders/ord_other"] = {
        "id": "ord_other",
        "userId": "uid-other",
        "items": [],
        "total": 0,
        "status": "placed",
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    resp = await client.get("/v1/orders/ord_other", headers=headers)
    assert resp.status_code == 403


async def test_razorpay_order_and_verify_dev_mode(client, seeded):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    headers = _auth(token)
    resp = await client.post("/v1/payments/razorpay/order", json={"orderId": order_id}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["razorpayOrderId"].startswith("order_dev_")
    resp = await client.post(
        "/v1/payments/razorpay/verify",
        json={
            "orderId": order_id,
            "razorpayOrderId": body["razorpayOrderId"],
            "razorpayPaymentId": "pay_dev_1",
            "razorpaySignature": "dev",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


async def test_razorpay_verify_bad_signature(client, seeded):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    headers = _auth(token)
    rzp = await client.post("/v1/payments/razorpay/order", json={"orderId": order_id}, headers=headers)
    resp = await client.post(
        "/v1/payments/razorpay/verify",
        json={
            "orderId": order_id,
            "razorpayOrderId": rzp.json()["razorpayOrderId"],
            "razorpayPaymentId": "pay_dev_1",
            "razorpaySignature": "wrong",
        },
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "PAYMENT_SIGNATURE_INVALID"
