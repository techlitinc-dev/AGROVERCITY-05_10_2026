"""P0-5 / P0-6 / P1-9 / P1-10 / P1-11 / P1-12 / P2-8: the missing broker-deal
endpoints — escrow payout release (B12/E7), e-contract + MPIN e-sign (C5/F6),
delivery milestones + E6 pro-rata adjustment (F9/B9), post-acceptance chat
(D1/B7), farmer-side dispute (C9), vehicle details with masked plate (B8) and
the deal receipt PDF (F12). Everything drives the real API over the ASGI
client; `release_deal_escrow` is imported here because the nightly payout job
imports it from app.routers.broker."""
from datetime import datetime, timedelta, timezone

from app.core.security import hash_mpin
from app.routers.broker import release_deal_escrow
from tests.test_broker_deals import DEAL_BODY, _notifications_for, _seed_broker, _seed_farmer
from tests.test_diary import auth, seed_user

FULL_PLATE = "MH 12 AB 3456"
MASKED_PLATE = "MH 12 •• 3456"


def _verify_broker_kyc(user_store, uid="uid-b1"):
    """stands in for the admin KYC review: arhtiya licence + GST verified."""
    user_store[f"kyc_cases/kyc_{uid[:8]}_broker"] = {
        "caseId": f"kyc_{uid[:8]}_broker",
        "userId": uid,
        "persona": "broker",
        "status": "verified",
        "docs": [
            {"docId": f"kyc_{uid[:8]}_broker:arhtiya_licence", "type": "arhtiya_licence", "status": "verified"},
            {"docId": f"kyc_{uid[:8]}_broker:gst", "type": "gst", "status": "verified"},
        ],
    }


async def _create_deal(client, broker, **overrides):
    resp = await client.post("/v1/broker/deals", json={**DEAL_BODY, **overrides}, headers=auth(broker))
    assert resp.status_code == 201
    return resp.json()["id"]


async def _issue_and_accept(client, user_store, broker, farmer, deal_id):
    resp = await client.put(
        f"/v1/broker/deals/{deal_id}", json={"status": "contract_issued"}, headers=auth(broker)
    )
    assert resp.status_code == 200
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond", json={"action": "accept"}, headers=auth(farmer)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"


async def _accepted_deal(client, user_store):
    broker = _seed_broker(user_store)
    farmer = _seed_farmer(user_store)  # seeded before create → sellerUid resolved
    deal_id = await _create_deal(client, broker)
    await _issue_and_accept(client, user_store, broker, farmer, deal_id)
    return broker, farmer, deal_id


# ---- P0-5: escrow hold at capture + payout release (B12/E7) ----


async def _captured_deal(client, user_store):
    broker = _seed_broker(user_store)
    _verify_broker_kyc(user_store)
    farmer = _seed_farmer(user_store)
    deal_id = await _create_deal(client, broker)
    await _issue_and_accept(client, user_store, broker, farmer, deal_id)
    resp = await client.post(f"/v1/broker/deals/{deal_id}/payment-capture", headers=auth(broker))
    assert resp.status_code == 200
    return broker, farmer, deal_id


async def test_capture_holds_farmer_leg_in_escrow(client, user_store):
    broker, farmer, deal_id = await _captured_deal(client, user_store)

    resp = await client.post(f"/v1/broker/deals/{deal_id}/payment-capture", headers=auth(broker))
    assert resp.status_code == 409  # ALREADY_CAPTURED
    deal = user_store[f"broker_deals/{deal_id}"]
    escrow = deal["escrow"]
    assert escrow["status"] == "held"
    assert escrow["amountPaisa"] == 11000000  # the captured gross is held
    assert escrow["disputeWindowHours"] == 48
    assert escrow["releaseAt"] is None  # delivery not confirmed yet

    # the payment record itself is unchanged (legs still sum to the gross)
    capture = deal["paymentCapture"]
    assert capture["farmerLegPaisa"] + capture["commissionLegPaisa"] == capture["grossPaisa"]


