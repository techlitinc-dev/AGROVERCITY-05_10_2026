"""WS-03 CreditDesk web tests — queue filters + cursor pagination, audit rows
for every banker decision, disburse + EMI schedule, and the farmer mirror
(status visibility, doc-request task emission + resolution).

Test file added by phase-03 task 3.15/3.16. Follows the conftest fake-store
fixtures; never weakens an existing assertion.
"""
from tests.test_diary import auth, seed_user

BANKER_UID = "uid-banker-1"


def _banker(user_store):
    return seed_user(user_store, uid=BANKER_UID, active_profile="bankManager", name="Anita Sharma")


async def _apply(client, token, **overrides):
    body = {"amount": 30000, "tenureMonths": 6, "purpose": "Seed purchase", **overrides}
    return await client.post("/v1/finance/loans/apply", json=body, headers=auth(token))


async def _review(client, banker_token, application_id):
    return await client.post(f"/v1/loans/{application_id}/review", headers=auth(banker_token))


async def _approve(client, banker_token, application_id, **overrides):
    body = {"sanctionedAmount": 30000, "interestRate": 12, "tenureMonths": 6, **overrides}
    return await client.post(f"/v1/loans/{application_id}/approve", json=body, headers=auth(banker_token))


def _audits(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("audit_logs/")]


def _audits_of(user_store, action):
    return [a for a in _audits(user_store) if a.get("action") == action]


# --------------------------------------------------------------------------- #
# Task 3.15 — queue filters + cursor pagination + audit rows
# --------------------------------------------------------------------------- #


