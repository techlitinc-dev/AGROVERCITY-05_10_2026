"""P0-12 / P0-13 / P1-28: payment-before-receipt, consultation-fee capture and
refund-on-cancel, and vet settlement → MPIN-gated payout.

Every test drives the real API end-to-end: donations/adoptions/appointments are
created through the existing endpoints, then paid and signature-verified. The
only test-only knob is `settings.razorpay_key_secret` (the repo pattern from
`test_payments_rails.py`): it lets the real `verify_razorpay_signature` HMAC
run against a known test secret while `create_razorpay_order` /
`create_razorpayx_payout` / `refund_razorpay_payment` keep their dev shims
(Razorpay key id stays unset).
"""
import hashlib
import hmac
from datetime import datetime, timezone

from app.core.config import settings
from app.core.security import hash_mpin
from tests.test_diary import auth, seed_user

RZP_TEST_SECRET = "rzp_test_secret"

VET_PHONE = "+91 98220 11998"

MANAGED_VET = {
    "name": "Dr. Test Kulkarni",
    "phone": VET_PHONE,
    "qualification": "M.V.Sc",
    "specializations": ["gynaecology"],
    "clinicAddress": "Niphad, Nashik",
    "experienceYears": 12,
    "feeClinic": 500,
    "feeFarm": 700,
    "feeTele": 300,
    "visitTypes": ["clinic", "farm", "tele"],
    "serviceDistricts": ["Nashik"],
    "languages": ["mr", "hi", "en"],
    "vetCouncilRegNo": "MVSC-2009-4421",
}

APPOINTMENT = {
    "visitType": "clinic",
    "slotDate": "2026-10-20",
    "slotTime": "10:00",
    "symptoms": "ताप व कास",
}

GAUSHALA_PROFILE = {
    "name": "Shrimant Panchvati Desi Gaushala",
    "trustName": "Shree Ram Panchavati Trust",
    "address": "Panchavati, Nashik",
    "district": "Nashik",
    "phone": "+91 98224 88771",
    "capacity": 50,
    "certifications": {"eightyG": True, "fcra": False, "awbi": True},
    "bankDetails": {"bankName": "SBI", "accountNo": "XXXXXX1234", "ifsc": "SBIN0021673"},
}

BANK_ACCOUNT = {
    "accountHolder": "Dr. Test Kulkarni",
    "accountNumber": "123456789012",
    "ifsc": "SBIN0123456",
    "bankName": "SBI",
}

CURRENT_PERIOD = datetime.now(timezone.utc).strftime("%Y-%m")


def enable_test_razorpay(monkeypatch):
    """Point settings at a known key secret so the real signature check runs;
    razorpay_key_id stays unset so the payment service dev shims engage."""
    monkeypatch.setattr(settings, "razorpay_key_secret", RZP_TEST_SECRET)


