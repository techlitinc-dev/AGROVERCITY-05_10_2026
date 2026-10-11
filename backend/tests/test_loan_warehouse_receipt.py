"""phase-03 task 5.13 — warehouse receipt attach (CreditDesk documents).

A bank officer can attach a warehouse receipt number as a collateral reference
document via POST /loans/{id}/documents (form field `reference_no`). The
applicant's file-upload path stays applicant-only and otherwise unchanged.
Follows the conftest fake-store fixtures; never weakens an existing assertion.
"""
from tests.test_diary import auth, seed_user

BANKER_UID = "uid-banker-1"
OTHER_FARMER_UID = "uid-farmer-2"

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 512


def _banker(user_store):
    return seed_user(user_store, uid=BANKER_UID, active_profile="bankManager", name="Anita Sharma")


async def _apply(client, token, **overrides):
    body = {"amount": 30000, "tenureMonths": 6, "purpose": "Seed purchase", **overrides}
    return await client.post("/v1/finance/loans/apply", json=body, headers=auth(token))


def _audits_of(user_store, action):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("audit_logs/") and doc.get("action") == action
    ]


def _fake_storage(monkeypatch):
    monkeypatch.setattr(
        "app.services.storage.upload_user_file",
        lambda uid, data, filename, content_type, prefix="vault": (
            f"{prefix}/{uid}/fake_{filename}",
            len(data),
        ),
    )


async def test_bank_manager_attaches_warehouse_receipt_reference(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    resp = await client.post(
        f"/v1/loans/{application_id}/documents",
        data={"reference_no": "WH-2026-001"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 201
    documents = resp.json()["documents"]
    assert len(documents) == 1
    receipt = documents[0]
    assert receipt["referenceNo"] == "WH-2026-001"
    assert receipt["name"] == "Warehouse Receipt"
    assert receipt["storagePath"] == f"warehouse-receipt/{application_id}/WH-2026-001"
    assert receipt["documentId"] and receipt["uploadedAt"]

    # Officer attach writes an audit_logs row (WS-03 rule 8).
    rows = _audits_of(user_store, "LOAN_WAREHOUSE_RECEIPT_ATTACH")
    assert len(rows) == 1
    assert rows[0]["adminId"] == BANKER_UID
    assert rows[0]["loanId"] == application_id
    assert rows[0]["detail"]["referenceNo"] == "WH-2026-001"

    # The reference document persists and is visible on the loan detail.
    loan = (await client.get(f"/v1/loans/{application_id}", headers=auth(banker_token))).json()
    assert loan["documents"][0]["referenceNo"] == "WH-2026-001"


async def test_receipt_attach_coexists_with_applicant_uploads(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    files = [("files", ("land_712.png", PNG_BYTES, "image/png"))]
    resp = await client.post(
        f"/v1/loans/{application_id}/documents",
        files=files,
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201
    assert resp.json()["documents"][0]["name"] == "land_712.png"

    resp = await client.post(
        f"/v1/loans/{application_id}/documents",
        data={"reference_no": "WH-2026-002"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 201
    documents = resp.json()["documents"]
    assert len(documents) == 2
    by_reference = [d for d in documents if d.get("referenceNo")]
    assert [d["referenceNo"] for d in by_reference] == ["WH-2026-002"]


async def test_officer_file_upload_still_forbidden_and_reference_requires_officer(
    client, user_store, monkeypatch
):
    _fake_storage(monkeypatch)
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    # Officers did not gain file-upload rights (unchanged from task 3.15 tests).
    files = [("files", ("doc.png", PNG_BYTES, "image/png"))]
    resp = await client.post(
        f"/v1/loans/{application_id}/documents", files=files, headers=auth(banker_token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

    # The applicant cannot attach a reference document either.
    resp = await client.post(
        f"/v1/loans/{application_id}/documents",
        data={"reference_no": "WH-2026-003"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

    # No documents were persisted by either rejected call.
    loan = (await client.get(f"/v1/loans/{application_id}", headers=auth(farmer_token))).json()
    assert loan["documents"] == []
    assert _audits_of(user_store, "LOAN_WAREHOUSE_RECEIPT_ATTACH") == []


async def test_documents_endpoint_requires_files_or_reference(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    resp = await client.post(
        f"/v1/loans/{application_id}/documents", headers=auth(farmer_token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    # A whitespace-only reference number counts as absent.
    resp = await client.post(
        f"/v1/loans/{application_id}/documents",
        data={"reference_no": "   "},
        headers=auth(banker_token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    assert _audits_of(user_store, "LOAN_WAREHOUSE_RECEIPT_ATTACH") == []


async def test_non_participant_cannot_attach_receipt(client, user_store):
    farmer_token = seed_user(user_store)
    _banker(user_store)
    other_token = seed_user(user_store, uid=OTHER_FARMER_UID, name="Sham Rao")
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    resp = await client.post(
        f"/v1/loans/{application_id}/documents",
        data={"reference_no": "WH-2026-004"},
        headers=auth(other_token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOAN_NOT_FOUND"
