"""WS-01 learner-side 'Krishi Academy' backend tests (phase-04).

Covers purchase + verify, duplicate-verify no-op, the public certificate
verification contract, and the catalog pagination envelope. Coin-cap tests are
appended by later WS-01 tasks.
"""
from tests.test_diary import auth, seed_user
from tests.test_admin import _seed_admin, admin_headers
from tests.test_orders import razorpay, rzp_signature  # noqa: F401

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


def _verify_body(order_id, payment_id="pay_test_1"):
    return {
        "razorpayOrderId": order_id,
        "razorpayPaymentId": payment_id,
        "razorpaySignature": rzp_signature(order_id, payment_id),
    }


async def test_free_course_enroll_marks_paid_and_learn_opens(client, user_store):
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
    assert user_store[f"course_purchases/uid-farmer_{course['id']}"]["status"] == "paid"

    learn = await client.get(f"/v1/courses/{course['id']}/learn", headers=auth(farmer))
    assert learn.status_code == 200
    assert "userProgress" in learn.json()


async def test_paid_enroll_verify_and_duplicate_verify_noop(client, user_store, razorpay):
    instructor = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer")
    course = (await _create(client, instructor)).json()
    await _publish(client, user_store, course["id"])

    enroll = await client.post(
        f"/v1/courses/{course['id']}/enroll",
        json={"useCoins": False, "coinsToRedeem": 0},
        headers=auth(farmer),
    )
    assert enroll.status_code == 200
    assert enroll.json()["enrolled"] is False
    order_id = enroll.json()["paymentOrderId"]
    assert order_id

    verify = await client.post(
        "/v1/courses/purchases/verify",
        json=_verify_body(order_id),
        headers=auth(farmer),
    )
    assert verify.status_code == 200
    assert verify.json()["purchased"] is True
    assert user_store[f"course_purchases/uid-farmer_{course['id']}"]["status"] == "paid"

    # Duplicate verify is a no-op — salesCount must not increment twice.
    reverify = await client.post(
        "/v1/courses/purchases/verify",
        json=_verify_body(order_id),
        headers=auth(farmer),
    )
    assert reverify.status_code == 200
    assert reverify.json()["purchased"] is True
    assert user_store[f"courses/{course['id']}"]["salesCount"] == 1


async def test_public_certificate_verify_contract(client, user_store, razorpay):
    instructor = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer")
    course = (await _create(client, instructor)).json()
    await _publish(client, user_store, course["id"])

    enroll = await client.post(
        f"/v1/courses/{course['id']}/enroll",
        json={"useCoins": False, "coinsToRedeem": 0},
        headers=auth(farmer),
    )
    order_id = enroll.json()["paymentOrderId"]
    await client.post(
        "/v1/courses/purchases/verify",
        json=_verify_body(order_id),
        headers=auth(farmer),
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


async def test_over_50_percent_coin_redemption_rejected(client, user_store):
    instructor = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer", agriCoins=1000)
    course = (
        await _create(client, instructor, priceRupees=1000, coinsDiscountAllowed=800)
    ).json()
    await _publish(client, user_store, course["id"])

    # 600 > 50% of a ₹1000 fee (500) → rejected with the standard envelope.
    over = await client.post(
        f"/v1/courses/{course['id']}/enroll",
        json={"useCoins": True, "coinsToRedeem": 600},
        headers=auth(farmer),
    )
    assert over.status_code == 422
    assert over.json()["error"]["code"] == "INVALID_COIN_AMOUNT"

    # Exactly 50% is allowed and leaves a payable remainder.
    ok = await client.post(
        f"/v1/courses/{course['id']}/enroll",
        json={"useCoins": True, "coinsToRedeem": 500},
        headers=auth(farmer),
    )
    assert ok.status_code == 200
    assert ok.json()["enrolled"] is False


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
