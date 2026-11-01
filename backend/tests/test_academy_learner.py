"""WS-01 learner-side 'Krishi Academy' backend tests (phase-04), updated for
the Farmer–Instructor workflow: instant free enrolment (no MPIN/contact/payment)
and paid courses via contact request → instructor manual grant. Covers the
public certificate verification contract and the catalog pagination envelope.
Coin-award cap tests stay (coins still exist platform-wide); coin redemption
was removed from the course journey.
"""
from tests.test_diary import auth, seed_user
from tests.test_admin import _seed_admin, admin_headers
from app.core.security import hash_mpin

from app.services.coins import award_coins

COURSE = {
    "title": "Tomato Protection Masterclass",
    "description": "Complete IPM for tomato",
    "kind": "videoPodcast",
    "language": "hi",
    "category": "Pest Management",
    "priceRupees": 199,
    "mediaUrl": "https://cdn.example.com/tomato.mp4",
}


def _instructor_token(user_store):
    return seed_user(
        user_store,
        uid="uid-instructor",
        active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
        name="Guru Shinde",
    )


async def _create(client, token, **overrides):
    return await client.post("/v1/courses", json={**COURSE, **overrides}, headers=auth(token))


async def _publish(client, user_store, course_id):
    admin = _seed_admin(user_store)
    resp = await client.post(
        f"/v1/admin/courses/{course_id}/review",
        json={"action": "publish"},
        headers=admin_headers(admin),
    )
    assert resp.status_code == 200


def _learner_with_mpin(user_store, uid="uid-farmer", **overrides):
    token = seed_user(user_store, uid=uid, **overrides)
    user_store[f"users/{uid}"]["mpinHash"] = hash_mpin("1234")
    return token


async def test_free_course_enroll_grants_access_and_learn_opens(client, user_store):
    instructor = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer")
    course = (await _create(client, instructor, priceRupees=0)).json()
    await _publish(client, user_store, course["id"])

    enroll = await client.post(
        f"/v1/courses/{course['id']}/enroll",
        json={"useCoins": False, "coinsToRedeem": 0},
        headers=auth(farmer),
    )
    assert enroll.status_code == 200
    assert enroll.json()["enrolled"] is True
    assert enroll.json()["accessType"] == "free"
    assert enroll.json()["accessStatus"] == "granted"
    assert enroll.json()["learningStatus"] == "notStarted"
    record = user_store[f"course_purchases/uid-farmer_{course['id']}"]
    assert record["accessType"] == "free"
    assert record["accessStatus"] == "granted"
    assert "status" not in record  # no payment status on new records

    learn = await client.get(f"/v1/courses/{course['id']}/learn", headers=auth(farmer))
    assert learn.status_code == 200
    assert "userProgress" in learn.json()


async def test_paid_contact_grant_and_duplicate_grant_noop(client, user_store):
    instructor = _instructor_token(user_store)
    farmer = _learner_with_mpin(user_store)
    course = (await _create(client, instructor)).json()
    await _publish(client, user_store, course["id"])

    # Paid courses cannot be enrolled directly…
    enroll = await client.post(
        f"/v1/courses/{course['id']}/enroll", json={}, headers=auth(farmer)
    )
    assert enroll.status_code == 409
    assert enroll.json()["error"]["code"] == "PAID_COURSE_CONTACT_REQUIRED"

    # …the learner contacts the instructor (KYC + terms + MPIN)…
    contact = await client.post(
        f"/v1/courses/{course['id']}/contact-requests",
        json={"termsAccepted": True, "mpin": "1234"},
        headers=auth(farmer),
    )
    assert contact.status_code == 201

    # …and repeated contact returns the SAME request and chat room
    again = await client.post(
        f"/v1/courses/{course['id']}/contact-requests",
        json={"termsAccepted": True, "mpin": "1234"},
        headers=auth(farmer),
    )
    assert again.status_code in (200, 201)
    assert again.json()["alreadyExists"] is True
    assert again.json()["request"]["id"] == contact.json()["request"]["id"]
    assert again.json()["chatRoomId"] == contact.json()["chatRoomId"]
    rooms = [k for k in user_store if k.startswith("chat_rooms/")]
    assert len(rooms) == 1

    # …then the instructor grants access — duplicate grants are no-ops.
    queue = await client.get("/v1/instructor/enrollment-requests", headers=auth(instructor))
    request_id = queue.json()["data"][0]["requestId"]
    grant = await client.post(
        f"/v1/instructor/enrollment-requests/{request_id}/grant",
        json={"paymentReceivedAck": True},
        headers=auth(instructor),
    )
    assert grant.json()["granted"] is True
    re_grant = await client.post(
        f"/v1/instructor/enrollment-requests/{request_id}/grant",
        json={"paymentReceivedAck": True},
        headers=auth(instructor),
    )
    assert re_grant.json()["alreadyGranted"] is True
    record = user_store[f"course_purchases/uid-farmer_{course['id']}"]
    assert record["accessStatus"] == "granted"
    assert record["accessType"] == "manualOffPlatform"
    # grants never create payment fields
    assert "amountRupees" not in record
    assert "razorpayOrderId" not in record


