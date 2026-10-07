import json
import logging
import math
from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field, ValidationError

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.core.db import get_doc, query, query_cursor, set_doc
from app.core.deps import current_user_id
from app.models.advisory import (
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
from app.services.ai import gateway
from app.services.consents import ConsentRequiredError, require_data_sharing
from app.services.disease_model import get_disease_adapter
from app.services.tasks import emit_task
from app.services.users import get_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/advisory", tags=["advisory"])

DISEASE_GATE_MODULE = "advisory_disease_gate"
CROP_PLAN_CACHE_TTL_SECONDS = 6 * 60 * 60

GATE_PROMPT = (
    "Decide whether this image is a usable crop-disease scan input. Return ONLY JSON "
    '{"is_plant_leaf": true/false, "quality_ok": true/false}. is_plant_leaf is true only '
    "when the frame is dominated by a single plant leaf; quality_ok is true only when the "
    "photo is sharp and well lit."
)

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


# ---------- Disease scan (M9, SDR + vision) ----------


async def _run_gate(image_bytes: bytes) -> dict:
    """Gate the image BEFORE diagnosis (M9). Never a model outside the gateway."""
    result = await gateway.analyze_image(
        image_bytes, GATE_PROMPT, schema={"is_plant_leaf": True, "quality_ok": True},
        module=DISEASE_GATE_MODULE,
    )
    return {
        "is_plant_leaf": bool(result.get("is_plant_leaf", True)),
        "quality_ok": bool(result.get("quality_ok", True)),
    }


@router.post("/disease-scan")
async def disease_scan(
    image: UploadFile = File(...),
    plotId: str | None = Form(None),
    user: dict = Depends(_farmer),
):
    data = await storage.validate_upload(image)
    blob_path, _ = storage.upload_user_file(
        user["id"], data, image.filename or "scan", image.content_type, prefix="scans"
    )
    photo_url = storage.signed_download_url(blob_path)

    gate = await _run_gate(data)
    if not gate["is_plant_leaf"] or not gate["quality_ok"]:
        retake = RETAKE_NOT_LEAF if not gate["is_plant_leaf"] else RETAKE_BLURRY
        return {
            "gate": {**gate, "passed": False},
            "retake": retake,
            "results": [],
            "demo": False,
            "scanId": None,
        }

    results = await get_disease_adapter().scan(data)
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
    docs = await query_cursor(
        "disease_scans",
        filters,
        order_field="createdAt",
        descending=True,
        cursor_value=cursor,
        limit=limit,
    )
    next_cursor = docs[-1]["createdAt"] if len(docs) == limit else None
    return {
        "data": [
            {
                "scanId": doc.get("scan_id"),
                "plotId": doc.get("plotId"),
                "photoUrl": doc.get("photo_url"),
                "diagnosis": doc.get("diagnosis"),
                "confidence": doc.get("confidence"),
                "createdAt": doc.get("createdAt"),
            }
            for doc in docs
        ],
        "nextCursor": next_cursor,
    }


# ---------- NPK calculator ----------


@router.post("/npk", response_model=NpkOut)
async def npk(body: NpkIn, user: dict = Depends(_farmer)):
    return advisory_service.npk_recommendation(body)


# ---------- Crop planner (M13, SGR) ----------


class CropPlanPayload(BaseModel):
    options: list[CropPlanOption] = Field(min_length=2, max_length=5)


def _clean_json_str(raw: str) -> str:
    cleaned = (raw or "").strip()
    if "```" in cleaned:
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
    return cleaned


def _crop_plan_prompt(body: CropPlanIn) -> str:
    language = "Hindi (Devanagari)" if body.lang == "hi" else "English"
    history = ", ".join(body.cropHistory) or "none"
    season = body.season or advisory_service.current_season()
    return (
        f"You are an Indian agronomy planner. Inputs — soil: {body.soil}; "
        f"irrigation: {body.irrigation}; plot: {body.plotSizeAcres} acres; "
        f"recent crops: {history}; district: {body.district}; season: {season}. "
        "Recommend 2-3 rotating crops suited to these inputs. Output ONLY valid JSON "
        'matching {"options":[{"crop":"","rationale":"","estimatedRevenuePaisa":0}]} '
        f"with the rationale written in {language}."
    )


async def _generate_crop_options(body: CropPlanIn) -> tuple[list[CropPlanOption], str]:
    """One model call + exactly one repair retry; deterministic fallback."""
    raw = await gateway.generate(
        _crop_plan_prompt(body), {"module": advisory_service.CROP_PLAN_MODULE}
    )
    try:
        parsed = CropPlanPayload.model_validate(json.loads(_clean_json_str(raw)))
        return parsed.options, "ai"
    except (json.JSONDecodeError, ValidationError, ValueError) as first_error:
        repair_prompt = (
            "Rewrite the following as strictly valid JSON matching "
            '{"options":[{"crop":"","rationale":"","estimatedRevenuePaisa":0}]}:\n'
            f"{raw}\nValidation error: {first_error}"
        )
        repaired = await gateway.generate(
            repair_prompt, {"module": advisory_service.CROP_PLAN_MODULE}
        )
        try:
            parsed = CropPlanPayload.model_validate(json.loads(_clean_json_str(repaired)))
            return parsed.options, "ai"
        except (json.JSONDecodeError, ValidationError, ValueError):
            return await advisory_service.crop_plan_fallback(body), "fallback"


@router.post("/crop-plan", response_model=CropPlanOut)
async def crop_plan(body: CropPlanIn, user: dict = Depends(_farmer)):
    """Suggest 2-3 crops with rationale. Never creates a crop_cycle (`suggest`)."""
    cache_key = advisory_service.crop_plan_cache_key(body)
    cached = await cache_get(cache_key)
    if cached is not None:
        try:
            payload = json.loads(cached)
            return CropPlanOut(
                options=[CropPlanOption(**opt) for opt in payload["options"]],
                source=payload.get("source", "fallback"),
                cached=True,
                decisionId=None,
                automationLevel="suggest",
            )
        except (KeyError, ValueError, TypeError):
            cached = None

    options, source = await _generate_crop_options(body)
    await cache_set(
        cache_key,
        json.dumps({"options": [opt.model_dump() for opt in options], "source": source}),
        ttl_seconds=CROP_PLAN_CACHE_TTL_SECONDS,
    )
    return CropPlanOut(options=options, source=source, cached=False, automationLevel="suggest")


@router.post("/crop-plan/confirm", response_model=CropPlanConfirmOut)
async def crop_plan_confirm(
    body: CropPlanConfirmIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(_farmer),
):
    """Farmer-confirmed plan: create a real crop_cycle + schedule its tasks."""
    season = body.season or advisory_service.current_season()
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
