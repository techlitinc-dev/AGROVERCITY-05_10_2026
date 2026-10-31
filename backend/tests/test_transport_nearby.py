"""Nearby-vehicle search, instant bookings, urgent loads, driver assignment
and per-driver analytics (FT geo + call-context surface)."""

from datetime import datetime, timedelta, timezone

from app.services.billing import seed_plans
from app.services.tokens import create_access_token
from tests.test_transport import (
    _activate,
    _add_vehicle,
    _book,
    _other_transporter_token,
    _token,
    _verify_vehicle,
)
from tests.test_transport_bids import LOAD_BODY
from tests.test_users import _auth

CENTER_LAT = 20.0
CENTER_LNG = 73.8


def _farmer_token(user_store, uid="uid-farmer"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "linkedProfiles": ["farmer", "seller"],
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "mpinHash": None,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    return create_access_token(uid)


async def _fleet(client, user_store):
    """uid-1: Pro transporter with a custom-rate vehicle at the search center, a
    catalog-rate vehicle 0.05 deg north, and an unavailable vehicle at center.
    uid-3: transporter whose vehicle is verified-gate-blocked (no KYC case)."""
    await seed_plans()
    token = await _token(client, profiles=("transport",), primary="transport")
    await _activate(client, token)
    subscribed = await client.post(
        "/v1/billing/subscribe", json={"planId": "transport_pro"}, headers=_auth(token)
    )
    assert subscribed.status_code == 201

    custom = await _add_vehicle(
        client,
        token,
        vehicleType="Bolero Maxi",
        registrationNo="MH15 NR 0001",
        capacityTonnes=1.5,
        homeLocation={"lat": CENTER_LAT, "lng": CENTER_LNG, "address": "Pimpalgaon"},
        perKmRate=25.0,
        baseFare=400,
        availableNow=True,
        driverName="Kailas Driver",
        driverPhone="+919800000010",
    )
    catalog_vehicle = await _add_vehicle(
        client,
        token,
        registrationNo="MH15 NR 0002",
        capacityTonnes=0.75,
        homeLocation={"lat": CENTER_LAT + 0.05, "lng": CENTER_LNG},
        availableNow=True,
        driverName="Second Driver",
        driverPhone="+919800000011",
    )
    idle = await _add_vehicle(
        client,
        token,
        registrationNo="MH15 NR 0003",
        homeLocation={"lat": CENTER_LAT, "lng": CENTER_LNG},
        availableNow=False,
    )
    _verify_vehicle(user_store, custom["id"])  # one KYC case covers all uid-1 vehicles
    user_store["users/uid-1"]["transportRatingStats"] = {"avg": 4.6}

    user_store["users/uid-3"] = {
        "id": "uid-3",
        "linkedProfiles": ["transport"],
        "activeProfile": "transport",
        "primaryProfile": "transport",
        "mpinHash": None,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    stranger = create_access_token("uid-3")
    unverified = await _add_vehicle(
        client,
        stranger,
        registrationNo="MH15 NR 0009",
        homeLocation={"lat": CENTER_LAT, "lng": CENTER_LNG},
        availableNow=True,
        fitnessExpiry="2020-01-01",  # expired doc — the only remaining document gate
    )
    return token, custom, catalog_vehicle, idle, unverified


def _notifications(user_store, ntype):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("type") == ntype
    ]


# ------------------------------------------
# nearby-vehicles
# ------------------------------------------


async def test_nearby_vehicles_lists_only_eligible_with_custom_fares(client, user_store):
    _, custom, catalog_vehicle, idle, unverified = await _fleet(client, user_store)
    farmer = _farmer_token(user_store)

    resp = await client.get(
        "/v1/transport/nearby-vehicles",
        params={"lat": CENTER_LAT, "lng": CENTER_LNG},
        headers=_auth(farmer),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["center"] == {"lat": CENTER_LAT, "lng": CENTER_LNG}
    assert body["radiusKm"] == 15
    ids = [v["vehicleId"] for v in body["data"]]
    assert custom["id"] in ids
    assert catalog_vehicle["id"] in ids
    assert idle["id"] not in ids  # unavailable
    assert unverified["id"] not in ids  # expired fitness doc — the only remaining document gate
    assert body["total"] == len(body["data"]) == 2

    entries = {v["vehicleId"]: v for v in body["data"]}
    custom_entry = entries[custom["id"]]
    assert custom_entry["fare"]["baseFare"] == 400
    assert custom_entry["fare"]["distanceFare"] == round(25.0 * custom_entry["distanceKm"])
    assert custom_entry["fare"]["totalFare"] == (
        custom_entry["fare"]["baseFare"] + custom_entry["fare"]["distanceFare"]
    )
    assert custom_entry["regNo"] == "MH15 NR 0001"
    assert custom_entry["capacityKg"] == 1500
    # direct-connect privacy: the driver name shows, the phone stays hidden
    # until a booking is confirmed
    assert custom_entry["driver"] == {"name": "Kailas Driver"}
    assert "phone" not in custom_entry["driver"]
    assert custom_entry["rating"] == 4.6
    assert custom_entry["availableNow"] is True
    assert custom_entry["chatContext"] == {"type": "vehicle", "id": custom["id"]}
    assert custom_entry["callContext"] == {"type": "vehicle", "id": custom["id"]}

    catalog_entry = entries[catalog_vehicle["id"]]
    assert catalog_entry["fare"]["baseFare"] == 500  # Tata Ace catalog base
    assert catalog_entry["distanceKm"] > 0

    # default sort: cheapest fare first (custom vehicle sits at the center)
    fares = [v["fare"]["totalFare"] for v in body["data"]]
    assert fares == sorted(fares)
    assert body["data"][0]["vehicleId"] == custom["id"]


async def test_nearby_vehicles_radius_type_capacity_and_sort_filters(client, user_store):
    _, custom, catalog_vehicle, idle, unverified = await _fleet(client, user_store)
    farmer = _farmer_token(user_store)
    base = {"lat": CENTER_LAT, "lng": CENTER_LNG}

    # radius: the catalog vehicle is ~6.9 road-km away; a 5 km radius drops it
    near = await client.get(
        "/v1/transport/nearby-vehicles", params={**base, "radiusKm": 5}, headers=_auth(farmer)
    )
    assert near.status_code == 200
    assert [v["vehicleId"] for v in near.json()["data"]] == [custom["id"]]

    # vehicleType filter
    typed = await client.get(
        "/v1/transport/nearby-vehicles",
        params={**base, "vehicleType": "Tata Ace"},
        headers=_auth(farmer),
    )
    assert [v["vehicleId"] for v in typed.json()["data"]] == [catalog_vehicle["id"]]

    # minCapacityKg: Bolero (1500 kg) stays, Tata Ace (750 kg) drops out
    capable = await client.get(
        "/v1/transport/nearby-vehicles",
        params={**base, "minCapacityKg": 1000},
        headers=_auth(farmer),
    )
    assert [v["vehicleId"] for v in capable.json()["data"]] == [custom["id"]]

    # distance sort
    by_distance = await client.get(
        "/v1/transport/nearby-vehicles", params={**base, "sort": "distance"}, headers=_auth(farmer)
    )
    distances = [v["distanceKm"] for v in by_distance.json()["data"]]
    assert distances == sorted(distances)
    assert by_distance.json()["data"][0]["vehicleId"] == custom["id"]

    # rating sort: rated owner first, nulls last
    by_rating = await client.get(
        "/v1/transport/nearby-vehicles", params={**base, "sort": "rating"}, headers=_auth(farmer)
    )
    assert by_rating.json()["data"][0]["rating"] == 4.6

    # bad sort value -> 422 with fieldErrors
    bad = await client.get(
        "/v1/transport/nearby-vehicles", params={**base, "sort": "magic"}, headers=_auth(farmer)
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["fieldErrors"]["sort"]

    # transporters can't search the nearby board (booking personas only)
    denied = await client.get("/v1/transport/nearby-vehicles", params=base, headers=_auth(_other_transporter_token(user_store)))
    assert denied.status_code == 403


async def test_vehicle_location_ping_refreshes_anchor_and_availability(client, user_store):
    token = await _token(client, profiles=("transport",), primary="transport")
    vehicle = await _add_vehicle(client, token)
    assert "perKmRate" not in vehicle  # only stored when provided

    resp = await client.post(
        f"/v1/transport/vehicles/{vehicle['id']}/location",
        json={"lat": 20.02, "lng": 73.81, "availableNow": True},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["currentLocation"] == {"lat": 20.02, "lng": 73.81}
    assert body["availableNow"] is True
    assert body["lastLocationAt"]

    # non-owner / missing vehicle
    stranger = _other_transporter_token(user_store)
    forbidden = await client.post(
        f"/v1/transport/vehicles/{vehicle['id']}/location",
        json={"lat": 20.0, "lng": 73.8},
        headers=_auth(stranger),
    )
    assert forbidden.status_code == 403
    missing = await client.post(
        "/v1/transport/vehicles/veh_nope/location",
        json={"lat": 20.0, "lng": 73.8},
        headers=_auth(token),
    )
    assert missing.status_code == 404


async def test_vehicle_custom_rate_partial_update_persists(client, user_store):
    token = await _token(client, profiles=("transport",), primary="transport")
    vehicle = await _add_vehicle(client, token, perKmRate=25.0, baseFare=400)
    assert vehicle["perKmRate"] == 25.0
    assert vehicle["baseFare"] == 400

    # partial PUT: absent fields stay unchanged
    resp = await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}",
        json={"perKmRate": 30.0},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["perKmRate"] == 30.0
    assert body["baseFare"] == 400
    assert body["registrationNo"] == vehicle["registrationNo"]

    resp = await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}",
        json={"availableNow": True, "homeLocation": {"lat": 20.0, "lng": 73.8}},
        headers=_auth(token),
    )
    assert resp.json()["availableNow"] is True
    assert resp.json()["homeLocation"]["lat"] == 20.0

    invalid = await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}",
        json={"perKmRate": -5},
        headers=_auth(token),
    )
    assert invalid.status_code == 422


