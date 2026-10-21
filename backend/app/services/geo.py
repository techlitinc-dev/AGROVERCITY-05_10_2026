import math
from datetime import date
from typing import Protocol

import httpx

from app.core.config import settings

ROAD_FACTOR = 1.25  # straight-line km -> road km

MAPS_BASE = "https://maps.googleapis.com"
ROUTES_BASE = "https://routes.googleapis.com"


class GeoProviderError(Exception):
    """Google geo call failed (HTTP error or non-OK status)."""


def _region_profile(state: str, district: str) -> dict:
    """region + suggestedLanguages for a state/district pair (same mapping the
    mock derives for its two boxes)."""
    if state == "Maharashtra" and district == "Nashik":
        return {"region": "West", "suggestedLanguages": ["mr", "hi"]}
    if state == "Punjab" and district == "Ludhiana":
        return {"region": "North", "suggestedLanguages": ["pa", "hi"]}
    return {"region": "West", "suggestedLanguages": ["hi", "en"]}


class GeoAdapter(Protocol):
    async def reverse(self, lat: float, lng: float) -> dict:
        ...

    async def geocode(self, query: str, limit: int = 5) -> list[dict]:
        ...

    async def route(
        self, origin: dict, destination: dict, waypoints: list[dict] | None = None
    ) -> dict:
        ...

    async def autocomplete(self, input: str, session_token: str | None = None) -> list[dict]:
        ...

    async def place_details(self, place_id: str) -> dict:
        ...


class MockGeoAdapter:
    async def reverse(self, lat: float, lng: float) -> dict:
        if 19.9 <= lat <= 20.2 and 73.6 <= lng <= 74.1:
            return {
                "state": "Maharashtra",
                "district": "Nashik",
                "region": "West",
                "suggestedLanguages": ["mr", "hi"],
            }
        if 30.8 <= lat <= 31.1 and 75.7 <= lng <= 76.1:
            return {
                "state": "Punjab",
                "district": "Ludhiana",
                "region": "North",
                "suggestedLanguages": ["pa", "hi"],
            }
        return {
            "state": "Maharashtra",
            "district": "Unknown",
            "region": "West",
            "suggestedLanguages": ["hi", "en"],
        }

    async def geocode(self, query: str, limit: int = 5) -> list[dict]:
        return []

    async def route(
        self, origin: dict, destination: dict, waypoints: list[dict] | None = None
    ) -> dict:
        km = haversine_km(origin["lat"], origin["lng"], destination["lat"], destination["lng"]) * ROAD_FACTOR
        pad = 0.05
        return {
            "provider": "mock",
            "fallback": True,
            "distanceKm": km,
            "durationMin": km * 1.5,
            "polyline": None,
            "bounds": {
                "south": min(origin["lat"], destination["lat"]) - pad,
                "west": min(origin["lng"], destination["lng"]) - pad,
                "north": max(origin["lat"], destination["lat"]) + pad,
                "east": max(origin["lng"], destination["lng"]) + pad,
            },
            "legs": [],
        }

    async def autocomplete(self, input: str, session_token: str | None = None) -> list[dict]:
        return []

    async def place_details(self, place_id: str) -> dict:
        return {"error": "not_configured"}


