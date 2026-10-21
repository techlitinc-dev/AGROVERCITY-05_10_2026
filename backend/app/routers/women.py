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
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.data.women_seed import GARDEN_PLAN_TEMPLATES
from app.models.emarket import UserProductCreate
from app.routers.user_products import create_listing
from app.routers.users import require_role
from app.services import idempotency, shg_readiness
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(prefix="/women", tags=["women"])

SHG_GROUPS = "shg_groups"
SHG_MEETINGS = "shg_meetings"
SHG_JOIN_REQUESTS = "shg_join_requests"
SHG_LOANS = "shg_loans"
GARDEN_PLANS = "garden_plans"
HOME_ENTERPRISES = "home_enterprises"
HERD_COLLECTION = "livestock_animals"
VACCINATIONS_COLLECTION = "vaccination_schedules"

IST = ZoneInfo("Asia/Kolkata")


class DepositIn(BaseModel):
    amountPaisa: int = Field(gt=0)
    month: str = Field(pattern=r"^\d{4}-\d{2}$")


class ShgGroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    memberCount: int = Field(default=0, ge=0)
    monthlyDepositPaisa: int = Field(default=0, ge=0)
    village: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)


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
    revenuePaisa: int | None = Field(default=None, ge=0)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _farmer(uid: str = Depends(current_user_id)) -> str:
    """WomenHub accepts both the farmer persona and the dedicated womenShg persona."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "womenShg")
    return uid


async def _user_group(uid: str) -> dict | None:
    """The caller's SHG group — either the group they created (denormalized
    `memberUid`) or one they joined via an approved join request (`members[]`)."""
    groups = await query(SHG_GROUPS, [("memberUid", "==", uid)], limit=1)
    if groups:
        return groups[0]
    for group in await query(SHG_GROUPS, [], limit=1000):
        if any(m.get("memberUid") == uid for m in group.get("members") or []):
            return group
    return None


def _group_admin_uid(group: dict) -> str | None:
    """The group creator (first member) is the admin who approves requests/loans."""
    members = group.get("members") or []
    return members[0].get("memberUid") if members else group.get("memberUid")


def _ist_month() -> str:
    return datetime.now(timezone.utc).astimezone(IST).strftime("%Y-%m")


def _add_months(day: date, months: int) -> date:
    month = day.month - 1 + months
    year = day.year + month // 12
    month = month % 12 + 1
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    day_number = min(day.day, [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day_number)


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
        return {"group": None, "deposits": [], "meetings": [], "readiness": None}
    deposits = await query(f"{SHG_GROUPS}/{group['id']}/deposits", [], limit=1000)
    deposits.sort(key=lambda d: d.get("month", ""), reverse=True)
    meetings = await query(SHG_MEETINGS, [("groupId", "==", group["id"])], limit=1000)
    meetings.sort(key=lambda m: m.get("date", ""), reverse=True)
    # M26 (phase-08 WS-01): cached readiness card (suggest-only annotation).
    readiness = await shg_readiness.get_shg_readiness(group["id"])
    return {"group": group, "deposits": deposits, "meetings": meetings, "readiness": readiness}


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
    if await _user_group(uid) is not None:
        _error(409, "ALREADY_HAS_GROUP", "आप पहले से किसी बचत गट में हैं")
    user = await get_user(uid) or {}
    group_id = f"shg_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": group_id,
        "name": body.name,
        "memberUid": uid,
        "memberCount": body.memberCount,
        "corpusPaisa": 0,
        "loanFundPaisa": 0,
        "monthlyDepositPaisa": body.monthlyDepositPaisa,
        "village": body.village,
        "district": body.district,
        "members": [{"memberUid": uid, "name": user.get("name") or "", "role": "president"}],
        "createdAt": _now(),
        "formedAt": _now(),
    }
    await set_doc(SHG_GROUPS, group_id, doc)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


LOAN_FUND_DEPOSIT_PCT = 25


@router.post("/shg/deposit", status_code=201)
async def deposit(body: DepositIn, uid: str = Depends(_farmer)):
    group = await _user_group(uid)
    if group is None:
        _error(404, "SHG_GROUP_NOT_FOUND", "no SHG group for this farmer")
    member_doc_id = f"{body.month}_{uid}"
    if await get_doc(f"{SHG_GROUPS}/{group['id']}/deposits", member_doc_id) is not None:
        _error(409, "DUPLICATE_DEPOSIT_MONTH", "इस महीने की जमा हो चुकी है")
    now = _now()
    # Every deposit feeds two pots: the group corpus (savings) and the
    # revolving loan fund that backs in-group micro-loans.
    loan_fund_paisa = body.amountPaisa * LOAN_FUND_DEPOSIT_PCT // 100
    corpus_paisa = body.amountPaisa - loan_fund_paisa
    # Per-member doc — several members can deposit in the same month.
    await set_doc(
        f"{SHG_GROUPS}/{group['id']}/deposits",
        member_doc_id,
        {
            "id": member_doc_id,
            "month": body.month,
            "memberUid": uid,
            "amountPaisa": body.amountPaisa,
            "corpusPaisa": corpus_paisa,
            "loanFundPaisa": loan_fund_paisa,
            "depositedAt": now,
        },
    )
    # Month summary doc (id = month) keeps the group-level ledger total.
    summary = await get_doc(f"{SHG_GROUPS}/{group['id']}/deposits", body.month)
    await set_doc(
        f"{SHG_GROUPS}/{group['id']}/deposits",
        body.month,
        {
            "id": body.month,
            "month": body.month,
            "amountPaisa": int((summary or {}).get("amountPaisa", 0)) + body.amountPaisa,
            "memberCount": int((summary or {}).get("memberCount", 0)) + 1,
            "updatedAt": now,
        },
    )
    group["corpusPaisa"] = int(group.get("corpusPaisa", 0)) + corpus_paisa
    group["loanFundPaisa"] = int(group.get("loanFundPaisa", 0) or 0) + loan_fund_paisa
    await set_doc(SHG_GROUPS, group["id"], group)
    return {
        "depositedPaisa": body.amountPaisa,
        "newCorpusPaisa": group["corpusPaisa"],
        "newLoanFundPaisa": group["loanFundPaisa"],
        "loanFundAllocatedPaisa": loan_fund_paisa,
    }


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


@router.get("/garden-templates")
async def garden_templates(uid: str = Depends(current_user_id)):
    """Kitchen-garden template catalog for the create-plan picker (SR 25).

    Reads the seeded `template: true` docs from the `garden_plans` collection;
    falls back to the in-module seed catalog (`app.data.women_seed`) when the
    collection has no template rows (unseeded environments), so the UI always
    gets suggestion items with nutrition / companion / daysToHarvest.
    """
    docs = [d for d in await query(GARDEN_PLANS, [("template", "==", True)], limit=50)]
    if not docs:
        docs = list(GARDEN_PLAN_TEMPLATES)
    docs.sort(key=lambda d: (d.get("order", 99), d.get("createdAt", "")))
    return {"data": docs}


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
        "revenuePaisa": body.revenuePaisa,
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
    # Tag the catalog doc so women-led home-enterprise listings stay
    # distinguishable from gruh-udyog unit listings and other sellers.
    product["source"] = "women_enterprise"
    await set_doc("products", product["id"], product)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, product)
    return product


# =========================================================================
# Livestock health — joins the herd registry (no livestock logic here)
# =========================================================================


async def _livestock_rows(uid: str) -> list[dict]:
    """Joined herd-registry rows for the backyard-livestock tab — shared by
    GET /backyard-livestock, the dashboard and insights so the join logic
    never drifts between surfaces."""
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
    return data


def _due_vaccinations(rows: list[dict], within_days: int = 30) -> list[dict]:
    """Rows with a vaccine due within `within_days` (incl. today), sorted by due date."""
    today = date.today()
    horizon = today + timedelta(days=within_days)
    due = []
    for row in rows:
        raw = row.get("vaccineDue")
        if not raw:
            continue
        try:
            due_date = date.fromisoformat(raw)
        except ValueError:
            continue
        if today <= due_date <= horizon:
            due.append(
                {
                    "animalId": row["id"],
                    "label": row.get("name") or row.get("animal") or row.get("tagId", ""),
                    "vaccine": row.get("vaccine", ""),
                    "dueDate": raw,
                    "daysLeft": (due_date - today).days,
                }
            )
    due.sort(key=lambda item: item["dueDate"])
    return due


@router.get("/backyard-livestock")
async def backyard_livestock(uid: str = Depends(current_user_id)):
    data = await _livestock_rows(uid)
    return {"data": data, "checkedAt": date.today().isoformat()}


# =========================================================================
# SHG directory (discovery) + join requests
# =========================================================================


@router.get("/directory")
async def shg_directory(
    q: str | None = Query(None),
    village: str | None = Query(None),
    district: str | None = Query(None),
    uid: str = Depends(current_user_id),
):
    """Read-only SHG directory for discovery — any authenticated user."""
    groups = await query(SHG_GROUPS, [], limit=1000)
    if q:
        needle = q.strip().lower()
        groups = [g for g in groups if needle in (g.get("name") or "").lower()]
    if village:
        groups = [g for g in groups if (g.get("village") or "").lower() == village.strip().lower()]
    if district:
        groups = [g for g in groups if (g.get("district") or "").lower() == district.strip().lower()]
    groups.sort(key=lambda g: g.get("formedAt") or g.get("createdAt") or "", reverse=True)
    items = []
    for group in groups[:50]:
        request = await get_doc(SHG_JOIN_REQUESTS, f"{group['id']}_{uid}")
        items.append(
            {
                "id": group["id"],
                "name": group.get("name", ""),
                "village": group.get("village"),
                "district": group.get("district"),
                "memberCount": int(group.get("memberCount", 0) or 0),
                "corpusPaisa": int(group.get("corpusPaisa", 0) or 0),
                "loanFundPaisa": int(group.get("loanFundPaisa", 0) or 0),
                "monthlyDepositPaisa": int(group.get("monthlyDepositPaisa", 0) or 0),
                "formedAt": group.get("formedAt") or group.get("createdAt") or "",
                "verified": group.get("status") == "verified",
                "myRequestStatus": (request or {}).get("status", "none"),
            }
        )
    return {"items": items}


# =========================================================================
# SHG join requests — one-group-per-user, deterministic doc id {shgId}_{uid}
# =========================================================================


class JoinRequestIn(BaseModel):
    shgId: str = Field(min_length=1)
    message: str | None = Field(default=None, max_length=500)


async def _admin_group(uid: str) -> dict | None:
    """The caller's group when they are its admin (creator), else None."""
    group = await _user_group(uid)
    if group is None or _group_admin_uid(group) != uid:
        return None
    return group


