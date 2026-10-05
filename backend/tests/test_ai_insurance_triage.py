"""M15 `insurance.triage.v1` AI tests (WS-07 task 7.14).

Covers:
(1) golden photo-count set on the shim + intimation response — incomplete
    claims get `completeness < 1` with non-empty en/hi retake guidance;
(2) gateway raising -> deterministic fallback annotation, logged with
    `fallbackUsed`;
(3) AI flag off -> no triage annotation on the intimation response and filing
    still succeeds;
(4) an engineered `fraudSignal > 0.8` claim is flagged but its status is
    unchanged, a human can still approve it, and ZERO claims are auto-rejected
    anywhere in this module.
"""
import json
import os

import pytest

from app.core.config import settings
from app.services.ai import config_store, gateway, privacy
from tests.test_diary import auth, seed_user
from tests.test_insurance_claims import (
    CLAIM_FIELDS,
    _fake_storage,
    _farmer,
    _seed_policy,
    _submit,
)

GOLDEN_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "ai", "golden", "insurance_triage_golden.jsonl"
)


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


def _triage_decisions(user_store):
    return [d for d in _decisions(user_store) if d.get("questionSetId") == "insurance.triage.v1"]


def _claims(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("insurance_claims/")]


def _golden_records():
    with open(GOLDEN_PATH, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


# --------------------------------------------------------------------------- #
# (1) golden set — completeness from the required-photo ratio + guidance
# --------------------------------------------------------------------------- #


def test_golden_fixture_exists_and_schema_valid():
    assert os.path.exists(GOLDEN_PATH), f"Golden fixture missing at {GOLDEN_PATH}"
    records = _golden_records()
    assert len(records) >= 3
    for rec in records:
        assert "photoCount" in rec and "expected" in rec
        assert 0 <= rec["expected"]["completeness"] <= 1


async def test_golden_shim_completeness_and_guidance(client, user_store):
    for rec in _golden_records():
        claim = {
            "id": rec["id"],
            "cropName": "Wheat",
            "calamityType": "hailstorm",
            "cropStage": "flowering",
            "estimatedLossPercent": 40,
            "gpsCoordinates": "20.0,73.8",
            "damagePhotos": ["photo"] * rec["photoCount"],
        }
        state = privacy.build_claim_triage_state(claim)
        decision = await gateway.decide(state, "insurance.triage.v1", module="insurance_triage")
        assert decision.source == "shim"
        answers = decision.answers
        assert answers["completeness"] == pytest.approx(rec["expected"]["completeness"], abs=1e-6)
        guidance = answers["retakeGuidance"]
        if rec["expected"]["guidancePresent"]:
            assert answers["completeness"] < 1.0
            assert guidance["en"] and guidance["hi"]
        else:
            assert guidance == {"en": "", "hi": ""}


async def test_incomplete_claim_intimation_gets_instant_feedback(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)

    resp = await _submit(client, token)  # CLAIM_FIELDS + 2 photos (< 4 recommended)
    assert resp.status_code == 201
    body = resp.json()
    assert body["triage"]["completeness"] < 1.0
    assert body["triage"]["photoQuality"] == "poor"
    assert body["triage"]["retakeGuidance"]["en"]
    assert body["triage"]["retakeGuidance"]["hi"]

    # Full triage (reasons + fraud signal) is persisted on the claim for the
    # provider console; the farmer response only carries the feedback subset.
    stored = next(d for k, d in user_store.items() if k.startswith("insurance_claims/"))
    assert stored["triage"]["completeness"] < 1.0
    assert stored["triage"]["triageReasons"]
    assert stored["fraudFlag"] is False


# --------------------------------------------------------------------------- #
# (2) fallback when the gateway raises
# --------------------------------------------------------------------------- #


async def test_fallback_when_gateway_raises(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)

    async def boom(*args, **kwargs):
        raise RuntimeError("AI gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    resp = await _submit(client, token)
    assert resp.status_code == 201  # filing never blocked by an AI failure
    body = resp.json()
    assert body["triage"]["completeness"] < 1.0
    assert body["triage"]["retakeGuidance"]["hi"]

    fallback_dec = next(
        (d for d in _triage_decisions(user_store) if d.get("fallbackUsed") is True), None
    )
    assert fallback_dec is not None
    assert fallback_dec["source"] == "fallback"
    assert fallback_dec["costUsd"] == 0.0


# --------------------------------------------------------------------------- #
# (3) flag off — unchanged filing, no triage annotation
# --------------------------------------------------------------------------- #


async def test_flag_off_no_annotation_and_filing_succeeds(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = _farmer(user_store)
    _seed_policy(user_store)

    user_store["platform_config/ai"] = {
        "modules": {"insurance_triage": False},
        "thresholds": {"insurance.triage.v1": 0.75},
        "automation": {"insurance.triage.v1": "suggest"},
    }
    config_store.clear_cache()

    before = len(_decisions(user_store))
    resp = await _submit(client, token)
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "intimated"
    assert "triage" not in body

    stored = next(d for k, d in user_store.items() if k.startswith("insurance_claims/"))
    assert "triage" not in stored
    assert "fraudFlag" not in stored
    assert len(_decisions(user_store)) == before  # no ai_decisions rows written


# --------------------------------------------------------------------------- #
# (4) fraud signal flags but never rejects
# --------------------------------------------------------------------------- #


async def test_fraud_signal_flags_but_never_auto_rejects(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    from app.routers.insurance_claims import _compute_claim_triage

    farmer_token = _farmer(user_store)
    provider_token = seed_user(user_store, uid="provider-fraud", active_profile="insuranceProvider")
    _seed_policy(user_store)

    created = (await _submit(client, farmer_token)).json()
    claim_id = created["id"]

    # Engineer the fixture: the shim returns fraudSignal > 0.8 for this state.
    claim = dict(user_store[f"insurance_claims/{claim_id}"])
    claim["fraudSignal"] = 0.95
    triage = await _compute_claim_triage(claim)
    assert triage["fraudSignal"] > 0.8
    claim["triage"] = triage
    claim["fraudFlag"] = triage["fraudSignal"] > 0.8
    assert claim["status"] == "intimated"
    user_store[f"insurance_claims/{claim_id}"] = claim
    user_store[f"users/uid-1/insurance_claims/{claim_id}"] = claim

    # Provider console surfaces the fraud flag…
    detail = await client.get(
        f"/v1/insurance/provider/claims/{claim_id}", headers=auth(provider_token)
    )
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["fraudFlag"] is True
    assert detail_body["triage"]["fraudSignal"] > 0.8
    assert detail_body["status"] == "intimated"  # …without changing the status

    # …and a human can still approve the claim normally.
    approved = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/review",
        json={"action": "approve", "approvedAmount": 30000.0, "notes": "सत्यापन उपरांत स्वीकृत"},
        headers=auth(provider_token),
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "dbtApproved"

    # Zero auto-rejections anywhere in the module: no claim is rejected unless a
    # human explicitly rejected it (none did here).
    assert [d for d in _claims(user_store) if d.get("status") == "rejected"] == []
