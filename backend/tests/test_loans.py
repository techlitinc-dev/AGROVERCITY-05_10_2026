from tests.test_diary import auth, seed_user

BANKER_UID = "uid-banker-1"
OTHER_FARMER_UID = "uid-farmer-2"

BANK_ACCOUNT = {
    "id": "ba-1",
    "accountHolder": "Ram Patil",
    "accountNumber": "50100234567890",
    "ifsc": "HDFC0001234",
    "bankName": "HDFC Bank",
    "isPrimary": True,
    "verifyStatus": "verified",
    "createdAt": "2026-09-20T00:00:00+00:00",
}

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 512


def _banker(user_store):
    return seed_user(user_store, uid=BANKER_UID, active_profile="bankManager", name="Anita Sharma")


async def _apply(client, token, **overrides):
    body = {"amount": 30000, "tenureMonths": 6, "purpose": "Seed purchase", **overrides}
    return await client.post("/v1/finance/loans/apply", json=body, headers=auth(token))


async def _review(client, banker_token, application_id):
    return await client.post(
        f"/v1/loans/{application_id}/review", headers=auth(banker_token)
    )


def _notifications_for(user_store, uid):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == uid
    ]


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
        lambda blob_path, minutes=60: f"https://storage.example.com/{blob_path}?sig=x",
    )


async def test_apply_snapshots_application_number_timeline_and_credit(client, user_store):
    token = seed_user(user_store)
    resp = await _apply(client, token)
    assert resp.status_code == 201
    body = resp.json()
    assert body["applicationId"]
    assert body["status"] == "submitted"

    resp = await client.get("/v1/finance/loans", headers=auth(token))
    assert resp.status_code == 200
    envelope = resp.json()
    assert envelope["page"] == 1 and envelope["pageSize"] == 20 and envelope["total"] == 1
    loan = envelope["data"][0]
    assert loan["applicationNumber"].startswith("LN-2026-")
    assert loan["userId"] == "uid-1"
    assert loan["farmerName"] == "Ram Patil"
    assert loan["farmerPhone"] == "+919812345678"
    assert loan["farmerCreditScore"] == 650
    assert loan["farmerCreditTier"] == "Gold"
    assert loan["status"] == "submitted"
    assert loan["documents"] == []
    assert loan["timeline"][0]["status"] == "submitted"
    assert loan["timeline"][0]["statusText"]
    assert loan["timeline"][0]["by"] == "uid-1"


async def test_apply_with_bank_account_copies_last4_and_ifsc(client, user_store):
    token = seed_user(user_store)
    user_store["users/uid-1/bank_accounts/ba-1"] = dict(BANK_ACCOUNT)
    resp = await _apply(client, token, bankAccountId="ba-1")
    assert resp.status_code == 201
    loan = (await client.get("/v1/finance/loans", headers=auth(token))).json()["data"][0]
    assert loan["bankAccountId"] == "ba-1"
    assert loan["bankAccountLast4"] == "7890"
    assert loan["bankIfsc"] == "HDFC0001234"


async def test_apply_with_unknown_bank_account_404(client, user_store):
    token = seed_user(user_store)
    resp = await _apply(client, token, bankAccountId="nope")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "BANK_ACCOUNT_NOT_FOUND"


