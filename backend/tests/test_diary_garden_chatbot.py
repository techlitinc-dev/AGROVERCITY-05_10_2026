"""SR 12 / SR 25 / SR 18 — diary breadth, kitchen-garden contract, chatbot image input.

The Gemini/AI layer is fully mocked via monkeypatching of the gateway functions
(same pattern as tests/test_chatbot.py) — no test here ever hits the network.
"""
from app.core.config import settings
from app.data.women_seed import GARDEN_PLAN_TEMPLATES
from app.services.ai import gateway
from tests.test_diary import auth, seed_user


def _clean_decision(**answers):
    return gateway.DecisionResult(
        answers=answers,
        confidence=0.9,
        source="shim",
        escalated=False,
        decision_id="dec_test",
        latency_ms=1,
    )


# ------------------------------ SR 18: chatbot image input ------------------------------


async def test_chatbot_message_with_image_url_forwards_to_vision(client, user_store, monkeypatch):
    token = seed_user(user_store, uid="uid-img-1")
    captured = {}

    async def fake_analyze_image(image_bytes, prompt, schema=None, module="equipment_booking_rec"):
        captured["image_bytes"] = image_bytes
        captured["vision_prompt"] = prompt
        captured["vision_module"] = module
        return {
            "description": "Yellowing leaves with a faint mosaic pattern on new growth",
            "likely_issue": "Yellow mosaic virus",
            "crop": "Soybean",
            "severity": "medium",
        }

    async def fake_decide(state, question_set_id, ctx=None, module="ai"):
        if question_set_id == "chatbot.intent.v1":
            return _clean_decision(intent="agronomy", answerable=0.9)
        if question_set_id == "chatbot.safety.v1":
            return _clean_decision(
                has_contact_info=False, has_financial_advice=False, has_medical_certainty=False
            )
        raise AssertionError(question_set_id)

    async def fake_generate(prompt, opts=None):
        captured["generate_prompt"] = prompt
        captured["generate_opts"] = opts
        return "Vision-augmented agronomy answer."

    monkeypatch.setattr(settings, "ai_provider", "live")
    monkeypatch.setattr("app.services.ai.gateway.analyze_image", fake_analyze_image)
    monkeypatch.setattr("app.services.ai.gateway.decide", fake_decide)
    monkeypatch.setattr("app.services.ai.gateway.generate", fake_generate)
    monkeypatch.setattr("app.services.chatbot.storage.read_blob", lambda path: b"\x89PNGfakeimagebytes")

    resp = await client.post(
        "/v1/chatbot/messages",
        json={
            "text": "Pattiyon pe peela pan kyun aa raha hai?",
            "imageUrl": "uploads/uid-img-1/photo1.png",
        },
        headers=auth(token),
    )
    assert resp.status_code == 200
    # the service resolved the photo reference and forwarded real bytes to vision
    assert captured["image_bytes"] == b"\x89PNGfakeimagebytes"
    assert captured["vision_module"] == "chatbot"
    # the generate call received the farmer query plus the photo analysis note
    assert "Pattiyon pe peela pan" in captured["generate_prompt"]
    assert "Yellowing leaves" in captured["generate_prompt"]
    assert "likely issue: Yellow mosaic virus" in captured["generate_prompt"]
    assert resp.json()["text"] == "Vision-augmented agronomy answer."
    # the saved history record carries the image so UIs can render the bubble
    records = [k for k in user_store if k.startswith("users/uid-img-1/chatbot_messages/")]
    assert len(records) == 1
    assert user_store[records[0]]["imageUrl"] == "uploads/uid-img-1/photo1.png"


async def test_chatbot_message_with_unreadable_image_still_answers(client, user_store, monkeypatch):
    token = seed_user(user_store, uid="uid-img-2")
    calls = {"analyze": 0}

    async def fake_analyze_image(image_bytes, prompt, schema=None, module="equipment_booking_rec"):
        calls["analyze"] += 1
        return {"description": "should not be called"}

    monkeypatch.setattr("app.services.ai.gateway.analyze_image", fake_analyze_image)
    # simulate a missing blob (dev read_blob returns b"" for absent files)
    monkeypatch.setattr("app.services.chatbot.storage.read_blob", lambda path: b"")

    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Aaj ka mausam kaisa rahega?", "imageUrl": "file:///nonexistent/missing.png"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    # no vision call on empty bytes — graceful text-only fallback
    assert calls["analyze"] == 0
    assert "मौसम" in resp.json()["text"] or "weather" in resp.json()["text"].lower()
    records = [k for k in user_store if k.startswith("users/uid-img-2/chatbot_messages/")]
    assert user_store[records[0]]["imageUrl"] == "file:///nonexistent/missing.png"


