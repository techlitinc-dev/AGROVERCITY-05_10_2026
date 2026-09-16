import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.addresses import AddressRequest

router = APIRouter(prefix="/addresses", tags=["addresses"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _validate_pincode(pincode: str):
    if len(pincode) != 6 or not pincode.isdigit():
        _error(422, "VALIDATION_ERROR", "invalid pincode", {"pincode": "must be exactly 6 digits"})


async def _user_addresses(uid: str) -> list[dict]:
    return await query("addresses", [("userId", "==", uid)], limit=1000)


async def _clear_other_defaults(uid: str, keep_id: str):
    for doc in await _user_addresses(uid):
        if doc["id"] != keep_id and doc.get("isDefault"):
            doc["isDefault"] = False
            await set_doc("addresses", doc["id"], doc)


@router.get("")
async def list_addresses(uid: str = Depends(current_user_id)):
    docs = await _user_addresses(uid)
    docs.sort(key=lambda d: (not d.get("isDefault"), d.get("createdAt", "")))
    return {"data": docs}


@router.post("", status_code=201)
async def create_address(body: AddressRequest, uid: str = Depends(current_user_id)):
    _validate_pincode(body.pincode)
    existing = await _user_addresses(uid)
    doc = {
        **body.model_dump(),
        "id": f"addr_{uuid.uuid4().hex[:12]}",
        "userId": uid,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    if not existing:
        doc["isDefault"] = True
    if doc["isDefault"]:
        await _clear_other_defaults(uid, doc["id"])
    await set_doc("addresses", doc["id"], doc)
    return doc


@router.put("/{address_id}")
async def update_address(address_id: str, body: AddressRequest, uid: str = Depends(current_user_id)):
    doc = await get_doc("addresses", address_id)
    if doc is None or doc.get("userId") != uid:
        _error(404, "ADDRESS_NOT_FOUND", "address not found")
    _validate_pincode(body.pincode)
    doc.update(body.model_dump())
    if doc["isDefault"]:
        await _clear_other_defaults(uid, address_id)
    await set_doc("addresses", address_id, doc)
    return doc


@router.delete("/{address_id}", status_code=204)
async def delete_address(address_id: str, uid: str = Depends(current_user_id)):
    doc = await get_doc("addresses", address_id)
    if doc is None or doc.get("userId") != uid:
        _error(404, "ADDRESS_NOT_FOUND", "address not found")
    was_default = doc.get("isDefault", False)
    await delete_doc("addresses", address_id)
    remaining = await _user_addresses(uid)
    if was_default and remaining:
        remaining.sort(key=lambda d: d.get("createdAt", ""))
        oldest = remaining[0]
        oldest["isDefault"] = True
        await set_doc("addresses", oldest["id"], oldest)
    return Response(status_code=204)
