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


adapter: GeoAdapter = MockGeoAdapter()
