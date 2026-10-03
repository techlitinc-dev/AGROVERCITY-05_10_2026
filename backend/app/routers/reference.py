from fastapi import APIRouter

from app.data.district_crops import DISTRICT_CROPS
from app.data.languages import LANGUAGES, REGIONAL_MAPPING
from app.data.states import INDIAN_STATES
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


@router.get("/languages")
async def languages():
    return {"languages": LANGUAGES, "regionalMapping": REGIONAL_MAPPING}
