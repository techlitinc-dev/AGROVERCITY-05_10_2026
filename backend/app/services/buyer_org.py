from datetime import datetime, timezone
from fastapi import HTTPException
from app.core.db import get_doc, query, set_doc
from app.services.users import get_user


def _now():
    return datetime.now(timezone.utc).isoformat()


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def normalize_phone(phone: str) -> str:
    cleaned = phone.strip()
    if cleaned and not cleaned.startswith("+"):
        return "+91" + cleaned
    return cleaned


async def find_user_by_phone(phone: str) -> dict | None:
    norm = normalize_phone(phone)
    users = await query("users", [("phone", "==", norm)])
    if users:
        return users[0]
    users = await query("users", [("phone", "==", phone)])
    if users:
        return users[0]
    all_users = await query("users", limit=1000)
    digits = phone[-10:] if len(phone) >= 10 else phone
    for u in all_users:
        u_phone = u.get("phone", "")
        if u_phone and (u_phone == phone or u_phone.endswith(digits)):
            return u
    return None


async def get_buyer_org_by_member(uid: str) -> tuple[dict | None, str | None]:
    """Returns (org, role) for user uid. Role is 'admin', 'procurement', 'qa', 'finance', or None."""
    org = await get_doc("buyer_orgs", uid)
    if org and org.get("adminUid") == uid:
        return org, "admin"

    orgs = await query("buyer_orgs", limit=1000)
    for o in orgs:
        if o.get("adminUid") == uid:
            return o, "admin"
        for m in o.get("members", []):
            if m.get("uid") == uid:
                return o, m.get("role")
    return None, None


async def is_org_member_of_buyer(member_uid: str, buyer_admin_uid: str) -> bool:
    if member_uid == buyer_admin_uid:
        return True
    org = await get_doc("buyer_orgs", buyer_admin_uid)
    if not org:
        # Check if buyer_admin_uid is itself a member of an org
        org, _ = await get_buyer_org_by_member(buyer_admin_uid)
    if not org:
        return False
    if org.get("adminUid") == member_uid:
        return True
    return any(m.get("uid") == member_uid for m in org.get("members", []))


async def get_buyer_org_role(uid: str, admin_uid: str | None = None) -> str | None:
    """Returns the role of uid in the buyer org of admin_uid (or uid's own org).
    If no org exists for admin_uid (or uid), returns None (solo buyer).
    """
    target_admin = admin_uid or uid
    org = await get_doc("buyer_orgs", target_admin)
    if not org:
        org, _ = await get_buyer_org_by_member(target_admin)
        if not org:
            return None

    if org.get("adminUid") == uid:
        return "admin"
    for m in org.get("members", []):
        if m.get("uid") == uid:
            return m.get("role")
    return None


async def require_org_role(uid: str, *roles: str, org_owner_uid: str | None = None) -> str:
    """Checks that uid has one of roles (or 'admin') in the org.
    If no org exists and uid == target_owner, lazily creates org and returns 'admin'.
    Raises 403 ORG_ROLE_REQUIRED if unauthorized.
    """
    target_owner = org_owner_uid or uid
    org = await get_doc("buyer_orgs", target_owner)
    if not org:
        org, _ = await get_buyer_org_by_member(target_owner)

    if not org:
        # Solo buyer = implicit admin of their own org
        if uid == target_owner:
            admin_user = await get_user(uid)
            company_name = (admin_user or {}).get("name") or "Company"
            direct_profile = await get_doc(f"users/{uid}/role_profiles", "directBuyer")
            if direct_profile and direct_profile.get("companyName"):
                company_name = direct_profile["companyName"]
            lazy_org = {
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
                "createdAt": _now(),
                "updatedAt": _now(),
            }
            await set_doc("buyer_orgs", uid, lazy_org)
            return "admin"
        else:
            _error(403, "ORG_ROLE_REQUIRED", f"requires one of roles: {', '.join(roles)}")

    role = None
    if org.get("adminUid") == uid:
        role = "admin"
    else:
        for m in org.get("members", []):
            if m.get("uid") == uid:
                role = m.get("role")
                break

    if not role or (role not in roles and role != "admin"):
        _error(403, "ORG_ROLE_REQUIRED", f"requires one of roles: {', '.join(roles)}")

    return role
