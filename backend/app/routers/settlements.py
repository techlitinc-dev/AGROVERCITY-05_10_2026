from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import admin_user, current_user_id
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(tags=["settlements"])


class HoldActionIn(BaseModel):
    reason: str = Field(..., min_length=3)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _no_driver_settlements(uid: str = Depends(current_user_id)) -> str:
    """Fleet drivers operate trips but can never read settlement/payout data (T9)."""
    user = await get_user(uid)
    profiles = (user or {}).get("linkedProfiles") or []
    if "driver" in profiles and "transport" not in profiles:
        _error(403, "DRIVERS_CANNOT_VIEW_SETTLEMENTS", "drivers cannot view settlements")
    return uid


async def _my_settlements(uid: str, role: str) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, role)
    docs = await query(
        "settlements",
        [("role", "==", role), ("entityId", "==", uid)],
        limit=1000,
    )
    docs.sort(key=lambda d: d.get("periodStart", ""), reverse=True)
    return {"data": docs, "page": 1, "pageSize": 20, "total": len(docs)}


@router.get("/transport/settlements")
async def transport_settlements(uid: str = Depends(_no_driver_settlements)):
    return await _my_settlements(uid, "transport")


@router.get("/equipment/settlements")
async def equipment_settlements(uid: str = Depends(_no_driver_settlements)):
    return await _my_settlements(uid, "equipmentRental")


@router.get("/broker/settlements")
async def broker_settlements(uid: str = Depends(_no_driver_settlements)):
    return await _my_settlements(uid, "broker")


@router.get("/settlements/holds")
async def list_settlement_holds(user: dict = Depends(admin_user)):
    """Held settlement lines for finance_admin review (WS-03)."""
    docs = await query("settlements", [], limit=2000)
    held = [d for d in docs if d.get("held")]
    held.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": held, "total": len(held)}


def _audit(action: str, line_id: str, actor: str, reason: str, **extra) -> dict:
    return {
        "action": action,
        "actor": actor,
        "lineId": line_id,
        "reason": reason,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        **extra,
    }


async def _act_on_hold(line_id: str, user: dict, body: HoldActionIn, action: str) -> dict:
    doc = await get_doc("settlements", line_id)
    if doc is None or not doc.get("held"):
        _error(404, "HOLD_NOT_FOUND", "no held settlement line with that id")
    # Maker-checker: over ₹10,000 (integer paisa > 1000000) a different
    # finance_admin must act than the one who last touched the line.
    amount_paisa = int(doc.get("netRupees") or 0) * 100
    if amount_paisa > 1000000 and doc.get("lastActedBy") == user["uid"]:
        _error(409, "MAKER_CHECKER", "a different finance_admin must act on this hold")
    doc["held"] = False
    doc["holdStatus"] = action  # "released" | "rejected"
    doc["lastActedBy"] = user["uid"]
    doc["holdActedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("settlements", line_id, doc)
    entry = _audit(f"settlement_hold_{action}", line_id, user["uid"], body.reason)
    await set_doc("audit_logs", f"aud_hold_{action}_{line_id}_{entry['createdAt'][:19]}", entry)
    return {"lineId": line_id, "holdStatus": action}


@router.post("/settlements/holds/{line_id}/release")
async def release_settlement_hold(
    line_id: str, body: HoldActionIn, user: dict = Depends(admin_user)
):
    return await _act_on_hold(line_id, user, body, "released")


@router.post("/settlements/holds/{line_id}/reject")
async def reject_settlement_hold(
    line_id: str, body: HoldActionIn, user: dict = Depends(admin_user)
):
    return await _act_on_hold(line_id, user, body, "rejected")
