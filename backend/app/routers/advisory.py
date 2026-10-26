import json
import logging
import math
from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.core.db import delete_doc, get_doc, query, query_cursor, set_doc
from app.core.deps import current_user_id
from app.models.advisory import (
    SCAN_MODES,
    CropPlanConfirmIn,
    CropPlanConfirmOut,
    CropPlanIn,
    CropPlanOption,
    CropPlanOut,
    NpkIn,
    NpkOut,
    SaturationIn,
    SaturationOut,
    SowingIntentIn,
)
from app.routers.users import require_role
from app.services import advisory as advisory_service
from app.services import storage
from app.services.consents import ConsentRequiredError, require_data_sharing
from app.services.disease_model import get_disease_adapter
from app.services.tasks import emit_task
from app.services.users import get_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/advisory", tags=["advisory"])

CROP_PLAN_CACHE_TTL_SECONDS = 6 * 60 * 60

RETAKE_NOT_LEAF = {
    "en": "This does not look like a plant leaf — please photograph a single leaf filling the frame.",
    "hi": "यह पौधे की पत्ती नहीं लगती — कृपया एक पत्ती को फ्रेम में भरकर फोटो लें।",
}
RETAKE_BLURRY = {
    "en": "The photo is too blurry or poorly lit — retake it in daylight with the leaf in focus.",
    "hi": "फोटो धुंधली या कम रोशनी वाली है — दिन के उजाले में पत्ती पर फोकस करके दोबारा लें।",
}

# Generated task schedule when a crop plan is confirmed (playbook step 5).
CROP_PLAN_TASK_SCHEDULE = (
    ("land_prep", "Prepare the field for {crop}", "{crop} के लिए खेत तैयार करें"),
    ("sowing", "Sow {crop} on schedule", "{crop} की बुवाई समय पर करें"),
    ("first_irrigation", "First irrigation for {crop}", "{crop} की पहली सिंचाई करें"),
    ("top_dressing", "Top-dress fertiliser for {crop}", "{crop} के लिए खाद दें"),
)


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


# ---------- Market saturation (M13) ----------


def _resolve_saturation_location(body: SaturationIn, user: dict) -> SaturationIn:
    """Fill omitted district/lat/lng from the farmer's profile: district from
    the user doc, coordinates from the first farm-boundary point."""
    district = body.district or user.get("district") or ""
    lat, lng = body.lat, body.lng
    if lat is None or lng is None:
        points = user.get("farmBoundaryPoints") or []
        first = points[0] if points else {}
        if isinstance(first, dict):
            lat = body.lat if body.lat is not None else first.get("lat")
            lng = body.lng if body.lng is not None else first.get("lng")
    return SaturationIn(
        crop=body.crop,
        district=district,
        lat=lat,
        lng=lng,
        radiusKm=body.radiusKm,
        shareSowingIntent=body.shareSowingIntent,
    )


@router.post("/saturation", response_model=SaturationOut)
async def saturation_check(body: SaturationIn, user: dict = Depends(_farmer)):
    body = _resolve_saturation_location(body, user)
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
    result = await advisory_service.saturation(body)
    if result.riskLevel == "red":
        await emit_task(
            user_id=user["id"],
            persona="farmer",
            module="advisory",
            kind="saturation_high",
            title_en=f"High sowing saturation for {body.crop}",
            title_hi=f"{body.crop} की बुवाई अधिक है",
            subtitle=result.dataBasis.get("district", ""),
            priority="upcoming",
            deep_link="/dashboard/p/advisoryHub",
            source_id=f"{body.crop}_{body.district}",
        )
    return result


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
    # Season auto-detection: derive the cropping season from the planned
    # sowing month (falls back to the current calendar season).
    season = advisory_service.season_for_date(body.plannedDate)
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
    return {"recorded": True, "isIntent": True, "season": season}


# ---------- Disease scan (M9, SDR + vision) ----------


