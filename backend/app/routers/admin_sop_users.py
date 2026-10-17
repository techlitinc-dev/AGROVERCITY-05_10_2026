"""Superadmin SOP router — user auth status, profile/personas, farm map (SOP-01/02).

Implements the doc-01/doc-02 console contract:
  PUT /admin/auth/users/{uid}/status  — force account status (active/suspended/locked)
  GET /admin/users/{uid}              — full profile + linked personas + role profiles
  PUT /admin/users/{uid}/personas     — add/remove linked personas (+ roleProfiles data)
  GET /admin/users/{uid}/farm-map     — farm boundary polygon + related land plots
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, ValidationError

from app.core.db import delete_doc, get_doc, query, set_doc
from app.models.role_profiles import ROLE_PROFILE_MODELS
from app.models.user import VALID_PROFILES
from app.services.admin_auth import admin_mutation_context, current_admin_user
from app.services.audit import log_admin_action
from app.services.users import get_user

router = APIRouter(prefix="/admin", tags=["admin"])

# SOP-01 contract says "active/suspended/locked"; the legacy POST
# /admin/users/{uid}/status endpoint also accepts "banned" — accept the union.
ALLOWED_STATUSES = frozenset({"active", "suspended", "locked", "banned"})


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _role_profiles_for(uid: str, linked: list) -> dict:
    """Role-profile subcollection docs for each linked persona (SOP-02)."""
    profiles = {}
    for ptype in linked:
        doc = await get_doc(f"users/{uid}/role_profiles", ptype)
        if doc is not None:
            profiles[ptype] = doc
    return profiles


class UserStatusIn(BaseModel):
    status: str = Field(..., description="active | suspended | locked | banned")


async def _set_user_status(uid: str, status: str, ctx: dict):
    """Shared force-status writer for the doc-01 and doc-02 console paths."""
    if status not in ALLOWED_STATUSES:
        _error(422, "INVALID_STATUS", "status must be one of active, suspended, locked, banned")
    target = await get_user(uid)
    if not target:
        _error(404, "NOT_FOUND", "target user not found")
    previous_status = target.get("status", "active")
    if previous_status == status:
        _error(409, "STATUS_ALREADY_SET", f"account is already '{status}'")

    admin = ctx["admin"]
    target["status"] = status
    target["statusReason"] = ctx["reason"]
    target["statusUpdatedAt"] = datetime.now(timezone.utc).isoformat()
    target["statusUpdatedBy"] = admin.get("id") or admin.get("uid")
    await set_doc("users", uid, target)

    await log_admin_action(
        admin,
        "users",
        "UPDATE_USER_STATUS",
        uid,
        {"status": previous_status},
        {"status": status, "reason": ctx["reason"]},
        ctx["reason"],
        ctx["ip"],
    )
    return {"success": True, "targetUid": uid, "status": status, "previousStatus": previous_status}


@router.put("/auth/users/{uid}/status")
async def update_auth_user_status(
    uid: str,
    body: UserStatusIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Admin force account status update (SOP-01). Same logic as the legacy
    POST /admin/users/{uid}/status endpoint, exposed at the doc-01 path."""
    return await _set_user_status(uid, body.status, ctx)


