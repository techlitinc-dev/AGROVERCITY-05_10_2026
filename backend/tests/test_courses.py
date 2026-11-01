"""Course publishing, free enrolment and the paid-course contact → manual
grant workflow (online checkout was removed from the course journey)."""
from tests.test_diary import auth, seed_user
from tests.test_admin import _seed_admin, admin_headers
from app.core.security import hash_mpin

COURSE = {
    "title": "Tomato Protection Masterclass",
    "description": "Complete IPM for tomato",
    "kind": "videoPodcast",
    "language": "hi",
    "category": "Pest Management",
    "priceRupees": 199,
    "mediaUrl": "https://cdn.example.com/tomato.mp4",
}


async def _create(client, token, **overrides):
    resp = await client.post(
        "/v1/courses", json={**COURSE, **overrides}, headers=auth(token)
    )
    return resp


def _instructor_token(user_store):
    return seed_user(
        user_store,
        uid="uid-instructor",
        active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
        name="Guru Shinde",
    )


def _learner_with_mpin(user_store, uid="uid-farmer"):
    token = seed_user(user_store, uid=uid)
    user_store[f"users/{uid}"]["mpinHash"] = hash_mpin("1234")
    return token


async def _publish(client, user_store, course_id):
    admin = _seed_admin(user_store)
    resp = await client.post(
        f"/v1/admin/courses/{course_id}/review",
        json={"action": "publish"},
        headers=admin_headers(admin),
    )
    assert resp.status_code == 200


async def test_instructor_can_register_with_expertise(client):
    resp = await client.post(
        "/v1/auth/register",
        json={
            "idToken": "x",
            "name": "Guru Shinde",
            "phone": "+919812345678",
            "state": "Maharashtra",
            "district": "Nashik",
            "tehsil": "Niphad",
            "village": "Pimplas",
            "landAreaAcres": 0,
            "soilType": "",
            "irrigationType": "",
            "crops": [],
            "mpin": "1234",
            "profiles": ["instructor"],
            "primaryProfile": "instructor",
            "roleProfiles": {"instructor": {"expertise": ["Agronomy"]}},
        },
    )
    assert resp.status_code == 200
    me = await client.get(
        "/v1/users/me", headers=auth(resp.json()["accessToken"])
    )
    assert me.json()["roleProfiles"]["instructor"]["expertise"] == ["Agronomy"]


