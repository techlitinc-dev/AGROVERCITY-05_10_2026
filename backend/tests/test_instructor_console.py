"""WS-02 instructor console backend tests (phase-04).

Covers: instructor commission accrual + config clamping (task 2.17),
entitlement gate (2.22), DGCA publish gate + licence re-verification
(2.28/2.30) and chat guardrails (2.38).
"""
from app.services.billing import seed_plans
from app.services.settlements import course_gmv_pct, run_settlements
from tests.test_diary import auth, seed_user  # noqa: F401

PERIOD_START = "2026-09-07"
PERIOD_END = "2026-09-13"

COURSE_BODY = {
    "title": "Precision Drone Spraying Certification",
    "category": "Drone Ops",
    "feeRupees": 6500,
    "sessionCount": 5,
    "practicalHours": 15.0,
    "mode": "on-farm",
}


def _seed_course_and_purchase(user_store, instructor_id="uid-inst", category="Agri-Skills"):
    user_store["courses/crs-1"] = {
        "id": "crs-1",
        "instructorId": instructor_id,
        "instructorName": "Guru Shinde",
        "title": "Drone Spraying Certification",
        "category": category,
        "status": "published",
        "priceRupees": 1000,
    }
    user_store["course_purchases/uid-farmer_crs-1"] = {
        "id": "uid-farmer_crs-1",
        "userId": "uid-farmer",
        "studentName": "Ram Patil",
        "courseId": "crs-1",
        "courseTitle": "Drone Spraying Certification",
        "instructorId": instructor_id,
        "amountRupees": 1000,
        "status": "paid",
        "paidAt": f"{PERIOD_START}T05:00:00+00:00",
    }
    return "uid-farmer_crs-1"


async def test_run_settlements_accrues_instructor_payables(client, user_store):
    seed_user(user_store, uid="uid-inst", active_profile="instructor")
    _seed_course_and_purchase(user_store)

    summary = await run_settlements(PERIOD_START, PERIOD_END)
    assert summary["created"] == 1

    settlement = user_store["settlements/st_instructor_uid-inst_2026-09-07"]
    assert settlement["role"] == "instructor"
    assert settlement["entityId"] == "uid-inst"
    assert settlement["grossRupees"] == 1000
    # 15–20% commission band per instructions §WS-02 step 4.
    assert 150 <= settlement["commissionRupees"] <= 200
    assert settlement["netRupees"] == settlement["grossRupees"] - settlement["commissionRupees"]
    assert settlement["sourceIds"] == ["uid-farmer_crs-1"]

    # Task 2.18: TDS 194-O ledger hand-off (integer paisa)…
    tds = user_store["tds_ledger/tds_st_instructor_uid-inst_2026-09-07"]
    assert tds["persona"] == "instructor"
    assert tds["section"] == "194-O"
    assert tds["grossPaisa"] == 100000
    assert tds["tdsPaisa"] == 1000
    # …and the payout is on hold until a penny-drop-verified bank account exists.
    assert settlement["onHold"] is True

    user_store["users/uid-inst/bank_accounts/acc-1"] = {
        "id": "acc-1",
        "userId": "uid-inst",
        "verifyStatus": "verified",
        "isPrimary": True,
    }
    user_store["settlements/st_instructor_uid-inst_2026-09-07"]["status"] = "pending"
    await run_settlements(PERIOD_START, PERIOD_END)
    assert user_store["settlements/st_instructor_uid-inst_2026-09-07"]["onHold"] is False



async def test_course_gmv_pct_clamps_and_honors_category_override(client, user_store):
    # Values outside the allowed band clamp back to the 15% floor.
    assert course_gmv_pct({"courseGMVPct": 25}) == 15
    assert course_gmv_pct({"courseGMVPct": 5}) == 15
    # A valid base value is honored…
    assert course_gmv_pct({"courseGMVPct": 17}) == 17
    # …and a per-category override wins (still clamped into the band).
    config = {"courseGMVPct": 15, "courseGMVPctByCategory": {"Drone Ops": 20}}
    assert course_gmv_pct(config, "Drone Ops") == 20
    assert course_gmv_pct({**config, "courseGMVPctByCategory": {"Drone Ops": 40}}, "Drone Ops") == 15