class GoogleGeoAdapter:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._client = httpx.AsyncClient(timeout=10)

    async def _request(self, method: str, url: str, **kw) -> dict:
        try:
            resp = await self._client.request(method, url, **kw)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise GeoProviderError(str(exc)) from exc
        data = resp.json()
        status = data.get("status") if isinstance(data, dict) else None
        if status is not None and status != "OK":
            raise GeoProviderError(f"{status}: {data.get('error_message', '')}")
        return data

    async def geocode(self, query: str, limit: int = 5) -> list[dict]:
        data = await self._request(
            "GET",
            f"{MAPS_BASE}/maps/api/geocode/json",
            params={"address": query, "region": "in", "key": self.api_key},
        )
        return [
            {
                "placeId": r.get("place_id"),
                "formattedAddress": r.get("formatted_address"),
                "lat": r["geometry"]["location"]["lat"],
                "lng": r["geometry"]["location"]["lng"],
            }
            for r in (data.get("results") or [])[:limit]
        ]

    async def reverse(self, lat: float, lng: float) -> dict:
        data = await self._request(
            "GET",
            f"{MAPS_BASE}/maps/api/geocode/json",
            params={"latlng": f"{lat},{lng}", "region": "in", "key": self.api_key},
        )
        results = data.get("results") or []
        if not results:
            raise GeoProviderError("NO_RESULTS")
        top = results[0]
        state = district = None
        for comp in top.get("address_components", []):
            types = comp.get("types", [])
            if "administrative_area_level_1" in types:
                state = comp.get("long_name")
            elif "administrative_area_level_2" in types:
                district = comp.get("long_name")
        if not district:
            for comp in top.get("address_components", []):
                if "locality" in comp.get("types", []) or "sublocality" in comp.get("types", []):
                    district = comp.get("long_name")
                    break
        state = state or "Unknown"
        district = district or "Unknown"
        return {
            "formattedAddress": top.get("formatted_address"),
            "state": state,
            "district": district,
            "placeId": top.get("place_id"),
            **_region_profile(state, district),
        }

    async def route(
        self, origin: dict, destination: dict, waypoints: list[dict] | None = None
    ) -> dict:
        def _loc(point: dict) -> dict:
            return {"location": {"latLng": {"latitude": point["lat"], "longitude": point["lng"]}}}

        body = {
            "origin": _loc(origin),
            "destination": _loc(destination),
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_UNAWARE",
            "polylineEncoding": "ENCODED_POLYLINE",
        }
        if waypoints:
            body["intermediates"] = [_loc(w) for w in waypoints]
        data = await self._request(
            "POST",
            f"{ROUTES_BASE}/directions/v2:computeRoutes",
            headers={
                "X-Goog-Api-Key": self.api_key,
                "X-Goog-FieldMask": (
                    "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,"
                    "routes.viewport,routes.legs.distanceMeters,routes.legs.duration,"
                    "routes.legs.startLocation,routes.legs.endLocation"
                ),
            },
            json=body,
        )
        routes = data.get("routes") or []
        if not routes:
            raise GeoProviderError("NO_ROUTE")
        top = routes[0]

        def _duration_min(raw) -> int:
            return round(int(str(raw or "0s").rstrip("s")) / 60)

        legs = [
            {
                "distanceKm": round((leg.get("distanceMeters") or 0) / 1000, 1),
                "durationMin": _duration_min(leg.get("duration")),
                "start": {
                    "lat": leg.get("startLocation", {}).get("latLng", {}).get("latitude"),
                    "lng": leg.get("startLocation", {}).get("latLng", {}).get("longitude"),
                },
                "end": {
                    "lat": leg.get("endLocation", {}).get("latLng", {}).get("latitude"),
                    "lng": leg.get("endLocation", {}).get("latLng", {}).get("longitude"),
                },
            }
            for leg in top.get("legs") or []
        ]
        viewport = top.get("viewport") or {}
        low = viewport.get("low") or {}
        high = viewport.get("high") or {}
        return {
            "provider": "google",
            "fallback": False,
            "distanceKm": round((top.get("distanceMeters") or 0) / 1000, 1),
            "durationMin": _duration_min(top.get("duration")),
            "polyline": (top.get("polyline") or {}).get("encodedPolyline") or None,
            "bounds": {
                "south": low.get("latitude"),
                "west": low.get("longitude"),
                "north": high.get("latitude"),
                "east": high.get("longitude"),
            },
            "legs": legs,
        }

    async def autocomplete(self, input: str, session_token: str | None = None) -> list[dict]:
        params = {"input": input, "region": "in", "key": self.api_key}
        if session_token:
            params["sessiontoken"] = session_token
        data = await self._request(
            "GET", f"{MAPS_BASE}/maps/api/place/autocomplete/json", params=params
        )
        return [
            {
                "placeId": p.get("place_id"),
                "description": p.get("description"),
                "mainText": (p.get("structured_formatting") or {}).get("main_text"),
                "secondaryText": (p.get("structured_formatting") or {}).get("secondary_text"),
            }
            for p in data.get("predictions") or []
        ]

    async def place_details(self, place_id: str) -> dict:
        data = await self._request(
            "GET",
            f"{MAPS_BASE}/maps/api/place/details/json",
            params={"place_id": place_id, "fields": "formatted_address,geometry", "key": self.api_key},
        )
        result = data.get("result") or {}
        location = result.get("geometry", {}).get("location", {})
        return {
            "placeId": result.get("place_id"),
            "formattedAddress": result.get("formatted_address"),
            "lat": location.get("lat"),
            "lng": location.get("lng"),
        }


def get_geo() -> GeoAdapter:
    if settings.google_maps_api_key:
        return GoogleGeoAdapter(settings.google_maps_api_key)
    return MockGeoAdapter()


def geo_provider() -> str:
    return "google" if settings.google_maps_api_key else "mock"


async def resolve_distance_km(pickup: dict, drop: dict, client_distance_km: float) -> tuple[float, str]:
    """Server-computed road distance when Google is configured; the client's
    figure otherwise. Provider failures never raise — they fall back to the
    client distance (source stays "client")."""
    if not settings.google_maps_api_key:
        return client_distance_km, "client"
    try:
        route = await get_geo().route(pickup, drop)
        return route["distanceKm"], "google"
    except GeoProviderError:
        return client_distance_km, "client"


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km (earth radius 6371.0). FarmGate produce
    near-me ranking (task 3.11)."""
    rlat1, rlng1, rlat2, rlng2 = map(math.radians, (lat1, lng1, lat2, lng2))
    dlat = rlat2 - rlat1
    dlng = rlng2 - rlng1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(a))


def freshness_days(harvest_date: str | None) -> int | None:
    """Whole days between an ISO `harvestDate` and today; None when unparseable
    (callers skip the freshness signal, never default to a number)."""
    if not harvest_date:
        return None
    try:
        harvested = date.fromisoformat(str(harvest_date)[:10])
    except ValueError:
        return None
    return (date.today() - harvested).days
