import re

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, set_doc
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services.land_records import get_adapter
from app.services.users import get_user

router = APIRouter(prefix="/land-records", tags=["land-records"])

_GAT_PATTERN = re.compile(r"^[A-Za-z0-9]{1,20}$")


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "farmLandlord")
    return user


@router.get("/search")
async def search_records(
    gatNumber: str | None = None,
    village: str | None = None,
    district: str | None = None,
    type: str = "712",
    user: dict = Depends(_user),
):
    if type not in ("712", "8A"):
        _error(422, "VALIDATION_ERROR", "type must be 712 or 8A")
    if gatNumber is None and village is None:
        _error(400, "MISSING_SEARCH_PARAM", "गट क्रमांक या गांव लिखें")
    if gatNumber is not None and not _GAT_PATTERN.match(gatNumber):
        _error(422, "VALIDATION_ERROR", "gatNumber must be 1-20 alphanumeric characters")
    if village is not None and len(village) < 3:
        _error(422, "VALIDATION_ERROR", "village must be at least 3 characters")
    records = get_adapter().search(gatNumber, village, district, type)
    items = [r.model_dump() for r in records]
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.get("/{record_id}/pdf")
async def get_record_pdf(record_id: str, user: dict = Depends(_user)):
    url = get_adapter().get_pdf_url(record_id)
    if url is None:
        _error(404, "RECORD_NOT_FOUND", "record not found")
    return {"pdfUrl": url}


@router.post("/{record_id}/import")
async def import_record(record_id: str, user: dict = Depends(_user)):
    record = get_adapter().get_by_id(record_id)
    if record is None:
        _error(404, "RECORD_NOT_FOUND", "record not found")
    user["landAreaAcres"] = record.totalAreaAcres
    land_records = user.get("landRecords", [])
    land_records.append(
        {
            "gatNumber": record.gatNumber,
            "village": record.village,
            "ownerName": record.ownerName,
            "cropHistory": record.cropHistory,
        }
    )
    user["landRecords"] = land_records
    await set_doc("users", user["id"], user)
    return {"imported": True, "landAreaAcres": record.totalAreaAcres}