@router.post("/shg/join-requests", status_code=201)
async def create_join_request(
    body: JoinRequestIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_farmer),
):
    scope = f"women.join_request.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    group = await get_doc(SHG_GROUPS, body.shgId)
    if group is None:
        _error(404, "SHG_NOT_FOUND", "SHG group not found")
    if await _user_group(uid) is not None:
        _error(409, "ALREADY_HAS_GROUP", "आप पहले से किसी बचत गट में हैं")
    if any(m.get("memberUid") == uid for m in group.get("members") or []):
        _error(409, "ALREADY_MEMBER", "already a member of this SHG")
    request_id = f"{body.shgId}_{uid}"
    existing = await get_doc(SHG_JOIN_REQUESTS, request_id)
    if existing is not None and existing.get("status") == "pending":
        _error(409, "REQUEST_PENDING", "join request already pending")
    user = await get_user(uid) or {}
    doc = {
        "id": request_id,
        "shgId": body.shgId,
        "uid": uid,
        "name": user.get("name") or "",
        "village": user.get("village") or "",
        "message": body.message,
        "status": "pending",
        "createdAt": _now(),
    }
    await set_doc(SHG_JOIN_REQUESTS, request_id, doc)
    admin_uid = _group_admin_uid(group)
    if admin_uid and admin_uid != uid:
        await notify_user(
            admin_uid,
            type="shg_join_request",
            title="New SHG join request / नवीन सभासद विनंती",
            body=f"{doc['name'] or uid} wants to join {group.get('name', '')}",
            deepLink=f"/womenShg/savings/requests/{uid}",
        )
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.get("/shg/join-requests")
async def list_join_requests(uid: str = Depends(_farmer)):
    """Pending join requests for the group the caller administers."""
    group = await _admin_group(uid)
    if group is None:
        return {"items": []}
    requests = await query(SHG_JOIN_REQUESTS, [("shgId", "==", group["id"])], limit=500)
    pending = [r for r in requests if r.get("status") == "pending"]
    pending.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return {"items": pending}


