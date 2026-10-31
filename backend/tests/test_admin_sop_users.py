"""Phase 4 Automated Tests for Superadmin User Management Module (admin_sop_users).

Validates:
- User search with pagination, multi-persona filters, and datetime filtering.
- Recent entered user 1st sorting (descending createdAt).
- Unauthorized access rejection (non-admin / plain token returns 403 Forbidden).
- User suspension invalidates authentication tokens (Redis blacklist).
- User 360° summary schema validation.
- Impersonation token generation with scoped claims.
"""
from datetime import datetime, timedelta, timezone
import pytest
from pydantic import ValidationError
from app.models.user import User360DetailResponse


ADMIN_HEADERS = {"Authorization": "Bearer admin-token"}
PLAIN_HEADERS = {"Authorization": "Bearer plain-token"}


def seed_user(user_store, uid, phone="+919812345678", name="Test Farmer", role="farmer", created_at=None, status="active"):
    if not created_at:
        created_at = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": uid,
        "uid": uid,
        "name": name,
        "fullName": name,
        "phone": phone,
        "email": f"{uid}@example.com",
        "primaryProfile": role,
        "activeProfile": role,
        "linkedProfiles": [role],
        "status": status,
        "is_suspended": status in ("suspended", "banned"),
        "kycStatus": "VERIFIED",
        "createdAt": created_at,
        "created_at": created_at,
        "landAreaAcres": 5.5,
    }
    user_store[f"users/{uid}"] = user_doc
    return user_doc


# ---------------------------------------------------------------------------
# 1. Unauthorized Access Rejection (403 Forbidden)
# ---------------------------------------------------------------------------
async def test_unauthorized_access_rejected(client, user_store):
    """Non-admin callers must be rejected with 403 Forbidden."""
    resp = await client.get("/api/v1/admin/users", headers=PLAIN_HEADERS)
    assert resp.status_code == 403
    err_body = resp.json()
    code = (err_body.get("detail") or err_body.get("error", {})).get("code")
    assert code == "ADMIN_REQUIRED"

    resp_summary = await client.get("/api/v1/admin/users/any_user/summary", headers=PLAIN_HEADERS)
    assert resp_summary.status_code == 403


# ---------------------------------------------------------------------------
# 2. User Search, Multi-Persona Filters & Pagination
# ---------------------------------------------------------------------------
async def test_user_search_and_persona_filters(client, user_store):
    """Test user directory with search keyword and role persona filtering."""
    seed_user(user_store, "u1", name="Ramesh Pawar", phone="+919811111111", role="farmer")
    seed_user(user_store, "u2", name="Suresh Patil", phone="+919822222222", role="transporter")
    seed_user(user_store, "u3", name="Ganesh Deshmukh", phone="+919833333333", role="nursery")

    # Search by name query
    resp = await client.get("/api/v1/admin/users?q=Ramesh", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["users"][0]["id"] == "u1"

    # Filter by persona role
    resp_role = await client.get("/api/v1/admin/users?role=transporter", headers=ADMIN_HEADERS)
    assert resp_role.status_code == 200
    assert any(u["id"] == "u2" for u in resp_role.json()["users"])
    assert not any(u["id"] == "u1" for u in resp_role.json()["users"])

    # Pagination
    resp_paged = await client.get("/api/v1/admin/users?page=1&limit=2", headers=ADMIN_HEADERS)
    assert resp_paged.status_code == 200
    assert len(resp_paged.json()["users"]) <= 2


# ---------------------------------------------------------------------------
# 3. Datetime Filtering and Recent Entered User 1st Sorting
# ---------------------------------------------------------------------------
async def test_datetime_filtering_and_recent_entered_user_first(client, user_store):
    """Users must be sorted by default with the most recently entered user 1st.
    Datetime range filter must correctly filter by start_date and end_date.
    """
    now = datetime.now(timezone.utc)
    t_old = (now - timedelta(days=10)).isoformat()
    t_mid = (now - timedelta(days=3)).isoformat()
    t_recent = now.isoformat()

    seed_user(user_store, "u_old", name="Old User", created_at=t_old)
    seed_user(user_store, "u_mid", name="Mid User", created_at=t_mid)
    seed_user(user_store, "u_new", name="New User", created_at=t_recent)

    # Default sort: recent entered user 1st (descending createdAt)
    resp = await client.get("/api/v1/admin/users", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    users = resp.json()["users"]
    ids = [u["id"] for u in users]
    # u_new must appear before u_mid and u_old
    assert ids.index("u_new") < ids.index("u_mid")
    assert ids.index("u_mid") < ids.index("u_old")

    # Datetime range filter: only users registered between (now - 5d) and now
    start_filter = (now - timedelta(days=5)).isoformat()
    resp_date = await client.get(f"/api/v1/admin/users?start_date={start_filter}", headers=ADMIN_HEADERS)
    assert resp_date.status_code == 200
    filtered_ids = [u["id"] for u in resp_date.json()["users"]]
    assert "u_new" in filtered_ids
    assert "u_mid" in filtered_ids
    assert "u_old" not in filtered_ids


# ---------------------------------------------------------------------------
# 4. User 360° Summary Schema Validation
# ---------------------------------------------------------------------------
async def test_user_360_summary_schema_validation(client, user_store):
    """Summary endpoint must validate against User360DetailResponse schema."""
    seed_user(user_store, "u_sum_1", name="Kailash Sharma", role="farmer")

    resp = await client.get("/api/v1/admin/users/u_sum_1/summary", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()

    # Pydantic schema validation
    validated = User360DetailResponse.model_validate(body)
    assert validated.id == "u_sum_1"
    assert validated.status == "ACTIVE"
    assert len(validated.personas) >= 1
    assert validated.content_summary is not None
    assert isinstance(validated.recent_activities, list)


# ---------------------------------------------------------------------------
# 5. User Suspension Invalidates Authentication Tokens
# ---------------------------------------------------------------------------
async def test_user_suspension_invalidates_tokens(client, user_store, fake_redis):
    """Suspending a user updates their status and writes a blacklist entry in Redis."""
    seed_user(user_store, "u_gov_1", status="active")

    resp = await client.post(
        "/api/v1/admin/users/u_gov_1/status",
        json={"status": "SUSPENDED", "reason": "Policy violation"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "SUSPENDED"
    assert data["is_suspended"] is True

    # User in store must now be suspended
    updated_user = user_store["users/u_gov_1"]
    assert updated_user["status"] == "suspended"
    assert updated_user["is_suspended"] is True

    # Redis blacklist check
    blacklisted = await fake_redis.get("token_blacklist:user:u_gov_1")
    assert blacklisted == "revoked"


# ---------------------------------------------------------------------------
# 6. User Impersonation Token Generation
# ---------------------------------------------------------------------------
async def test_user_impersonation(client, user_store):
    """Admin impersonation generates a scoped JWT token with impersonated_by."""
    seed_user(user_store, "u_imp_1")

    resp = await client.post("/api/v1/admin/users/u_imp_1/impersonate", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "token" in body
    assert body["userId"] == "u_imp_1"
    assert body["expiresIn"] == 900
