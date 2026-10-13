"""Equipment rental hub: verification (DigiLocker/PAN/RC/insurance) + badge,
blacklist/reports/risk signals, demand-posting + heatmap + ranking +
recommendations, contracts (versions, MPIN e-sign, real PDF), payments
(advance/balance/refund/invoice), disputes (evidence + SLA), monitoring,
settlements, commission and policy config.

All assertions run against docs created through the API or real collection
docs seeded into the store — no demo/fake fallback data.
"""

from datetime import datetime, timedelta, timezone

from app.core.security import hash_mpin
from app.services.tokens import create_access_token
from tests.test_equipment import second_farmer_token
from tests.test_users import _auth, _register

IST = timezone(timedelta(hours=5, minutes=30))
NOW = datetime.now(timezone.utc)


def _tomorrow():
    return (datetime.now(IST).date() + timedelta(days=1)).isoformat()


async def _owner_token(client, **overrides):
    resp = await _register(
        client, profiles=["farmer", "equipmentRental"], primaryProfile="equipmentRental", **overrides
    )
    return resp.json()["accessToken"]


def _machine(user_store, uid, eid="eq-9", **overrides):
    doc = {
        "id": eid,
        "name": "John Deere 5050",
        "type": "tractor",
        "ownerType": "private",
        "ownerId": uid,
        "hourlyRate": 700,
        "perAcreRate": None,
        "distanceKm": 3,
        "slotTemplate": None,
        "active": True,
        "docStatus": "verified",
        "rejectionReason": None,
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    doc.update(overrides)
    user_store[f"equipment/{eid}"] = doc
    return doc


def _booking(user_store, bid, equipment_id, owner_id, farmer_id="uid-2", status="booked", **extra):
    doc = {
        "id": bid,
        "userId": farmer_id,
        "farmerName": "Sham Rao",
        "slotId": f"slot_{bid}",
        "equipmentId": equipment_id,
        "date": _tomorrow(),
        "slotName": "6:00 AM – 10:00 AM",
        "priceRupees": 2000.0,
        "ownerType": "private",
        "status": status,
        "createdAt": NOW.isoformat(),
    }
    doc.update(extra)
    user_store[f"equipment_bookings/{bid}"] = doc
    return doc


def _notifications_for(user_store, uid, ntype):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/")
        and doc.get("userId") == uid
        and doc.get("type") == ntype
    ]


# ---------------- 1. verification + badge ----------------


