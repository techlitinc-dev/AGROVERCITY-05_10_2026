import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.direct import DemandCreate, DemandUpdate
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/demands", tags=["demands"])

LIVE_OFFER_STATUSES = ("pending", "countered")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _direct_buyer(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "directBuyer", "seller")
    return user, uid


async def _company_of(uid: str) -> str:
    profile = await get_doc(f"users/{uid}/role_profiles", "directBuyer")
    company = (profile or {}).get("companyName", "")
    if not company:
        seller_profile = await get_doc(f"users/{uid}/role_profiles", "seller")
        company = (seller_profile or {}).get("shopName", "")
    return company


@router.post("", status_code=201)
async def create_demand(body: DemandCreate, ctx: tuple = Depends(_direct_buyer)):
    user, uid = ctx
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **body.model_dump(),
        "id": f"dem_{uuid.uuid4().hex[:12]}",
        "buyerId": uid,
        "buyerName": user.get("name", ""),
        "buyerCompany": await _company_of(uid),
        "state": user.get("state", ""),
        "status": "open",
        "offersCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("demands", doc["id"], doc)
    return doc


@router.get("")
async def list_demands(
    crop: str | None = None,
    state: str | None = None,
    status: str = "open",
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    if status == "all":
        docs = await query("demands", [("buyerId", "==", uid)], limit=1000)
    else:
        docs = await query("demands", [("status", "==", "open")], limit=1000)
    if crop:
        docs = [d for d in docs if crop.lower() in d.get("crop", "").lower()]
    if state:
        docs = [d for d in docs if d.get("state", "").lower() == state.lower()]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


async def _own_demand(demand_id: str, uid: str) -> dict:
    doc = await get_doc("demands", demand_id)
    if doc is None:
        _error(404, "DEMAND_NOT_FOUND", "demand not found")
    if doc.get("buyerId") != uid:
        _error(403, "FORBIDDEN", "not the demand owner")
    return doc


@router.get("/{demand_id}")
async def get_demand(demand_id: str, uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    doc = await get_doc("demands", demand_id)
    if doc is None:
        _error(404, "DEMAND_NOT_FOUND", "demand not found")
    return doc


@router.put("/{demand_id}")
async def update_demand(demand_id: str, body: DemandUpdate, uid: str = Depends(current_user_id)):
    doc = await _own_demand(demand_id, uid)
    if doc.get("status") != "open":
        _error(400, "DEMAND_CLOSED", "only open demands can be edited")
    doc.update(body.model_dump(exclude_none=True))
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("demands", demand_id, doc)
    return doc


@router.post("/{demand_id}/close")
async def close_demand(demand_id: str, uid: str = Depends(current_user_id)):
    doc = await _own_demand(demand_id, uid)
    if doc.get("status") == "closed":
        return doc
    doc["status"] = "closed"
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("demands", demand_id, doc)
    return doc


@router.post("/{demand_id}/reopen")
async def reopen_demand(demand_id: str, uid: str = Depends(current_user_id)):
    doc = await _own_demand(demand_id, uid)
    if doc.get("status") != "closed":
        _error(400, "DEMAND_NOT_CLOSED", "only closed demands can be reopened")
    doc["status"] = "open"
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("demands", demand_id, doc)
    return doc


@router.delete("/{demand_id}", status_code=204)
async def delete_demand(demand_id: str, uid: str = Depends(current_user_id)):
    doc = await _own_demand(demand_id, uid)
    offers = await query(
        "offers",
        [("targetType", "==", "demand"), ("targetId", "==", demand_id)],
        limit=1000,
    )
    if any(o.get("status") in LIVE_OFFER_STATUSES for o in offers):
        _error(409, "DEMAND_HAS_OFFERS", "demand has live offers and cannot be deleted")
    await delete_doc("demands", demand_id)
