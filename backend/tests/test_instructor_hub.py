"""Instructor hub: teacher card, credentials, home, payments, commission,
feedback, enrolled-student detail, per-student doubt chat, curriculum,
learner progress, e-contracts, co-branded certificates, notifications.

Every assertion runs against docs created through the API or real collection
docs seeded into the store — no demo/fake fallback data.
"""

import hashlib
import json

from app.services.tokens import create_access_token
from tests.test_admin import _seed_admin, admin_headers
from tests.test_diary import auth, seed_user
from tests.test_orders import razorpay, rzp_signature  # noqa: F401

COURSE = {
    "title": "Tomato Protection Masterclass",
    "description": "Complete IPM for tomato",
    "kind": "videoCourse",
    "language": "hi",
    "category": "Pest Management",
    "priceRupees": 1000,
    "level": "beginner",
    "mode": "on-farm",
    "materialsList": ["Spray log register", "Pheromone traps x5"],
    "autoPublish": True,
}

MODULE = {
    "id": "mod_1",
    "title": "IPM Foundations",
    "order": 1,
    "lessons": [
        {"id": "les_1", "title": "Scouting basics", "durationMinutes": 30, "order": 1},
        {"id": "les_2", "title": "Trap counting", "durationMinutes": 20, "order": 2},
    ],
}

MODULE_2 = {
    "id": "mod_2",
    "title": "Spray Scheduling",
    "order": 2,
    "lessons": [
        {"id": "les_3", "title": "EC mixing", "durationMinutes": 25, "order": 1},
    ],
}


def _notifications_for(user_store, uid, ntype):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/")
        and doc.get("userId") == uid
        and doc.get("type") == ntype
    ]


async def _create_course(client, token, **overrides):
    body = {**COURSE, "modules": [MODULE, MODULE_2], **overrides}
    return await client.post("/v1/courses", json=body, headers=auth(token))


def _paid_purchase(user_store, uid, course_id, instructor_id, amount=1000.0, **extra):
    pid = f"{uid}_{course_id}"
    doc = {
        "id": pid,
        "userId": uid,
        "studentName": "Ram Patil",
        "studentPhone": "+919812345678",
        "courseId": course_id,
        "courseTitle": "Tomato Protection Masterclass",
        "instructorId": instructor_id,
        "amountRupees": amount,
        "commissionPercent": 10.0,
        "status": "paid",
        "progressPercent": 0,
        "completedLessonIds": [],
        "isCompleted": False,
        "certificateId": None,
        "paidAt": "2026-10-10T00:00:00+00:00",
        "createdAt": "2026-10-10T00:00:00+00:00",
    }
    doc.update(extra)
    user_store[f"course_purchases/{pid}"] = doc
    return doc


# ---------------- teacher card + credentials ----------------