# ------------------------------------------
# instant bookings
# ------------------------------------------

INSTANT_BODY = {
    "pickup": {"address": "Pimpalgaon", "lat": CENTER_LAT, "lng": CENTER_LNG},
    "drop": {"address": "Nashik APMC", "lat": 20.05, "lng": 73.85},
    "pickupDate": "2026-10-12",
    "commodity": "Onion",
    "weightKg": 1500,
    "distanceKm": 25.0,
    "notes": "handle with care",
}


async def test_instant_booking_accepted_with_chat_notifications_and_replay(client, user_store):
    _, custom, *_ = await _fleet(client, user_store)
    farmer = _farmer_token(user_store)

    resp = await client.post(
        "/v1/transport/instant-bookings",
        json={"vehicleId": custom["id"], **INSTANT_BODY},
        headers={**_auth(farmer), "Idempotency-Key": "ib-1"},
    )
    assert resp.status_code == 201
    body = resp.json()
    booking = body["booking"]
    assert booking["status"] == "accepted"
    assert booking["vehicleId"] == custom["id"]
    assert booking["transporterId"] == "uid-1"
    assert booking["vehicleNo"] == custom["registrationNo"]
    assert booking["driverName"] == "Kailas Driver"
    assert booking["userId"] == "uid-farmer"

    fare = body["fare"]
    assert fare["baseFare"] == 400
    assert fare["distanceFare"] == round(25.0 * 25.0)
    assert fare["loadingCharge"] == 0  # catalog defines no loadingLabor
    assert fare["totalFare"] == fare["baseFare"] + fare["distanceFare"] + fare["loadingCharge"]
    assert booking["fare"] == fare["totalFare"]

    # booking-gated chat room is created immediately
    room = user_store[f"chat_rooms/{booking['id']}"]
    assert room["kind"] == "transport"

    # both parties notified
    owner_notes = _notifications(user_store, "instant_booking")
    assert len(owner_notes) == 1
    assert owner_notes[0]["userId"] == "uid-1"
    assert owner_notes[0]["data"]["deepLink"] == f"/transporter/trips/{booking['id']}"
    farmer_notes = _notifications(user_store, "booking_confirmed")
    assert any(n["userId"] == "uid-farmer" for n in farmer_notes)

    # idempotent replay returns the same booking
    replay = await client.post(
        "/v1/transport/instant-bookings",
        json={"vehicleId": custom["id"], **INSTANT_BODY},
        headers={**_auth(farmer), "Idempotency-Key": "ib-1"},
    )
    assert replay.status_code == 201
    assert replay.json()["booking"]["id"] == booking["id"]
    assert len([k for k in user_store if k.startswith("transport_bookings/")]) == 1


