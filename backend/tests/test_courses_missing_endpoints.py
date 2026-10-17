"""Missing course/instructor endpoints (audit items P0-9, P0-11, P1-15..P1-20,
P2-14): booking cancellation with tiered refunds, booking disputes, structured
enquiries + fee negotiation, batch sessions + QR check-in, assignments +
photo submissions, availability calendar, certificate revocation and the
instructor settlement view.

Every test drives the real API through the ASGI client; the in-memory store
only carries docs the test itself seeds (users, purchases, batches…).
"""

from datetime import datetime, timedelta, timezone

from tests.test_diary import auth, seed_user

INSTRUCTOR = {"active_profile": "instructor", "linkedProfiles": ["farmer", "instructor"], "name": "Guru Shinde"}
COURSE = {"title": "Tomato Protection Masterclass", "priceRupees": 1000, "autoPublish": True, "category": "Pest Management"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _instructor(client, user_store, uid="uid-inst"):
    return seed_user(user_store, uid=uid, **INSTRUCTOR)


def _farmer(client, user_store, uid="uid-farmer"):
    return seed_user(user_store, uid=uid, name="Ram Patil")


async def _published_course(client, instructor_token, **overrides):
    resp = await client.post("/v1/courses", json={**COURSE, **overrides}, headers=auth(instructor_token))
    assert resp.status_code == 201
    return resp.json()


def _seed_paid_purchase(user_store, farmer_id, course, *, instructor_id="uid-inst", amount=1000.0,
                        starts_in_hours=None, **extra):
    pid = f"{farmer_id}_{course['id']}"
    doc = {
        "id": pid,
        "userId": farmer_id,
        "studentName": "Ram Patil",
        "courseId": course["id"],
        "courseTitle": course["title"],
        "instructorId": instructor_id,
        "amountRupees": amount,
        "status": "paid",
        "razorpayPaymentId": "pay_test_1",
        "paidAt": _now_iso(),
        "createdAt": _now_iso(),
    }
    if starts_in_hours is not None:
        doc["firstSessionAt"] = (
            datetime.now(timezone.utc) + timedelta(hours=starts_in_hours)
        ).isoformat()
    doc.update(extra)
    user_store[f"course_purchases/{pid}"] = doc
    return pid


def _notifications_for(user_store, uid, ntype):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/")
        and doc.get("userId") == uid
        and doc.get("type") == ntype
    ]


# --------------------------------------------------------------------------
# P0-9 — booking cancellation & tiered refunds (spec E1/E2)
# --------------------------------------------------------------------------


