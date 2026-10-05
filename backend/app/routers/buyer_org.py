from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc, set_doc
from app.core.deps import current_user_id
from app.services import idempotency
from app.services.billing import require_entitlement
from app.services.buyer_org import find_user_by_phone, get_buyer_org_by_member, require_org_role
from app.services.users import get_user

router = APIRouter(prefix="/buyer-org", tags=["buyer_org"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


class InviteIn(BaseModel):
    phone: str = Field(min_length=1)
    role: Literal["admin", "procurement", "qa", "finance"]


@router.post("/invite", status_code=200)
async def invite_member(
    body: InviteIn,
    uid: str = Depends(current_user_id),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    _entitlement: dict = Depends(require_entitlement("directBuyer", "orgMembers")),
):
    # WS-02 step 10: team RBAC (org invites) is the Enterprise-tier feature. The
    # entitlement dependency raises the phase-00 402/429 envelope when the
    # caller's plan has no org-member seats.
    stored = await idempotency.replay("buyer_org.invite", idempotency_key)
    if stored is not None:
        return stored

    admin_user = await get_user(uid)
    if not admin_user:
        _error(404, "NOT_FOUND", "user not found")

    invitee = await find_user_by_phone(body.phone)
    if not invitee:
        _error(404, "USER_NOT_FOUND", f"no registered user found with phone {body.phone}")

    org = await get_doc("buyer_orgs", uid)
    if not org:
        company_name = admin_user.get("name") or "Company"
        direct_profile = await get_doc(f"users/{uid}/role_profiles", "directBuyer")
        if direct_profile and direct_profile.get("companyName"):
            company_name = direct_profile["companyName"]

        org = {
            "id": uid,
            "adminUid": uid,
            "companyName": company_name,
            "members": [
                {
                    "uid": uid,
                    "name": admin_user.get("name") or "Admin",
                    "phone": admin_user.get("phone", ""),
                    "role": "admin",
                    "addedAt": _now(),
                }
            ],
            "createdAt": _now(),
            "updatedAt": _now(),
        }

    # Verify caller is admin of this org
    if org.get("adminUid") != uid:
        _error(403, "FORBIDDEN", "only admin can invite members to this buyer org")

    members = org.setdefault("members", [])
    existing = next((m for m in members if m.get("uid") == invitee["id"]), None)
    if existing:
        existing["role"] = body.role
        existing["phone"] = invitee.get("phone", body.phone)
    else:
        members.append({
            "uid": invitee["id"],
            "name": invitee.get("name") or "",
            "phone": invitee.get("phone", body.phone),
            "role": body.role,
            "addedAt": _now(),
        })

    org["updatedAt"] = _now()
    await set_doc("buyer_orgs", uid, org)

    resp = {"ok": True, "org": org, "member": {"uid": invitee["id"], "role": body.role}}
    if idempotency_key:
        await idempotency.store("buyer_org.invite", idempotency_key, resp)
    return resp


@router.get("", status_code=200)
async def get_buyer_org(uid: str = Depends(current_user_id)):
    org = await get_doc("buyer_orgs", uid)
    if not org:
        org, _ = await get_buyer_org_by_member(uid)
    if not org:
        admin_user = await get_user(uid)
        company_name = (admin_user or {}).get("name") or "Company"
        return {
            "id": uid,
            "adminUid": uid,
            "companyName": company_name,
            "members": [
                {
                    "uid": uid,
                    "name": company_name,
                    "phone": (admin_user or {}).get("phone", ""),
                    "role": "admin",
                    "addedAt": _now(),
                }
            ],
        }
    return org


@router.delete("/members/{member_uid}", status_code=200)
async def remove_member(
    member_uid: str,
    uid: str = Depends(current_user_id),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    stored = await idempotency.replay("buyer_org.remove", idempotency_key)
    if stored is not None:
        return stored

    org = await get_doc("buyer_orgs", uid)
    if not org:
        _error(404, "ORG_NOT_FOUND", "no buyer org found for this user")
    if org.get("adminUid") != uid:
        _error(403, "FORBIDDEN", "only admin can remove members")
    if member_uid == uid:
        _error(400, "CANNOT_REMOVE_ADMIN", "cannot remove the admin of the org")

    org["members"] = [m for m in org.get("members", []) if m.get("uid") != member_uid]
    org["updatedAt"] = _now()
    await set_doc("buyer_orgs", uid, org)

    resp = {"ok": True, "members": org["members"]}
    if idempotency_key:
        await idempotency.store("buyer_org.remove", idempotency_key, resp)
    return resp