async def test_instant_booking_guards(client, user_store):
    token, custom, _, idle, _ = await _fleet(client, user_store)
    farmer = _farmer_token(user_store)

    # missing Idempotency-Key
    missing_key = await client.post(
        "/v1/transport/instant-bookings",
        json={"vehicleId": custom["id"], **INSTANT_BODY},
        headers=_auth(farmer),
    )
    assert missing_key.status_code == 400
    assert missing_key.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"

    # unknown vehicle
    unknown = await client.post(
        "/v1/transport/instant-bookings",
        json={"vehicleId": "veh_nope", **INSTANT_BODY},
        headers={**_auth(farmer), "Idempotency-Key": "ib-x"},
    )
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "VEHICLE_NOT_FOUND"

    # unavailable vehicle
    unavailable = await client.post(
        "/v1/transport/instant-bookings",
        json={"vehicleId": idle["id"], **INSTANT_BODY},
        headers={**_auth(farmer), "Idempotency-Key": "ib-y"},
    )
    assert unavailable.status_code == 409
    assert unavailable.json()["error"]["code"] == "VEHICLE_UNAVAILABLE"

    # transporter persona cannot book (farmer/seller only)
    denied = await client.post(
        "/v1/transport/instant-bookings",
        json={"vehicleId": custom["id"], **INSTANT_BODY},
        headers={**_auth(token), "Idempotency-Key": "ib-z"},
    )
    assert denied.status_code == 403


