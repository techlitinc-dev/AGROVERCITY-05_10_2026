"""SR 22 — chatbot order-help grounding.

The Gemini/AI layer is fully mocked via monkeypatching of the gateway functions
(same pattern as tests/test_chatbot.py and tests/test_diary_garden_chatbot.py) —
no test here ever hits the network.
"""
from app.core.config import settings
from tests.test_diary import auth, seed_user
from tests.test_diary_garden_chatbot import _clean_decision


def _seed_order(user_store, uid, order_id, status="shipped", total=450, created_at="2026-10-18T10:00:00+00:00"):
    user_store[f"orders/{order_id}"] = {
        "id": order_id,
        "userId": uid,
        "status": status,
        "total": total,
        "items": [{"productId": "prd_1", "quantity": 2}],
        "createdAt": created_at,
    }


def _gateway_fakes(monkeypatch, captured, intent):
    async def fake_decide(state, question_set_id, ctx=None, module="ai"):
        if question_set_id == "chatbot.intent.v1":
            return _clean_decision(intent=intent, answerable=0.9)
        if question_set_id == "chatbot.safety.v1":
            return _clean_decision(
                has_contact_info=False, has_financial_advice=False, has_medical_certainty=False
            )
        raise AssertionError(question_set_id)

    async def fake_generate(prompt, opts=None):
        captured["generate_prompt"] = prompt
        return "Live-style grounded order answer."

    monkeypatch.setattr(settings, "ai_provider", "live")
    monkeypatch.setattr("app.services.ai.gateway.decide", fake_decide)
    monkeypatch.setattr("app.services.ai.gateway.generate", fake_generate)


async def test_order_status_question_prompt_includes_recent_orders(client, user_store, monkeypatch):
    token = seed_user(user_store, uid="uid-ord-1")
    _seed_order(user_store, "uid-ord-1", order_id="ord_a1", status="shipped", total=450)
    _seed_order(user_store, "uid-ord-1", order_id="ord_a2", status="delivered", total=980)
    captured = {}
    _gateway_fakes(monkeypatch, captured, intent="app_help")

    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Mera order kahan hai? Delivery kab hogi?", "language": "hi"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    # the generate prompt is grounded in the user's real recent orders
    assert "Your recent orders" in captured["generate_prompt"]
    assert "ord_a1" in captured["generate_prompt"]
    assert "shipped" in captured["generate_prompt"]
    assert "₹450" in captured["generate_prompt"]
    assert resp.json()["text"] == "Live-style grounded order answer."


async def test_order_question_without_orders_answers_no_recent_orders(client, user_store, monkeypatch):
    token = seed_user(user_store, uid="uid-ord-2")
    captured = {}
    _gateway_fakes(monkeypatch, captured, intent="app_help")

    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Where is my order?", "language": "en"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert "No recent orders" in resp.json()["text"]
    # the bot answered directly — the model was never asked to improvise
    assert "generate_prompt" not in captured


async def test_non_order_question_omits_order_context(client, user_store, monkeypatch):
    token = seed_user(user_store, uid="uid-ord-3")
    _seed_order(user_store, "uid-ord-3", order_id="ord_a9", status="placed", total=120)
    captured = {}
    _gateway_fakes(monkeypatch, captured, intent="agronomy")

    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Aaj ka mausam kaisa rahega?", "language": "hi"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert "Your recent orders" not in captured["generate_prompt"]
    assert "ord_a9" not in captured["generate_prompt"]
