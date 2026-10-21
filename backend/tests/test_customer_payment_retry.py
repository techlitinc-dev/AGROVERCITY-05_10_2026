"""E-market customer workstream C1/C2: retry-payment + FarmGate escrow auto-release.

Covers: razorpay order amount = final payable (coupon applied), deliveryFeePaisa
persisted & included in the payable, POST /orders/{id}/pay idempotent
create/reuse, and release_due_customer_escrows releasing eligible held escrows
while skipping ineligible ones.
"""
from datetime import datetime, timedelta, timezone

from app.routers.emarket_customer import release_due_customer_escrows
from tests.test_diary import auth, seed_user
from tests.test_marketplace import seeded  # noqa: F401
from tests.test_orders import _place, _token, razorpay, rzp_signature  # noqa: F401
from tests.test_users import _auth

NOW = datetime.now(timezone.utc)


def _held_order(order_id, *, status="delivered", hours_ago=80, dispute=False):
    order = {
        "id": order_id,
        "customerId": "cust-pay-1",
        "farmerId": "farmer_9",
        "farmerName": "Test Farmer",
        "crop": "tomato",
        "district": "nashik",
        "quantityQuintals": 10.0,
        "pricePerQuintal": 2000.0,
        "orderValuePaisa": 2_000_000,
        "unitPricePaisa": 200_000,
        "status": status,
        "escrowStatus": "funded",
        "escrow": {
            "status": "held",
            "amount": 400_000,
            "method": "platform_escrow",
            "reference": order_id,
            "fundedAt": (NOW - timedelta(hours=hours_ago + 2)).isoformat(),
            "releasedAt": None,
            "refundedAt": None,
            "disputeOpenedAt": (NOW - timedelta(hours=hours_ago - 1)).isoformat() if dispute else None,
            "disputeResolvedAt": None,
        },
        "inspection": None,
        "statusTimeline": [{"status": "created", "at": (NOW - timedelta(days=4)).isoformat()}],
        "createdAt": (NOW - timedelta(days=4)).isoformat(),
        "deliveredAt": (NOW - timedelta(hours=hours_ago)).isoformat(),
    }
    return order


# --------------------------------------------------------------------------
# C1(a): razorpay order amount = final payable
# --------------------------------------------------------------------------


async def test_razorpay_amount_equals_final_total_with_coupon(client, seeded, user_store, razorpay):  # noqa: F811
    token = await _token(client)
    # Fixed Rs 100 coupon on the Rs 1140 cart → final payable Rs 1040.
    user_store["coupons/SAVE10"] = {"code": "SAVE10", "active": True, "type": "fixed", "value": 100}
    resp = await _place(client, token, paymentMethod="upi", couponCode="SAVE10", idempotencyKey="key-coupon")
    assert resp.status_code == 200
    assert resp.json()["finalTotal"] == 1140 - 100
    order_id = resp.json()["orderId"]

    rzp = await client.post("/v1/payments/razorpay/order", json={"orderId": order_id}, headers=_auth(token))
    assert rzp.status_code == 200
    assert rzp.json()["amount"] == 1040 * 100  # post-coupon payable, not the Rs 1140 gross


