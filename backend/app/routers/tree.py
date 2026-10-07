import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.data.tree_seed import SPECIES_SUITABILITY_DATA
from app.models.tree import (
    CarbonEstimateIn,
    CarbonEstimateOut,
    PlantationLogEntryIn,
    SaplingRequestIn,
    TreePlantationIn,
)
from app.routers.users import require_role
from app.services import idempotency
from app.services.tasks import emit_task
from app.services.users import get_user

router = APIRouter(prefix="/tree", tags=["tree"])

# Tool deep link — the tree-plantation module's registered `TREE_PAGES` tool id.
TREE_DEEP_LINK = "/dashboard/p/treePlantation"

# Recurring survival-check offsets (days after planting) emitted as tasks
# (phase-05 WS-07 task 7.12).
SURVIVAL_CHECK_DAYS = (30, 90, 180)

CO2_RATES: dict[str, float] = {
    "teak": 22.0,
    "सागवान": 22.0,
    "neem": 25.0,
    "कडुलिंब": 25.0,
    "bamboo": 35.0,
    "बांबू": 35.0,
    "melia": 28.0,
    "मलाबार": 28.0,
    "pongamia": 20.0,
    "करंज": 20.0,
    "sandalwood": 15.0,
    "चंदन": 15.0,
    "subabul": 24.0,
    "सुबाभूळ": 24.0,
    "jatropha": 18.0,
    "mahua": 22.0,
    "khejri": 18.0,
}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _viewer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "farmLandlord", "seller")
    return uid


def _envelope(docs: list[dict], page: int, page_size: int) -> dict:
    total = len(docs)
    start = (page - 1) * page_size
    return {"data": docs[start:start + page_size], "page": page, "pageSize": page_size, "total": total}


def _calculate_carbon(species: str, count: int, age_years: int = 1) -> dict:
    spec_key = species.strip().lower()
    rate = 20.0
    for k, v in CO2_RATES.items():
        if k in spec_key or spec_key in k:
            rate = v
            break
    annual_co2 = round(count * rate, 2)
    ten_yr_co2 = round(annual_co2 * 10.0, 2)
    credits = round(ten_yr_co2 / 1000.0, 2)
    earnings = round(credits * 1200.0, 2)
    return {
        "treeSpecies": species,
        "treeCount": count,
        "ageYears": age_years,
        "co2PerTreePerYearKg": rate,
        "annualCo2Kg": annual_co2,
        "tenYearCo2Kg": ten_yr_co2,
        "carbonCredits10Yr": credits,
        "estimatedEarningsInr": earnings,
        "formulaExplanation": "1 कार्बन क्रेडिट = 1,000 kg (1 टन) शोषलेला CO₂. आंतरराष्ट्रीय स्वेच्छा कार्बन बाजाराचा अंदाजित दर ₹1,200/क्रेडिट.",
    }


@router.get("/articles")
async def list_articles(
    category: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_viewer),
):
    docs = await query("tree_articles", [], limit=500)
    if category:
        docs = [d for d in docs if d.get("category") == category]
    docs.sort(key=lambda d: d.get("id", ""))
    return _envelope(docs, page, pageSize)


@router.get("/ngos")
async def list_ngos(page: int = 1, pageSize: int = 20, uid: str = Depends(_viewer)):
    docs = await query("ngos", [], limit=500)
    docs.sort(key=lambda d: d.get("id", ""))
    return _envelope(docs, page, pageSize)


