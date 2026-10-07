"""Produce grading (phase-05 WS-06, brief M10) — human-review gate + accuracy.

(1) the registered `grading.gate.v1` decision routes a low-confidence grade to
    the human-grader ops queue and publishes a high-confidence one;
(2) the golden graded-image set lands within ±1 AGMARK grade of the expected
    grade for ≥80% of cases (deterministic stub mapping on AI_PROVIDER=shim);
(3) the grade endpoint is gateway-only and never errors when the model is off.
"""
import json
from pathlib import Path

import pytest

from app.core.config import settings
from app.services.ai import config_store
from app.services.ai.question_sets import GRADING_CONFIDENCE_CLASSES, fallback_answers
from app.services.grading_model import get_grading_adapter
from app.services.grading_model.stub import GRADE_SCALE
from tests.test_diary import auth, seed_user

GOLDEN_PATH = Path(__file__).parent / "fixtures" / "ai" / "golden" / "grading.gate.v1.jsonl"
GOLDEN_CASES = [
    json.loads(line)
    for line in GOLDEN_PATH.read_text(encoding="utf-8").splitlines()
    if line.strip()
]


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _ops_tasks(user_store):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("tasks/") and doc.get("kind") == "grading_human_review"
    ]


async def _grade(client, token, image_bytes: bytes):
    return await client.post(
        "/v1/post-harvest/grade",
        files=[("images", ("lot.png", image_bytes, "image/png"))],
        headers=auth(token),
    )


def test_grading_gate_fallback_thresholds():
    high = fallback_answers("grading.gate.v1", {"confidence": 0.9})
    assert high["needs_human"] is False
    assert high["confidence_class"] == "high"
    mid = fallback_answers("grading.gate.v1", {"confidence": 0.75})
    assert mid["needs_human"] is False
    assert mid["confidence_class"] in GRADING_CONFIDENCE_CLASSES
    low = fallback_answers("grading.gate.v1", {"confidence": 0.55})
    assert low["needs_human"] is True
    assert low["confidence_class"] == "low"


async def test_high_confidence_publishes_grade(client, user_store):
    token = seed_user(user_store)
    resp = await _grade(client, token, b"grade:a")
    assert resp.status_code == 200
    body = resp.json()
    assert body["grade"] == "AGMARK A"
    assert body["status"] == "graded"
    assert body["needsHuman"] is False
    assert body["source"] == "stub"
    assert body["automationLevel"] == "suggest"
    assert _ops_tasks(user_store) == []


async def test_low_confidence_routes_to_human_grader(client, user_store):
    token = seed_user(user_store)
    resp = await _grade(client, token, b"grade:c")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "pending_human"
    assert body["needsHuman"] is True
    assert body["grade"] is None
    tasks = _ops_tasks(user_store)
    assert len(tasks) == 1
    assert tasks[0]["module"] == "post_harvest"
    assert tasks[0]["persona"] == "ops"
    assert tasks[0]["deepLink"] == "/dashboard/p/postHarvest"


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=[case["id"] for case in GOLDEN_CASES])
async def test_golden_case_returns_a_valid_grade(client, case):
    assessment = await get_grading_adapter().scan(case["imageRef"].encode())
    assert assessment["grade"] in GRADE_SCALE
    assert 0.0 <= float(assessment["confidence"]) <= 1.0


async def test_golden_accuracy_within_one_grade(client):
    within = 0
    for case in GOLDEN_CASES:
        assessment = await get_grading_adapter().scan(case["imageRef"].encode())
        got = GRADE_SCALE.index(assessment["grade"])
        expected = GRADE_SCALE.index(case["expectedGrade"])
        if abs(got - expected) <= 1:
            within += 1
    assert within / len(GOLDEN_CASES) >= 0.8
