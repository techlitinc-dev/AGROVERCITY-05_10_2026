"""Farmer–Instructor learning workflow tests (spec section 20).

Covers the complete free-course and paid-course journeys end to end:
discovery privacy, instant free enrolment, the KYC/terms/MPIN-protected paid
contact request, instructor manual grant (idempotent), revocation/re-grant with
preserved progress, media protection, and the no-payment-object guarantee.
"""
from tests.test_diary import auth, seed_user
from tests.test_admin import _seed_admin, admin_headers
from app.core.security import hash_mpin

COURSE = {
    "title": "Tomato Protection Masterclass",
    "description": "Complete IPM for tomato",
    "kind": "videoCourse",
    "language": "hi",
    "category": "Pest Management",
    "priceRupees": 499,
    "mediaUrl": "https://cdn.example.com/tomato-intro.mp4",
    "modules": [
        {
            "id": "mod_1",
            "title": "IPM Basics",
            "order": 1,
            "lessons": [
                {
                    "id": "les_intro",
                    "title": "Introduction",
                    "kind": "video",
                    "durationMinutes": 12,
                    "order": 1,
                    "isPreviewFree": True,
                    "mediaUrl": "https://cdn.example.com/tomato-intro.mp4",
                },
                {
                    "id": "les_spray",
                    "title": "Spray scheduling",
                    "kind": "video",
                    "durationMinutes": 20,
                    "order": 2,
                    "isPreviewFree": False,
                    "mediaUrl": "https://cdn.example.com/tomato-spray.mp4",
                },
            ],
        }
    ],
    "whatYouWillLearn": ["Build a season-long IPM plan"],
}

FREE_COURSE = {**COURSE, "title": "Free Compost Course", "priceRupees": 0}


def _instructor(user_store, uid="uid-instructor"):
    return seed_user(
        user_store,
        uid=uid,
        active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
        name="Guru Shinde",
    )


def _learner(user_store, uid="uid-farmer", mpin=True, **overrides):
    token = seed_user(user_store, uid=uid, **overrides)
    if mpin:
        user_store[f"users/{uid}"]["mpinHash"] = hash_mpin("1234")
    return token


async def _create(client, token, payload=COURSE):
    resp = await client.post("/v1/courses", json=payload, headers=auth(token))
    assert resp.status_code == 201
    return resp.json()


async def _publish(client, user_store, course_id):
    admin = _seed_admin(user_store)
    resp = await client.post(
        f"/v1/admin/courses/{course_id}/review",
        json={"action": "publish"},
        headers=admin_headers(admin),
    )
    assert resp.status_code == 200


async def _contact(client, course_id, token, mpin="1234", **overrides):
    body = {"termsAccepted": True, "mpin": mpin, **overrides}
    return await client.post(
        f"/v1/courses/{course_id}/contact-requests", json=body, headers=auth(token)
    )


async def _grant(client, instructor_token, course_id, learner_id="uid-farmer", **overrides):
    queue = await client.get("/v1/instructor/enrollment-requests", headers=auth(instructor_token))
    row = next(r for r in queue.json()["data"] if r["learnerId"] == learner_id and r["courseId"] == course_id)
    resp = await client.post(
        f"/v1/instructor/enrollment-requests/{row['requestId']}/grant",
        json={"paymentReceivedAck": True, **overrides},
        headers=auth(instructor_token),
    )
    assert resp.status_code == 200
    return resp.json()


# ---------------------------------------------------------------------------
# Course creation, pricing validation and publish gating
# ---------------------------------------------------------------------------


async def test_instructor_creates_free_course(client, user_store):
    instructor = _instructor(user_store)
    course = await _create(client, instructor, FREE_COURSE)
    assert course["accessType"] == "free"
    assert course["priceRupees"] == 0
    assert course["status"] == "pendingReview"
    assert course["modules"][0]["lessons"][0]["isPreviewFree"] is True


async def test_instructor_creates_paid_course_with_valid_price(client, user_store):
    instructor = _instructor(user_store)
    course = await _create(client, instructor, {**COURSE, "accessType": "paid", "priceRupees": 499, "currency": "INR", "priceNotes": "Includes field visit"})
    assert course["accessType"] == "paid"
    assert course["priceRupees"] == 499
    assert course["currency"] == "INR"
    assert course["priceNotes"]


