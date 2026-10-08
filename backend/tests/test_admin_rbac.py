"""Phase-07 WS-01 — admin RBAC tier matrix, audit reason/role headers, and the
maker-checker approval flow."""
from app.services import approvals
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user

CANONICAL_TIERS = (
    "superadmin",
    "compliance_officer",
    "finance_admin",
    "agronomist",
    "operations_lead",
    "content_moderator",
)


def _seed_role_admin(user_store, uid, role):
    """Seed an admin user doc with the given tier and return an access token."""
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": f"Admin {role}",
        "phone": "+919800000000",
        "linkedProfiles": ["farmer"],
        "primaryProfile": "farmer",
        "activeProfile": "admin",
        "isAdmin": True,
        "adminRole": role,
        "mpinHash": None,
        "email": f"{role}@agro.test",
    }
    return create_access_token(uid)


async def test_each_canonical_tier_reaches_overview(client, user_store):
    for role in CANONICAL_TIERS:
        token = _seed_role_admin(user_store, f"uid-{role}", role)
        resp = await client.get("/v1/admin/overview", headers=auth(token))
        assert resp.status_code == 200, (role, resp.status_code, resp.text)
        assert resp.json()["platformHealth"] == "100% Operational"


async def test_non_admin_is_forbidden(client, user_store):
    token = seed_user(user_store, uid="u-not-admin")
    resp = await client.get("/v1/admin/overview", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ADMIN_REQUIRED"


async def test_bogus_role_forbidden_on_superadmin_guard(client, user_store):
    token = _seed_role_admin(user_store, "uid-bogus", "not-a-real-role")
    resp = await client.get("/v1/admin/platform-config/ai", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ADMIN_ROLE"


async def test_audit_reason_and_role_header_enforcement(client, user_store):
    token = _seed_role_admin(user_store, "uid-ops", "operations_lead")
    seed_user(user_store, uid="u-target")
    url = "/v1/admin/users/u-target/status"
    body = {"status": "suspended", "reason": "policy violation"}

    # (a) missing X-Audit-Reason → 422
    resp = await client.post(url, json=body, headers=auth(token))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    # (b) too-short reason (length 1) → 422
    resp = await client.post(url, json=body, headers={**auth(token), "X-Audit-Reason": "x"})
    assert resp.status_code == 422

    # (c) valid reason → 200
    resp = await client.post(
        url, json=body, headers={**auth(token), "X-Audit-Reason": "valid reason"}
    )
    assert resp.status_code == 200

    # (d) X-Admin-Role that does not match the caller's role → 403
    resp = await client.post(
        url,
        json=body,
        headers={**auth(token), "X-Audit-Reason": "valid reason", "X-Admin-Role": "finance_admin"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ADMIN_ROLE"

    # (e) the audit trail records the change with module + reason + adminId
    resp = await client.get("/v1/admin/audit?targetId=u-target", headers=auth(token))
    assert resp.status_code == 200
    entries = resp.json()["data"]
    assert any(
        e.get("module") == "users" and e.get("reason") and e.get("adminId") for e in entries
    )


async def test_maker_checker_approval_flow(client, user_store):
    admin = {"id": "uid-maker", "adminRole": "finance_admin"}
    doc = await approvals.maybe_require_approval(
        admin, "settlements", "mark-paid", {"amountPaise": 2_000_000, "targetId": "st_1"}, "big payout"
    )
    assert doc is not None
    assert doc["status"] == "pending"

    maker_token = _seed_role_admin(user_store, "uid-maker", "finance_admin")
    resp = await client.post(
        f"/v1/admin/approvals/{doc['id']}/approve",
        headers={**auth(maker_token), "X-Audit-Reason": "self approval attempt"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "SELF_APPROVAL_FORBIDDEN"

    second_token = _seed_role_admin(user_store, "uid-second", "finance_admin")
    resp = await client.post(
        f"/v1/admin/approvals/{doc['id']}/approve",
        headers={**auth(second_token), "X-Audit-Reason": "reviewed and approved"},
    )
    assert resp.status_code == 200
    assert resp.json()["approval"]["status"] == "approved"

    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("action") == "approval.requested" for a in audits)
    assert any(a.get("action") == "approval.approved" for a in audits)

    # below the ₹10,000 threshold → no approval required
    assert (
        await approvals.maybe_require_approval(
            admin, "settlements", "mark-paid", {"amountPaise": 500_000}, "small"
        )
        is None
    )
