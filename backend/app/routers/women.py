"""Women Farmer Hub (phase-05 WS-08, robust.md §7.12).

All data is read from real Firestore collections — the hardcoded SHG / garden /
enterprise payloads that used to live here were moved to
`app/data/women_seed.py` + `backend/scripts/seed_women_data.py` (global rule 1):

    - `shg_groups` (+ `shg_groups/{id}/deposits` sub-collection)
    - `shg_meetings`
    - `garden_plans`
    - `home_enterprises`

The livestock tab joins the herd registry (`livestock_animals` +
`vaccination_schedules`) — no livestock data is duplicated here.

Money is integer paisa everywhere.

# Deferred(2026-10-03, future Enterprise tier): SHG federation — note only, do
# not build.
# Deferred(2026-10-03, phase-08): M26 women SHG-readiness AI — flag slot
# `women.shg_readiness` reserved in platform_config/ai (services/ai/config_store).
"""
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.emarket import UserProductCreate
from app.routers.user_products import create_listing
from app.routers.users import require_role
from app.services import idempotency
from app.services.users import get_user

router = APIRouter(prefix="/women", tags=["women"])

SHG_GROUPS = "shg_groups"
SHG_MEETINGS = "shg_meetings"
GARDEN_PLANS = "garden_plans"
HOME_ENTERPRISES = "home_enterprises"
HERD_COLLECTION = "livestock_animals"
VACCINATIONS_COLLECTION = "vaccination_schedules"


class DepositIn(BaseModel):
    amountPaisa: int = Field(gt=0)
    month: str = Field(pattern=r"^\d{4}-\d{2}$")


class ShgGroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    memberCount: int = Field(default=0, ge=0)
    monthlyDepositPaisa: int = Field(default=0, ge=0)


class MeetingIn(BaseModel):
    date: str
    agenda: str = ""


class AttendanceIn(BaseModel):
    memberUid: str
    present: bool = True


class CollectionIn(BaseModel):
    memberUid: str
    amountPaisa: int = Field(gt=0)


class GardenItemIn(BaseModel):
    name: str
    vernacularName: str = ""
    nutrition: str = ""
    companion: str = ""
    daysToHarvest: int = Field(ge=0)


class GardenPlanIn(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    items: list[GardenItemIn] = Field(default_factory=list)


class EnterpriseIn(BaseModel):
    product: str = Field(min_length=1, max_length=120)
    monthlyProfitPaisa: int = Field(gt=0)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _farmer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return uid


async def _user_group(uid: str) -> dict | None:
    groups = await query(SHG_GROUPS, [("memberUid", "==", uid)], limit=1)
    return groups[0] if groups else None


async def _farmer_with_user(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return user, uid


# =========================================================================
# SHG savings ledger + meeting workflow
# =========================================================================


@router.get("/shg")
async def get_shg(uid: str = Depends(_farmer)):
    group = await _user_group(uid)
    if group is None:
        return {"group": None, "deposits": [], "meetings": []}
    deposits = await query(f"{SHG_GROUPS}/{group['id']}/deposits", [], limit=1000)
    deposits.sort(key=lambda d: d.get("month", ""), reverse=True)
    meetings = await query(SHG_MEETINGS, [("groupId", "==", group["id"])], limit=1000)
    meetings.sort(key=lambda m: m.get("date", ""), reverse=True)
    return {"group": group, "deposits": deposits, "meetings": meetings}


@router.post("/shg", status_code=201)
async def create_shg_group(
    body: ShgGroupIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_farmer),
):
    scope = f"women.shg_group.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    group_id = f"shg_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": group_id,
        "name": body.name,
        "memberUid": uid,
        "memberCount": body.memberCount,
        "corpusPaisa": 0,
        "loanFundPaisa": 0,
        "monthlyDepositPaisa": body.monthlyDepositPaisa,
        "members": [{"memberUid": uid, "role": "member"}],
        "createdAt": _now(),
    }
    await set_doc(SHG_GROUPS, group_id, doc)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.post("/shg/deposit", status_code=201)
