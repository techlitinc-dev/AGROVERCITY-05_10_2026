import math
from datetime import date
from typing import Protocol


class GeoAdapter(Protocol):
    def reverse(self, lat: float, lng: float) -> dict:
        ...


class MockGeoAdapter:
    def reverse(self, lat: float, lng: float) -> dict:
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


adapter: GeoAdapter = MockGeoAdapter()