async def test_queue_filters_status_amount_and_district(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    await _apply(client, farmer_token, amount=30000, district="Pune")
    await _apply(client, farmer_token, amount=90000, district="Nashik")
    await _apply(client, farmer_token, amount=50000, district="Pune")

    resp = await client.get("/v1/loans/queue", headers=auth(banker_token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 3

    resp = await client.get("/v1/loans/queue?status=submitted", headers=auth(banker_token))
    assert resp.json()["total"] == 3
    resp = await client.get("/v1/loans/queue?status=approved", headers=auth(banker_token))
    assert resp.json()["total"] == 0

    resp = await client.get("/v1/loans/queue?minAmount=40000&maxAmount=60000", headers=auth(banker_token))
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["amount"] == 50000

    resp = await client.get("/v1/loans/queue?district=Pune", headers=auth(banker_token))
    body = resp.json()
    assert body["total"] == 2
    assert all(row["district"] == "Pune" for row in body["data"])

    resp = await client.get("/v1/loans/queue?district=Nowhere", headers=auth(banker_token))
    assert resp.json()["total"] == 0


async def test_queue_cursor_pagination_returns_next_page(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    for amount in (30000, 40000, 50000):
        await _apply(client, farmer_token, amount=amount)

    first = (await client.get("/v1/loans/queue?pageSize=2", headers=auth(banker_token))).json()
    assert len(first["data"]) == 2
    assert first["nextCursor"]
    assert first["total"] == 3

    second = (
        await client.get(f"/v1/loans/queue?pageSize=2&cursor={first['nextCursor']}", headers=auth(banker_token))
    ).json()
    assert len(second["data"]) == 1
    assert second["nextCursor"] is None

    first_ids = {row["applicationId"] for row in first["data"]}
    second_ids = {row["applicationId"] for row in second["data"]}
    assert first_ids.isdisjoint(second_ids)
    assert len(first_ids | second_ids) == 3


async def test_invalid_cursor_returns_400_envelope(client, user_store):
    seed_user(user_store)
    banker_token = _banker(user_store)
    resp = await client.get("/v1/loans/queue?cursor=not-a-cursor", headers=auth(banker_token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_CURSOR"


async def test_every_decision_writes_audit_row_with_actor_action_reason(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)

    reviewed = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, reviewed)

    approved = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, approved)
    await _approve(client, banker_token, approved, note="किसान का रिकॉर्ड अच्छा है")

    rejected = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, rejected)
    await client.post(
        f"/v1/loans/{rejected}/reject",
        json={"reason": "क्रेडिट स्कोर अपर्याप्त"},
        headers=auth(banker_token),
    )

    info = (await _apply(client, farmer_token)).json()["applicationId"]
    await _review(client, banker_token, info)
    await client.post(
        f"/v1/loans/{info}/info-request",
        json={"message": "कृपया 7/12 की प्रति अपलोड करें"},
        headers=auth(banker_token),
    )

    review_rows = _audits_of(user_store, "LOAN_REVIEW")
    approve_rows = _audits_of(user_store, "LOAN_APPROVE")
    reject_rows = _audits_of(user_store, "LOAN_REJECT")
    info_rows = _audits_of(user_store, "LOAN_INFO_REQUEST")
    assert len(review_rows) == 4
    assert len(approve_rows) == 1
    assert len(reject_rows) == 1
    assert len(info_rows) == 1

    for row in review_rows + approve_rows + reject_rows + info_rows:
        assert row["adminId"] == BANKER_UID
        assert row["loanId"]

    assert approve_rows[0]["reason"] == "किसान का रिकॉर्ड अच्छा है"
    assert reject_rows[0]["reason"] == "क्रेडिट स्कोर अपर्याप्त"
    assert info_rows[0]["reason"] == "कृपया 7/12 की प्रति अपलोड करें"


# --------------------------------------------------------------------------- #
# Task 3.16 — disburse + schedule + farmer mirror + task engine
# --------------------------------------------------------------------------- #


async def test_disburse_schedule_fee_and_farmer_mirror(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    application_id = (await _apply(client, farmer_token, amount=30000, partnerBankId="bank-hdfc")).json()[
        "applicationId"
    ]

    await _review(client, banker_token, application_id)
    await _approve(client, banker_token, application_id, sanctionedAmount=24000, tenureMonths=4)

    # Farmer mirror sees the status change through his own endpoints.
    mine = (await client.get("/v1/finance/loans", headers=auth(farmer_token))).json()
    assert mine["data"][0]["status"] == "approved"

    resp = await client.post(
        f"/v1/loans/{application_id}/disburse",
        json={"disbursementRef": "UTR2026HB000123"},
        headers=auth(banker_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "disbursed"

    # Full EMI schedule (one entry per approved tenure month).
    schedule = (
        await client.get(f"/v1/loans/{application_id}/schedule", headers=auth(farmer_token))
    ).json()["data"]
    assert len(schedule) == 4
    assert [e["installmentNo"] for e in schedule] == [1, 2, 3, 4]
    assert schedule[-1]["outstanding"] == 0

    # Farmer mirror: every stage is visible with the applicant's own access.
    loan = (await client.get(f"/v1/loans/{application_id}", headers=auth(farmer_token))).json()
    assert loan["status"] == "disbursed"
    statuses = [entry["status"] for entry in loan["timeline"]]
    assert statuses == ["submitted", "underReview", "approved", "disbursed"]

    # Origination-fee ledger entry + audit row (task 3.9).
    assert any(key.startswith("settlements/orig_") for key in user_store)
    assert len(_audits_of(user_store, "LOAN_ORIGINATION_FEE")) == 1

    # EMI reminders scheduled per installment (task 3.12), one per installment.
    reminders = [key for key in user_store if key.startswith("users/uid-1/loan_emi_reminders/")]
    assert len(reminders) == 4


async def test_info_request_emits_and_respond_resolves_task(client, user_store):
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
    assert task["userId"] == "uid-1"
    assert task["persona"] == "farmer"
    assert task["module"] == "loans"
    assert task["kind"] == "loan_doc_request"
    assert task["status"] == "open"
    assert task["deepLink"] == "/dashboard/p/loanTracking"
    assert task["title"]["en"] and task["title"]["hi"]

    resp = await client.post(
        f"/v1/loans/{application_id}/respond",
        json={"message": "दस्तावेज़ अपलोड कर दिए हैं"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "underReview"
    assert user_store[f"tasks/{task['taskId']}"]["status"] == "done"
