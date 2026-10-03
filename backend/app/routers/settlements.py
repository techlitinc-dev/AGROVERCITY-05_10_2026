from fastapi import APIRouter, Depends, HTTPException

from app.core.db import query
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(tags=["settlements"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


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
async def transport_settlements(uid: str = Depends(current_user_id)):
    return await _my_settlements(uid, "transport")


@router.get("/equipment/settlements")
async def equipment_settlements(uid: str = Depends(current_user_id)):
    return await _my_settlements(uid, "equipmentRental")


@router.get("/broker/settlements")
async def broker_settlements(uid: str = Depends(current_user_id)):
    return await _my_settlements(uid, "broker")
