"""S7: per-buyer udhaar ledger with running balances in integer paisa —
udhaar entries accumulate, payments reduce, the ledger reconciles to zero."""
from tests.test_users import _auth, _register


async def _token(client):
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    return resp.json()["accessToken"]


async def _entry(client, token, **overrides):
    body = {
        "buyerName": "M/s Krishna Agro Traders",
        "buyerPhone": "9812345678",
        "type": "credit_sale",
        "amount": 1000.0,
        "paymentMode": "credit",
        "reference": "TEST",
    }
    body.update(overrides)
    resp = await client.post("/v1/seller/ledgers", json=body, headers=_auth(token))
    assert resp.status_code == 201
    return resp.json()


async def _buyer(client, token):
    resp = await client.get("/v1/seller/ledgers", headers=_auth(token))
    assert resp.status_code == 200
    return resp.json()


async def test_udhaar_entries_accumulate(client, user_store):
    token = await _token(client)
    await _entry(client, token, amount=1000.0)   # ₹1000
    await _entry(client, token, amount=500.0)    # ₹500 more udhaar

    data = await _buyer(client, token)
    buyer = data["data"][0]
    assert buyer["netBalance"] == 1500.0
    assert buyer["netBalancePaisa"] == 150000
    assert buyer["totalCreditPaisa"] == 150000
    assert data["totalCreditOutstandingPaisa"] == 150000


async def test_payments_reduce_and_reconcile_to_zero(client, user_store):
    token = await _token(client)
    await _entry(client, token, type="credit_sale", amount=2000.0)
    await _entry(client, token, type="payment_received", amount=800.0)
    buyer = (await _buyer(client, token))["data"][0]
    assert buyer["netBalance"] == 1200.0
    assert buyer["totalPaidPaisa"] == 80000
    assert buyer["netBalancePaisa"] == 120000

    await _entry(client, token, type="payment_received", amount=1200.0)
    data = await _buyer(client, token)
    buyer = data["data"][0]
    assert buyer["netBalance"] == 0.0
    assert buyer["netBalancePaisa"] == 0
    assert data["totalCreditOutstandingPaisa"] == 0
    assert data["totalDebtors"] == 0


async def test_running_balance_per_entry(client, user_store):
    token = await _token(client)
    await _entry(client, token, type="credit_sale", amount=1000.0, reference="RB-1")
    await _entry(client, token, type="credit_sale", amount=250.0, reference="RB-2")
    await _entry(client, token, type="payment_received", amount=300.0, reference="RB-3")

    buyer = (await _buyer(client, token))["data"][0]
    by_ref = {e["reference"]: e for e in buyer["history"]}
    assert by_ref["RB-1"]["balanceAfterPaisa"] == 100000
    assert by_ref["RB-2"]["balanceAfterPaisa"] == 125000
    assert by_ref["RB-3"]["balanceAfterPaisa"] == 95000  # 100000 + 25000 - 30000


async def test_integer_paisa_entry_path(client, user_store):
    token = await _token(client)
    entry = await _entry(client, token, amount=1234.0, amountPaisa=123456, reference="PAISA")
    assert entry["amountPaisa"] == 123456

    buyer = (await _buyer(client, token))["data"][0]
    assert buyer["netBalancePaisa"] == 123456
    # rupee display value is preserved from the declared amount
    assert buyer["netBalance"] == 1234.0


async def test_per_buyer_isolation(client, user_store):
    token = await _token(client)
    await _entry(client, token, buyerName="Buyer A", buyerPhone="111", amount=700.0)
    await _entry(client, token, buyerName="Buyer B", buyerPhone="222", amount=300.0)

    data = await _buyer(client, token)
    balances = {b["buyerName"]: b["netBalancePaisa"] for b in data["data"]}
    assert balances == {"Buyer A": 70000, "Buyer B": 30000}
    assert data["totalCreditOutstandingPaisa"] == 100000