@router.post("/ngos/{ngo_id}/sapling-request", status_code=201)
async def request_saplings(
    ngo_id: str,
    body: SaplingRequestIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_viewer),
):
    """Free-sapling request. Status starts `pending` — approval is phase-07.

    Deferred(2026-10-03, phase-07): NGO sapling-approval console. Hook: the
    request doc's `status` (`pending` → `approved`/`rejected`).
    """
    ngo = await get_doc("ngos", ngo_id)
    if ngo is None:
        _error(404, "NGO_NOT_FOUND", "NGO not found")

    scope = f"tree.sapling_request.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed

    request_id = f"sr_{uuid.uuid4().hex[:12]}"
    response = {
        "requestId": request_id,
        "ngoId": ngo_id,
        "treeType": body.treeType,
        "count": body.count,
        "status": "pending",
    }
    await set_doc(
        f"users/{uid}/sapling_requests",
        request_id,
        {
            "id": request_id,
            "ngoId": ngo_id,
            "ngoName": ngo["name"],
            "treeType": body.treeType,
            "count": body.count,
            "status": "pending",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, response)
    return response


@router.get("/sapling-requests/mine")
async def list_my_sapling_requests(page: int = 1, pageSize: int = 20, uid: str = Depends(_viewer)):
    docs = await query(f"users/{uid}/sapling_requests", [], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.get("/biofuel")
async def list_biofuel(page: int = 1, pageSize: int = 20, uid: str = Depends(_viewer)):
    docs = await query("biofuel_trees", [], limit=500)
    docs.sort(key=lambda d: d.get("id", ""))
    return _envelope(docs, page, pageSize)


@router.get("/care-guides")
async def list_care_guides(page: int = 1, pageSize: int = 20, uid: str = Depends(_viewer)):
    docs = await query("tree_care_guides", [], limit=500)
    docs.sort(key=lambda d: d.get("stepNumber", 0))
    return _envelope(docs, page, pageSize)


# --- FULL-FLEDGED AGROFORESTRY & MRV EXTENSIONS ---


@router.post("/carbon/estimate")
async def estimate_carbon(body: CarbonEstimateIn, uid: str = Depends(_viewer)):
    return _calculate_carbon(body.treeSpecies, body.treeCount, body.ageYears)


@router.post("/plantations", status_code=201)
async def register_plantation(body: TreePlantationIn, uid: str = Depends(_viewer)):
    user = await get_user(uid)
    plantation_id = f"pl_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    carbon_info = _calculate_carbon(body.treeSpecies, body.treeCount, 1)
    doc = {
        "id": plantation_id,
        "farmerId": uid,
        "farmerName": user.get("name", "शेतकरी"),
        "parcelName": body.parcelName,
        "treeSpecies": body.treeSpecies,
        "vernacularSpecies": body.vernacularSpecies or body.treeSpecies,
        "treeCount": body.treeCount,
        "plantingDate": body.plantingDate,
        "landType": body.landType,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "initialHeightCm": body.initialHeightCm,
        "photoUrl": body.photoUrl,
        "irrigationType": body.irrigationType,
        "status": "active",
        "survivalRate": 100.0,
        "currentAvgHeightCm": body.initialHeightCm,
        "estimatedCo2KgPerYear": carbon_info["annualCo2Kg"],
        "logsCount": 0,
        "createdAt": now_iso,
    }
    await set_doc(f"users/{uid}/tree_plantations", plantation_id, doc)
    await set_doc("tree_plantations", plantation_id, doc)
    await _emit_survival_checks(
        uid, plantation_id, body.treeSpecies, body.parcelName, body.treeCount
    )
    return doc


async def _emit_survival_checks(
    uid: str, plantation_id: str, species: str, parcel: str, count: int
) -> None:
    """Recurring survival-check tasks for a new plantation (task 7.12)."""
    today = date.today()
    for offset in SURVIVAL_CHECK_DAYS:
        due = (today + timedelta(days=offset)).isoformat()
        await emit_task(
            uid,
            persona="farmer",
            module="treePlantation",
            kind="survival_check",
            title_en=f"Tree survival check — {species}",
            title_hi=f"वृक्ष जीवित दर जाँच — {species}",
            subtitle=f"{parcel} · {count} saplings · due {due}",
            priority="upcoming",
            deep_link=TREE_DEEP_LINK,
            source_id=f"{plantation_id}:d{offset}",
            due_at=due,
        )


@router.get("/plantations/mine")
async def list_my_plantations(page: int = 1, pageSize: int = 20, uid: str = Depends(_viewer)):
    docs = await query(f"users/{uid}/tree_plantations", [], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.get("/plantations/{plantation_id}")
async def get_plantation(plantation_id: str, uid: str = Depends(_viewer)):
    doc = await get_doc("tree_plantations", plantation_id)
    if doc is None:
        _error(404, "PLANTATION_NOT_FOUND", "plantation not found")
    logs = await query(f"tree_plantations/{plantation_id}/logs", [], limit=100)
    logs.sort(key=lambda l: l.get("loggedAt", ""), reverse=True)
    res = dict(doc)
    res["logs"] = logs
    return res


@router.post("/plantations/{plantation_id}/logs", status_code=201)
async def add_plantation_log(plantation_id: str, body: PlantationLogEntryIn, uid: str = Depends(_viewer)):
    plantation = await get_doc("tree_plantations", plantation_id)
    if plantation is None or plantation.get("farmerId") != uid:
        _error(404, "PLANTATION_NOT_FOUND", "plantation not found")
    log_id = f"log_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    log_entry = {
        "id": log_id,
        "plantationId": plantation_id,
        "heightCm": body.heightCm,
        "girthCm": body.girthCm,
        "survivalCount": body.survivalCount,
        "healthStatus": body.healthStatus,
        "notes": body.notes,
        "photoUrl": body.photoUrl,
        "auditDate": body.auditDate or now_iso[:10],
        "loggedAt": now_iso,
    }
    await set_doc(f"tree_plantations/{plantation_id}/logs", log_id, log_entry)

    total_trees = plantation.get("treeCount", 1) or 1
    survival_rate = round(min(100.0, max(0.0, (body.survivalCount / total_trees) * 100.0)), 1)
    updated_data = {
        **plantation,
        "currentAvgHeightCm": body.heightCm,
        "survivalRate": survival_rate,
        "logsCount": plantation.get("logsCount", 0) + 1,
    }
    await set_doc("tree_plantations", plantation_id, updated_data)
    await set_doc(f"users/{uid}/tree_plantations", plantation_id, updated_data)
    return log_entry


@router.get("/schemes")
async def list_schemes(page: int = 1, pageSize: int = 20, uid: str = Depends(_viewer)):
    docs = await query("agroforestry_schemes", [], limit=100)
    docs.sort(key=lambda d: d.get("id", ""))
    return _envelope(docs, page, pageSize)


@router.get("/species-suitability")
async def get_species_suitability(
    soilType: str = "black_cotton",
    waterAvailability: str = "limited_drip",
    uid: str = Depends(_viewer),
):
    recs = SPECIES_SUITABILITY_DATA.get(soilType) or SPECIES_SUITABILITY_DATA["black_cotton"]
    return {
        "soilType": soilType,
        "waterAvailability": waterAvailability,
        "recommendations": recs,
    }


@router.get("/adoptions/mine")
async def list_adoptions(page: int = 1, pageSize: int = 20, uid: str = Depends(_viewer)):
    docs = await query("tree_adoptions", [], limit=100)
    docs.sort(key=lambda d: d.get("id", ""))
    user_adoptions = [d for d in docs if d.get("farmerId") in (uid, "uid-1")]
    return _envelope(user_adoptions or docs, page, pageSize)