@router.post("/shg/join-requests/{request_uid}/approve")
async def approve_join_request(
    request_uid: str,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_farmer),
):
    scope = f"women.join_approve.{request_uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    group = await _admin_group(uid)
    if group is None:
        _error(403, "FORBIDDEN", "only the group admin can approve join requests")
    request = await get_doc(SHG_JOIN_REQUESTS, f"{group['id']}_{request_uid}")
    if request is None or request.get("shgId") != group["id"]:
        _error(404, "REQUEST_NOT_FOUND", "join request not found")
    if request.get("status") == "approved":
        return request  # idempotent: approving twice never duplicates the member
    if request.get("status") == "declined":
        _error(409, "REQUEST_DECLINED", "join request was already declined")
    if any(m.get("memberUid") == request_uid for m in group.get("members") or []):
        request["status"] = "approved"
        await set_doc(SHG_JOIN_REQUESTS, request["id"], request)
        return request
    request["status"] = "approved"
    request["decidedAt"] = _now()
    await set_doc(SHG_JOIN_REQUESTS, request["id"], request)
    members = list(group.get("members") or [])
    members.append(
        {
            "memberUid": request_uid,
            "name": request.get("name") or "",
            "role": "member",
            "joinedAt": _now(),
        }
    )
    group["members"] = members
    group["memberCount"] = int(group.get("memberCount", 0) or 0) + 1
    await set_doc(SHG_GROUPS, group["id"], group)
    await notify_user(
        request_uid,
        type="shg_join_approved",
        title="SHG join approved / सभासदत्व मान्य",
        body=f"You are now a member of {group.get('name', '')}",
        deepLink="/womenShg/savings",
    )
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, request)
    return request


