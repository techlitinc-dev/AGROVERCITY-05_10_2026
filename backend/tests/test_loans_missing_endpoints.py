"""Missing-endpoint audit items for the loans module (robust.md §6.11 / SOP-14 §3).

P1-23  GET /v1/loans/{id}/documents/{documentId}/download — time-boxed signed URL
P1-24  POST/GET /v1/loans/{id}/repayments — EMI repayment ledger + default risk
P2-20  GET /v1/loans/audit-logs — bank-manager-scoped audit read (applicationId)

All tests drive the real API through the httpx ASGI harness and follow the
conftest fake-store fixtures; existing assertions are never weakened.
"""
from datetime import datetime, timedelta, timezone

from tests.test_diary import auth, seed_user

BANKER_UID = "uid-banker-1"
OTHER_BANKER_UID = "uid-banker-2"
OTHER_FARMER_UID = "uid-farmer-2"

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 512


def _banker(user_store, uid=BANKER_UID):
    return seed_user(user_store, uid=uid, active_profile="bankManager", name="Anita Sharma")


async def _apply(client, token, **overrides):
    body = {"amount": 30000, "tenureMonths": 6, "purpose": "Seed purchase", **overrides}
    return await client.post("/v1/finance/loans/apply", json=body, headers=auth(token))


async def _review(client, banker_token, application_id):
    return await client.post(f"/v1/loans/{application_id}/review", headers=auth(banker_token))


async def _approve(client, banker_token, application_id, **overrides):
    body = {"sanctionedAmount": 30000, "interestRate": 12, "tenureMonths": 6, **overrides}
    return await client.post(f"/v1/loans/{application_id}/approve", json=body, headers=auth(banker_token))


async def _disburse(client, banker_token, application_id):
    return await client.post(
        f"/v1/loans/{application_id}/disburse",
        json={"disbursementRef": "UTR2026HB000123"},
        headers=auth(banker_token),
    )


async def _disbursed_loan(client, user_store, **approve_overrides):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, application_id)
    await _approve(client, banker_token, application_id, **approve_overrides)
    await _disburse(client, banker_token, application_id)
    return farmer_token, banker_token, application_id


async def _upload_document(client, token, application_id, filename="land_712.png"):
    files = [("files", (filename, PNG_BYTES, "image/png"))]
    resp = await client.post(
        f"/v1/loans/{application_id}/documents", files=files, headers=auth(token)
    )
    assert resp.status_code == 201
    return resp.json()["documents"][-1]


def _fake_storage(monkeypatch):
    monkeypatch.setattr(
        "app.services.storage.upload_user_file",
        lambda uid, data, filename, content_type, prefix="vault": (
            f"{prefix}/{uid}/fake_{filename}",
            len(data),
        ),
    )
    monkeypatch.setattr(
        "app.services.storage.signed_download_url",
        lambda blob_path, minutes=60: f"https://storage.example.com/{blob_path}?sig=x&minutes={minutes}",
    )


def _repayments_of(user_store, application_id):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("loan_repayments/") and doc.get("applicationId") == application_id
    ]


# --------------------------------------------------------------------------- #
# P1-23 — signed document download URL
# --------------------------------------------------------------------------- #


