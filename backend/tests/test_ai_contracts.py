"""AI contract tests (phase-08 WS-02 task 2.9).

Validates that every registered question set's deterministic answer conforms to
its declared schema, and that an injected schema violation RAISES (never
silently falls back).
"""
import pytest

from app.core.config import settings
from app.services.ai import config_store, contracts, question_sets


@pytest.fixture(autouse=True)
def _clear_cache():
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def test_every_question_set_answer_contract():
    for question_set_id in question_sets.REGISTRY:
        answers = question_sets.fallback_answers(question_set_id, {})
        contracts.validate_answers(question_set_id, answers)


async def test_gateway_response_conforms(client, user_store):
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(settings, "ai_provider", "shim")
    try:
        from app.services.ai import gateway

        decision = await gateway.decide(
            {"inactivity_days": 20, "pending_offer": True},
            "churn.signal.v1",
            module="churn_signal",
        )
        contracts.validate_answers("churn.signal.v1", decision.answers)
    finally:
        monkeypatch.undo()


def test_schema_violation_raises():
    with pytest.raises(contracts.ContractViolation):
        contracts.validate_answers("churn.signal.v1", {"churn_risk": 0.5})  # missing best_hook

    with pytest.raises(contracts.ContractViolation):
        contracts.validate_answers("churn.signal.v1", {"churn_risk": "high", "best_hook": "course_reminder"})

    with pytest.raises(contracts.ContractViolation):
        contracts.validate_answers("does.not.exist.v1", {})
