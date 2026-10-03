from tests.test_diary import auth, seed_user


def _seed_notifications(user_store, uid, count, start=0):
    for i in range(count):
        n = start + i
        doc = {
            "id": f"ntf_{uid}_{n}",
            "userId": uid,
            "title": f"Title {n}",
            "body": f"Body {n}",
            "type": "general",
            "read": False,
            "createdAt": f"2026-09-20T00:00:0{n}+00:00",
        }
        user_store[f"notifications/{doc['id']}"] = doc
    return [f"ntf_{uid}_{start + i}" for i in range(count)]


async def test_post_creates_with_defaults(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/notifications",
        json={"userId": "uid-1", "title": "Mandi rate alert", "body": "Tomato up 12%"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"].startswith("ntf_")
    assert body["userId"] == "uid-1"
    assert body["type"] == "general"
    assert body["read"] is False
    assert body["createdAt"]
    stored = user_store[f"notifications/{body['id']}"]
    assert stored["read"] is False
    assert stored["title"] == "Mandi rate alert"


async def test_post_requires_title_and_body(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/notifications",
        json={"userId": "uid-1", "title": "", "body": ""},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_list_envelope_and_ownership_isolation(client, user_store):
    token_a = seed_user(user_store, uid="uid-a")
    seed_user(user_store, uid="uid-b")
    ids_a = _seed_notifications(user_store, "uid-a", 3)
    _seed_notifications(user_store, "uid-b", 2)
    resp = await client.get("/v1/notifications", headers=auth(token_a))
    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 1
    assert body["pageSize"] == 20
    assert body["total"] == 3
    assert len(body["data"]) == 3
    returned_ids = [item["id"] for item in body["data"]]
    assert set(returned_ids) == set(ids_a)
    for item in body["data"]:
        assert item["userId"] == "uid-a"
        assert item["read"] is False
        assert set(item.keys()) == {
            "id", "userId", "title", "body", "type", "read", "createdAt",
        }
    created = [item["createdAt"] for item in body["data"]]
    assert created == sorted(created, reverse=True)


async def test_list_empty_is_200(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/notifications", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"] == []
    assert body["total"] == 0


async def test_list_pagination(client, user_store):
    token = seed_user(user_store)
    _seed_notifications(user_store, "uid-1", 5)
    resp = await client.get("/v1/notifications?page=1&pageSize=2", headers=auth(token))
    body = resp.json()
    assert body["page"] == 1
    assert body["pageSize"] == 2
    assert body["total"] == 5
    assert len(body["data"]) == 2
    first_ids = [item["id"] for item in body["data"]]
    resp = await client.get("/v1/notifications?page=2&pageSize=2", headers=auth(token))
    body = resp.json()
    assert len(body["data"]) == 2
    second_ids = [item["id"] for item in body["data"]]
    assert not set(first_ids) & set(second_ids)
    resp = await client.get("/v1/notifications?page=3&pageSize=2", headers=auth(token))
    body = resp.json()
    assert len(body["data"]) == 1
    assert body["total"] == 5


async def test_read_all_marks_only_unread(client, user_store):
    token = seed_user(user_store)
    ids = _seed_notifications(user_store, "uid-1", 3)
    other = seed_user(user_store, uid="uid-2")
    _seed_notifications(user_store, "uid-2", 2)
    resp = await client.post(
        f"/v1/notifications/{ids[0]}/read", headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert user_store[f"notifications/{ids[0]}"]["read"] is True
    resp = await client.put("/v1/notifications/read-all", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"updated": 2}
    for nid in ids[1:]:
        assert user_store[f"notifications/{nid}"]["read"] is True
        assert user_store[f"notifications/{nid}"]["readAt"]
    for i in range(2):
        assert user_store[f"notifications/ntf_uid-2_{i}"]["read"] is False
    resp = await client.put("/v1/notifications/read-all", headers=auth(other))
    assert resp.json() == {"updated": 2}


async def test_read_one_404_for_other_users_notification(client, user_store):
    token = seed_user(user_store)
    _seed_notifications(user_store, "uid-other", 1)
    resp = await client.post(
        "/v1/notifications/ntf_uid-other_0/read", headers=auth(token)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_requires_auth(client):
    resp = await client.get("/v1/notifications")
    assert resp.status_code == 401
    resp = await client.put("/v1/notifications/read-all")
    assert resp.status_code == 401