def sign_payment(order_id: str, payment_id: str) -> str:
    return hmac.new(
        RZP_TEST_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()


async def _setup_gaushala(client, user_store):
    mgr = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    resp = await client.post(
        "/v1/livestock/gaushala/profile", json=GAUSHALA_PROFILE, headers=auth(mgr)
    )
    assert resp.status_code == 201, resp.text
    farmer = seed_user(user_store, uid="farmer-1", active_profile="farmer")
    return mgr, farmer, resp.json()


async def _setup_vet(client, user_store):
    mgr = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    resp = await client.post("/v1/livestock/vets/managed", json=MANAGED_VET, headers=auth(mgr))
    assert resp.status_code == 201, resp.text
    vet = resp.json()
    vet_token = seed_user(user_store, uid="vet-user-1", active_profile="farmer", phone=VET_PHONE)
    resp = await client.post("/v1/livestock/vets/claim", headers=auth(vet_token))
    assert resp.status_code == 201 or resp.status_code == 200, resp.text
    farmer = seed_user(user_store, uid="farmer-1", active_profile="farmer")
    return vet, vet_token, farmer


async def _pay_and_verify(client, base_path, order_id, payment_id, token):
    resp = await client.post(
        f"{base_path}/pay/verify",
        json={
            "razorpayOrderId": order_id,
            "razorpayPaymentId": payment_id,
            "signature": sign_payment(order_id, payment_id),
        },
        headers=auth(token),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _complete_appointment(client, appt_id, vet_token):
    for status in ("confirmed", "in-progress", "completed"):
        resp = await client.post(
            f"/v1/livestock/appointments/{appt_id}/status",
            json={"status": status},
            headers=auth(vet_token),
        )
        assert resp.status_code == 200, resp.text


# --- P0-12: donation payment before 80G receipt ---

async def test_donation_pay_verify_then_acknowledge_issues_receipt(client, user_store, monkeypatch):
    enable_test_razorpay(monkeypatch)
    mgr, farmer, gaushala = await _setup_gaushala(client, user_store)
    resp = await client.post(
        "/v1/livestock/gaushala/donations",
        json={
            "gaushalaId": gaushala["id"],
            "donorName": "अशोकराव कदम",
            "donorPhone": "+919822211334",
            "donationType": "cash_seva",
            "amountInr": 2500,
        },
        headers=auth(farmer),
    )
    assert resp.status_code == 201, resp.text
    donation = resp.json()
    path = f"/v1/livestock/gaushala/donations/{donation['id']}"

    # P0-12 gate: acknowledging an unpaid donation must not issue an 80G receipt.
    resp = await client.put(f"{path}/status", json={"status": "acknowledged"}, headers=auth(mgr))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PAYMENT_REQUIRED"

    # pay → Razorpay order for the donor-entered amount (dev shim)
    resp = await client.post(f"{path}/pay", headers=auth(farmer))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["razorpayOrderId"].startswith("order_dev_")
    assert body["amountPaisa"] == 250000
    assert body["currency"] == "INR"
    order_id = body["razorpayOrderId"]
    stored = user_store[f"fodder_donations/{donation['id']}"]
    assert stored["paymentStatus"] == "initiated"
    assert stored["razorpayOrderId"] == order_id
    assert stored["amountPaisa"] == 250000

    # idempotent re-pay returns the same order
    again = await client.post(f"{path}/pay", headers=auth(farmer))
    assert again.json()["razorpayOrderId"] == order_id

    # wrong signature → 400, still not paid
    bad = await client.post(
        f"{path}/pay/verify",
        json={"razorpayOrderId": order_id, "razorpayPaymentId": "pay_x", "signature": "bogus"},
        headers=auth(farmer),
    )
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "PAYMENT_SIGNATURE_INVALID"
    # mismatched order id → 400
    mismatch = await client.post(
        f"{path}/pay/verify",
        json={
            "razorpayOrderId": "order_dev_other",
            "razorpayPaymentId": "pay_x",
            "signature": sign_payment("order_dev_other", "pay_x"),
        },
        headers=auth(farmer),
    )
    assert mismatch.status_code == 400
    assert mismatch.json()["error"]["code"] == "PAYMENT_ORDER_MISMATCH"

    # verify → paid
    result = await _pay_and_verify(client, path, order_id, "pay_1", farmer)
    assert result["status"] == "paid"
    stored = user_store[f"fodder_donations/{donation['id']}"]
    assert stored["paymentStatus"] == "paid"
    assert stored["razorpayPaymentId"] == "pay_1"
    assert stored["paidAt"]

    # idempotent re-verify
    rerun = await _pay_and_verify(client, path, order_id, "pay_1", farmer)
    assert rerun["alreadyPaid"] is True

    # now acknowledgement issues the immutable 80G receipt
    resp = await client.put(f"{path}/status", json={"status": "acknowledged"}, headers=auth(mgr))
    assert resp.status_code == 200, resp.text
    receipt = resp.json()["receipt"]
    assert receipt["kind"] == "donation"
    assert receipt["eightyGEligible"] is True
    assert receipt["amount"] == 2500
    assert receipt["certificateNumber"].startswith("GOSH-80G-")
    stored = user_store[f"fodder_donations/{donation['id']}"]
    assert stored["receiptId"] == receipt["id"]
    assert stored["receiptNumber"] == receipt["certificateNumber"]


async def test_donation_pay_amount_parsing(client, user_store, monkeypatch):
    enable_test_razorpay(monkeypatch)
    mgr, farmer, gaushala = await _setup_gaushala(client, user_store)
    # donor-typed free text with symbol + thousands separators parses robustly
    user_store["fodder_donations/don-free"] = {
        "id": "don-free", "gaushalaId": gaushala["id"], "donorId": "farmer-1",
        "donorName": "Free Text Donor", "amountInr": "₹3,500.50",
        "createdAt": "2026-10-10T10:00:00Z",
    }
    resp = await client.post("/v1/livestock/gaushala/donations/don-free/pay", headers=auth(farmer))
    assert resp.status_code == 200, resp.text
    assert resp.json()["amountPaisa"] == 350050

    # unparseable amount → 422
    user_store["fodder_donations/don-bad"] = {
        "id": "don-bad", "gaushalaId": gaushala["id"], "donorId": "farmer-1",
        "donorName": "Bad Amount Donor", "amountInr": "साडेतीन हजार",
        "createdAt": "2026-10-10T10:00:00Z",
    }
    resp = await client.post("/v1/livestock/gaushala/donations/don-bad/pay", headers=auth(farmer))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "amountInr" in resp.json()["error"]["fieldErrors"]


async def test_donation_pay_forbidden_for_stranger(client, user_store):
    _, _, gaushala = await _setup_gaushala(client, user_store)
    stranger = seed_user(user_store, uid="farmer-2", active_profile="farmer")
    user_store["fodder_donations/don-x"] = {
        "id": "don-x", "gaushalaId": gaushala["id"], "donorId": "farmer-1",
        "donorName": "Donor One", "amountInr": 1200, "createdAt": "2026-10-10T10:00:00Z",
    }
    resp = await client.post("/v1/livestock/gaushala/donations/don-x/pay", headers=auth(stranger))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

    resp = await client.post("/v1/livestock/gaushala/donations/don-missing/pay", headers=auth(stranger))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DONATION_NOT_FOUND"


# --- P0-12: adoption payment before 80G receipt ---

async def test_adoption_pay_verify_then_approve_issues_receipt(client, user_store, monkeypatch):
    enable_test_razorpay(monkeypatch)
    mgr, farmer, gaushala = await _setup_gaushala(client, user_store)
    resp = await client.post(
        "/v1/livestock/gaushala/adoptions",
        json={
            "gaushalaId": gaushala["id"],
            "cowTagId": "G-001",
            "cowName": "Ganga",
            "donorName": "Meena Donor",
            "donorPhone": "+919811122233",
            "tier": "gau_gras",
            "amountInr": 2100,
            "billingCycle": "monthly",
        },
        headers=auth(farmer),
    )
    assert resp.status_code == 201, resp.text
    adoption = resp.json()
    path = f"/v1/livestock/gaushala/adoptions/{adoption['id']}"

    # unpaid approval is gated …
    resp = await client.put(f"{path}/status", json={"status": "approved"}, headers=auth(mgr))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PAYMENT_REQUIRED"
    # … but rejection needs no payment
    resp = await client.put(f"{path}/status", json={"status": "rejected"}, headers=auth(mgr))
    assert resp.status_code == 200
    resp = await client.put(f"{path}/status", json={"status": "approved"}, headers=auth(mgr))
    assert resp.status_code == 409  # rejected stays rejected (no receipt gate re-entry)

    # second adoption: the gaushala manager records the donor's payment
    resp = await client.post(
        "/v1/livestock/gaushala/adoptions",
        json={
            "gaushalaId": gaushala["id"], "cowTagId": "G-002", "cowName": "Yamuna",
            "donorName": "Sunil Donor", "donorPhone": "+919811144455",
            "tier": "gau_seva", "amountInr": 5100, "billingCycle": "annual",
        },
        headers=auth(farmer),
    )
    adoption_2 = resp.json()
    path_2 = f"/v1/livestock/gaushala/adoptions/{adoption_2['id']}"
    resp = await client.post(f"{path_2}/pay", headers=auth(mgr))
    assert resp.status_code == 200, resp.text
    assert resp.json()["amountPaisa"] == 510000
    order_id = resp.json()["razorpayOrderId"]
    await _pay_and_verify(client, path_2, order_id, "pay_adopt_2", mgr)

    resp = await client.put(f"{path_2}/status", json={"status": "approved"}, headers=auth(mgr))
    assert resp.status_code == 200, resp.text
    receipt = resp.json()["receipt"]
    assert receipt["kind"] == "adoption"
    assert receipt["eightyGEligible"] is True
    assert receipt["refId"] == adoption_2["id"]
    assert user_store[f"cow_adoptions/{adoption_2['id']}"]["receiptId"] == receipt["id"]

    # adoption pay 404s
    resp = await client.post("/v1/livestock/gaushala/adoptions/ad-missing/pay", headers=auth(mgr))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ADOPTION_NOT_FOUND"


# --- P0-13: consultation fee collection ---

async def _book_farm_visit(client, farmer, vet_id):
    resp = await client.post(
        "/v1/livestock/appointments",
        json={**APPOINTMENT, "visitType": "farm", "vetId": vet_id, "animalId": ""},
        headers=auth(farmer),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_appointment_fee_defaults_per_visit_type_and_refund_on_cancel(client, user_store, monkeypatch):
    enable_test_razorpay(monkeypatch)
    vet, vet_token, farmer = await _setup_vet(client, user_store)
    appt = await _book_farm_visit(client, farmer, vet["id"])
    assert appt["fee"] == 700  # farm-visit default from the vet's fee schedule
    path = f"/v1/livestock/appointments/{appt['id']}"

    # the vet cannot pay the farmer's fee
    resp = await client.post(f"{path}/pay", headers=auth(vet_token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

    # pay → fee hold order
    resp = await client.post(f"{path}/pay", headers=auth(farmer))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["razorpayOrderId"].startswith("order_dev_")
    assert body["amountPaisa"] == 70000
    assert body["feeStatus"] == "hold"
    order_id = body["razorpayOrderId"]
    stored = user_store[f"appointments/{appt['id']}"]
    assert stored["feeStatus"] == "hold"
    assert stored["feePaisa"] == 70000
    assert stored["razorpayOrderId"] == order_id

    # bad signature → 400; mismatched order → 400
    bad = await client.post(
        f"{path}/pay/verify",
        json={"razorpayOrderId": order_id, "razorpayPaymentId": "pay_y", "signature": "nope"},
        headers=auth(farmer),
    )
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "PAYMENT_SIGNATURE_INVALID"
    mismatch = await client.post(
        f"{path}/pay/verify",
        json={
            "razorpayOrderId": "order_dev_elsewhere",
            "razorpayPaymentId": "pay_y",
            "signature": sign_payment("order_dev_elsewhere", "pay_y"),
        },
        headers=auth(farmer),
    )
    assert mismatch.status_code == 400
    assert mismatch.json()["error"]["code"] == "PAYMENT_ORDER_MISMATCH"

    # verify → fee captured
    result = await _pay_and_verify(client, path, order_id, "pay_fee_1", farmer)
    assert result["status"] == "paid"
    stored = user_store[f"appointments/{appt['id']}"]
    assert stored["feeStatus"] == "paid"
    assert stored["razorpayPaymentId"] == "pay_fee_1"
    assert stored["feePaidAt"]

    # re-verify is idempotent
    rerun = await _pay_and_verify(client, path, order_id, "pay_fee_1", farmer)
    assert rerun["alreadyPaid"] is True

    # cancel (by the vet) refunds the captured fee
    resp = await client.post(
        f"{path}/status", json={"status": "cancelled", "cancelReason": "vet emergency"},
        headers=auth(vet_token),
    )
    assert resp.status_code == 200, resp.text
    stored = user_store[f"appointments/{appt['id']}"]
    assert stored["status"] == "cancelled"
    assert stored["feeStatus"] == "refunded"
    assert stored["feeRefundId"].startswith("rfnd_dev_")
    assert stored["feeRefundedAt"]


async def test_appointment_cancel_without_payment_needs_no_refund(client, user_store):
    vet, vet_token, farmer = await _setup_vet(client, user_store)
    appt = await _book_farm_visit(client, farmer, vet["id"])
    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "cancelled", "cancelReason": "जरूरी काम"},
        headers=auth(farmer),
    )
    assert resp.status_code == 200, resp.text
    stored = user_store[f"appointments/{appt['id']}"]
    assert stored["status"] == "cancelled"
    assert "feeRefundId" not in stored
    assert stored.get("feeStatus") != "refunded"


# --- P1-28: vet settlements → payout ---

async def _book_paid_appointment(client, user_store, farmer, vet, vet_token, payment_id):
    appt = await _book_farm_visit(client, farmer, vet["id"])
    path = f"/v1/livestock/appointments/{appt['id']}"
    resp = await client.post(f"{path}/pay", headers=auth(farmer))
    assert resp.status_code == 200, resp.text
    order_id = resp.json()["razorpayOrderId"]
    await _pay_and_verify(client, path, order_id, payment_id, farmer)
    await _complete_appointment(client, appt["id"], vet_token)
    return appt


async def _book_fee_paid_appointment(client, farmer, vet, payment_id):
    """Book + pay + verify the fee, leaving the appointment `requested`."""
    appt = await _book_farm_visit(client, farmer, vet["id"])
    path = f"/v1/livestock/appointments/{appt['id']}"
    resp = await client.post(f"{path}/pay", headers=auth(farmer))
    assert resp.status_code == 200, resp.text
    order_id = resp.json()["razorpayOrderId"]
    await _pay_and_verify(client, path, order_id, payment_id, farmer)
    return appt


async def _add_verified_bank_account(client, vet_token):
    resp = await client.post("/v1/bank-accounts", json=BANK_ACCOUNT, headers=auth(vet_token))
    assert resp.status_code == 201, resp.text
    account_id = resp.json()["id"]
    resp = await client.post(f"/v1/bank-accounts/{account_id}/verify", headers=auth(vet_token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["verifyStatus"] == "verified"
    return account_id


async def test_vet_settlements_and_payout(client, user_store, monkeypatch):
    enable_test_razorpay(monkeypatch)
    vet, vet_token, farmer = await _setup_vet(client, user_store)
    await _book_paid_appointment(client, user_store, farmer, vet, vet_token, "pay_s1")
    await _book_paid_appointment(client, user_store, farmer, vet, vet_token, "pay_s2")
    # one cancelled-after-pay appointment must not count as earnings
    cancelled = await _book_fee_paid_appointment(client, farmer, vet, "pay_s3")
    resp = await client.post(
        f"/v1/livestock/appointments/{cancelled['id']}/status",
        json={"status": "cancelled", "cancelReason": "changed plans"},
        headers=auth(farmer),
    )
    assert resp.status_code == 200, resp.text
    assert user_store[f"appointments/{cancelled['id']}"]["feeStatus"] == "refunded"
    # a seeded previous-month captured fee builds a second settlement period
    user_store["appointments/ap-old"] = {
        "id": "ap-old", "vetId": vet["id"], "farmerUid": "farmer-1",
        "visitType": "clinic", "slotDate": "2026-09-15", "slotTime": "10:00",
        "fee": 300.0, "feePaisa": 30000, "feeStatus": "paid",
        "razorpayPaymentId": "pay_old", "feePaidAt": "2026-09-15T10:00:00+00:00",
        "status": "completed", "createdAt": "2026-09-10T00:00:00+00:00",
        "updatedAt": "2026-09-15T10:00:00+00:00",
    }

    # settlement rows from captured fees (10% platform commission)
    resp = await client.get("/v1/livestock/vets/me/settlements", headers=auth(vet_token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["commissionPct"] == 10
    assert body["total"] == 2
    assert [r["period"] for r in body["data"]] == [CURRENT_PERIOD, "2026-09"]
    current = body["data"][0]
    assert current["appointments"] == 2
    assert current["grossPaisa"] == 140000
    assert current["commissionPaisa"] == 14000
    assert current["netPaisa"] == 126000
    assert current["status"] == "pending"
    previous = body["data"][1]
    assert previous["grossPaisa"] == 30000
    assert previous["netPaisa"] == 27000
    assert body["pendingPaisa"] == 153000

    payout_body = {"amountPaise": 27000, "mpin": "1234"}

    # MPIN gate: not set → 409
    resp = await client.post("/v1/livestock/vets/me/payouts", json=payout_body, headers=auth(vet_token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "MPIN_NOT_SET"

    user_store["users/vet-user-1"]["mpinHash"] = hash_mpin("1234")

    # wrong MPIN → 401
    resp = await client.post(
        "/v1/livestock/vets/me/payouts",
        json={**payout_body, "mpin": "0000"},
        headers=auth(vet_token),
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"

    # over the unsettled balance → 409
    resp = await client.post(
        "/v1/livestock/vets/me/payouts",
        json={"amountPaise": 153001, "mpin": "1234"},
        headers=auth(vet_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INSUFFICIENT_BALANCE"

    # no bank account on file → 404
    resp = await client.post("/v1/livestock/vets/me/payouts", json=payout_body, headers=auth(vet_token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "BANK_ACCOUNT_NOT_FOUND"

    account_id = await _add_verified_bank_account(client, vet_token)

    # unverified account explicitly chosen → 409
    resp = await client.post("/v1/bank-accounts", json={**BANK_ACCOUNT, "accountNumber": "999888777666"}, headers=auth(vet_token))
    assert resp.status_code == 201, resp.text
    unverified_id = resp.json()["id"]
    resp = await client.post(
        "/v1/livestock/vets/me/payouts",
        json={**payout_body, "bankAccountId": unverified_id},
        headers=auth(vet_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "BANK_ACCOUNT_NOT_VERIFIED"

    # partial payout covers the oldest period first
    resp = await client.post(
        "/v1/livestock/vets/me/payouts",
        json={**payout_body, "bankAccountId": account_id},
        headers=auth(vet_token),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["payoutRef"].startswith("pout_dev_")
    assert body["amountPaisa"] == 27000
    assert body["settledPeriods"] == ["2026-09"]
    rows = {r["period"]: r for r in (await client.get("/v1/livestock/vets/me/settlements", headers=auth(vet_token))).json()["data"]}
    assert rows["2026-09"]["status"] == "paid"
    assert rows["2026-09"]["payoutRef"] == body["payoutRef"]
    assert rows["2026-09"]["paidAt"]
    assert rows[CURRENT_PERIOD]["status"] == "pending"

    # full payout of the remainder (auto-picked primary verified account)
    resp = await client.post(
        "/v1/livestock/vets/me/payouts",
        json={"amountPaise": 126000, "mpin": "1234"},
        headers=auth(vet_token),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["settledPeriods"] == [CURRENT_PERIOD]
    rows = {r["period"]: r for r in (await client.get("/v1/livestock/vets/me/settlements", headers=auth(vet_token))).json()["data"]}
    assert rows[CURRENT_PERIOD]["status"] == "paid"
    assert rows[CURRENT_PERIOD]["payoutRef"] == body["payoutRef"]

    # everything settled → no pending balance left
    resp = await client.get("/v1/livestock/vets/me/settlements", headers=auth(vet_token))
    assert resp.json()["pendingPaisa"] == 0
    resp = await client.post(
        "/v1/livestock/vets/me/payouts",
        json={"amountPaise": 100, "mpin": "1234"},
        headers=auth(vet_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INSUFFICIENT_BALANCE"
