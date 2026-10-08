"""Phase-G automation-raise gate tests (phase-08 WS-02).

Covers: a `suggest → require_confirm` raise with <1,000 outcomes is refused; a
raise with ≥1,000 outcomes + >90% top-bucket accuracy plus maker-checker approval
succeeds and writes an audit entry; `auto` is rejected for credit/insurance sets
even with full evidence.
"""
import pytest

from app.services.ai import config_store
from app.services.tokens import create_access_token
from tests.test_admin import _seed_admin, admin_headers
from tests.test_diary import auth

QS = "seller.rate_check.v1"


@pytest.fixture(autouse=True)
def _clear_cache():
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _seed_evidence(user_store, question_set_id=QS, reliability=0.95):
    for i in range(1000):
        user_store[f"ai_outcomes/o{i}"] = {"questionSetId": question_set_id, "outcome": "ok"}
    user_store["ai_calibration/weekly-2026-W40"] = {
        "week": "2026-W40",
        "metrics": {question_set_id: {"confidenceBucketReliability": {"0.8-1.0": reliability}}},
    }


def _second_admin(user_store):
    user_store["users/uid-admin2"] = {
        "id": "uid-admin2", "isAdmin": True, "adminRole": "finance_admin", "activeProfile": "admin",
    }
    return create_access_token("uid-admin2")


async def test_raise_without_evidence_refused(client, user_store):
    token = _seed_admin(user_store)
    resp = await client.put(
        "/v1/admin/platform-config/ai",
        json={"config": {"automation": {QS: "require_confirm"}}},
        headers=admin_headers(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "PHASE_G_INSUFFICIENT_OUTCOMES"


async def test_raise_with_evidence_and_maker_checker_succeeds(client, user_store):
    token = _seed_admin(user_store)
    _seed_evidence(user_store)

    resp = await client.put(
        "/v1/admin/platform-config/ai",
        json={"config": {"automation": {QS: "require_confirm"}}},
        headers=admin_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["requiresApproval"] is True
    approval_id = resp.json()["approval"]["id"]

    # First admin's edit is NOT applied until a second admin approves.
    resp = await client.get("/v1/admin/platform-config/ai", headers=admin_headers(token))
    assert (resp.json().get("automation") or {}).get(QS) != "require_confirm"

    second = _second_admin(user_store)
    resp = await client.post(
        f"/v1/admin/approvals/{approval_id}/approve",
        headers={**auth(second), "X-Audit-Reason": "approve raise", "X-Admin-Role": "finance_admin"},
    )
    assert resp.status_code == 200

    resp = await client.get("/v1/admin/platform-config/ai", headers=admin_headers(token))
    assert resp.json()["automation"][QS] == "require_confirm"
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert audits


async def test_auto_rejected_for_credit_and_insurance(client, user_store):
    token = _seed_admin(user_store)
    _seed_evidence(user_store, "loans.prescreen.v1")
    _seed_evidence(user_store, "insurance.triage.v1")

    for qs in ("loans.prescreen.v1", "insurance.triage.v1"):
        resp = await client.put(
            "/v1/admin/platform-config/ai",
            json={"config": {"automation": {qs: "auto"}}},
            headers=admin_headers(token),
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "AI_AUTOMATION_LEVEL_FORBIDDEN"


async def test_capped_sets_never_offer_auto(client, user_store):
    token = _seed_admin(user_store)
    resp = await client.get("/v1/admin/platform-config/ai", headers=admin_headers(token))
    assert resp.status_code == 200
    capped = resp.json()["cappedSets"]
    assert "loans.prescreen.v1" in capped and "insurance.triage.v1" in capped