async def test_teacher_card_real_docs(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"], name="Guru Shinde",
    )
    farmer = seed_user(user_store, uid="uid-f1")
    user_store["teacher_profiles/uid-t1"] = {
        "id": "uid-t1", "userId": "uid-t1", "name": "Guru Shinde",
        "headline": "IPM Specialist", "qualification": "M.Sc. Agriculture",
        "experienceYears": 12, "expertise": ["Agronomy", "IPM"],
        "isVerified": True,
    }
    case_id = "kyc_uid-t1_instructor"
    user_store[f"kyc_cases/{case_id}"] = {
        "caseId": case_id, "userId": "uid-t1", "persona": "instructor", "status": "verified",
        "docs": [
            {"docId": f"{case_id}:experience_letter", "type": "experience_letter", "status": "verified",
             "reviewedAt": "2026-10-01T00:00:00+00:00", "issuer": "ICAR"},
            {"docId": f"{case_id}:qualification_certificate", "type": "qualification_certificate",
             "status": "pending", "issuer": "MPKV Rahuri"},
        ],
        "submittedAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["courses/crs_a"] = {
        "id": "crs_a", "instructorId": "uid-t1", "status": "published",
        "title": "IPM", "language": "hi", "ratingAverage": 4.5, "ratingCount": 2, "salesCount": 7,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/teachers/uid-t1/card", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Guru Shinde"
    assert body["qualification"] == "M.Sc. Agriculture"
    assert body["experienceYears"] == 12
    assert body["domain"] == ["Agronomy", "IPM"]
    assert body["languages"] == ["hi"]
    letters = {l["type"]: l for l in body["letters"]}
    assert letters["experience_letter"]["status"] == "verified"
    assert letters["experience_letter"]["issuer"] == "ICAR"
    assert letters["qualification_certificate"]["status"] == "pending"
    assert body["totalCourses"] == 1
    assert body["totalStudents"] == 7
    assert body["ratingAverage"] == 4.5
    assert body["reviewCount"] == 2


async def test_teacher_card_unknown_404(client, user_store):
    farmer = seed_user(user_store, uid="uid-f1")
    resp = await client.get("/v1/teachers/uid-nope/card", headers=auth(farmer))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TEACHER_NOT_FOUND"


async def test_upload_teacher_credentials(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
    )
    farmer = seed_user(user_store, uid="uid-f1")
    resp = await client.post(
        "/v1/teachers/me/credentials",
        json={"docType": "experience_letter", "fileUrl": "gs://bucket/exp.pdf",
              "issuer": "ICAR", "referenceNo": "EXP/22/10", "issuedAt": "2022-04-01"},
        headers=auth(instructor),
    )
    assert resp.status_code == 201
    doc = resp.json()["document"]
    assert doc["type"] == "experience_letter"
    assert doc["status"] == "pending"
    assert doc["issuer"] == "ICAR"
    case = user_store["kyc_cases/kyc_uid-t1_instructor"]
    assert case["persona"] == "instructor"
    assert case["status"] == "pending"

    # same type replaces, new type appends
    await client.post(
        "/v1/teachers/me/credentials",
        json={"docType": "experience_letter", "fileUrl": "gs://bucket/exp-v2.pdf"},
        headers=auth(instructor),
    )
    await client.post(
        "/v1/teachers/me/credentials",
        json={"docType": "qualification_certificate", "fileUrl": "gs://bucket/deg.pdf"},
        headers=auth(instructor),
    )
    case = user_store["kyc_cases/kyc_uid-t1_instructor"]
    # seeded pan + liveness docs plus the two uploaded letters
    assert len(case["docs"]) == 4
    assert case["status"] == "pending"  # recomputed with pending letters
    exp = next(d for d in case["docs"] if d["type"] == "experience_letter")
    assert exp["storagePath"] == "gs://bucket/exp-v2.pdf"
    qual = next(d for d in case["docs"] if d["type"] == "qualification_certificate")
    assert qual["status"] == "pending"

    # non-instructor blocked
    resp = await client.post(
        "/v1/teachers/me/credentials",
        json={"docType": "experience_letter", "fileUrl": "gs://x/y.pdf"},
        headers=auth(farmer),
    )
    assert resp.status_code == 403

    # bad doc type rejected
    resp = await client.post(
        "/v1/teachers/me/credentials",
        json={"docType": "aadhaar", "fileUrl": "gs://x/y.pdf"},
        headers=auth(instructor),
    )
    assert resp.status_code == 422


# ---------------- instructor home ----------------


async def test_teacher_home_sections(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"], name="Guru Shinde",
    )
    user_store["teacher_profiles/uid-t1"] = {
        "id": "uid-t1", "userId": "uid-t1", "name": "Guru Shinde",
        "qualification": "M.Sc. Agriculture", "expertise": ["Agronomy"],
        "isVerified": True,
    }
    user_store["courses/crs_new"] = {
        "id": "crs_new", "instructorId": "uid-t1", "status": "published", "title": "Newest",
        "language": "mr", "level": "beginner", "salesCount": 1,
        "createdAt": "2026-10-11T00:00:00+00:00",
    }
    user_store["courses/crs_old"] = {
        "id": "crs_old", "instructorId": "uid-t1", "status": "published", "title": "Older",
        "language": "hi", "level": "advanced", "ratingAverage": 4.8, "ratingCount": 3,
        "salesCount": 2, "instructorEarningsRupees": 850.0,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["courses/crs_other"] = {
        "id": "crs_other", "instructorId": "uid-t2", "status": "published", "title": "Other teacher",
        "ratingAverage": 4.9, "ratingCount": 9, "salesCount": 50,
        "createdAt": "2026-10-05T00:00:00+00:00",
    }
    _paid_purchase(user_store, "uid-f1", "crs_new", "uid-t1", amount=1000.0)
    _paid_purchase(user_store, "uid-f2", "crs_old", "uid-t1", amount=1000.0,
                   isCompleted=True, progressPercent=100.0)
    resp = await client.get("/v1/teachers/home", headers=auth(instructor))
    assert resp.status_code == 200
    body = resp.json()
    assert body["profile"]["name"] == "Guru Shinde"
    assert body["profile"]["qualification"] == "M.Sc. Agriculture"
    assert set(body["profile"]["languages"]) == {"hi", "mr"}
    assert body["latestCourse"]["id"] == "crs_new"
    assert len(body["allCourses"]) == 2
    assert [c["id"] for c in body["ratedCourses"]] == ["crs_old"]
    assert set(body["levelWise"]) == {"beginner", "advanced"}
    assert body["otherCourses"][0]["id"] == "crs_other"
    assert body["stats"]["totalCourses"] == 2
    assert body["stats"]["totalStudents"] == 2
    assert body["stats"]["completedStudents"] == 1
    assert body["stats"]["averageRating"] == 4.8


async def test_teacher_home_forbidden_for_farmer(client, user_store):
    farmer = seed_user(user_store, uid="uid-f1")
    resp = await client.get("/v1/teachers/home", headers=auth(farmer))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "NOT_INSTRUCTOR"


# ---------------- payments + commission ----------------


async def test_teacher_payment_history_and_commission(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
    )
    _paid_purchase(user_store, "uid-f1", "crs_a", "uid-t1", amount=1000.0)
    _paid_purchase(user_store, "uid-f2", "crs_b", "uid-t1", amount=2000.0,
                   courseTitle="Advanced IPM", paidAt="2026-10-11T00:00:00+00:00")
    user_store["courses/crs_a"] = {"id": "crs_a", "instructorId": "uid-t1", "category": "Pest Management"}
    user_store["courses/crs_b"] = {"id": "crs_b", "instructorId": "uid-t1", "category": "Pest Management"}

    resp = await client.get("/v1/teachers/payments/history", headers=auth(instructor))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    newest = body["data"][0]
    assert newest["purchaseId"] == "uid-f2_crs_b"
    # default config courseGMVPct = 15
    assert newest["commissionPercent"] == 15
    assert newest["commissionRupees"] == 300.0
    assert newest["netRupees"] == 1700.0
    assert body["feesCollectedRupees"] == 3000.0
    assert body["adminCommissionRupees"] == 450.0
    assert body["netEarningsRupees"] == 2550.0
    assert body["onHold"] is True  # no verified bank account seeded

    resp = await client.get("/v1/teachers/commission-structure", headers=auth(instructor))
    cs = resp.json()
    assert cs["trade"] == "instructorCourses"
    assert cs["commissionPercent"] == 15
    assert cs["bandPercent"] == [15, 20]
    assert cs["chargedFrom"] == "instructor"


# ---------------- feedback ----------------


async def test_teacher_feedback_from_reviews_and_ratings(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
    )
    user_store["courses/crs_a"] = {"id": "crs_a", "instructorId": "uid-t1", "title": "IPM"}
    user_store["courses/crs_a/reviews/r1"] = {
        "id": "r1", "courseId": "crs_a", "userId": "uid-f1", "userName": "Ram Patil",
        "rating": 5, "reviewText": "practical and clear", "createdAt": "2026-10-10T00:00:00+00:00",
    }
    user_store["ratings/rat1"] = {
        "id": "rat1", "bookingKind": "course_enrollment", "bookingId": "uid-f2_crs_a",
        "stars": 4, "comment": "good value", "raterId": "uid-f2", "providerId": "uid-t1",
        "createdAt": "2026-10-11T00:00:00+00:00",
    }
    resp = await client.get("/v1/teachers/feedback", headers=auth(instructor))
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 2
    assert body["average"] == 4.5
    texts = {f["text"] for f in body["data"]}
    assert texts == {"practical and clear", "good value"}
    assert body["data"][0]["courseTitle"] in {"IPM", ""}


# ---------------- enrolled student detail ----------------


async def test_teacher_student_detail(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
    )
    seed_user(
        user_store, uid="uid-f1", active_profile="farmer",
        name="Ram Patil", village="Pimplas", district="Nashik",
        activeCrops=["Tomato", "Onion"],
    )
    user_store["market_lots/lot1"] = {
        "id": "lot1", "farmerId": "uid-f1", "crop": "Grapes", "status": "open",
        "quantityQuintals": 5,
    }
    _paid_purchase(user_store, "uid-f1", "crs_a", "uid-t1", amount=1000.0,
                   progressPercent=60.0)
    _paid_purchase(user_store, "uid-f1", "crs_b", "uid-t1", amount=500.0,
                   courseTitle="Soil Health", isCompleted=True, progressPercent=100.0,
                   certificateId="CERT-1", paidAt="2026-10-11T00:00:00+00:00")
    resp = await client.get("/v1/teachers/students/uid-f1", headers=auth(instructor))
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Ram Patil"
    assert body["address"]["village"] == "Pimplas"
    assert set(body["products"]) == {"Tomato", "Onion", "Grapes"}
    assert body["openLots"][0]["crop"] == "Grapes"
    assert len(body["courses"]) == 2
    newest = body["courses"][0]
    assert newest["courseTitle"] == "Soil Health"
    assert newest["isCompleted"] is True
    assert newest["certificateId"] == "CERT-1"

    resp = await client.get("/v1/teachers/students/uid-nobody", headers=auth(instructor))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "STUDENT_NOT_FOUND"


# ---------------- doubt chat gating ----------------


async def test_teacher_student_chat_unlocked_by_enrollment(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"], name="Guru Shinde",
    )
    seed_user(user_store, uid="uid-f1", name="Ram Patil")
    seed_user(user_store, uid="uid-f2", name="Stranger")
    _paid_purchase(user_store, "uid-f1", "crs_a", "uid-t1")

    # not enrolled -> locked
    resp = await client.post(
        "/v1/teachers/chat/open", json={"studentId": "uid-f2"}, headers=auth(instructor)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "CHAT_LOCKED_FOR_ENROLLMENT"

    # enrolled -> room opened
    resp = await client.post(
        "/v1/teachers/chat/open", json={"studentId": "uid-f1"}, headers=auth(instructor)
    )
    assert resp.status_code == 201
    assert resp.json()["studentId"] == "uid-f1"
    room_id = resp.json()["roomId"]

    # listed in the per-student room inbox
    resp = await client.get("/v1/teachers/chat/rooms", headers=auth(instructor))
    rooms = resp.json()["data"]
    assert len(rooms) == 1
    assert rooms[0]["studentId"] == "uid-f1"
    assert rooms[0]["roomId"] == room_id

    # self-chat blocked
    resp = await client.post(
        "/v1/teachers/chat/open", json={"studentId": "uid-t1"}, headers=auth(instructor)
    )
    assert resp.status_code == 400


async def test_student_chat_unlocked_by_purchase(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"], name="Guru Shinde",
    )
    farmer = seed_user(user_store, uid="uid-f1", name="Ram Patil")
    resp = await _create_course(client, instructor)
    assert resp.status_code == 201
    course_id = resp.json()["id"]

    # locked before purchase
    resp = await client.post(f"/v1/courses/{course_id}/chat", headers=auth(farmer))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "NOT_ENROLLED"

    # instructor of own course blocked
    resp = await client.post(f"/v1/courses/{course_id}/chat", headers=auth(instructor))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OWN_COURSE"

    _paid_purchase(user_store, "uid-f1", course_id, "uid-t1")
    resp = await client.post(f"/v1/courses/{course_id}/chat", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["courseId"] == course_id
    assert body["instructorId"] == "uid-t1"
    assert body["unlockedByPurchaseId"] == f"uid-f1_{course_id}"


# ---------------- curriculum + progress ----------------


async def test_course_curriculum_real_fields(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"], name="Guru Shinde",
    )
    farmer = seed_user(user_store, uid="uid-f1")
    resp = await _create_course(
        client, instructor,
        requirements=["Basic spraying knowledge"],
        whatYouWillLearn=["Scout weekly"],
        originalPriceRupees=2000,
    )
    assert resp.status_code == 201
    course_id = resp.json()["id"]

    # instructor credentials verified via KYC case
    user_store["kyc_cases/kyc_uid-t1_instructor"]["docs"].append({
        "docId": "kyc_uid-t1_instructor:degree_certificate", "type": "degree_certificate",
        "status": "verified", "reviewedAt": "2026-10-01T00:00:00+00:00",
    })
    user_store["courses/crs_x/reviews/r1"] = {
        "id": "r1", "courseId": "crs_x", "rating": 5,
        "createdAt": "2026-10-10T00:00:00+00:00",
    }
    course = user_store[f"courses/{course_id}"]
    course["ratingCount"] = 1
    course["ratingAverage"] = 5.0

    resp = await client.get(f"/v1/courses/{course_id}/curriculum", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["language"] == "hi"
    assert body["mode"] == "on-farm"
    assert body["sessionCount"] == 3
    assert body["durationMinutes"] == 75
    assert body["syllabus"] == ["IPM Foundations", "Spray Scheduling"]
    assert len(body["sessionPlan"]) == 2
    assert body["sessionPlan"][0]["lessons"][0]["lessonId"] == "les_1"
    assert body["prerequisites"] == ["Basic spraying knowledge"]
    assert body["materialsList"] == ["Spray log register", "Pheromone traps x5"]
    assert body["feeRupees"] == 1000
    creds = body["instructor"]["credentials"]
    assert creds == [{"type": "degree_certificate", "verifiedAt": "2026-10-01T00:00:00+00:00"}]
    assert body["reviews"] == {"count": 1, "average": 5.0}


async def test_course_progress_enrolled_only(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
    )
    farmer = seed_user(user_store, uid="uid-f1")
    stranger = seed_user(user_store, uid="uid-f2")
    resp = await _create_course(client, instructor)
    course_id = resp.json()["id"]

    resp = await client.get(f"/v1/courses/{course_id}/progress", headers=auth(stranger))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "NOT_ENROLLED"

    _paid_purchase(user_store, "uid-f1", course_id, "uid-t1",
                   completedLessonIds=["les_1", "les_2"], progressPercent=66.0)
    resp = await client.get(f"/v1/courses/{course_id}/progress", headers=auth(farmer))
    body = resp.json()
    assert body["completedLessons"] == 2
    assert body["totalLessons"] == 3
    assert body["modulesDone"] == 1
    assert body["modulesRemaining"] == 1  # "1 module remaining"
    assert body["progressPercent"] == 66.0


# ---------------- e-contract on booking confirmation ----------------


async def test_e_contract_generated_on_confirmation(client, user_store, razorpay):  # noqa: F811
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"], name="Guru Shinde",
    )
    farmer = seed_user(user_store, uid="uid-f1", name="Ram Patil")
    resp = await _create_course(client, instructor)
    course_id = resp.json()["id"]
    user_store["platform_config/course_refund"] = {
        "policy": {"windowDays": 7, "terms": "Full refund within 7 days of booking"},
    }

    resp = await client.post(f"/v1/courses/{course_id}/purchase", headers=auth(farmer))
    assert resp.status_code == 200
    order_id = resp.json()["paymentOrderId"]

    # contract not available before confirmation
    pid = f"uid-f1_{course_id}"
    resp = await client.get(f"/v1/courses/purchases/{pid}/contract", headers=auth(farmer))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "BOOKING_NOT_CONFIRMED"

    payment_id = "pay_test_1"
    resp = await client.post(
        "/v1/courses/purchases/verify",
        json={
            "razorpayOrderId": order_id,
            "razorpayPaymentId": payment_id,
            "razorpaySignature": rzp_signature(order_id, payment_id),
        },
        headers=auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["purchased"] is True
    contract_no = resp.json()["contractNo"]
    assert contract_no.startswith("CTC-")

    # instructor got the new-booking notification
    notes = _notifications_for(user_store, "uid-t1", "course_booking")
    assert len(notes) == 1
    assert "Ram Patil" in notes[0]["body"]

    # the e-contract payload
    resp = await client.get(f"/v1/courses/purchases/{pid}/contract", headers=auth(farmer))
    assert resp.status_code == 200
    contract = resp.json()
    assert contract["contractNo"] == contract_no
    assert contract["status"] == "active"
    assert contract["student"]["name"] == "Ram Patil"
    assert contract["instructor"]["name"] == "Guru Shinde"
    assert contract["feeRupees"] == 1000
    assert contract["curriculumScope"]["moduleCount"] == 2
    assert contract["curriculumScope"]["sessionCount"] == 3
    assert contract["curriculumScope"]["mode"] == "on-farm"
    assert contract["refundPolicy"]["windowDays"] == 7
    assert contract["signedAt"]

    # idempotent regeneration
    resp2 = await client.get(f"/v1/courses/purchases/{pid}/contract", headers=auth(instructor))
    assert resp2.json()["generatedAt"] == contract["generatedAt"]

    # non-participant blocked
    stranger = seed_user(user_store, uid="uid-f9")
    resp = await client.get(f"/v1/courses/purchases/{pid}/contract", headers=auth(stranger))
    assert resp.status_code == 403


# ---------------- co-branded certificate + notifications ----------------


async def test_certificate_download_tamper_evident(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"], name="Guru Shinde",
    )
    farmer = seed_user(user_store, uid="uid-f1", name="Ram Patil")
    resp = await _create_course(client, instructor)
    course_id = resp.json()["id"]
    _paid_purchase(user_store, "uid-f1", course_id, "uid-t1")

    resp = await client.post(
        f"/v1/teachers/courses/{course_id}/students/uid-f1/certificate",
        json={"customNote": "Distinction"},
        headers=auth(instructor),
    )
    assert resp.status_code == 200
    cert_id = resp.json()["certificateId"]

    # student notified
    notes = _notifications_for(user_store, "uid-f1", "certificate_issued")
    assert len(notes) == 1

    # downloadable co-branded payload
    resp = await client.get(f"/v1/teachers/certificates/{cert_id}/download")
    assert resp.status_code == 200
    body = resp.json()
    assert body["recipientName"] == "Ram Patil"
    assert body["courseTitle"] == "Tomato Protection Masterclass"
    assert body["instructorName"] == "Guru Shinde"
    assert body["platform"] == "Agrovercity"
    assert body["institution"] == "GyanSetu Digital Krishi Gurukul"
    assert body["verificationUrl"].endswith(cert_id)
    qr = json.loads(body["qrPayload"])
    assert qr["cert"] == cert_id
    assert qr["sha256"] == body["fingerprintSha256"]
    # fingerprint matches the canonical payload (tamper-evident)
    canonical = {k: body[k] for k in (
        "certificateId", "recipientName", "courseTitle", "instructorName",
        "issuedAt", "institution", "platform",
    )}
    assert hashlib.sha256(
        json.dumps(canonical, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest() == body["fingerprintSha256"]

    resp = await client.get("/v1/teachers/certificates/NOPE/download")
    assert resp.status_code == 404


# ---------------- payout released notification ----------------


async def test_payout_released_notification(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
    )
    user_store["users/uid-t1/bank_accounts/ba1"] = {
        "id": "ba1", "verifyStatus": "verified", "isPrimary": True,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    user_store["settlements/st_1"] = {
        "id": "st_1", "entityId": "uid-t1", "role": "instructor",
        "status": "pending", "held": False,
        "grossRupees": 2550, "commissionRupees": 450, "netRupees": 2100,
        "periodStart": "2026-10-05", "periodEnd": "2026-10-11",
    }
    resp = await client.post(
        "/v1/jobs/settlements/payouts", json={"periodStart": "2026-10-05", "periodEnd": "2026-10-11"}
    )
    assert resp.status_code == 200
    assert resp.json()["paid"] == 1
    notes = _notifications_for(user_store, "uid-t1", "payout_released")
    assert len(notes) == 1
    assert "2100" in notes[0]["body"]


# ---------------- course create persists mode/materials ----------------


async def test_course_create_persists_mode_and_materials(client, user_store):
    instructor = seed_user(
        user_store, uid="uid-t1", active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
    )
    resp = await _create_course(client, instructor, mode="hybrid", materialsList=["Kit A"])
    assert resp.status_code == 201
    doc = user_store[f"courses/{resp.json()['id']}"]
    assert doc["mode"] == "hybrid"
    assert doc["materialsList"] == ["Kit A"]
