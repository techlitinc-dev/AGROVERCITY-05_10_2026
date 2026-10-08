"""M26 `women.shg_readiness.v1` tests (phase-08 WS-01).

Covers: golden fixture on shim, deterministic fallback when the gateway fails
(`fallbackUsed` logged), flag-off operation without AI, and the loan-marketplace
link appearing only past the readiness threshold.
"""
import json
import os
from datetime import datetime, timezone

import pytest

from app.core.config import settings
from app.services import shg_readiness
from app.services.ai import config_store, gateway

GOLDEN_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "ai", "golden", "women.shg_readiness.v1.jsonl"
)


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _golden_records():
    with open(GOLDEN_PATH, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def _patch_state(monkeypatch, **overrides):
    state = {
        "savings_streak_months": 12,
        "meeting_attendance_rate": 1.0,
        "enterprise_income_entries_90d": 6,
        "record_keeping": True,
    }
    state.update(overrides)

    async def fake_builder(shg_id):
        return {"shgHash": "hash", **state}

    monkeypatch.setattr(
        "app.services.shg_readiness.privacy.build_shg_readiness_state", fake_builder
    )
    return state


async def test_golden_fixture_on_shim(client, user_store):
    records = _golden_records()
    assert len(records) >= 6
    for case in records:
        answers, _confidence = await gateway.shim.decide("women.shg_readiness.v1", case["input"])
        assert answers["readiness"] == case["output"]["readiness"], case["id"]
        assert answers["gap"] == case["output"]["gap"], case["id"]
    # A golden set is deterministic on shim (same answer regardless of state).
    decision = await gateway.decide(
        {"savings_streak_months": 0, "meeting_attendance_rate": 0.0,
         "enterprise_income_entries_90d": 0, "record_keeping": False},
        "women.shg_readiness.v1",
        module="women_shg_readiness",
    )
    assert decision.source == "shim"
    assert decision.answers["gap"] == "enterprise_income"


async def test_fallback_when_gateway_fails(client, user_store, monkeypatch):
    _patch_state(monkeypatch, savings_streak_months=0, meeting_attendance_rate=0.0,
                 enterprise_income_entries_90d=0, record_keeping=False)
    monkeypatch.setattr(settings, "ai_provider", "live")

    async def boom(*args, **kwargs):
        raise RuntimeError("jev down")

    monkeypatch.setattr("app.services.ai.gateway._with_retries", boom)

    payload = await shg_readiness.get_shg_readiness("shg_x", force=True)
    assert payload["source"] == "fallback"
    assert payload["readiness"] == 0.07
    logged = [d for k, d in user_store.items() if k.startswith("ai_decisions/")]
    assert any(d.get("fallbackUsed") is True for d in logged)


async def test_flag_off_module_works_without_ai(client, user_store, monkeypatch):
    _patch_state(monkeypatch)
    user_store["platform_config/ai"] = {"modules": {"women_shg_readiness": False}}
    config_store.clear_cache()
    payload = await shg_readiness.get_shg_readiness("shg_off", force=True)
    assert payload["available"] is True
    assert payload["source"] == "fallback"
    assert payload["loanMarketplaceLink"] is not None  # readiness 1.0 >= threshold


async def test_loan_link_only_past_threshold(client, user_store, monkeypatch):
    _patch_state(monkeypatch)
    high = await shg_readiness.get_shg_readiness("shg_high", force=True)
    assert high["loanMarketplaceLink"] is not None

    _patch_state(monkeypatch, savings_streak_months=0, meeting_attendance_rate=0.0,
                 enterprise_income_entries_90d=0, record_keeping=False)
    low = await shg_readiness.get_shg_readiness("shg_low", force=True)
    assert low["readiness"] < shg_readiness.LOAN_READINESS_THRESHOLD
    assert low["loanMarketplaceLink"] is None


async def test_shg_dashboard_read_includes_readiness(client, user_store):
    from tests.test_diary import auth, seed_user

    token = seed_user(user_store, uid="uid-shg-1", active_profile="farmer")
    user_store["shg_groups/shg_1"] = {
        "id": "shg_1", "name": "Jai Kisan SHG", "memberUid": "uid-shg-1", "memberCount": 5,
    }
    resp = await client.get("/v1/women/shg", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["group"]["id"] == "shg_1"
    assert body["readiness"] is not None
    assert set(body["readiness"]["factors"]) == {
        "savings_regularity", "meeting_attendance", "enterprise_income", "record_keeping",
    }
