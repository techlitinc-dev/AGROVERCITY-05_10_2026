from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.equipment import SlotOut
from app.models.fpo import JoinPoolRequest
from app.routers.equipment import IST, get_or_generate_slots
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/fpo", tags=["fpo"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _farmer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return uid


def _week_monday(week: str | None):
    if week is None:
        today = datetime.now(IST).date()
        return today - timedelta(days=today.weekday())
    try:
        return datetime.strptime(f"{week}-1", "%G-W%V-%u").date()
    except ValueError:
        _error(422, "INVALID_WEEK", "week must be ISO format YYYY-Www", {"week": "invalid ISO week"})


@router.get("/me")
async def fpo_me(uid: str = Depends(_farmer)):
    # single-FPO dev mode: every farmer belongs to the first fpos doc
    fpos = await query("fpos", [], limit=1)
    if not fpos:
        _error(404, "FPO_NOT_FOUND", "no fpo found")
    fpo = fpos[0]
    user = await get_user(uid)
    if user.get("fpoId") != fpo.get("id"):
        user["fpoId"] = fpo.get("id")
        await set_doc("users", uid, user)
    return fpo


@router.get("/pools")
async def list_pools(uid: str = Depends(_farmer)):
    return {"data": await query("fpo_pools", [], limit=100)}


@router.post("/pools/{pool_id}/join")
async def join_pool(pool_id: str, body: JoinPoolRequest, uid: str = Depends(_farmer)):
    pool = await get_doc("fpo_pools", pool_id)
    if pool is None:
        _error(404, "POOL_NOT_FOUND", "pool not found")
    if pool.get("bookedUnits", 0) >= pool.get("targetUnits", 0):
        _error(409, "POOL_FULL", "इस पूल का लक्ष्य पूरा हो गया है")
    pool["bookedUnits"] = min(pool.get("bookedUnits", 0) + body.units, pool.get("targetUnits", 0))
    await set_doc("fpo_pools", pool_id, pool)
    await set_doc(
        f"fpo_pools/{pool_id}/members",
        uid,
        {"units": body.units, "joinedAt": datetime.now(timezone.utc).isoformat()},
    )
    return pool


@router.get("/machinery")
async def machinery_calendar(week: str | None = None, uid: str = Depends(_farmer)):
    monday = _week_monday(week)
    machines = await query("equipment", [("ownerType", "==", "fpo")], limit=1000)
    machines = [m for m in machines if m.get("active", True) and m.get("docStatus") == "verified"]
    data = []
    for machine in machines:
        days = {}
        for i in range(7):
            date = (monday + timedelta(days=i)).isoformat()
            slots = await get_or_generate_slots(machine, date)
            days[date] = [SlotOut(**s).model_dump() for s in slots]
        data.append({"equipmentId": machine["id"], "name": machine["name"], "days": days})
    return {"data": data}
