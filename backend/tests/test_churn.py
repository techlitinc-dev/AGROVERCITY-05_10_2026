"""M28 churn re-engagement tests (phase-08 WS-01).

Covers: only users dormant >= 7 days are scored; a high-risk dormant user emits
exactly one re-engagement task; the module flag off sends nothing; quiet hours
hold the push.
"""
from datetime import datetime, timezone

import pytest

from app.core.config import settings
from app.services import churn
from app.services.ai import config_store
from tests.test_diary import seed_user

NOW = datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _tasks(user_store):
    return [d for k, d in user_store.items() if k.startswith("tasks/")]


def _seed_activity(user_store):
    seed_user(user_store, uid="uid-active", lastActiveAt="2026-10-05T12:00:00+00:00")
    seed_user(user_store, uid="uid-mid", lastActiveAt="2026-09-28T12:00:00+00:00")
    seed_user(user_store, uid="uid-verydormant", lastActiveAt="2026-09-08T12:00:00+00:00")


async def test_only_dormant_scored_and_one_task(client, user_store):
    _seed_activity(user_store)
    result = await churn.score_dormant_users(now=NOW)
    # 3-day user never scored; 10-day + 30-day scored; only the 30-day emits.
    assert result["scored"] == 2
    assert result["emitted"] == 1
    tasks = _tasks(user_store)
    assert len(tasks) == 1
    assert tasks[0]["userId"] == "uid-verydormant"
    assert tasks[0]["module"] == "retention"
    assert tasks[0]["kind"] == "churn_reengagement"


async def test_flag_off_sends_nothing(client, user_store):
    _seed_activity(user_store)
    user_store["platform_config/ai"] = {"modules": {"churn_signal": False}}
    config_store.clear_cache()
    result = await churn.score_dormant_users(now=NOW)
    assert result["flagOff"] is True
    assert result["scored"] == 0
    assert result["emitted"] == 0
    assert _tasks(user_store) == []


async def test_quiet_hours_hold_push(client, user_store, monkeypatch):
    from app.services import notify

    seed_user(user_store, uid="uid-quiet")
    pushed = {"called": 0}

    async def fake_push(*args, **kwargs):
        pushed["called"] += 1

    quiet_local = datetime(2026, 10, 8, 23, 0)  # 23:00 local — inside 21:00–06:30
    monkeypatch.setattr("app.services.notify.push_to_tokens", fake_push)
    monkeypatch.setattr("app.services.notify.user_local_now", lambda user, now=None: quiet_local)
    monkeypatch.setattr(settings, "ai_provider", "shim")

    await notify.notify_user("uid-quiet", type="churn_reengagement", title="t", body="b")
    assert pushed["called"] == 0
    digests = [k for k in user_store if k.startswith("notifications_digest/")]
    assert digests


async def test_return_within_72h_records_outcome(client, user_store):
    seed_user(user_store, uid="uid-ret")
    user_store["ai_decisions/dec_churn1"] = {
        "id": "dec_churn1", "questionSetId": "churn.signal.v1", "module": "churn_signal",
    }
    user_store["churn_touch/uid-ret"] = {
        "uid": "uid-ret", "decisionId": "dec_churn1",
        "at": datetime(2026, 10, 8, 10, 0, tzinfo=timezone.utc).isoformat(),
    }
    recorded = await churn.record_return("uid-ret", now=datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc))
    assert recorded == "dec_churn1"
    assert "ai_outcomes/dec_churn1" in user_store


async def test_return_after_72h_not_recorded(client, user_store):
    seed_user(user_store, uid="uid-ret2")
    user_store["ai_decisions/dec_churn2"] = {"id": "dec_churn2", "questionSetId": "churn.signal.v1"}
    user_store["churn_touch/uid-ret2"] = {
        "uid": "uid-ret2", "decisionId": "dec_churn2",
        "at": datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc).isoformat(),
    }
    recorded = await churn.record_return("uid-ret2", now=datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc))
    assert recorded is None
    assert "ai_outcomes/dec_churn2" not in user_store
