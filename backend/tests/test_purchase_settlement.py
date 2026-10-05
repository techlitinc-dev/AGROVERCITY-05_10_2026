from datetime import datetime, timedelta, timezone

from app.services.tokens import create_access_token


def _seed_user(user_store, uid, name, active="farmer", **extra):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": name,
        "phone": "+919876543210",
        "state": "Maharashtra",
        "district": "Nashik",
        "village": "Pimplas",
        "linkedProfiles": ["farmer", "directBuyer"],
        "primaryProfile": "farmer",
        "activeProfile": active,
        **extra,
    }
    # WS-02: the QC suite is a Pro-tier feature — grant a Pro subscription so
    # the settlement flows here exercise the post-tier code path (fixture only).
    user_store[f"subscriptions/sub_pro_{uid}"] = {
        "userId": uid,
        "planId": "directBuyer_pro",
        "status": "active",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    return create_access_token(uid)


def _seed_purchase(user_store, pid, buyer_id, farmer_id, **extra):
    doc = {
        "id": pid,
        "buyerId": buyer_id,
        "buyerName": "Agro Corp",
        "farmerId": farmer_id,
        "farmerName": "Kisan Ram",
        "source": {"type": "contract", "refId": "con_123"},
        "crop": "Tomato",
        "variety": "",
        "quantity": 10.0,
        "unit": "quintal",
        "agreedPricePerUnit": 2000,
        "totalAmount": 20000,
        "advancePaid": 0,
        "status": "delivered",
        "pickup": None,
        "payments": [],
        "qc": None,
        "finalAmount": None,
        "invoice": None,
        "events": [],
        "rating": {"buyerToFarmer": None, "farmerToBuyer": None},
        "escrow": {
            "status": "held",
            "amount": 20000,
            "fundedAt": "2026-10-01T00:00:00+00:00",
        },
        "handover": {
            "verifiedAt": "2026-10-02T10:00:00+00:00",
        },
        "createdAt": "2026-10-01T00:00:00+00:00",
        "updatedAt": "2026-10-01T00:00:00+00:00",
    }
    doc.update(extra)
    user_store[f"purchases/{pid}"] = doc
    return doc


async def test_qc_full_acceptance_grade_path(client, user_store):
    b_token = _seed_user(user_store, "uid-b1", "Buyer 1", active="directBuyer")
    _seed_user(user_store, "uid-f1", "Farmer 1", active="farmer")
    _seed_purchase(user_store, "pur_grade_accept", "uid-b1", "uid-f1")

    resp = await client.post(
        "/v1/purchases/pur_grade_accept/qc",
        json={"grade": "A", "acceptedQty": 10.0, "rejectedQty": 0.0, "notes": "Good"},
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["finalAmount"] == 20000
    assert data["qc"]["grade"] == "A"
    assert data["invoice"] is not None


async def test_qc_partial_dispute_grade_path(client, user_store):
    b_token = _seed_user(user_store, "uid-b2", "Buyer 2", active="directBuyer")
    _seed_user(user_store, "uid-f2", "Farmer 2", active="farmer")
    _seed_purchase(user_store, "pur_grade_dispute", "uid-b2", "uid-f2")

    resp = await client.post(
        "/v1/purchases/pur_grade_dispute/qc",
        json={"grade": "B", "acceptedQty": 8.0, "rejectedQty": 2.0, "notes": "Damage"},
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "qcDisputed"
    assert data["finalAmount"] == 16000
    assert data["qc"]["grade"] == "B"
    assert data["escrow"]["disputeOpenedAt"] is not None


async def test_qc_sliding_settlement_to_the_rupee(client, user_store):
    b_token = _seed_user(user_store, "uid-b3", "Buyer 3", active="directBuyer")
    _seed_user(user_store, "uid-f3", "Farmer 3", active="farmer")

    # Fixture spec: BRIX (+₹75/q per 1% above 4.1), Moisture (-₹20/q per 1% above 12.0)
    spec_snapshot = {
        "id": "spec_sliding_fixture",
        "crop": "Tomato",
        "name": "Sliding Tomato Fixture Spec",
        "params": [
            {
                "name": "BRIX",
                "unit": "%",
                "min": 4.1,
                "max": None,
                "testMethod": "Refractometer",
                "adjustmentPerUnit": 7500,  # +₹75/q per 1.0 deviation
            },
            {
                "name": "Moisture",
                "unit": "%",
                "min": None,
                "max": 12.0,
                "testMethod": "Moisture meter",
                "adjustmentPerUnit": -2000,  # -₹20/q per 1.0 deviation
            },
        ],
    }

    # Purchase: 10 quintals @ ₹2000/q = ₹20,000 base
    _seed_purchase(
        user_store,
        "pur_sliding_1",
        "uid-b3",
        "uid-f3",
        quantity=10.0,
        agreedPricePerUnit=2000,
        totalAmount=20000,
        specSnapshot=spec_snapshot,
    )

    # QA submits BRIX 5.1 (5.1 - 4.1 = 1.0 -> +7500 paisa/q = +₹75/q)
    # and Moisture 13% (13.0 - 12.0 = 1.0 -> -2000 paisa/q = -₹20/q)
    # Net rate adjustment: +7500 - 2000 = +5500 paisa/q = +₹55/q
    # Final rate: 200000 + 5500 = 205500 paisa/q = ₹2055/q
    # Total qualityAdjustment for 10 quintals: 5500 * 10 = 55000 paisa (+₹550)
    # Final amount: 10 quintals * ₹2055/q = ₹20,550 (2,055,000 paisa)
    resp = await client.post(
        "/v1/purchases/pur_sliding_1/qc",
        json={
            "grade": "A",
            "acceptedQty": 10.0,
            "rejectedQty": 0.0,
            "measurements": [
                {"name": "BRIX", "value": 5.1},
                {"name": "Moisture", "value": 13.0},
            ],
            "notes": "Sliding QC inspection",
        },
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["qualityAdjustment"] == 55000
    assert data["qualityAdjustmentPerUnit"] == 5500
    assert data["finalRate"] == 205500  # 205500 paisa = ₹2055/q
    assert data["finalAmount"] == 20550  # ₹20,550
    assert data["finalAmountPaisa"] == 2055000

    # Verify per-line measurement adjustments
    measurements = data["qc"]["measurements"]
    assert len(measurements) == 2
    brix_m = next(m for m in measurements if m["name"] == "BRIX")
    moist_m = next(m for m in measurements if m["name"] == "Moisture")
    assert brix_m["adjustment"] == 7500
    assert moist_m["adjustment"] == -2000


async def test_qc_sliding_settlement_disputed(client, user_store):
    b_token = _seed_user(user_store, "uid-b4", "Buyer 4", active="directBuyer")
    _seed_user(user_store, "uid-f4", "Farmer 4", active="farmer")

    spec_snapshot = {
        "id": "spec_sliding_dispute",
        "crop": "Tomato",
        "name": "Sliding Tomato Dispute Spec",
        "params": [
            {
                "name": "BRIX",
                "unit": "%",
                "min": 4.1,
                "max": None,
                "adjustmentPerUnit": 7500,
            },
            {
                "name": "Moisture",
                "unit": "%",
                "min": None,
                "max": 12.0,
                "adjustmentPerUnit": -2000,
            },
        ],
    }

    _seed_purchase(
        user_store,
        "pur_sliding_2",
        "uid-b4",
        "uid-f4",
        quantity=10.0,
        agreedPricePerUnit=2000,
        totalAmount=20000,
        specSnapshot=spec_snapshot,
    )

    resp = await client.post(
        "/v1/purchases/pur_sliding_2/qc",
        json={
            "grade": "B",
            "acceptedQty": 8.0,
            "rejectedQty": 2.0,
            "measurements": [
                {"name": "BRIX", "value": 5.1},
                {"name": "Moisture", "value": 13.0},
            ],
            "notes": "Partial rejection with sliding spec",
        },
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "qcDisputed"
    assert data["finalRate"] == 205500
    assert data["finalAmount"] == 16440  # 8q * 2055 = ₹16,440
    assert data["escrow"]["disputeOpenedAt"] is not None


# ---- Escrow + handover OTP + resolve + pay caps + invoice ----


async def test_escrow_fund_success(client, user_store):
    b_token = _seed_user(user_store, "uid-ef1", "Buyer EF", active="directBuyer")
    _seed_user(user_store, "uid-ef1-f", "Farmer EF", active="farmer")
    _seed_purchase(
        user_store,
        "pur_fund_1",
        "uid-ef1",
        "uid-ef1-f",
        status="confirmed",
        escrow={"status": "unfunded", "amount": 0},
        handover={"verifiedAt": None},
    )

    resp = await client.post(
        "/v1/purchases/pur_fund_1/escrow/fund",
        json={"amount": 20000, "method": "upi", "reference": "UTR1"},
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["escrow"]["status"] == "held"
    assert data["escrow"]["amount"] == 20000
    assert data["status"] == "advancePaid"
    assert user_store["purchases/pur_fund_1"]["escrow"]["fundedAt"] is not None


async def test_handover_otp_wrong_expired_attempts(client, user_store):
    b_token = _seed_user(user_store, "uid-otp1", "Buyer OTP", active="directBuyer")
    _seed_user(user_store, "uid-otp1-f", "Farmer OTP", active="farmer")
    future = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    past = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    auth = {"Authorization": f"Bearer {b_token}"}

    # wrong code → 400 INVALID_OTP (attempt counter increments)
    _seed_purchase(
        user_store, "pur_otp_wrong", "uid-otp1", "uid-otp1-f",
        status="delivered", escrow={"status": "held", "amount": 20000},
        handover={"otp": "123456", "expiresAt": future, "attempts": 0, "verifiedAt": None},
    )
    resp = await client.post(
        "/v1/purchases/pur_otp_wrong/handover/verify", json={"otp": "000000"}, headers=auth
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_OTP"
    assert user_store["purchases/pur_otp_wrong"]["handover"]["attempts"] == 1

    # expired code → 400 OTP_EXPIRED
    _seed_purchase(
        user_store, "pur_otp_exp", "uid-otp1", "uid-otp1-f",
        status="delivered", escrow={"status": "held", "amount": 20000},
        handover={"otp": "123456", "expiresAt": past, "attempts": 0, "verifiedAt": None},
    )
    resp = await client.post(
        "/v1/purchases/pur_otp_exp/handover/verify", json={"otp": "123456"}, headers=auth
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OTP_EXPIRED"

    # too many attempts → 429
    _seed_purchase(
        user_store, "pur_otp_att", "uid-otp1", "uid-otp1-f",
        status="delivered", escrow={"status": "held", "amount": 20000},
        handover={"otp": "123456", "expiresAt": future, "attempts": 5, "verifiedAt": None},
    )
    resp = await client.post(
        "/v1/purchases/pur_otp_att/handover/verify", json={"otp": "123456"}, headers=auth
    )
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "TOO_MANY_ATTEMPTS"


async def test_resolve_dispute_completes_and_issues_invoice(client, user_store):
    b_token = _seed_user(user_store, "uid-rs1", "Buyer RS", active="directBuyer")
    _seed_user(user_store, "uid-rs1-f", "Farmer RS", active="farmer")
    _seed_purchase(
        user_store, "pur_resolve_1", "uid-rs1", "uid-rs1-f",
        status="qcDisputed", finalAmount=18000,
        escrow={
            "status": "held",
            "amount": 20000,
            "disputeOpenedAt": "2026-10-01T00:00:00+00:00",
        },
        handover={"verifiedAt": "2026-10-01T00:00:00+00:00"},
    )
    resp = await client.post(
        "/v1/purchases/pur_resolve_1/resolve",
        json={"resolution": "reweighed, settled at 18000"},
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["invoice"] is not None


async def test_pay_exceeds_due_blocked(client, user_store):
    b_token = _seed_user(user_store, "uid-pay1", "Buyer Pay", active="directBuyer")
    _seed_user(user_store, "uid-pay1-f", "Farmer Pay", active="farmer")
    _seed_purchase(
        user_store, "pur_pay_1", "uid-pay1", "uid-pay1-f",
        status="delivered", finalAmount=None, payments=[],
    )
    auth = {"Authorization": f"Bearer {b_token}"}

    resp = await client.post(
        "/v1/purchases/pur_pay_1/pay",
        json={"amount": 25000, "method": "upi", "kind": "full"},
        headers=auth,
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PAYMENT_EXCEEDS_DUE"

    resp = await client.post(
        "/v1/purchases/pur_pay_1/pay",
        json={"amount": 20000, "method": "upi", "kind": "full"},
        headers=auth,
    )
    assert resp.status_code == 200


async def test_invoice_contents_integer_paisa(client, user_store):
    b_token = _seed_user(user_store, "uid-inv1", "Buyer Inv", active="directBuyer")
    _seed_user(user_store, "uid-inv1-f", "Farmer Inv", active="farmer")
    _seed_purchase(user_store, "pur_inv_1", "uid-inv1", "uid-inv1-f")
    auth = {"Authorization": f"Bearer {b_token}"}

    resp = await client.post(
        "/v1/purchases/pur_inv_1/qc",
        json={"grade": "A", "acceptedQty": 10.0, "rejectedQty": 0.0},
        headers=auth,
    )
    assert resp.status_code == 200

    resp = await client.get("/v1/purchases/pur_inv_1/invoice", headers=auth)
    assert resp.status_code == 200
    inv = resp.json()
    assert inv["purchaseId"] == "pur_inv_1"
    assert inv["number"].startswith("INV-")
    assert isinstance(inv["lines"], list)
    assert len(inv["lines"]) >= 1
    assert inv["totalAmount"] == 20000
    for line in inv["lines"]:
        assert isinstance(line["amount"], int)


async def test_invoice_commission_line_1_to_2_pct(client, user_store):
    b_token = _seed_user(user_store, "uid-comm1", "Buyer Comm", active="directBuyer")
    _seed_user(user_store, "uid-comm1-f", "Farmer Comm", active="farmer")
    _seed_purchase(user_store, "pur_comm_1", "uid-comm1", "uid-comm1-f")
    auth = {"Authorization": f"Bearer {b_token}"}

    resp = await client.post(
        "/v1/purchases/pur_comm_1/qc",
        json={"grade": "A", "acceptedQty": 10.0, "rejectedQty": 0.0},
        headers=auth,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"

    resp = await client.get("/v1/purchases/pur_comm_1/invoice", headers=auth)
    assert resp.status_code == 200
    inv = resp.json()
    comm = [line for line in inv["lines"] if line.get("type") == "commission"]
    assert len(comm) == 1
    trade = inv["totalAmount"]
    pct = comm[0]["ratePercent"]
    assert 1 <= pct <= 2
    assert isinstance(comm[0]["amount"], int)
    assert comm[0]["amount"] == trade * pct // 100
