"""S6: GST invoice PDF per sale (Pro feature — GST invoices)."""
from app.services.billing import seed_plans
from tests.test_users import _auth, _register

SALE_BODY = {
    "buyerName": "M/s Krishna Agro Traders",
    "buyerPhone": "9812345678",
    "item": "Tomato 15kg Crates",
    "quantity": 100.0,
    "unit": "Bags",
    "ratePerUnit": 450.0,
    "paymentMode": "upi",
    "amountPaid": 45000.0,
    "mandiFeePct": 0.5,
}


async def _token(client, user_store):
    await seed_plans()
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    token = resp.json()["accessToken"]
    # GST invoice PDFs are a Pro feature
    subscribed = await client.post(
        "/v1/billing/subscribe", json={"planId": "seller_pro"}, headers=_auth(token)
    )
    assert subscribed.status_code == 201
    return token


async def _create_sale(client, token):
    resp = await client.post("/v1/seller/sales", json=SALE_BODY, headers=_auth(token))
    assert resp.status_code == 201
    return resp.json()


async def test_gst_invoice_pdf_200(client, user_store):
    token = await _token(client, user_store)
    sale = await _create_sale(client, token)

    resp = await client.get(
        f"/v1/seller/sales/{sale['id']}/invoice.pdf", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")


async def test_gst_invoice_unknown_sale_404(client, user_store):
    token = await _token(client, user_store)
    resp = await client.get("/v1/seller/sales/sale_missing/invoice.pdf", headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "SALE_NOT_FOUND"


async def test_other_sellers_sale_404(client, user_store):
    from app.services.tokens import create_access_token

    token = await _token(client, user_store)
    sale = await _create_sale(client, token)
    user_store["users/uid-2"] = {
        "id": "uid-2",
        "linkedProfiles": ["seller"],
        "activeProfile": "seller",
        "primaryProfile": "seller",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    other = create_access_token("uid-2")
    resp = await client.get(f"/v1/seller/sales/{sale['id']}/invoice.pdf", headers=_auth(other))
    assert resp.status_code == 404