async def test_razorpay_amount_includes_delivery_fee(client, seeded, razorpay):  # noqa: F811
    token = await _token(client)
    resp = await _place(
        client, token, paymentMethod="upi", deliveryFeePaisa=9900, idempotencyKey="key-fee"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["deliveryFeePaisa"] == 9900
    assert body["finalTotal"] == 1140 + 99
    order_id = body["orderId"]

    rzp = await client.post("/v1/payments/razorpay/order", json={"orderId": order_id}, headers=_auth(token))
    assert rzp.status_code == 200
    assert rzp.json()["amount"] == (1140 + 99) * 100


async def test_delivery_fee_persisted_on_order_doc(client, seeded, user_store):
    token = await _token(client)
    resp = await _place(
        client, token, paymentMethod="cod", deliveryFeePaisa=9900, idempotencyKey="key-fee-doc"
    )
    assert resp.status_code == 200
    order = user_store[f"orders/{resp.json()['orderId']}"]
    assert order["deliveryFeePaisa"] == 9900
    assert order["deliveryFee"] == 99.0
    assert order["finalTotal"] == 1239
    assert order["total"] == 1140  # merchandise subtotal stays pre-fee


async def test_delivery_fee_validation_bounds(client, seeded):
    token = await _token(client)
    resp = await _place(client, token, deliveryFeePaisa=-1, idempotencyKey="key-fee-neg")
    assert resp.status_code == 422
    resp = await _place(client, token, deliveryFeePaisa=50001, idempotencyKey="key-fee-hi")
    assert resp.status_code == 422


# --------------------------------------------------------------------------
# C1(c): retry payment — create / reuse / settle
# --------------------------------------------------------------------------


async def test_retry_pay_creates_then_reuses_order(client, seeded, razorpay):  # noqa: F811
    token = await _token(client)
    order_id = (await _place(client, token, paymentMethod="upi")).json()["orderId"]
    headers = _auth(token)

    first = await client.post(f"/v1/orders/{order_id}/pay", headers=headers)
    assert first.status_code == 200
    assert first.json()["razorpayOrderId"] == f"order_test_{order_id}"
    assert first.json()["amount"] == 1140 * 100
    assert first.json()["reused"] is False

    second = await client.post(f"/v1/orders/{order_id}/pay", headers=headers)
    assert second.status_code == 200
    assert second.json()["razorpayOrderId"] == first.json()["razorpayOrderId"]
    assert second.json()["reused"] is True  # idempotent — no duplicate gateway order

    status = await client.get(f"/v1/orders/{order_id}/payment-status", headers=headers)
    assert status.status_code == 200
    body = status.json()
    assert body["paid"] is False
    assert body["canRetry"] is True
    assert body["amountPaisa"] == 1140 * 100

    # Settle via the normal verify flow, then retry must 409.
    await client.post(
        "/v1/payments/razorpay/verify",
        json={
            "orderId": order_id,
            "razorpayOrderId": first.json()["razorpayOrderId"],
            "razorpayPaymentId": "pay_test_1",
            "razorpaySignature": rzp_signature(first.json()["razorpayOrderId"], "pay_test_1"),
        },
        headers=headers,
    )
    status = await client.get(f"/v1/orders/{order_id}/payment-status", headers=headers)
    assert status.json()["paid"] is True
    assert status.json()["canRetry"] is False
    retry = await client.post(f"/v1/orders/{order_id}/pay", headers=headers)
    assert retry.status_code == 409
    assert retry.json()["error"]["code"] == "PAYMENT_NOT_DUE"


async def test_retry_pay_rejects_non_upi_order(client, seeded, razorpay):  # noqa: F811
    token = await _token(client)
    order_id = (await _place(client, token, paymentMethod="cod", idempotencyKey="key-cod")).json()["orderId"]
    resp = await client.post(f"/v1/orders/{order_id}/pay", headers=_auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PAYMENT_NOT_APPLICABLE"


async def test_retry_pay_requires_configured_gateway(client, seeded):
    token = await _token(client)
    order_id = (await _place(client, token, paymentMethod="upi", idempotencyKey="key-nokeys")).json()["orderId"]
    resp = await client.post(f"/v1/orders/{order_id}/pay", headers=_auth(token))
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "PAYMENTS_NOT_CONFIGURED"


# --------------------------------------------------------------------------
# C2: FarmGate escrow auto-release
# --------------------------------------------------------------------------


async def test_release_due_customer_escrows_releases_and_skips(client, user_store):
    eligible = _held_order("ord_due", hours_ago=80)
    in_window = _held_order("ord_window", hours_ago=10)
    disputed = _held_order("ord_dispute", hours_ago=80, dispute=True)
    undelivered = _held_order("ord_transit", status="confirmed", hours_ago=80)
    user_store["customer_orders/ord_due"] = eligible
    user_store["customer_orders/ord_window"] = in_window
    user_store["customer_orders/ord_dispute"] = disputed
    user_store["customer_orders/ord_transit"] = undelivered

    result = await release_due_customer_escrows()
    assert result["released"] == 1
    assert result["paused"] == 1
    assert result["pending"] == 2

    released_doc = user_store["customer_orders/ord_due"]
    assert released_doc["escrow"]["status"] == "released"
    assert released_doc["escrowStatus"] == "released"
    assert released_doc["escrow"]["releasedAt"] is not None
    assert any(e["status"] == "escrow_auto_released" for e in released_doc["statusTimeline"])

    # Ineligible orders keep their held deposit.
    assert user_store["customer_orders/ord_window"]["escrow"]["status"] == "held"
    assert user_store["customer_orders/ord_dispute"]["escrow"]["status"] == "held"
    assert user_store["customer_orders/ord_transit"]["escrow"]["status"] == "held"

    # Second run is a no-op (release is idempotent).
    again = await release_due_customer_escrows()
    assert again["released"] == 0


async def test_release_due_customer_escrows_job_endpoint(client, user_store):
    user_store["customer_orders/ord_job"] = _held_order("ord_job", hours_ago=90)
    resp = await client.post("/v1/jobs/customer-escrow/release-due")
    assert resp.status_code == 200
    assert resp.json()["released"] == 1
    assert resp.json()["paused"] == 0
