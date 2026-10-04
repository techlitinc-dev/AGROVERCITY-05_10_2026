"""S6: TDS 194-O statements per settlement period (integer paisa math)."""
from tests.test_users import _auth, _register

PERIOD_START = "2026-09-07"
PERIOD_END = "2026-09-13"


async def _token(client, user_store):
    from app.services.billing import seed_plans

    await seed_plans()
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    token = resp.json()["accessToken"]
    # TDS statements are a Pro feature
    subscribed = await client.post(
        "/v1/billing/subscribe", json={"planId": "seller_pro"}, headers=_auth(token)
    )
    assert subscribed.status_code == 201
    return token


async def _sale_at(client, user_store, token, created_at, net_amount=None):
    body = {
        "buyerName": "M/s Krishna Agro Traders",
        "buyerPhone": "9812345678",
        "item": "Onion",
        "quantity": 10.0,
        "unit": "Quintal",
        "ratePerUnit": 1800.0,
        "paymentMode": "upi",
        "amountPaid": 0.0,
    }
    resp = await client.post("/v1/seller/sales", json=body, headers=_auth(token))
    assert resp.status_code == 201
    sale = resp.json()
    user_store[f"users/uid-1/seller_sales/{sale['id']}"]["createdAt"] = created_at
    if net_amount is not None:
        user_store[f"users/uid-1/seller_sales/{sale['id']}"]["netAmount"] = net_amount
    return sale


async def _statement(client, token, start=PERIOD_START, end=PERIOD_END):
    return await client.get(
        "/v1/seller/tds-statements/statement.pdf",
        params={"periodStart": start, "periodEnd": end},
        headers=_auth(token),
    )


async def test_tds_math_on_known_sales(client, user_store):
    token = await _token(client, user_store)
    # two in-period sales: net 18000 + 18000 = 36000 rupees -> 3,600,000 paisa gross -> 36,000 paisa TDS
    await _sale_at(client, user_store, token, "2026-09-08T10:00:00+00:00")
    await _sale_at(client, user_store, token, "2026-09-10T10:00:00+00:00")
    # one out-of-period sale must NOT count
    await _sale_at(client, user_store, token, "2026-09-20T10:00:00+00:00")

    resp = await _statement(client, token)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")

    stmt = user_store["tds_ledger/tds_seller_uid-1_2026-09-07"]
    assert stmt["persona"] == "seller"
    assert stmt["entityId"] == "uid-1"
    # net per sale = 18000 gross + 0.5% mandi fee = 18090 -> x2 in-period
    assert stmt["grossPaisa"] == 3618000
    assert stmt["tdsPaisa"] == 36180  # exactly 1%
    assert stmt["section"] == "194-O"
    assert stmt["period"] == "2026-09-07..2026-09-13"


async def test_tds_statement_listing(client, user_store):
    token = await _token(client, user_store)
    await _sale_at(client, user_store, token, "2026-09-08T10:00:00+00:00", net_amount=5000.0)
    await _statement(client, token)

    resp = await client.get("/v1/seller/tds-statements", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["grossPaisa"] == 500000
    assert body["totalTdsPaisa"] == 5000


async def test_regenerate_same_period_replaces_doc(client, user_store):
    token = await _token(client, user_store)
    await _sale_at(client, user_store, token, "2026-09-09T10:00:00+00:00")
    await _statement(client, token)
    first = user_store["tds_ledger/tds_seller_uid-1_2026-09-07"]["at"]
    await _statement(client, token)
    docs = [k for k in user_store if k.startswith("tds_ledger/")]
    assert len(docs) == 1  # idempotent upsert, no duplicates
    assert user_store["tds_ledger/tds_seller_uid-1_2026-09-07"]["at"] >= first


async def test_invalid_period_422(client, user_store):
    token = await _token(client, user_store)
    resp = await _statement(client, token, start="09/07/2026")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_PERIOD"