@router.post("/shg/join-requests/{request_uid}/decline")
async def decline_join_request(
    request_uid: str,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_farmer),
):
    scope = f"women.join_decline.{request_uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    group = await _admin_group(uid)
    if group is None:
        _error(403, "FORBIDDEN", "only the group admin can decline join requests")
    request = await get_doc(SHG_JOIN_REQUESTS, f"{group['id']}_{request_uid}")
    if request is None or request.get("shgId") != group["id"]:
        _error(404, "REQUEST_NOT_FOUND", "join request not found")
    if request.get("status") == "declined":
        return request
    if request.get("status") == "approved":
        _error(409, "REQUEST_APPROVED", "join request was already approved")
    request["status"] = "declined"
    request["decidedAt"] = _now()
    await set_doc(SHG_JOIN_REQUESTS, request["id"], request)
    await notify_user(
        request_uid,
        type="shg_join_declined",
        title="SHG join declined / सभासदत्व नामंजूर",
        body=f"Your request to join {group.get('name', '')} was declined",
        deepLink="/womenShg/savings",
    )
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, request)
    return request


# =========================================================================
# In-group loan lifecycle — shg_loans, funded from loanFundPaisa
# =========================================================================


class LoanIn(BaseModel):
    amountPaisa: int = Field(gt=0)
    purpose: str = Field(min_length=1, max_length=200)
    months: int = Field(ge=1, le=24)


class LoanRepayIn(BaseModel):
    amountPaisa: int = Field(gt=0)


LOAN_ITEM_FIELDS = (
    "id",
    "borrowerUid",
    "borrowerName",
    "amountPaisa",
    "purpose",
    "months",
    "status",
    "requestedAt",
    "approvedAt",
    "repaidPaisa",
    "schedule",
    "audit",
)


def _loan_item(doc: dict) -> dict:
    return {field: doc.get(field) for field in LOAN_ITEM_FIELDS}


