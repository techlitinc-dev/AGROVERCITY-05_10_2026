"""FT-6 transit insurance add-on."""

from tests.test_transport import POD, _activate, _add_vehicle, _book, _token, _verify_vehicle
from tests.test_users import _auth


async def _delivered_insured(client, user_store, **overrides):
    token = await _token(client)
    booking = (
        await _book(
            client,
            token,
            declaredValuePaisa=overrides.pop("declaredValuePaisa", 1000000),
            insuranceOptIn=True,
            **overrides,
        )
    ).json()
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


async def test_insurance_block_on_booking(client, user_store):
    token = await _token(client)
    resp = await _book(client, token, declaredValuePaisa=1000000, insuranceOptIn=True)
    assert resp.status_code == 200
    insurance = resp.json()["insurance"]
    assert insurance["coveragePaisa"] == 1000000  # ₹10,000 covered
    assert insurance["premiumPaisa"] == 8000      # 0.8% → ₹80 premium
    assert insurance["ratePct"] == 0.8


async def test_insurance_coverage_capped(client, user_store):
    token = await _token(client)
    resp = await _book(client, token, declaredValuePaisa=100000000, insuranceOptIn=True)
    insurance = resp.json()["insurance"]
    assert insurance["coveragePaisa"] == 50000000   # ₹5,00,000 cap
    assert insurance["premiumPaisa"] == 400000      # 0.8% of the capped coverage


async def test_insurance_requires_declared_value(client, user_store):
    token = await _token(client)
    resp = await _book(client, token, insuranceOptIn=True)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "DECLARED_VALUE_REQUIRED"


async def test_no_optin_no_block(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token, declaredValuePaisa=1000000)).json()
    assert booking["insurance"] is None


async def test_load_insurance_carries_into_auction_booking(client, user_store):
    token = await _token(client)
    load = (
        await client.post(
            "/v1/transport/loads",
            json={
                "pickupLocation": "Pimplas, Nashik",
                "dropLocation": "Vashi APMC",
                "crop": "Onion",
                "quantityQuintals": 20,
                "preferredVehicleType": "Bolero Maxi",
                "pickupDate": "2026-10-09",
                "targetFare": 9000,
                "declaredValuePaisa": 2000000,
                "insuranceOptIn": True,
            },
            headers=_auth(token),
        )
    ).json()
    assert load["insurance"]["premiumPaisa"] == 16000  # 0.8% of ₹20,000

    await _activate(client, token)
    bid = (
        await client.post(
            f"/v1/transport/loads/{load['id']}/bid",
            json={"quotedFare": 8800, "termsAccepted": True, "mpin": "1234"},
            headers=_auth(token),
        )
    ).json()
    accepted = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid?bidId={bid['id']}",
        headers=_auth(token),
    )
    booking = accepted.json()["booking"]
    assert booking["insurance"]["coveragePaisa"] == 2000000


async def test_template_insurance_carries_into_repeat(client, user_store):
    token = await _token(client)
    template = (
        await client.post(
            "/v1/transport/load-templates",
            json={
                "name": "Insured grape run",
                "pickupLocation": "Nashik",
                "dropLocation": "Mumbai",
                "crop": "Grapes",
                "quantityQuintals": 15,
                "preferredVehicleType": "Reefer Cold Van",
                "targetFare": 12000,
                "declaredValuePaisa": 8000000,
                "insuranceOptIn": True,
            },
            headers=_auth(token),
        )
    ).json()
    repeated = await client.post(
        f"/v1/transport/load-templates/{template['id']}/repeat",
        json={"pickupDate": "2026-10-15"},
        headers=_auth(token),
    )
    assert repeated.status_code == 201
    assert repeated.json()["insurance"]["coveragePaisa"] == 8000000


async def test_insured_damage_dispute_auto_claims(client, user_store):
    token, booking = await _delivered_insured(client, user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/damage-disputes",
        json={"photos": ["https://storage.example/dmg/1.jpg"], "claimPaisa": 25000},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    dispute = resp.json()
    assert dispute["insuranceClaim"] is True
    assert dispute["coveragePaisaAtClaim"] == 1000000


async def test_bilty_shows_insurance(client, user_store):
    token, booking = await _delivered_insured(client, user_store)
    bilty = await client.get(
        f"/v1/transport/bookings/{booking['id']}/bilty", headers=_auth(token)
    )
    assert bilty.json()["insurance"]["premiumPaisa"] == 8000