async def test_release_payout_after_silent_window_splits_escrow(client, user_store):
    broker, farmer, deal_id = await _captured_deal(client, user_store)

    # no delivery yet → the release window is not even running
    resp = await client.post(f"/v1/broker/deals/{deal_id}/release-payout", headers=auth(broker))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "RELEASE_WINDOW_OPEN"

    # broker confirms delivery via milestone → releaseAt = deliveredAt + 48h
    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/milestones", json={"type": "delivered"}, headers=auth(broker)
    )
    assert resp.status_code == 201
    escrow = user_store[f"broker_deals/{deal_id}"]["escrow"]
    assert escrow["releaseAt"]
    release_at = datetime.fromisoformat(escrow["releaseAt"])
    assert timedelta(hours=47) < release_at - datetime.now(timezone.utc) < timedelta(hours=49)

    # window still open → refused
    resp = await client.post(f"/v1/broker/deals/{deal_id}/release-payout", headers=auth(broker))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "RELEASE_WINDOW_OPEN"

    # silent window closes → the split lands: farmer settlement + platform commission
    user_store[f"broker_deals/{deal_id}"]["escrow"]["releaseAt"] = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    ).isoformat()
    resp = await client.post(f"/v1/broker/deals/{deal_id}/release-payout", headers=auth(broker))
    assert resp.status_code == 200
    escrow = resp.json()["escrow"]
    assert escrow["status"] == "released"
    assert escrow["commissionPaisa"] == 220000
    assert escrow["netReleasePaisa"] == 10780000

    settlement = user_store[f"settlements/st_deal_farmer_{deal_id}"]
    assert settlement["role"] == "farmer"
    assert settlement["entityId"] == "uid-f1"
    assert settlement["grossRupees"] == 110000
    assert settlement["commissionRupees"] == 2200
    assert settlement["netRupees"] == 107800
    assert settlement["status"] == "pending"

    audits = [
        d for k, d in user_store.items()
        if k.startswith("audit_logs/") and d.get("action") == "DEAL_ESCROW_RELEASED"
    ]
    assert len(audits) == 1
    assert audits[0]["farmerLegPaisa"] == 10780000

    notes = _notifications_for(user_store, "uid-f1")
    assert any(n["type"] == "deal_payout_released" for n in notes)

    # releasing again is a no-op error
    resp = await client.post(f"/v1/broker/deals/{deal_id}/release-payout", headers=auth(broker))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"


async def test_capture_after_delivery_releases_without_manual_wait(client, user_store):
    """E7 auto-release: capture late (post-delivery) starts the clock at
    deliveredAt, so a delivery 49h ago is immediately releasable."""
    broker = _seed_broker(user_store)
    _verify_broker_kyc(user_store)
    farmer = _seed_farmer(user_store)
    deal_id = await _create_deal(client, broker)
    await _issue_and_accept(client, user_store, broker, farmer, deal_id)
    delivered_at = (datetime.now(timezone.utc) - timedelta(hours=49)).isoformat()
    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/milestones",
        json={"type": "delivered", "at": delivered_at},
        headers=auth(broker),
    )
    assert resp.status_code == 201
    resp = await client.put(
        f"/v1/broker/deals/{deal_id}", json={"status": "in_transit"}, headers=auth(broker)
    )
    assert resp.status_code == 200

    resp = await client.post(f"/v1/broker/deals/{deal_id}/payment-capture", headers=auth(broker))
    assert resp.status_code == 200
    release_at = datetime.fromisoformat(resp.json()["escrow"]["releaseAt"])
    assert release_at < datetime.now(timezone.utc)  # deliveredAt + 48h already passed

    resp = await client.post(f"/v1/broker/deals/{deal_id}/release-payout", headers=auth(broker))
    assert resp.status_code == 200
    assert resp.json()["escrow"]["status"] == "released"


async def test_release_deal_escrow_is_importable_for_nightly_job():
    import inspect

    assert inspect.iscoroutinefunction(release_deal_escrow)


# ---- P1-11: farmer-side dispute pauses the release (C9 + P0-5) ----


