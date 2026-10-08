from fastapi import APIRouter

from app.core.db import query
from app.data.district_crops import DISTRICT_CROPS
from app.data.languages import LANGUAGES, REGIONAL_MAPPING
from app.data.states import INDIAN_STATES
from app.services import district_crops as district_crops_service
from app.services.geo import adapter

router = APIRouter(tags=["reference"])


@router.get("/states")
async def states():
    return {"states": INDIAN_STATES}


@router.get("/geo/reverse")
async def reverse_geocode(lat: float, lng: float):
    return adapter.reverse(lat, lng)


@router.get("/regions/crops")
async def region_crops(district: str):
    entry = DISTRICT_CROPS.get(district.lower())
    if entry is None:
        return {"district": district, "kharif": [], "rabi": [], "suggested": []}
    return entry


@router.get("/reference/district-crops")
async def district_crops(district: str):
    """M33 (phase-08 WS-01) — admin-curated crops for a district.

    Serves ONLY `status: "active"` rows; raw AI proposals (pending) are never
    returned to users.
    """
    return await district_crops_service.get_active_crops(district)


@router.get("/languages")
async def languages():
    return {"languages": LANGUAGES, "regionalMapping": REGIONAL_MAPPING}


@router.get("/reference/msp")
async def msp_reference():
    """Crop → minimum support price in integer paisa.

    Phase-05 WS-01 task 1.25. Reads the `msp_reference` collection seeded by
    `scripts/seed_msp_reference.py`. Reference data only — no computed values;
    a crop absent from the collection is simply absent from the response (the
    UI shows an "unavailable" label rather than an invented number).
    """
    docs = await query("msp_reference", limit=500)
    items = [
        {
            "crop": d.get("crop"),
            "msp_paisa": d.get("msp_paisa"),
            "season": d.get("season"),
        }
        for d in docs
        if d.get("crop") is not None and d.get("msp_paisa") is not None
    ]
    items.sort(key=lambda d: str(d["crop"]).lower())
    return {"items": items}