async def test_verification_documents_and_badge_flow(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)

    # farmer blocked from the owner surface
    resp = await client.post(
        "/v1/equipment-rental/verification/documents",
        json={"docType": "pan", "fileUrl": "gs://b/pan.pdf"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 403

    for doc_type, url in (
        ("pan", "gs://b/pan.pdf"),
        ("equipment_rc", "gs://b/rc.pdf"),
        ("equipment_insurance", "gs://b/ins.pdf"),
    ):
        resp = await client.post(
            "/v1/equipment-rental/verification/documents",
            json={"docType": doc_type, "fileUrl": url, "referenceNo": "RC-2026"},
            headers=_auth(token),
        )
        assert resp.status_code == 201
        assert resp.json()["document"]["status"] == "pending"

    # bad doc type
    resp = await client.post(
        "/v1/equipment-rental/verification/documents",
        json={"docType": "aadhaar", "fileUrl": "gs://b/a.pdf"},
        headers=_auth(token),
    )
    assert resp.status_code == 422

    # status: not verified yet (all pending)
    resp = await client.get("/v1/equipment-rental/verification/status", headers=_auth(token))
    body = resp.json()
    assert body["caseStatus"] == "pending"
    assert body["badge"]["verified"] is False
    assert body["badge"]["docStatuses"]["equipment_rc"] == "pending"

    # admin verifies every doc -> badge granted
    case = user_store["kyc_cases/kyc_uid-1_equipmentRental"]
    for d in case["docs"]:
        d["status"] = "verified"
        d["reviewedAt"] = "2026-10-11T00:00:00+00:00"
    case["status"] = "verified"
    _machine(user_store, "uid-1")
    resp = await client.get("/v1/equipment-rental/badge", headers=_auth(token))
    body = resp.json()
    assert body["verified"] is True
    assert body["verifiedAt"] == "2026-10-11T00:00:00+00:00"
    assert body["verifiedMachineIds"] == ["eq-9"]


async def test_digilocker_pan_counts_as_identity(client, user_store):
    token = await _owner_token(client)
    for doc_type in ("digilocker_pan", "equipment_rc", "equipment_insurance"):
        await client.post(
            "/v1/equipment-rental/verification/documents",
            json={"docType": doc_type, "fileUrl": "gs://b/x.pdf"},
            headers=_auth(token),
        )
    case = user_store["kyc_cases/kyc_uid-1_equipmentRental"]
    for d in case["docs"]:
        d["status"] = "verified"
    resp = await client.get("/v1/equipment-rental/verification/status", headers=_auth(token))
    assert resp.json()["badge"]["verified"] is True


# ---------------- 2. blacklist / reports / risk ----------------


async def test_blacklist_and_report_user(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)

    resp = await client.post(
        "/v1/equipment-rental/blacklist",
        json={"userId": "uid-2", "reason": "no-show twice"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    resp = await client.get("/v1/equipment-rental/blacklist", headers=_auth(token))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["reason"] == "no-show twice"

    resp = await client.post(
        "/v1/equipment-rental/reports",
        json={"targetUserId": "uid-2", "bookingId": "eqb_x", "reason": "damaged machine", "details": "broken PTO shaft"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    resp = await client.get("/v1/equipment-rental/reports", headers=_auth(token))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["status"] == "open"

    # farmer cannot reach the owner surface
    resp = await client.get("/v1/equipment-rental/blacklist", headers=_auth(farmer))
    assert resp.status_code == 403

    # remove from blacklist
    resp = await client.delete("/v1/equipment-rental/blacklist/uid-2", headers=_auth(token))
    assert resp.status_code == 204
    resp = await client.get("/v1/equipment-rental/blacklist", headers=_auth(token))
    assert resp.json()["total"] == 0


async def test_farmer_risk_and_duplicate_detection(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)  # uid-2, phone +919876543210
    # duplicate account sharing the same phone
    user_store["users/uid-2"]["phone"] = "+919876543210"
    user_store["users/uid-f3"] = {
        "id": "uid-f3", "name": "Sham Duplicate", "phone": "+919876543210",
        "linkedProfiles": ["farmer"], "activeProfile": "farmer", "createdAt": NOW.isoformat(),
    }
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="cancelled")
    _booking(user_store, "eqb_2", "eq-9", "uid-1", status="cancelled")
    user_store["user_reports/rep_1"] = {
        "id": "rep_1", "reporterId": "uid-1", "targetUserId": "uid-2", "module": "equipment",
        "reason": "suspected fraud", "status": "open", "createdAt": NOW.isoformat(),
    }
    resp = await client.get("/v1/equipment-rental/risk/farmers", headers=_auth(token))
    assert resp.status_code == 200
    row = resp.json()["data"][0]
    assert row["farmerId"] == "uid-2"
    kinds = {s["kind"] for s in row["signals"]}
    assert {"new_account", "repeat_cancellations", "open_reports", "duplicate_account"} <= kinds
    assert row["riskLevel"] == "high"


# ---------------- 3. demand posting + heatmap + ranking + recommendations ----------------


async def test_farmer_demand_posts_and_heatmap(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    resp = await client.post(
        "/v1/equipment/demand-posts",
        json={
            "machineType": "harvester", "acres": 12, "dateFrom": _tomorrow(),
            "dateTo": (datetime.now(IST).date() + timedelta(days=5)).isoformat(),
            "village": "Pimplas", "budgetPerHourRupees": 1200,
        },
        headers=_auth(farmer),
    )
    assert resp.status_code == 201
    assert resp.json()["id"].startswith("eqd_")

    # owner browses the live demand
    resp = await client.get("/v1/equipment/demand-posts", headers=_auth(token))
    assert resp.json()["total"] == 1

    # heatmap surfaces the demand gap
    resp = await client.get("/v1/equipment-rental/demand-heatmap", headers=_auth(token))
    heat = {h["machineType"]: h for h in resp.json()["data"]}
    assert heat["harvester"]["demandPosts"] == 1
    assert heat["harvester"]["acres"] == 12.0

    # recommendations: harvester is a demand gap (owner only lists tractors)
    resp = await client.get("/v1/equipment-rental/recommendations", headers=_auth(token))
    gaps = resp.json()["demandGaps"]
    assert any(g["machineType"] == "harvester" for g in gaps)

    # validation: inverted window
    resp = await client.post(
        "/v1/equipment/demand-posts",
        json={"machineType": "harvester", "dateFrom": "2026-12-01", "dateTo": "2026-11-01"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"

    # owner deletes own post flow (farmer deletes his own)
    post_id = (await client.get("/v1/equipment/demand-posts", headers=_auth(token))).json()["data"][0]["id"]
    resp = await client.delete(f"/v1/equipment/demand-posts/{post_id}", headers=_auth(token))
    assert resp.status_code == 404  # not the poster
    resp = await client.delete(f"/v1/equipment/demand-posts/{post_id}", headers=_auth(farmer))
    assert resp.status_code == 204


async def test_ranking_explain(client, user_store):
    token = await _owner_token(client)
    _machine(user_store, "uid-1")
    resp = await client.get("/v1/equipment-rental/ranking/explain", headers=_auth(token))
    body = resp.json()
    assert body["plan"]["planId"] == "equipmentRental_free"
    row = body["data"][0]
    assert row["factors"]["planPriority"] == 1  # free plan, no priorityListing
    assert row["factors"]["docStatus"] == "verified"
    assert "planPriority" in body["rules"]


# ---------------- 4. contracts: versions, e-sign, PDF ----------------


async def test_contract_versions_esign_and_pdf(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="booked", priceRupees=2000.0)
    user_store["equipment_slots/slot_eqb_1"] = {
        "id": "slot_eqb_1", "equipmentId": "eq-9", "date": _tomorrow(),
        "slotName": "6:00 AM – 10:00 AM", "duration": "4 hours", "status": "booked",
    }

    # generate v1, then regenerate -> v2 with history
    resp = await client.post("/v1/equipment/bookings/eqb_1/contract", headers=_auth(token))
    assert resp.status_code == 201
    assert resp.json()["currentVersion"] == 1
    assert resp.json()["versions"][0]["scope"]["equipmentName"] == "John Deere 5050"
    assert resp.json()["versions"][0]["rateRupees"] == 2000.0
    assert len(resp.json()["versions"][0]["terms"]) == 4

    resp = await client.post("/v1/equipment/bookings/eqb_1/contract", headers=_auth(token))
    doc = resp.json()
    assert doc["currentVersion"] == 2
    assert len(doc["versions"]) == 2

    # both parties read the contract + history
    resp = await client.get("/v1/equipment/bookings/eqb_1/contract", headers=_auth(farmer))
    assert resp.json()["currentVersion"] == 2

    # e-sign requires an MPIN
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/contract/esign",
        json={"mpin": "1234", "consentTimestamp": NOW.isoformat()},
        headers=_auth(farmer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "MPIN_NOT_SET"

    user_store["users/uid-2"]["mpinHash"] = hash_mpin("4321")
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/contract/esign",
        json={"mpin": "1234", "consentTimestamp": NOW.isoformat()},
        headers=_auth(farmer),
    )
    assert resp.status_code == 403  # wrong mpin
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/contract/esign",
        json={"mpin": "4321", "consentTimestamp": NOW.isoformat()},
        headers=_auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "signed"
    assert resp.json()["esign"]["version"] == 2
    # owner got the contract-signed notification
    assert len(_notifications_for(user_store, "uid-1", "equipment_contract")) == 1

    # regenerating voids the signature
    resp = await client.post("/v1/equipment/bookings/eqb_1/contract", headers=_auth(token))
    assert resp.json()["status"] == "generated"
    assert resp.json()["esign"] is None

    # real PDF via reportlab into dev storage
    resp = await client.get("/v1/equipment/bookings/eqb_1/contract/pdf", headers=_auth(farmer))
    assert resp.status_code == 200
    assert resp.json()["pdfUrl"].startswith("file://")
    assert resp.json()["version"] == 3


# ---------------- 5. payments / refund / invoice ----------------


async def test_advance_refund_and_invoice(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="completed", priceRupees=2000.0)

    # farmer pays advance then balance (split payment)
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/payments",
        json={"amountRupees": 800, "kind": "advance", "method": "upi", "reference": "u1"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 201
    assert resp.json()["paidRupees"] == 800
    assert resp.json()["dueRupees"] == 1200
    # owner notified
    assert len(_notifications_for(user_store, "uid-1", "equipment_payment")) == 1

    # overpay blocked
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/payments",
        json={"amountRupees": 5000, "kind": "balance"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PAYMENT_EXCEEDS_DUE"

    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/payments",
        json={"amountRupees": 1200, "kind": "balance"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 201
    assert resp.json()["dueRupees"] == 0

    # refund above paid blocked; valid refund recorded
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/refund",
        json={"amountRupees": 5000, "reason": "x"},
        headers=_auth(token),
    )
    assert resp.status_code == 409
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/refund",
        json={"amountRupees": 500, "reason": "2h idle downtime"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    assert len(_notifications_for(user_store, "uid-2", "equipment_refund")) == 1

    # invoice with commission from config (default 12%)
    resp = await client.get("/v1/equipment/bookings/eqb_1/invoice", headers=_auth(token))
    inv = resp.json()
    assert inv["commissionPercent"] == 12.0
    assert inv["commissionRupees"] == 240.0
    assert inv["netOwnerRupees"] == 1760.0
    assert inv["dueFromFarmerRupees"] == 0.0
    kinds = [l["type"] for l in inv["lines"]]
    assert kinds == ["rental", "payments", "refunds"]


# ---------------- 6. disputes with SLA + evidence ----------------


async def test_dispute_lifecycle(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="completed")

    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/disputes",
        json={"category": "machine breakdown", "description": "Rotavator stopped after 1 hour", "claimRupees": 900},
        headers=_auth(farmer),
    )
    assert resp.status_code == 201
    dispute = resp.json()
    assert dispute["status"] == "open"
    assert dispute["slaHours"] == 72
    assert dispute["hoursLeft"] <= 72
    assert dispute["slaBreached"] is False
    # owner notified
    assert len(_notifications_for(user_store, "uid-1", "equipment_dispute")) == 1

    # duplicate open dispute blocked
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/disputes",
        json={"category": "late return", "description": "machine returned 3h late"},
        headers=_auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DISPUTE_ALREADY_OPEN"

    # evidence upload
    resp = await client.post(
        f"/v1/equipment/disputes/{dispute['disputeId']}/evidence",
        json={"photoUrls": ["gs://b/photo1.jpg"], "note": "video of the stoppage"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 201
    assert resp.json()["total"] == 1

    # case tracking by both parties + timeline
    resp = await client.get(f"/v1/equipment/disputes/{dispute['disputeId']}", headers=_auth(token))
    body = resp.json()
    events = [e["event"] for e in body["events"]]
    assert events == ["opened", "evidence_added"]
    assert body["evidence"][0]["note"] == "video of the stoppage"

    # stranger blocked; mine lists the case
    user_store["users/uid-x1"] = {
        "id": "uid-x1", "name": "Rando", "linkedProfiles": ["farmer"], "activeProfile": "farmer",
    }
    resp = await client.get(
        f"/v1/equipment/disputes/{dispute['disputeId']}",
        headers=_auth(create_access_token("uid-x1")),
    )
    assert resp.status_code == 403
    resp = await client.get("/v1/equipment/disputes", headers=_auth(farmer))
    assert resp.json()["total"] == 1


# ---------------- 7. monitoring / settlements / commission / policies / reminders ----------------


async def test_monitoring_settlements_policies(client, user_store):
    token = await _owner_token(client)
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="completed", priceRupees=2000.0)
    _booking(user_store, "eqb_2", "eq-9", "uid-1", status="pending", farmer_id="uid-f3", farmer_name="Kishor")
    user_store["settlements/st_1"] = {
        "id": "st_1", "entityId": "uid-1", "role": "equipmentRental", "status": "pending",
        "grossRupees": 5000, "commissionRupees": 600, "netRupees": 4400,
        "periodStart": "2026-10-05", "periodEnd": "2026-10-11",
    }

    resp = await client.get("/v1/equipment-rental/monitoring/bookings", headers=_auth(token))
    body = resp.json()
    assert body["total"] == 2
    assert body["byStatus"] == {"completed": 1, "pending": 1}
    assert body["data"][0]["equipmentName"] == "John Deere 5050"

    resp = await client.get("/v1/equipment-rental/settlements", headers=_auth(token))
    body = resp.json()
    assert body["data"][0]["id"] == "st_1"
    assert body["onHold"] is True  # no verified bank account
    assert body["currentWeek"]["commissionPercent"] == 12.0

    resp = await client.get("/v1/equipment-rental/commission", headers=_auth(token))
    body = resp.json()
    assert body["commissionPercent"] == 12.0
    assert body["history"][0]["commissionRupees"] == 600

    # policies: defaults + admin override of surge
    resp = await client.get("/v1/equipment-rental/policies", headers=_auth(token))
    policies = resp.json()["policies"]
    assert policies["cancellationNoticeHours"] == 2
    assert policies["surge"] == {"enabled": False, "peakMultiplier": 1.25, "peakHours": "06-10,17-20"}
    assert policies["moderation"]["chatScan"] is True
    assert policies["dataRetentionDays"] == 365
    assert policies["commissionPercent"] == 12.0
    user_store["platform_config/equipment_policies"] = {"dataRetentionDays": 180, "surge": {"enabled": True, "peakMultiplier": 1.5, "peakHours": "06-10"}}
    resp = await client.get("/v1/equipment-rental/policies", headers=_auth(token))
    policies = resp.json()["policies"]
    assert policies["dataRetentionDays"] == 180
    assert policies["surge"]["enabled"] is True


async def test_reminders_from_real_dates(client, user_store):
    token = await _owner_token(client)
    _machine(user_store, "uid-1", insuranceExpiry=(NOW + timedelta(days=5)).isoformat())
    _machine(user_store, "uid-1", eid="eq-10", insuranceExpiry=(NOW + timedelta(days=400)).isoformat(),
             serviceSchedule={"nextServiceDate": (NOW + timedelta(days=2)).date().isoformat()})
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="pending")
    resp = await client.get("/v1/equipment-rental/reminders", headers=_auth(token))
    body = resp.json()
    kinds = {r["kind"] for r in body["data"]}
    assert kinds == {"insurance_expiry", "service_due", "booking_approval_needed"}
    insurance = next(r for r in body["data"] if r["kind"] == "insurance_expiry")
    assert insurance["daysLeft"] == 5
    assert insurance["priority"] == "high"


# ---------------- 8. booking wiring: owner notification + SMS ----------------


async def test_booking_notifies_owner(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    _machine(user_store, "uid-1")  # private machine -> pending approval
    user_store["kyc_cases/kyc_uid-1_equipmentRental"] = {
        "caseId": "kyc_uid-1_equipmentRental",
        "userId": "uid-1",
        "persona": "equipmentRental",
        "status": "verified",
        "docs": [
            {"docId": "kyc_uid-1_equipmentRental:equipment_rc", "type": "equipment_rc", "status": "verified"},
            {"docId": "kyc_uid-1_equipmentRental:equipment_insurance", "type": "equipment_insurance", "status": "verified"},
        ],
    }
    resp = await client.get("/v1/equipment/eq-9/slots", params={"date": _tomorrow()}, headers=_auth(farmer))
    slots = resp.json()["data"]
    resp = await client.post(
        f"/v1/equipment/slots/{slots[0]['id']}/book",
        json={"farmerName": "Sham Rao"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"
    assert len(_notifications_for(user_store, "uid-1", "equipment_booking")) == 1
    # reminders surface the approval
    resp = await client.get("/v1/equipment-rental/reminders", headers=_auth(token))
    assert any(r["kind"] == "booking_approval_needed" for r in resp.json()["data"])