async def test_public_certificate_verify_contract(client, user_store):
    instructor = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer")
    course = (await _create(client, instructor, priceRupees=0)).json()
    await _publish(client, user_store, course["id"])

    await client.post(
        f"/v1/courses/{course['id']}/enroll", json={}, headers=auth(farmer)
    )

    progress = await client.post(
        f"/v1/courses/{course['id']}/lessons/lesson-1/progress",
        json={"completed": True},
        headers=auth(farmer),
    )
    assert progress.status_code == 200
    assert progress.json()["isCompleted"] is True
    certificate_id = progress.json()["certificateId"]
    assert certificate_id

    # Public, unauthenticated verification of a real certificate.
    pub = await client.get(f"/v1/teachers/certificates/verify/{certificate_id}")
    assert pub.status_code == 200
    body = pub.json()
    assert body["isValid"] is True
    assert body["certificateId"] == certificate_id
    assert "tamperProofHash" not in body

    # Unknown ids are honestly not found (no fabricated demo payload).
    missing = await client.get("/v1/teachers/certificates/verify/UNKNOWN-CERT-000")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "CERTIFICATE_NOT_FOUND"


async def test_catalog_returns_pagination_envelope(client, user_store):
    _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer")
    resp = await client.get("/v1/courses", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    assert {"page", "pageSize", "total"} <= set(body.keys())


async def _coin_ledger_count(user_store, uid):
    prefix = f"users/{uid}/coin_ledger/"
    return len([k for k in user_store if k.startswith(prefix)])


async def test_daily_earn_cap_caps_and_drops_awards(client, user_store):
    # 200 in one day is allowed; the 201st is dropped (balance unchanged, no ledger row).
    seed_user(user_store, uid="uid-cap-1")
    assert await award_coins("uid-cap-1", 200, "test") == 200
    assert user_store["users/uid-cap-1"]["agriCoins"] == 200
    ledger_before = await _coin_ledger_count(user_store, "uid-cap-1")

    assert await award_coins("uid-cap-1", 25, "test") == 200
    assert user_store["users/uid-cap-1"]["agriCoins"] == 200
    assert await _coin_ledger_count(user_store, "uid-cap-1") == ledger_before

    # A partial award is trimmed to the remaining daily allowance.
    seed_user(user_store, uid="uid-cap-2")
    assert await award_coins("uid-cap-2", 150, "test") == 150
    assert await award_coins("uid-cap-2", 100, "test") == 200
    assert user_store["users/uid-cap-2"]["agriCoins"] == 200


async def test_course_enrol_ignores_coin_flags(client, user_store):
    """Coins/gamification were removed from the course journey: the legacy
    useCoins fields are accepted for API compatibility but never spend coins."""
    instructor = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer", agriCoins=1000)
    course = (await _create(client, instructor, priceRupees=0)).json()
    await _publish(client, user_store, course["id"])

    resp = await client.post(
        f"/v1/courses/{course['id']}/enroll",
        json={"useCoins": True, "coinsToRedeem": 600},
        headers=auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["enrolled"] is True
    assert user_store["users/uid-farmer"]["agriCoins"] == 1000
    ledger = [k for k in user_store if k.startswith("users/uid-farmer/coin_ledger/")]
    assert ledger == []


async def test_my_learning_emits_learner_discovery_tasks(client, user_store):
    farmer = seed_user(user_store, uid="uid-farmer", crops=["Pest Management"])
    instructor = _instructor_token(user_store)
    course = (await _create(client, instructor, priceRupees=0, category="Pest Management")).json()
    await _publish(client, user_store, course["id"])
    enroll = await client.post(
        f"/v1/courses/{course['id']}/enroll",
        json={"useCoins": False, "coinsToRedeem": 0},
        headers=auth(farmer),
    )
    assert enroll.json()["enrolled"] is True

    # A batch whose date window covers today.
    batch_id = "btc_today"
    user_store[f"course_batches/{batch_id}"] = {
        "id": batch_id,
        "instructorId": "uid-instructor",
        "courseId": course["id"],
        "batchName": "Kharif Intensive Batch",
        "startDate": "2000-01-01",
        "endDate": "2999-12-31",
        "scheduleDays": "Daily 5:00 PM",
        "status": "active",
    }

    resp = await client.get("/v1/courses/my-learning", headers=auth(farmer))
    assert resp.status_code == 200
    kinds = {
        doc.get("kind")
        for key, doc in user_store.items()
        if key.startswith("tasks/") and doc.get("userId") == "uid-farmer"
    }
    assert "new_courses_for_you" in kinds
    assert "live_class_today" in kinds
