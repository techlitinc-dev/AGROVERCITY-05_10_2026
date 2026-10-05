"""M14 `loans.prescreen.v1` AI tests (WS-07 task 7.8).

Covers:
(1) golden application set on the shim provider — the prescreen ranking
    correlates with the bank-manager labels (pairwise accuracy >= 0.7);
(2) gateway raising -> deterministic fallback used and logged with `fallbackUsed`;
(3) AI flag off -> `GET /loans/queue` returns the submitted order with no `ai`
    annotation and writes zero `ai_decisions` rows (no status mutation either);
(4) missing docs -> one deduped farmer task emitted via the task engine.

The prescreen only ever annotates/sorts; it never mutates an application's
status (asserted below).
"""
import json
import os

import pytest

from app.core.config import settings
from app.services.ai import config_store, gateway, privacy
from tests.test_diary import auth, seed_user

BANKER_UID = "uid-banker-1"
GOLDEN_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "ai", "golden", "loans_prescreen_golden.jsonl"
)
BAND_SCORE = {"low": 0, "medium": 1, "high": 2}


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _banker(user_store):
    return seed_user(user_store, uid=BANKER_UID, active_profile="bankManager", name="Anita Sharma")


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


def _prescreen_decisions(user_store):
    return [d for d in _decisions(user_store) if d.get("questionSetId") == "loans.prescreen.v1"]


def _loans(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("loan_applications/")]


def _tasks(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("tasks/")]


def _golden_records():
    with open(GOLDEN_PATH, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def _pairwise_accuracy(predicted: list[int], labels: list[int]) -> float:
    concordant = discordant = tied = 0
    for i in range(len(predicted)):
        for j in range(i + 1, len(predicted)):
            delta_pred = predicted[i] - predicted[j]
            delta_label = labels[i] - labels[j]
            if delta_pred == 0 or delta_label == 0:
                tied += 1
            elif (delta_pred > 0) == (delta_label > 0):
                concordant += 1
            else:
                discordant += 1
    total = concordant + discordant + tied
    return (concordant + 0.5 * tied) / total if total else 0.0


async def _apply(client, token, **overrides):
    body = {"amount": 30000, "tenureMonths": 6, "purpose": "Seed purchase", **overrides}
    return await client.post("/v1/finance/loans/apply", json=body, headers=auth(token))


# --------------------------------------------------------------------------- #
# (1) golden set — ranking correlation vs manager labels
# --------------------------------------------------------------------------- #


def test_golden_fixture_exists_and_schema_valid():
    assert os.path.exists(GOLDEN_PATH), f"Golden fixture missing at {GOLDEN_PATH}"
    records = _golden_records()
    assert len(records) >= 8
    for rec in records:
        assert "managerLabel" in rec
        assert rec["managerLabel"] in BAND_SCORE
        assert isinstance(rec["application"], dict)


async def test_golden_prescreen_ranks_like_manager_labels(client, user_store):
    records = _golden_records()
    predicted: list[int] = []
    labels: list[int] = []
    for rec in records:
        state = privacy.build_loan_prescreen_state(rec["application"])
        decision = await gateway.decide(state, "loans.prescreen.v1", module="loans_prescreen")
        assert decision.source == "shim"
        band = str((decision.answers or {}).get("riskBand"))
        assert band in BAND_SCORE
        predicted.append(BAND_SCORE[band])
        labels.append(BAND_SCORE[rec["managerLabel"]])

    accuracy = _pairwise_accuracy(predicted, labels)
    assert accuracy >= 0.7, f"prescreen ranking pairwise accuracy {accuracy:.3f} below 0.7"

    # The shim call was logged with the question set + cost/confidence fields.
    logged = _prescreen_decisions(user_store)
    assert logged
    assert all("costUsd" in row and "confidence" in row and "fallbackUsed" in row for row in logged)


# --------------------------------------------------------------------------- #
# (2) fallback when the gateway raises
# --------------------------------------------------------------------------- #


async def test_fallback_when_gateway_raises(client, user_store, monkeypatch):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)

    async def boom(*args, **kwargs):
        raise RuntimeError("AI gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    app_id = (await _apply(client, farmer_token)).json()["applicationId"]

    resp = await client.get("/v1/loans/queue", headers=auth(banker_token))
    assert resp.status_code == 200
    row = next(r for r in resp.json()["data"] if r["applicationId"] == app_id)
    assert row["ai"] is not None
    assert row["ai"]["riskBand"] in BAND_SCORE
    assert isinstance(row["ai"]["missingDocs"], list)

    fallback_dec = next(
        (d for d in _prescreen_decisions(user_store) if d.get("fallbackUsed") is True), None
    )
    assert fallback_dec is not None
    assert fallback_dec["source"] == "fallback"
    assert fallback_dec["costUsd"] == 0.0


# --------------------------------------------------------------------------- #
# (3) flag off — submitted order, no annotation, no decisions, no status change
# --------------------------------------------------------------------------- #


async def test_flag_off_queue_is_submitted_order_without_ai(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)

    user_store["platform_config/ai"] = {
        "modules": {"loans_prescreen": False},
        "thresholds": {"loans.prescreen.v1": 0.75},
        "automation": {"loans.prescreen.v1": "suggest"},
    }
    config_store.clear_cache()

    applied: list[str] = []
    for amount in (30000, 40000, 50000):
        applied.append((await _apply(client, farmer_token, amount=amount)).json()["applicationId"])

    before = len(_decisions(user_store))
    resp = await client.get("/v1/loans/queue", headers=auth(banker_token))
    assert resp.status_code == 200
    body = resp.json()

    # Submitted order = newest first (createdAt desc).
    assert [r["applicationId"] for r in body["data"]] == list(reversed(applied))
    assert all(r.get("ai") is None for r in body["data"])
    assert all(d.get("ai") is None for d in _loans(user_store))
    assert len(_decisions(user_store)) == before  # no ai_decisions rows for the queue read

    # No status mutation anywhere: every application is still `submitted`.
    assert all(d["status"] == "submitted" for d in _loans(user_store))


# --------------------------------------------------------------------------- #
# (4) missing docs -> deduped farmer task (task 7.5)
# --------------------------------------------------------------------------- #


async def test_missing_docs_emit_deduped_farmer_task(client, user_store):
    farmer_token = seed_user(user_store)
    banker_token = _banker(user_store)
    await _apply(client, farmer_token)

    await client.get("/v1/loans/queue", headers=auth(banker_token))
    tasks = _tasks(user_store)
    assert len(tasks) == 1
    task = tasks[0]
    assert task["module"] == "loans"
    assert task["kind"] == "loan_prescreen_missing_docs"
    assert task["status"] == "open"
    assert task["deepLink"] == "/dashboard/p/loanTracking"
    assert task["title"]["en"] and task["title"]["hi"]

    # Re-scoring on a second queue read dedupes (no duplicate task).
    await client.get("/v1/loans/queue", headers=auth(banker_token))
    assert len(_tasks(user_store)) == 1
