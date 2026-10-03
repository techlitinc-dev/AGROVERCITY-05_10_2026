from app.services.tokens import create_access_token
from tests.test_marketplace import seeded  # noqa: F401
from tests.test_orders import _place, _token, razorpay, rzp_signature  # noqa: F401
from tests.test_users import _auth


def _admin_token(user_store, uid="admin-root"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": "Super Admin",
        "linkedProfiles": ["farmer"],
        "activeProfile": "admin",
        "primaryProfile": "farmer",
        "isAdmin": True,
    }
    return create_access_token(uid)


async def _pay_order(client, token, order_id):
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


async def test_timeline_tracks_placed_and_paid(client, seeded, razorpay):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    resp = await client.get(f"/v1/orders/{order_id}/timeline", headers=_auth(token))
    assert resp.status_code == 200
    events = resp.json()["data"]
    assert [e["status"] for e in events] == ["placed"]
    await _pay_order(client, token, order_id)
    resp = await client.get(f"/v1/orders/{order_id}/timeline", headers=_auth(token))
    events = resp.json()["data"]
    assert [e["status"] for e in events] == ["placed", "paid"]


async def test_timeline_foreign_order_403(client, seeded, user_store):
    token = await _token(client)
    user_store["orders/ord_other"] = {
        "id": "ord_other",
        "userId": "uid-other",
        "items": [],
        "total": 0,
        "status": "placed",
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    resp = await client.get("/v1/orders/ord_other/timeline", headers=_auth(token))
    assert resp.status_code == 403


async def test_admin_status_transitions(client, seeded, user_store):
    token = await _token(client)
    admin = _admin_token(user_store)
    order_id = (await _place(client, token)).json()["orderId"]
    resp = await client.patch(
        f"/v1/orders/{order_id}/status",
        json={"status": "confirmed", "note": "packed"},
        headers=_auth(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"
    resp = await client.patch(
        f"/v1/orders/{order_id}/status", json={"status": "shipped"}, headers=_auth(admin)
    )
    assert resp.json()["status"] == "shipped"
    events = (
        await client.get(f"/v1/orders/{order_id}/timeline", headers=_auth(token))
    ).json()["data"]
    assert [e["status"] for e in events] == ["placed", "confirmed", "shipped"]
    assert events[1]["note"] == "packed"


async def test_admin_status_invalid_transition_400(client, seeded, user_store):
    token = await _token(client)
    admin = _admin_token(user_store)
    order_id = (await _place(client, token)).json()["orderId"]
    resp = await client.patch(
        f"/v1/orders/{order_id}/status", json={"status": "delivered"}, headers=_auth(admin)
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


async def test_status_patch_non_admin_403(client, seeded):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    resp = await client.patch(
        f"/v1/orders/{order_id}/status", json={"status": "confirmed"}, headers=_auth(token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ADMIN"


async def test_status_patch_unknown_order_404(client, user_store):
    admin = _admin_token(user_store)
    resp = await client.patch(
        "/v1/orders/ord_nope/status", json={"status": "confirmed"}, headers=_auth(admin)
    )
    assert resp.status_code == 404


async def test_return_flow_after_delivery(client, seeded, user_store, razorpay):
    token = await _token(client)
    admin = _admin_token(user_store)
    order_id = (await _place(client, token)).json()["orderId"]
    await _pay_order(client, token, order_id)
    for status in ("confirmed", "shipped", "out_for_delivery", "delivered"):
        await client.patch(
            f"/v1/orders/{order_id}/status", json={"status": status}, headers=_auth(admin)
        )
    resp = await client.post(
        f"/v1/orders/{order_id}/return",
        json={"reason": "damaged packaging"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["returnStatus"] == "requested"
    assert body["refundStatus"] == "requested"
    events = (
        await client.get(f"/v1/orders/{order_id}/timeline", headers=_auth(token))
    ).json()["data"]
    assert events[-1]["status"] == "return_requested"
    resp = await client.post(
        f"/v1/orders/{order_id}/return", json={"reason": "again"}, headers=_auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "RETURN_ALREADY_REQUESTED"


async def test_return_not_allowed_on_placed_order(client, seeded):
    token = await _token(client)
    order_id = (await _place(client, token)).json()["orderId"]
    resp = await client.post(
        f"/v1/orders/{order_id}/return", json={"reason": "changed my mind"}, headers=_auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "RETURN_NOT_ALLOWED"


async def test_return_foreign_order_404(client, seeded, user_store):
    token = await _token(client)
    user_store["orders/ord_other"] = {
        "id": "ord_other",
        "userId": "uid-other",
        "items": [],
        "total": 0,
        "status": "delivered",
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    resp = await client.post(
        "/v1/orders/ord_other/return", json={"reason": "not mine"}, headers=_auth(token)
    )
    assert resp.status_code == 404
