import firebase_admin.auth as firebase_auth


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
