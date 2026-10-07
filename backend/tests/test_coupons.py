from datetime import datetime, timedelta, timezone

import pytest

from app.routers.coupons import coupon_discount
from tests.test_marketplace import seeded  # noqa: F401
from tests.test_orders import _place
from tests.test_users import _auth, _register

NOW = datetime.now(timezone.utc)


def test_coupon_discount_is_exact_in_paisa():
    """10% of ₹199.50 must be ₹19.95 exactly — no float truncation (rule 6)."""
    coupon = {"type": "percentage", "value": 10, "maxDiscount": None}
    assert round(coupon_discount(coupon, 199.5) * 100) == 1995


def test_coupon_discount_cap_is_exact_in_paisa():
    coupon = {"type": "percentage", "value": 10, "maxDiscount": 1.5}
    assert round(coupon_discount(coupon, 199.5) * 100) == 150


def _coupon(code, **overrides):
    doc = {
        "code": code,
        "type": "percentage",
        "value": 10,
        "minOrder": 100,
        "maxDiscount": 150,
        "validUntil": (NOW + timedelta(days=30)).isoformat(),
        "usageLimit": 10,
        "usedCount": 0,
        "active": True,
        "description": f"coupon {code}",
    }
    doc.update(overrides)
    return doc


@pytest.fixture
def seeded_coupons(user_store):
    user_store["coupons/SAVE10"] = _coupon("SAVE10")
    user_store["coupons/FLAT30"] = _coupon(
        "FLAT30", type="flat", value=30, minOrder=0, maxDiscount=None
    )
    user_store["coupons/OLD"] = _coupon(
        "OLD", validUntil=(NOW - timedelta(days=1)).isoformat()
    )
    user_store["coupons/OFF"] = _coupon("OFF", active=False)
    user_store["coupons/GONE"] = _coupon("GONE", usageLimit=1, usedCount=1)
    user_store["coupons/BIG500"] = _coupon("BIG500", minOrder=500)
    return user_store


async def _token(client):
    resp = await _register(client)
    return resp.json()["accessToken"]


async def test_validate_coupon_ok(client, seeded_coupons):
    token = await _token(client)
    resp = await client.post(
        "/v1/coupons/validate", json={"code": "SAVE10", "cartTotal": 1000}, headers=_auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert body["discount"] == 100
    assert body["finalTotal"] == 900


async def test_validate_percentage_capped_by_max_discount(client, seeded_coupons):
    token = await _token(client)
    resp = await client.post(
        "/v1/coupons/validate", json={"code": "SAVE10", "cartTotal": 5000}, headers=_auth(token)
    )
    body = resp.json()
    assert body["valid"] is True
    assert body["discount"] == 150


async def test_validate_flat_coupon(client, seeded_coupons):
    token = await _token(client)
    resp = await client.post(
        "/v1/coupons/validate", json={"code": "FLAT30", "cartTotal": 200}, headers=_auth(token)
    )
    body = resp.json()
    assert body["valid"] is True
    assert body["discount"] == 30
    assert body["finalTotal"] == 170


@pytest.mark.parametrize(
    "code",
    ["OLD", "OFF", "GONE", "NOPE"],
)
async def test_validate_coupon_invalid_cases(client, seeded_coupons, code):
    token = await _token(client)
    resp = await client.post(
        "/v1/coupons/validate", json={"code": code, "cartTotal": 1000}, headers=_auth(token)
    )
    body = resp.json()
    assert body["valid"] is False
    assert body["discount"] == 0
    assert body["finalTotal"] == 1000
    assert body["message"]


async def test_validate_coupon_below_min_order(client, seeded_coupons):
    token = await _token(client)
    resp = await client.post(
        "/v1/coupons/validate", json={"code": "SAVE10", "cartTotal": 50}, headers=_auth(token)
    )
    body = resp.json()
    assert body["valid"] is False
    assert "minimum" in body["message"]


async def test_list_coupons_with_applicability(client, seeded_coupons):
    token = await _token(client)
    resp = await client.get("/v1/coupons", headers=_auth(token))
    codes = {c["code"] for c in resp.json()["data"]}
    assert codes == {"SAVE10", "FLAT30", "GONE", "BIG500"}
    resp = await client.get("/v1/coupons", params={"cartTotal": 50}, headers=_auth(token))
    applicable = {c["code"] for c in resp.json()["data"] if c["applicable"]}
    assert applicable == {"FLAT30"}


async def test_place_order_with_coupon(client, seeded, seeded_coupons, user_store):
    token = await _token(client)
    resp = await _place(client, token, couponCode="SAVE10", idempotencyKey="key-coupon")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1140
    assert body["discount"] == 114
    assert body["finalTotal"] == 1026
    order_id = body["orderId"]
    order = (await client.get(f"/v1/orders/{order_id}", headers=_auth(token))).json()
    assert order["total"] == 1140
    assert order["discount"] == 114
    assert order["finalTotal"] == 1026
    assert order["couponCode"] == "SAVE10"
    assert user_store["coupons/SAVE10"]["usedCount"] == 1


async def test_place_order_coupon_replay_does_not_double_use(client, seeded, seeded_coupons, user_store):
    token = await _token(client)
    resp1 = await _place(client, token, couponCode="SAVE10", idempotencyKey="key-replay")
    resp2 = await _place(client, token, couponCode="SAVE10", idempotencyKey="key-replay")
    assert resp1.json() == resp2.json()
    assert user_store["coupons/SAVE10"]["usedCount"] == 1


async def test_place_order_unknown_coupon_400(client, seeded):
    token = await _token(client)
    resp = await _place(client, token, couponCode="NOPE", idempotencyKey="key-bad-coupon")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "COUPON_INVALID"


async def test_place_order_coupon_min_order_400(client, seeded, seeded_coupons):
    token = await _token(client)
    body = {"items": [{"productId": "prod-5", "quantity": 1}], "paymentMethod": "cod"}
    resp = await client.post(
        "/v1/orders",
        json={**body, "couponCode": "BIG500", "idempotencyKey": "key-min"},
        headers=_auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "COUPON_INVALID"