@router.post("/shg/loans", status_code=201)
async def request_loan(
    body: LoanIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_farmer),
):
    scope = f"women.loan.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    group = await _user_group(uid)
    if group is None:
        _error(409, "SHG_GROUP_NOT_FOUND", "join an SHG group before requesting a loan")
    if body.amountPaisa > int(group.get("loanFundPaisa", 0) or 0):
        _error(409, "INSUFFICIENT_LOAN_FUND", "the group loan fund cannot cover this amount")
    existing = await query(SHG_LOANS, [("borrowerUid", "==", uid)], limit=50)
    if any(loan.get("status") in ("requested", "approved") for loan in existing):
        _error(409, "ACTIVE_LOAN_EXISTS", "you already have an active loan request")
    user = await get_user(uid) or {}
    loan_id = f"loan_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": loan_id,
        "shgId": group["id"],
        "borrowerUid": uid,
        "borrowerName": user.get("name") or "",
        "amountPaisa": body.amountPaisa,
        "purpose": body.purpose,
        "months": body.months,
        "status": "requested",
        "requestedAt": _now(),
        "approvedAt": None,
        "repaidPaisa": 0,
        "schedule": [],
        "audit": [
            {
                "at": _now(),
                "by": uid,
                "byName": user.get("name") or "",
                "action": "requested",
                "amountPaisa": body.amountPaisa,
            }
        ],
    }
    await set_doc(SHG_LOANS, loan_id, doc)
    admin_uid = _group_admin_uid(group)
    if admin_uid and admin_uid != uid:
        await notify_user(
            admin_uid,
            type="shg_loan_requested",
            title="SHG loan request / कर्ज विनंती",
            body=f"{doc['borrowerName'] or uid} requested ₹{body.amountPaisa // 100} for {body.purpose}",
            deepLink=f"/womenShg/savings/loans/{loan_id}",
        )
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.get("/shg/loans")
async def list_loans(uid: str = Depends(_farmer)):
    group = await _user_group(uid)
    if group is None:
        return {"items": []}
    loans = await query(SHG_LOANS, [("shgId", "==", group["id"])], limit=500)
    loans.sort(key=lambda loan: loan.get("requestedAt", ""), reverse=True)
    return {"items": [_loan_item(loan) for loan in loans]}


async def _admin_loan(loan_id: str, uid: str) -> tuple[dict, dict]:
    group = await _admin_group(uid)
    if group is None:
        _error(403, "FORBIDDEN", "only the group admin can manage loans")
    loan = await get_doc(SHG_LOANS, loan_id)
    if loan is None or loan.get("shgId") != group["id"]:
        _error(404, "LOAN_NOT_FOUND", "loan not found for this SHG group")
    return loan, group


@router.post("/shg/loans/{loan_id}/approve")
async def approve_loan(
    loan_id: str,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_farmer),
):
    scope = f"women.loan_approve.{loan_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    loan, group = await _admin_loan(loan_id, uid)
    if loan.get("status") == "approved":
        return _loan_item(loan)
    if loan.get("status") != "requested":
        _error(409, "INVALID_LOAN_STATUS", f"loan cannot be approved from status {loan.get('status')}")
    admin = await get_user(uid) or {}
    amount = int(loan["amountPaisa"])
    months = int(loan["months"])
    base = amount // months
    first_due = _add_months(date.today(), 1)
    schedule = []
    for no in range(1, months + 1):
        installment = base + (amount % months if no == months else 0)
        schedule.append(
            {
                "no": no,
                "dueDate": _add_months(first_due, no - 1).isoformat(),
                "amountPaisa": installment,
                "status": "pending",
                "paidOn": None,
            }
        )
    loan["status"] = "approved"
    loan["approvedAt"] = _now()
    loan["schedule"] = schedule
    loan["audit"] = list(loan.get("audit") or []) + [
        {
            "at": _now(),
            "by": uid,
            "byName": admin.get("name") or "",
            "action": "approved",
            "amountPaisa": amount,
        }
    ]
    await set_doc(SHG_LOANS, loan_id, loan)
    group["loanFundPaisa"] = int(group.get("loanFundPaisa", 0) or 0) - amount
    await set_doc(SHG_GROUPS, group["id"], group)
    await notify_user(
        loan["borrowerUid"],
        type="shg_loan_approved",
        title="SHG loan approved / कर्ज मंजूर",
        body=f"₹{amount // 100} approved for {loan.get('purpose', '')} — {months} monthly installments",
        deepLink=f"/womenShg/savings/loans/{loan_id}",
    )
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, _loan_item(loan))
    return _loan_item(loan)


