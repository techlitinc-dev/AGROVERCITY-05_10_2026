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


# ---------------------------------------------------------------------------
# GET /transport/payouts — the transporter's own payout history (spec T9).
# ---------------------------------------------------------------------------

from tests.test_transport import _book, _token  # noqa: E402
from tests.test_users import _auth, _register  # noqa: E402


def _seed_profiled_user(user_store, uid, profiles):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "linkedProfiles": list(profiles),
        "primaryProfile": profiles[0],
        "activeProfile": profiles[0],
        "createdAt": "2026-09-01T00:00:00+00:00",
    }
    return create_access_token(uid)


async def test_transport_payouts_list_empty(client, user_store):
    token = await _token(client, profiles=("transport",), primary="transport")
    resp = await client.get("/v1/transport/payouts", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"data": [], "total": 0}


async def test_transport_payouts_list_newest_first_and_scoped(client, user_store):
    token = await _token(client, profiles=("transport",), primary="transport")
    user_store["transport_payouts/tpay_old"] = {
        "id": "tpay_old",
        "userId": "uid-1",
        "amountPaisa": 50000,
        "status": "processed",
        "razorpayPayoutId": "pout_old",
        "at": "2026-09-10T08:00:00+00:00",
    }
    user_store["transport_payouts/tpay_new"] = {
        "id": "tpay_new",
        "userId": "uid-1",
        "amountPaisa": 125000,
        "status": "processed",
        "razorpayPayoutId": "pout_new",
        "at": "2026-10-01T08:00:00+00:00",
    }
    user_store["transport_payouts/tpay_other"] = {
        "id": "tpay_other",
        "userId": "uid-2",
        "amountPaisa": 99900,
        "status": "processed",
        "razorpayPayoutId": "pout_other",
        "at": "2026-10-02T08:00:00+00:00",
    }

    resp = await client.get("/v1/transport/payouts", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert [row["id"] for row in body["data"]] == ["tpay_new", "tpay_old"]
    newest = body["data"][0]
    assert newest["amountPaisa"] == 125000
    assert newest["status"] == "processed"
    assert newest["razorpayPayoutId"] == "pout_new"  # UTR reference
    assert newest["createdAt"] == "2026-10-01T08:00:00+00:00"


async def test_transport_payouts_list_transporter_only(client, user_store):
    resp = await _register(client, profiles=["farmer"], primaryProfile="farmer")
    farmer_token = resp.json()["accessToken"]
    resp = await client.get("/v1/transport/payouts", headers=_auth(farmer_token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


# ---------------------------------------------------------------------------
# GET /transport/bookings/{id} — party check (booker / assigned transporter /
# fleet driver), everyone else 403.
# ---------------------------------------------------------------------------


async def test_booking_detail_party_check(client, user_store):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    booking = (await _book(client, farmer_token)).json()
    detail_url = f"/v1/transport/bookings/{booking['id']}"

    # booker reads fine
    resp = await client.get(detail_url, headers=_auth(farmer_token))
    assert resp.status_code == 200
    assert resp.json()["id"] == booking["id"]

    # an unrelated transporter is not a party while unassigned
    transporter_token = _seed_profiled_user(user_store, "uid-2", ("transport",))
    resp = await client.get(detail_url, headers=_auth(transporter_token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"

    # once assigned, the transporter reads fine
    user_store[f"transport_bookings/{booking['id']}"]["transporterId"] = "uid-2"
    resp = await client.get(detail_url, headers=_auth(transporter_token))
    assert resp.status_code == 200

    # a driver of the transporter's fleet reads fine (fleetOwnerId, POST /drivers)
    user_store["users/drv_1"] = {
        "id": "drv_1",
        "linkedProfiles": ["driver"],
        "primaryProfile": "driver",
        "activeProfile": "driver",
        "fleetOwnerId": "uid-2",
        "createdAt": "2026-09-01T00:00:00+00:00",
    }
    driver_token = create_access_token("drv_1")
    resp = await client.get(detail_url, headers=_auth(driver_token))
    assert resp.status_code == 200

    # a driver from a different fleet is still a stranger
    user_store["users/drv_2"] = {
        "id": "drv_2",
        "linkedProfiles": ["driver"],
        "primaryProfile": "driver",
        "activeProfile": "driver",
        "fleetOwnerId": "uid-9",
        "createdAt": "2026-09-01T00:00:00+00:00",
    }
    stranger_driver = create_access_token("drv_2")
    resp = await client.get(detail_url, headers=_auth(stranger_driver))
    assert resp.status_code == 403

    # an unrelated farmer is not a party either
    farmer2_token = _seed_profiled_user(user_store, "uid-3", ("farmer",))
    resp = await client.get(detail_url, headers=_auth(farmer2_token))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# FT-6: an insured booking's fare order amounts to fare + insurance premium.
# ---------------------------------------------------------------------------


async def test_insured_booking_order_amount_includes_premium(client, user_store, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "razorpay_key_secret", "rzp_test_secret")
    token = await _token(client, profiles=("farmer",), primary="farmer")
    booking = (
        await _book(client, token, insuranceOptIn=True, declaredValuePaisa=100000)
    ).json()
    insurance = booking["insurance"]
    assert insurance["optIn"] is True
    # premium = ceil(coverage × 0.8%): ceil(100000 × 0.8 / 100) = 800 paisa
    assert insurance["premiumPaisa"] == 800

    # order mode → amount is fare + premium
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/payments", json={}, headers=_auth(token)
    )
    assert resp.status_code == 200
    order = resp.json()
    assert order["amountPaisa"] == booking["fare"] * 100 + insurance["premiumPaisa"]

    # capture → the payment record notes the premium split; escrow holds fare+premium
    import hashlib
    import hmac

    payment_id = "pay_ins_1"
    signature = hmac.new(
        b"rzp_test_secret", f"{order['orderId']}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/payments",
        json={
            "razorpayOrderId": order["orderId"],
            "razorpayPaymentId": payment_id,
            "razorpaySignature": signature,
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200
    payment = resp.json()["payment"]
    assert payment["amountPaisa"] == booking["fare"] * 100 + insurance["premiumPaisa"]
    assert payment["insurancePremiumPaisa"] == insurance["premiumPaisa"]
    assert payment["farePaisa"] == booking["fare"] * 100
    assert resp.json()["escrow"]["amountPaisa"] == payment["amountPaisa"]


async def test_uninsured_booking_order_amount_is_fare_only(client, user_store):
    token = await _token(client, profiles=("farmer",), primary="farmer")
    booking = (await _book(client, token)).json()
    assert booking["insurance"] is None
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/payments", json={}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["amountPaisa"] == booking["fare"] * 100