async def test_invalid_free_paid_pricing_rejected(client, user_store):
    instructor = _instructor(user_store)
    bad_free = await client.post(
        "/v1/courses", json={**FREE_COURSE, "accessType": "free", "priceRupees": 100}, headers=auth(instructor)
    )
    assert bad_free.status_code == 422
    assert bad_free.json()["error"]["code"] == "INVALID_PRICING"
    bad_paid = await client.post(
        "/v1/courses", json={**COURSE, "accessType": "paid", "priceRupees": 0}, headers=auth(instructor)
    )
    assert bad_paid.status_code == 422
    assert bad_paid.json()["error"]["code"] == "INVALID_PRICING"


async def test_course_creation_and_publish_do_not_require_instructor_kyc(client, user_store):
    instructor = _instructor(user_store)
    # The exact reported scenario: no KYC case submitted at all.
    user_store.pop("kyc_cases/kyc_uid-inst_instructor", None)
    course = await _create(client, instructor)
    assert course["status"] == "pendingReview"
    # Going public is allowed as well.
    resp = await client.put(
        f"/v1/courses/{course['id']}",
        json={"status": "published"},
        headers=auth(instructor),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"


# ---------------------------------------------------------------------------
# Discovery privacy & badges
# ---------------------------------------------------------------------------


async def test_learner_discovers_courses_without_private_contacts(client, user_store):
    instructor = _instructor(user_store)
    course = await _create(client, instructor)
    await _publish(client, user_store, course["id"])
    learner = _learner(user_store)

    browse = await client.get("/v1/courses", headers=auth(learner))
    row = browse.json()["data"][0]
    assert "instructorEarningsRupees" not in row
    assert "commissionRupees" not in row
    # no phone/whatsapp anywhere in the public payload
    import json as _json

    assert "+91" not in _json.dumps(row)
    assert row["lessonCount"] == 2
    assert row["durationMinutes"] == 32
    # badges are server-derived booleans
    assert row["instructorIdentityVerified"] is True
    assert row["instructorExpertiseVerified"] is False  # upload alone is not a review

    # non-preview lesson media is hidden from strangers
    mod = row["modules"][0]
    assert mod["lessons"][0]["mediaUrl"]  # preview
    assert "mediaUrl" not in mod["lessons"][1]


async def test_expertise_badge_requires_actual_review(client, user_store):
    instructor = _instructor(user_store)
    # identity KYC approved (seeded) but no reviewed expertise docs
    course = await _create(client, instructor)
    await _publish(client, user_store, course["id"])
    learner = _learner(user_store)
    detail = await client.get(f"/v1/courses/{course['id']}", headers=auth(learner))
    assert detail.json()["instructorIdentityVerified"] is True
    assert detail.json()["instructorExpertiseVerified"] is False
    assert detail.json()["instructorCredentials"] == []

    # an admin-reviewed qualification certificate flips the badge on
    case_id = "kyc_uid-inst_instructor"
    user_store[f"kyc_cases/{case_id}"]["docs"] = [
        {"docId": f"{case_id}:qualification_certificate", "type": "qualification_certificate", "status": "verified", "reviewedAt": "2026-10-20T00:00:00+00:00"}
    ]
    detail = await client.get(f"/v1/courses/{course['id']}", headers=auth(learner))
    assert detail.json()["instructorExpertiseVerified"] is True
    assert detail.json()["instructorCredentials"][0]["type"] == "qualification_certificate"


# ---------------------------------------------------------------------------
# Free-course enrolment
# ---------------------------------------------------------------------------


async def test_free_enrolment_grants_immediate_access_without_mpin_or_contact(client, user_store):
    instructor = _instructor(user_store)
    course = await _create(client, instructor, FREE_COURSE)
    await _publish(client, user_store, course["id"])
    learner = _learner(user_store, mpin=False)  # no MPIN at all

    enroll = await client.post(f"/v1/courses/{course['id']}/enroll", json={}, headers=auth(learner))
    assert enroll.status_code == 200
    assert enroll.json()["accessType"] == "free"
    assert enroll.json()["accessStatus"] == "granted"

    learn = await client.get(f"/v1/courses/{course['id']}/learn", headers=auth(learner))
    assert learn.status_code == 200
    # no contact request needed / created
    assert f"course_contact_requests/uid-farmer_{course['id']}" not in user_store
    # no chat auto-created for free enrolment
    assert not any(k.startswith("chat_rooms/") for k in user_store)


async def test_free_enrolment_is_idempotent_and_preserves_progress(client, user_store):
    instructor = _instructor(user_store)
    course = await _create(client, instructor, FREE_COURSE)
    await _publish(client, user_store, course["id"])
    learner = _learner(user_store)

    first = await client.post(f"/v1/courses/{course['id']}/enroll", json={}, headers=auth(learner))
    assert first.json()["alreadyEnrolled"] is False
    await client.post(
        f"/v1/courses/{course['id']}/lessons/les_intro/progress",
        json={"completed": True}, headers=auth(learner),
    )
    second = await client.post(f"/v1/courses/{course['id']}/enroll", json={}, headers=auth(learner))
    assert second.json()["alreadyEnrolled"] is True
    record = user_store[f"course_purchases/uid-farmer_{course['id']}"]
    assert record["progressPercent"] == 50.0
    assert record["completedLessonIds"] == ["les_intro"]
    # still exactly one record
    assert len([k for k in user_store if k.startswith("course_purchases/")]) == 1


# ---------------------------------------------------------------------------
# Paid-course contact request
# ---------------------------------------------------------------------------


def _grant_instructor_pro(user_store, uid="uid-instructor"):
    """Free tier allows one course — grant the pro plan for multi-course tests."""
    user_store[f"subscriptions/sub-{uid}"] = {
        "id": f"sub-{uid}",
        "userId": uid,
        "planId": "instructor_pro",
        "status": "active",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }


async def _published_paid_course(client, user_store):
    instructor = _instructor(user_store)
    course = await _create(client, instructor)
    await _publish(client, user_store, course["id"])
    return instructor, course


async def test_paid_contact_requires_kyc_terms_and_mpin(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)

    # learner KYC missing → 403
    unverified = _learner(user_store, uid="uid-unverified", kycStatus="pending")
    resp = await _contact(client, course["id"], unverified)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"

    learner = _learner(user_store)
    # terms not accepted → 422
    no_terms = await _contact(client, course["id"], learner, termsAccepted=False)
    assert no_terms.status_code == 422
    assert no_terms.json()["error"]["code"] == "TERMS_NOT_ACCEPTED"

    # wrong MPIN → 401 (and the MPIN is never stored on the request)
    wrong = await _contact(client, course["id"], learner, mpin="9999")
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "WRONG_MPIN"

    # learner without an MPIN → 409
    no_mpin = _learner(user_store, uid="uid-nompin", mpin=False)
    missing = await _contact(client, course["id"], no_mpin)
    assert missing.status_code == 409
    assert missing.json()["error"]["code"] == "MPIN_NOT_SET"

    ok = await _contact(client, course["id"], learner)
    assert ok.status_code == 201
    req = ok.json()["request"]
    assert "mpin" not in req
    assert req["mpinVerified"] is True
    assert req["termsVersion"]


async def test_paid_contact_records_price_currency_and_creates_no_access(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    learner = _learner(user_store)
    resp = await _contact(client, course["id"], learner)
    assert resp.status_code == 201
    req = resp.json()["request"]
    assert req["priceRupees"] == 499
    assert req["currency"] == "INR"
    assert req["contactRevealedAt"]

    # unlocked contact actions for the learner
    contact = resp.json()["instructorContact"]
    assert contact["name"] == "Guru Shinde"
    assert contact["phone"].startswith("+91")
    assert contact["whatsapp"]
    assert resp.json()["chatRoomId"]

    # but NO course access and no payment-ish objects
    assert f"course_purchases/uid-farmer_{course['id']}" not in user_store
    for collection in ("payments", "orders", "escrow_transactions", "subscriptions", "invoices"):
        assert not any(k.startswith(f"{collection}/") for k in user_store), collection

    # paid lesson media still protected
    learn = await client.get(f"/v1/courses/{course['id']}/learn", headers=auth(learner))
    assert learn.status_code == 403
    detail = await client.get(f"/v1/courses/{course['id']}", headers=auth(learner))
    body = detail.json()
    assert body["access"]["accessStatus"] == "none"
    lessons = body["modules"][0]["lessons"]
    assert lessons[0].get("mediaUrl")  # preview stays public
    assert "mediaUrl" not in lessons[1]

    # instructor is notified
    notes = [d for k, d in user_store.items() if k.startswith("notifications/") and d.get("userId") == "uid-instructor"]
    assert any(n["type"] == "course_contact_request" for n in notes)


async def test_duplicate_paid_contact_returns_existing_request_and_one_chat_room(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    learner = _learner(user_store)
    first = await _contact(client, course["id"], learner)
    second = await _contact(client, course["id"], learner)
    assert second.json()["alreadyExists"] is True
    assert second.json()["request"]["id"] == first.json()["request"]["id"]
    assert second.json()["chatRoomId"] == first.json()["chatRoomId"]
    rooms = [k for k in user_store if k.startswith("chat_rooms/")]
    assert len(rooms) == 1
    # no duplicate notifications on retry
    notes = [d for k, d in user_store.items() if k.startswith("notifications/") and d.get("type") == "course_contact_request"]
    assert len(notes) == 1


# ---------------------------------------------------------------------------
# Instructor manual grant
# ---------------------------------------------------------------------------


async def test_grant_requires_ownership_and_eligible_request(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    other_instructor = _instructor(user_store, uid="uid-ins2")
    learner = _learner(user_store)
    await _contact(client, course["id"], learner)

    queue = await client.get("/v1/instructor/enrollment-requests", headers=auth(instructor))
    request_id = queue.json()["data"][0]["requestId"]

    # another instructor cannot grant
    foreign = await client.post(
        f"/v1/instructor/enrollment-requests/{request_id}/grant",
        json={"paymentReceivedAck": True}, headers=auth(other_instructor),
    )
    assert foreign.status_code == 403
    # learner cannot grant
    as_learner = await client.post(
        f"/v1/instructor/enrollment-requests/{request_id}/grant",
        json={"paymentReceivedAck": True}, headers=auth(learner),
    )
    assert as_learner.status_code == 403
    # acknowledgement is required
    no_ack = await client.post(
        f"/v1/instructor/enrollment-requests/{request_id}/grant",
        json={"paymentReceivedAck": False}, headers=auth(instructor),
    )
    assert no_ack.status_code == 422

    grant = await _grant(client, instructor, course["id"])
    assert grant["access"]["accessStatus"] == "granted"
    assert grant["access"]["accessType"] == "manualOffPlatform"


async def test_learner_gets_full_content_after_grant_and_notifications(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    learner = _learner(user_store)
    await _contact(client, course["id"], learner)
    await _grant(client, instructor, course["id"], externalPaymentRef="UPI-7788", instructorNote="paid in cash")

    record = user_store[f"course_purchases/uid-farmer_{course['id']}"]
    assert record["accessStatus"] == "granted"
    assert record["accessType"] == "manualOffPlatform"
    assert record["grantedBy"] == "uid-instructor"
    assert record["grantedAt"]
    assert record["requestId"]
    assert record["priceAtContactRupees"] == 499
    assert record["externalPaymentRef"] == "UPI-7788"

    learn = await client.get(f"/v1/courses/{course['id']}/learn", headers=auth(learner))
    assert learn.status_code == 200
    lessons = learn.json()["modules"][0]["lessons"]
    assert lessons[1]["mediaUrl"] == "https://cdn.example.com/tomato-spray.mp4"

    notes = [d for k, d in user_store.items() if k.startswith("notifications/") and d.get("userId") == "uid-farmer"]
    assert any(n["type"] == "course_access_granted" for n in notes)

    # my-learning groups the course under paidCourses
    ml = await client.get("/v1/courses/my-learning", headers=auth(learner))
    assert len(ml.json()["paidCourses"]) == 1
    assert ml.json()["paidCourses"][0]["accessStatus"] == "granted"
    assert ml.json()["awaitingAccess"] == []


async def test_manual_grant_is_idempotent(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    learner = _learner(user_store)
    await _contact(client, course["id"], learner)
    first = await _grant(client, instructor, course["id"])
    assert first["alreadyGranted"] is False
    second = await _grant(client, instructor, course["id"])
    assert second["alreadyGranted"] is True
    records = [k for k in user_store if k.startswith("course_purchases/")]
    assert records == [f"course_purchases/uid-farmer_{course['id']}"]


# ---------------------------------------------------------------------------
# Revocation & re-grant
# ---------------------------------------------------------------------------


async def test_revocation_blocks_content_preserves_progress_and_regrant_restores(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    learner = _learner(user_store)
    await _contact(client, course["id"], learner)
    await _grant(client, instructor, course["id"])

    # learner makes progress
    await client.post(
        f"/v1/courses/{course['id']}/lessons/les_intro/progress",
        json={"completed": True}, headers=auth(learner),
    )

    revoke = await client.post(
        f"/v1/instructor/courses/{course['id']}/learners/uid-farmer/revoke",
        json={"reason": "Fee not honoured"},
        headers=auth(instructor),
    )
    assert revoke.status_code == 200
    assert revoke.json()["accessStatus"] == "revoked"

    # content blocked
    learn = await client.get(f"/v1/courses/{course['id']}/learn", headers=auth(learner))
    assert learn.status_code == 403
    assert learn.json()["error"]["code"] == "ACCESS_REVOKED"
    detail = await client.get(f"/v1/courses/{course['id']}", headers=auth(learner))
    assert detail.json()["access"]["isRevoked"] is True
    lessons = detail.json()["modules"][0]["lessons"]
    assert "mediaUrl" not in lessons[1]

    # progress preserved
    record = user_store[f"course_purchases/uid-farmer_{course['id']}"]
    assert record["progressPercent"] == 50.0
    assert record["completedLessonIds"] == ["les_intro"]
    assert record["revokedBy"] == "uid-instructor"
    assert record["revokeReason"] == "Fee not honoured"

    # chat history NOT deleted
    assert any(k.startswith("chat_rooms/") for k in user_store)
    # learner notified, no refund language
    notes = [d for k, d in user_store.items() if k.startswith("notifications/") and d.get("userId") == "uid-farmer"]
    revoke_notes = [n for n in notes if n["type"] == "course_access_revoked"]
    assert len(revoke_notes) == 1
    assert "refund" not in revoke_notes[0]["body"].lower()

    # re-grant restores the SAME record
    regrant = await client.post(
        f"/v1/instructor/courses/{course['id']}/learners/uid-farmer/regrant",
        headers=auth(instructor),
    )
    assert regrant.status_code == 200
    restored = user_store[f"course_purchases/uid-farmer_{course['id']}"]
    assert restored["accessStatus"] == "granted"
    assert restored["progressPercent"] == 50.0
    assert restored["completedLessonIds"] == ["les_intro"]
    assert restored["reGrantedAt"]

    learn = await client.get(f"/v1/courses/{course['id']}/learn", headers=auth(learner))
    assert learn.status_code == 200


async def test_revoke_requires_ownership_reason_and_nonfree_access(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    other = _instructor(user_store, uid="uid-ins2")
    learner = _learner(user_store)
    await _contact(client, course["id"], learner)
    await _grant(client, instructor, course["id"])

    # missing reason
    no_reason = await client.post(
        f"/v1/instructor/courses/{course['id']}/learners/uid-farmer/revoke",
        json={"reason": ""}, headers=auth(instructor),
    )
    assert no_reason.status_code == 422
    # not the owner
    foreign = await client.post(
        f"/v1/instructor/courses/{course['id']}/learners/uid-farmer/revoke",
        json={"reason": "Nope"}, headers=auth(other),
    )
    assert foreign.status_code == 403
    # free enrolments cannot be revoked from here
    _grant_instructor_pro(user_store)
    free_course = await _create(client, instructor, FREE_COURSE)
    await _publish(client, user_store, free_course["id"])
    await client.post(f"/v1/courses/{free_course['id']}/enroll", json={}, headers=auth(learner))
    free_revoke = await client.post(
        f"/v1/instructor/courses/{free_course['id']}/learners/uid-farmer/revoke",
        json={"reason": "just because"}, headers=auth(instructor),
    )
    assert free_revoke.status_code == 409
    assert free_revoke.json()["error"]["code"] == "FREE_ACCESS_NOT_REVOCABLE"


# ---------------------------------------------------------------------------
# Participant-only privacy
# ---------------------------------------------------------------------------


async def test_nonparticipants_cannot_access_contacts_chat_or_private_notes(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    learner = _learner(user_store)
    await _contact(client, course["id"], learner)
    await _grant(client, instructor, course["id"], externalPaymentRef="UPI-secret", instructorNote="private note")

    stranger = _learner(user_store, uid="uid-stranger")
    # the contact endpoint is participant-only
    mine = await client.get(f"/v1/courses/{course['id']}/contact-requests/mine", headers=auth(stranger))
    assert mine.json()["request"] is None
    # enrollment requests are instructor-only
    queue = await client.get("/v1/instructor/enrollment-requests", headers=auth(stranger))
    assert queue.status_code == 403
    # learners cannot read the instructor's enrollment queue → private notes stay private
    as_learner = await client.get("/v1/instructor/enrollment-requests", headers=auth(learner))
    assert as_learner.status_code == 403
    # no contact details in any public payload
    import json as _json

    detail = await client.get(f"/v1/courses/{course['id']}", headers=auth(stranger))
    assert "+91" not in _json.dumps(detail.json())
    # chat with the instructor requires a connection
    chat = await client.post(f"/v1/courses/{course['id']}/chat", headers=auth(stranger))
    assert chat.status_code == 403


# ---------------------------------------------------------------------------
# Progress & completion rules (free and paid)
# ---------------------------------------------------------------------------


async def test_free_and_paid_progress_and_completion_rules(client, user_store):
    instructor = _instructor(user_store)
    free_course = await _create(client, instructor, FREE_COURSE)
    await _publish(client, user_store, free_course["id"])
    _grant_instructor_pro(user_store)
    paid_course = await _create(client, instructor)
    await _publish(client, user_store, paid_course["id"])
    learner = _learner(user_store)

    await client.post(f"/v1/courses/{free_course['id']}/enroll", json={}, headers=auth(learner))
    await _contact(client, paid_course["id"], learner)
    await _grant(client, instructor, paid_course["id"])

    # unauthenticated progress update impossible; stranger cannot update
    stranger = _learner(user_store, uid="uid-stranger")
    foreign = await client.post(
        f"/v1/courses/{free_course['id']}/lessons/les_intro/progress",
        json={"completed": True}, headers=auth(stranger),
    )
    assert foreign.status_code == 403

    # complete both lessons of the free course → 100% + certificate
    await client.post(f"/v1/courses/{free_course['id']}/lessons/les_intro/progress", json={"completed": True}, headers=auth(learner))
    done = await client.post(f"/v1/courses/{free_course['id']}/lessons/les_spray/progress", json={"completed": True}, headers=auth(learner))
    assert done.json()["progressPercent"] == 100.0
    assert done.json()["isCompleted"] is True
    assert done.json()["certificateId"]
    record = user_store[f"course_purchases/uid-farmer_{free_course['id']}"]
    assert record["learningStatus"] == "completed"

    # completion appears under completedCourses; awaiting stays empty
    ml = await client.get("/v1/courses/my-learning", headers=auth(learner))
    completed_ids = [c["courseId"] for c in ml.json()["completedCourses"]]
    assert free_course["id"] in completed_ids
    assert ml.json()["awaitingAccess"] == []


async def test_awaiting_access_state_visible_to_learner(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    learner = _learner(user_store)
    await _contact(client, course["id"], learner)

    ml = await client.get("/v1/courses/my-learning", headers=auth(learner))
    awaiting = ml.json()["awaitingAccess"]
    assert len(awaiting) == 1
    assert awaiting[0]["courseId"] == course["id"]
    assert awaiting[0]["accessStatus"] == "awaitingGrant"
    assert awaiting[0]["priceRupees"] == 499
    assert "data" in ml.json() and len(ml.json()["data"]) == 0  # no access yet

    mine = await client.get(f"/v1/courses/{course['id']}/contact-requests/mine", headers=auth(learner))
    assert mine.json()["status"] == "contacted"
    assert mine.json()["instructorContact"]["phone"]


async def test_instructor_course_learners_summary(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    learner = _learner(user_store)
    other_learner = _learner(user_store, uid="uid-farmer-2")
    await _contact(client, course["id"], learner)
    await _contact(client, course["id"], other_learner)
    await _grant(client, instructor, course["id"], learner_id="uid-farmer")
    await _grant(client, instructor, course["id"], learner_id="uid-farmer-2")
    await client.post(
        f"/v1/instructor/courses/{course['id']}/learners/uid-farmer-2/revoke",
        json={"reason": "duplicate account"}, headers=auth(instructor),
    )

    learners = await client.get(f"/v1/instructor/courses/{course['id']}/learners", headers=auth(instructor))
    assert learners.status_code == 200
    body = learners.json()
    assert body["totalActive"] == 1
    assert body["totalRevoked"] == 1
    assert body["active"][0]["studentId"] == "uid-farmer"
    assert body["active"][0]["identityVerified"] is True
    assert body["active"][0]["accessType"] == "manualOffPlatform"
    assert body["revoked"][0]["revokeReason"] == "duplicate account"

    # non-owner cannot list learners
    stranger = _instructor(user_store, uid="uid-ins2")
    forbidden = await client.get(f"/v1/instructor/courses/{course['id']}/learners", headers=auth(stranger))
    assert forbidden.status_code == 403


async def test_instructor_can_dismiss_eligible_request(client, user_store):
    instructor, course = await _published_paid_course(client, user_store)
    learner = _learner(user_store)
    await _contact(client, course["id"], learner)
    queue = await client.get("/v1/instructor/enrollment-requests", headers=auth(instructor))
    request_id = queue.json()["data"][0]["requestId"]
    dismiss = await client.post(
        f"/v1/instructor/enrollment-requests/{request_id}/dismiss", headers=auth(instructor)
    )
    assert dismiss.status_code == 200
    assert dismiss.json()["status"] == "dismissed"
    # a dismissed request cannot be granted
    grant = await client.post(
        f"/v1/instructor/enrollment-requests/{request_id}/grant",
        json={"paymentReceivedAck": True}, headers=auth(instructor),
    )
    assert grant.status_code == 409


async def test_my_questions_groups_answers_state(client, user_store):
    instructor = _instructor(user_store)
    course = await _create(client, instructor, FREE_COURSE)
    await _publish(client, user_store, course["id"])
    learner = _learner(user_store)
    await client.post(f"/v1/courses/{course['id']}/enroll", json={}, headers=auth(learner))

    q = await client.post(
        f"/v1/courses/{course['id']}/questions",
        json={"question": "Which neem oil concentration?", "lessonId": "les_intro"},
        headers=auth(learner),
    )
    assert q.status_code == 201

    mine = await client.get("/v1/courses/my-questions", headers=auth(learner))
    row = mine.json()["data"][0]
    assert row["isAnswered"] is False
    assert row["lessonId"] == "les_intro"

    await client.post(
        f"/v1/courses/{course['id']}/questions/{q.json()['id']}/answers",
        json={"answer": "5 ml per litre"}, headers=auth(instructor),
    )
    mine = await client.get("/v1/courses/my-questions", headers=auth(learner))
    assert mine.json()["data"][0]["isAnswered"] is True
    learner_note = [d for k, d in user_store.items() if k.startswith("notifications/") and d.get("userId") == "uid-farmer"]
    assert any(n["type"] == "course_question_answered" for n in learner_note)


async def test_saved_courses_roundtrip(client, user_store):
    instructor = _instructor(user_store)
    course = await _create(client, instructor, FREE_COURSE)
    await _publish(client, user_store, course["id"])
    learner = _learner(user_store)

    saved = await client.post(f"/v1/courses/{course['id']}/save", headers=auth(learner))
    assert saved.status_code == 201
    again = await client.post(f"/v1/courses/{course['id']}/save", headers=auth(learner))
    assert again.json()["alreadySaved"] is True

    ml = await client.get("/v1/courses/my-learning", headers=auth(learner))
    assert [s["courseId"] for s in ml.json()["savedCourses"]] == [course["id"]]

    await client.delete(f"/v1/courses/{course['id']}/save", headers=auth(learner))
    ml = await client.get("/v1/courses/my-learning", headers=auth(learner))
    assert ml.json()["savedCourses"] == []
