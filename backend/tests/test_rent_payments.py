from app.services.billing import seed_plans
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user

PAYMENT = {
    "amountRupees": 6000,
    "month": "2026-09",
    "method": "upi",
    "paidAt": "2026-09-10T10:00:00+00:00",
}


def _seed_lease(user_store, uid="uid-l1"):
    seed_user(user_store, uid=uid, active_profile="farmLandlord", name="Landlord Patil")
    user_store[f"users/{uid}/land_leases/lease-1"] = {
        "id": "lease-1",
        "plotId": "plot-1",
        "tenantName": "Sunil Pawar",
        "tenantPhone": "+919822200001",
        "monthlyRentRupees": 10000,
        "startDate": "2026-01-01",
        "endDate": "2026-12-31",
        "status": "active",
        "verified": False,
    }
    return create_access_token(uid)


async def _make_pro(user_store, uid="uid-l1"):
    await seed_plans()
    user_store["subscriptions/sub_pro_landlord"] = {
        "subId": "sub_pro_landlord",
        "userId": uid,
        "planId": "farmLandlord_pro",
        "status": "active",
        "provider": "razorpay_sub",
        "providerRef": "sub_test_1",
        "currentPeriodEnd": "2027-01-01T00:00:00+00:00",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }


async def test_partial_then_final_payment(client, user_store):
    token = _seed_lease(user_store)
    headers = auth(token)
    first = await client.post(
        "/v1/land/leases/lease-1/payments", json=PAYMENT, headers=headers
    )
    assert first.status_code == 201
    ledger = user_store["users/uid-l1/land_leases/lease-1/rent_ledger/2026-09"]
    assert ledger["amountDuePaisa"] == 1000000
    assert ledger["amountPaidPaisa"] == 600000
    assert ledger["status"] == "partial"
    assert isinstance(ledger["amountPaidPaisa"], int)
    listing = await client.get("/v1/land/leases/lease-1/payments", headers=headers)
    assert "2026-09" in listing.json()["pendingMonths"]

    final = await client.post(
        "/v1/land/leases/lease-1/payments",
        json={**PAYMENT, "amountRupees": 4000},
        headers=headers,
    )
    assert final.status_code == 201
    ledger = user_store["users/uid-l1/land_leases/lease-1/rent_ledger/2026-09"]
    assert ledger["amountPaidPaisa"] == 1000000
    assert ledger["status"] == "paid"
    listing = await client.get("/v1/land/leases/lease-1/payments", headers=headers)
    assert "2026-09" not in listing.json()["pendingMonths"]

    overflow = await client.post(
        "/v1/land/leases/lease-1/payments", json=PAYMENT, headers=headers
    )
    assert overflow.status_code == 409
    assert overflow.json()["error"]["code"] == "DUPLICATE_PAYMENT_MONTH"


async def test_payment_writes_audit_log(client, user_store):
    token = _seed_lease(user_store)
    resp = await client.post(
        "/v1/land/leases/lease-1/payments", json=PAYMENT, headers=auth(token)
    )
    assert resp.status_code == 201
    audits = [doc for key, doc in user_store.items() if key.startswith("audit_logs/")]
    payment_audits = [a for a in audits if a.get("action") == "RENT_PAYMENT_RECORDED"]
    assert len(payment_audits) == 1
    assert payment_audits[0]["amountPaidPaisa"] == 600000
    assert payment_audits[0]["balancePaisa"] == 400000


async def test_receipt_pdf(client, user_store):
    token = _seed_lease(user_store)
    await _make_pro(user_store)
    headers = auth(token)
    created = await client.post(
        "/v1/land/leases/lease-1/payments", json=PAYMENT, headers=headers
    )
    payment_id = created.json()["id"]
    resp = await client.get(f"/v1/land/rent-payments/{payment_id}/receipt", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"


async def test_ledger_csv_export(client, user_store):
    token = _seed_lease(user_store)
    await _make_pro(user_store)
    headers = auth(token)
    await client.post("/v1/land/leases/lease-1/payments", json=PAYMENT, headers=headers)
    await client.post(
        "/v1/land/leases/lease-1/payments",
        json={**PAYMENT, "amountRupees": 4000},
        headers=headers,
    )
    resp = await client.get(
        "/v1/land/leases/lease-1/ledger?format=csv", headers=headers
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    lines = resp.text.strip().split("\n")
    assert lines[0].startswith("month,amountPaidPaisa")
    assert len(lines) == 3  # header + two payments


async def test_pdf_exports_require_pro(client, user_store):
    token = _seed_lease(user_store)
    headers = auth(token)
    created = await client.post(
        "/v1/land/leases/lease-1/payments", json=PAYMENT, headers=headers
    )
    payment_id = created.json()["id"]
    receipt = await client.get(f"/v1/land/rent-payments/{payment_id}/receipt", headers=headers)
    assert receipt.status_code == 402
    assert receipt.json()["error"]["code"] == "UPGRADE_REQUIRED"
    ledger = await client.get("/v1/land/leases/lease-1/ledger?format=csv", headers=headers)
    assert ledger.status_code == 402