@router.post("/shg/loans/{loan_id}/cancel")
async def cancel_loan(loan_id: str, uid: str = Depends(_farmer)):
    loan = await get_doc(SHG_LOANS, loan_id)
    if loan is None or loan.get("borrowerUid") != uid:
        _error(404, "LOAN_NOT_FOUND", "loan not found")
    if loan.get("status") == "cancelled":
        return _loan_item(loan)
    if loan.get("status") != "requested":
        _error(409, "INVALID_LOAN_STATUS", f"loan cannot be cancelled from status {loan.get('status')}")
    user = await get_user(uid) or {}
    loan["status"] = "cancelled"
    loan["audit"] = list(loan.get("audit") or []) + [
        {
            "at": _now(),
            "by": uid,
            "byName": user.get("name") or "",
            "action": "cancelled",
            "amountPaisa": int(loan["amountPaisa"]),
        }
    ]
    await set_doc(SHG_LOANS, loan_id, loan)
    return _loan_item(loan)


@router.post("/shg/loans/{loan_id}/repay")
async def repay_loan(
    loan_id: str,
    body: LoanRepayIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_farmer),
):
    scope = f"women.loan_repay.{loan_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    loan = await get_doc(SHG_LOANS, loan_id)
    if loan is None or loan.get("borrowerUid") != uid:
        _error(404, "LOAN_NOT_FOUND", "loan not found")
    if loan.get("status") != "approved":
        _error(409, "INVALID_LOAN_STATUS", f"loan cannot be repaid from status {loan.get('status')}")
    remaining = int(loan["amountPaisa"]) - int(loan.get("repaidPaisa", 0))
    if body.amountPaisa > remaining:
        _error(409, "OVERPAYMENT", f"only ₹{remaining} remains on this loan")
    group = await get_doc(SHG_GROUPS, loan["shgId"]) or {}
    loan["repaidPaisa"] = int(loan.get("repaidPaisa", 0)) + body.amountPaisa
    paid_on = date.today().isoformat()
    cumulative = 0
    for entry in loan.get("schedule") or []:
        cumulative += int(entry.get("amountPaisa", 0))
        if entry.get("status") != "paid" and cumulative <= loan["repaidPaisa"]:
            entry["status"] = "paid"
            entry["paidOn"] = paid_on
    fully_repaid = loan["repaidPaisa"] >= int(loan["amountPaisa"])
    if fully_repaid:
        loan["status"] = "repaid"
    user = await get_user(uid) or {}
    loan["audit"] = list(loan.get("audit") or []) + [
        {
            "at": _now(),
            "by": uid,
            "byName": user.get("name") or "",
            "action": "repayment",
            "amountPaisa": body.amountPaisa,
        }
    ]
    await set_doc(SHG_LOANS, loan_id, loan)
    group["loanFundPaisa"] = int(group.get("loanFundPaisa", 0) or 0) + body.amountPaisa
    await set_doc(SHG_GROUPS, group["id"], group)
    if fully_repaid:
        await notify_user(
            uid,
            type="shg_loan_repaid",
            title="SHG loan repaid / कर्ज परतफेड पूर्ण",
            body=f"₹{int(loan['amountPaisa']) // 100} loan fully repaid — the fund is replenished",
            deepLink=f"/womenShg/savings/loans/{loan_id}",
        )
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, _loan_item(loan))
    return _loan_item(loan)


# =========================================================================
# Dashboard aggregate + deterministic insights
# =========================================================================


async def _my_deposit(group_id: str, month: str, uid: str) -> dict | None:
    return await get_doc(f"{SHG_GROUPS}/{group_id}/deposits", f"{month}_{uid}")


def _garden_summary(uid: str, plans: list[dict]) -> dict:
    mine = [p for p in plans if not p.get("template") and p.get("ownerUid") == uid]
    by_status: dict[str, int] = {}
    for plan in mine:
        status = plan.get("status") or "active"
        by_status[status] = by_status.get(status, 0) + 1
    recent = []
    for plan in sorted(mine, key=lambda p: p.get("createdAt", ""), reverse=True)[:3]:
        items = plan.get("items") or []
        recent.append(
            {
                "id": plan["id"],
                "title": plan.get("title") or plan.get("category") or "",
                "cropName": (items[0].get("name") if items else ""),
                "status": plan.get("status") or "active",
            }
        )
    return {
        "activePlans": by_status.get("active", 0),
        "byStatus": by_status,
        "recent": recent,
    }


