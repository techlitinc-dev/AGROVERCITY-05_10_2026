import firebase_admin.auth as firebase_auth

from app.core.security import hash_mpin


async def test_firebase_verify_new_user(client):
    resp = await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["isNewUser"] is True
    assert body["accessToken"]
    assert body["refreshToken"]


async def test_firebase_verify_invalid_token(client, monkeypatch):
    def raise_invalid(id_token):
        raise firebase_auth.InvalidIdTokenError("bad")

    monkeypatch.setattr(firebase_auth, "verify_id_token", raise_invalid)
    resp = await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_FIREBASE_TOKEN"


async def test_refresh_roundtrip(client):
    resp = await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    tokens = resp.json()
    resp2 = await client.post("/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert resp2.status_code == 200
    assert resp2.json()["accessToken"]
    assert resp2.json()["refreshToken"]


async def test_refresh_with_access_token_fails(client):
    resp = await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    access = resp.json()["accessToken"]
    resp2 = await client.post("/v1/auth/refresh", json={"refreshToken": access})
    assert resp2.status_code == 401


async def test_login_with_phone_mpin_success(client, user_store):
    user_store["users/uid-login-1"] = {
        "id": "uid-login-1",
        "name": "Ram Singh",
        "phone": "+919876543210",
        "activeProfile": "farmer",
        "mpinHash": hash_mpin("4321"),
    }
    resp = await client.post(
        "/v1/auth/login", json={"phone": "9876543210", "mpin": "4321"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["accessToken"]
    assert body["refreshToken"]
    assert body["isNewUser"] is False
    assert body["user"]["id"] == "uid-login-1"
    assert "mpinHash" not in body["user"]


async def test_login_with_phone_mpin_normalizes_phone(client, user_store):
    user_store["users/uid-login-2"] = {
        "id": "uid-login-2",
        "phone": "+919876543210",
        "mpinHash": hash_mpin("4321"),
    }
    resp = await client.post(
        "/v1/auth/login", json={"phone": "+919876543210", "mpin": "4321"}
    )
    assert resp.status_code == 200


async def test_login_wrong_mpin(client, user_store):
    user_store["users/uid-login-3"] = {
        "id": "uid-login-3",
        "phone": "+919876543210",
        "mpinHash": hash_mpin("4321"),
    }
    resp = await client.post(
        "/v1/auth/login", json={"phone": "+919876543210", "mpin": "9999"}
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"


async def test_login_unknown_phone(client):
    resp = await client.post(
        "/v1/auth/login", json={"phone": "+919000000000", "mpin": "4321"}
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "USER_NOT_FOUND"


async def test_login_mpin_not_set(client, user_store):
    user_store["users/uid-login-4"] = {
        "id": "uid-login-4",
        "phone": "+919876543210",
    }
    resp = await client.post(
        "/v1/auth/login", json={"phone": "+919876543210", "mpin": "4321"}
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "MPIN_NOT_SET"


async def test_login_invalid_mpin_format(client):
    resp = await client.post(
        "/v1/auth/login", json={"phone": "+919876543210", "mpin": "12"}
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_MPIN_FORMAT"


async def test_login_with_duplicate_phone_docs_tries_each(client, user_store):
    # Stale duplicate docs (demo seeding / quick-login fallbacks) share the
    # same phone; login must verify against every candidate, not just the
    # first one returned.
    user_store["users/uid-dup-1"] = {
        "id": "uid-dup-1",
        "phone": "+919876543210",
        "mpinHash": hash_mpin("1111"),
    }
    user_store["users/uid-dup-2"] = {
        "id": "uid-dup-2",
        "phone": "+919876543210",
        "mpinHash": hash_mpin("2222"),
    }
    user_store["users/uid-dup-3"] = {
        "id": "uid-dup-3",
        "phone": "+919876543210",
    }
    for mpin, expected_uid in (("1111", "uid-dup-1"), ("2222", "uid-dup-2")):
        resp = await client.post(
            "/v1/auth/login", json={"phone": "+919876543210", "mpin": mpin}
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["id"] == expected_uid
    resp = await client.post(
        "/v1/auth/login", json={"phone": "+919876543210", "mpin": "9999"}
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"


async def test_login_only_hashless_duplicate_docs_reports_not_set(client, user_store):
    user_store["users/uid-nohash-1"] = {
        "id": "uid-nohash-1",
        "phone": "+919876543210",
    }
    resp = await client.post(
        "/v1/auth/login", json={"phone": "+919876543210", "mpin": "1234"}
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "MPIN_NOT_SET"


def _patch_redis(monkeypatch, fake_redis):
    async def _fake():
        return fake_redis

    monkeypatch.setattr("app.services.tokens.get_redis", _fake)
    monkeypatch.setattr("app.core.cache.get_redis", _fake)


def _seed_login_user(user_store, uid="uid-sess-1"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "phone": "+919812345678",
        "mpinHash": hash_mpin("5555"),
    }


async def test_refresh_rotation_invalidates_old(client, user_store, fake_redis, monkeypatch):
    _patch_redis(monkeypatch, fake_redis)
    _seed_login_user(user_store, "uid-rot-1")
    login = await client.post("/v1/auth/login", json={"phone": "+919812345678", "mpin": "5555"})
    old_refresh = login.json()["refreshToken"]
    resp = await client.post("/v1/auth/refresh", json={"refreshToken": old_refresh})
    assert resp.status_code == 200
    assert resp.json()["refreshToken"] != old_refresh
    resp2 = await client.post("/v1/auth/refresh", json={"refreshToken": old_refresh})
    assert resp2.status_code == 401


async def test_refresh_replay_revokes_family(client, user_store, fake_redis, monkeypatch):
    from app.services.tokens import decode_refresh_token

    _patch_redis(monkeypatch, fake_redis)
    _seed_login_user(user_store, "uid-replay-1")
    login = await client.post("/v1/auth/login", json={"phone": "+919812345678", "mpin": "5555"})
    token_a = login.json()["refreshToken"]
    refreshed = await client.post("/v1/auth/refresh", json={"refreshToken": token_a})
    assert refreshed.status_code == 200
    token_b = refreshed.json()["refreshToken"]
    # replay token A -> replay detected, whole family revoked
    replay = await client.post("/v1/auth/refresh", json={"refreshToken": token_a})
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "REFRESH_REPLAYED"
    # token B must also be dead now
    assert decode_refresh_token(token_b)
    after = await client.post("/v1/auth/refresh", json={"refreshToken": token_b})
    assert after.status_code == 401


async def test_sessions_list_and_revoke(client, user_store, fake_redis, monkeypatch):
    from app.services.tokens import decode_refresh_token

    _patch_redis(monkeypatch, fake_redis)
    _seed_login_user(user_store, "uid-list-1")
    login1 = await client.post("/v1/auth/login", json={"phone": "+919812345678", "mpin": "5555"})
    login2 = await client.post("/v1/auth/login", json={"phone": "+919812345678", "mpin": "5555"})
    access = login1.json()["accessToken"]
    token1 = login1.json()["refreshToken"]
    token2 = login2.json()["refreshToken"]
    headers = {"Authorization": f"Bearer {access}"}

    sessions = await client.get("/v1/auth/sessions", headers=headers)
    assert sessions.status_code == 200
    data = sessions.json()["sessions"]
    assert len(data) == 2
    jti1 = decode_refresh_token(token1)[1]
    jti2 = decode_refresh_token(token2)[1]
    ids = {s["id"] for s in data}
    assert {jti1, jti2} == ids

    revoked = await client.delete(f"/v1/auth/sessions/{jti1}", headers=headers)
    assert revoked.status_code == 200
    assert revoked.json() == {"ok": True}

    # the revoked session is dead; replaying its token is treated as reuse
    # and revokes the whole session family (WS-02 step 3)
    first_after = await client.post("/v1/auth/refresh", json={"refreshToken": token1})
    assert first_after.status_code == 401
    assert first_after.json()["error"]["code"] == "REFRESH_REPLAYED"
    second_after = await client.post("/v1/auth/refresh", json={"refreshToken": token2})
    assert second_after.status_code == 401


async def test_otp_rate_limit_429(client, user_store, fake_redis, monkeypatch):
    async def _fake():
        return fake_redis

    monkeypatch.setattr("app.core.ratelimit.get_redis", _fake)
    user_store["users/uid-1"] = {"id": "uid-1", "phone": "+919812345678"}
    for attempt in range(1, 7):
        resp = await client.post("/v1/auth/mpin/reset", json={"idToken": "any", "newMpin": "9876"})
        if attempt <= 5:
            assert resp.status_code != 429
        else:
            assert resp.status_code == 429
            assert resp.json()["error"]["code"] == "RATE_LIMITED"
