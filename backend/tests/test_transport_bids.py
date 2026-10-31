from tests.test_transport import _activate, _add_vehicle, _other_transporter_token, _token, _verify_vehicle
from tests.test_users import _auth

LOAD_BODY = {
    "pickupLocation": "Pimpalgaon",
    "dropLocation": "Nashik APMC",
    "crop": "Onion",
    "quantityQuintals": 20,
    "packaging": "Gunny Bags",
    "perishable": False,
    "preferredVehicleType": "Tractor Trolley",
    "pickupDate": "2026-11-05",
    "targetFare": 2500,
    "termsAccepted": True,
}


async def _load_with_bid(client):
    """Farmer posts an open load, transporter (same dual-profile user) bids on it."""
    token = await _token(client)
    resp = await client.post("/v1/transport/loads", json=LOAD_BODY, headers=_auth(token))
    assert resp.status_code == 201
    load = resp.json()
    await _activate(client, token)
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/bid",
        json={"quotedFare": 2800, "notes": "including loading", "termsAccepted": True, "mpin": "1234"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    bid = resp.json()
    return token, load, bid


async def test_bid_counter_accepted_once_then_rejected(client):
    token, load, bid = await _load_with_bid(client)

    first = await client.post(
        f"/v1/transport/loads/{load['id']}/bids/{bid['id']}/counter",
        json={"quotedFare": 2600, "notes": "final from my side"},
        headers={**_auth(token), "Idempotency-Key": "counter-1"},
    )
    assert first.status_code == 200
    assert first.json()["counter"]["quotedFare"] == 2600

    second = await client.post(
        f"/v1/transport/loads/{load['id']}/bids/{bid['id']}/counter",
        json={"quotedFare": 2550},
        headers={**_auth(token), "Idempotency-Key": "counter-2"},
    )
    assert second.status_code == 422
    assert second.json()["error"]["code"] == "COUNTER_LIMIT_REACHED"


async def test_bid_counter_replay_idempotent(client):
    token, load, bid = await _load_with_bid(client)

    first = await client.post(
        f"/v1/transport/loads/{load['id']}/bids/{bid['id']}/counter",
        json={"quotedFare": 2600},
        headers={**_auth(token), "Idempotency-Key": "counter-replay"},
    )
    assert first.status_code == 200
    replay = await client.post(
        f"/v1/transport/loads/{load['id']}/bids/{bid['id']}/counter",
        json={"quotedFare": 2600},
        headers={**_auth(token), "Idempotency-Key": "counter-replay"},
    )
    assert replay.status_code == 200
    assert replay.json()["counter"]["at"] == first.json()["counter"]["at"]


async def test_bid_requires_terms_acceptance(client):
    token = await _token(client)
    resp = await client.post("/v1/transport/loads", json=LOAD_BODY, headers=_auth(token))
    assert resp.status_code == 201
    load = resp.json()
    await _activate(client, token)

    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/bid",
        json={"quotedFare": 2800},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TERMS_REQUIRED"


async def test_bid_requires_correct_mpin_when_on_file(client):
    token = await _token(client)
    resp = await client.post("/v1/transport/loads", json=LOAD_BODY, headers=_auth(token))
    assert resp.status_code == 201
    load = resp.json()
    await _activate(client, token)

    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/bid",
        json={"quotedFare": 2800, "termsAccepted": True, "mpin": "9999"},
        headers=_auth(token),
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"


async def test_bid_contact_hidden_until_accepted_then_revealed(client, user_store):
    """Produce/vyapari parity: bids stay anonymized; the farmer's accept
    unlocks both sides' phone + WhatsApp and rejects sibling applications."""
    token = await _token(client)
    resp = await client.post("/v1/transport/loads", json=LOAD_BODY, headers=_auth(token))
    assert resp.status_code == 201
    load = resp.json()
    await _activate(client, token)

    first = await client.post(
        f"/v1/transport/loads/{load['id']}/bid",
        json={"quotedFare": 2800, "termsAccepted": True, "mpin": "1234"},
        headers=_auth(token),
    )
    assert first.status_code == 201
    assert "transporterPhone" not in first.json()

    # The same transporter cannot stack a second active application.
    duplicate = await client.post(
        f"/v1/transport/loads/{load['id']}/bid",
        json={"quotedFare": 2600, "termsAccepted": True, "mpin": "1234"},
        headers=_auth(token),
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "DUPLICATE_BID"

    # A different transporter bids lower.
    other_token = _other_transporter_token(user_store)
    second = await client.post(
        f"/v1/transport/loads/{load['id']}/bid",
        json={"quotedFare": 2600, "termsAccepted": True},
        headers=_auth(other_token),
    )
    assert second.status_code == 201

    board = await client.get(f"/v1/transport/loads/{load['id']}/bids", headers=_auth(token))
    assert board.status_code == 200
    for bid in board.json()["data"]:
        assert "transporterPhone" not in bid

    accept = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid",
        json={"bidId": first.json()["id"], "termsAccepted": True, "mpin": "1234"},
        headers=_auth(token),
    )
    assert accept.status_code == 200
    body = accept.json()
    reveal = body["contactReveal"]
    assert reveal["farmer"]["phoneDigits"]
    assert reveal["transporter"]["phoneDigits"]
    assert body["booking"]["driverPhone"] == reveal["transporter"]["phone"]
    assert body["load"]["status"] == "booked"

    # The losing application is auto-rejected.
    board_after = await client.get(f"/v1/transport/loads/{load['id']}/bids", headers=_auth(token))
    statuses = {b["id"]: b["status"] for b in board_after.json()["data"]}
    assert statuses[first.json()["id"]] == "accepted"
    assert statuses[second.json()["id"]] == "rejected"

    # Both desks reflect the reveal.
    mine = await client.get("/v1/transport/loads/mine", headers=_auth(token))
    my_load = next(l for l in mine.json()["data"] if l["id"] == load["id"])
    assert my_load["contactReveal"]["transporter"]["phoneDigits"]

    my_bids = await client.get("/v1/transport/loads/my-bids", headers=_auth(token))
    entry = next(
        b
        for b in my_bids.json()["data"]
        if b["load"]["id"] == load["id"] and b["status"] == "accepted"
    )
    assert entry["contactReveal"]["farmer"]["phoneDigits"]


async def test_bid_vehicle_availability_gate(client, user_store):
    """A bid can only attach a verified vehicle that is free on the pickup date."""
    token = await _token(client)
    resp = await client.post("/v1/transport/loads", json=LOAD_BODY, headers=_auth(token))
    assert resp.status_code == 201
    load = resp.json()
    await _activate(client, token)
    vehicle = await _add_vehicle(
        client,
        token,
        vehicleType="Eicher 6-Wheeler",
        registrationNo="MH12 CD 9011",
        capacityTonnes=6.0,
    )
    _verify_vehicle(user_store, vehicle["id"])

    # Vehicle busy on the pickup date → rejected.
    await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}/availability",
        json={"availableDates": ["2026-12-01"]},
        headers=_auth(token),
    )
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/bid",
        json={"quotedFare": 2800, "termsAccepted": True, "mpin": "1234", "vehicleId": vehicle["id"]},
        headers=_auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "VEHICLE_NOT_AVAILABLE"

    # Vehicle free on the pickup date → accepted.
    await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}/availability",
        json={"availableDates": [LOAD_BODY["pickupDate"]]},
        headers=_auth(token),
    )
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/bid",
        json={"quotedFare": 2800, "termsAccepted": True, "mpin": "1234", "vehicleId": vehicle["id"]},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["vehicleNo"] == vehicle["registrationNo"]
