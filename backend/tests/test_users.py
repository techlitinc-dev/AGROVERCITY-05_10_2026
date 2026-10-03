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


async def test_register_persists_extended_identity_fields(client):
    resp = await _register(
        client,
        email="ram@example.com",
        dateOfBirth="1992-05-14",
        gender="male",
        pincode="422303",
        addressLine="Gat 12, Pimplas",
        alternatePhone="9812345690",
    )
    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["email"] == "ram@example.com"
    assert user["dateOfBirth"] == "1992-05-14"
    assert user["gender"] == "male"
    assert user["pincode"] == "422303"
    assert user["addressLine"] == "Gat 12, Pimplas"
    assert user["alternatePhone"] == "9812345690"


async def test_register_rejects_invalid_pincode(client):
    resp = await _register(client, pincode="123")
    assert resp.status_code == 422


async def test_reference_states_lists_all_indian_states(client):
    resp = await client.get("/v1/states")
    assert resp.status_code == 200
    states = resp.json()["states"]
    assert len(states) == 36
    assert "Maharashtra" in states
    assert "Andaman and Nicobar Islands" in states


async def test_register_without_profiles_deferred(client):
    resp = await _register(client, profiles=[], primaryProfile="")
    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["linkedProfiles"] == []
    assert user["primaryProfile"] == ""


async def test_persona_setup_completes_profile_later(client):
    resp = await _register(client, profiles=[], primaryProfile="")
    token = resp.json()["accessToken"]
    resp = await client.put(
        "/v1/users/me/persona-setup",
        json={
            "profiles": ["farmer", "seller"],
            "primaryProfile": "farmer",
            "roleProfiles": {"seller": {"shopName": "Ram Traders"}},
            "village": "Pimplas",
            "crops": ["onion"],
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "farmer" in body["linkedProfiles"]
    assert "seller" in body["linkedProfiles"]
    assert body["primaryProfile"] == "farmer"
    assert body["activeProfile"] == "farmer"
    assert body["village"] == "Pimplas"
    assert body["activeCrops"] == ["onion"]
    assert body["roleProfiles"]["seller"]["shopName"] == "Ram Traders"


async def test_persona_setup_rejects_unknown_profile(client):
    resp = await _register(client, profiles=[], primaryProfile="")
    token = resp.json()["accessToken"]
    resp = await client.put(
        "/v1/users/me/persona-setup",
        json={"profiles": ["astronaut"]},
        headers=_auth(token),
    )
    assert resp.status_code == 422


async def test_persona_setup_rejects_bad_role_profile(client):
    resp = await _register(client, profiles=[], primaryProfile="")
    token = resp.json()["accessToken"]
    resp = await client.put(
        "/v1/users/me/persona-setup",
        json={"profiles": ["seller"], "roleProfiles": {"seller": {}}},
        headers=_auth(token),
    )
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


async def test_default_language_is_english(client):
    resp = await _register(client)
    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["preferredLanguage"] == "en"
    assert user["language"] == "en"


async def test_put_me_settings_marathi(client):
    token = await _token(client)
    # Default settings should be English
    resp = await client.get("/v1/users/me/settings", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["preferredLanguage"] == "en"

    # Update to Marathi
    resp = await client.put(
        "/v1/users/me/settings",
        json={"language": "mr", "womenMode": True},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    user = resp.json()
    assert user["language"] == "mr"
    assert user["preferredLanguage"] == "mr"

    # Verify persisted in database via GET /me and GET /me/settings
    resp = await client.get("/v1/users/me", headers=_auth(token))
    assert resp.json()["preferredLanguage"] == "mr"

    resp = await client.get("/v1/users/me/settings", headers=_auth(token))
    assert resp.json()["preferredLanguage"] == "mr"
    assert resp.json()["language"] == "mr"
    assert resp.json()["womenMode"] is True


async def test_put_me_preferred_language(client):
    token = await _token(client)
    resp = await client.put(
        "/v1/users/me",
        json={"preferredLanguage": "mr"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["preferredLanguage"] == "mr"
    assert resp.json()["language"] == "mr"


async def test_register_with_marathi_language(client):
    resp = await _register(client, preferredLanguage="mr", language="mr")
    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["preferredLanguage"] == "mr"
    assert user["language"] == "mr"


ME_REQUIRED_FIELDS = [
    "name", "phone", "village", "tehsil", "district", "state",
    "landAreaAcres", "soilType", "irrigationType", "activeCrops",
    "farmBoundaryPoints", "agriCoins", "krishiRatnaLevel", "referralCode",
    "language", "linkedProfiles", "primaryProfile", "activeProfile",
]


async def test_me_hydrates_mobile_fields_for_partial_doc(client, user_store):
    user_store["users/uid-1"] = {
        "id": "uid-1",
        "name": "Ram Patil",
        "phone": "+919812345678",
        "linkedProfiles": ["farmer"],
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    token = await _token(client)
    resp = await client.get("/v1/users/me", headers=_auth(token))
    assert resp.status_code == 200
    me = resp.json()
    missing = [f for f in ME_REQUIRED_FIELDS if f not in me]
    assert missing == []
    assert me["village"] == ""
    assert me["activeCrops"] == []
    assert me["farmBoundaryPoints"] == []
    assert me["agriCoins"] == 0
    assert me["krishiRatnaLevel"] == 1
    assert me["referralCode"] == "ref_uid-1"
    assert me["language"] == "en"


async def test_me_hydrates_mobile_fields_after_register(client):
    resp = await _register(client)
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    resp = await client.get("/v1/users/me", headers=_auth(token))
    assert resp.status_code == 200
    me = resp.json()
    missing = [f for f in ME_REQUIRED_FIELDS if f not in me]
    assert missing == []
    assert me["village"] == "Pimplas"
    assert me["activeCrops"] == ["onion", "wheat"]
