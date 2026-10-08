"""Golden-dataset coverage (phase-08 WS-02 task 2.5).

Every question set registered in `question_sets.py` must have a golden fixture
`backend/tests/fixtures/ai/golden/<id>.jsonl`. Fixtures that would otherwise be
auto-loaded by the shim deliberately omit a `questionSetId` key (see
`backend/tests/fixtures/ai/golden/loans_prescreen_golden.jsonl`) so the
deterministic shim branch is not overridden.
"""
import json
import os

from app.services.ai import question_sets

GOLDEN_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden")


def test_every_registered_question_set_has_golden_fixture():
    missing = []
    for question_set_id in question_sets.REGISTRY:
        path = os.path.join(GOLDEN_DIR, f"{question_set_id}.jsonl")
        if not os.path.exists(path):
            missing.append(question_set_id)
    assert missing == [], f"missing golden fixtures for: {missing}"


def test_all_golden_fixtures_parse():
    for name in os.listdir(GOLDEN_DIR):
        if not name.endswith(".jsonl"):
            continue
        with open(os.path.join(GOLDEN_DIR, name), encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    json.loads(line)