async def test_entitlement_gate_free_one_course_then_pro(client, user_store):
    await seed_plans()
    token = seed_user(user_store, uid="uid-inst-ent", active_profile="instructor")

    first = await client.post("/v1/teachers/courses/create", json=COURSE_BODY, headers=auth(token))
    assert first.status_code == 201

    second = await client.post(
        "/v1/teachers/courses/create",
        json={**COURSE_BODY, "title": "Second published course"},
        headers=auth(token),
    )
    assert second.status_code in (402, 403)
    assert second.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"

    subscribed = await client.post(
        "/v1/billing/subscribe", json={"planId": "instructor_pro"}, headers=auth(token)
    )
    assert subscribed.status_code == 201

    third = await client.post(
        "/v1/teachers/courses/create",
        json={**COURSE_BODY, "title": "Third course after Pro"},
        headers=auth(token),
    )
    assert third.status_code == 201


def _seed_instructor_case(user_store, uid, *, specialization, docs):
    """Overwrite the fixture's approved instructor case with a specialization."""
    case_id = f"kyc_{uid[:8]}_instructor"
    user_store[f"kyc_cases/{case_id}"] = {
        "caseId": case_id,
        "userId": uid,
        "persona": "instructor",
        "status": "verified",
        "specialization": specialization,
        "docs": [
            {"docId": f"{case_id}:{doc_type}", "type": doc_type, "status": status}
            for doc_type, status in docs
        ],
        "submittedAt": "2026-10-05T00:00:00+00:00",
    }
    return case_id