async def test_instructor_profile_activation_returns_home_route(client, user_store):
    token = seed_user(
        user_store,
        uid="uid-instructor",
        active_profile="farmer",
        linkedProfiles=["farmer", "instructor"],
    )
    resp = await client.post(
        "/v1/users/me/profiles/instructor/activate", headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["activeProfile"] == "instructor"
    assert resp.json()["defaultHomeRoute"] == "instructorHome"


async def test_non_instructor_cannot_create_course(client, user_store):
    token = seed_user(user_store, uid="uid-farmer")
    resp = await _create(client, token)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "NOT_INSTRUCTOR"


async def test_course_created_pending_and_hidden_until_published(client, user_store):
    instructor = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer")

    resp = await _create(client, instructor)
    assert resp.status_code == 201
    course = resp.json()
    assert course["status"] == "pendingReview"
    course_id = course["id"]

    # Farmer browse must not show it yet
    browse = await client.get("/v1/courses", headers=auth(farmer))
    assert browse.json()["total"] == 0
    detail = await client.get(f"/v1/courses/{course_id}", headers=auth(farmer))
    assert detail.status_code == 404

    # Admin queue + publish
    admin = _seed_admin(user_store)
    queue = await client.get(
        "/v1/admin/courses/queue", headers=admin_headers(admin)
    )
    assert queue.json()["total"] == 1

    pub = await client.post(
        f"/v1/admin/courses/{course_id}/review",
        json={"action": "publish"},
        headers=admin_headers(admin),
    )
    assert pub.status_code == 200

    browse = await client.get("/v1/courses", headers=auth(farmer))
    assert browse.json()["total"] == 1


async def test_paid_contact_grant_flow_replaces_checkout(client, user_store):
    """Paid course: contact request (KYC + terms + MPIN) → instructor manual
    grant → full content. No payment object is ever created."""
    instructor = _instructor_token(user_store)
    farmer = _learner_with_mpin(user_store)
    course = (await _create(client, instructor)).json()
    await _publish(client, user_store, course["id"])

    # Instructor cannot request contact on their own course
    own = await client.post(
        f"/v1/courses/{course['id']}/contact-requests",
        json={"termsAccepted": True, "mpin": "1234"},
        headers=auth(instructor),
    )
    assert own.status_code == 409

    # Online checkout endpoints are gone from the course journey
    gone = await client.post(f"/v1/courses/{course['id']}/purchase", headers=auth(farmer))
    assert gone.status_code == 410
    assert gone.json()["error"]["code"] == "ONLINE_CHECKOUT_REMOVED"

    # Media hidden before access
    detail = await client.get(f"/v1/courses/{course['id']}", headers=auth(farmer))
    assert "mediaUrl" not in detail.json()
    assert detail.json()["access"]["accessStatus"] == "none"

    # Direct enrolment is rejected for paid courses
    enroll = await client.post(
        f"/v1/courses/{course['id']}/enroll", json={}, headers=auth(farmer)
    )
    assert enroll.status_code == 409
    assert enroll.json()["error"]["code"] == "PAID_COURSE_CONTACT_REQUIRED"

    request = await client.post(
        f"/v1/courses/{course['id']}/contact-requests",
        json={"termsAccepted": True, "mpin": "1234"},
        headers=auth(farmer),
    )
    assert request.status_code == 201
    body = request.json()
    assert body["request"]["status"] == "contacted"
    assert body["request"]["priceRupees"] == 199
    assert body["request"]["currency"] == "INR"
    assert body["request"]["contactRevealedAt"]
    assert "mpin" not in body["request"]
    assert body["instructorContact"]["phone"]
    assert body["chatRoomId"]

    # Contact alone does NOT grant access
    blocked = await client.get(f"/v1/courses/{course['id']}/learn", headers=auth(farmer))
    assert blocked.status_code == 403
    detail = await client.get(f"/v1/courses/{course['id']}", headers=auth(farmer))
    assert detail.json()["access"]["accessStatus"] == "none"
    # …and no payment/order record exists
    pid = f"uid-farmer_{course['id']}"
    assert f"course_purchases/{pid}" not in user_store

    # The request shows up on the instructor's Enrollment Requests
    queue = await client.get("/v1/instructor/enrollment-requests", headers=auth(instructor))
    assert queue.status_code == 200
    assert queue.json()["total"] == 1
    row = queue.json()["data"][0]
    assert row["learnerIdentityVerified"] is True
    assert row["accessStatus"] == "none"
    assert row["learnerContact"]["phone"]

    # Grant requires the instructor's acknowledgement
    no_ack = await client.post(
        f"/v1/instructor/enrollment-requests/{row['requestId']}/grant",
        json={"paymentReceivedAck": False},
        headers=auth(instructor),
    )
    assert no_ack.status_code == 422
    assert no_ack.json()["error"]["code"] == "ACK_REQUIRED"

    grant = await client.post(
        f"/v1/instructor/enrollment-requests/{row['requestId']}/grant",
        json={"paymentReceivedAck": True, "externalPaymentRef": "UPI-123"},
        headers=auth(instructor),
    )
    assert grant.status_code == 200
    assert grant.json()["granted"] is True
    assert grant.json()["access"]["accessStatus"] == "granted"
    assert grant.json()["access"]["accessType"] == "manualOffPlatform"

    # Idempotent re-grant
    re_grant = await client.post(
        f"/v1/instructor/enrollment-requests/{row['requestId']}/grant",
        json={"paymentReceivedAck": True},
        headers=auth(instructor),
    )
    assert re_grant.json()["alreadyGranted"] is True

    # Full content + library visible after grant
    detail = await client.get(f"/v1/courses/{course['id']}", headers=auth(farmer))
    assert detail.json()["mediaUrl"] == COURSE["mediaUrl"]
    assert detail.json()["access"]["accessStatus"] == "granted"
    library = await client.get("/v1/courses/purchased/list", headers=auth(farmer))
    assert library.json()["total"] == 1

    mine = await client.get("/v1/courses/mine", headers=auth(instructor))
    doc = mine.json()["data"][0]
    # no platform commission/earnings are recorded for off-platform grants
    assert doc.get("commissionRupees") == 0.0


async def test_free_course_claim_hides_media_until_entitled(client, user_store):
    instructor = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer")
    course = (await _create(client, instructor, priceRupees=0)).json()

    admin = _seed_admin(user_store)
    await client.post(
        f"/v1/admin/courses/{course['id']}/review",
        json={"action": "publish"},
        headers=admin_headers(admin),
    )

    detail = await client.get(f"/v1/courses/{course['id']}", headers=auth(farmer))
    assert "mediaUrl" not in detail.json()

    claim = await client.post(
        f"/v1/courses/{course['id']}/enroll", json={}, headers=auth(farmer)
    )
    assert claim.json()["enrolled"] is True
    assert claim.json()["accessType"] == "free"

    detail = await client.get(f"/v1/courses/{course['id']}", headers=auth(farmer))
    assert detail.json()["mediaUrl"] == COURSE["mediaUrl"]


async def test_reject_requires_reason_and_edit_resubmits(client, user_store):
    instructor = _instructor_token(user_store)
    course = (await _create(client, instructor)).json()
    admin = _seed_admin(user_store)

    no_reason = await client.post(
        f"/v1/admin/courses/{course['id']}/review",
        json={"action": "reject"},
        headers=admin_headers(admin),
    )
    assert no_reason.status_code == 422

    rejected = await client.post(
        f"/v1/admin/courses/{course['id']}/review",
        json={"action": "reject", "reason": "Video quality too low"},
        headers=admin_headers(admin),
    )
    assert rejected.status_code == 200

    mine = await client.get("/v1/courses/mine", headers=auth(instructor))
    assert mine.json()["data"][0]["rejectedReason"] == "Video quality too low"

    # Instructor edit returns course to review
    edit = await client.put(
        f"/v1/courses/{course['id']}",
        json={"description": "Re-recorded in HD"},
        headers=auth(instructor),
    )
    assert edit.json()["status"] == "pendingReview"
    assert edit.json()["rejectedReason"] is None


async def test_feature_and_report(client, user_store):
    instructor = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer")
    course = (await _create(client, instructor, priceRupees=0)).json()
    admin = _seed_admin(user_store)
    await client.post(
        f"/v1/admin/courses/{course['id']}/review",
        json={"action": "publish"},
        headers=admin_headers(admin),
    )

    featured = await client.post(
        f"/v1/admin/courses/{course['id']}/feature",
        json={"isFeatured": True},
        headers=admin_headers(admin),
    )
    assert featured.json()["isFeatured"] is True

    browse = await client.get("/v1/courses", headers=auth(farmer))
    assert browse.json()["data"][0]["isFeatured"] is True

    await client.post(
        f"/v1/courses/{course['id']}/enroll", json={}, headers=auth(farmer)
    )
    report = await client.get("/v1/admin/courses/report", headers=admin_headers(admin))
    assert report.json()["totalSales"] == 1
    assert report.json()["freeClaims"] == 1


async def test_certificate_earned_emits_task(client, user_store):
    instructor = _instructor_token(user_store)
    farmer = _learner_with_mpin(user_store)
    course = (await _create(client, instructor)).json()
    await _publish(client, user_store, course["id"])

    # paid course: contact → instructor grant → learn → certificate
    await client.post(
        f"/v1/courses/{course['id']}/contact-requests",
        json={"termsAccepted": True, "mpin": "1234"},
        headers=auth(farmer),
    )
    queue = await client.get("/v1/instructor/enrollment-requests", headers=auth(instructor))
    request_id = queue.json()["data"][0]["requestId"]
    grant = await client.post(
        f"/v1/instructor/enrollment-requests/{request_id}/grant",
        json={"paymentReceivedAck": True},
        headers=auth(instructor),
    )
    assert grant.status_code == 200

    resp = await client.post(
        f"/v1/courses/{course['id']}/lessons/lesson-1/progress",
        json={"completed": True},
        headers=auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["isCompleted"] is True
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 1
    assert tasks[0]["module"] == "courses"
    assert tasks[0]["kind"] == "certificate_earned"