@router.put("/users/{uid}/status")
async def update_user_status_sop(
    uid: str,
    body: UserStatusIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Set user account status (SOP-02 doc path; same writer as SOP-01)."""
    return await _set_user_status(uid, body.status, ctx)


# ===========================================================================
# P2-25: User roster export (SOP-02 §3) — must precede /users/{uid}
# ===========================================================================
@router.get("/users/export")
async def export_user_roster(
    format: str = Query("json", description="json or csv"),
    profile: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: dict = Depends(current_admin_user),
):
    """P2-25 (SOP-02 §3): Export user roster for state agriculture department audits."""
    users = await query("users", None, limit=5000)
    if profile:
        users = [u for u in users if profile in (u.get("profiles") or []) or u.get("activeProfile") == profile]
    if status:
        users = [u for u in users if u.get("status") == status]

    rows = []
    for u in users:
        rows.append({
            "uid": u.get("id"),
            "name": u.get("fullName") or u.get("name") or "",
            "phone": u.get("phone") or "",
            "primaryProfile": u.get("primaryProfile") or "farmer",
            "state": u.get("state") or "",
            "district": u.get("district") or "",
            "village": u.get("village") or "",
            "landAreaAcres": u.get("landAreaAcres") or 0.0,
            "status": u.get("status") or "active",
            "createdAt": u.get("createdAt") or "",
        })

    if format.lower() == "csv":
        import io, csv
        out = io.StringIO()
        if rows:
            writer = csv.DictWriter(out, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        return Response(
            content=out.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="user_roster_audit.csv"'},
        )
    return {"users": rows, "total": len(rows), "generatedAt": datetime.now(timezone.utc).isoformat()}


@router.get("/users/{uid}")
async def get_user_details(uid: str, user: dict = Depends(current_admin_user)):
    """Full profile details + linked personas + role profile subcollection data (SOP-02)."""
    target = await get_user(uid)
    if not target:
        _error(404, "NOT_FOUND", "user not found")
    linked = target.get("linkedProfiles", [])
    return {
        "profile": target,
        "linkedProfiles": linked,
        "primaryProfile": target.get("primaryProfile"),
        "activeProfile": target.get("activeProfile"),
        "roleProfiles": await _role_profiles_for(uid, linked),
    }


class PersonasManageIn(BaseModel):
    add: list[str] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)
    roleProfiles: Optional[dict[str, dict]] = None


@router.put("/users/{uid}/personas")
async def manage_user_personas(
    uid: str,
    body: PersonasManageIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Add/remove linked personas and upsert their role profile docs (SOP-02).

    Mirrors the platform's own persona_setup / link_profile / unlink_profile
    semantics: persona names validated against VALID_PROFILES, role profile
    payloads validated against ROLE_PROFILE_MODELS, at least one persona must
    stay linked, and primary/active profiles are re-pointed when removed.
    Unlinking a persona also drops its role_profiles subcollection doc so the
    subcollection stays consistent with linkedProfiles.
    """
    target = await get_user(uid)
    if not target:
        _error(404, "NOT_FOUND", "user not found")

    for ptype in body.add + body.remove:
        if ptype not in VALID_PROFILES:
            _error(422, "INVALID_PROFILE_TYPE", f"unknown profile type: {ptype}")
    overlap = set(body.add) & set(body.remove)
    if overlap:
        _error(422, "INVALID_PROFILE_TYPE", f"cannot add and remove the same persona: {sorted(overlap)}")

    linked = list(target.get("linkedProfiles", []))
    previous = {
        "linkedProfiles": linked,
        "primaryProfile": target.get("primaryProfile"),
        "activeProfile": target.get("activeProfile"),
    }

    for ptype in body.add:
        if ptype in linked:
            _error(409, "PROFILE_ALREADY_LINKED", f"{ptype} is already linked")
        linked.append(ptype)

    removed: list[str] = []
    for ptype in body.remove:
        if ptype not in linked:
            _error(404, "PROFILE_NOT_LINKED", f"{ptype} is not linked")
        if len(linked) == 1:
            _error(409, "LAST_PROFILE", "at least one persona must remain linked")
        linked.remove(ptype)
        removed.append(ptype)
        await delete_doc(f"users/{uid}/role_profiles", ptype)

    target["linkedProfiles"] = linked
    if target.get("activeProfile") in removed:
        primary = target.get("primaryProfile")
        target["activeProfile"] = primary if primary in linked else (linked[0] if linked else "")
    if target.get("primaryProfile") in removed:
        target["primaryProfile"] = linked[0] if linked else ""

    variants = {}
    for ptype, raw in (body.roleProfiles or {}).items():
        if ptype not in linked:
            _error(422, "INVALID_ROLE_PROFILE", f"{ptype} must be linked before saving its role profile")
        model = ROLE_PROFILE_MODELS.get(ptype)
        if model is None:
            _error(422, "INVALID_ROLE_PROFILE", f"no role profile model for {ptype}")
        try:
            variants[ptype] = model(**raw)
        except ValidationError:
            _error(422, "INVALID_ROLE_PROFILE", f"role profile fields are invalid for {ptype}")

    await set_doc("users", uid, target)
    now = datetime.now(timezone.utc).isoformat()
    for ptype, variant in variants.items():
        await set_doc(f"users/{uid}/role_profiles", ptype, {**variant.model_dump(), "createdAt": now})

    await log_admin_action(
        ctx["admin"],
        "users",
        "MANAGE_PERSONAS",
        uid,
        previous,
        {
            "linkedProfiles": linked,
            "primaryProfile": target.get("primaryProfile"),
            "activeProfile": target.get("activeProfile"),
        },
        ctx["reason"],
        ctx["ip"],
    )

    return {
        "success": True,
        "uid": uid,
        "linkedProfiles": linked,
        "primaryProfile": target.get("primaryProfile"),
        "activeProfile": target.get("activeProfile"),
        "roleProfiles": await _role_profiles_for(uid, linked),
    }


@router.get("/users/{uid}/farm-map")
async def get_user_farm_map(uid: str, user: dict = Depends(current_admin_user)):
    """Farm boundary polygon coordinates + related land plots for the user (SOP-02)."""
    target = await get_user(uid)
    if not target:
        _error(404, "NOT_FOUND", "user not found")
    plots = await query(f"users/{uid}/land_plots", [], limit=1000)
    return {
        "uid": uid,
        "farmBoundary": {
            "polygon": target.get("farmBoundaryPoints") or [],
            "landAreaAcres": target.get("landAreaAcres"),
            "khasraNumber": target.get("khasraNumber"),
        },
        "plots": plots,
        "landRecords": target.get("landRecords") or [],
    }


# ===========================================================================
# P1-37: 2FA/MPIN enforcement wiring (SOP-01 §3)
# ===========================================================================

class SecurityPolicyIn(BaseModel):
    enforceMpin: Optional[bool] = None
    enforce2fa: Optional[bool] = None
    sessionTtlHours: Optional[int] = Field(default=None, ge=1, le=720)
    maxFailedMpinAttempts: Optional[int] = Field(default=None, ge=3, le=10)
    lockoutDurationMinutes: Optional[int] = Field(default=None, ge=5, le=1440)


@router.get("/auth/security-policy")
async def get_security_policy(user: dict = Depends(current_admin_user)):
    """P1-37 (SOP-01 §3): Read platform authentication security policy flags."""
    policy = await get_doc("app_config", "security_policy")
    if not policy:
        policy = {
            "id": "security_policy",
            "enforceMpin": True,
            "enforce2fa": False,
            "sessionTtlHours": 168,
            "maxFailedMpinAttempts": 5,
            "lockoutDurationMinutes": 30,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
    return policy


@router.put("/auth/security-policy")
async def update_security_policy(
    body: SecurityPolicyIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """P1-37 (SOP-01 §3): Update platform authentication security policy flags."""
    existing = await get_doc("app_config", "security_policy") or {}
    now = datetime.now(timezone.utc).isoformat()
    new_policy = {
        **existing,
        **body.model_dump(exclude_none=True),
        "id": "security_policy",
        "updatedAt": now,
        "updatedBy": ctx["admin"].get("id"),
    }
    await set_doc("app_config", "security_policy", new_policy)
    app_cfg = await get_doc("app_config", "current") or {}
    ff = app_cfg.setdefault("featureFlags", {})
    if body.enforceMpin is not None:
        ff["enforceMpin"] = body.enforceMpin
    if body.enforce2fa is not None:
        ff["enforce2fa"] = body.enforce2fa
    app_cfg["updatedAt"] = now
    await set_doc("app_config", "current", app_cfg)

    await log_admin_action(
        ctx["admin"], "auth", "UPDATE_SECURITY_POLICY", "security_policy",
        existing, new_policy, ctx["reason"], ctx["ip"],
    )
    return new_policy
