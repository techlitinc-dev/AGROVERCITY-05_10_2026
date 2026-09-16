import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.lots import LotRequest, LotOut
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/market", tags=["lots"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _farmer_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return uid


def _validate_lot(body: LotRequest):
    if body.quantityQuintals <= 0:
        _error(422, "VALIDATION_ERROR", "invalid lot", {"quantityQuintals": "must be greater than 0"})
    if body.expectedRate < 0:
        _error(422, "VALIDATION_ERROR", "invalid lot", {"expectedRate": "must be 0 or more"})


@router.post("/lots", status_code=201, response_model=LotOut)
async def create_lot(body: LotRequest, uid: str = Depends(_farmer_user)):
    _validate_lot(body)
    doc = {
        **body.model_dump(),
        "id": f"lot_{uuid.uuid4().hex[:12]}",
        "farmerId": uid,
        "status": "open",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("market_lots", doc["id"], doc)
    return doc


@router.get("/lots")
async def list_lots(
    status: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_farmer_user),
):
    docs = await query("market_lots", [("farmerId", "==", uid)], limit=1000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


@router.put("/lots/{lot_id}", response_model=LotOut)
async def update_lot(lot_id: str, body: LotRequest, uid: str = Depends(_farmer_user)):
    doc = await get_doc("market_lots", lot_id)
    if doc is None or doc.get("farmerId") != uid:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    if doc.get("status") == "sold":
        _error(409, "LOT_NOT_EDITABLE", "a sold lot cannot be edited")
    _validate_lot(body)
    doc.update(body.model_dump())
    await set_doc("market_lots", lot_id, doc)
    return doc


@router.delete("/lots/{lot_id}")
async def withdraw_lot(lot_id: str, uid: str = Depends(_farmer_user)):
    doc = await get_doc("market_lots", lot_id)
    if doc is None or doc.get("farmerId") != uid:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    if doc.get("status") == "sold":
        _error(409, "LOT_NOT_EDITABLE", "a sold lot cannot be withdrawn")
    doc["status"] = "withdrawn"
    await set_doc("market_lots", lot_id, doc)
    return {"ok": True, "status": "withdrawn"}
