from tests.test_marketplace import seeded  # noqa: F401
from tests.test_orders import _place, _token, razorpay, rzp_signature  # noqa: F401
from tests.test_users import _auth


async def _paid_order(client, token):
    order_id = (await _place(client, token)).json()["orderId"]
    headers = _auth(token)
    rzp = await client.post("/v1/payments/razorpay/order", json={"orderId": order_id}, headers=headers)
    rzp_order_id = rzp.json()["razorpayOrderId"]
    await client.post(
        "/v1/payments/razorpay/verify",
        json={
            "orderId": order_id,
            "razorpayOrderId": rzp_order_id,
            "razorpayPaymentId": "pay_test_1",
            "razorpaySignature": rzp_signature(rzp_order_id, "pay_test_1"),
        },
        headers=headers,
    )
    return order_id


async def test_cancel_placed_order(client, seeded):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    resp = await client.post(f"/v1/orders/{order_id}/cancel", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert resp.json()["refundStatus"] == "none"


async def test_cancel_paid_order_requests_refund(client, seeded, razorpay):
    token = await _token(client)
    order_id = await _paid_order(client, token)
    resp = await client.post(f"/v1/orders/{order_id}/cancel", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert resp.json()["refundStatus"] == "requested"


async def test_cancel_shipped_order_409(client, seeded, user_store):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    user_store[f"orders/{order_id}"]["status"] = "shipped"
    resp = await client.post(f"/v1/orders/{order_id}/cancel", headers=_auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ORDER_NOT_CANCELLABLE"


async def test_cancel_other_users_order_404(client, seeded, user_store):
    token = await _token(client)
    user_store["orders/ord_other"] = {
        "id": "ord_other",
        "userId": "uid-other",
        "items": [],
        "total": 0,
        "status": "placed",
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    resp = await client.post("/v1/orders/ord_other/cancel", headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ORDER_NOT_FOUND"


async def test_refund_processed(client, seeded, user_store, razorpay):
    token = await _token(client)
    order_id = await _paid_order(client, token)
    headers = _auth(token)
    await client.post(f"/v1/orders/{order_id}/cancel", headers=headers)
    resp = await client.post("/v1/payments/razorpay/refund", json={"orderId": order_id}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["refundStatus"] == "processed"
    refund_id = user_store[f"orders/{order_id}"]["razorpayRefundId"]
    assert refund_id.startswith("rfnd_test_")
    resp = await client.post("/v1/payments/razorpay/refund", json={"orderId": order_id}, headers=headers)
    assert resp.status_code == 200
    assert user_store[f"orders/{order_id}"]["razorpayRefundId"] == refund_id


async def test_refund_not_applicable_409(client, seeded):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    resp = await client.post(
        "/v1/payments/razorpay/refund", json={"orderId": order_id}, headers=_auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "REFUND_NOT_APPLICABLE"
