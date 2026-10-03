from app.services.tasks import DEEP_LINKS  # noqa: F401
from app.services.tokens import create_access_token
from tests.test_lots import LOT_BODY
from tests.test_users import _auth, _register

BOOKING_BODY = {
    "vehicleType": "Tata Ace",
    "distanceKm": 20,
    "pickup": "Pimplas",
    "drop": "Nashik APMC",
    "date": "2026-09-20",
}

VEHICLE_BODY = {
    "vehicleType": "Tata Ace",
    "registrationNo": "MH15 AB 1234",
    "capacityTonnes": 0.75,
}

POD = {"podPhotos": ["https://storage.example/pod/1.jpg"], "receiverName": "Ram Patil"}


async def _token(client, profiles=("farmer", "transport"), primary="farmer"):
    resp = await _register(client, profiles=list(profiles), primaryProfile=primary)
    return resp.json()["accessToken"]


async def _activate(client, token, profile="transport"):
    resp = await client.post(f"/v1/users/me/profiles/{profile}/activate", headers=_auth(token))
    assert resp.status_code == 200


async def _book(client, token, **overrides):
    return await client.post(
        "/v1/transport/bookings", json={**BOOKING_BODY, **overrides}, headers=_auth(token)
    )


async def _add_vehicle(client, token, **overrides):
    resp = await client.post(
        "/v1/transport/vehicles", json={**VEHICLE_BODY, **overrides}, headers=_auth(token)
    )
    assert resp.status_code == 201
    return resp.json()


def _verify_vehicle(user_store, vehicle_id):
    # stands in for the admin KYC action (Day 14)
    user_store[f"vehicles/{vehicle_id}"]["docStatus"] = "verified"


def _other_transporter_token(user_store):
    user_store["users/uid-2"] = {
        "id": "uid-2",
        "linkedProfiles": ["transport"],
        "activeProfile": "transport",
        "primaryProfile": "transport",
        "mpinHash": None,
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    return create_access_token("uid-2")


async def test_vehicle_types(client):
    token = await _token(client)
    resp = await client.get("/v1/transport/vehicles", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 3
    assert data[0]["type"] == "Tata Ace"


async def test_fare_estimate(client):
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/fare-estimate",
        json={"vehicleType": "Tata Ace", "distanceKm": 20},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["distanceFare"] == 700
    assert body["totalFare"] == 1200
    resp = await client.post(
        "/v1/transport/fare-estimate",
        json={"vehicleType": "Spaceship", "distanceKm": 20},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UNKNOWN_VEHICLE_TYPE"


async def test_booking_lifecycle(client, user_store):
    token = await _token(client)
    resp = await _book(client, token)
    assert resp.status_code == 200
    booking = resp.json()
    assert booking["status"] == "requested"
    assert booking["fare"] == 1200
    assert booking["vehicleId"] is None
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}",
        json={"status": "accepted", "vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
    assert resp.json()["vehicleNo"] == vehicle["registrationNo"]
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}", json={"status": "enRoute"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "enRoute"
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}", json={"status": "delivered", **POD}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "delivered"


async def test_illegal_transition(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}",
        json={"status": "delivered", **POD},
        headers=_auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ILLEGAL_TRANSITION"
    for body in ({"status": "accepted"}, {"status": "enRoute"}, {"status": "delivered", **POD}):
        resp = await client.patch(
            f"/v1/transport/bookings/{booking['id']}", json=body, headers=_auth(token)
        )
        assert resp.status_code == 200
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}", json={"status": "cancelled"}, headers=_auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ILLEGAL_TRANSITION"


