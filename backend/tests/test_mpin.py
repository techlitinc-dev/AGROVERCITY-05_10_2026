async def _get_token(client):
    resp = await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    return resp.json()["accessToken"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def test_set_and_verify_mpin(client):
    token = await _get_token(client)
    resp = await client.post("/v1/auth/mpin/set", json={"mpin": "1234"}, headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    resp = await client.post("/v1/auth/mpin/verify", json={"mpin": "1234"}, headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


async def test_verify_wrong_mpin(client):
    token = await _get_token(client)
    await client.post("/v1/auth/mpin/set", json={"mpin": "1234"}, headers=_auth(token))
    resp = await client.post("/v1/auth/mpin/verify", json={"mpin": "9999"}, headers=_auth(token))
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"


async def test_verify_before_set(client):
    token = await _get_token(client)
    resp = await client.post("/v1/auth/mpin/verify", json={"mpin": "1234"}, headers=_auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "MPIN_NOT_SET"


async def test_set_bad_format(client):
    token = await _get_token(client)
    resp = await client.post("/v1/auth/mpin/set", json={"mpin": "12ab"}, headers=_auth(token))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_MPIN_FORMAT"


async def test_reset_with_firebase_token(client):
    token = await _get_token(client)
    await client.post("/v1/auth/mpin/set", json={"mpin": "1234"}, headers=_auth(token))
    resp = await client.post("/v1/auth/mpin/reset", json={"idToken": "x", "newMpin": "4321"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    resp = await client.post("/v1/auth/mpin/verify", json={"mpin": "1234"}, headers=_auth(token))
    assert resp.status_code == 401
    resp = await client.post("/v1/auth/mpin/verify", json={"mpin": "4321"}, headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
