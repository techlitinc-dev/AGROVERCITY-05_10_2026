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