# ------------------------------------------
# urgent loads
# ------------------------------------------


async def test_urgent_load_notifies_nearby_verified_owners_once(client, user_store):
    await _fleet(client, user_store)
    farmer = _farmer_token(user_store)

    resp = await client.post(
        "/v1/transport/loads",
        json={**LOAD_BODY, "urgent": True, "pickupLat": CENTER_LAT, "pickupLng": CENTER_LNG},
        headers=_auth(farmer),
    )
    assert resp.status_code == 201
    urgent_load = resp.json()
    assert urgent_load["urgent"] is True

    # uid-1 owns two eligible vehicles (custom + catalog) but is pinged once;
    # the idle vehicle and the expired-doc stranger are skipped.
    notes = _notifications(user_store, "urgent_load_nearby")
    assert len(notes) == 1
    assert notes[0]["userId"] == "uid-1"
    assert notes[0]["data"]["deepLink"] == "/transporter/loads"

    # a plain load pings nobody...
    plain = await client.post("/v1/transport/loads", json=LOAD_BODY, headers=_auth(farmer))
    assert plain.status_code == 201
    assert len(_notifications(user_store, "urgent_load_nearby")) == 1

    # ...and the urgent load pins to the top of the board
    board = await client.get("/v1/transport/loads", headers=_auth(farmer))
    assert board.status_code == 200
    assert board.json()["data"][0]["id"] == urgent_load["id"]
    assert board.json()["data"][0]["urgent"] is True


# ------------------------------------------
# driver assignment & analytics
# ------------------------------------------


