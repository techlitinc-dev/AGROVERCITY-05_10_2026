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
            {"savings_streak_months": 6, "meeting_attendance_rate": 0.5,
             "enterprise_income_entries_90d": 3, "record_keeping": True},
            "women.shg_readiness.v1",
            module="women_shg_readiness",
        )
        contracts.validate_answers("women.shg_readiness.v1", decision.answers)
    finally:
        monkeypatch.undo()


def test_schema_violation_raises():
    with pytest.raises(contracts.ContractViolation):
        contracts.validate_answers("women.shg_readiness.v1", {"readiness": 0.5})  # missing gap

    with pytest.raises(contracts.ContractViolation):
        contracts.validate_answers("women.shg_readiness.v1", {"readiness": "high", "gap": "record_keeping"})

    with pytest.raises(contracts.ContractViolation):
        contracts.validate_answers("does.not.exist.v1", {})
