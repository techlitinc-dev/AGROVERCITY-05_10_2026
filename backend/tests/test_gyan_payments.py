"""WS-04 Gyan Hub payment + coin tests (phase-04).

Covers the workshop `enroll` → Razorpay `enroll/verify` flow (task 4.1), the
X11 ≤50%-of-order coin redemption cap on workshop enroll (task 4.3) and the
expert-talk +25 award respecting the 200/day earn cap (tasks 4.2/4.4).
"""
import pytest

from tests.test_diary import auth, seed_user
from tests.test_gyan import seed_gyan_store
from tests.test_orders import razorpay, rzp_signature  # noqa: F401

from datetime import datetime, timezone

from app.services.coins import award_coins


@pytest.fixture
def gyan_razorpay(razorpay, monkeypatch):  # noqa: F811
    """Razorpay test keys (shared `razorpay` fixture) + a stubbed outbound order
    call on the gyan router — the shared fixture only stubs the orders/courses
    routers, so without this the real Razorpay HTTP call would fire."""
    def fake_create_order(amount_paise, receipt):
        return {
            "id": f"order_test_{receipt}",
            "amount": amount_paise,
            "currency": "INR",
            "status": "created",
        }

    monkeypatch.setattr("app.routers.gyan.create_razorpay_order", fake_create_order)
    yield


def _verify_body(order_id, payment_id="pay_ws_1"):
    return {
        "razorpayOrderId": order_id,
        "razorpayPaymentId": payment_id,
        "razorpaySignature": rzp_signature(order_id, payment_id),
    }


def _coin_ledger_entries(user_store, uid):
    prefix = f"users/{uid}/coin_ledger/"
    return [doc for key, doc in user_store.items() if key.startswith(prefix)]


async def test_workshop_enroll_then_verify_enrolls(client, user_store, gyan_razorpay):
    seed_gyan_store(user_store)
    token = seed_user(user_store, agriCoins=500)
    before = user_store["workshops/ws-3"]["enrolledCount"]

    enroll = await client.post(
        "/v1/workshops/ws-3/enroll",
        json={"useCoins": True, "coinsToRedeem": 200},
        headers=auth(token),
    )
    assert enroll.status_code == 200
    body = enroll.json()
    assert body["enrolled"] is False
    order_id = body["paymentOrderId"]
    assert order_id
    enrollment = user_store["users/uid-1/workshop_enrollments/ws-3"]
    assert enrollment["status"] == "awaiting_payment"
    assert enrollment["razorpayOrderId"] == order_id

    verify = await client.post(
        "/v1/workshops/ws-3/enroll/verify",
        json=_verify_body(order_id),
        headers=auth(token),
    )
    assert verify.status_code == 200
    assert verify.json() == {"enrolled": True}
    assert user_store["users/uid-1/workshop_enrollments/ws-3"]["status"] == "enrolled"
    assert user_store["workshops/ws-3"]["enrolledCount"] == before + 1

    # Duplicate verify is a no-op — no double seat count, no stranded state.
    reverify = await client.post(
        "/v1/workshops/ws-3/enroll/verify",
        json=_verify_body(order_id),
        headers=auth(token),
    )
    assert reverify.status_code == 200
    assert reverify.json() == {"enrolled": True}
    assert user_store["workshops/ws-3"]["enrolledCount"] == before + 1


async def test_workshop_verify_bad_signature_400(client, user_store, gyan_razorpay):
    seed_gyan_store(user_store)
    token = seed_user(user_store, agriCoins=0)
    enroll = await client.post(
        "/v1/workshops/ws-3/enroll",
        json={"useCoins": False, "coinsToRedeem": 0},
        headers=auth(token),
    )
    order_id = enroll.json()["paymentOrderId"]
    bad = await client.post(
        "/v1/workshops/ws-3/enroll/verify",
        json={
            "razorpayOrderId": order_id,
            "razorpayPaymentId": "pay_ws_1",
            "razorpaySignature": "deadbeef",
        },
        headers=auth(token),
    )
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "PAYMENT_VERIFICATION_FAILED"
    enrollment = user_store["users/uid-1/workshop_enrollments/ws-3"]
    assert enrollment["status"] == "awaiting_payment"


