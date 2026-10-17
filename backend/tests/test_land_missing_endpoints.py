"""Missing land endpoints (audit items P0-2, P0-3, P1-25, P1-26).

Lease e-sign (MPIN-gated), escrow funding & milestone release, the landlord
payout dashboard and the post-confirmation chat room — all driven through the
real API on the in-memory Firestore fake.
"""
import hashlib
import hmac

from app.core.config import settings
from app.core.security import hash_mpin
from tests.test_diary import auth, seed_user

LISTING = {
    "village": "Pimplas",
    "district": "Nashik",
    "lat": 20.0,
    "lng": 73.85,
    "areaAcres": 2.0,
    "expectedRentRupees": 8000,
}

ESIGN_BODY = {
    "signatureData": "sig-base64-xyz",
    "consentTimestamp": "2026-10-17T10:00:00+00:00",
    "mpin": "1234",
}

# monthlyRentRupees 8000 → annual 96000; seeded 30/40/30 milestones.
MILESTONE_PAISA = [2880000, 3840000, 2880000]
ESCROW_TOTAL_PAISA = 9600000


def _landlord(user_store, uid="uid-l1"):
    return seed_user(
        user_store, uid=uid, active_profile="farmLandlord",
        name="Landlord Patil", phone="+919811100001",
    )


def _farmer(user_store, uid="uid-f1", phone="+919822200001"):
    return seed_user(
        user_store, uid=uid, active_profile="farmer",
        name="Sunil Pawar", phone=phone,
    )


def _set_mpin(user_store, uid, mpin="1234"):
    user_store[f"users/{uid}"]["mpinHash"] = hash_mpin(mpin)


