from datetime import datetime, timedelta, timezone

import pytest

from app.services.tokens import create_access_token

NOW = datetime.now(timezone.utc)


@pytest.fixture
def emarket(user_store):
    user_store["users/seller-1"] = {
        "id": "seller-1",
        "name": "Amit Agro",
        "linkedProfiles": ["seller"],
        "activeProfile": "seller",
        "primaryProfile": "seller",
    }
    user_store["users/cust-1"] = {
        "id": "cust-1",
        "name": "Kiran Shopper",
        "linkedProfiles": ["customer"],
        "activeProfile": "customer",
        "primaryProfile": "customer",
    }
    user_store["products/prod-1"] = {
        "id": "prod-1",
        "title": "Tomato Seeds",
        "category": "Seeds",
        "discountedPrice": 100,
        "sellerId": "seller-1",
        "stock": 5,
    }
    user_store["products/prod-2"] = {
        "id": "prod-2",
        "title": "Drip Kit",
        "category": "Tools",
        "discountedPrice": 200,
        "sellerId": "seller-1",
        "stock": 25,
    }
    user_store["products/prod-9"] = {
        "id": "prod-9",
        "title": "Other Seller Pump",
        "category": "Tools",
        "discountedPrice": 999,
        "sellerId": "seller-9",
        "stock": 2,
    }
    base = {"userId": "cust-1", "refundStatus": "none", "paymentMethod": "cod"}
    user_store["orders/ord-a"] = {
        **base,
        "id": "ord-a",
        "items": [{"productId": "prod-1", "quantity": 2}, {"productId": "prod-2", "quantity": 1}],
        "total": 400,
        "discount": 40,
        "finalTotal": 360,
        "couponCode": "SAVE10",
        "status": "delivered",
        "returnStatus": "requested",
        "createdAt": "2026-09-10T10:00:00+00:00",
    }
    user_store["orders/ord-b"] = {
        **base,
        "id": "ord-b",
        "items": [{"productId": "prod-1", "quantity": 1}],
        "total": 100,
        "status": "cancelled",
        "createdAt": (NOW - timedelta(days=5)).isoformat(),
    }
    user_store["orders/ord-c"] = {
        **base,
        "id": "ord-c",
        "items": [{"productId": "prod-2", "quantity": 2}],
        "total": 400,
        "status": "paid",
        "createdAt": "2026-08-05T10:00:00+00:00",
    }
    user_store["coupons/SAVE10"] = {
        "code": "SAVE10",
        "type": "percentage",
        "value": 10,
        "minOrder": 100,
        "maxDiscount": 150,
        "validUntil": (NOW + timedelta(days=30)).isoformat(),
        "usageLimit": 10,
        "usedCount": 2,
        "active": True,
        "description": "10% off",
    }
    user_store["coupons/DEAD"] = {
        "code": "DEAD",
        "type": "flat",
        "value": 10,
        "minOrder": 0,
        "maxDiscount": None,
        "validUntil": (NOW - timedelta(days=1)).isoformat(),
        "usageLimit": None,
        "usedCount": 0,
        "active": True,
        "description": "expired",
    }
    user_store["wishlists/cust-1"] = {"items": ["prod-1", "prod-2", "prod-9"]}
    return user_store


def _token(uid):
    return create_access_token(uid)


def _admin(user_store, uid="admin-root"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": "Super Admin",
        "linkedProfiles": ["farmer"],
        "activeProfile": "admin",
        "primaryProfile": "farmer",
        "isAdmin": True,
    }
    # Unified admin_user mechanism (WS-02): admin console signs in with Firebase
    # Auth; the test identity resolves via the conftest admin-token.
    return "admin-token"


async def test_customer_analytics(client, emarket):
    resp = await client.get("/v1/analytics/customer", headers={"Authorization": f"Bearer {_token('cust-1')}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["totalSpent"] == 760
    assert body["totalOrders"] == 3
    assert body["ordersByStatus"] == {"delivered": 1, "cancelled": 1, "paid": 1}
    assert len(body["monthlySpend"]) == 12
    by_month = {m["month"]: m["amount"] for m in body["monthlySpend"]}
    assert by_month["2026-09"] == 360
    assert by_month["2026-08"] == 400
    assert body["categorySpend"][0] == {"category": "Tools", "amount": 580.0}
    assert body["topProducts"][0]["productId"] == "prod-2"
    assert body["topProducts"][0]["amount"] == 580.0
    assert len(body["topProducts"]) <= 5
    assert body["wishlistCount"] == 3
    assert body["activeCoupons"] == 1
    assert body["pendingReturns"] == 1


async def test_seller_analytics(client, emarket):
    resp = await client.get(
        "/v1/analytics/seller", headers={"Authorization": f"Bearer {_token('seller-1')}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["revenue"] == 760
    assert body["ordersCount"] == 2
    assert body["itemsSold"] == 5
    assert body["aov"] == 380.0
    by_month = {m["month"]: m["amount"] for m in body["monthlyRevenue"]}
    assert by_month["2026-09"] == 360
    assert by_month["2026-08"] == 400
    assert body["topProducts"][0]["productId"] == "prod-2"
    assert body["categoryBreakdown"][0] == {"category": "Tools", "revenue": 580.0}
    assert body["lowStock"] == [{"productId": "prod-1", "title": "Tomato Seeds", "stock": 5}]
    assert body["returnRate"] == 0.5
    assert len(body["recentOrders"]) == 3
    assert body["recentOrders"][0]["id"] == "ord-b"


async def test_seller_analytics_forbidden_for_non_seller(client, emarket):
    user_store = emarket
    user_store["users/farmer-1"] = {
        "id": "farmer-1",
        "name": "Ram Patil",
        "linkedProfiles": ["farmer"],
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
    }
    resp = await client.get(
        "/v1/analytics/seller", headers={"Authorization": f"Bearer {_token('farmer-1')}"}
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_admin_emarket_analytics(client, emarket):
    admin = _admin(emarket)
    resp = await client.get("/v1/admin/analytics/emarket", headers={"Authorization": f"Bearer {admin}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["gmv"] == 760
    assert body["totalOrders"] == 3
    assert body["totalCustomers"] == 1
    assert body["totalSellers"] == 1
    assert body["aov"] == round(760 / 3, 2)
    by_month = {m["month"]: m["amount"] for m in body["monthlyGmv"]}
    assert by_month["2026-09"] == 360
    assert by_month["2026-08"] == 400
    assert body["ordersByStatus"]["cancelled"] == 1
    assert body["categoryShare"][0] == {"category": "Tools", "revenue": 580.0}
    assert body["topProducts"][0]["id"] == "prod-2"
    assert body["topProducts"][0]["revenue"] == 580.0
    assert body["topProducts"][0]["orders"] == 2
    assert body["topSellers"][0]["sellerId"] == "seller-1"
    assert body["topSellers"][0]["name"] == "Amit Agro"
    assert body["topSellers"][0]["revenue"] == 760
    assert body["returnRate"] == round(1 / 3, 2)
    assert body["couponUsage"] == {"issued": 2, "used": 2}


async def test_admin_emarket_analytics_forbidden_for_non_admin(client, emarket):
    resp = await client.get(
        "/v1/admin/analytics/emarket", headers={"Authorization": "Bearer plain-token"}
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ADMIN_REQUIRED"
