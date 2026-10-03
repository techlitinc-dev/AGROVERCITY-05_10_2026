import json
import os

from app.core.config import settings
from app.services.ai import gateway
from app.services.chatbot import HANDOFF_COPY, MONEY_NEUTRAL_COPY, SAFE_FALLBACK
from tests.test_diary import auth, seed_user

GOLDEN_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden")


def _clean_decision(**answers):
    return gateway.DecisionResult(
        answers=answers,
        confidence=0.9,
        source="shim",
        escalated=False,
        decision_id="dec_test",
        latency_ms=1,
    )


async def test_chatbot_send_message_saturation_keyword(client, user_store):
    token = seed_user(user_store, uid="uid-cb-1", name="Ramesh Pawar")
    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Kya main is saal tamatar ki boyi karu?"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sender"] == "bot"
    assert "मार्केट सैचुरेशन" in data["text"] or "tamatar" in data["text"].lower() or "टमाटर" in data["text"]
    assert data["richCardType"] == "saturation"
    assert data["richCardData"]["crop"] == "Tomato (टमाटर)"
    assert len(data["quickReplies"]) > 0


async def test_chatbot_send_message_weather_keyword(client, user_store):
    token = seed_user(user_store, uid="uid-cb-2", name="Kiran Patil")
    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Aaj ka mausam kaisa rahega?"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "मौसम" in data["text"] or "weather" in data["text"].lower() or "बारिश" in data["text"]
    assert len(data["quickReplies"]) > 0