async def _confirmed_lease(client, user_store):
    """listing → farmer lease-request → landlord accept (lease with tenantFarmerId)."""
    landlord = _landlord(user_store)
    farmer = _farmer(user_store)
    resp = await client.post("/v1/land/listings", json=LISTING, headers=auth(landlord))
    assert resp.status_code == 201
    listing_id = resp.json()["id"]
    resp = await client.post(
        "/v1/land/lease-requests",
        json={"listingId": listing_id, "durationMonths": 12},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    request_id = resp.json()["id"]
    resp = await client.post(
        f"/v1/land/lease-requests/{request_id}/accept", headers=auth(landlord)
    )
    assert resp.status_code == 200
    return landlord, farmer, resp.json()["leaseId"]


def _tasks_for(user_store, uid, kind):
    return [
        doc for key, doc in user_store.items()
        if key.startswith("tasks/") and doc.get("userId") == uid and doc.get("kind") == kind
    ]


# ---- P0-2: e-sign ----------------------------------------------------------


async def test_esign_mpin_not_set_409(client, user_store):
    landlord, _, lease_id = await _confirmed_lease(client, user_store)
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/esign", json=ESIGN_BODY, headers=auth(landlord)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "MPIN_NOT_SET"


async def test_esign_wrong_mpin_401(client, user_store):
    landlord, _, lease_id = await _confirmed_lease(client, user_store)
    _set_mpin(user_store, "uid-l1")
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/esign",
        json={**ESIGN_BODY, "mpin": "9999"},
        headers=auth(landlord),
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"


async def test_esign_lease_not_found_404(client, user_store):
    landlord = _landlord(user_store)
    _set_mpin(user_store, "uid-l1")
    resp = await client.post(
        "/v1/land/leases/nope/esign", json=ESIGN_BODY, headers=auth(landlord)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LEASE_NOT_FOUND"


async def test_esign_landlord_then_tenant(client, user_store):
    landlord, farmer, lease_id = await _confirmed_lease(client, user_store)
    _set_mpin(user_store, "uid-l1")
    _set_mpin(user_store, "uid-f1")

    resp = await client.post(
        f"/v1/land/leases/{lease_id}/esign", json=ESIGN_BODY, headers=auth(landlord)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["status"] == "active"
    assert body["role"] == "landlord"
    acceptance = user_store[f"users/uid-l1/land_leases/{lease_id}/acceptances/uid-l1"]
    assert acceptance["userId"] == "uid-l1"
    assert acceptance["signatureData"] == ESIGN_BODY["signatureData"]
    assert acceptance["consentTimestamp"] == ESIGN_BODY["consentTimestamp"]
    assert acceptance["acceptedAt"]
    assert user_store[f"users/uid-l1/land_leases/{lease_id}"]["status"] == "active"
    audits = [
        doc for key, doc in user_store.items()
        if key.startswith("audit_logs/") and doc.get("action") == "LEASE_SIGNED"
    ]
    assert len(audits) == 1
    # the tenant is notified that the landlord signed
    assert _tasks_for(user_store, "uid-f1", "lease_esign_signed")

    # tenant signs with their own MPIN
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/esign", json=ESIGN_BODY, headers=auth(farmer)
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "tenant"
    assert user_store[f"users/uid-l1/land_leases/{lease_id}/acceptances/uid-f1"]
    assert _tasks_for(user_store, "uid-l1", "lease_esign_signed")

    # a party can never sign twice
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/esign", json=ESIGN_BODY, headers=auth(farmer)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_SIGNED"


async def test_esign_rejected_after_lease_ended(client, user_store):
    landlord, _, lease_id = await _confirmed_lease(client, user_store)
    _set_mpin(user_store, "uid-l1")
    resp = await client.put(
        f"/v1/land/leases/{lease_id}", json={"status": "ended"}, headers=auth(landlord)
    )
    assert resp.status_code == 200
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/esign", json=ESIGN_BODY, headers=auth(landlord)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LEASE_NOT_SIGNABLE"


async def test_agreement_pdf_includes_acceptance_log(client, user_store, monkeypatch):
    from app.services.billing import seed_plans

    await seed_plans()
    user_store["subscriptions/sub_pro_landlord"] = {
        "subId": "sub_pro_landlord",
        "userId": "uid-l1",
        "planId": "farmLandlord_pro",
        "status": "active",
        "provider": "razorpay_sub",
        "providerRef": "sub_test_1",
        "currentPeriodEnd": "2027-01-01T00:00:00+00:00",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    monkeypatch.setattr(
        "app.services.reports.upload_to_storage",
        lambda local_path, dest_path: "https://storage.example/agreement.pdf",
    )
    landlord, farmer, lease_id = await _confirmed_lease(client, user_store)
    _set_mpin(user_store, "uid-l1")
    _set_mpin(user_store, "uid-f1")
    await client.post(
        f"/v1/land/leases/{lease_id}/esign", json=ESIGN_BODY, headers=auth(landlord)
    )
    await client.post(
        f"/v1/land/leases/{lease_id}/esign", json=ESIGN_BODY, headers=auth(farmer)
    )
    resp = await client.get(
        f"/v1/land/leases/{lease_id}/agreement-pdf", headers=auth(landlord)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["agreementUrl"] == "https://storage.example/agreement.pdf"
    signers = {a["userId"] for a in body["acceptances"]}
    assert signers == {"uid-l1", "uid-f1"}


# ---- P0-3: escrow funding & milestone release -------------------------------


async def _fund_escrow(client, farmer, lease_id):
    return await client.post(
        f"/v1/land/leases/{lease_id}/escrow/fund", json={}, headers=auth(farmer)
    )


async def test_escrow_fund_dev_shim_holds_milestones_total(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_key_id", "")
    monkeypatch.setattr(settings, "razorpay_key_secret", "")
    landlord, farmer, lease_id = await _confirmed_lease(client, user_store)
    resp = await _fund_escrow(client, farmer, lease_id)
    assert resp.status_code == 200
    body = resp.json()
    escrow = body["escrow"]
    assert escrow["status"] == "held"
    assert escrow["amountPaisa"] == ESCROW_TOTAL_PAISA
    assert escrow["releasedPaisa"] == 0
    assert escrow["disputeWindowHours"] == settings.escrow_dispute_window_hours
    assert escrow["releaseAt"] > "2026-10-17"
    assert body["razorpayOrderId"]
    lease = user_store[f"users/uid-l1/land_leases/{lease_id}"]
    assert lease["escrow"]["status"] == "held"
    assert _tasks_for(user_store, "uid-l1", "escrow_funded")
    audits = [
        doc for key, doc in user_store.items()
        if key.startswith("audit_logs/") and doc.get("action") == "LEASE_ESCROW_FUNDED"
    ]
    assert len(audits) == 1 and audits[0]["amountPaisa"] == ESCROW_TOTAL_PAISA

    # double funding is rejected
    resp = await _fund_escrow(client, farmer, lease_id)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ESCROW_ALREADY_FUNDED"


async def test_escrow_fund_landlord_forbidden(client, user_store):
    landlord, _, lease_id = await _confirmed_lease(client, user_store)
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/escrow/fund", json={}, headers=auth(landlord)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_escrow_fund_signature_verified_when_keys_set(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_key_id", "rzp_test_key")
    monkeypatch.setattr(settings, "razorpay_key_secret", "rzp_test_secret")

    def fake_create_order(amount_paise, receipt):
        return {
            "id": "order_test_1",
            "amount": amount_paise,
            "currency": "INR",
            "status": "created",
        }

    monkeypatch.setattr("app.routers.land.create_razorpay_order", fake_create_order)
    _, farmer, lease_id = await _confirmed_lease(client, user_store)
    good_signature = hmac.new(
        b"rzp_test_secret", b"order_test_1|pay_1", hashlib.sha256
    ).hexdigest()
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/escrow/fund",
        json={
            "razorpayOrderId": "order_test_1",
            "razorpayPaymentId": "pay_1",
            "razorpaySignature": good_signature,
        },
        headers=auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["escrow"]["razorpayPaymentId"] == "pay_1"

    # fresh lease, bad signature → 400
    landlord3 = _landlord(user_store, uid="uid-l3")
    farmer3 = _farmer(user_store, uid="uid-f3", phone="+919822200003")
    resp = await client.post("/v1/land/listings", json=LISTING, headers=auth(landlord3))
    listing3 = resp.json()["id"]
    resp = await client.post(
        "/v1/land/lease-requests",
        json={"listingId": listing3, "durationMonths": 12},
        headers=auth(farmer3),
    )
    resp = await client.post(
        f"/v1/land/lease-requests/{resp.json()['id']}/accept", headers=auth(landlord3)
    )
    lease3 = resp.json()["leaseId"]
    resp = await client.post(
        f"/v1/land/leases/{lease3}/escrow/fund",
        json={
            "razorpayOrderId": "order_test_1",
            "razorpayPaymentId": "pay_1",
            "razorpaySignature": "wrong",
        },
        headers=auth(farmer3),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "PAYMENT_SIGNATURE_INVALID"


async def test_milestone_release_requires_funded_escrow(client, user_store):
    landlord, _, lease_id = await _confirmed_lease(client, user_store)
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/milestones/0/release",
        json={},
        headers=auth(landlord),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ESCROW_NOT_FUNDED"


async def test_milestone_release_moves_money_and_writes_ledger(client, user_store):
    landlord, farmer, lease_id = await _confirmed_lease(client, user_store)
    resp = await _fund_escrow(client, farmer, lease_id)
    assert resp.status_code == 200

    resp = await client.post(
        f"/v1/land/leases/{lease_id}/milestones/1/release",
        json={"notes": "Mid-season inspection passed."},
        headers=auth(landlord),
    )
    assert resp.status_code == 200
    body = resp.json()
    milestone = body["milestone"]
    assert milestone["status"] == "released"
    assert milestone["releaseDate"]
    assert milestone["notes"] == "Mid-season inspection passed."

    gross = MILESTONE_PAISA[1]
    commission = int(round(gross * 0.02))
    settlement = body["settlement"]
    assert settlement["grossPaisa"] == gross
    assert settlement["commissionPaisa"] == commission
    assert settlement["netPaisa"] == gross - commission
    assert settlement["commissionPct"] == 2
    assert settlement["status"] == "released"

    escrow = body["escrow"]
    assert escrow["status"] == "held"  # partial release stays held
    assert escrow["releasedPaisa"] == gross
    assert escrow["commissionPaisa"] == commission

    ledger = user_store[f"users/uid-l1/land_leases/{lease_id}/escrow_ledger/rel_1"]
    assert ledger["grossPaisa"] == gross
    assert ledger["netPaisa"] == gross - commission
    assert ledger["milestoneName"] == milestone["name"]
    assert ledger["tenantFarmerId"] == "uid-f1"
    assert ledger["retainUntil"]

    milestones_doc = user_store[f"leases/{lease_id}/escrow/milestones"]
    assert milestones_doc["milestones"][1]["status"] == "released"

    audits = [
        doc for key, doc in user_store.items()
        if key.startswith("audit_logs/")
        and doc.get("action") == "LEASE_MILESTONE_RELEASED"
    ]
    assert len(audits) == 1 and audits[0]["milestoneIndex"] == 1

    # landlord P&L auto-entry + tenant notification
    entry_id = "auto_lease_milestone_release__rel_1"
    assert user_store[f"users/uid-l1/diary_entries/{entry_id}"]["amount"] == round(
        (gross - commission) / 100, 2
    )
    assert _tasks_for(user_store, "uid-f1", "milestone_released")

    # a released milestone cannot be released twice
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/milestones/1/release",
        json={},
        headers=auth(landlord),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "MILESTONE_ALREADY_RELEASED"


async def test_milestone_release_tenant_forbidden(client, user_store):
    landlord, farmer, lease_id = await _confirmed_lease(client, user_store)
    resp = await _fund_escrow(client, farmer, lease_id)
    assert resp.status_code == 200
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/milestones/0/release",
        json={},
        headers=auth(farmer),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_full_milestone_release_marks_escrow_released(client, user_store):
    landlord, farmer, lease_id = await _confirmed_lease(client, user_store)
    await _fund_escrow(client, farmer, lease_id)
    for index in (0, 1, 2):
        resp = await client.post(
            f"/v1/land/leases/{lease_id}/milestones/{index}/release",
            json={},
            headers=auth(landlord),
        )
        assert resp.status_code == 200
    lease = user_store[f"users/uid-l1/land_leases/{lease_id}"]
    assert lease["escrow"]["status"] == "released"
    assert lease["escrow"]["releasedPaisa"] == ESCROW_TOTAL_PAISA


# ---- P1-25: payout dashboard -------------------------------------------------


async def test_land_settlements_view(client, user_store):
    landlord, farmer, lease_id = await _confirmed_lease(client, user_store)
    await _fund_escrow(client, farmer, lease_id)
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/milestones/0/release",
        json={},
        headers=auth(landlord),
    )
    assert resp.status_code == 200

    resp = await client.get("/v1/land/settlements", headers=auth(landlord))
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["escrowReleases"]) == 1
    release = body["escrowReleases"][0]
    assert release["leaseId"] == lease_id
    assert release["tenantName"] == "Sunil Pawar"
    gross = MILESTONE_PAISA[0]
    commission = int(round(gross * 0.02))
    breakdown = body["commissionBreakdown"]
    assert breakdown["grossPaisa"] == gross
    assert breakdown["commissionPaisa"] == commission
    assert breakdown["netPaisa"] == gross - commission
    assert breakdown["releaseCount"] == 1
    assert breakdown["byLease"][0]["leaseId"] == lease_id
    assert body["bankSettlements"]["total"] == 0
    assert body["pendingSettlementPaisa"] == gross - commission

    # other landlords see nothing
    other = _landlord(user_store, uid="uid-l9")
    resp = await client.get("/v1/land/settlements", headers=auth(other))
    assert resp.status_code == 200
    assert resp.json()["escrowReleases"] == []

    # farmers have no landlord payout dashboard
    resp = await client.get("/v1/land/settlements", headers=auth(farmer))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


# ---- P1-26: post-confirmation chat room --------------------------------------


async def test_chat_room_lazy_create_idempotent(client, user_store):
    landlord, farmer, lease_id = await _confirmed_lease(client, user_store)
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/chat-room", headers=auth(landlord)
    )
    assert resp.status_code == 200
    room = resp.json()
    assert room["id"] == f"land_lease_{lease_id}"
    assert room["kind"] == "land_lease"
    assert room["leaseId"] == lease_id
    assert room["landlordId"] == "uid-l1"
    assert room["farmerId"] == "uid-f1"
    assert room["farmerName"] == "Sunil"
    assert room["buyerId"] == "uid-l1"
    assert room["buyerName"] == "Landlord"
    assert room["lastMessageAt"] is None
    assert user_store[f"chat_rooms/land_lease_{lease_id}"]["kind"] == "land_lease"

    # the tenant hits the same lazy create → same room, no duplicate
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/chat-room", headers=auth(farmer)
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == f"land_lease_{lease_id}"
    rooms = [key for key in user_store if key.startswith("chat_rooms/")]
    assert rooms == [f"chat_rooms/land_lease_{lease_id}"]


async def test_chat_room_locked_until_confirmed_and_for_outsiders(client, user_store):
    landlord, _, lease_id = await _confirmed_lease(client, user_store)
    resp = await client.put(
        f"/v1/land/leases/{lease_id}", json={"status": "ended"}, headers=auth(landlord)
    )
    assert resp.status_code == 200
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/chat-room", headers=auth(landlord)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CHAT_LOCKED"

    outsider = _farmer(user_store, uid="uid-x1", phone="+919833300003")
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/chat-room", headers=auth(outsider)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LEASE_NOT_FOUND"