async def test_document_download_returns_time_boxed_signed_url(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    doc = await _upload_document(client, farmer_token, application_id)
    storage_path = doc["storagePath"]

    # Applicant farmer can download.
    resp = await client.get(
        f"/v1/loans/{application_id}/documents/{doc['documentId']}/download",
        headers=auth(farmer_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["url"] == f"https://storage.example.com/{storage_path}?sig=x&minutes=60"
    expires_at = datetime.fromisoformat(body["expiresAt"])
    ttl = expires_at - datetime.now(timezone.utc)
    assert timedelta(minutes=59) < ttl <= timedelta(minutes=60)

    # The bank manager assigned to the application can download too.
    await _review(client, banker_token, application_id)
    resp = await client.get(
        f"/v1/loans/{application_id}/documents/{doc['documentId']}/download",
        headers=auth(banker_token),
    )
    assert resp.status_code == 200
    assert resp.json()["url"] == body["url"]


async def test_document_download_404_when_document_belongs_to_another_loan(
    client, user_store, monkeypatch
):
    _fake_storage(monkeypatch)
    farmer_token = seed_user(user_store)
    first_id = (await _apply(client, farmer_token)).json()["applicationId"]
    second_id = (await _apply(client, farmer_token)).json()["applicationId"]
    doc = await _upload_document(client, farmer_token, first_id)

    resp = await client.get(
        f"/v1/loans/{second_id}/documents/{doc['documentId']}/download",
        headers=auth(farmer_token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOAN_DOCUMENT_NOT_FOUND"

    resp = await client.get(
        f"/v1/loans/{first_id}/documents/nope/download", headers=auth(farmer_token)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOAN_DOCUMENT_NOT_FOUND"


async def test_document_download_stranger_farmer_gets_404(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    farmer_token = seed_user(user_store)
    other_token = seed_user(user_store, uid=OTHER_FARMER_UID, name="Sham Rao")
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    doc = await _upload_document(client, farmer_token, application_id)

    resp = await client.get(
        f"/v1/loans/{application_id}/documents/{doc['documentId']}/download",
        headers=auth(other_token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOAN_NOT_FOUND"


# --------------------------------------------------------------------------- #
# P1-24 — EMI repayment ledger
# --------------------------------------------------------------------------- #


async def test_repayment_records_ledger_entry_and_rolls_up_loan(client, user_store):
    _, banker_token, application_id = await _disbursed_loan(
        client, user_store, sanctionedAmount=24000, tenureMonths=4
    )

    resp = await client.post(
        f"/v1/loans/{application_id}/repayments",
        json={"amountPaise": 50000, "mode": "upi", "emiIndex": 1, "note": "EMI 1"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 201
    entry = resp.json()
    assert entry["amountPaise"] == 50000
    assert entry["mode"] == "upi"
    assert entry["emiIndex"] == 1
    assert entry["note"] == "EMI 1"
    assert entry["paidAt"] and entry["recordedAt"]
    assert entry["runningPaidPaisa"] == 50000

    # The loan doc carries the rollup fields.
    loan = user_store[f"loan_applications/{application_id}"]
    assert loan["paidAmountPaisa"] == 50000
    assert loan["emisPaid"] == 1

    # A second installment accumulates.
    resp = await client.post(
        f"/v1/loans/{application_id}/repayments",
        json={"amountPaise": 30000, "mode": "cash", "emiIndex": 2},
        headers=auth(banker_token),
    )
    assert resp.status_code == 201
    assert resp.json()["runningPaidPaisa"] == 80000
    loan = user_store[f"loan_applications/{application_id}"]
    assert loan["paidAmountPaisa"] == 80000
    assert loan["emisPaid"] == 2

    # Ledger docs persist both entries; the mutation is audit-logged.
    ledger = _repayments_of(user_store, application_id)
    assert len(ledger) == 2
    audits = [
        doc
        for key, doc in user_store.items()
        if key.startswith("audit_logs/") and doc.get("action") == "LOAN_REPAYMENT"
    ]
    assert len(audits) == 2
    assert all(a["adminId"] == BANKER_UID and a["loanId"] == application_id for a in audits)


async def test_repayment_honors_paid_at_and_requires_positive_amount(client, user_store):
    _, banker_token, application_id = await _disbursed_loan(client, user_store)
    paid_at = "2026-10-10T09:30:00+00:00"
    resp = await client.post(
        f"/v1/loans/{application_id}/repayments",
        json={"amountPaise": 1000, "mode": "nach", "paidAt": paid_at},
        headers=auth(banker_token),
    )
    assert resp.status_code == 201
    assert resp.json()["paidAt"] == paid_at

    resp = await client.post(
        f"/v1/loans/{application_id}/repayments",
        json={"amountPaise": 0, "mode": "upi"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/v1/loans/{application_id}/repayments",
        json={"amountPaise": -5, "mode": "cash"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/v1/loans/{application_id}/repayments",
        json={"amountPaise": 1000, "mode": "upi", "paidAt": "not-a-date"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 422


async def test_repayment_same_emi_index_twice_conflicts(client, user_store):
    _, banker_token, application_id = await _disbursed_loan(client, user_store)

    body = {"amountPaise": 50000, "mode": "upi", "emiIndex": 1}
    resp = await client.post(
        f"/v1/loans/{application_id}/repayments", json=body, headers=auth(banker_token)
    )
    assert resp.status_code == 201

    resp = await client.post(
        f"/v1/loans/{application_id}/repayments",
        json={**body, "amountPaise": 51000},
        headers=auth(banker_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DUPLICATE_EMI"

    # Index-less entries never conflict; a different index is accepted.
    for payload in (
        {"amountPaise": 7000, "mode": "cash"},
        {"amountPaise": 6000, "mode": "nach", "emiIndex": 2},
    ):
        resp = await client.post(
            f"/v1/loans/{application_id}/repayments", json=payload, headers=auth(banker_token)
        )
        assert resp.status_code == 201
    assert len(_repayments_of(user_store, application_id)) == 3


async def test_repayment_bank_manager_scoped_and_loan_must_exist(client, user_store):
    farmer_token = seed_user(user_store)
    _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    resp = await client.post(
        f"/v1/loans/{application_id}/repayments",
        json={"amountPaise": 1000, "mode": "upi"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

    resp = await client.post(
        "/v1/loans/unknown-application/repayments",
        json={"amountPaise": 1000, "mode": "upi"},
        headers=auth(_banker(user_store)),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOAN_NOT_FOUND"


async def test_repayments_list_running_balance_and_access(client, user_store):
    farmer_token, banker_token, application_id = await _disbursed_loan(
        client, user_store, sanctionedAmount=24000, tenureMonths=4
    )
    for payload in (
        {"amountPaise": 50000, "mode": "upi", "emiIndex": 1},
        {"amountPaise": 30000, "mode": "cash"},
        {"amountPaise": 20000, "mode": "nach", "emiIndex": 2},
    ):
        await client.post(
            f"/v1/loans/{application_id}/repayments", json=payload, headers=auth(banker_token)
        )

    # Applicant and bank manager both read the ledger.
    for token in (farmer_token, banker_token):
        resp = await client.get(f"/v1/loans/{application_id}/repayments", headers=auth(token))
        assert resp.status_code == 200
        body = resp.json()
        assert body["applicationId"] == application_id
        assert body["total"] == 3
        assert [e["runningPaidPaisa"] for e in body["data"]] == [50000, 80000, 100000]
        assert body["totalRepaidPaisa"] == 100000
        assert body["principalPaisa"] == 2400000
        # Nothing is overdue yet: the first unpaid installment falls due next month.
        assert body["defaultRisk"] == {"daysOverdue": 0, "basis": "emi_schedule"}

    other_token = seed_user(user_store, uid=OTHER_FARMER_UID, name="Sham Rao")
    resp = await client.get(f"/v1/loans/{application_id}/repayments", headers=auth(other_token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOAN_NOT_FOUND"


async def test_repayments_list_fully_covered_has_no_overdue(client, user_store):
    farmer_token, banker_token, application_id = await _disbursed_loan(
        client, user_store, sanctionedAmount=24000, interestRate=10, tenureMonths=4
    )
    schedule = (
        await client.get(f"/v1/loans/{application_id}/schedule", headers=auth(farmer_token))
    ).json()["data"]
    total_due_paisa = sum(e["emi"] * 100 for e in schedule)

    await client.post(
        f"/v1/loans/{application_id}/repayments",
        json={"amountPaise": total_due_paisa, "mode": "nach"},
        headers=auth(banker_token),
    )
    body = (
        await client.get(f"/v1/loans/{application_id}/repayments", headers=auth(banker_token))
    ).json()
    assert body["totalRepaidPaisa"] == total_due_paisa
    assert body["defaultRisk"] == {"daysOverdue": 0, "basis": "emi_schedule"}


async def test_repayments_list_without_schedule_uses_no_emi_basis(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    resp = await client.get(f"/v1/loans/{application_id}/repayments", headers=auth(banker_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"] == []
    assert body["total"] == 0
    assert body["totalRepaidPaisa"] == 0
    assert body["principalPaisa"] is None
    assert body["defaultRisk"] == {"daysOverdue": 0, "basis": "no_emi_schedule"}


# --------------------------------------------------------------------------- #
# P2-20 — bank-manager-scoped audit log read
# --------------------------------------------------------------------------- #


async def test_audit_logs_require_bank_manager_and_application_id(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    resp = await client.get(
        f"/v1/loans/audit-logs?applicationId={application_id}", headers=auth(farmer_token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

    resp = await client.get("/v1/loans/audit-logs", headers=auth(banker_token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    resp = await client.get(
        "/v1/loans/audit-logs?applicationId=unknown-application", headers=auth(banker_token)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOAN_NOT_FOUND"


async def test_audit_logs_filter_by_application_newest_first_and_paginate(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    first = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, first)
    await _approve(client, banker_token, first)
    await _disburse(client, banker_token, first)

    second = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, second)

    # review + approve + disburse (+ origination-fee row) audit the first loan.
    resp = await client.get(
        f"/v1/loans/audit-logs?applicationId={first}", headers=auth(banker_token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 4
    assert body["page"] == 1 and body["pageSize"] == 20
    assert all(row["loanId"] == first for row in body["data"])
    actions = {row["action"] for row in body["data"]}
    assert {"LOAN_REVIEW", "LOAN_APPROVE", "LOAN_DISBURSE", "LOAN_ORIGINATION_FEE"} <= actions
    timestamps = [row["timestamp"] for row in body["data"]]
    assert timestamps == sorted(timestamps, reverse=True)

    # The filter isolates the second application.
    resp = await client.get(
        f"/v1/loans/audit-logs?applicationId={second}", headers=auth(banker_token)
    )
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["action"] == "LOAN_REVIEW"
    assert body["data"][0]["adminId"] == BANKER_UID

    # Offset pagination across the audit rows of the first application.
    page_one = (
        await client.get(
            f"/v1/loans/audit-logs?applicationId={first}&page=1&pageSize=3",
            headers=auth(banker_token),
        )
    ).json()
    page_two = (
        await client.get(
            f"/v1/loans/audit-logs?applicationId={first}&page=2&pageSize=3",
            headers=auth(banker_token),
        )
    ).json()
    assert page_one["total"] == 4 and len(page_one["data"]) == 3
    assert len(page_two["data"]) == 1
    ids_page_one = {row.get("loanId") for row in page_one["data"]}
    assert page_two["data"][0]["loanId"] in ids_page_one


async def test_audit_logs_any_bank_manager_reads_accessible_application(client, user_store):
    """Access model parity with GET /loans/{id}: a bank manager reads logs for
    applications they can access (the queue is institution-wide, not per-seat)."""
    farmer_token = seed_user(user_store)
    _banker(user_store)
    other_banker = _banker(user_store, uid=OTHER_BANKER_UID)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, _banker(user_store), application_id)

    resp = await client.get(
        f"/v1/loans/audit-logs?applicationId={application_id}", headers=auth(other_banker)
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["action"] == "LOAN_REVIEW"
