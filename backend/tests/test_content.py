from datetime import datetime, timezone

from app.data.content_seed import (
    CHANNELS,
    LIVE_POLLS,
    LIVE_QUESTIONS,
    NEWS,
    SCHEDULED_BROADCASTS,
)
from tests.test_diary import auth, seed_user


def seed_content_store(user_store):
    for item in NEWS:
        user_store[f"news/{item['id']}"] = item
    for channel in CHANNELS:
        user_store[f"channels/{channel['id']}"] = channel
    for bcast in SCHEDULED_BROADCASTS:
        user_store[f"broadcast_schedules/{bcast['id']}"] = bcast
    for poll in LIVE_POLLS:
        user_store[f"channels/ch-1/polls/{poll['id']}"] = poll
    for q in LIVE_QUESTIONS:
        user_store[f"channels/ch-1/questions/{q['id']}"] = q


async def test_news_breaking_first(client, user_store):
    seed_content_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/news", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 6
    assert body["data"][0]["isBreaking"] is True


async def test_news_category_filter(client, user_store):
    seed_content_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/news?category=weather-alert", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert all(item["category"] == "weather-alert" for item in body["data"])


async def test_channels_viewer_count_from_redis(client, user_store, fake_redis):
    seed_content_store(user_store)
    token = seed_user(user_store)
    await fake_redis.set("channel:ch-1:viewers", 42)
    resp = await client.get("/v1/channels", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 4
    ch1 = next(c for c in body["data"] if c["id"] == "ch-1")
    assert ch1["liveViewersCount"] == 42
    assert ch1["streamUrl"].endswith(".m3u8")


async def test_chat_post_and_rate_limit(client, user_store):
    seed_content_store(user_store)
    token = seed_user(user_store)
    resp = await client.post("/v1/channels/ch-1/chat", json={"text": "नमस्ते शेतकरी मित्रांनो"}, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["userName"] == "Ram Patil"
    resp = await client.post("/v1/channels/ch-1/chat", json={"text": "दुसरा संदेश"}, headers=auth(token))
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "CHAT_RATE_LIMITED"


async def test_chat_unknown_channel_404(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/channels/ch-99/chat", json={"text": "hello"}, headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CHANNEL_NOT_FOUND"
    resp = await client.get("/v1/channels/ch-99/chat", headers=auth(token))
    assert resp.status_code == 404


async def test_viewer_join_left(client, user_store, fake_redis):
    seed_content_store(user_store)
    token = seed_user(user_store)
    for _ in range(2):
        resp = await client.post("/v1/channels/ch-1/chat?joined=true", json={}, headers=auth(token))
        assert resp.status_code == 200
    resp = await client.post("/v1/channels/ch-1/chat?left=true", json={}, headers=auth(token))
    assert resp.status_code == 200
    assert int(await fake_redis.get("channel:ch-1:viewers")) == 1


async def test_broadcast_schedule_and_remind(client, user_store):
    seed_content_store(user_store)
    token = seed_user(user_store)
    # 1. Get schedules
    resp = await client.get("/v1/channels/schedule", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] >= 3
    assert resp.json()["data"][0]["hasReminder"] is False

    # 2. Toggle reminder ON
    rem_resp = await client.post("/v1/channels/schedule/bcast-1/remind", headers=auth(token))
    assert rem_resp.status_code == 200
    assert rem_resp.json()["hasReminder"] is True

    # 3. Verify status updated
    resp2 = await client.get("/v1/channels/schedule", headers=auth(token))
    bcast1 = next(b for b in resp2.json()["data"] if b["id"] == "bcast-1")
    assert bcast1["hasReminder"] is True

    # 4. Toggle reminder OFF
    rem_resp2 = await client.post("/v1/channels/schedule/bcast-1/remind", headers=auth(token))
    assert rem_resp2.status_code == 200
    assert rem_resp2.json()["hasReminder"] is False


async def test_live_polls_and_voting(client, user_store):
    seed_content_store(user_store)
    token = seed_user(user_store)
    # 1. List polls
    polls_resp = await client.get("/v1/channels/ch-1/polls", headers=auth(token))
    assert polls_resp.status_code == 200
    polls = polls_resp.json()["data"]
    assert len(polls) >= 1
    poll_id = polls[0]["id"]

    # 2. Vote for option 0
    vote_resp = await client.post(
        f"/v1/channels/ch-1/polls/{poll_id}/vote",
        json={"optionIndex": 0},
        headers=auth(token),
    )
    assert vote_resp.status_code == 200
    assert vote_resp.json()["userVotedOption"] == 0

    # 3. Create a new poll as host
    new_poll_resp = await client.post(
        "/v1/channels/ch-1/polls",
        json={
            "question": "कांदा साठवणुकीसाठी तुम्ही चाळ वापरता का?",
            "options": ["हो, पारंपरिक चाळ", "हो, आधुनिक हवेशीर चाळ", "नाही"],
        },
        headers=auth(token),
    )
    assert new_poll_resp.status_code == 201
    assert len(new_poll_resp.json()["options"]) == 3


async def test_live_questions_upvote_and_answer(client, user_store):
    seed_content_store(user_store)
    token = seed_user(user_store)
    # 1. Ask a question
    ask_resp = await client.post(
        "/v1/channels/ch-1/questions",
        json={"questionText": "सागवान लागवडीसाठी किती फूट अंतर योग्य आहे?"},
        headers=auth(token),
    )
    assert ask_resp.status_code == 201
    q_id = ask_resp.json()["id"]

    # 2. List questions
    q_list_resp = await client.get("/v1/channels/ch-1/questions", headers=auth(token))
    assert q_list_resp.status_code == 200
    assert any(q["id"] == q_id for q in q_list_resp.json()["data"])

    # 3. Upvote question
    up_resp = await client.post(f"/v1/channels/ch-1/questions/{q_id}/upvote", headers=auth(token))
    assert up_resp.status_code == 200
    # user had upvoted upon ask, so second tap toggles off
    assert up_resp.json()["userHasUpvoted"] is False

    # 4. Host answers question
    ans_resp = await client.put(f"/v1/channels/ch-1/questions/{q_id}/answer", headers=auth(token))
    assert ans_resp.status_code == 200
    assert ans_resp.json()["isAnswered"] is True


async def test_channel_pin_and_gift(client, user_store):
    seed_content_store(user_store)
    token = seed_user(user_store)
    # 1. Pin announcement
    pin_resp = await client.put(
        "/v1/channels/ch-1/pin",
        json={"pinnedText": "कृपया चॅटमध्ये तुमचे प्रश्न थेट विचारा, तज्ज्ञ उत्तरे देतील!"},
        headers=auth(token),
    )
    assert pin_resp.status_code == 200
    assert pin_resp.json()["pinnedAnnouncement"].startswith("कृपया")

    # 2. Send AgriCoin Gift
    gift_resp = await client.post(
        "/v1/channels/ch-1/gift",
        json={"giftType": "tractor_salute", "coins": 50, "note": "उत्कृष्ट मार्गदर्शन!"},
        headers=auth(token),
    )
    assert gift_resp.status_code == 201
    assert gift_resp.json()["coins"] == 50
    assert "ट्रॅक्टर सलामी" in gift_resp.json()["giftLabel"]


async def test_channel_create_admin_only(client, user_store):
    """WS-05 task 5.8 — POST /v1/channels is admin-gated (X16)."""
    channel_body = {
        "channelName": "Licensed Test Channel",
        "broadcaster": "Agri Media Test",
        "programTitle": "Live Advisory Test",
        "streamUrl": "https://ddkisan.akamaized.net/hls/live/2007789/ddkisan/master.m3u8",
    }
    token = seed_user(user_store)
    resp = await client.post("/v1/channels", json=channel_body, headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ADMIN"

    admin_token = seed_user(user_store, uid="uid-admin", active_profile="admin", isAdmin=True)
    admin_resp = await client.post("/v1/channels", json=channel_body, headers=auth(admin_token))
    assert admin_resp.status_code == 201
    assert admin_resp.json()["channelName"] == "Licensed Test Channel"


async def test_channel_chat_moderation(client, user_store):
    """WS-05 task 5.13 — phone/UPI messages are blocked and a strike written."""
    seed_content_store(user_store)
    token = seed_user(user_store)

    phone_resp = await client.post(
        "/v1/channels/ch-1/chat",
        json={"text": "call me 9876543210"},
        headers=auth(token),
    )
    assert phone_resp.status_code == 422
    assert phone_resp.json()["error"]["code"] == "MODERATION_BLOCKED"
    assert any(key.startswith("users/uid-1/strikes/") for key in user_store)

    upi_resp = await client.post(
        "/v1/channels/ch-1/chat",
        json={"text": "send to ram@upi"},
        headers=auth(token),
    )
    assert upi_resp.status_code == 422
    assert upi_resp.json()["error"]["code"] == "MODERATION_BLOCKED"

    # A clean message from a fresh user is accepted (the first user is now muted
    # by the strike ladder after two strikes).
    clean_token = seed_user(user_store, uid="uid-2")
    ok_resp = await client.post(
        "/v1/channels/ch-1/chat",
        json={"text": "धन्यवाद, उपयुक्त माहिती!"},
        headers=auth(clean_token),
    )
    assert ok_resp.status_code == 201


async def test_breaking_and_live_now_task_emission_dedupe(client, user_store):
    """WS-05 task 5.16 — dashboard task emission from the news/channel lists."""
    seed_content_store(user_store)
    # Fresh breaking item + a live channel.
    fresh = dict(NEWS[0])
    fresh["timestamp"] = datetime.now(timezone.utc).isoformat()
    user_store[f"news/{fresh['id']}"] = fresh
    token = seed_user(user_store)

    resp = await client.get("/v1/news", headers=auth(token))
    assert resp.status_code == 200
    task_keys = [k for k in user_store if k.startswith("tasks/")]
    assert any(user_store[k]["kind"] == "breaking_news" for k in task_keys), task_keys

    resp2 = await client.get("/v1/channels", headers=auth(token))
    assert resp2.status_code == 200
    live_tasks = [
        user_store[k]
        for k in user_store
        if k.startswith("tasks/") and user_store[k]["kind"] == "live_now"
    ]
    assert live_tasks, "no live_now task emitted"
    # dedupe: second call does not duplicate the same sourceId
    await client.get("/v1/channels", headers=auth(token))
    live_tasks2 = [
        user_store[k]
        for k in user_store
        if k.startswith("tasks/") and user_store[k]["kind"] == "live_now"
    ]
    assert len(live_tasks2) == len(live_tasks)

