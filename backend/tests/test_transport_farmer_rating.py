"""FT-3 two-way ratings — transporter rates the farmer/shipper."""

from app.services.billing import seed_plans
from tests.test_transport import (
    POD,
    _activate,
    _add_vehicle,
    _book,
    _other_transporter_token,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth


async def _unlock_pro_fleet(client, token):
    """Free plan allows one vehicle; multi-trip tests need the Pro allowance."""
    await seed_plans()
    subscribed = await client.post(
        "/v1/billing/subscribe", json={"planId": "transport_pro"}, headers=_auth(token)
    )
    assert subscribed.status_code == 201


async def _delivered_booking(client, user_store, pro=False):
    token = await _token(client)
    if pro:
        await _unlock_pro_fleet(client, token)
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
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}", json={"status": "enRoute"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}",
        json={"status": "delivered", **POD},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    return token, booking


async def _rate(client, token, booking_id, **overrides):
    body = {"rating": 5, "tags": ["load_ready_on_time", "accurate_weight"], **overrides}
    return await client.post(
        f"/v1/transport/bookings/{booking_id}/rate-farmer", json=body, headers=_auth(token)
    )


async def test_rate_farmer_happy_path_aggregates(client, user_store):
    token, booking = await _delivered_booking(client, user_store)

    resp = await _rate(client, token, booking["id"], review="crates ready at the gate")
    assert resp.status_code == 201
    body = resp.json()
    assert body["rating"]["rating"] == 5
    stats = body["farmerRatingStats"]
    assert stats["count"] == 1
    assert stats["average"] == 5.0
    assert stats["tags"]["load_ready_on_time"] == 1

    farmer = user_store["users/uid-1"]
    assert farmer["farmerRatingStats"]["count"] == 1
    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["farmerRating"]["rating"] == 5

    # second trip rating averages across trips
    token2, booking2 = await _delivered_booking(client, user_store, pro=True)
    resp = await _rate(client, token2, booking2["id"], rating=4)
    assert resp.json()["farmerRatingStats"]["average"] == 4.5


async def test_rate_farmer_once_only(client, user_store):
    token, booking = await _delivered_booking(client, user_store)
    assert (await _rate(client, token, booking["id"])).status_code == 201
    again = await _rate(client, token, booking["id"], rating=1)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "ALREADY_RATED"


async def test_rate_farmer_requires_delivered(client, user_store):
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
    resp = await _rate(client, token, booking["id"])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ILLEGAL_TRANSITION"


async def test_rate_farmer_validation_and_scoping(client, user_store):
    token, booking = await _delivered_booking(client, user_store)

    bad = await _rate(client, token, booking["id"], rating=9)
    assert bad.status_code == 422

    # unknown tags are dropped, known kept
    resp = await _rate(client, token, booking["id"], rating=3, tags=["made_up_tag"])
    # already-rated from the first _rate? no — bad request above failed, so this is the first valid one
    assert resp.status_code == 201
    assert resp.json()["rating"]["tags"] == []

    from tests.test_transport import _other_transporter_token

    other = _other_transporter_token(user_store)
    token2, booking2 = await _delivered_booking(client, user_store, pro=True)
    forbidden = await _rate(client, other, booking2["id"])
    assert forbidden.status_code == 403


async def test_delivery_opens_both_rating_prompts(client, user_store):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    booking = (await _book(client, farmer_token)).json()

    # a separate transporter (uid-2) takes the trip
    transporter_token = _other_transporter_token(user_store)
    vehicle = await _add_vehicle(client, transporter_token)
    user_store[f"vehicles/{vehicle['id']}"]["docStatus"] = "verified"
    user_store["kyc_cases/kyc_uid-2_transport"] = {
        "caseId": "kyc_uid-2_transport",
        "userId": "uid-2",
        "persona": "transport",
        "docs": [
            {"docId": "kyc_uid-2_transport:rc", "type": "rc", "status": "verified"},
            {"docId": "kyc_uid-2_transport:dl", "type": "dl", "status": "verified"},
        ],
        "status": "verified",
    }
    accepted = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(transporter_token),
    )
    assert accepted.status_code == 200
    for status, payload in (("enRoute", {}), ("delivered", POD)):
        resp = await client.patch(
            f"/v1/transport/bookings/{booking['id']}",
            json={"status": status, **payload},
            headers=_auth(transporter_token),
        )
        assert resp.status_code == 200

    farmer_prompts = [
        d for k, d in user_store.items() if k.startswith("users/uid-1/rating_prompts/")
    ]
    transporter_prompts = [
        d for k, d in user_store.items() if k.startswith("users/uid-2/rating_prompts/")
    ]
    assert any(p["kind"] == "transport_delivery" for p in farmer_prompts)
    shipper = [p for p in transporter_prompts if p["kind"] == "transport_shipper"]
    assert shipper and shipper[0]["transactionId"] == booking["id"]
    assert shipper[0]["rateeUid"] == "uid-1"


async def test_farmer_reputation_visible_to_transporters(client, user_store):
    token, booking = await _delivered_booking(client, user_store)
    await _rate(client, token, booking["id"], rating=4, tags=["good_communication"])

    resp = await client.get("/v1/transport/farmers/uid-1/reputation", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["farmerId"] == "uid-1"
    assert body["farmerRatingStats"]["average"] == 4.0

    missing = await client.get("/v1/transport/farmers/uid-nope/reputation", headers=_auth(token))
    assert missing.status_code == 404
