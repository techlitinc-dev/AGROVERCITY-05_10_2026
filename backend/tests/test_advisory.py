from datetime import date, timedelta

from tests.test_diary import auth, seed_user

FUTURE_DATE = (date.today() + timedelta(days=30)).isoformat()

SATURATION_BODY = {
    "crop": "onion",
    "district": "Nashik",
    "lat": 20.0,
    "lng": 74.7,
    "radiusKm": 10,
}

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


async def test_saturation_green_when_empty(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/saturation",
        json={**SATURATION_BODY, "shareSowingIntent": False},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["sowingCount"] == 0
    assert body["riskLevel"] == "green"


async def test_saturation_red_when_crowded(client, user_store):
    token = seed_user(user_store)
    for i in range(65):
        user_store[f"crop_cycles/u{i}_onion_Kharif"] = {
            "userId": f"u{i}",
            "crop": "onion",
            "district": "Nashik",
            "season": "Kharif",
        }
    resp = await client.post(
        "/v1/advisory/saturation",
        json={**SATURATION_BODY, "shareSowingIntent": False},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["sowingCount"] == 65
    assert body["riskLevel"] == "red"
    assert body["predictedPrice"] < 1450


async def test_sowing_intent_recorded_opt_in(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/saturation", json=SATURATION_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    assert any(
        key.startswith("crop_cycles/uid-1_onion_") for key in user_store
    )
    user_store.clear()
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/saturation",
        json={**SATURATION_BODY, "shareSowingIntent": False},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert not any(key.startswith("crop_cycles/") for key in user_store)


async def test_disease_scan_stub(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/disease-scan",
        files={"image": ("scan.png", PNG_BYTES, "image/png")},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["results"][0]["diseaseName"] == "Early Blight"
    resp = await client.post(
        "/v1/advisory/disease-scan",
        files={"image": ("notes.txt", b"hello", "text/plain")},
        headers=auth(token),
    )
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"


async def test_npk_deficit_math(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/npk",
        json={"n": 40, "p": 20, "k": 10, "crop": "wheat", "soilType": "black"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ureaKgPerAcre"] > 0
    assert body["dapKgPerAcre"] > 0
    assert body["mopKgPerAcre"] > 0
    assert body["recommendations"]


async def test_intent_recorded_with_flag(client, user_store):
    token = seed_user(user_store, district="Nashik", lat=20.0, lng=74.7)
    resp = await client.put(
        "/v1/users/me/consents",
        json={"dataSharing": True, "location": False, "marketing": False},
        headers=auth(token),
    )
    assert resp.status_code == 200
    resp = await client.post(
        "/v1/advisory/sowing-intent",
        json={"crop": "onion", "plannedDate": FUTURE_DATE},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json() == {"recorded": True, "isIntent": True}
    doc = user_store["crop_cycles/uid-1_onion_Kharif"]
    assert doc["isIntent"] is True
    assert doc["district"] == "Nashik"


async def test_intent_without_consent_403(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/sowing-intent",
        json={"crop": "onion", "plannedDate": FUTURE_DATE},
        headers=auth(token),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "CONSENT_REQUIRED"
    assert resp.json()["error"]["message"] == "डेटा साझाकरण की सहमति आवश्यक है"
    assert not any(key.startswith("crop_cycles/") for key in user_store)


async def test_intent_feeds_saturation_count(client, user_store):
    token = seed_user(user_store, district="Nashik", lat=20.0, lng=74.7)
    await client.put(
        "/v1/users/me/consents",
        json={"dataSharing": True, "location": False, "marketing": False},
        headers=auth(token),
    )
    resp = await client.post(
        "/v1/advisory/sowing-intent",
        json={"crop": "onion", "plannedDate": FUTURE_DATE},
        headers=auth(token),
    )
    assert resp.status_code == 201
    resp = await client.post(
        "/v1/advisory/saturation",
        json={**SATURATION_BODY, "shareSowingIntent": False},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["sowingCount"] >= 1
