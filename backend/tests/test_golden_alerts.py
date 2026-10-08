"""Golden regression alerting tests (phase-08 WS-02 task 2.8).

Forces a >5pt accuracy regression and asserts both the Sentry call and the
banner flag the admin AI Health page reads.
"""
import pytest

from app.services.ai import config_store, golden_alerts
from tests.test_admin import _seed_admin, admin_headers


@pytest.fixture(autouse=True)
def _clear_cache():
    config_store.clear_cache()
    yield
    config_store.clear_cache()


async def test_regression_fires_sentry_and_sets_banner(client, user_store, monkeypatch):
    captured = []

    def fake_capture(message, level=None):
        captured.append((message, level))

    monkeypatch.setattr("sentry_sdk.capture_message", fake_capture)

    # Baseline 0.95, now 0.80 → a 15pt drop (> 5pt).
    user_store["ai_golden_baselines/women.shg_readiness.v1"] = {
        "questionSetId": "women.shg_readiness.v1", "accuracy": 0.95,
    }
    alert = await golden_alerts.record_golden_accuracy("women.shg_readiness.v1", 0.80)
    assert alert is True
    assert captured and "regression" in captured[0][0].lower()

    banner = user_store["ai_golden_banner/current"]
    assert banner["regressionAlert"] is True

    token = _seed_admin(user_store)
    resp = await client.get("/v1/admin/ai/health", headers=admin_headers(token))
    assert resp.status_code == 200
    assert resp.json()["banner"]["regressionAlert"] is True


async def test_no_alert_within_threshold(client, user_store, monkeypatch):
    captured = []
    monkeypatch.setattr("sentry_sdk.capture_message", lambda *a, **k: captured.append(a))
    user_store["ai_golden_baselines/seller.rate_check.v1"] = {
        "questionSetId": "seller.rate_check.v1", "accuracy": 0.90,
    }
    alert = await golden_alerts.record_golden_accuracy("seller.rate_check.v1", 0.87)
    assert alert is False
    assert captured == []


async def test_full_golden_suite_runs(client, user_store):
    result = await golden_alerts.run_golden_suite()
    assert result["scored"] > 0
