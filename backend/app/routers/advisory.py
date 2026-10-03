from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.db import get_doc, set_doc
from app.core.deps import current_user_id
from app.models.advisory import NpkIn, NpkOut, SaturationIn, SaturationOut, SowingIntentIn
from app.routers.users import require_role
from app.services import advisory as advisory_service
from app.services import storage
from app.services.consents import ConsentRequiredError, require_data_sharing
from app.services.disease_model import get_disease_adapter
from app.services.users import get_user

router = APIRouter(prefix="/advisory", tags=["advisory"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _farmer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return user


@router.post("/saturation", response_model=SaturationOut)
async def saturation_check(body: SaturationIn, user: dict = Depends(_farmer)):
    if body.shareSowingIntent:
        season = advisory_service.current_season()
        await set_doc(
            "crop_cycles",
            f"{user['id']}_{body.crop}_{season}",
            {
                "userId": user["id"],
                "crop": body.crop,
                "district": body.district,
                "lat": body.lat,
                "lng": body.lng,
                "season": season,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            },
        )
    return await advisory_service.saturation(body)


@router.post("/sowing-intent", status_code=201)
async def sowing_intent(body: SowingIntentIn, user: dict = Depends(_farmer)):
    if date.fromisoformat(body.plannedDate) < date.today():
        _error(422, "PAST_DATE", "योजित तिथि भूतकाल में नहीं हो सकती")
    if body.plotId is not None:
        plot = await get_doc(f"users/{user['id']}/land_plots", body.plotId)
        if plot is None:
            _error(404, "PLOT_NOT_FOUND", "प्लॉट नहीं मिला")
    try:
        await require_data_sharing(user["id"])
    except ConsentRequiredError as exc:
        _error(403, "CONSENT_REQUIRED", str(exc))
    season = advisory_service.current_season()
    await set_doc(
        "crop_cycles",
        f"{user['id']}_{body.crop}_{season}",
        {
            "userId": user["id"],
            "crop": body.crop,
            "plotId": body.plotId,
            "district": user.get("district"),
            "lat": user.get("lat"),
            "lng": user.get("lng"),
            "season": season,
            "plannedDate": body.plannedDate,
            "isIntent": True,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"recorded": True, "isIntent": True}


@router.post("/disease-scan")
async def disease_scan(image: UploadFile = File(...), user: dict = Depends(_farmer)):
    data = await storage.validate_upload(image)
    storage.upload_user_file(
        user["id"], data, image.filename or "scan", image.content_type, prefix="scans"
    )
    results = await get_disease_adapter().scan(data)
    return {"results": [r.model_dump() for r in results]}


@router.get("/pest-radar")
async def pest_radar(
    lat: float,
    lng: float,
    radiusKm: int = 5,
    user: dict = Depends(_farmer),
):
    today = date.today().isoformat()
    alerts = [
        {"disease": "Pink bollworm", "crop": "Cotton", "distanceKm": 3.2, "riskLevel": "yellow", "reportedAt": today},
        {"disease": "Leaf curl", "crop": "Chilli", "distanceKm": 4.8, "riskLevel": "green", "reportedAt": today},
    ]
    return {"data": alerts, "page": 1, "pageSize": 20, "total": len(alerts)}


@router.post("/npk", response_model=NpkOut)
async def npk(body: NpkIn, user: dict = Depends(_farmer)):
    return advisory_service.npk_recommendation(body)
