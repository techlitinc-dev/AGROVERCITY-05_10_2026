
"""S3/S4: per-procurement payment status `paid | udhaar` — idempotent
transitions, standard error envelope, integer paisa, audit_logs write."""
from tests.test_users import _auth, _register

PROCUREMENT_BODY = {
    "farmerName": "Shamrao Pawar",
    "crop": "Onion",
    "grossWeightKg": 1200,
    "tareWeightKg": 150,
    "netWeightQuintals": 10.5,
    "ratePerQuintal": 1800,
    "qualityDeductionPct": 2,
}


def _verify_shop_kyc(user_store, uid="uid-1"):
    """stands in for the admin KYC review: the seller shop case is verified."""
    user_store[f"kyc_cases/kyc_{uid}_seller"] = {
        "caseId": f"kyc_{uid}_seller",
        "userId": uid,
        "persona": "seller",
        "status": "verified",
        "docs": [
            {"docId": f"kyc_{uid}_seller:apmc_licence", "type": "apmc_licence", "status": "verified"},
            {"docId": f"kyc_{uid}_seller:gst", "type": "gst", "status": "verified"},
        ],
    }


async def _token(client, user_store):
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    _verify_shop_kyc(user_store)
    return resp.json()["accessToken"]


async def _create_lot(client, token, **overrides):
    resp = await client.post(
        "/v1/seller/procurement", json={**PROCUREMENT_BODY, **overrides}, headers=_auth(token)
    )
    assert resp.status_code == 201
    return resp.json()


async def _set_status(client, token, lot_id, body, key="idem-1"):
    return await client.post(
        f"/v1/seller/procurement/{lot_id}/payment-status",
        json=body,
        headers={**_auth(token), "Idempotency-Key": key},
    )


async def test_udhaar_then_paid_transitions(client, user_store):
    token = await _token(client, user_store)
    lot = await _create_lot(client, token)
    assert lot["paymentStatus"] == "unpaid"

    resp = await _set_status(client, token, lot["id"], {"status": "udhaar", "amountPaisa": 1852200})
    assert resp.status_code == 200
    assert resp.json()["paymentStatus"] == "udhaar"
    assert resp.json()["amountPaisa"] == 1852200

    resp = await _set_status(client, token, lot["id"], {"status": "paid"}, key="idem-2")
    assert resp.status_code == 200
    assert resp.json()["paymentStatus"] == "paid"
    assert "paidAt" in resp.json()

    # both transitions are audited (rule 3)
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert {a["newStatus"] for a in audits} == {"udhaar", "paid"}
    assert all(a["action"] == "PROCUREMENT_PAYMENT_STATUS" for a in audits)


async def test_replay_returns_first_response(client, user_store):
    token = await _token(client, user_store)
    lot = await _create_lot(client, token)

    first = await _set_status(client, token, lot["id"], {"status": "udhaar"}, key="replay-key")
    assert first.status_code == 200
    # same key with a DIFFERENT body must replay the stored response, not apply it
    replayed = await _set_status(client, token, lot["id"], {"status": "paid"}, key="replay-key")
    assert replayed.status_code == 200
    assert replayed.json()["paymentStatus"] == "udhaar"
    # the underlying doc is untouched by the replayed call
    assert user_store[f"users/uid-1/seller_procurement/{lot['id']}"]["paymentStatus"] == "udhaar"