async def test_kyc_dgca_specialization_publish_gate(client, user_store):
    token = seed_user(user_store, uid="uid-drone", active_profile="instructor")
    # A drone-training instructor whose DGCA certificate is not yet verified
    # cannot publish (WS-02 task 2.28 / eligibility rule §B).
    _seed_instructor_case(
        user_store, "uid-drone", specialization=["drone_training"], docs=[("pan", "verified")]
    )

    blocked = await client.post(
        "/v1/teachers/courses/create", json=COURSE_BODY, headers=auth(token)
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "KYC_NOT_APPROVED"

    # Once the verified RPTO-issued DGCA certificate lands, the same call passes.
    case_id = "kyc_uid-dron_instructor"
    user_store[f"kyc_cases/{case_id}"]["docs"].append(
        {
            "docId": f"{case_id}:dgca_remote_pilot_certificate",
            "type": "dgca_remote_pilot_certificate",
            "status": "verified",
        }
    )
    allowed = await client.post(
        "/v1/teachers/courses/create",
        json={**COURSE_BODY, "title": "DGCA Drone Pilot Certification"},
        headers=auth(token),
    )
    assert allowed.status_code == 201


async def test_licence_expiry_reverification(client, user_store):
    from datetime import datetime, timedelta, timezone

    from app.routers.jobs import reverify_expired_instructor_licences

    today = datetime.now(timezone.utc).date()
    yesterday = (today - timedelta(days=1)).isoformat()
    tomorrow = (today + timedelta(days=1)).isoformat()

    expired_case = "kyc_uid-exp1_instructor"
    user_store[f"kyc_cases/{expired_case}"] = {
        "caseId": expired_case,
        "userId": "uid-exp1",
        "persona": "instructor",
        "status": "verified",
        "specialization": ["drone_training"],
        "docs": [
            {
                "docId": f"{expired_case}:dgca_remote_pilot_certificate",
                "type": "dgca_remote_pilot_certificate",
                "status": "verified",
                "licenceExpiry": yesterday,
            }
        ],
    }
    valid_case = "kyc_uid-exp2_instructor"
    user_store[f"kyc_cases/{valid_case}"] = {
        "caseId": valid_case,
        "userId": "uid-exp2",
        "persona": "instructor",
        "status": "verified",
        "specialization": ["drone_training"],
        "docs": [
            {
                "docId": f"{valid_case}:dgca_remote_pilot_certificate",
                "type": "dgca_remote_pilot_certificate",
                "status": "verified",
                "licenceExpiry": tomorrow,
            }
        ],
    }

    result = await reverify_expired_instructor_licences()
    assert result["reverted"] == 1
    assert user_store[f"kyc_cases/{expired_case}"]["status"] == "needs_reverification"
    assert user_store[f"kyc_cases/{valid_case}"]["status"] == "verified"

    audits = [
        doc
        for key, doc in user_store.items()
        if key.startswith("audit_logs/") and doc.get("reason") == "licence_expired"
    ]
    assert audits
    assert audits[0]["caseId"] == expired_case


def _seed_batch_room(user_store):
    """A batch + course + one confirmed enrollment for the chat guardrail tests."""
    user_store["courses/crs-chat"] = {
        "id": "crs-chat",
        "instructorId": "uid-inst-chat",
        "title": "Batch Chat Course",
        "status": "published",
        "modules": [{"id": "mod-1", "lessons": [{"id": "les-1", "title": "Lesson 1"}]}],
    }
    user_store["course_batches/btc-chat"] = {
        "id": "btc-chat",
        "instructorId": "uid-inst-chat",
        "courseId": "crs-chat",
        "batchName": "Chat Batch",
        "status": "upcoming",
        "startDate": "2026-10-01",
        "endDate": "2026-12-31",
    }
    user_store["course_purchases/uid-enrolled_crs-chat"] = {
        "id": "uid-enrolled_crs-chat",
        "userId": "uid-enrolled",
        "courseId": "crs-chat",
        "instructorId": "uid-inst-chat",
        "status": "paid",
    }


async def test_chat_guardrails_batch_and_dm(client, user_store):
    # (a) farmers cannot DM each other.
    farmer_a = seed_user(user_store, uid="uid-farmer-a", active_profile="farmer")
    seed_user(user_store, uid="uid-farmer-b", active_profile="farmer")
    user_store["market_lots/lot-ff"] = {"id": "lot-ff", "farmerId": "uid-farmer-b", "crop": "tomato"}
    dm = await client.post("/v1/chat/direct", json={"lotId": "lot-ff"}, headers=auth(farmer_a))
    assert dm.status_code == 403
    assert dm.json()["error"]["code"] == "FARMER_DM_BLOCKED"

    # (b)/(c)/(d)/(e) batch room rules.
    instructor = seed_user(user_store, uid="uid-inst-chat", active_profile="instructor")
    enrolled = seed_user(user_store, uid="uid-enrolled", active_profile="farmer")
    seed_user(user_store, uid="uid-outsider", active_profile="farmer")
    _seed_batch_room(user_store)

    # (b) an enrolled farmer cannot post (instructor broadcast-only).
    broadcast = await client.post(
        "/v1/chat/rooms/btc-chat/messages", json={"text": "hello"}, headers=auth(enrolled)
    )
    assert broadcast.status_code == 403
    assert broadcast.json()["error"]["code"] == "BATCH_BROADCAST_ONLY"

    # (c) a user without a confirmed enrollment cannot even read/post.
    locked = await client.post(
        "/v1/chat/rooms/btc-chat/messages", json={"text": "hello"}, headers=auth(seed_user(user_store, uid="uid-outsider2"))
    )
    assert locked.status_code == 403
    assert locked.json()["error"]["code"] == "CHAT_LOCKED_FOR_BOOKING"

    # (d) instructor posts a phone number → blocked + strike written.
    banned = await client.post(
        "/v1/chat/rooms/btc-chat/messages", json={"text": "call me 9876543210"}, headers=auth(instructor)
    )
    assert banned.status_code == 422
    assert banned.json()["error"]["code"] == "MODERATION_BLOCKED"
    strikes = [k for k in user_store if k.startswith("users/uid-inst-chat/strikes/")]
    assert len(strikes) == 1

    # (e) a second banned message trips the strike ladder's 24h mute.
    banned_again = await client.post(
        "/v1/chat/rooms/btc-chat/messages", json={"text": "ping 9876543210"}, headers=auth(instructor)
    )
    assert banned_again.status_code == 422
    assert user_store["users/uid-inst-chat"].get("chatMutedUntil")