async def test_farmer_dispute_freezes_payout_release(client, user_store):
    broker, farmer, deal_id = await _captured_deal(client, user_store)
    user_store[f"broker_deals/{deal_id}"]["escrow"]["releaseAt"] = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    ).isoformat()

    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/disputes",
        json={"category": "payment", "reason": "buyer short-paid by ₹4,000"},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    dispute = resp.json()
    assert dispute["dealId"] == deal_id
    assert dispute["category"] == "payment"
    assert dispute["status"] == "open"
    assert dispute["slaHours"] == 72

    # canonical dispute triage + escrow pause + evidence freeze
    canonical = [d for k, d in user_store.items() if k.startswith("disputes/")]
    assert len(canonical) == 1
    assert canonical[0]["source"] == "broker_deal"
    assert canonical[0]["sourceId"] == deal_id
    deal = user_store[f"broker_deals/{deal_id}"]
    assert deal["escrow"]["disputeOpenedAt"]
    assert deal["evidenceFrozenAt"]

    # the payout release is paused while the dispute is open
    resp = await client.post(f"/v1/broker/deals/{deal_id}/release-payout", headers=auth(broker))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DISPUTE_OPEN"

    # broker + admin queue are notified
    notes = _notifications_for(user_store, "uid-b1")
    assert any(n["type"] == "deal_dispute_opened" for n in notes)
    tasks = [d for k, d in user_store.items() if k.startswith("tasks/")]
    assert any(t["kind"] == "deal_dispute_opened" for t in tasks)


async def test_farmer_dispute_guardrails(client, user_store):
    broker, farmer, deal_id = await _accepted_deal(client, user_store)

    # a second open dispute is refused
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/disputes",
        json={"category": "quality", "reason": "moisture above 12%"},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/disputes",
        json={"category": "delivery"},
        headers=auth(farmer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DISPUTE_ALREADY_OPEN"

    # a stranger farmer cannot dispute (404, no existence leak)
    stranger = seed_user(user_store, uid="uid-f9", active_profile="farmer", phone="+917777777777")
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/disputes",
        json={"category": "payment"},
        headers=auth(stranger),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DEAL_NOT_FOUND"

    # a negotiating deal cannot be disputed
    deal2 = await _create_deal(client, broker, sellerPhone="+919876500099")
    farmer2 = seed_user(user_store, uid="uid-f2", active_profile="farmer", phone="+919876500099")
    resp = await client.post(
        f"/v1/farmer/deals/{deal2}/disputes",
        json={"category": "payment"},
        headers=auth(farmer2),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"


# ---- P0-6: MPIN e-sign on farmer accept (C5/F6) ----


async def test_accept_without_mpin_records_consent_when_no_mpin_set(client, user_store):
    broker, farmer, deal_id = await _accepted_deal(client, user_store)

    acceptance = user_store[f"broker_deals/{deal_id}/acceptances/uid-f1"]
    assert acceptance["userId"] == "uid-f1"
    assert acceptance["acceptedAt"]
    assert acceptance["consentTimestamp"]  # consent recorded even without MPIN
    assert acceptance["signatureData"] == ""


async def test_accept_mpin_gate_when_farmer_has_mpin(client, user_store):
    broker = _seed_broker(user_store)
    farmer = seed_user(
        user_store, uid="uid-f1", active_profile="farmer",
        name="Ram Patil", phone="+919876500006", mpinHash=hash_mpin("1234"),
    )
    deal_id = await _create_deal(client, broker)
    await client.put(
        f"/v1/broker/deals/{deal_id}", json={"status": "contract_issued"}, headers=auth(broker)
    )

    # missing MPIN → 401
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond", json={"action": "accept"}, headers=auth(farmer)
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"

    # wrong MPIN → 401
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond",
        json={"action": "accept", "mpin": "9999"},
        headers=auth(farmer),
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"

    # correct MPIN + signature payload → accepted, acceptance subdoc recorded
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond",
        json={
            "action": "accept",
            "mpin": "1234",
            "signatureData": "sig-abc-123",
            "consentTimestamp": "2026-10-17T10:00:00+00:00",
        },
        headers=auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
    acceptance = user_store[f"broker_deals/{deal_id}/acceptances/uid-f1"]
    assert acceptance["signatureData"] == "sig-abc-123"
    assert acceptance["consentTimestamp"] == "2026-10-17T10:00:00+00:00"


async def test_contract_pdf_terms_acceptance_log_and_hash(client, user_store):
    broker, farmer, deal_id = await _accepted_deal(client, user_store)

    for token in (broker, farmer):
        resp = await client.get(f"/v1/broker/deals/{deal_id}/contract", headers=auth(token))
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:5] == b"%PDF-"
        assert len(resp.content) > 800  # terms + acceptance log + hash rendered

    # a stranger is not a deal party → 404 (never a 403 leak)
    stranger = seed_user(user_store, uid="uid-f9", active_profile="farmer", phone="+917777777777")
    resp = await client.get(f"/v1/broker/deals/{deal_id}/contract", headers=auth(stranger))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DEAL_NOT_FOUND"


# ---- P1-9: delivery milestones + E6 pro-rata adjustment (F9/B9) ----


async def test_milestones_crud_and_farmer_view(client, user_store):
    broker, farmer, deal_id = await _accepted_deal(client, user_store)

    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/milestones",
        json={"type": "departed", "note": "truck left the farm gate", "at": "2026-10-17T05:00:00+00:00"},
        headers=auth(broker),
    )
    assert resp.status_code == 201
    milestone = resp.json()
    assert milestone["type"] == "departed"
    assert milestone["dealId"] == deal_id
    assert milestone["createdBy"] == "uid-b1"
    assert milestone["at"] == "2026-10-17T05:00:00+00:00"

    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/milestones",
        json={"type": "in_transit", "at": "2026-10-17T06:30:00+00:00"},
        headers=auth(broker),
    )
    assert resp.status_code == 201
    assert resp.json()["at"] == "2026-10-17T06:30:00+00:00"

    # broker lists them in chronological order
    resp = await client.get(f"/v1/broker/deals/{deal_id}/milestones", headers=auth(broker))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert [m["type"] for m in body["data"]] == ["departed", "in_transit"]

    # farmer has a read view of the tracking events
    resp = await client.get(f"/v1/farmer/deals/{deal_id}/milestones", headers=auth(farmer))
    assert resp.status_code == 200
    assert resp.json()["total"] == 2

    # a farmer cannot push milestones (broker only)
    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/milestones",
        json={"type": "arrived"},
        headers=auth(farmer),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

    # a foreign broker sees nothing
    broker2 = _seed_broker(user_store, uid="uid-b2")
    resp = await client.get(f"/v1/broker/deals/{deal_id}/milestones", headers=auth(broker2))
    assert resp.status_code == 404


