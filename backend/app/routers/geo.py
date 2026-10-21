from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.deps import current_user_id
from app.services import geo as geo_service

router = APIRouter(tags=["geo"])


class GeocodeIn(BaseModel):
    query: str = Field(min_length=2)
    limit: int = Field(default=5, ge=1, le=10)


class GeoPointIn(BaseModel):
    lat: float
    lng: float


class RouteIn(BaseModel):
    origin: GeoPointIn
    destination: GeoPointIn
    waypoints: list[GeoPointIn] = Field(default_factory=list, max_length=8)


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


@router.post("/geo/geocode")
async def geocode(body: GeocodeIn, uid: str = Depends(current_user_id)):
    results = await geo_service.get_geo().geocode(body.query, limit=body.limit)
    return {"results": results, "provider": geo_service.geo_provider()}


@router.post("/geo/route")
async def route(body: RouteIn, uid: str = Depends(current_user_id)):
    """Road route between two points; falls back to a haversine estimate when
    no Google key is configured (never 502s in mock mode)."""
    try:
        return await geo_service.get_geo().route(
            body.origin.model_dump(),
            body.destination.model_dump(),
            [w.model_dump() for w in body.waypoints] or None,
        )
    except geo_service.GeoProviderError as exc:
        _error(502, "GEO_PROVIDER_ERROR", str(exc))


@router.get("/geo/places/autocomplete")
async def autocomplete(
    input: str,
    sessionToken: str | None = None,
    uid: str = Depends(current_user_id),
):
    predictions = await geo_service.get_geo().autocomplete(input, session_token=sessionToken)
    return {"predictions": predictions, "provider": geo_service.geo_provider()}


@router.get("/geo/places/{place_id}")
async def place_details(place_id: str, uid: str = Depends(current_user_id)):
    try:
        result = await geo_service.get_geo().place_details(place_id)
    except geo_service.GeoProviderError as exc:
        _error(502, "GEO_PROVIDER_ERROR", str(exc))
    if result.get("error"):
        _error(502, "GEO_PROVIDER_ERROR", result["error"])
    return {**result, "provider": geo_service.geo_provider()}