async def test_student_cancel_full_refund_48h_plus(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    course = await _published_course(client, instructor)
    pid = _seed_paid_purchase(user_store, "uid-farmer", course, starts_in_hours=72)

    resp = await client.post(
        f"/v1/courses/purchases/{pid}/cancel", json={"reason": "Crop emergency"}, headers=auth(farmer)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "cancelled"
    assert body["refund"]["percent"] == 100
    assert body["refund"]["amountPaisa"] == 100000  # ₹1000 in paisa
    assert body["refund"]["at"]
    assert body["refund"]["gatewayRefundId"].startswith("rfnd_dev_")

    stored = user_store[f"course_purchases/{pid}"]
    assert stored["status"] == "cancelled"
    assert stored["refund"]["percent"] == 100

    # the instructor is notified instantly
    notes = _notifications_for(user_store, "uid-inst", "booking_cancelled")
    assert len(notes) == 1

    # cancelling again is a 409
    again = await client.post(f"/v1/courses/purchases/{pid}/cancel", json={}, headers=auth(farmer))
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "BOOKING_ALREADY_CANCELLED"


async def test_student_cancel_half_refund_24_to_48h(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    course = await _published_course(client, instructor)
    pid = _seed_paid_purchase(user_store, "uid-farmer", course, starts_in_hours=30)

    resp = await client.post(f"/v1/courses/purchases/{pid}/cancel", json={}, headers=auth(farmer))
    assert resp.status_code == 200
    assert resp.json()["refund"]["percent"] == 50
    assert resp.json()["refund"]["amountPaisa"] == 50000


async def test_student_cancel_no_refund_inside_24h(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    course = await _published_course(client, instructor)
    pid = _seed_paid_purchase(user_store, "uid-farmer", course, starts_in_hours=10)

    resp = await client.post(f"/v1/courses/purchases/{pid}/cancel", json={}, headers=auth(farmer))
    assert resp.status_code == 200
    assert resp.json()["refund"]["percent"] == 0
    assert resp.json()["refund"]["amountPaisa"] == 0
    assert resp.json()["refund"]["gatewayRefundId"] is None


async def test_instructor_cancel_full_refund_plus_strike(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    course = await _published_course(client, instructor)
    pid = _seed_paid_purchase(user_store, "uid-farmer", course, starts_in_hours=10)

    resp = await client.post(
        f"/v1/courses/purchases/{pid}/cancel",
        json={"reason": "Instructor illness"},
        headers=auth(instructor),
    )
    assert resp.status_code == 200
    # E2: instructor cancellation refunds in full even inside 24h…
    assert resp.json()["refund"]["percent"] == 100
    assert resp.json()["refund"]["amountPaisa"] == 100000
    # …and records an instructor strike via the chat strike ladder.
    strikes = [k for k in user_store if k.startswith("users/uid-inst/strikes/")]
    assert len(strikes) == 1

    # the farmer is notified of the instructor cancellation
    notes = _notifications_for(user_store, "uid-farmer", "booking_cancelled")
    assert len(notes) == 1
    assert "instructor" in notes[0]["body"]


async def test_cancel_guardrails(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    stranger = seed_user(user_store, uid="uid-stranger")
    course = await _published_course(client, instructor)
    pid = _seed_paid_purchase(user_store, "uid-farmer", course, starts_in_hours=72)

    stranger_resp = await client.post(f"/v1/courses/purchases/{pid}/cancel", json={}, headers=auth(stranger))
    assert stranger_resp.status_code == 403

    # an unconfirmed (awaiting payment) booking cannot be cancelled
    user_store[f"course_purchases/{pid}"]["status"] = "awaiting_payment"
    pending = await client.post(f"/v1/courses/purchases/{pid}/cancel", json={}, headers=auth(farmer))
    assert pending.status_code == 409
    assert pending.json()["error"]["code"] == "BOOKING_NOT_CONFIRMED"

    unknown = await client.post("/v1/courses/purchases/nope/cancel", json={}, headers=auth(farmer))
    assert unknown.status_code == 404


# --------------------------------------------------------------------------
# P0-11 — dispute on a course booking (spec C9/C3)
# --------------------------------------------------------------------------


async def test_student_dispute_freezes_payout_and_notifies_instructor(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    course = await _published_course(client, instructor)
    pid = _seed_paid_purchase(user_store, "uid-farmer", course)

    resp = await client.post(
        f"/v1/courses/purchases/{pid}/disputes",
        json={"category": "instructor_no_show", "reason": "Instructor never joined the session", "evidence": {"photoUrl": "gs://bucket/venue.jpg"}},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["disputeId"].startswith("dsp_")
    assert body["status"] == "open"
    assert body["payoutFrozen"] is True

    # canonical dispute doc ingested + purchase flagged for the payout cron
    dispute = user_store[f"disputes/{body['disputeId']}"]
    assert dispute["source"] == "course"
    assert dispute["sourceId"] == pid
    assert dispute["summary"].startswith("[instructor_no_show]")
    assert dispute["evidence"]["photoUrl"] == "gs://bucket/venue.jpg"

    stored = user_store[f"course_purchases/{pid}"]
    assert stored["disputeId"] == body["disputeId"]
    assert stored["payoutFrozen"] is True

    # the counterparty (instructor) is notified
    notes = _notifications_for(user_store, "uid-inst", "dispute_opened")
    assert len(notes) == 1

    # exactly one dispute per booking
    dup = await client.post(
        f"/v1/courses/purchases/{pid}/disputes",
        json={"category": "instructor_no_show", "reason": "Still no show"},
        headers=auth(farmer),
    )
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "DISPUTE_ALREADY_OPEN"


async def test_instructor_can_dispute_and_strangers_cannot(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    stranger = seed_user(user_store, uid="uid-stranger")
    course = await _published_course(client, instructor)
    pid = _seed_paid_purchase(user_store, "uid-farmer", course)

    stranger_resp = await client.post(
        f"/v1/courses/purchases/{pid}/disputes",
        json={"category": "fee_dispute", "reason": "someone else entirely"},
        headers=auth(stranger),
    )
    assert stranger_resp.status_code == 403

    resp = await client.post(
        f"/v1/courses/purchases/{pid}/disputes",
        json={"category": "farmer_no_show", "reason": "Farmer never checked in"},
        headers=auth(instructor),
    )
    assert resp.status_code == 201
    assert user_store[f"course_purchases/{pid}"]["payoutFrozen"] is True
    notes = _notifications_for(user_store, "uid-farmer", "dispute_opened")
    assert len(notes) == 1


# --------------------------------------------------------------------------
# P1-15 — structured course enquiries (spec F4/T5)
# --------------------------------------------------------------------------


async def test_farmer_creates_structured_enquiry(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    course = await _published_course(client, instructor)

    resp = await client.post(
        f"/v1/courses/{course['id']}/enquiries",
        json={"questionTemplate": "Is this course suitable for 2-acre farmers?", "details": "I grow tomatoes in Nashik."},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"].startswith("enq_")
    assert body["courseId"] == course["id"]
    assert body["instructorId"] == "uid-inst"
    assert body["farmerId"] == "uid-farmer"
    assert body["status"] == "open"
    assert body["createdAt"]

    stored = user_store[f"course_enquiries/{body['id']}"]
    assert stored["questionTemplate"] == "Is this course suitable for 2-acre farmers?"
    assert stored["status"] == "open"

    # visible on the instructor's enquiry queue
    queue = await client.get("/v1/teachers/enquiries", headers=auth(instructor))
    assert queue.json()["data"][0]["id"] == body["id"]

    # instructor is notified
    notes = _notifications_for(user_store, "uid-inst", "course_enquiry")
    assert len(notes) == 1

    # unknown course
    missing = await client.post(
        "/v1/courses/crs-nope/enquiries", json={"questionTemplate": "Timings?"}, headers=auth(farmer)
    )
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "COURSE_NOT_FOUND"

    # instructors cannot enquire on their own course
    own = await client.post(
        f"/v1/courses/{course['id']}/enquiries",
        json={"questionTemplate": "Timings?"},
        headers=auth(instructor),
    )
    assert own.status_code == 400
    assert own.json()["error"]["code"] == "OWN_COURSE"


# --------------------------------------------------------------------------
# P1-16 — fee negotiation counter/accept (spec F6/T7/C6)
# --------------------------------------------------------------------------


async def test_teacher_counter_and_farmer_accept(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    course = await _published_course(client, instructor)
    enquiry = (
        await client.post(
            f"/v1/courses/{course['id']}/enquiries",
            json={"questionTemplate": "Batch timings?"},
            headers=auth(farmer),
        )
    ).json()
    eid = enquiry["id"]

    counter = await client.post(
        f"/v1/teachers/enquiries/{eid}/counter",
        json={"quotedFeeRupees": 4200, "ttlHours": 30},
        headers=auth(instructor),
    )
    assert counter.status_code == 200
    body = counter.json()
    assert body["status"] == "countered"
    assert body["quotedFeeRupees"] == 4200
    assert body["ttlHours"] == 30
    assert body["counteredAt"]
    expires = datetime.fromisoformat(body["expiresAt"])
    assert timedelta(hours=29) < expires - datetime.now(timezone.utc) < timedelta(hours=31)

    # farmer notified of the counter
    notes = _notifications_for(user_store, "uid-farmer", "fee_counter_offer")
    assert len(notes) == 1

    # someone else cannot accept
    stranger = seed_user(user_store, uid="uid-stranger")
    foreign = await client.post(f"/v1/teachers/enquiries/{eid}/accept", headers=auth(stranger))
    assert foreign.status_code == 403

    accept = await client.post(f"/v1/teachers/enquiries/{eid}/accept", headers=auth(farmer))
    assert accept.status_code == 200
    accepted = accept.json()
    assert accepted["status"] == "accepted"
    assert accepted["lockedFeeRupees"] == 4200
    assert accepted["feeLocked"] is True
    assert accepted["acceptedAt"]
    assert _notifications_for(user_store, "uid-inst", "fee_accepted")


async def test_counter_enforces_ttl_bounds_and_ownership(client, user_store):
    instructor = _instructor(client, user_store)
    other_instructor = _instructor(client, user_store, uid="uid-ins2")
    farmer = _farmer(client, user_store)
    course = await _published_course(client, instructor)
    eid = (
        await client.post(
            f"/v1/courses/{course['id']}/enquiries",
            json={"questionTemplate": "Is subsidy applicable?"},
            headers=auth(farmer),
        )
    ).json()["id"]

    for bad_ttl in (0, 49):
        resp = await client.post(
            f"/v1/teachers/enquiries/{eid}/counter",
            json={"quotedFeeRupees": 1000, "ttlHours": bad_ttl},
            headers=auth(instructor),
        )
        assert resp.status_code == 422

    # default TTL is 24h
    default = await client.post(
        f"/v1/teachers/enquiries/{eid}/counter",
        json={"quotedFeeRupees": 1000},
        headers=auth(instructor),
    )
    assert default.status_code == 200
    expires = datetime.fromisoformat(default.json()["expiresAt"])
    assert timedelta(hours=23) < expires - datetime.now(timezone.utc) < timedelta(hours=25)

    # a different instructor cannot counter someone else's enquiry
    foreign = await client.post(
        f"/v1/teachers/enquiries/{eid}/counter",
        json={"quotedFeeRupees": 1},
        headers=auth(other_instructor),
    )
    assert foreign.status_code == 403


async def test_accept_past_ttl_is_410(client, user_store):
    farmer = _farmer(client, user_store)
    user_store["course_enquiries/enq-exp"] = {
        "id": "enq-exp",
        "instructorId": "uid-inst",
        "farmerId": "uid-farmer",
        "courseId": "crs-1",
        "status": "countered",
        "quotedFeeRupees": 3000,
        "ttlHours": 24,
        "counteredAt": "2026-10-10T00:00:00+00:00",
        "expiresAt": "2026-10-11T00:00:00+00:00",  # long past
        "createdAt": "2026-10-10T00:00:00+00:00",
    }

    resp = await client.post("/v1/teachers/enquiries/enq-exp/accept", headers=auth(farmer))
    assert resp.status_code == 410
    assert resp.json()["error"]["code"] == "ENQUIRY_EXPIRED"
    assert user_store["course_enquiries/enq-exp"]["status"] == "countered"

    # an open (never countered) enquiry cannot be accepted either
    user_store["course_enquiries/enq-open"] = {
        "id": "enq-open",
        "instructorId": "uid-inst",
        "farmerId": "uid-farmer",
        "courseId": "crs-1",
        "status": "open",
        "createdAt": _now_iso(),
    }
    not_quotable = await client.post("/v1/teachers/enquiries/enq-open/accept", headers=auth(farmer))
    assert not_quotable.status_code == 409
    assert not_quotable.json()["error"]["code"] == "ENQUIRY_NOT_ACCEPTABLE"


# --------------------------------------------------------------------------
# P1-17 — batch sessions + QR check-in (spec F8/T10)
# --------------------------------------------------------------------------


async def _batch(client, user_store, instructor_token, course_id):
    resp = await client.post(
        "/v1/teachers/batches",
        json={
            "courseId": course_id,
            "batchName": "November Batch #1",
            "startDate": "2026-11-05",
            "endDate": "2026-11-20",
            "maxSeats": 20,
        },
        headers=auth(instructor_token),
    )
    assert resp.status_code == 201
    return resp.json()


async def test_batch_session_creation_and_qr_check_in(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    outsider = seed_user(user_store, uid="uid-outsider")
    course = await _published_course(client, instructor)
    batch = await _batch(client, user_store, instructor, course["id"])

    session = await client.post(
        f"/v1/teachers/batches/{batch['id']}/sessions",
        json={"title": "Field demo", "topic": "Nozzle calibration", "startsAt": _now_iso()},
        headers=auth(instructor),
    )
    assert session.status_code == 201
    body = session.json()
    assert body["id"].startswith("ses_")
    assert body["batchId"] == batch["id"]
    assert body["status"] == "scheduled"
    qr_token = body["qrToken"]
    assert len(qr_token) >= 32

    # only the batch instructor can schedule sessions
    other_instructor = _instructor(client, user_store, uid="uid-ins2")
    forbidden = await client.post(
        f"/v1/teachers/batches/{batch['id']}/sessions",
        json={"startsAt": _now_iso()},
        headers=auth(other_instructor),
    )
    assert forbidden.status_code == 403

    bad_time = await client.post(
        f"/v1/teachers/batches/{batch['id']}/sessions",
        json={"startsAt": "not-a-date"},
        headers=auth(instructor),
    )
    assert bad_time.status_code == 422

    # an enrolled farmer checks in with the QR token
    _seed_paid_purchase(user_store, "uid-farmer", course)
    check_in = await client.post(
        f"/v1/sessions/{body['id']}/check-in",
        json={"qrToken": qr_token},
        headers=auth(farmer),
    )
    assert check_in.status_code == 200
    assert check_in.json()["checkedIn"] is True

    # duplicate check-in rejected
    dup = await client.post(
        f"/v1/sessions/{body['id']}/check-in", json={"qrToken": qr_token}, headers=auth(farmer)
    )
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "ALREADY_CHECKED_IN"

    # wrong token rejected
    wrong = await client.post(
        f"/v1/sessions/{body['id']}/check-in", json={"qrToken": "bogus"}, headers=auth(farmer)
    )
    assert wrong.status_code == 403
    assert wrong.json()["error"]["code"] == "INVALID_QR_TOKEN"

    # non-member rejected
    user_store.pop(f"course_purchases/uid-farmer_{course['id']}")
    outsider_resp = await client.post(
        f"/v1/sessions/{body['id']}/check-in", json={"qrToken": qr_token}, headers=auth(outsider)
    )
    assert outsider_resp.status_code == 403
    assert outsider_resp.json()["error"]["code"] == "NOT_BATCH_MEMBER"

    # the instructor sees ONLY the real check-in record (fake seeding removed)
    attendance = await client.get(
        f"/v1/teachers/sessions/{body['id']}/attendance", headers=auth(instructor)
    )
    assert attendance.status_code == 200
    records = attendance.json()["records"]
    assert len(records) == 1
    assert records[0]["studentId"] == "uid-farmer"
    assert records[0]["status"] == "present"
    assert attendance.json()["totalPresent"] == 1


async def test_attendance_read_no_longer_seeds_fake_students(client, user_store):
    instructor = _instructor(client, user_store)
    resp = await client.get("/v1/teachers/sessions/sess-fresh/attendance", headers=auth(instructor))
    assert resp.status_code == 200
    body = resp.json()
    assert body["records"] == []
    assert body["totalPresent"] == 0
    stored = user_store["session_attendance/sess-fresh"]
    assert stored["records"] == []


# --------------------------------------------------------------------------
# P1-18 — assignments + photo submissions (spec F9/T11)
# --------------------------------------------------------------------------


async def test_assignment_create_and_photo_submission(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    outsider = seed_user(user_store, uid="uid-outsider")
    course = await _published_course(client, instructor)

    created = await client.post(
        f"/v1/courses/{course['id']}/assignments",
        json={"title": "Spray log photos", "instructions": "Upload field photos"},
        headers=auth(instructor),
    )
    assert created.status_code == 201
    assignment = created.json()
    assert assignment["maxPhotos"] == 3  # default
    assert assignment["status"] == "open"
    assert user_store[f"course_assignments/{assignment['id']}"]["instructorId"] == "uid-inst"

    # non-instructors cannot create assignments
    forbidden = await client.post(
        f"/v1/courses/{course['id']}/assignments",
        json={"title": "Sneaky"},
        headers=auth(farmer),
    )
    assert forbidden.status_code == 403

    # only enrolled students can submit
    locked = await client.post(
        f"/v1/assignments/{assignment['id']}/submissions",
        json={"photoUrls": ["https://cdn.example.com/p1.jpg"]},
        headers=auth(outsider),
    )
    assert locked.status_code == 403
    assert locked.json()["error"]["code"] == "NOT_ENROLLED"

    _seed_paid_purchase(user_store, "uid-farmer", course)
    submitted = await client.post(
        f"/v1/assignments/{assignment['id']}/submissions",
        json={"photoUrls": ["https://cdn.example.com/p1.jpg", "https://cdn.example.com/p2.jpg"]},
        headers=auth(farmer),
    )
    assert submitted.status_code == 201
    body = submitted.json()
    assert body["status"] == "submitted"
    assert body["studentId"] == "uid-farmer"
    assert len(body["photoUrls"]) == 2

    # hard bound: at most 3 photos per submission (model layer)
    too_many = await client.post(
        f"/v1/assignments/{assignment['id']}/submissions",
        json={"photoUrls": [f"https://cdn.example.com/p{i}.jpg" for i in range(4)]},
        headers=auth(farmer),
    )
    assert too_many.status_code == 422
    none = await client.post(
        f"/v1/assignments/{assignment['id']}/submissions", json={"photoUrls": []}, headers=auth(farmer)
    )
    assert none.status_code == 422

    # per-assignment cap: maxPhotos=2 rejects a 3-photo submission
    capped = (
        await client.post(
            f"/v1/courses/{course['id']}/assignments",
            json={"title": "Two photos only", "maxPhotos": 2},
            headers=auth(instructor),
        )
    ).json()
    over_cap = await client.post(
        f"/v1/assignments/{capped['id']}/submissions",
        json={"photoUrls": [f"https://cdn.example.com/p{i}.jpg" for i in range(3)]},
        headers=auth(farmer),
    )
    assert over_cap.status_code == 422
    assert over_cap.json()["error"]["code"] == "TOO_MANY_PHOTOS"

    # resubmit before the deadline replaces the photos
    resubmit = await client.post(
        f"/v1/assignments/{assignment['id']}/submissions",
        json={"photoUrls": ["https://cdn.example.com/better.jpg"]},
        headers=auth(farmer),
    )
    assert resubmit.status_code == 201
    assert resubmit.json()["photoUrls"] == ["https://cdn.example.com/better.jpg"]
    assert resubmit.json()["resubmittedAt"]
    stored = user_store[f"assignment_submissions/{assignment['id']}_uid-farmer"]
    assert stored["photoUrls"] == ["https://cdn.example.com/better.jpg"]


async def test_assignment_submission_deadline_enforced(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    course = await _published_course(client, instructor)
    due = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    assignment = (
        await client.post(
            f"/v1/courses/{course['id']}/assignments",
            json={"title": "Late work", "dueAt": due},
            headers=auth(instructor),
        )
    ).json()
    _seed_paid_purchase(user_store, "uid-farmer", course)

    # a first submission after the deadline is rejected
    late = await client.post(
        f"/v1/assignments/{assignment['id']}/submissions",
        json={"photoUrls": ["https://cdn.example.com/p1.jpg"]},
        headers=auth(farmer),
    )
    assert late.status_code == 409
    assert late.json()["error"]["code"] == "ASSIGNMENT_DUE_PASSED"

    # …and so is a resubmission
    user_store[f"assignment_submissions/{assignment['id']}_uid-farmer"] = {
        "id": f"{assignment['id']}_uid-farmer",
        "assignmentId": assignment["id"],
        "courseId": course["id"],
        "studentId": "uid-farmer",
        "photoUrls": ["https://cdn.example.com/old.jpg"],
        "status": "submitted",
        "submittedAt": _now_iso(),
    }
    relate = await client.post(
        f"/v1/assignments/{assignment['id']}/submissions",
        json={"photoUrls": ["https://cdn.example.com/new.jpg"]},
        headers=auth(farmer),
    )
    assert relate.status_code == 409


# --------------------------------------------------------------------------
# P1-19 — availability & blackout calendar (spec T3)
# --------------------------------------------------------------------------


async def test_teacher_availability_upsert_and_validation(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)

    farmer_resp = await client.put(
        "/v1/teachers/availability", json={"blackoutDates": ["2026-12-25"]}, headers=auth(farmer)
    )
    assert farmer_resp.status_code == 403

    resp = await client.put(
        "/v1/teachers/availability",
        json={
            "blackoutDates": ["2026-12-25", "2027-01-14"],
            "oneOnOneSlots": [
                {"date": "2026-11-02", "startTime": "10:00", "endTime": "11:30"},
                {"date": "2026-11-04", "startTime": "16:00", "endTime": "17:00"},
            ],
        },
        headers=auth(instructor),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["teacherId"] == "uid-inst"
    assert body["blackoutDates"] == ["2026-12-25", "2027-01-14"]
    assert len(body["oneOnOneSlots"]) == 2
    profile = user_store["teacher_profiles/uid-inst"]
    assert profile["availability"]["blackoutDates"] == ["2026-12-25", "2027-01-14"]

    # a second upsert replaces the calendar
    replace = await client.put(
        "/v1/teachers/availability",
        json={"blackoutDates": ["2027-02-01"], "oneOnOneSlots": []},
        headers=auth(instructor),
    )
    assert replace.status_code == 200
    assert replace.json()["blackoutDates"] == ["2027-02-01"]
    assert replace.json()["oneOnOneSlots"] == []

    # invalid shapes rejected
    bad_date = await client.put(
        "/v1/teachers/availability", json={"blackoutDates": ["25-12-2026"]}, headers=auth(instructor)
    )
    assert bad_date.status_code == 422
    bad_slot = await client.put(
        "/v1/teachers/availability",
        json={"oneOnOneSlots": [{"date": "2026-11-02", "startTime": "11:00", "endTime": "10:00"}]},
        headers=auth(instructor),
    )
    assert bad_slot.status_code == 422


# --------------------------------------------------------------------------
# P1-20 — certificate revocation (spec C13/E19)
# --------------------------------------------------------------------------


async def test_certificate_revoke_surfaces_on_public_verify(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    course = await _published_course(client, instructor)
    _seed_paid_purchase(
        user_store,
        "uid-farmer",
        course,
        isCompleted=True,
        certificateId="CERT-TEST-1",
        certificateIssuedAt=_now_iso(),
    )

    verify = await client.get("/v1/teachers/certificates/verify/CERT-TEST-1")
    assert verify.status_code == 200
    assert verify.json()["isValid"] is True
    assert verify.json()["revoked"] is None

    # a stranger cannot revoke; the instructor can
    stranger = seed_user(user_store, uid="uid-stranger")
    forbidden = await client.post(
        "/v1/teachers/certificates/CERT-TEST-1/revoke",
        json={"reason": "Forgery"},
        headers=auth(stranger),
    )
    assert forbidden.status_code == 403

    unknown = await client.post(
        "/v1/teachers/certificates/CERT-MISSING/revoke",
        json={"reason": "Forgery"},
        headers=auth(instructor),
    )
    assert unknown.status_code == 404

    revoke = await client.post(
        "/v1/teachers/certificates/CERT-TEST-1/revoke",
        json={"reason": "Issued in error — assessment never completed"},
        headers=auth(instructor),
    )
    assert revoke.status_code == 200
    assert revoke.json()["isValid"] is False
    assert revoke.json()["revoked"]["reason"] == "Issued in error — assessment never completed"
    assert revoke.json()["revoked"]["by"] == "uid-inst"

    purchase = user_store[f"course_purchases/uid-farmer_{course['id']}"]
    assert purchase["certificateRevoked"]["reason"].startswith("Issued in error")
    assert purchase["certificateIsValid"] is False

    # the public verify page now shows the certificate as revoked
    verify_after = await client.get("/v1/teachers/certificates/verify/CERT-TEST-1")
    assert verify_after.status_code == 200
    assert verify_after.json()["isValid"] is False
    assert verify_after.json()["revoked"]["reason"].startswith("Issued in error")

    # the learner is notified
    notes = _notifications_for(user_store, "uid-farmer", "certificate_revoked")
    assert len(notes) == 1


# --------------------------------------------------------------------------
# P2-14 — instructor settlement view (spec T14)
# --------------------------------------------------------------------------


async def test_instructor_settlements_scoped_with_payout_refs(client, user_store):
    instructor = _instructor(client, user_store)
    farmer = _farmer(client, user_store)
    user_store["settlements/st_a"] = {
        "id": "st_a",
        "role": "instructor",
        "entityId": "uid-inst",
        "periodStart": "2026-10-05",
        "periodEnd": "2026-10-11",
        "grossRupees": 5000,
        "commissionRupees": 750,
        "netRupees": 4250,
        "status": "paid",
        "payoutStatus": "paid",
        "payoutRef": "pout_utr_12345",
        "paidAt": _now_iso(),
        "sourceIds": ["p1", "p2"],
    }
    user_store["settlements/st_b"] = {
        "id": "st_b",
        "role": "instructor",
        "entityId": "uid-inst",
        "periodStart": "2026-09-28",
        "periodEnd": "2026-10-04",
        "grossRupees": 2000,
        "commissionRupees": 300,
        "netRupees": 1700,
        "status": "pending",
        "onHold": True,
        "sourceIds": ["p3"],
    }
    # another instructor's settlement + a different role must never leak in
    user_store["settlements/st_c"] = {
        "id": "st_c", "role": "instructor", "entityId": "uid-ins2",
        "periodStart": "2026-10-05", "periodEnd": "2026-10-11",
        "grossRupees": 999, "commissionRupees": 0, "netRupees": 999, "status": "pending",
    }
    user_store["settlements/st_d"] = {
        "id": "st_d", "role": "transport", "entityId": "uid-inst",
        "periodStart": "2026-10-05", "periodEnd": "2026-10-11",
        "grossRupees": 500, "commissionRupees": 50, "netRupees": 450, "status": "pending",
    }

    forbidden = await client.get("/v1/instructor/settlements", headers=auth(farmer))
    assert forbidden.status_code == 403

    resp = await client.get("/v1/instructor/settlements", headers=auth(instructor))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["currency"] == "INR"
    ids = [row["settlementId"] for row in body["data"]]
    assert set(ids) == {"st_a", "st_b"}
    # newest period first
    assert body["data"][0]["settlementId"] == "st_a"

    paid_row = body["data"][0]
    assert paid_row["payoutRef"] == "pout_utr_12345"
    assert paid_row["utr"] == "pout_utr_12345"
    assert paid_row["status"] == "paid"
    assert paid_row["sourceCount"] == 2

    held_row = body["data"][1]
    assert held_row["onHold"] is True
    assert held_row["status"] == "pending"

    assert body["totals"] == {"grossRupees": 7000, "commissionRupees": 1050, "netRupees": 5950}
