from app.services.tokens import create_access_token

PERIOD = ("2026-09-28", "2026-10-04")


def _seed_settlement(user_store, net_rupees=1234, status="pending"):
    user_store["users/uid-1"] = {
        "id": "uid-1",
        "linkedProfiles": ["transport"],
        "primaryProfile": "transport",
        "activeProfile": "transport",
        "createdAt": "2026-09-01T00:00:00+00:00",
    }
    user_store[f"settlements/st_1"] = {
        "id": "st_1",
        "role": "transport",
        "entityId": "uid-1",
        "periodStart": PERIOD[0],
        "periodEnd": PERIOD[1],
        "status": status,
        "netRupees": net_rupees,
    }
    user_store["users/uid-1/bank_accounts/ba_1"] = {
        "id": "ba_1",
        "verifyStatus": "verified",
        "isPrimary": True,
        "razorpayFundAccountId": "fa_test_1",
        "createdAt": "2026-09-01T00:00:00+00:00",
    }


async def test_transport_settlement_executes_payout_and_records_row(client, user_store, monkeypatch):
    _seed_settlement(user_store)
    calls = []

    async def fake_payout(fund_account_id, amount_paise, reference_id):
        calls.append((fund_account_id, amount_paise, reference_id))
        return {"id": "po_test_1", "status": "processed"}

    monkeypatch.setattr("app.services.settlements.create_razorpayx_payout", fake_payout)

    resp = await client.post(
        "/v1/jobs/settlements/payouts",
        json={"periodStart": PERIOD[0], "periodEnd": PERIOD[1]},
    )
    assert resp.status_code == 200
    assert resp.json()["paid"] == 1
    # integer paisa: ₹1234 -> 123400
    assert calls == [("fa_test_1", 123400, "settle_st_1")]
    doc = user_store["settlements/st_1"]
    assert doc["status"] == "paid"
    assert doc["payoutStatus"] == "paid"
    assert doc["payoutRef"] == "po_test_1"


async def test_unverified_bank_account_goes_on_hold(client, user_store, monkeypatch):
    _seed_settlement(user_store)
    user_store["users/uid-1/bank_accounts/ba_1"]["verifyStatus"] = "pending"
    calls = []

    async def fake_payout(fund_account_id, amount_paise, reference_id):
        calls.append(reference_id)
        return {"id": "po_test_1"}

    monkeypatch.setattr("app.services.settlements.create_razorpayx_payout", fake_payout)

    resp = await client.post(
        "/v1/jobs/settlements/payouts",
        json={"periodStart": PERIOD[0], "periodEnd": PERIOD[1]},
    )
    assert resp.status_code == 200
    assert resp.json()["onHold"] == 1
    assert calls == []
    doc = user_store["settlements/st_1"]
    assert doc["payoutStatus"] == "onHold"
    assert doc["payoutHoldReason"] == "no verified bank account"


async def test_payout_writes_audit_log_entry(client, user_store, monkeypatch):
    _seed_settlement(user_store)

    async def fake_payout(fund_account_id, amount_paise, reference_id):
        return {"id": "po_test_1", "status": "processed"}

    monkeypatch.setattr("app.services.settlements.create_razorpayx_payout", fake_payout)

    resp = await client.post(
        "/v1/jobs/settlements/payouts",
        json={"periodStart": PERIOD[0], "periodEnd": PERIOD[1]},
    )
    assert resp.status_code == 200
    audit = [
        doc
        for key, doc in user_store.items()
        if key.startswith("audit_logs/") and doc.get("action") == "SETTLEMENT_PAYOUT"
    ]
    assert len(audit) == 1
    assert audit[0]["settlementId"] == "st_1"
    assert audit[0]["amountPaisa"] == 123400
    assert audit[0]["payoutRef"] == "po_test_1"