@router.get("/dashboard")
async def women_dashboard(uid: str = Depends(_farmer)):
    group = await _user_group(uid)
    month = _ist_month()
    livestock_rows = await _livestock_rows(uid)
    plans = await query(GARDEN_PLANS, [], limit=500)
    garden = _garden_summary(uid, plans)
    due = _due_vaccinations(livestock_rows, within_days=30)[:10]
    enterprise_lines = await query(HOME_ENTERPRISES, [("ownerUid", "==", uid)], limit=200)
    if group is None:
        return {
            "group": None,
            "depositMonth": month,
            "deposits": {
                "memberCount": 0,
                "paidCount": 0,
                "paidTotalPaisa": 0,
                "expectedTotalPaisa": 0,
                "myPaid": False,
            },
            "garden": garden,
            "livestock": {
                "animalCount": len(livestock_rows),
                "dueVaccinations": due,
            },
            "enterprise": {
                "totalMonthlyProfitPaisa": sum(
                    int(line.get("monthlyProfitPaisa", 0)) for line in enterprise_lines
                ),
                "lineCount": len(enterprise_lines),
            },
            "loans": {"pendingCount": 0, "activeCount": 0, "myActive": None},
            "joinRequests": {"pendingCount": 0},
        }
    member_count = int(group.get("memberCount", 0) or 0)
    monthly_deposit = int(group.get("monthlyDepositPaisa", 0) or 0)
    member_docs = [
        d
        for d in await query(f"{SHG_GROUPS}/{group['id']}/deposits", [], limit=1000)
        if d.get("memberUid") and d.get("month") == month
    ]
    loans = await query(SHG_LOANS, [("shgId", "==", group["id"])], limit=500)
    my_active = next(
        (
            loan
            for loan in loans
            if loan.get("borrowerUid") == uid and loan.get("status") == "approved"
        ),
        None,
    )
    next_due = None
    if my_active:
        next_due = next(
            (
                entry
                for entry in my_active.get("schedule") or []
                if entry.get("status") == "pending"
            ),
            None,
        )
    is_admin = _group_admin_uid(group) == uid
    pending_requests = 0
    if is_admin:
        requests = await query(SHG_JOIN_REQUESTS, [("shgId", "==", group["id"])], limit=500)
        pending_requests = len([r for r in requests if r.get("status") == "pending"])
    return {
        "group": {
            "id": group["id"],
            "name": group.get("name", ""),
            "village": group.get("village"),
            "district": group.get("district"),
            "memberCount": member_count,
            "corpusPaisa": int(group.get("corpusPaisa", 0) or 0),
            "loanFundPaisa": int(group.get("loanFundPaisa", 0) or 0),
            "monthlyDepositPaisa": monthly_deposit,
            "formedAt": group.get("formedAt") or group.get("createdAt") or "",
            "isAdmin": is_admin,
        },
        "depositMonth": month,
        "deposits": {
            "memberCount": member_count,
            "paidCount": len(member_docs),
            "paidTotalPaisa": sum(int(d.get("amountPaisa", 0)) for d in member_docs),
            "expectedTotalPaisa": member_count * monthly_deposit,
            "myPaid": await _my_deposit(group["id"], month, uid) is not None,
        },
        "garden": garden,
        "livestock": {
            "animalCount": len(livestock_rows),
            "dueVaccinations": due,
        },
        "enterprise": {
            "totalMonthlyProfitPaisa": sum(
                int(line.get("monthlyProfitPaisa", 0)) for line in enterprise_lines
            ),
            "lineCount": len(enterprise_lines),
        },
        "loans": {
            "pendingCount": len([loan for loan in loans if loan.get("status") == "requested"]),
            "activeCount": len([loan for loan in loans if loan.get("status") == "approved"]),
            "myActive": (
                {
                    "id": my_active["id"],
                    "amountPaisa": int(my_active["amountPaisa"]),
                    "repaidPaisa": int(my_active.get("repaidPaisa", 0)),
                    "nextDueDate": (next_due or {}).get("dueDate"),
                    "nextDuePaisa": (next_due or {}).get("amountPaisa"),
                }
                if my_active
                else None
            ),
        },
        "joinRequests": {"pendingCount": pending_requests},
    }