async def test_queue_requires_bank_manager(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/loans/queue", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_queue_lists_with_search_status_filter_and_envelope(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    await _apply(client, farmer_token)

    resp = await client.get("/v1/loans/queue", headers=auth(banker_token))
    assert resp.status_code == 200
    envelope = resp.json()
    assert envelope["total"] == 1
    assert envelope["page"] == 1 and envelope["pageSize"] == 20
    assert envelope["data"][0]["applicationNumber"].startswith("LN-2026-")

    resp = await client.get("/v1/loans/queue?q=ram", headers=auth(banker_token))
    assert resp.json()["total"] == 1
    resp = await client.get("/v1/loans/queue?q=zzz", headers=auth(banker_token))
    assert resp.json()["total"] == 0
    number = envelope["data"][0]["applicationNumber"]
    resp = await client.get(f"/v1/loans/queue?q={number}", headers=auth(banker_token))
    assert resp.json()["total"] == 1

    resp = await client.get("/v1/loans/queue?status=submitted", headers=auth(banker_token))
    assert resp.json()["total"] == 1
    resp = await client.get("/v1/loans/queue?status=approved", headers=auth(banker_token))
    assert resp.json()["total"] == 0


async def test_full_lifecycle_review_approve_disburse(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    resp = await _review(client, banker_token, application_id)
    assert resp.status_code == 200
    loan = resp.json()
    assert loan["status"] == "underReview"
    assert loan["assignedOfficerId"] == BANKER_UID
    assert loan["assignedOfficerName"] == "Anita Sharma"
    assert loan["timeline"][-1]["statusText"]
    assert loan["timeline"][-1]["by"] == BANKER_UID

    resp = await client.post(
        f"/v1/loans/{application_id}/approve",
        json={"sanctionedAmount": 30000, "interestRate": 12, "tenureMonths": 6},
        headers=auth(banker_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
    assert resp.json()["sanctionedAmount"] == 30000

    resp = await client.post(
        f"/v1/loans/{application_id}/disburse",
        json={"disbursementRef": "UTR2026HB000123"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 200
    loan = resp.json()
    assert loan["status"] == "disbursed"
    assert loan["disbursementRef"] == "UTR2026HB000123"
    assert loan["disbursedAt"]
    assert loan["timeline"][-1]["status"] == "disbursed"

    mine = (await client.get("/v1/finance/loans", headers=auth(farmer_token))).json()
    assert mine["total"] == 1
    statuses = [e["status"] for e in mine["data"][0]["timeline"]]
    assert statuses == ["submitted", "underReview", "approved", "disbursed"]
    assert mine["data"][0]["status"] == "disbursed"

    resp = await client.get(f"/v1/loans/{application_id}", headers=auth(farmer_token))
    assert resp.status_code == 200
    assert resp.json()["sanctionedAmount"] == 30000

    notifications = _notifications_for(user_store, "uid-1")
    assert len(notifications) == 3


async def test_info_request_and_respond_round_trip(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, application_id)

    resp = await client.post(
        f"/v1/loans/{application_id}/info-request",
        json={"message": "कृपया 7/12 की प्रति अपलोड करें"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "infoRequested"
    assert resp.json()["note"] == "कृपया 7/12 की प्रति अपलोड करें"

    resp = await client.post(
        f"/v1/loans/{application_id}/respond",
        json={"message": "दस्तावेज़ अपलोड कर दिए हैं"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "underReview"
    assert resp.json()["timeline"][-1]["by"] == "uid-1"


async def test_cancel_from_submitted(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    resp = await client.post(f"/v1/loans/{application_id}/cancel", headers=auth(farmer_token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    queue = await client.get("/v1/loans/queue?status=cancelled", headers=auth(banker_token))
    assert queue.json()["total"] == 1


async def test_reject_with_reason(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, application_id)
    resp = await client.post(
        f"/v1/loans/{application_id}/reject",
        json={"reason": "क्रेडिट स्कोर अपर्याप्त"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
    assert resp.json()["rejectionReason"] == "क्रेडिट स्कोर अपर्याप्त"


async def test_invalid_transitions_409(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)

    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    resp = await client.post(
        f"/v1/loans/{application_id}/approve",
        json={"sanctionedAmount": 30000, "interestRate": 12, "tenureMonths": 6},
        headers=auth(banker_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOAN_INVALID_TRANSITION"
    assert "submitted" in resp.json()["error"]["message"]

    resp = await client.post(
        f"/v1/loans/{application_id}/respond",
        json={"message": "hello"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 409

    await _review(client, banker_token, application_id)
    resp = await client.post(
        f"/v1/loans/{application_id}/disburse",
        json={"disbursementRef": "UTR1"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 409

    application_id_2 = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, application_id_2)
    await client.post(
        f"/v1/loans/{application_id_2}/approve",
        json={"sanctionedAmount": 10000, "interestRate": 10, "tenureMonths": 3},
        headers=auth(banker_token),
    )
    await client.post(
        f"/v1/loans/{application_id_2}/disburse",
        json={"disbursementRef": "UTR2"},
        headers=auth(banker_token),
    )
    resp = await _review(client, banker_token, application_id_2)
    assert resp.status_code == 409


async def test_acl_banker_mutations_and_farmer_ownership(client, user_store):
    farmer_token = seed_user(user_store)
    other_token = seed_user(user_store, uid=OTHER_FARMER_UID)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, application_id)

    resp = await client.post(
        f"/v1/loans/{application_id}/approve",
        json={"sanctionedAmount": 30000, "interestRate": 12, "tenureMonths": 6},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 403

    resp = await client.post(
        f"/v1/loans/{application_id}/info-request",
        json={"message": "docs please"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 200
    resp = await client.post(
        f"/v1/loans/{application_id}/respond",
        json={"message": "here"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 403

    resp = await client.get(f"/v1/loans/{application_id}", headers=auth(other_token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOAN_NOT_FOUND"
    resp = await client.post(f"/v1/loans/{application_id}/cancel", headers=auth(other_token))
    assert resp.status_code == 404


async def test_schedule_uses_requested_terms_then_approved_terms(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]

    resp = await client.get(f"/v1/loans/{application_id}/schedule", headers=auth(farmer_token))
    assert resp.status_code == 200
    entries = resp.json()["data"]
    assert len(entries) == 6
    assert [e["installmentNo"] for e in entries] == [1, 2, 3, 4, 5, 6]
    assert sum(e["principal"] for e in entries) == 30000
    assert entries[-1]["outstanding"] == 0
    assert all(e["dueDate"].endswith("-01") for e in entries)

    await _review(client, banker_token, application_id)
    await client.post(
        f"/v1/loans/{application_id}/approve",
        json={"sanctionedAmount": 24000, "interestRate": 10, "tenureMonths": 4},
        headers=auth(banker_token),
    )
    resp = await client.get(f"/v1/loans/{application_id}/schedule", headers=auth(farmer_token))
    entries = resp.json()["data"]
    assert len(entries) == 4
    assert sum(e["principal"] for e in entries) == 24000
    assert entries[-1]["outstanding"] == 0

    resp = await client.get(f"/v1/loans/{application_id}/schedule", headers=auth(banker_token))
    assert resp.status_code == 200


async def test_stats_counts(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    first = (await _apply(client, farmer_token)).json()["applicationId"]
    await _apply(client, farmer_token)
    await _review(client, banker_token, first)
    await client.post(
        f"/v1/loans/{first}/approve",
        json={"sanctionedAmount": 30000, "interestRate": 12, "tenureMonths": 6},
        headers=auth(banker_token),
    )

    resp = await client.get("/v1/loans/stats", headers=auth(banker_token))
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["totalApplications"] == 2
    assert stats["byStatus"] == {"submitted": 1, "approved": 1}
    assert stats["totalRequestedAmount"] == 60000
    assert stats["totalSanctionedAmount"] == 30000
    assert stats["pendingReview"] == 1


async def test_farmer_cannot_read_stats(client, user_store):
    farmer_token = seed_user(user_store)
    resp = await client.get("/v1/loans/stats", headers=auth(farmer_token))
    assert resp.status_code == 403


async def test_document_upload_appends_entries(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    farmer_token = seed_user(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    files = [
        ("files", ("land_712.png", PNG_BYTES, "image/png")),
        ("files", ("kyc.pdf", b"%PDF-1.4 fake", "application/pdf")),
    ]
    resp = await client.post(
        f"/v1/loans/{application_id}/documents",
        files=files,
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201
    documents = resp.json()["documents"]
    assert len(documents) == 2
    assert documents[0]["name"] == "land_712.png"
    assert documents[0]["storagePath"].startswith("loandocs/uid-1/")
    assert all(d["documentId"] and d["uploadedAt"] for d in documents)

    loan = (await client.get(f"/v1/loans/{application_id}", headers=auth(farmer_token))).json()
    assert len(loan["documents"]) == 2


async def test_document_upload_by_banker_403_and_wrong_type_415(
    client, user_store, monkeypatch
):
    _fake_storage(monkeypatch)
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    files = [("files", ("doc.png", PNG_BYTES, "image/png"))]
    resp = await client.post(
        f"/v1/loans/{application_id}/documents", files=files, headers=auth(banker_token)
    )
    assert resp.status_code == 403

    bad = [("files", ("notes.txt", b"hello", "text/plain"))]
    resp = await client.post(
        f"/v1/loans/{application_id}/documents", files=bad, headers=auth(farmer_token)
    )
    assert resp.status_code == 415


async def test_audit_logs_written_for_banker_mutations(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, application_id)

    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert len(audits) == 1
    assert audits[0]["action"] == "LOAN_REVIEW"
    assert audits[0]["adminId"] == BANKER_UID
    assert audits[0]["loanId"] == application_id


async def test_quick_login_bank_manager_persona(client, user_store):
    resp = await client.post("/v1/auth/quick-login", json={"persona": "bankManager", "mpin": "9876"})
    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["activeProfile"] == "bankManager"
    assert "bankManager" in user["linkedProfiles"]


async def test_info_request_emits_farmer_task(client, user_store):
    """WS-05 task 5.24 — a bank document request surfaces as a farmer task."""
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, application_id)

    resp = await client.post(
        f"/v1/loans/{application_id}/info-request",
        json={"message": "कृपया 7/12 की प्रति अपलोड करें"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 200

    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 1
    task = tasks[0]
    assert task["module"] == "loans"
    assert task["kind"] == "loan_doc_request"
    assert task["userId"] == "uid-1"
    assert task["sourceId"] == application_id
    assert task["deepLink"].startswith("/dashboard/p/")
