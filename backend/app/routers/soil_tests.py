import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.soil_tests import SoilTestBookIn, SoilTestOut
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/soil-tests", tags=["soil-tests"])


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _uid(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "farmLandlord")
    return uid


@router.post("/book", status_code=201, response_model=SoilTestOut)
async def book_soil_test(body: SoilTestBookIn, uid: str = Depends(_uid)):
    if body.plotId is not None:
        plot = await get_doc(f"users/{uid}/land_plots", body.plotId)
        if plot is None:
            _error(404, "PLOT_NOT_FOUND", "plot not found")
        existing = await query(f"users/{uid}/soil_tests", [], limit=200)
        if any(
            b.get("plotId") == body.plotId and b.get("status") != "reportReady"
            for b in existing
        ):
            _error(409, "SOIL_TEST_ALREADY_BOOKED", "इस प्लॉट का परीक्षण पहले से बुक है")
    test_id = f"st_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": test_id,
        "plotId": body.plotId,
        "address": body.address,
        "slot": body.slot,
        "status": "booked",
        "resultPdfUrl": None,
        "bookedAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"users/{uid}/soil_tests", test_id, doc)
    return SoilTestOut(**doc)


@router.get("")
async def list_soil_tests(uid: str = Depends(_uid)):
    docs = await query(f"users/{uid}/soil_tests", [], limit=200)
    docs.sort(key=lambda d: d.get("bookedAt", ""), reverse=True)
    return {"data": docs, "page": 1, "pageSize": 20, "total": len(docs)}