async def test_chatbot_history_retrieval(client, user_store):
    token = seed_user(user_store, uid="uid-cb-3")
    # Send message
    await client.post(
        "/v1/chatbot/messages",
        json={"text": "Urea ki matra kitni daalein?", "sessionId": "sess-test-101"},
        headers=auth(token),
    )
    # Fetch history
    resp = await client.get("/v1/chatbot/history?sessionId=sess-test-101", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert data["sessionId"] == "sess-test-101"
    assert "Urea" in data["data"][0]["userQuery"]


async def test_chatbot_expert_handoff_creation(client, user_store):
    token = seed_user(user_store, uid="uid-cb-4")
    resp = await client.post(
        "/v1/chatbot/expert-handoff",
        json={
            "query": "Pattiyon par ajeeb safed kide dikh rahe hain, kripya doctor ki madad dein",
            "category": "crop_health",
            "urgency": "high",
            "crop": "Pomegranate",
        },
        headers=auth(token),
    )
    assert resp.status_code == 201
    ticket = resp.json()
    assert ticket["status"] == "queued"
    assert ticket["urgency"] == "high"
    assert "KVK" in ticket["assignedDesk"]
    assert ticket["estimatedWaitMinutes"] == 15


async def test_chatbot_list_available_experts(client, user_store):
    token = seed_user(user_store, uid="uid-cb-5")
    resp = await client.get("/v1/chatbot/experts", headers=auth(token))
    assert resp.status_code == 200
    experts = resp.json()["data"]
    assert len(experts) >= 3
    assert any(e["specialization"].startswith("Cotton") for e in experts)


# ---------------- Kisan Mitra 2.0 (phase-01 WS-04) ----------------


async def test_intent_human_needed_creates_ticket(client, user_store):
    token = seed_user(user_store, uid="uid-cb-h1")
    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "kripya doctor se baat karni hai", "sessionId": "sess-h1"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["isExpertHandoffSuggested"] is True
    assert data["richCardType"] == "expert_handoff"
    assert data["richCardData"]["status"] == "queued"
    tickets = [key for key in user_store if key.startswith("expert_tickets/")]
    assert len(tickets) == 1
    assert user_store[tickets[0]]["userId"] == "uid-cb-h1"


async def test_low_answerable_triggers_handoff(client, user_store):
    token = seed_user(user_store, uid="uid-cb-h2")
    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "haan", "sessionId": "sess-h2"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["richCardType"] == "expert_handoff"
    assert [key for key in user_store if key.startswith("expert_tickets/")]


async def test_money_intent_neutral_and_handoff_offer(client, user_store):
    token = seed_user(user_store, uid="uid-cb-h3")
    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "mujhe loan chahiye kya karun", "language": "hi"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["isExpertHandoffSuggested"] is True
    assert data["text"] == MONEY_NEUTRAL_COPY["hi"]
    assert "personal advice" not in data["text"]
    # never a prescriptive recommendation, and no auto-created ticket for the offer
    assert [key for key in user_store if key.startswith("expert_tickets/")] == []


async def test_safety_flag_strips_and_regenerates(client, user_store, monkeypatch):
    token = seed_user(user_store, uid="uid-cb-h4")
    calls = {"safety": 0}

    async def fake_decide(state, question_set_id, ctx=None, module="ai"):
        if question_set_id == "chatbot.intent.v1":
            return _clean_decision(intent="agronomy", answerable=0.9)
        if question_set_id == "chatbot.safety.v1":
            calls["safety"] += 1
            if calls["safety"] == 1:
                return _clean_decision(
                    has_contact_info=True, has_financial_advice=False, has_medical_certainty=False
                )
            return _clean_decision(
                has_contact_info=False, has_financial_advice=False, has_medical_certainty=False
            )
        raise AssertionError(question_set_id)

    monkeypatch.setattr("app.services.ai.gateway.decide", fake_decide)
    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "geli mitti me urea daalein ya nahi, khad matra batao"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert calls["safety"] >= 2


async def test_safety_double_flag_returns_fallback(client, user_store, monkeypatch):
    token = seed_user(user_store, uid="uid-cb-h5")

    async def fake_decide(state, question_set_id, ctx=None, module="ai"):
        if question_set_id == "chatbot.intent.v1":
            return _clean_decision(intent="agronomy", answerable=0.9)
        if question_set_id == "chatbot.safety.v1":
            return _clean_decision(
                has_contact_info=False, has_financial_advice=True, has_medical_certainty=False
            )
        raise AssertionError(question_set_id)

    monkeypatch.setattr("app.services.ai.gateway.decide", fake_decide)
    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "geli mitti me urea daalein ya nahi, khad matra batao", "language": "hi"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["text"] == SAFE_FALLBACK["hi"]


async def test_persona_snippet_in_prompt_state(client, user_store, monkeypatch):
    token = seed_user(user_store, uid="uid-cb-p1", active_profile="farmer")
    captured = {}

    async def fake_decide(state, question_set_id, ctx=None, module="ai"):
        if question_set_id == "chatbot.intent.v1":
            captured["intent_state"] = state
            return _clean_decision(intent="agronomy", answerable=0.9)
        if question_set_id == "chatbot.safety.v1":
            return _clean_decision(
                has_contact_info=False, has_financial_advice=False, has_medical_certainty=False
            )
        raise AssertionError(question_set_id)

    async def fake_generate(prompt, opts=None):
        captured["prompt"] = prompt
        captured["opts"] = opts
        return "Urea 50 kg per acre, split dose me daalein."

    monkeypatch.setattr(settings, "ai_provider", "live")
    monkeypatch.setattr("app.services.ai.gateway.decide", fake_decide)
    monkeypatch.setattr("app.services.ai.gateway.generate", fake_generate)

    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "geli mitti me urea daalein ya nahi, khad matra batao"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert captured["intent_state"]["persona"] == "farmer"
    assert captured["intent_state"]["user"] != "uid-cb-p1"  # pseudonymized
    system = captured["opts"]["system"]
    assert "farmer" in system
    assert "Kisan Mitra" in system
    payload = json.dumps(captured)
    assert "+919812345678" not in payload
    assert "@" not in captured["intent_state"]["user"]


async def test_chatbot_golden_fixtures_on_shim(client, user_store):
    from app.services.ai import shim

    for name in ("chatbot.intent.v1", "chatbot.safety.v1"):
        with open(os.path.join(GOLDEN_DIR, f"{name}.jsonl"), encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                case = json.loads(line)
                answers, _confidence = await shim.decide(name, case["input"])
                for key, expected in case["output"].items():
                    assert answers[key] == expected, (name, case["input"], key)


async def test_handoff_copy_marathi_available():
    assert "mr" in HANDOFF_COPY
    assert "mr" in MONEY_NEUTRAL_COPY
    assert "mr" in SAFE_FALLBACK