async def test_chatbot_message_with_live_image_vision_failure_falls_back(client, user_store, monkeypatch):
    token = seed_user(user_store, uid="uid-img-3")
    captured = {}

    async def fake_analyze_image(image_bytes, prompt, schema=None, module="equipment_booking_rec"):
        raise RuntimeError("gemini vision unavailable")

    async def fake_decide(state, question_set_id, ctx=None, module="ai"):
        if question_set_id == "chatbot.intent.v1":
            return _clean_decision(intent="agronomy", answerable=0.9)
        if question_set_id == "chatbot.safety.v1":
            return _clean_decision(
                has_contact_info=False, has_financial_advice=False, has_medical_certainty=False
            )
        raise AssertionError(question_set_id)

    async def fake_generate(prompt, opts=None):
        captured["generate_prompt"] = prompt
        return "Text-only answer."

    monkeypatch.setattr(settings, "ai_provider", "live")
    monkeypatch.setattr("app.services.ai.gateway.analyze_image", fake_analyze_image)
    monkeypatch.setattr("app.services.ai.gateway.decide", fake_decide)
    monkeypatch.setattr("app.services.ai.gateway.generate", fake_generate)
    monkeypatch.setattr("app.services.chatbot.storage.read_blob", lambda path: b"\x89PNGfakeimagebytes")

    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Mitti ka rang kaise check karun?", "imageUrl": "uploads/uid-img-3/soil.png"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["text"] == "Text-only answer."
    # the model still knows a photo was attached (unreadable note), no crash
    assert "attached a farm photo" in captured["generate_prompt"]


# ------------------------------ SR 25: kitchen garden ------------------------------


async def test_garden_templates_returns_seeded_catalog(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/women/garden-templates", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == len(GARDEN_PLAN_TEMPLATES)
    categories = {t["category"] for t in data}
    assert {"Leafy Greens", "Vegetables", "Trees/Perennials"} <= categories
    spinach = next(item for t in data for item in t["items"] if item["name"] == "Spinach")
    assert spinach["nutrition"]
    assert spinach["daysToHarvest"] > 0
    assert spinach["companion"]
    assert spinach["vernacularName"]


async def test_garden_templates_prefers_firestore_rows(client, user_store):
    token = seed_user(user_store)
    user_store["garden_plans/gp_custom"] = {
        "id": "gp_custom",
        "template": True,
        "order": 9,
        "category": "Herbs",
        "items": [{"name": "Tulsi", "vernacularName": "तुळस", "daysToHarvest": 30}],
    }
    resp = await client.get("/v1/women/garden-templates", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["category"] == "Herbs"


async def test_garden_plan_create_roundtrip_with_items(client, user_store):
    token = seed_user(user_store)
    body = {
        "category": "Leafy Greens",
        "items": [
            {
                "name": "Spinach",
                "vernacularName": "पालक",
                "nutrition": "Iron, Vitamin A, Folate",
                "companion": "Tomato, Cauliflower",
                "daysToHarvest": 45,
            }
        ],
    }
    resp = await client.post("/v1/women/garden-plans", json=body, headers=auth(token))
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["category"] == "Leafy Greens"
    assert doc["template"] is False
    assert doc["ownerUid"] == "uid-1"
    assert doc["items"][0]["name"] == "Spinach"
    assert doc["items"][0]["daysToHarvest"] == 45
    assert doc["items"][0]["nutrition"]

    listing = await client.get("/v1/women/garden-plans", headers=auth(token))
    assert doc["id"] in [p["id"] for p in listing.json()["data"]]

    update = await client.put(
        f"/v1/women/garden-plans/{doc['id']}",
        json={**body, "items": body["items"] + [{"name": "Coriander", "daysToHarvest": 40}]},
        headers=auth(token),
    )
    assert update.status_code == 200
    assert len(update.json()["items"]) == 2


# ------------------------------ SR 12: diary breadth ------------------------------


async def test_diary_farm_activity_with_trade_fields_roundtrip(client, user_store):
    token = seed_user(user_store)
    payload = {
        "title": "Soybean harvesting — first cutting",
        "category": "Harvesting",
        "type": "farmActivity",
        "amount": 0,
        "date": "2026-10-18",
        "cropName": "Soybean",
        "tradeType": "sell",
        "party": "Anil Traders",
        "quantity": 12,
        "unit": "quintal",
        "notes": "First cutting",
    }
    resp = await client.post("/v1/diary/entries", json=payload, headers=auth(token))
    assert resp.status_code == 201
    entry = resp.json()["entry"]
    assert entry["type"] == "farmActivity"
    assert entry["tradeType"] == "sell"
    assert entry["party"] == "Anil Traders"
    assert entry["cropName"] == "Soybean"
    assert entry["quantity"] == 12
    assert entry["unit"] == "quintal"

    listed = await client.get("/v1/diary/entries?type=farmActivity", headers=auth(token))
    assert listed.status_code == 200
    rows = listed.json()["data"]
    assert rows[0]["tradeType"] == "sell"
    assert rows[0]["party"] == "Anil Traders"

    updated = await client.put(
        f"/v1/diary/entries/{entry['id']}",
        json={**payload, "tradeType": "buy"},
        headers=auth(token),
    )
    assert updated.status_code == 200
    assert updated.json()["entry"]["tradeType"] == "buy"
