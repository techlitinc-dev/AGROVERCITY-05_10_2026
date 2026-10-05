import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.specs import CropSpecCreate
from app.routers.users import require_role
from app.services import idempotency
from app.services.users import get_user

router = APIRouter(prefix="/specs", tags=["specs"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _buyer_user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "USER_NOT_FOUND", "user not found")
    require_role(user, "directBuyer", "seller", "buyer", "admin")
    return user


@router.get("")
async def list_specs(crop: str | None = None):
    specs = await query("crop_specs", [], limit=500)
    if crop:
        specs = [s for s in specs if (s.get("crop") or "").lower() == crop.lower()]
    return specs


@router.post("", status_code=201)
async def create_spec(
    body: CropSpecCreate,
    user: dict = Depends(_buyer_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    stored = await idempotency.replay("spec.create", idempotency_key)
    if stored is not None:
        return stored

    spec_id = f"spec_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": spec_id,
        "crop": body.crop,
        "name": body.name,
        "params": [p.model_dump() for p in body.params],
        "createdBy": user["id"],
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await set_doc("crop_specs", spec_id, doc)
    if idempotency_key:
        await idempotency.store("spec.create", idempotency_key, doc)
    return doc