async def test_weighed_mismatch_raises_pro_rata_proposal(client, user_store):
    broker, farmer, deal_id = await _accepted_deal(client, user_store)

    # within tolerance (1% under the booked 5000kg): no proposal
    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/milestones",
        json={"type": "weighed", "weightKg": 4950},
        headers=auth(broker),
    )
    assert resp.status_code == 201
    assert "adjustmentProposal" not in user_store[f"broker_deals/{deal_id}"]

    # 20% short: E6 pro-rata adjustment proposed on the deal
    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/milestones",
        json={"type": "weighed", "weightKg": 4000, "note": "kanta weighbridge slip"},
        headers=auth(broker),
    )
    assert resp.status_code == 201
    assert resp.json()["weightKg"] == 4000
    proposal = user_store[f"broker_deals/{deal_id}"]["adjustmentProposal"]
    assert proposal["kind"] == "pro_rata_weighbridge"
    assert proposal["claimedQuantityQuintals"] == 50
    assert proposal["weighedQuantityQuintals"] == 40
    assert proposal["variancePct"] == 20.0
    assert proposal["tolerancePct"] == 2.0
    # pro-rata: 40q × ₹2200 = ₹88,000 gross − 2% commission = ₹86,240 payout
    assert proposal["adjustedGrossAmount"] == 88000
    assert proposal["adjustedCommissionAmount"] == 1760
    assert proposal["adjustedPayout"] == 86240
    assert proposal["status"] == "proposed"
    assert proposal["disputeWindowHours"] == 24

    # the farmer is told and can dispute within the window
    notes = _notifications_for(user_store, "uid-f1")
    assert any(n["type"] == "deal_adjustment_proposed" for n in notes)


async def test_milestones_require_post_acceptance(client, user_store):
    broker = _seed_broker(user_store)
    _seed_farmer(user_store)
    deal_id = await _create_deal(client, broker)
    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/milestones",
        json={"type": "departed"},
        headers=auth(broker),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"

    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/milestones",
        json={"type": "departed", "at": "not-a-date"},
        headers=auth(broker),
    )
    assert resp.status_code in (409, 422)


# ---- P1-10: post-acceptance deal chat (D1/B7) ----


