"""Admin authentication + RBAC (phase-07 WS-01).

The `/admin/*` console authenticates with either the backend access JWT (all app
users) or the Firebase admin ID token (console sign-in, phase-00). Whatever the
transport, the resolved admin role comes from the user's admin profile
(`user["adminRole"]`) — falling back to the Firebase `role` claim — and is
enforced server-side per module via `require_admin_role`.
"""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request

import firebase_admin.auth as firebase_auth

from app.services.tokens import decode_token
from app.services.users import get_user

ADMIN_ROLES = frozenset(
    {
        "superadmin",
        "compliance_officer",
        "finance_admin",
        "agronomist",
        "scientist",
        "operations_lead",
        "content_moderator",
    }
)

# `scientist` is an alias of `agronomist` — both are valid tier values and grant
# the same module access.
ROLE_ALIASES = {"scientist": "agronomist"}


def _normalize_role(role: str | None) -> str | None:
    if role is None:
        return None
    return ROLE_ALIASES.get(role, role)


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def resolve_admin_role(user: dict) -> str | None:
    """Return the admin tier stored on the user's admin profile, else None."""
    return user.get("adminRole")


def _claims_from_token(token: str) -> dict:
    """Resolve claims from either a backend access JWT or a Firebase ID token."""
    try:
        return {"uid": decode_token(token, "access"), "admin": None, "role": None}
    except HTTPException:
        pass
    try:
        claims = firebase_auth.verify_id_token(token, check_revoked=True)
        return {
            "uid": claims.get("uid"),
            "admin": claims.get("admin"),
            "role": claims.get("role"),
        }
    except Exception:  # noqa: BLE001 — any invalid token is a 401
        _error(401, "INVALID_TOKEN", "invalid or expired token")


async def current_admin_user(authorization: str | None = Header(None)) -> dict:
    """Resolve the calling admin. 401 on a bad token, 403 when the caller is not
    an admin. The resolved `adminRole` is written back onto the user dict."""
    if not authorization or not authorization.startswith("Bearer "):
        _error(401, "MISSING_TOKEN", "missing or malformed Authorization header")
    claims = _claims_from_token(authorization[len("Bearer "):])
    uid = claims.get("uid")
    if not uid:
        _error(401, "INVALID_TOKEN", "invalid or expired token")

    user = await get_user(uid)
    if user is None:
        if claims.get("admin") is True:
            user = {"id": uid, "isAdmin": True}
        else:
            _error(403, "ADMIN_REQUIRED", "admin access required")

    role = resolve_admin_role(user) or (claims.get("role") if claims.get("admin") else None)
    is_admin = bool(
        user.get("isAdmin")
        or user.get("activeProfile") == "admin"
        or claims.get("admin") is True
        or _normalize_role(role) in ADMIN_ROLES
    )
    if not is_admin:
        _error(403, "ADMIN_REQUIRED", "admin access required")

    user["adminRole"] = role or "superadmin"
    return user


def require_admin_role(*roles: str):
    """Dependency factory: restrict an endpoint to the given admin tiers.
    `superadmin` is always allowed; `scientist` and `agronomist` are aliases."""

    allowed = {_normalize_role(r) for r in roles} | {"superadmin"}

    async def dep(user: dict = Depends(current_admin_user)) -> dict:
        role = _normalize_role(user.get("adminRole"))
        if role not in allowed:
            _error(
                403,
                "FORBIDDEN_ADMIN_ROLE",
                "your admin role is not permitted for this module",
            )
        return user

    return dep


async def admin_context(
    request: Request,
    user: dict = Depends(current_admin_user),
    x_admin_role: str | None = Header(None, alias="X-Admin-Role"),
) -> dict:
    """Read-only admin context: optionally validates the `X-Admin-Role` header
    against the server-resolved role."""
    if x_admin_role is not None and x_admin_role != user.get("adminRole"):
        _error(403, "FORBIDDEN_ADMIN_ROLE", "X-Admin-Role does not match your role")
    return {
        "admin": user,
        "role": user.get("adminRole"),
        "reason": None,
        "ip": request.client.host if request.client else None,
    }


async def admin_mutation_context(
    request: Request,
    user: dict = Depends(current_admin_user),
    x_admin_role: str | None = Header(None, alias="X-Admin-Role"),
    x_audit_reason: str = Header(..., min_length=3, alias="X-Audit-Reason"),
) -> dict:
    """Mutating admin context: `X-Audit-Reason` (min 3 chars) is mandatory — a
    missing or too-short reason yields FastAPI's automatic 422."""
    if x_admin_role is not None and x_admin_role != user.get("adminRole"):
        _error(403, "FORBIDDEN_ADMIN_ROLE", "X-Admin-Role does not match your role")
    return {
        "admin": user,
        "role": user.get("adminRole"),
        "reason": x_audit_reason,
        "ip": request.client.host if request.client else None,
    }
