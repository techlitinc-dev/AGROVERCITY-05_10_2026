import pytest

from app.core.config import settings
from app.services.ai import budget, config_store, gateway, privacy


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


async def test_shim_decide_round_trip(client, user_store):
    result = await gateway.decide(
        {"crop": "wheat", "phone": "+919812345678"}, "sample.agronomy.v1", module="chatbot"
    )
    assert result.source == "shim"
    assert result.answers["crop"] == "wheat"
    assert result.confidence == pytest.approx(0.91)
    assert result.escalated is False
    assert result.decision_id
    assert result.latency_ms >= 0
    decisions = _decisions(user_store)
    assert len(decisions) == 1
    assert decisions[0]["questionSetId"] == "sample.agronomy.v1"
    assert decisions[0]["stateHash"]
    assert decisions[0]["fallbackUsed"] is False


async def test_shim_generate_round_trip(client, user_store):
    text = await gateway.generate("hello kisan", {"module": "chatbot"})
    assert text
    decisions = _decisions(user_store)
    assert len(decisions) == 1
    assert decisions[0]["source"] == "shim"
    assert decisions[0]["module"] == "chatbot"


async def test_unknown_question_set_returns_defaults(client):
    result = await gateway.decide({}, "does.not.exist.v1")
    assert result.source == "shim"
    assert result.answers == {}


async def test_low_confidence_escalates_to_fallback(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "live")
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")

    class LowConfidenceClient:
        async def decide(self, *args, **kwargs):
            return {"answers": {"crop": "rice"}, "confidence": 0.10}

    monkeypatch.setattr(gateway, "_get_jev_client", lambda: LowConfidenceClient())
    result = await gateway.decide({}, "sample.agronomy.v1")
    assert result.source == "fallback"
    assert result.escalated is True
    assert result.answers == {"crop": "unknown", "sowingWindow": "not-available"}


async def test_fallback_on_client_exception(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "live")
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")

    class BoomClient:
        async def decide(self, *args, **kwargs):
            raise RuntimeError("provider down")

    monkeypatch.setattr(gateway, "_get_jev_client", lambda: BoomClient())
    result = await gateway.decide({}, "sample.agronomy.v1")
    assert result.source == "fallback"
    assert result.escalated is True
    assert result.answers == {"crop": "unknown", "sowingWindow": "not-available"}


async def test_budget_trip_degrades_cleanly(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "live")
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")

    async def over_budget(model):
        return True

    monkeypatch.setattr(budget, "over_budget", over_budget)
    result = await gateway.decide({}, "sample.agronomy.v1")
    assert result.source == "fallback"
    assert result.escalated is True


async def test_flag_off_path(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "live")
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")

    async def disabled(module):
        return False

    monkeypatch.setattr(config_store, "module_enabled", disabled)
    result = await gateway.decide({}, "sample.agronomy.v1", module="some_new_module")
    assert result.source == "fallback"
    assert result.escalated is True


def test_privacy_sanitizer_strips_phone_email_and_aadhaar():
    text = "call +919812345678 or mail ram@example.com aadhaar 1234 5678 9012"
    clean = privacy.sanitize_text(text)
    assert "+919812345678" not in clean
    assert "ram@example.com" not in clean
    assert "1234 5678 9012" not in clean
    assert "[phone]" in clean
    assert "[email]" in clean
    assert "XXXX-XXXX-9012" in clean


def test_privacy_sanitize_state_recurses():
    state = {"farmer": {"phone": "9876543210", "email": "a@b.co", "village": "Rampur"}}
    clean = privacy.sanitize_state(state)
    assert clean["farmer"]["phone"] == "[phone]"
    assert clean["farmer"]["email"] == "[email]"
    assert clean["farmer"]["village"] == "Rampur"
