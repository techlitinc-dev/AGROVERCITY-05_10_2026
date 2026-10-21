"""Booking price offers / negotiation rounds on direct bookings."""

from tests.test_transport import _book, _other_transporter_token, _token
from tests.test_users import _auth


async def _requested_booking(client):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    booking = (await _book(client, farmer_token)).json()
    return farmer_token, booking


def _offer(fare_paise, message=None):
    body = {"farePaise": fare_paise}
    if message:
        body["message"] = message
    return body


async def test_offer_counter_accept_round_trip(client, user_store):
    farmer_token, booking = await _requested_booking(client)
    transporter_token = _other_transporter_token(user_store)

    # transporter quotes ₹1,500 (round 1)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/offer",
        json=_offer(150000, "ready to load today"),
        headers=_auth(transporter_token),
    )
    assert resp.status_code == 201
    offer = resp.json()
    assert offer["fromRole"] == "transporter"
    assert offer["round"] == 1
    assert offer["status"] == "pending"
    assert offer["farePaise"] == 150000

    # farmer counters at ₹1,300 (round 2)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/offers/{offer['offerId']}/counter",
        json=_offer(130000),
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 201
    counter = resp.json()
    assert counter["fromRole"] == "farmer"
    assert counter["round"] == 2

    # original offer now countered
    offers = (
        await client.get(
            f"/v1/transport/bookings/{booking['id']}/offers", headers=_auth(farmer_token)
        )
    ).json()["data"]
    by_id = {o["offerId"]: o for o in offers}
    assert by_id[offer["offerId"]]["status"] == "countered"
    assert by_id[counter["offerId"]]["status"] == "pending"

    # transporter accepts the counter → booking accepted at the counter fare
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/offers/{counter['offerId']}/accept",
        headers=_auth(transporter_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"

    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["status"] == "accepted"
    assert stored["transporterId"] == "uid-2"
    assert stored["farePaise"] == 130000
    assert stored["fare"] == 1300.0
    waypoints = [w["waypoint"] for w in stored["waypointsLog"]]
    assert "offer_accepted" in waypoints

    # chat room created by the accept
    assert user_store[f"chat_rooms/{booking['id']}"]["kind"] == "transport"

    # no further offers once accepted
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/offer",
        json=_offer(100000),
        headers=_auth(transporter_token),
    )
    assert resp.status_code == 409


async def test_accept_declines_other_pending_offers(client, user_store):
    farmer_token, booking = await _requested_booking(client)
    transporter_token = _other_transporter_token(user_store)

    first = (
        await client.post(
            f"/v1/transport/bookings/{booking['id']}/offer",
            json=_offer(150000),
            headers=_auth(transporter_token),
        )
    ).json()
    second = (
        await client.post(
            f"/v1/transport/bookings/{booking['id']}/offer",
            json=_offer(140000),
            headers=_auth(transporter_token),
        )
    ).json()
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/offers/{first['offerId']}/accept",
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    offers = (
        await client.get(
            f"/v1/transport/bookings/{booking['id']}/offers", headers=_auth(farmer_token)
        )
    ).json()["data"]
    by_id = {o["offerId"]: o for o in offers}
    assert by_id[first["offerId"]]["status"] == "accepted"
    assert by_id[second["offerId"]]["status"] == "declined"


async def test_decline_path(client, user_store):
    farmer_token, booking = await _requested_booking(client)
    transporter_token = _other_transporter_token(user_store)
    offer = (
        await client.post(
            f"/v1/transport/bookings/{booking['id']}/offer",
            json=_offer(150000),
            headers=_auth(transporter_token),
        )
    ).json()

    # the offer creator cannot decline their own offer
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/offers/{offer['offerId']}/decline",
        headers=_auth(transporter_token),
    )
    assert resp.status_code == 403

    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/offers/{offer['offerId']}/decline",
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "declined"
    # booking stays requested
    assert user_store[f"transport_bookings/{booking['id']}"]["status"] == "requested"

    # a declined offer cannot be accepted
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/offers/{offer['offerId']}/accept",
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 409


async def test_round_cap_409(client, user_store):
    farmer_token, booking = await _requested_booking(client)
    transporter_token = _other_transporter_token(user_store)

    offer = (
        await client.post(
            f"/v1/transport/bookings/{booking['id']}/offer",
            json=_offer(150000),
            headers=_auth(transporter_token),
        )
    ).json()
    # 5 counters → rounds 2..6; the 6th counter attempt must 409
    current = offer
    tokens = [farmer_token, transporter_token]
    for i in range(5):
        resp = await client.post(
            f"/v1/transport/bookings/{booking['id']}/offers/{current['offerId']}/counter",
            json=_offer(150000 - (i + 1) * 5000),
            headers=_auth(tokens[i % 2]),
        )
        assert resp.status_code == 201, i
        current = resp.json()
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/offers/{current['offerId']}/counter",
        json=_offer(100000),
        headers=_auth(tokens[5 % 2]),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "OFFER_ROUND_LIMIT"


async def test_wrong_party_accept_403_and_stranger_403(client, user_store):
    farmer_token, booking = await _requested_booking(client)
    transporter_token = _other_transporter_token(user_store)
    offer = (
        await client.post(
            f"/v1/transport/bookings/{booking['id']}/offer",
            json=_offer(150000),
            headers=_auth(transporter_token),
        )
    ).json()

    # the offer creator is not the counterparty
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/offers/{offer['offerId']}/accept",
        headers=_auth(transporter_token),
    )
    assert resp.status_code == 403

    # an unrelated user cannot even list the offers
    user_store["users/uid-3"] = {
        "id": "uid-3",
        "linkedProfiles": ["farmer"],
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "mpinHash": None,
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    from app.services.tokens import create_access_token

    stranger = create_access_token("uid-3")
    resp = await client.get(
        f"/v1/transport/bookings/{booking['id']}/offers", headers=_auth(stranger)
    )
    assert resp.status_code == 403