async def test_missing_idempotency_key_400(client, user_store):
    token = await _token(client, user_store)
    lot = await _create_lot(client, token)
    resp = await client.post(
        f"/v1/seller/procurement/{lot['id']}/payment-status",
        json={"status": "paid"},
        headers=_auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"


async def test_invalid_status_422(client, user_store):
    token = await _token(client, user_store)
    lot = await _create_lot(client, token)
    resp = await _set_status(client, token, lot["id"], {"status": "pending"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_STATUS"


async def test_negative_amount_422(client, user_store):
    token = await _token(client, user_store)
    lot = await _create_lot(client, token)
    resp = await _set_status(client, token, lot["id"], {"status": "udhaar", "amountPaisa": -5})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_AMOUNT"


async def test_unknown_lot_404(client, user_store):
    token = await _token(client, user_store)
    resp = await _set_status(client, token, "proc_missing", {"status": "paid"})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOT_NOT_FOUND"


async def test_status_visible_in_list_stats(client, user_store):
    token = await _token(client, user_store)
    lot = await _create_lot(client, token)
    await _set_status(client, token, lot["id"], {"status": "udhaar"})
    resp = await client.get("/v1/seller/procurement", headers=_auth(token))
    assert resp.status_code == 200
    listed = next(l for l in resp.json()["data"] if l["id"] == lot["id"])
    assert listed["paymentStatus"] == "udhaar"
    # udhaar lots count toward pending payouts
    assert resp.json()["stats"]["pendingPayouts"] == lot["finalAmount"]


async def _seed_farmer(user_store, uid="uid-f1", phone="+919800000001"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "phone": phone,
        "linkedProfiles": ["farmer"],
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    return phone


async def test_farmer_sees_payment_pending_then_receipt(client, user_store):
    from app.services.tokens import create_access_token

    farmer_phone = await _seed_farmer(user_store)
    token = await _token(client, user_store)
    lot = await _create_lot(client, token, farmerPhone=farmer_phone)
    farmer_token = create_access_token("uid-f1")

    # udhaar -> farmer sees the pending trust card data
    await _set_status(client, token, lot["id"], {"status": "udhaar", "amountPaisa": 1852200})
    resp = await client.get("/v1/seller/procurement/mine", headers=_auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["pendingCount"] == 1
    row = next(d for d in body["data"] if d["id"] == lot["id"])
    assert row["paymentStatus"] == "udhaar"
    assert row["finalAmount"] == lot["finalAmount"]

    # receipt is not available while udhaar
    resp = await client.get(
        f"/v1/seller/procurement/mine/{lot['id']}/receipt", headers=_auth(farmer_token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "RECEIPT_NOT_AVAILABLE"

    # paid -> receipt with UTR + receipt number
    await _set_status(client, token, lot["id"], {"status": "paid"}, key="idem-paid")
    resp = await client.get(
        f"/v1/seller/procurement/mine/{lot['id']}/receipt", headers=_auth(farmer_token)
    )
    assert resp.status_code == 200
    receipt = resp.json()
    assert receipt["paymentStatus"] == "paid"
    assert receipt["receiptNo"].startswith("RCP-")
    assert receipt["utrNumber"]
    assert receipt["paidAt"]
    assert receipt["amountPaisa"] == 1852200

    resp = await client.get("/v1/seller/procurement/mine", headers=_auth(farmer_token))
    assert resp.json()["pendingCount"] == 0


async def test_farmer_receipt_unknown_404(client, user_store):
    from app.services.tokens import create_access_token

    await _seed_farmer(user_store)
    farmer_token = create_access_token("uid-f1")
    resp = await client.get(
        "/v1/seller/procurement/mine/proc_missing/receipt", headers=_auth(farmer_token)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PAYMENT_NOT_FOUND"


async def test_pay_endpoint_also_updates_farmer_mirror(client, user_store):
    from app.services.tokens import create_access_token

    farmer_phone = await _seed_farmer(user_store)
    token = await _token(client, user_store)
    lot = await _create_lot(client, token, farmerPhone=farmer_phone)

    resp = await client.post(
        f"/v1/seller/procurement/{lot['id']}/pay",
        params={"paymentMode": "upi", "utrNo": "UTRTEST42"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert user_store[f"users/uid-f1/procurement_payments/{lot['id']}"]["paymentStatus"] == "paid"
    assert user_store[f"users/uid-f1/procurement_payments/{lot['id']}"]["utrNumber"] == "UTRTEST42"


async def test_pay_endpoint_writes_audit_log(client, user_store):
    token = await _token(client, user_store)
    lot = await _create_lot(client, token)

    resp = await client.post(
        f"/v1/seller/procurement/{lot['id']}/pay",
        params={"paymentMode": "upi", "utrNo": "UTRAUDIT1"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert len(audits) == 1
    assert audits[0]["action"] == "PROCUREMENT_PAYMENT_STATUS"
    assert audits[0]["newStatus"] == "paid"
    assert audits[0]["utrNumber"] == "UTRAUDIT1"
    assert audits[0]["actorId"] == "uid-1"