async def test_workshop_verify_unknown_order_404(client, user_store, gyan_razorpay):
    seed_gyan_store(user_store)
    token = seed_user(user_store, agriCoins=0)
    resp = await client.post(
        "/v1/workshops/ws-3/enroll/verify",
        json=_verify_body("order_test_nope"),
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ENROLLMENT_NOT_FOUND"


async def test_workshop_coin_redemption_half_cap(client, user_store):
    seed_gyan_store(user_store)
    user_store["workshops/ws-cap"] = {
        "id": "ws-cap",
        "title": "Precision Farming Masterclass",
        "instructor": "Test Instructor",
        "feeRupees": 1000,
        "coinsDiscountAllowed": 800,
        "duration": "1 Day",
        "batchDate": "01 October 2026",
        "enrolledCount": 0,
        "totalSeats": 10,
    }
    token = seed_user(user_store, agriCoins=1000)

    # 600 > 50% of a ₹1000 fee (500) → rejected with the standard envelope.
    over = await client.post(
        "/v1/workshops/ws-cap/enroll",
        json={"useCoins": True, "coinsToRedeem": 600},
        headers=auth(token),
    )
    assert over.status_code == 422
    assert over.json()["error"]["code"] == "INVALID_COIN_AMOUNT"

    # Exactly 50% is allowed and leaves a payable remainder.
    ok = await client.post(
        "/v1/workshops/ws-cap/enroll",
        json={"useCoins": True, "coinsToRedeem": 500},
        headers=auth(token),
    )
    assert ok.status_code == 200
    assert ok.json()["enrolled"] is False
    assert ok.json()["amountDue"] == 500


async def test_expert_talk_awards_exactly_25_coins(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store)
    resp = await client.post("/v1/expert-talks/talk-1/register", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["agriCoinsEarned"] == 25
    assert user_store["users/uid-1"]["agriCoins"] == 25
    amounts = [e["amount"] for e in _coin_ledger_entries(user_store, "uid-1")]
    assert amounts == [25]


async def test_expert_talk_award_respects_daily_earn_cap(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store)
    # The user has already earned 190 coins today → only 10 of the nominal 25
    # fit under the 200/day cap, and the award flows through `award_coins`.
    assert await award_coins("uid-1", 190, "seed_award") == 190
    resp = await client.post("/v1/expert-talks/talk-1/register", headers=auth(token))
    assert resp.status_code == 200
    assert user_store["users/uid-1"]["agriCoins"] == 200
    amounts = sorted(e["amount"] for e in _coin_ledger_entries(user_store, "uid-1"))
    assert amounts == [10, 190]


def _task_kinds(user_store, uid):
    return {
        doc.get("kind")
        for key, doc in user_store.items()
        if key.startswith("tasks/") and doc.get("userId") == uid
    }


async def test_gyan_emits_dashboard_tasks(client, user_store, gyan_razorpay):
    seed_gyan_store(user_store)
    token = seed_user(user_store, agriCoins=500)

    # A free workshop confirms immediately → `workshop_starting`.
    ws = dict(user_store["workshops/ws-1"])
    ws["feeRupees"] = 0
    ws["coinsDiscountAllowed"] = 0
    user_store["workshops/ws-1"] = ws
    free = await client.post(
        "/v1/workshops/ws-1/enroll",
        json={"useCoins": False, "coinsToRedeem": 0},
        headers=auth(token),
    )
    assert free.status_code == 201

    # A paid workshop confirms on verify → `workshop_starting`.
    paid = await client.post(
        "/v1/workshops/ws-3/enroll",
        json={"useCoins": False, "coinsToRedeem": 0},
        headers=auth(token),
    )
    await client.post(
        "/v1/workshops/ws-3/enroll/verify",
        json=_verify_body(paid.json()["paymentOrderId"]),
        headers=auth(token),
    )

    # Expert-talk registration → `coins_earned`.
    assert (await client.post("/v1/expert-talks/talk-1/register", headers=auth(token))).status_code == 200

    # A fresh video in the farmer's crop category → `new_video`.
    user_store["users/uid-1"]["crops"] = ["spray"]
    user_store["videos/vid-fresh"] = {
        "id": "vid-fresh",
        "title": "New Spray Guide",
        "instructor": "Dr. Test",
        "duration": "05:00",
        "views": "1K",
        "category": "spray",
        "videoUrl": "https://example.com/v.mp4",
        "summary": "s",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    assert (await client.get("/v1/videos", headers=auth(token))).status_code == 200

    kinds = _task_kinds(user_store, "uid-1")
    assert {"workshop_starting", "coins_earned", "new_video"} <= kinds