async def deposit(body: DepositIn, uid: str = Depends(_farmer)):
    group = await _user_group(uid)
    if group is None:
        _error(404, "SHG_GROUP_NOT_FOUND", "no SHG group for this farmer")
    if await get_doc(f"{SHG_GROUPS}/{group['id']}/deposits", body.month) is not None:
        _error(409, "DUPLICATE_DEPOSIT_MONTH", "इस महीने की जमा हो चुकी है")
    await set_doc(
        f"{SHG_GROUPS}/{group['id']}/deposits",
        body.month,
        {
            "id": body.month,
            "month": body.month,
            "amountPaisa": body.amountPaisa,
            "depositedAt": _now(),
        },
    )
    group["corpusPaisa"] = int(group.get("corpusPaisa", 0)) + body.amountPaisa
    await set_doc(SHG_GROUPS, group["id"], group)
    return {"depositedPaisa": body.amountPaisa, "newCorpusPaisa": group["corpusPaisa"]}


@router.get("/shg/meetings")
async def list_meetings(uid: str = Depends(_farmer)):
    group = await _user_group(uid)
    if group is None:
        return {"data": []}
    meetings = await query(SHG_MEETINGS, [("groupId", "==", group["id"])], limit=1000)
    meetings.sort(key=lambda m: m.get("date", ""), reverse=True)
    return {"data": meetings}


@router.post("/shg/meetings", status_code=201)
async def create_meeting(body: MeetingIn, uid: str = Depends(_farmer)):
    group = await _user_group(uid)
    if group is None:
        _error(404, "SHG_GROUP_NOT_FOUND", "no SHG group for this farmer")
    meeting_id = f"shgm_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": meeting_id,
        "groupId": group["id"],
        "date": body.date,
        "agenda": body.agenda,
        "attendance": [],
        "collections": [],
        "createdAt": _now(),
    }
    await set_doc(SHG_MEETINGS, meeting_id, doc)
    return doc


async def _meeting(meeting_id: str, group_id: str) -> dict:
    meeting = await get_doc(SHG_MEETINGS, meeting_id)
    if meeting is None or meeting.get("groupId") != group_id:
        _error(404, "MEETING_NOT_FOUND", "meeting not found for this SHG group")
    return meeting


@router.post("/shg/meetings/{meeting_id}/attendance")
async def mark_attendance(
    meeting_id: str,
    body: AttendanceIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_farmer),
):
    group = await _user_group(uid)
    if group is None:
        _error(404, "SHG_GROUP_NOT_FOUND", "no SHG group for this farmer")
    scope = f"women.attendance.{meeting_id}.{body.memberUid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    meeting = await _meeting(meeting_id, group["id"])
    attendance = [a for a in meeting.get("attendance", []) if a.get("memberUid") != body.memberUid]
    attendance.append({"memberUid": body.memberUid, "present": body.present, "markedAt": _now()})
    meeting["attendance"] = attendance
    await set_doc(SHG_MEETINGS, meeting_id, meeting)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, meeting)
    return meeting


@router.post("/shg/meetings/{meeting_id}/collections", status_code=201)
async def record_collection(
    meeting_id: str,
    body: CollectionIn,
    uid: str = Depends(_farmer),
):
    group = await _user_group(uid)
    if group is None:
        _error(404, "SHG_GROUP_NOT_FOUND", "no SHG group for this farmer")
    meeting = await _meeting(meeting_id, group["id"])
    entry = {
        "id": f"col_{uuid.uuid4().hex[:10]}",
        "memberUid": body.memberUid,
        "amountPaisa": body.amountPaisa,
        "recordedAt": _now(),
    }
    collections = list(meeting.get("collections", []))
    collections.append(entry)
    meeting["collections"] = collections
    await set_doc(SHG_MEETINGS, meeting_id, meeting)
    group["corpusPaisa"] = int(group.get("corpusPaisa", 0)) + body.amountPaisa
    await set_doc(SHG_GROUPS, group["id"], group)
    return {"entry": entry, "newCorpusPaisa": group["corpusPaisa"]}


# =========================================================================
# Kitchen-garden planner
# =========================================================================


@router.get("/garden-plans")
async def garden_plans(uid: str = Depends(current_user_id)):
    docs = await query(GARDEN_PLANS, [], limit=500)
    visible = [d for d in docs if d.get("template") or d.get("ownerUid") == uid]
    visible.sort(
        key=lambda d: (
            0 if d.get("template") else 1,
            d.get("order", 99),
            d.get("createdAt", ""),
        )
    )
    return {"data": visible}


