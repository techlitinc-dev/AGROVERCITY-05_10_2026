from tests.test_transport import _activate, _token
from tests.test_users import _auth

LOAD_BODY = {
    "pickupLocation": "Pimpalgaon",
    "dropLocation": "Nashik APMC",
    "crop": "Onion",
    "quantityQuintals": 40,
    "packaging": "Gunny Bags",
    "perishable": False,
    "preferredVehicleType": "Tractor Trolley",
    "pickupDate": "2026-10-05",
    "targetFare": 2500,
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
        json={"quotedFare": 2800, "notes": "including loading"},
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