async def test_chat_room_lazy_create_and_gate(client, user_store):
    broker, farmer, deal_id = await _accepted_deal(client, user_store)

    resp = await client.post(f"/v1/broker/deals/{deal_id}/chat-room", headers=auth(broker))
    assert resp.status_code == 201
    room = resp.json()
    assert room["id"] == deal_id
    assert room["kind"] == "broker_deal"
    assert room["dealId"] == deal_id
    assert room["farmerId"] == "uid-f1"
    assert room["buyerId"] == "uid-b1"
    assert room["crop"] == "Onion"
    assert user_store[f"chat_rooms/{deal_id}"]["kind"] == "broker_deal"

    # idempotent — the same room comes back
    resp = await client.post(f"/v1/broker/deals/{deal_id}/chat-room", headers=auth(broker))
    assert resp.status_code == 201
    assert resp.json()["id"] == deal_id
    assert len([k for k in user_store if k.startswith("chat_rooms/")]) == 1

    # pre-acceptance deals stay locked (spec D1)
    deal2 = await _create_deal(client, broker)
    resp = await client.post(f"/v1/broker/deals/{deal2}/chat-room", headers=auth(broker))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CHAT_LOCKED"


# ---- P1-12: vehicle & pickup details with masked plate (B8) ----


async def test_vehicle_details_masked_in_every_deal_read(client, user_store):
    broker, farmer, deal_id = await _accepted_deal(client, user_store)

    resp = await client.put(
        f"/v1/broker/deals/{deal_id}/vehicle",
        json={"vehicleType": "Truck", "vehicleNumber": FULL_PLATE, "driverName": "Suresh Yadav"},
        headers=auth(broker),
    )
    assert resp.status_code == 200
    assert resp.json()["vehicle"]["vehicleNumber"] == MASKED_PLATE
    assert resp.json()["vehicle"]["vehicleType"] == "Truck"
    assert resp.json()["vehicle"]["driverName"] == "Suresh Yadav"

    # stored in full, masked in every serializer
    assert user_store[f"broker_deals/{deal_id}"]["vehicle"]["vehicleNumber"] == FULL_PLATE
    resp = await client.get(f"/v1/broker/deals/{deal_id}", headers=auth(broker))
    assert resp.json()["vehicle"]["vehicleNumber"] == MASKED_PLATE
    resp = await client.get("/v1/broker/deals", headers=auth(broker))
    assert resp.json()["data"][0]["vehicle"]["vehicleNumber"] == MASKED_PLATE
    resp = await client.get(f"/v1/farmer/deals/{deal_id}", headers=auth(farmer))
    assert resp.json()["vehicle"]["vehicleNumber"] == MASKED_PLATE
    resp = await client.get("/v1/farmer/deals", headers=auth(farmer))
    assert resp.json()["data"][0]["vehicle"]["vehicleNumber"] == MASKED_PLATE


async def test_vehicle_update_guardrails(client, user_store):
    broker, farmer, deal_id = await _accepted_deal(client, user_store)

    # farmers cannot set vehicle details
    resp = await client.put(
        f"/v1/broker/deals/{deal_id}/vehicle",
        json={"vehicleType": "Truck", "vehicleNumber": FULL_PLATE, "driverName": "X"},
        headers=auth(farmer),
    )
    assert resp.status_code == 403

    # foreign broker gets a 404
    broker2 = _seed_broker(user_store, uid="uid-b2")
    resp = await client.put(
        f"/v1/broker/deals/{deal_id}/vehicle",
        json={"vehicleType": "Truck", "vehicleNumber": FULL_PLATE, "driverName": "X"},
        headers=auth(broker2),
    )
    assert resp.status_code == 404

    # vehicle details are a post-acceptance action
    deal2 = await _create_deal(client, broker)
    resp = await client.put(
        f"/v1/broker/deals/{deal2}/vehicle",
        json={"vehicleType": "Truck", "vehicleNumber": FULL_PLATE, "driverName": "X"},
        headers=auth(broker),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"


# ---- P2-8: deal receipt PDF (F12) ----


async def test_receipt_pdf_for_deal_parties(client, user_store):
    broker, farmer, deal_id = await _accepted_deal(client, user_store)

    for token in (broker, farmer):
        resp = await client.get(f"/v1/broker/deals/{deal_id}/receipt", headers=auth(token))
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:5] == b"%PDF-"
        assert len(resp.content) > 500

    stranger = seed_user(user_store, uid="uid-f9", active_profile="farmer", phone="+917777777777")
    resp = await client.get(f"/v1/broker/deals/{deal_id}/receipt", headers=auth(stranger))
    assert resp.status_code == 404