def _last_months(count: int) -> list[str]:
    """The last `count` 'YYYY-MM' keys, oldest first, in IST."""
    today = datetime.now(timezone.utc).astimezone(IST).date()
    months = []
    month_index = today.year * 12 + today.month - 1
    for offset in range(count - 1, -1, -1):
        idx = month_index - offset
        months.append(f"{idx // 12:04d}-{idx % 12 + 1:02d}")
    return months


@router.get("/insights")
async def women_insights(uid: str = Depends(_farmer)):
    group = await _user_group(uid)
    month = _ist_month()
    today = date.today()

    # savings trend — last 6 months of the group's per-member deposits
    months = _last_months(6)
    deposit_docs = (
        await query(f"{SHG_GROUPS}/{group['id']}/deposits", [], limit=1000)
        if group
        else []
    )
    savings_trend = []
    for key in months:
        docs = [d for d in deposit_docs if d.get("memberUid") and d.get("month") == key]
        savings_trend.append(
            {
                "month": key,
                "depositsPaisa": sum(int(d.get("amountPaisa", 0)) for d in docs),
                "count": len(docs),
            }
        )

    # loan health
    loans = (
        await query(SHG_LOANS, [("shgId", "==", group["id"])], limit=500)
        if group
        else []
    )
    overdue = 0
    for loan in loans:
        if loan.get("status") != "approved":
            continue
        if any(
            entry.get("status") == "pending" and entry.get("dueDate", "") < today.isoformat()
            for entry in loan.get("schedule") or []
        ):
            overdue += 1
    loan_health = {
        "requested": len([loan for loan in loans if loan.get("status") == "requested"]),
        "active": len([loan for loan in loans if loan.get("status") == "approved"]),
        "repaid": len([loan for loan in loans if loan.get("status") == "repaid"]),
        "overdue": overdue,
        "fundPaisa": int(group.get("loanFundPaisa", 0) or 0) if group else 0,
    }

    # garden
    plans = await query(GARDEN_PLANS, [], limit=500)
    mine = [p for p in plans if not p.get("template") and p.get("ownerUid") == uid]
    by_status: dict[str, int] = {}
    for plan in mine:
        status = plan.get("status") or "active"
        by_status[status] = by_status.get(status, 0) + 1

    # livestock
    livestock_rows = await _livestock_rows(uid)
    due_count = len(_due_vaccinations(livestock_rows, within_days=30))

    # enterprise
    enterprise_lines = await query(HOME_ENTERPRISES, [("ownerUid", "==", uid)], limit=200)
    total_profit = sum(int(line.get("monthlyProfitPaisa", 0)) for line in enterprise_lines)
    best_seller = None
    suggestion = "Add your first home-enterprise line to get growth suggestions."
    if enterprise_lines:
        def _revenue(line: dict) -> int:
            return int(line.get("revenuePaisa") or line.get("monthlyProfitPaisa", 0))

        top = max(enterprise_lines, key=_revenue)
        revenue = _revenue(top)
        profit = int(top.get("monthlyProfitPaisa", 0))
        margin = profit / revenue if revenue else 0.0
        best_seller = {
            "name": top.get("product", ""),
            "revenuePaisa": revenue,
            "profitPaisa": profit,
        }
        if margin < 0.20:
            hike_paisa = int(round(revenue * 0.10))
            suggestion = (
                f"Your best seller {best_seller['name']} has a thin margin "
                f"({round(margin * 100)}%). A ~10% price increase (about "
                f"₹{hike_paisa // 100}) would protect the profit."
            )
        else:
            suggestion = (
                f"{best_seller['name']} is your strongest line — scale it by "
                f"raising production and listing more stock."
            )

    return {
        "savingsTrend": savings_trend,
        "loanHealth": loan_health,
        "garden": {
            "activePlans": by_status.get("active", 0),
            "byStatus": by_status,
            "harvested": by_status.get("harvested", 0),
        },
        "livestock": {
            "animalCount": len(livestock_rows),
            "dueVaccinations": due_count,
        },
        "enterprise": {
            "totalMonthlyProfitPaisa": total_profit,
            "bestSeller": best_seller,
            "suggestion": suggestion,
        },
    }