async def test_owner_vehicle_crud(client, user_store):
    token = await _token(client, profiles=("transport",), primary="transport")
    vehicle = await _add_vehicle(client, token)
    resp = await client.get("/v1/transport/vehicles/my", headers=_auth(token))
    assert any(v["id"] == vehicle["id"] for v in resp.json()["data"])
    other_token = _other_transporter_token(user_store)
    resp = await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}", json=VEHICLE_BODY, headers=_auth(other_token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "NOT_VEHICLE_OWNER"
    resp = await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}",
        json={**VEHICLE_BODY, "registrationNo": "MH15 CD 5678"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["registrationNo"] == "MH15 CD 5678"
    resp = await client.delete(f"/v1/transport/vehicles/{vehicle['id']}", headers=_auth(token))
    assert resp.status_code == 200
    assert user_store[f"vehicles/{vehicle['id']}"]["active"] is False
    resp = await client.get("/v1/transport/vehicles/my", headers=_auth(token))
    assert resp.json()["data"] == []


async def test_vehicle_calendar_and_availability(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    resp = await client.get(f"/v1/transport/vehicles/{vehicle['id']}/calendar", headers=_auth(token))
    assert resp.status_code == 200
    trips = resp.json()["bookings"]
    assert len(trips) == 1
    assert trips[0]["bookingId"] == booking["id"]
    assert trips[0]["status"] == "accepted"
    dates = ["2026-09-20", "2026-09-21"]
    resp = await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}/availability",
        json={"availableDates": dates},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["availableDates"] == dates
    assert user_store[f"vehicles/{vehicle['id']}"]["availableDates"] == dates


async def test_new_vehicle_pending_doc_status(client):
    token = await _token(client, profiles=("transport",), primary="transport")
    vehicle = await _add_vehicle(client, token)
    assert vehicle["docStatus"] == "pending"
    assert vehicle["rejectionReason"] is None


async def test_accept_with_unverified_vehicle_422(client):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"]},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VEHICLE_NOT_VERIFIED"


async def test_accept_with_verified_vehicle_ok(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
    assert resp.json()["vehicleId"] == vehicle["id"]


async def test_verified_only_filter(client, user_store):
    token = await _token(client, profiles=("transport",), primary="transport")
    pending = await _add_vehicle(client, token, registrationNo="MH15 AA 0001")
    verified = await _add_vehicle(client, token, registrationNo="MH15 AA 0002")
    _verify_vehicle(user_store, verified["id"])
    headers = _auth(token)
    resp = await client.get("/v1/transport/vehicles/my", headers=headers)
    assert len(resp.json()["data"]) == 2
    resp = await client.get(
        "/v1/transport/vehicles/my", params={"verifiedOnly": "true"}, headers=headers
    )
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["id"] == verified["id"]
    assert data[0]["id"] != pending["id"]


async def test_delivered_requires_pod(client):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    for body in ({"status": "accepted"}, {"status": "enRoute"}):
        resp = await client.patch(
            f"/v1/transport/bookings/{booking['id']}", json=body, headers=_auth(token)
        )
        assert resp.status_code == 200
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}", json={"status": "delivered"}, headers=_auth(token)
    )
    assert resp.status_code == 422
    error = resp.json()["error"]
    assert error["code"] == "POD_REQUIRED"
    assert "podPhotos" in error["fieldErrors"]
    assert "receiverName" in error["fieldErrors"]


async def test_delivered_with_pod(client):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    for body in ({"status": "accepted"}, {"status": "enRoute"}, {"status": "delivered", **POD}):
        resp = await client.patch(
            f"/v1/transport/bookings/{booking['id']}", json=body, headers=_auth(token)
        )
        assert resp.status_code == 200
    assert resp.json()["status"] == "delivered"
    assert resp.json()["pod"]["receiverName"] == POD["receiverName"]
    assert resp.json()["pod"]["photos"] == POD["podPhotos"]


async def test_pod_visible_in_detail(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    steps = (
        {"status": "accepted", "vehicleId": vehicle["id"]},
        {"status": "enRoute"},
        {"status": "delivered", **POD},
    )
    for body in steps:
        resp = await client.patch(
            f"/v1/transport/bookings/{booking['id']}", json=body, headers=_auth(token)
        )
        assert resp.status_code == 200
    resp = await client.get("/v1/transport/bookings", headers=_auth(token))
    found = [b for b in resp.json()["data"] if b["id"] == booking["id"]]
    assert len(found) == 1
    assert found[0]["pod"]["receiverName"] == POD["receiverName"]


async def test_booking_with_own_open_lot(client):
    token = await _token(client)
    lot = (
        await client.post("/v1/market/lots", json=LOT_BODY, headers=_auth(token))
    ).json()
    resp = await _book(client, token, lotId=lot["id"])
    assert resp.status_code == 200
    assert resp.json()["lotId"] == lot["id"]
    await _activate(client, token)
    resp = await client.get("/v1/transport/bookings", headers=_auth(token))
    booking = next(b for b in resp.json()["data"] if b.get("lotId") == lot["id"])
    assert booking["lot"] == {
        "crop": LOT_BODY["crop"],
        "quantityQuintals": LOT_BODY["quantityQuintals"],
        "expectedRate": LOT_BODY["expectedRate"],
    }


async def test_booking_with_other_farmers_lot_404(client, user_store):
    token = await _token(client)
    user_store["market_lots/lot_other"] = {
        **LOT_BODY,
        "id": "lot_other",
        "farmerId": "uid-other",
        "status": "open",
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    resp = await _book(client, token, lotId="lot_other")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOT_NOT_FOUND"


async def test_booking_with_sold_lot_409(client, user_store):
    token = await _token(client)
    lot = (
        await client.post("/v1/market/lots", json=LOT_BODY, headers=_auth(token))
    ).json()
    user_store[f"market_lots/{lot['id']}"]["status"] = "sold"
    resp = await _book(client, token, lotId=lot["id"])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOT_NOT_OPEN"


async def test_accept_booking_emits_task(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 1
    assert tasks[0]["module"] == "transport"
    assert tasks[0]["kind"] == "trip_starting"
    assert tasks[0]["deepLink"] == f"{DEEP_LINKS['transport']}/{booking['id']}"
