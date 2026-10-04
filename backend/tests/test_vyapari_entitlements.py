"""WS-03 step 8: vyapari commission 2% min ₹50 (config-driven, integer paisa
discipline at settlement) and Pro entitlement gates (GST invoice PDF)."""
from app.routers.purchases import commission_for
from app.services.billing import seed_plans
from tests.test_users import _auth, _register

SALE_BODY = {
    "buyerName": "M/s Krishna Agro Traders",
    "buyerPhone": "9812345678",
    "item": "Tomato",
    "quantity": 10.0,
    "unit": "Quintal",
    "ratePerUnit": 1800.0,
    "paymentMode": "upi",
    "amountPaid": 18000.0,
}


async def _token(client, user_store, pro=False):
    await seed_plans()
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    token = resp.json()["accessToken"]
    if pro:
        subscribed = await client.post(
            "/v1/billing/subscribe", json={"planId": "seller_pro"}, headers=_auth(token)
        )
        assert subscribed.status_code == 201
    return token


async def test_commission_min_50_floor(client, user_store):
    await seed_plans()
    # 2% of ₹1,000 is ₹20 — the ₹50 floor applies
    assert await commission_for(1000) == 50
    # 2% of ₹10,000 is ₹200 — above the floor
    assert await commission_for(10000) == 200
    assert await commission_for(0) == 0


async def test_commission_config_override(client, user_store):
    """platform_config/settlements is effective-dated + versioned; the service
    consumes sellerPct / sellerMinRupees."""
    user_store["platform_config/settlements"] = {
        "transportPct": 10,
        "equipmentRentalPct": 12,
        "brokerPct": 2,
        "sellerPct": 3,
        "sellerMinRupees": 100,
        "version": 2,
        "effectiveFrom": "2026-10-01T00:00:00+00:00",
    }
    assert await commission_for(1000) == 100  # 3% = 30 -> min ₹100
    assert await commission_for(10000) == 300  # 3%


async def test_gst_invoice_is_pro_gated(client, user_store):
    token = await _token(client, user_store, pro=False)
    sale = (
        await client.post("/v1/seller/sales", json=SALE_BODY, headers=_auth(token))
    ).json()

    blocked = await client.get(
        f"/v1/seller/sales/{sale['id']}/invoice.pdf", headers=_auth(token)
    )
    assert blocked.status_code == 402
    assert blocked.json()["error"]["code"] == "ENTITLEMENT_EXCEEDED"
    assert blocked.json()["error"]["feature"] == "gstInvoices"

    upgraded = await _subscribe_pro(client, token)
    assert upgraded.status_code == 201
    resp = await client.get(
        f"/v1/seller/sales/{sale['id']}/invoice.pdf", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"


async def _subscribe_pro(client, token):
    return await client.post(
        "/v1/billing/subscribe", json={"planId": "seller_pro"}, headers=_auth(token)
    )


async def test_enterprise_plan_features(client, user_store):
    await seed_plans()
    resp = await client.get("/v1/billing/plans", params={"persona": "seller"})
    plans = {p["planId"]: p for p in resp.json()["data"]}
    assert "seller_enterprise" in plans
    assert plans["seller_enterprise"]["limits"] == {}  # unlimited listings
    assert "whiteLabelRateBoards" in plans["seller_enterprise"]["features"]
    assert "multiShop" in plans["seller_enterprise"]["features"]
    # Free stays commission-only: commission config identical across tiers
    assert plans["seller_free"]["commission"] == "2% min ₹50"
    assert plans["seller_pro"]["commission"] == "2% min ₹50"
