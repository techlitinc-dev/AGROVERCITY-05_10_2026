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

# Deferred(2026-10-03, phase-07): admin FPO verification UI (A8). Hook: verification_status field on FPO docs.
FPO_VERIFICATION_DEFAULT = "unverified"


def _verification_status(fpo: dict) -> str:
    return fpo.get("verification_status") or FPO_VERIFICATION_DEFAULT


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
    if not fpo.get("verification_status"):
        # A8 hook — persist the default on read so the field always exists.
        fpo["verification_status"] = _verification_status(fpo)
        await set_doc("fpos", fpo["id"], fpo)
    return fpo


# ==============================================================================
# FPO discovery directory + join-request flow (F19)
# ==============================================================================


async def _membership_state(fpo_id: str, user: dict, requests: list[dict]) -> str:
    """`member` | `pending` | `none` for the caller against one FPO."""
    if user.get("fpoId") == fpo_id or fpo_id in (user.get("fpoMemberships") or []):
        return "member"
    for request in requests:
        if request.get("fpoId") != fpo_id:
            continue
        status = request.get("status")
        if status == "approved":
            return "member"
        if status == "pending":
            return "pending"
    return "none"


def _join_request_id(fpo_id: str, uid: str) -> str:
    return f"joinreq_{fpo_id}_{uid}"


@router.get("/directory")
async def fpo_directory(uid: str = Depends(_farmer)):
    """Every FPO with the caller's membership state + verification_status (A8)."""
    fpos = await query("fpos", [], limit=100)
    user = await get_user(uid)
    requests = await query("fpo_join_requests", [("farmerId", "==", uid)], limit=100)
    return {
        "data": [
            {
                **fpo,
                "verification_status": _verification_status(fpo),
                "membership": await _membership_state(fpo["id"], user, requests),
            }
            for fpo in fpos
        ]
    }


@router.post("/{fpo_id}/join-request", status_code=201)
async def request_join_fpo(fpo_id: str, uid: str = Depends(_farmer)):
    """Non-member sends a join request; the state transitions to `pending`."""
    fpo = await get_doc("fpos", fpo_id)
    if fpo is None:
        _error(404, "FPO_NOT_FOUND", "no fpo found")
    user = await get_user(uid)
    if user.get("fpoId") == fpo_id or fpo_id in (user.get("fpoMemberships") or []):
        _error(409, "ALREADY_MEMBER", "आप पहले से इस संस्था के सदस्य हैं")

    request_id = _join_request_id(fpo_id, uid)
    existing = await get_doc("fpo_join_requests", request_id)
    if existing is None:
        existing = {
            "id": request_id,
            "fpoId": fpo_id,
            "fpoName": fpo.get("name"),
            "farmerId": uid,
            "status": "pending",
            "verification_status": _verification_status(fpo),
            "requestedAt": datetime.now(timezone.utc).isoformat(),
        }
        await set_doc("fpo_join_requests", request_id, existing)
    return {"id": request_id, "fpoId": fpo_id, "status": existing["status"], "membership": "pending"}


@router.post("/{fpo_id}/join-request/approve")
async def approve_join_fpo(fpo_id: str, uid: str = Depends(_farmer)):
    """Dev-approve the caller's own pending request; transitions to `member`.

    Deferred(2026-10-03, phase-07): the real approval is the admin FPO
    verification console (A8) via the join-request status; this dev affordance
    only exists so the farmer flow can be exercised before that console lands.
    """
    request_id = _join_request_id(fpo_id, uid)
    request = await get_doc("fpo_join_requests", request_id)
    if request is None:
        _error(404, "JOIN_REQUEST_NOT_FOUND", "कोई सदस्यता अनुरोध नहीं मिला")

    user = await get_user(uid)
    user["fpoId"] = fpo_id
    memberships = sorted({*(user.get("fpoMemberships") or []), fpo_id})
    user["fpoMemberships"] = memberships
    await set_doc("users", uid, user)

    request["status"] = "approved"
    request["approvedAt"] = datetime.now(timezone.utc).isoformat()
    request["approvedBy"] = "dev"
    await set_doc("fpo_join_requests", request_id, request)
    return {"id": request_id, "fpoId": fpo_id, "status": "approved", "membership": "member"}


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
