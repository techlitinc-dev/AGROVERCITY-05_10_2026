from tests.test_admin import _seed_admin, admin_headers
from tests.test_diary import auth, seed_user
from tests.test_loans import _apply, _banker, _review


def _seed_loan(user_store, doc_id, **overrides):
    user_store[f"loan_applications/{doc_id}"] = {
        "id": doc_id,
        "applicationId": doc_id,
        "applicationNumber": f"LN-2026-{doc_id[-4:]}",
        "userId": "uid-1",
        "farmerName": "Ram Patil",
        "farmerPhone": "+919812345678",
        "amount": 30000,
        "tenureMonths": 6,
        "purpose": "Seed purchase",
        "status": "submitted",
        "createdAt": "2026-09-20T00:00:00+00:00",
        "timeline": [],
        **overrides,
    }


async def test_admin_finance_loans_envelope_sort_and_filter(client, user_store):
    admin_token = _seed_admin(user_store)
    _seed_loan(user_store, "loan-0001", createdAt="2026-09-20T00:00:00+00:00")
    _seed_loan(user_store, "loan-0002", createdAt="2026-09-21T00:00:00+00:00")
    _seed_loan(
        user_store,
        "loan-0003",
        status="approved",
        createdAt="2026-09-22T00:00:00+00:00",
        sanctionedAmount=25000,
    )

    resp = await client.get("/v1/admin/finance/loans", headers=admin_headers(admin_token))
    assert resp.status_code == 200
    envelope = resp.json()
    assert envelope["total"] == 3
    assert envelope["page"] == 1 and envelope["pageSize"] == 20
    # createdAt desc → newest first
    assert [d["applicationId"] for d in envelope["data"]] == [
        "loan-0003",
        "loan-0002",
        "loan-0001",
    ]
    assert envelope["data"][0]["applicationNumber"] == "LN-2026-0003"
    assert envelope["data"][0]["sanctionedAmount"] == 25000

    resp = await client.get(
        "/v1/admin/finance/loans?status=submitted", headers=admin_headers(admin_token)
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 2
    assert all(d["status"] == "submitted" for d in resp.json()["data"])

    resp = await client.get(
        "/v1/admin/finance/loans?status=approved&page=1&pageSize=10",
        headers=admin_headers(admin_token),
    )
    assert resp.json()["total"] == 1
    assert resp.json()["pageSize"] == 10


async def test_admin_finance_loan_status_advance_along_legal_path(client, user_store):
    admin_token = _seed_admin(user_store)
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, application_id)

    resp = await client.put(
        f"/v1/admin/finance/loans/{application_id}/status",
        json={"status": "approved", "note": "Collateral verified at head office"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 200
    loan = resp.json()
    assert loan["status"] == "approved"
    assert loan["note"] == "Collateral verified at head office"
    assert loan["timeline"][-1]["status"] == "approved"
    assert loan["timeline"][-1]["statusText"] == "ऋण स्वीकृत"
    assert loan["timeline"][-1]["by"] == "uid-admin-test"

    stored = user_store[f"loan_applications/{application_id}"]
    assert stored["status"] == "approved"
    assert stored["statusText"] == "ऋण स्वीकृत"
    assert stored["note"] == "Collateral verified at head office"

    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(
        a.get("action") == "UPDATE_LOAN_STATUS" and a.get("loanId") == application_id
        for a in audits
    )


async def test_admin_finance_loan_status_illegal_jump_409(client, user_store):
    admin_token = _seed_admin(user_store)
    farmer_token = seed_user(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    # submitted → disbursed is not a legal transition
    resp = await client.put(
        f"/v1/admin/finance/loans/{application_id}/status",
        json={"status": "disbursed"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOAN_INVALID_TRANSITION"
    assert "submitted" in resp.json()["error"]["message"]
    # unchanged
    assert user_store[f"loan_applications/{application_id}"]["status"] == "submitted"


async def test_admin_finance_loan_status_unknown_status_422(client, user_store):
    admin_token = _seed_admin(user_store)
    _seed_loan(user_store, "loan-0009")
    resp = await client.put(
        "/v1/admin/finance/loans/loan-0009/status",
        json={"status": "frozen"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_admin_finance_loan_status_not_found_404(client, user_store):
    admin_token = _seed_admin(user_store)
    resp = await client.put(
        "/v1/admin/finance/loans/loan-nope/status",
        json={"status": "approved"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOAN_NOT_FOUND"


async def test_admin_finance_loans_forbidden_for_non_admin(client, user_store):
    farmer_token = seed_user(user_store)
    resp = await client.get("/v1/admin/finance/loans", headers=auth(farmer_token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ADMIN_REQUIRED"

    resp = await client.put(
        "/v1/admin/finance/loans/loan-0001/status",
        json={"status": "approved"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 403


async def test_admin_finance_loans_requires_token(client, user_store):
    _seed_admin(user_store)
    resp = await client.get("/v1/admin/finance/loans")
    assert resp.status_code == 401
