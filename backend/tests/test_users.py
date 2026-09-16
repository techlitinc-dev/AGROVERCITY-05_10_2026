REGISTER_BODY = {
    "idToken": "x",
    "name": "Ram Patil",
    "phone": "+919812345678",
    "state": "Maharashtra",
    "district": "Nashik",
    "tehsil": "Niphad",
    "village": "Pimplas",
    "landAreaAcres": 3.5,
    "soilType": "Black Cotton",
    "irrigationType": "Drip",
    "crops": ["onion", "wheat"],
    "mpin": "1234",
    "profiles": ["farmer", "seller"],
    "primaryProfile": "farmer",
}


async def _token(client):
    resp = await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    return resp.json()["accessToken"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _register(client, **overrides):
    await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    body = {**REGISTER_BODY, **overrides}
    return await client.post("/v1/auth/register", json=body)


async def test_register_creates_full_profile(client):
    resp = await _register(client)
    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["linkedProfiles"] == ["farmer", "seller"]
    assert user["activeProfile"] == "farmer"
    assert user["activeCrops"] == ["onion", "wheat"]


async def test_register_rejects_primary_not_in_profiles(client):
    resp = await _register(client, profiles=["farmer"], primaryProfile="broker")
    assert resp.status_code == 422


async def test_get_me(client):
    token = await _token(client)
    resp = await client.get("/v1/users/me", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert "kisanCreditScore" in body
    assert "agriCoins" in body


async def test_put_me_partial_update(client):
    token = await _token(client)
    resp = await client.put("/v1/users/me", json={"village": "Ozark"}, headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["village"] == "Ozark"
    assert resp.json()["name"] == ""
    assert resp.json()["district"] == ""


async def test_farm_boundary(client):
    resp = await _register(client)
    token = resp.json()["accessToken"]
    points = [{"lat": 20.0 + i * 0.001, "lng": 74.7 + i * 0.001} for i in range(4)]
    resp = await client.put(
        "/v1/users/me/farm-boundary",
        json={"farmBoundaryPoints": points, "landAreaAcres": 5.5, "khasraNumber": "123/4"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/users/me", headers=_auth(token))
    body = resp.json()
    assert body["farmBoundaryPoints"] == points
    assert body["landAreaAcres"] == 5.5
    assert body["khasraNumber"] == "123/4"


async def test_me_requires_auth(client):
    resp = await client.get("/v1/users/me")
    assert resp.status_code == 401
