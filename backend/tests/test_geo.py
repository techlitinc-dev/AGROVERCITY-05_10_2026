"""Geo provider surface: mock-mode endpoints, Google response normalization
(via a faked _request — no network), and transport distance resolution."""

import hashlib

from app.core.config import settings
from app.services.geo import GeoProviderError, haversine_km
from app.services.tokens import create_access_token
from tests.test_transport import _token
from tests.test_transport_nearby import INSTANT_BODY, _farmer_token, _fleet
from tests.test_users import _auth

NASHIK = {"lat": 20.0, "lng": 73.8}
PUNE = {"lat": 18.5, "lng": 73.9}
GOOGLE_DISTANCE_KM = 152.0

GEOCODE_PAYLOAD = {
    "status": "OK",
    "results": [
        {
            "place_id": "ChIJnashik",
            "formatted_address": "Nashik, Maharashtra, India",
            "geometry": {"location": {"lat": 20.0059, "lng": 73.791}},
        },
        {
            "place_id": "ChIJnashik2",
            "formatted_address": "Nashik Road, Maharashtra, India",
            "geometry": {"location": {"lat": 20.01, "lng": 73.85}},
        },
    ],
}
REVERSE_PAYLOAD = {
    "status": "OK",
    "results": [
        {
            "place_id": "ChIJrev1",
            "formatted_address": "Nashik, Maharashtra, India",
            "address_components": [
                {"long_name": "Nashik", "types": ["administrative_area_level_2"]},
                {"long_name": "Maharashtra", "types": ["administrative_area_level_1"]},
            ],
        }
    ],
}
ROUTES_PAYLOAD = {
    "routes": [
        {
            "distanceMeters": 152000,
            "duration": "5544s",
            "polyline": {"encodedPolyline": "encodedpolyline123"},
            "viewport": {
                "low": {"latitude": 18.4, "longitude": 73.7},
                "high": {"latitude": 20.1, "longitude": 74.0},
            },
            "legs": [
                {
                    "distanceMeters": 152000,
                    "duration": "5544s",
                    "startLocation": {"latLng": {"latitude": 20.0, "longitude": 73.8}},
                    "endLocation": {"latLng": {"latitude": 18.5, "longitude": 73.9}},
                }
            ],
        }
    ]
}
AUTOCOMPLETE_PAYLOAD = {
    "status": "OK",
    "predictions": [
        {
            "place_id": "ChIJac1",
            "description": "Nashik, Maharashtra, India",
            "structured_formatting": {
                "main_text": "Nashik",
                "secondary_text": "Maharashtra, India",
            },
        }
    ],
}
DETAILS_PAYLOAD = {
    "status": "OK",
    "result": {
        "place_id": "ChIJac1",
        "formatted_address": "Nashik, Maharashtra, India",
        "geometry": {"location": {"lat": 20.0, "lng": 73.79}},
    },
}


def _geo_token():
    return _auth(create_access_token("uid-geo-1"))


def _enable_google(monkeypatch):
    """Wire GoogleGeoAdapter to canned JSON; returns the _request call counter."""
    calls = {"n": 0}

    async def fake_request(self, method, url, **kw):
        calls["n"] += 1
        if "computeRoutes" in url:
            return ROUTES_PAYLOAD
        if "autocomplete" in url:
            return AUTOCOMPLETE_PAYLOAD
        if "details" in url:
            return DETAILS_PAYLOAD
        if "latlng" in (kw.get("params") or {}):
            return REVERSE_PAYLOAD
        return GEOCODE_PAYLOAD

    monkeypatch.setattr("app.services.geo.GoogleGeoAdapter._request", fake_request)
    monkeypatch.setattr(settings, "google_maps_api_key", "test-google-key")
    return calls


# ------------------------------------------
# mock mode (no GOOGLE_MAPS_API_KEY configured)
# ------------------------------------------


async def test_reverse_mock_mode_keeps_reference_keys(client):
    resp = await client.get("/v1/geo/reverse", params={"lat": 20.0, "lng": 73.8})
    assert resp.status_code == 200
    body = resp.json()
    for key in ("state", "district", "region", "suggestedLanguages"):
        assert key in body
    assert body["state"] == "Maharashtra"
    assert body["district"] == "Nashik"


async def test_geocode_mock_mode_empty_results(client):
    resp = await client.post(
        "/v1/geo/geocode", json={"query": "nashik"}, headers=_geo_token()
    )
    assert resp.status_code == 200
    assert resp.json() == {"results": [], "provider": "mock"}


async def test_autocomplete_mock_mode_empty_predictions(client):
    resp = await client.get(
        "/v1/geo/places/autocomplete",
        params={"input": "nas", "sessionToken": "tok-1"},
        headers=_geo_token(),
    )
    assert resp.status_code == 200
    assert resp.json() == {"predictions": [], "provider": "mock"}


