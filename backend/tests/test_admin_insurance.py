"""Phase-07 WS-05 — insurance rate effective-dating + penny-drop override."""
from app.services.tokens import create_access_token
from tests.test_admin import _seed_admin, admin_headers
from tests.test_diary import auth


def _second_admin(user_store):
    user_store["users/uid-admin2"] = {
        "id": "uid-admin2", "isAdmin": True, "adminRole": "finance_admin", "activeProfile": "admin",
    }
    return create_access_token("uid-admin2")


async def test_rate_overlap_and_effective_dating(client, user_store):
    admin_token = _seed_admin(user_store)
    user_store["insurance_rates/r0"] = {
        "id": "r0", "product": "PMFBY-Wheat", "rate": 2.0,
        "effectiveFrom": "2026-01-01", "effectiveTo": None, "createdBy": "seed",
    }
    # identical start date → overlap
    resp = await client.post(
        "/v1/admin/insurance/rates",
        json={"product": "PMFBY-Wheat", "rate": 2.5, "effectiveFrom": "2026-01-01"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "RATE_PERIOD_OVERLAP"

    # later start → maker-checker, then applies + closes the prior row
    resp = await client.post(
        "/v1/admin/insurance/rates",
        json={"product": "PMFBY-Wheat", "rate": 2.5, "effectiveFrom": "2026-06-01"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["requiresApproval"] is True
    approval_id = resp.json()["approval"]["id"]

    second = _second_admin(user_store)
    resp = await client.post(
        f"/v1/admin/approvals/{approval_id}/approve",
        headers={**auth(second), "X-Audit-Reason": "approve rate", "X-Admin-Role": "finance_admin"},
    )
    assert resp.status_code == 200
    assert user_store["insurance_rates/r0"]["effectiveTo"] == "2026-06-01"
    new_rows = [
        d for k, d in user_store.items()
        if k.startswith("insurance_rates/") and d.get("effectiveFrom") == "2026-06-01"
    ]
    assert new_rows and new_rows[0]["createdBy"]


async def test_penny_drop_override_writes_full_audit(client, user_store):
    admin_token = _seed_admin(user_store)
    user_store["bank_accounts/ba1"] = {"id": "ba1", "verifyStatus": "failed", "userId": "uid-1"}
    resp = await client.post(
        "/v1/admin/finance/bank-accounts/ba1/override-verify",
        json={},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 200
    assert user_store["bank_accounts/ba1"]["verifyStatus"] == "verified"
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("module") == "banking" and a.get("previousState") and a.get("newState") for a in audits)
