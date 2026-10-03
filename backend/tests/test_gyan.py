from app.data.gyan_seed import BLOGS, EXPERT_TALKS, VIDEOS, WORKSHOPS
from tests.test_diary import auth, seed_user


def seed_gyan_store(user_store):
    for item in WORKSHOPS:
        user_store[f"workshops/{item['id']}"] = dict(item)
    for item in EXPERT_TALKS:
        user_store[f"expert_talks/{item['id']}"] = dict(item)
    for item in VIDEOS:
        user_store[f"videos/{item['id']}"] = dict(item)
    for item in BLOGS:
        user_store[f"blogs/{item['id']}"] = dict(item)


async def test_workshops_list_not_enrolled(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/workshops", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert all(item["isEnrolled"] is False for item in body["data"])


async def test_enroll_fully_with_coins_201(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store, agriCoins=500)
    before = user_store["workshops/ws-2"]["enrolledCount"]
    resp = await client.post(
        "/v1/workshops/ws-2/enroll",
        json={"useCoins": True, "coinsToRedeem": 200},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json() == {"enrolled": True}
    assert user_store["users/uid-1"]["agriCoins"] == 300
    assert user_store["workshops/ws-2"]["enrolledCount"] == before + 1
    enrollment = user_store["users/uid-1/workshop_enrollments/ws-2"]
    assert enrollment["status"] == "enrolled"


async def test_enroll_twice_409(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store, agriCoins=500)
    payload = {"useCoins": True, "coinsToRedeem": 200}
    resp = await client.post("/v1/workshops/ws-2/enroll", json=payload, headers=auth(token))
    assert resp.status_code == 201
    resp = await client.post("/v1/workshops/ws-2/enroll", json=payload, headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_ENROLLED"


async def test_enroll_coins_over_cap_422(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store, agriCoins=500)
    resp = await client.post(
        "/v1/workshops/ws-2/enroll",
        json={"useCoins": True, "coinsToRedeem": 201},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_COIN_AMOUNT"


async def test_enroll_partial_coins_returns_razorpay_order(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store, agriCoins=500)
    resp = await client.post(
        "/v1/workshops/ws-3/enroll",
        json={"useCoins": True, "coinsToRedeem": 200},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["enrolled"] is False
    assert body["paymentOrderId"].startswith("order_dev_")
    assert body["amountDue"] == 299
    enrollment = user_store["users/uid-1/workshop_enrollments/ws-3"]
    assert enrollment["status"] == "awaiting_payment"


async def test_enroll_insufficient_coins_409(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store, agriCoins=50)
    resp = await client.post(
        "/v1/workshops/ws-2/enroll",
        json={"useCoins": True, "coinsToRedeem": 200},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INSUFFICIENT_COINS"


async def test_talk_register_awards_25(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store)
    resp = await client.post("/v1/expert-talks/talk-1/register", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"registered": True, "agriCoinsEarned": 25}
    assert user_store["users/uid-1"]["agriCoins"] == 25
    assert user_store["expert_talks/talk-1"]["registeredCount"] == 3841
    resp = await client.post("/v1/expert-talks/talk-1/register", headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_REGISTERED"


async def test_blog_bookmark_toggles(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store)
    resp = await client.post("/v1/blogs/blog-1/bookmark", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"isBookmarked": True}
    resp = await client.post("/v1/blogs/blog-1/bookmark", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"isBookmarked": False}


async def test_blog_like_idempotent(client, user_store):
    seed_gyan_store(user_store)
    token = seed_user(user_store)
    before = user_store["blogs/blog-1"]["likesCount"]
    resp = await client.post("/v1/blogs/blog-1/like", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"likesCount": before + 1}
    resp = await client.post("/v1/blogs/blog-1/like", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"likesCount": before + 1}
