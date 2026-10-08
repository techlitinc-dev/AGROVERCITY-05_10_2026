"""Phase-07 WS-08 — weekly calibration aggregates + AI config governance."""
from app.services.ai.calibration import iso_week_id, run_weekly_calibration
from app.services.tokens import create_access_token
from tests.test_admin import _seed_admin, admin_headers
from tests.test_diary import auth


def _seed_decisions(user_store, outcomes_ok: bool):
    user_store["ai_decisions/d1"] = {
        "module": "kyc_risk",
        "questionSetId": "kyc.authenticity_risk.v1",
        "confidence": 0.9,
        "costUsd": 0.01,
        "fallbackUsed": False,
        "outcome": outcomes_ok,
    }
    user_store["ai_decisions/d2"] = {
        "module": "kyc_risk",
        "questionSetId": "kyc.authenticity_risk.v1",
        "confidence": 0.5,
        "costUsd": 0.02,
        "fallbackUsed": True,
        "outcome": False,
    }


async def test_calibration_aggregates_all_families(client, user_store):
    _seed_decisions(user_store, outcomes_ok=True)
    doc = await run_weekly_calibration()
    metric = doc["metrics"]["kyc.authenticity_risk.v1"]
    assert metric["sampleCount"] == 2
    assert metric["fallbackRate"] == 0.5
    assert metric["costPerModule"] == 0.03
    assert metric["accuracy"] == 0.5
    assert metric["confidenceBucketReliability"]


async def test_regression_alert_fires(client, user_store):
    _seed_decisions(user_store, outcomes_ok=False)
    prev_week = iso_week_id(1)
    user_store[f"ai_calibration/weekly-{prev_week}"] = {
        "week": prev_week,
        "metrics": {"kyc.authenticity_risk.v1": {"accuracy": 0.9}},
    }
    doc = await run_weekly_calibration()
    assert doc["metrics"]["kyc.authenticity_risk.v1"]["regressionAlert"] is True


def _second_admin(user_store):
    user_store["users/uid-admin2"] = {
        "id": "uid-admin2", "isAdmin": True, "adminRole": "finance_admin", "activeProfile": "admin",
    }
    return create_access_token("uid-admin2")


async def test_ai_config_governance(client, user_store):
    admin_token = _seed_admin(user_store)

    # (a) credit decision set to `auto` → 422
    resp = await client.put(
        "/v1/admin/platform-config/ai",
        json={"config": {"automation": {"loans.prescreen.v1": "auto"}}},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "AI_AUTOMATION_LEVEL_FORBIDDEN"

    # (b) valid threshold edit → pending approval; applies only after a second admin
    resp = await client.put(
        "/v1/admin/platform-config/ai",
        json={"config": {"thresholds": {"kyc.authenticity_risk.v1": 0.4}}},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["requiresApproval"] is True
    approval_id = resp.json()["approval"]["id"]

    resp = await client.get("/v1/admin/platform-config/ai", headers=admin_headers(admin_token))
    assert (resp.json().get("thresholds") or {}).get("kyc.authenticity_risk.v1") != 0.4

    second = _second_admin(user_store)
    resp = await client.post(
        f"/v1/admin/approvals/{approval_id}/approve",
        headers={**auth(second), "X-Audit-Reason": "approve threshold", "X-Admin-Role": "finance_admin"},
    )
    assert resp.status_code == 200

    resp = await client.get("/v1/admin/platform-config/ai", headers=admin_headers(admin_token))
    assert resp.json()["thresholds"]["kyc.authenticity_risk.v1"] == 0.4

    # (c) audit carries previous + new state
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("module") == "ai-config" and a.get("previousState") and a.get("newState") for a in audits)