async def test_assign_driver_on_accepted_booking_only(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    accepted = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert accepted.status_code == 200

    stranger = _other_transporter_token(user_store)
    forbidden = await client.post(
        f"/v1/transport/bookings/{booking['id']}/assign-driver",
        json={"driverName": "X Y", "driverPhone": "+919800000099"},
        headers=_auth(stranger),
    )
    assert forbidden.status_code == 403

    missing = await client.post(
        "/v1/transport/bookings/trb_missing/assign-driver",
        json={"driverName": "X Y", "driverPhone": "+919800000099"},
        headers=_auth(token),
    )
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "BOOKING_NOT_FOUND"

    assigned = await client.post(
        f"/v1/transport/bookings/{booking['id']}/assign-driver",
        json={"driverName": "Mohan Driver", "driverPhone": "+919800000010"},
        headers=_auth(token),
    )
    assert assigned.status_code == 200
    assert assigned.json()["driverName"] == "Mohan Driver"
    assert user_store[f"transport_bookings/{booking['id']}"]["driverPhone"] == "+919800000010"

    enroute = await client.patch(
        f"/v1/transport/bookings/{booking['id']}",
        json={"status": "enRoute"},
        headers=_auth(token),
    )
    assert enroute.status_code == 200
    too_late = await client.post(
        f"/v1/transport/bookings/{booking['id']}/assign-driver",
        json={"driverName": "Late Driver", "driverPhone": "+919800000012"},
        headers=_auth(token),
    )
    assert too_late.status_code == 409
    assert too_late.json()["error"]["code"] == "BOOKING_NOT_ACCEPTED"


async def test_driver_analytics_aggregates_assigned_trips(client, user_store):
    from tests.test_transport import POD

    await seed_plans()
    token = await _token(client)
    today = datetime.now(timezone.utc).date().isoformat()
    booking = (await _book(client, token, date=today)).json()
    await _activate(client, token)
    subscribed = await client.post(
        "/v1/billing/subscribe", json={"planId": "transport_pro"}, headers=_auth(token)
    )
    assert subscribed.status_code == 201
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    driver = (
        await client.post(
            "/v1/transport/drivers",
            json={"name": "Mohan Driver", "phone": "+919800000010"},
            headers=_auth(token),
        )
    ).json()

    accepted = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={
            "vehicleId": vehicle["id"],
            "vehicleNo": vehicle["registrationNo"],
            "driverName": "Mohan Driver",
            "driverPhone": "+919800000010",
        },
        headers=_auth(token),
    )
    assert accepted.status_code == 200

    # before delivery: trip counts but earns nothing
    resp = await client.get(f"/v1/transport/drivers/{driver['id']}/analytics", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["driverUserId"] == driver["id"]
    assert body["trips"] == {"total": 1, "completed": 0, "cancelled": 0}
    assert body["grossEarnings"] == 0
    assert body["thisMonthEarnings"] == 0
    assert body["totalKm"] == 0
    assert body["avgRating"] is None

    for status_body in ({"status": "enRoute"}, {"status": "delivered", **POD}):
        patched = await client.patch(
            f"/v1/transport/bookings/{booking['id']}",
            json=status_body,
            headers=_auth(token),
        )
        assert patched.status_code == 200

    user_store[f"users/{driver['id']}"]["ratingStats"] = {"average": 4.5}
    resp = await client.get(f"/v1/transport/drivers/{driver['id']}/analytics", headers=_auth(token))
    body = resp.json()
    assert body["trips"] == {"total": 1, "completed": 1, "cancelled": 0}
    assert body["grossEarnings"] == booking["fare"]
    assert body["thisMonthEarnings"] == booking["fare"]  # trip dated today
    assert body["totalKm"] == booking["distanceKm"]
    assert body["avgRating"] == 4.5

    # drivers of another fleet are invisible
    user_store["users/uid-stranger"] = {
        "id": "uid-stranger",
        "linkedProfiles": ["driver"],
        "primaryProfile": "driver",
        "activeProfile": "driver",
        "fleetOwnerId": "someone-else",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    outsider = await client.get(
        "/v1/transport/drivers/uid-stranger/analytics", headers=_auth(token)
    )
    assert outsider.status_code == 404
    assert outsider.json()["error"]["code"] == "DRIVER_NOT_FOUND"
    missing = await client.get("/v1/transport/drivers/drv_nope/analytics", headers=_auth(token))
    assert missing.status_code == 404


# ------------------------------------------
# direct chat contexts (vehicle / booking)
# ------------------------------------------


async def test_direct_chat_vehicle_and_booking_contexts(client, user_store):
    token, custom, *_ = await _fleet(client, user_store)
    farmer = _farmer_token(user_store)

    # vehicle context: any authenticated user may open a business-inquiry DM
    opened = await client.post(
        "/v1/chat/direct", json={"vehicleId": custom["id"]}, headers=_auth(farmer)
    )
    assert opened.status_code == 200
    room = opened.json()
    assert room["kind"] == "direct"
    pair = sorted(["uid-farmer", "uid-1"])
    assert room["id"] == f"dm_{pair[0]}_{pair[1]}"

    # owner cannot DM their own vehicle
    own = await client.post(
        "/v1/chat/direct", json={"vehicleId": custom["id"]}, headers=_auth(token)
    )
    assert own.status_code == 400
    assert own.json()["error"]["code"] == "OWN_LISTING"

    missing_vehicle = await client.post(
        "/v1/chat/direct", json={"vehicleId": "veh_nope"}, headers=_auth(farmer)
    )
    assert missing_vehicle.status_code == 404
    assert missing_vehicle.json()["error"]["code"] == "VEHICLE_NOT_FOUND"

    # booking context: chat opens only once a transporter is assigned
    user_store["transport_bookings/trb_acc"] = {
        "id": "trb_acc",
        "userId": "uid-farmer",
        "transporterId": "uid-1",
        "status": "accepted",
        "commodity": "Onion",
    }
    via_booking = await client.post(
        "/v1/chat/direct", json={"bookingId": "trb_acc"}, headers=_auth(farmer)
    )
    assert via_booking.status_code == 200
    assert via_booking.json()["id"] == f"dm_{pair[0]}_{pair[1]}"  # same stable room

    user_store["transport_bookings/trb_req"] = {
        "id": "trb_req",
        "userId": "uid-farmer",
        "status": "requested",
    }
    pre_accept = await client.post(
        "/v1/chat/direct", json={"bookingId": "trb_req"}, headers=_auth(farmer)
    )
    assert pre_accept.status_code == 409
    assert pre_accept.json()["error"]["code"] == "BOOKING_NOT_ACCEPTED"

    missing_booking = await client.post(
        "/v1/chat/direct", json={"bookingId": "trb_nope"}, headers=_auth(farmer)
    )
    assert missing_booking.status_code == 404
    assert missing_booking.json()["error"]["code"] == "BOOKING_NOT_FOUND"