async def test_route_mock_mode_haversine_fallback(client):
    resp = await client.post(
        "/v1/geo/route", json={"origin": NASHIK, "destination": PUNE}, headers=_geo_token()
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "mock"
    assert body["fallback"] is True
    assert body["polyline"] is None
    assert body["legs"] == []
    expected_km = haversine_km(NASHIK["lat"], NASHIK["lng"], PUNE["lat"], PUNE["lng"]) * 1.25
    assert abs(body["distanceKm"] - expected_km) <= 1.0
    assert body["durationMin"] == body["distanceKm"] * 1.5
    assert body["bounds"] == {
        "south": 18.5 - 0.05,
        "west": 73.8 - 0.05,
        "north": 20.0 + 0.05,
        "east": 73.9 + 0.05,
    }


async def test_place_details_mock_mode_502(client):
    resp = await client.get("/v1/geo/places/ChIJx", headers=_geo_token())
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "GEO_PROVIDER_ERROR"


# ------------------------------------------
# google mode (faked _request, canned JSON)
# ------------------------------------------


async def test_geocode_google_normalization(client, monkeypatch):
    _enable_google(monkeypatch)
    resp = await client.post(
        "/v1/geo/geocode", json={"query": "nashik", "limit": 1}, headers=_geo_token()
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "google"
    assert body["results"] == [
        {
            "placeId": "ChIJnashik",
            "formattedAddress": "Nashik, Maharashtra, India",
            "lat": 20.0059,
            "lng": 73.791,
        }
    ]


async def test_reverse_google_adds_address_and_keeps_region_keys(client, monkeypatch):
    _enable_google(monkeypatch)
    resp = await client.get("/v1/geo/reverse", params={"lat": 20.0, "lng": 73.8})
    assert resp.status_code == 200
    body = resp.json()
    assert body["formattedAddress"] == "Nashik, Maharashtra, India"
    assert body["placeId"] == "ChIJrev1"
    assert body["state"] == "Maharashtra"
    assert body["district"] == "Nashik"
    assert body["region"] == "West"
    assert body["suggestedLanguages"] == ["mr", "hi"]


async def test_route_google_parsing(client, monkeypatch):
    _enable_google(monkeypatch)
    resp = await client.post(
        "/v1/geo/route",
        json={"origin": NASHIK, "destination": PUNE, "waypoints": [{"lat": 19.2, "lng": 73.85}]},
        headers=_geo_token(),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "google"
    assert body["fallback"] is False
    assert body["distanceKm"] == GOOGLE_DISTANCE_KM
    assert body["durationMin"] == 92  # "5544s" -> 5544/60
    assert body["polyline"] == "encodedpolyline123"
    assert body["bounds"] == {"south": 18.4, "west": 73.7, "north": 20.1, "east": 74.0}
    assert body["legs"] == [
        {
            "distanceKm": GOOGLE_DISTANCE_KM,
            "durationMin": 92,
            "start": {"lat": 20.0, "lng": 73.8},
            "end": {"lat": 18.5, "lng": 73.9},
        }
    ]


async def test_autocomplete_and_place_details_google(client, monkeypatch):
    _enable_google(monkeypatch)
    resp = await client.get(
        "/v1/geo/places/autocomplete", params={"input": "nas"}, headers=_geo_token()
    )
    assert resp.status_code == 200
    assert resp.json()["predictions"] == [
        {
            "placeId": "ChIJac1",
            "description": "Nashik, Maharashtra, India",
            "mainText": "Nashik",
            "secondaryText": "Maharashtra, India",
        }
    ]
    resp = await client.get("/v1/geo/places/ChIJac1", headers=_geo_token())
    assert resp.status_code == 200
    assert resp.json() == {
        "placeId": "ChIJac1",
        "formattedAddress": "Nashik, Maharashtra, India",
        "lat": 20.0,
        "lng": 73.79,
        "provider": "google",
    }


async def test_route_google_failure_502s(client, monkeypatch):
    async def failing(self, method, url, **kw):
        raise GeoProviderError("NO_ROUTE")

    monkeypatch.setattr("app.services.geo.GoogleGeoAdapter._request", failing)
    monkeypatch.setattr(settings, "google_maps_api_key", "test-google-key")
    resp = await client.post(
        "/v1/geo/route", json={"origin": NASHIK, "destination": PUNE}, headers=_geo_token()
    )
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "GEO_PROVIDER_ERROR"


# ------------------------------------------
# transport integration
# ------------------------------------------

BOOKING_GEO_BODY = {
    "vehicleType": "Tata Ace",
    "distanceKm": 999.0,  # client figure; google distance must win
    "pickup": "Pimpalgaon",
    "drop": "Nashik APMC",
    "date": "2026-10-25",
    "pickupCoords": NASHIK,
    "dropCoords": PUNE,
}


async def test_fare_estimate_uses_google_distance(client, monkeypatch):
    calls = _enable_google(monkeypatch)
    token = await _token(client)
    catalog = (await client.get("/v1/transport/vehicles", headers=_auth(token))).json()["data"]
    ace = next(v for v in catalog if v["type"] == "Tata Ace")

    resp = await client.post(
        "/v1/transport/fare-estimate",
        json={
            "vehicleType": "Tata Ace",
            "distanceKm": 999.0,
            "pickup": NASHIK,
            "drop": PUNE,
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["distanceKm"] == GOOGLE_DISTANCE_KM
    assert body["distanceSource"] == "google"
    assert calls["n"] == 1  # one computeRoutes call for the resolution
    # every fare input derives from the google distance, not the client's 999
    assert body["distanceFare"] == ace["perKmRate"] * GOOGLE_DISTANCE_KM
    assert body["totalFare"] == ace["baseFare"] + ace["perKmRate"] * GOOGLE_DISTANCE_KM
    assert body["tollEstimate"] == round((GOOGLE_DISTANCE_KM / 50.0) * 85.0)
    assert body["loadingLabor"] == 300.0


async def test_fare_estimate_provider_failure_falls_back_to_client(client, monkeypatch):
    async def failing(self, method, url, **kw):
        raise GeoProviderError("NO_ROUTE")

    monkeypatch.setattr("app.services.geo.GoogleGeoAdapter._request", failing)
    monkeypatch.setattr(settings, "google_maps_api_key", "test-google-key")
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/fare-estimate",
        json={"vehicleType": "Tata Ace", "distanceKm": 20.0, "pickup": NASHIK, "drop": PUNE},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["distanceKm"] == 20.0
    assert body["distanceSource"] == "client"
    assert body["totalFare"] == 500 + 35 * 20


async def test_create_booking_stores_coords_and_google_distance(client, monkeypatch):
    _enable_google(monkeypatch)
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/bookings", json=BOOKING_GEO_BODY, headers=_auth(token)
    )
    assert resp.status_code == 200
    booking = resp.json()
    assert booking["distanceKm"] == GOOGLE_DISTANCE_KM
    assert booking["distanceSource"] == "google"
    assert booking["fare"] == 500 + 35 * GOOGLE_DISTANCE_KM
    assert booking["pickupGeo"] == {"lat": 20.0, "lng": 73.8}
    assert booking["dropGeo"] == {"lat": 18.5, "lng": 73.9}


async def test_booking_route_endpoint_caches(client, monkeypatch, user_store):
    calls = _enable_google(monkeypatch)
    token = await _token(client)
    booking = (
        await client.post(
            "/v1/transport/bookings", json=BOOKING_GEO_BODY, headers=_auth(token)
        )
    ).json()
    # one provider call so far: the distance resolution inside create_booking
    assert calls["n"] == 1

    coords_key = hashlib.sha256(b"20.0,73.8;18.5,73.9").hexdigest()
    resp = await client.get(
        f"/v1/transport/bookings/{booking['id']}/route", headers=_auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "google"
    assert body["distanceKm"] == GOOGLE_DISTANCE_KM
    assert body["durationMin"] == 92
    assert body["polyline"] == "encodedpolyline123"
    assert body["bookingId"] == booking["id"]
    assert body["coordsKey"] == coords_key
    assert body["legs"] != []
    assert calls["n"] == 2  # one computeRoutes call for the uncached route

    # second call is served from routeCache: no extra provider call, no legs
    resp2 = await client.get(
        f"/v1/transport/bookings/{booking['id']}/route", headers=_auth(token)
    )
    assert resp2.status_code == 200
    assert resp2.json()["legs"] == []
    assert resp2.json()["distanceKm"] == GOOGLE_DISTANCE_KM
    assert calls["n"] == 2
    stored = user_store[f"transport_bookings/{booking['id']}"]["routeCache"]
    assert stored["coordsKey"] == coords_key
    assert "legs" not in stored
    assert stored["provider"] == "google"


async def test_booking_route_requires_coords(client):
    token = await _token(client)
    booking = (
        await client.post(
            "/v1/transport/bookings",
            json={
                "vehicleType": "Tata Ace",
                "distanceKm": 20,
                "pickup": "Pimpalgaon",
                "drop": "Nashik APMC",
                "date": "2026-10-25",
            },
            headers=_auth(token),
        )
    ).json()
    resp = await client.get(
        f"/v1/transport/bookings/{booking['id']}/route", headers=_auth(token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "GEO_REQUIRED"


async def test_instant_booking_without_key_stores_client_source(client, user_store):
    _, custom, *_ = await _fleet(client, user_store)
    farmer = _farmer_token(user_store)
    resp = await client.post(
        "/v1/transport/instant-bookings",
        json={"vehicleId": custom["id"], **INSTANT_BODY},
        headers={**_auth(farmer), "Idempotency-Key": "ib-geo-1"},
    )
    assert resp.status_code == 201
    booking = resp.json()["booking"]
    assert booking["distanceKm"] == INSTANT_BODY["distanceKm"]
    assert booking["distanceSource"] == "client"
    # fare math untouched: custom rates against the client's distance
    assert resp.json()["fare"]["distanceFare"] == round(25.0 * INSTANT_BODY["distanceKm"])