@router.post("/disease-scan")
async def disease_scan(
    image: UploadFile = File(...),
    plotId: str | None = Form(None),
    cropHint: str | None = Form(None),
    scanMode: str | None = Form(None),
    user: dict = Depends(_farmer),
):
    mode = (scanMode or "general").strip().lower()
    if mode not in SCAN_MODES:
        mode = "general"
    data = await storage.validate_upload(image)
    blob_path, _ = storage.upload_user_file(
        user["id"], data, image.filename or "scan", image.content_type, prefix="scans"
    )
    photo_url = storage.signed_download_url(blob_path)
    model_bytes = advisory_service.downscale_for_vision(data)

    # Gate the image BEFORE diagnosis (M9); the gate model call lives in
    # services/advisory.py (rule 10 — never a model outside the gateway).
    gate = await advisory_service.disease_image_gate(model_bytes)
    if not gate["is_plant_leaf"] or not gate["quality_ok"]:
        retake = RETAKE_NOT_LEAF if not gate["is_plant_leaf"] else RETAKE_BLURRY
        return {
            "gate": {**gate, "passed": False},
            "retake": retake,
            "results": [],
            "demo": False,
            "scanId": None,
        }

    results = await get_disease_adapter().scan(model_bytes, crop_hint=cropHint, scan_mode=mode)
    demo = settings.ai_provider == "shim"
    top = results[0] if results else None
    confidence = float(top.confidence) if top else 0.0

    scan_id = f"scan_{uuid4().hex[:12]}"
    await set_doc(
        "disease_scans",
        scan_id,
        {
            "scan_id": scan_id,
            "farmerId": user["id"],
            "plotId": plotId,
            "scanMode": mode,
            "photo_url": photo_url,
            "diagnosis": top.model_dump() if top else None,
            "confidence": confidence,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )

    if top is not None and confidence < 0.7:
        ticket_id = f"ticket_{uuid4().hex[:12]}"
        await set_doc(
            "expert_tickets",
            ticket_id,
            {
                "ticket_id": ticket_id,
                "farmerId": user["id"],
                "photo_url": photo_url,
                "diagnosis": top.model_dump(),
                "confidence": confidence,
                "status": "open",
                "createdAt": datetime.now(timezone.utc).isoformat(),
            },
        )

    if top is not None and (top.chemicalTreatment or top.organicTreatment):
        await emit_task(
            user_id=user["id"],
            persona="farmer",
            module="advisory",
            kind="disease_treatment",
            title_en=f"Treatment advised for {top.diseaseName}",
            title_hi=f"{top.diseaseName} के लिए उपचार की सलाह",
            subtitle=top.dosage or top.diseaseName,
            priority="today",
            deep_link="/dashboard/p/advisoryHub",
            source_id=scan_id,
        )

    return {
        "gate": {**gate, "passed": True},
        "retake": None,
        "results": [result.model_dump() for result in results],
        "scanMode": mode,
        "demo": demo,
        "scanId": scan_id,
    }


@router.get("/disease-scans")
async def disease_scans(
    plotId: str | None = None,
    cursor: str | None = None,
    limit: int = 20,
    user: dict = Depends(_farmer),
):
    filters = [("farmerId", "==", user["id"])]
    if plotId is not None:
        filters.append(("plotId", "==", plotId))
    docs = await query("disease_scans", filters, limit=limit)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    next_cursor = docs[-1]["createdAt"] if len(docs) == limit else None
    return {
        "data": [
            {
                "scanId": doc.get("scan_id"),
                "plotId": doc.get("plotId"),
                "scanMode": doc.get("scanMode", "general"),
                "photoUrl": doc.get("photo_url"),
                "diagnosis": doc.get("diagnosis"),
                "confidence": doc.get("confidence"),
                "createdAt": doc.get("createdAt"),
            }
            for doc in docs
        ],
        "nextCursor": next_cursor,
    }


@router.delete("/disease-scans/{scan_id}")
async def delete_disease_scan(scan_id: str, user: dict = Depends(_farmer)):
    doc = await get_doc("disease_scans", scan_id)
    if doc is None or doc.get("farmerId") != user["id"]:
        _error(404, "NOT_FOUND", "scan not found")
    await delete_doc("disease_scans", scan_id)
    return {"deleted": True, "scanId": scan_id}


# ---------- NPK calculator ----------


@router.post("/npk", response_model=NpkOut)
async def npk(body: NpkIn, user: dict = Depends(_farmer)):
    return advisory_service.npk_recommendation(body)


# ---------- Crop planner (M13, SGR) ----------


@router.post("/crop-plan", response_model=CropPlanOut)
async def crop_plan(body: CropPlanIn, user: dict = Depends(_farmer)):
    """Suggest 2-3 detailed crop plans. Never creates a crop_cycle (`suggest`)."""
    season = body.season or advisory_service.current_season()
    cache_key = advisory_service.crop_plan_cache_key(body)
    cached = await cache_get(cache_key)
    if cached is not None:
        try:
            payload = json.loads(cached)
            return CropPlanOut(
                options=[CropPlanOption(**opt) for opt in payload["options"]],
                source=payload.get("source", "fallback"),
                season=season,
                cached=True,
                decisionId=None,
                automationLevel="suggest",
            )
        except (KeyError, ValueError, TypeError):
            cached = None

    options, source = await advisory_service.generate_crop_options(body)
    await cache_set(
        cache_key,
        json.dumps({"options": [opt.model_dump() for opt in options], "source": source}),
        ttl_seconds=CROP_PLAN_CACHE_TTL_SECONDS,
    )
    return CropPlanOut(
        options=options, source=source, season=season, cached=False, automationLevel="suggest"
    )


@router.post("/crop-plan/confirm", response_model=CropPlanConfirmOut)
async def crop_plan_confirm(
    body: CropPlanConfirmIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(_farmer),
):
    """Farmer-confirmed plan: create a real crop_cycle + schedule its tasks."""
    # Season: explicit choice wins; otherwise auto-detect from the planned date.
    if body.season:
        season = body.season
    elif body.plannedDate:
        season = advisory_service.season_for_date(body.plannedDate)
    else:
        season = advisory_service.current_season()
    cycle_id = f"{user['id']}_{body.crop}_{season}"
    existing = await get_doc("crop_cycles", cycle_id)
    created = existing is None
    if created:
        await set_doc(
            "crop_cycles",
            cycle_id,
            {
                "userId": user["id"],
                "crop": body.crop,
                "plotId": body.plotId,
                "district": body.district,
                "season": season,
                "plannedDate": body.plannedDate,
                "isIntent": False,
                "fromPlanner": True,
                "rationale": body.rationale,
                "planDetails": body.planDetails,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            },
        )

    task_ids: list[str] = []
    for kind, title_en, title_hi in CROP_PLAN_TASK_SCHEDULE:
        task_ids.append(
            await emit_task(
                user_id=user["id"],
                persona="farmer",
                module="advisory",
                kind=kind,
                title_en=title_en.format(crop=body.crop),
                title_hi=title_hi.format(crop=body.crop),
                subtitle=body.district,
                priority="upcoming",
                deep_link="/dashboard/p/advisoryHub",
                source_id=cycle_id,
            )
        )
    return CropPlanConfirmOut(cropCycleId=cycle_id, created=created, taskIds=task_ids)


# ---------- Pest radar (5 km) ----------


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


@router.get("/pest-radar")
async def pest_radar(
    lat: float,
    lng: float,
    radiusKm: int = 5,
    user: dict = Depends(_farmer),
):
    """Pest reports within `radiusKm` of the farmer (real `pest_reports` collection)."""
    reports = await query("pest_reports", [], limit=500)
    alerts = []
    for report in reports:
        r_lat = report.get("lat")
        r_lng = report.get("lng")
        if not isinstance(r_lat, (int, float)) or not isinstance(r_lng, (int, float)):
            continue
        distance = _haversine_km(lat, lng, float(r_lat), float(r_lng))
        if distance <= radiusKm:
            alerts.append(
                {
                    "disease": report.get("disease") or report.get("pest") or "",
                    "crop": report.get("crop") or "",
                    "distanceKm": round(distance, 1),
                    "riskLevel": report.get("riskLevel") or "green",
                    "reportedAt": report.get("reportedAt") or "",
                }
            )
    if alerts:
        await emit_task(
            user_id=user["id"],
            persona="farmer",
            module="advisory",
            kind="pest_alert",
            title_en=f"{len(alerts)} pest report(s) within {radiusKm} km",
            title_hi=f"{radiusKm} किमी के भीतर {len(alerts)} कीट रिपोर्ट",
            subtitle=alerts[0]["crop"],
            priority="today",
            deep_link="/dashboard/p/advisoryHub",
            source_id=f"pest_{lat}_{lng}",
        )
    return {"data": alerts, "page": 1, "pageSize": 20, "total": len(alerts)}


# ---------- Advisory articles (admin CMS -> farmer read) ----------


@router.get("/articles")
async def list_advisory_articles(
    crop: str | None = None,
    season: str | None = None,
    region: str | None = None,
    limit: int = 50,
    user: dict = Depends(_farmer),
):
    """Published advisory articles only (written by the admin CMS desk at
    /admin/advisory/articles). Region matches the farmer's state/district."""
    docs = await query("advisories", [("status", "==", "published")], limit=500)
    farmer_region = " ".join(
        str(user.get(k) or "") for k in ("state", "district", "village")
    ).strip().lower()
    rows = []
    for doc in docs:
        if doc.get("active") is False:
            continue
        if crop and crop.lower() not in (doc.get("crop") or "").lower():
            continue
        if season and (doc.get("season") or "").lower() != season.lower():
            continue
        article_region = (doc.get("region") or "").strip().lower()
        if region:
            if article_region and article_region not in region.strip().lower():
                continue
        elif article_region and article_region not in farmer_region:
            continue
        rows.append(
            {
                "articleId": doc.get("articleId") or doc.get("id"),
                "crop": doc.get("crop"),
                "region": doc.get("region"),
                "season": doc.get("season"),
                "title": doc.get("title"),
                "body": doc.get("body"),
                "publishedAt": doc.get("updatedAt") or doc.get("createdAt"),
            }
        )
    rows.sort(key=lambda r: r.get("publishedAt") or "", reverse=True)
    return {"data": rows[:limit], "total": len(rows)}
