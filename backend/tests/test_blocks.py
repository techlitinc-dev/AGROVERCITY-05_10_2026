from app.services import blocks
from tests.test_diary import auth, seed_user


def seed_channel_chat(user_store):
    user_store["channels/ch-1"] = {
        "id": "ch-1",
        "channelName": "Mandi Live",
        "broadcaster": "APMC",
        "programTitle": "Rates",
        "currentSpeaker": "Anchor",
        "liveViewersCount": 10,
        "isLiveNow": True,
        "category": "mandi",
        "streamThumbnail": "",
        "streamUrl": "",
        "scheduleTime": "",
    }
    user_store["channels/ch-1/chat/m1"] = {
        "id": "m1",
        "userId": "uid-2",
        "userName": "Suresh",
        "text": "wheat rate?",
        "sentAt": "2026-09-17T08:00:00+00:00",
    }
    user_store["channels/ch-1/chat/m2"] = {
        "id": "m2",
        "userId": "uid-3",
        "userName": "Meena",
        "text": "1850 in Nashik",
        "sentAt": "2026-09-17T08:01:00+00:00",
    }


async def test_report_201(client, user_store):
    token = seed_user(user_store)
    seed_user(user_store, uid="uid-2", active_profile="seller")
    resp = await client.post(
        "/v1/users/uid-2/report",
        json={"reason": "spam messages in channel chat"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json() == {"reported": True}
    resp = await client.post(
        "/v1/users/uid-2/report",
        json={"reason": "spam messages in channel chat"},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_REPORTED"
    resp = await client.post(
        "/v1/users/uid-1/report",
        json={"reason": "trying to report myself"},
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "CANNOT_REPORT_SELF"


async def test_block_unblock(client, user_store):
    token = seed_user(user_store)
    seed_user(user_store, uid="uid-2", active_profile="seller", name="Suresh Jadhav")
    resp = await client.post("/v1/users/me/blocks", json={"userId": "uid-2"}, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json() == {"blocked": True}
    resp = await client.get("/v1/users/me/blocks", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["userId"] == "uid-2"
    assert body["data"][0]["name"] == "Suresh Jadhav"
    resp = await client.delete("/v1/users/me/blocks/uid-2", headers=auth(token))
    assert resp.status_code == 204
    resp = await client.get("/v1/users/me/blocks", headers=auth(token))
    assert resp.json()["total"] == 0


async def test_blocked_pair_bidirectional(client, user_store):
    token = seed_user(user_store)
    seed_user(user_store, uid="uid-2", active_profile="seller")
    resp = await client.post("/v1/users/me/blocks", json={"userId": "uid-2"}, headers=auth(token))
    assert resp.status_code == 201
    assert await blocks.blocked_pair("uid-1", "uid-2") is True
    assert await blocks.blocked_pair("uid-2", "uid-1") is True
    assert await blocks.blocked_pair("uid-1", "uid-3") is False


async def test_channel_chat_filters_blocked(client, user_store):
    token = seed_user(user_store)
    seed_user(user_store, uid="uid-2", active_profile="seller")
    seed_channel_chat(user_store)
    resp = await client.get("/v1/channels/ch-1/chat", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 2
    resp = await client.post("/v1/users/me/blocks", json={"userId": "uid-2"}, headers=auth(token))
    assert resp.status_code == 201
    resp = await client.get("/v1/channels/ch-1/chat", headers=auth(token))
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["userId"] == "uid-3"
