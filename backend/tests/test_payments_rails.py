import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from tests.test_diary import auth, seed_user

WEBHOOK_SECRET = "whsec_test"


def _sign_body(body: bytes, secret: str = WEBHOOK_SECRET) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _razorpay_configured(monkeypatch):
    monkeypatch.setattr(settings, "razorpay_key_id", "rzp_test_key")
    monkeypatch.setattr(settings, "razorpay_key_secret", "rzp_test_secret")

    def fake_create_order(amount_paise, receipt):
        return {"id": f"order_test_{receipt}", "amount": amount_paise, "currency": "INR", "status": "created"}

    monkeypatch.setattr("app.routers.payments.create_razorpay_order", fake_create_order)


# ---------------- Webhook ----------------


async def test_webhook_signature_good_and_bad(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_webhook_secret", WEBHOOK_SECRET)
    body = b'{"id":"evt_1","event":"payment.captured"}'
    bad = await client.post(
        "/v1/payments/webhook", content=body, headers={"X-Razorpay-Signature": "bad"}
    )
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "WEBHOOK_SIGNATURE_INVALID"
    good = await client.post(
        "/v1/payments/webhook", content=body, headers={"X-Razorpay-Signature": _sign_body(body)}
    )
    assert good.status_code == 200
    assert good.json()["ok"] is True
    assert "payment_events/evt_1" in user_store


async def test_webhook_ignores_unset_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_webhook_secret", "")
    body = b'{"id":"evt_nosec","event":"payment.captured"}'
    resp = await client.post(
        "/v1/payments/webhook", content=body, headers={"X-Razorpay-Signature": "anything"}
    )
    assert resp.status_code == 401


async def test_webhook_replay_is_idempotent(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_webhook_secret", WEBHOOK_SECRET)
    body = b'{"id":"evt_dup","event":"payment.captured"}'
    headers = {"X-Razorpay-Signature": _sign_body(body)}
    first = await client.post("/v1/payments/webhook", content=body, headers=headers)
    assert first.json()["duplicate"] is False
    second = await client.post("/v1/payments/webhook", content=body, headers=headers)
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
    events = [k for k in user_store if k.startswith("payment_events/")]
    assert events == ["payment_events/evt_dup"]


# ---------------- Order / verify / refund ----------------


async def test_payment_order_requires_configured_key(client, user_store):
    token = seed_user(user_store, uid="uid-nokey")
    resp = await client.post(
        "/v1/payments/order",
        json={"amountPaisa": 1000, "purpose": "purchase", "refId": "pur_1"},
        headers=auth(token),
    )
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "PAYMENTS_NOT_CONFIGURED"


async def test_payment_order_idempotent_and_verify(client, user_store, monkeypatch):
    _razorpay_configured(monkeypatch)
    token = seed_user(user_store, uid="uid-pay")
    body = {"amountPaisa": 150000, "purpose": "purchase", "refId": "pur_1"}
    headers = {**auth(token), "Idempotency-Key": "idem-1"}

    resp = await client.post("/v1/payments/order", json=body, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["amountPaisa"] == 150000
    order_id = data["razorpayOrderId"]

    replay = await client.post("/v1/payments/order", json=body, headers=headers)
    assert replay.json() == data
    payments = [k for k in user_store if k.startswith("payments/")]
    assert len(payments) == 1

    signature = hmac.new(
        b"rzp_test_secret", f"{order_id}|pay_1".encode(), hashlib.sha256
    ).hexdigest()
    verified = await client.post(
        "/v1/payments/verify",
        json={
            "razorpayOrderId": order_id,
            "razorpayPaymentId": "pay_1",
            "razorpaySignature": signature,
        },
        headers=auth(token),
    )
    assert verified.status_code == 200
    assert verified.json()["status"] == "paid"
    # idempotent re-verify
    again = await client.post(
        "/v1/payments/verify",
        json={
            "razorpayOrderId": order_id,
            "razorpayPaymentId": "pay_1",
            "razorpaySignature": signature,
        },
        headers=auth(token),
    )
    assert again.json()["status"] == "paid"


async def test_payment_verify_bad_signature(client, user_store, monkeypatch):
    _razorpay_configured(monkeypatch)
    token = seed_user(user_store, uid="uid-badsig")
    ot = await client.post(
        "/v1/payments/order",
        json={"amountPaisa": 5000, "purpose": "purchase", "refId": "pur_2"},
        headers={**auth(token), "Idempotency-Key": "idem-2"},
    )
    resp = await client.post(
        "/v1/payments/verify",
        json={
            "razorpayOrderId": ot.json()["razorpayOrderId"],
            "razorpayPaymentId": "pay_2",
            "razorpaySignature": "wrong",
        },
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "PAYMENT_SIGNATURE_INVALID"


async def test_refund_requires_admin_headers_and_reason(client, user_store, monkeypatch):
    async def fake_refund(payment_id, amount_paise):
        return {"id": "rfnd_1", "status": "processed"}

    monkeypatch.setattr("app.routers.payments.refund_razorpay_payment", fake_refund)
    user_store["payments/pay_ref"] = {
        "id": "pay_ref",
        "userId": "uid-1",
        "amountPaisa": 1000,
        "razorpayOrderId": "o1",
        "razorpayPaymentId": "p1",
        "status": "paid",
    }
    missing_reason = await client.post(
        "/v1/payments/pay_ref/refund",
        json={"reason": "bad"},
        headers={"Authorization": "Bearer admin-token"},
    )
    assert missing_reason.status_code == 400
    assert missing_reason.json()["error"]["code"] == "AUDIT_REASON_REQUIRED"

    ok = await client.post(
        "/v1/payments/pay_ref/refund",
        json={"reason": "customer request"},
        headers={
            "Authorization": "Bearer admin-token",
            "X-Admin-Role": "superadmin",
            "X-Audit-Reason": "test reason",
        },
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "refunded"
    assert user_store["payments/pay_ref"]["status"] == "refunded"
    audits = [k for k in user_store if k.startswith("audit_logs/")]
    assert any(user_store[k].get("action") == "PAYMENT_REFUND" for k in audits)


# ---------------- Escrow release clock ----------------


def _seed_escrow(user_store, purchase_id, *, release_minutes, disputed=False):
    now = datetime.now(timezone.utc)
    user_store[f"purchases/{purchase_id}"] = {
        "id": purchase_id,
        "buyerId": "uid-b",
        "farmerId": "uid-f",
        "totalAmount": 10000,
        "finalAmount": 10000,
        "status": "completed",
        "events": [],
        "escrow": {
            "status": "held",
            "amount": 10000,
            "releaseAt": (now + timedelta(minutes=release_minutes)).isoformat(),
            "disputeOpenedAt": now.isoformat() if disputed else None,
            "disputeResolvedAt": None,
            "releasedAt": None,
        },
    }


async def test_escrow_release_waits_for_window(client, user_store):
    _seed_escrow(user_store, "pur_wait", release_minutes=60)
    resp = await client.post("/v1/jobs/escrow/release-due")
    assert resp.status_code == 200
    assert resp.json()["released"] == 0
    assert resp.json()["pending"] == 1
    assert user_store["purchases/pur_wait"]["escrow"]["status"] == "held"

    user_store["purchases/pur_wait"]["escrow"]["releaseAt"] = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    ).isoformat()
    resp = await client.post("/v1/jobs/escrow/release-due")
    assert resp.json()["released"] == 1
    escrow = user_store["purchases/pur_wait"]["escrow"]
    assert escrow["status"] == "released"
    assert escrow["commission"] == 200
    assert escrow["netRelease"] == 9800


async def test_escrow_dispute_pauses_release(client, user_store):
    _seed_escrow(user_store, "pur_disputed", release_minutes=-5, disputed=True)
    resp = await client.post("/v1/jobs/escrow/release-due")
    assert resp.status_code == 200
    assert resp.json()["paused"] == 1
    assert resp.json()["released"] == 0
    assert user_store["purchases/pur_disputed"]["escrow"]["status"] == "held"


# ---------------- Payouts (onHold) ----------------


def _seed_settlement(user_store, entity_id="uid-t1"):
    user_store["settlements/st_transport_uid-t1_2026-09-07"] = {
        "id": "st_transport_uid-t1_2026-09-07",
        "role": "transport",
        "entityId": entity_id,
        "periodStart": "2026-09-07",
        "periodEnd": "2026-09-13",
        "grossRupees": 2000,
        "commissionRupees": 200,
        "netRupees": 1800,
        "status": "pending",
        "sourceIds": [],
        "createdAt": "2026-09-14T00:00:00+00:00",
    }


PERIOD = {"periodStart": "2026-09-07", "periodEnd": "2026-09-13"}


async def test_payout_holds_without_verified_bank(client, user_store):
    _seed_settlement(user_store)
    resp = await client.post("/v1/jobs/settlements/payouts", json=PERIOD)
    assert resp.status_code == 200
    assert resp.json()["paid"] == 0
    assert resp.json()["onHold"] == 1
    doc = user_store["settlements/st_transport_uid-t1_2026-09-07"]
    assert doc["payoutStatus"] == "onHold"
    assert doc["payoutHoldReason"] == "no verified bank account"
    assert doc["status"] == "pending"


async def test_payout_pays_verified_account(client, user_store):
    _seed_settlement(user_store)
    user_store["users/uid-t1/bank_accounts/ba_1"] = {
        "id": "ba_1",
        "verifyStatus": "verified",
        "isPrimary": True,
        "createdAt": "2026-09-01T00:00:00+00:00",
    }
    resp = await client.post("/v1/jobs/settlements/payouts", json=PERIOD)
    assert resp.status_code == 200
    assert resp.json()["paid"] == 1
    doc = user_store["settlements/st_transport_uid-t1_2026-09-07"]
    assert doc["status"] == "paid"
    assert doc["payoutStatus"] == "paid"
    assert doc["payoutRef"].startswith("pout_dev_")


# ---------------- TDS 194-O & commission invoices ----------------


async def test_tds_ledger_and_commission_invoice(client, user_store):
    user_store["vehicles/veh-t1"] = {"id": "veh-t1", "ownerId": "uid-t1"}
    user_store["transport_bookings/b-t1-0"] = {
        "id": "b-t1-0",
        "status": "delivered",
        "fare": 2000,
        "vehicleId": "veh-t1",
        "date": "2026-09-08",
    }
    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200

    tds = user_store["tds_ledger/tds_st_transport_uid-t1_2026-09-07"]
    assert tds["grossPaisa"] == 200000
    assert tds["tdsPaisa"] == 2000
    assert tds["section"] == "194-O"
    assert tds["period"] == "2026-09-07..2026-09-13"

    invoice = user_store["invoices/inv_st_transport_uid-t1_2026-09-07"]
    assert invoice["kind"] == "commission"
    assert invoice["commissionPaisa"] == 20000
    assert invoice["gstPaisa"] == 3600
    assert invoice["totalPaisa"] == 23600


# ---------------- Reconciliation ----------------


async def test_reconciliation_flags_discrepancies(client, user_store, monkeypatch):
    async def fake_remote():
        return [{"id": "pay_x", "order_id": "order_remote", "status": "captured"}]

    monkeypatch.setattr("app.routers.jobs.list_razorpay_payments", fake_remote)
    user_store["payments/pay_1"] = {
        "id": "pay_1",
        "razorpayOrderId": "order_local",
        "status": "created",
    }
    resp = await client.post("/v1/jobs/payments/reconcile")
    assert resp.status_code == 200
    body = resp.json()
    assert body["remoteChecked"] == 1
    assert body["localChecked"] == 1
    assert body["discrepancies"] == 2
    audits = [k for k in user_store if k.startswith("audit_logs/")]
    assert any(user_store[k].get("action") == "PAYMENT_RECONCILIATION" for k in audits)