@router.post("/garden-plans", status_code=201)
async def create_garden_plan(
    body: GardenPlanIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    scope = f"women.garden_plan.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    plan_id = f"gp_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": plan_id,
        "ownerUid": uid,
        "template": False,
        "category": body.category,
        "items": [item.model_dump() for item in body.items],
        "createdAt": _now(),
    }
    await set_doc(GARDEN_PLANS, plan_id, doc)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.put("/garden-plans/{plan_id}")
async def update_garden_plan(
    plan_id: str,
    body: GardenPlanIn,
    uid: str = Depends(current_user_id),
):
    doc = await get_doc(GARDEN_PLANS, plan_id)
    if doc is None:
        _error(404, "GARDEN_PLAN_NOT_FOUND", "garden plan not found")
    if doc.get("template") or doc.get("ownerUid") != uid:
        _error(403, "FORBIDDEN", "garden plan belongs to another user")
    doc["category"] = body.category
    doc["items"] = [item.model_dump() for item in body.items]
    doc["updatedAt"] = _now()
    await set_doc(GARDEN_PLANS, plan_id, doc)
    return doc


# =========================================================================
# Home-enterprise income tracker + marketplace publishing
# =========================================================================


@router.get("/home-enterprise")
async def home_enterprise(uid: str = Depends(_farmer)):
    lines = await query(HOME_ENTERPRISES, [("ownerUid", "==", uid)], limit=200)
    lines.sort(key=lambda d: d.get("product", ""))
    return {
        "lines": lines,
        "totalMonthlyProfitPaisa": sum(int(line.get("monthlyProfitPaisa", 0)) for line in lines),
    }


@router.post("/home-enterprise", status_code=201)
async def create_enterprise_line(body: EnterpriseIn, uid: str = Depends(_farmer)):
    line_id = f"he_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": line_id,
        "ownerUid": uid,
        "product": body.product,
        "monthlyProfitPaisa": body.monthlyProfitPaisa,
        "createdAt": _now(),
    }
    await set_doc(HOME_ENTERPRISES, line_id, doc)
    return doc


@router.post("/home-enterprise/listings", status_code=201)
async def publish_listing(
    body: UserProductCreate,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    ctx: tuple = Depends(_farmer_with_user),
):
    """Publish a home-enterprise product into the WS-03 marketplace catalog."""
    user, uid = ctx
    scope = f"women.listing.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    product = await create_listing(user, uid, body)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, product)
    return product


# =========================================================================
# Livestock health — joins the herd registry (no livestock logic here)
# =========================================================================


@router.get("/backyard-livestock")
async def backyard_livestock(uid: str = Depends(current_user_id)):
    animals = await query(HERD_COLLECTION, [("ownerId", "==", uid)], limit=500)
    vaccinations = await query(VACCINATIONS_COLLECTION, [], limit=1000)
    latest_by_tag: dict[str, dict] = {}
    for vac in vaccinations:
        tag = vac.get("animalTagId")
        if not tag:
            continue
        if tag not in latest_by_tag or vac.get("nextDueDate", "") > latest_by_tag[tag].get(
            "nextDueDate", ""
        ):
            latest_by_tag[tag] = vac
    data = []
    for animal in animals:
        vac = latest_by_tag.get(animal.get("tagId"))
        data.append(
            {
                "id": animal["id"],
                "tagId": animal.get("tagId", ""),
                "animal": animal.get("species", ""),
                "name": animal.get("name", ""),
                "vernacularName": animal.get("breed", ""),
                "count": 1,
                "yieldLabel": (
                    f"{animal.get('dailyYieldLiters', 0)} L milk/day"
                    if animal.get("dailyYieldLiters")
                    else ""
                ),
                "vaccine": (vac or {}).get("disease", ""),
                "vaccineDue": (vac or {}).get("nextDueDate", ""),
                "healthStatus": animal.get("healthStatus", ""),
            }
        )
    data.sort(key=lambda row: row.get("vaccineDue") or "9999-12-31")
    return {"data": data, "checkedAt": date.today().isoformat()}
