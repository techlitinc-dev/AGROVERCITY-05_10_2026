import hashlib
import hmac

import pytest

from app.core.config import settings
from tests.test_marketplace import seeded  # noqa: F401
from tests.test_users import _auth, _register

RZP_TEST_KEY_ID = "rzp_test_key"
RZP_TEST_KEY_SECRET = "rzp_test_secret"

ORDER_BODY = {
    "items": [{"productId": "prod-1", "quantity": 2}],
    "paymentMethod": "cod",
    "deliveryAddress": "Pimplas, Nashik",
    "idempotencyKey": "key-1",
}


@pytest.fixture
def razorpay(monkeypatch):
    """Configure fake Razorpay keys and stub the outbound Razorpay HTTP calls."""
    monkeypatch.setattr(settings, "razorpay_key_id", RZP_TEST_KEY_ID)
    monkeypatch.setattr(settings, "razorpay_key_secret", RZP_TEST_KEY_SECRET)

    def fake_create_order(amount_paise, receipt):
        return {
            "id": f"order_test_{receipt}",
            "amount": amount_paise,
            "currency": "INR",
            "status": "created",
        }

    async def fake_refund(payment_id, amount_paise):
        return {"id": f"rfnd_test_{payment_id}", "status": "processed"}

    monkeypatch.setattr("app.routers.orders.create_razorpay_order", fake_create_order)
    monkeypatch.setattr("app.routers.orders.refund_razorpay_payment", fake_refund)
    yield


def rzp_signature(order_id: str, payment_id: str) -> str:
    return hmac.new(
        RZP_TEST_KEY_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()


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


async def test_razorpay_order_requires_configured_key(client, seeded):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    resp = await client.post(
        "/v1/payments/razorpay/order", json={"orderId": order_id}, headers=_auth(token)
    )
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "PAYMENTS_NOT_CONFIGURED"


async def test_razorpay_order_and_verify(client, seeded, razorpay):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    headers = _auth(token)
    resp = await client.post("/v1/payments/razorpay/order", json={"orderId": order_id}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["razorpayOrderId"] == f"order_test_{order_id}"
    assert body["keyId"] == RZP_TEST_KEY_ID
    resp = await client.post(
        "/v1/payments/razorpay/verify",
        json={
            "orderId": order_id,
            "razorpayOrderId": body["razorpayOrderId"],
            "razorpayPaymentId": "pay_test_1",
            "razorpaySignature": rzp_signature(body["razorpayOrderId"], "pay_test_1"),
        },
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


async def test_razorpay_verify_bad_signature(client, seeded, razorpay):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    headers = _auth(token)
    rzp = await client.post("/v1/payments/razorpay/order", json={"orderId": order_id}, headers=headers)
    resp = await client.post(
        "/v1/payments/razorpay/verify",
        json={
            "orderId": order_id,
            "razorpayOrderId": rzp.json()["razorpayOrderId"],
            "razorpayPaymentId": "pay_test_1",
            "razorpaySignature": "wrong",
        },
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "PAYMENT_SIGNATURE_INVALID"
