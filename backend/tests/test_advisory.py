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


async def test_saturation_returns_data_basis_and_logs_decision(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/saturation",
        json={**SATURATION_BODY, "shareSowingIntent": False},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["dataBasis"] == {"count": 0, "district": "Nashik"}
    assert body["priceSource"] in ("mandi_history", "unavailable")
    assert body["automationLevel"] == "suggest"
    assert any(key.startswith("ai_decisions/") for key in user_store)


async def test_saturation_red_emits_task(client, user_store):
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
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert any(doc.get("module") == "advisory" for doc in tasks)


async def test_disease_gate_blocks_non_leaf(client, user_store, monkeypatch):
    from app.services.ai import gateway

    async def fake_analyze(image_bytes, prompt, schema=None, module="x"):
        return {"is_plant_leaf": False, "quality_ok": True, "confidence": 0.9}

    monkeypatch.setattr(gateway, "analyze_image", fake_analyze)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/disease-scan",
        files={"image": ("scan.png", PNG_BYTES, "image/png")},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["gate"]["passed"] is False
    assert body["retake"] is not None
    assert body["results"] == []
    assert not any(key.startswith("disease_scans/") for key in user_store)


async def test_disease_low_confidence_creates_ticket(client, user_store, monkeypatch):
    from app.services.ai import gateway

    async def fake_analyze(image_bytes, prompt, schema=None, module="x"):
        return {
            "is_plant_leaf": True,
            "quality_ok": True,
            "diseaseName": "Leaf Rust",
            "crop": "Wheat",
            "pathogen": "Puccinia triticina",
            "confidence": 0.55,
            "symptoms": "orange pustules",
            "chemicalTreatment": "Propiconazole 25% EC",
            "organicTreatment": "Neem oil",
            "dosage": "1 ml/L",
            "estimatedCost": 300.0,
        }

    monkeypatch.setattr(gateway, "analyze_image", fake_analyze)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/disease-scan",
        files={"image": ("scan.png", PNG_BYTES, "image/png")},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["gate"]["passed"] is True
    assert any(key.startswith("expert_tickets/") for key in user_store)


async def test_disease_scan_history_per_plot(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/disease-scan",
        files={"image": ("scan.png", PNG_BYTES, "image/png")},
        data={"plotId": "plot-1"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    scan_id = resp.json()["scanId"]
    assert scan_id
    history = await client.get(
        "/v1/advisory/disease-scans", params={"plotId": "plot-1"}, headers=auth(token)
    )
    assert history.status_code == 200
    assert scan_id in [row["scanId"] for row in history.json()["data"]]


async def test_disease_treatment_emits_task(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/disease-scan",
        files={"image": ("scan.png", PNG_BYTES, "image/png")},
        headers=auth(token),
    )
    assert resp.status_code == 200
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert any(doc.get("kind") == "disease_treatment" for doc in tasks)
