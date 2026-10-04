"""WS-04 step 6: pricing engine — hourly / per-acre / package quotes in
integer paisa; the machine doc's `pricing` block overrides legacy flat rates."""
from app.services.billing import seed_plans
from tests.test_equipment import seed_equipment
from tests.test_equipment_owner import _owner_token
from tests.test_users import _auth


async def _pro_token(client, user_store):
    await seed_plans()
    token = await _owner_token(client)
    subscribed = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "equipmentRental_pro"},
        headers=_auth(token),
    )
    assert subscribed.status_code == 201
    return token

PRICING = {
    "hourly": 900,
    "perAcre": 1500,
    "package": {"fullDay": 6200, "sowingSeason": 24000},
}


async def _machine(client, token):
    resp = await client.post(
        "/v1/equipment",
        json={
            "name": "Mahindra 575 DI",
            "type": "tractor",
            "hourlyRate": 700,
            "perAcreRate": 1200,
            "pricing": PRICING,
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    return resp.json()


async def test_hourly_quote_uses_pricing_block(client, user_store):
    token = await _pro_token(client, user_store)
    machine = await _machine(client, token)
    viewer = token

    resp = await client.post(
        f"/v1/equipment/{machine['id']}/quote",
        json={"mode": "hourly", "hours": 6},
        headers=_auth(viewer),
    )
    assert resp.status_code == 200
    quote = resp.json()
    # pricing.hourly (900) wins over legacy hourlyRate (700)
    assert quote["unitPriceRupees"] == 900
    assert quote["totalRupees"] == 5400
    assert quote["totalPaisa"] == 540000
    assert quote["currency"] == "INR"


async def test_per_acre_quote(client, user_store):
    token = await _pro_token(client, user_store)
    machine = await _machine(client, token)

    resp = await client.post(
        f"/v1/equipment/{machine['id']}/quote",
        json={"mode": "perAcre", "acres": 3.5},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    quote = resp.json()
    assert quote["unitPriceRupees"] == 1500
    assert quote["totalRupees"] == 5250
    assert quote["totalPaisa"] == 525000


async def test_package_quote(client, user_store):
    token = await _pro_token(client, user_store)
    machine = await _machine(client, token)

    resp = await client.post(
        f"/v1/equipment/{machine['id']}/quote",
        json={"mode": "package", "packageName": "fullDay"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    quote = resp.json()
    assert quote["totalRupees"] == 6200
    assert quote["totalPaisa"] == 620000
    assert quote["unitLabel"] == "package:fullDay"

    # defaulting to the first package works too
    resp = await client.post(
        f"/v1/equipment/{machine['id']}/quote",
        json={"mode": "package"},
        headers=_auth(token),
    )
    assert resp.json()["totalPaisa"] == 620000


async def test_legacy_machine_falls_back_to_flat_rates(client, user_store):
    token = await _pro_token(client, user_store)
    resp = await client.post(
        "/v1/equipment",
        json={"name": "Old Tractor", "type": "tractor", "hourlyRate": 650},
        headers=_auth(token),
    )
    machine = resp.json()
    resp = await client.post(
        f"/v1/equipment/{machine['id']}/quote",
        json={"mode": "hourly", "hours": 2},
        headers=_auth(token),
    )
    assert resp.json()["unitPriceRupees"] == 650


async def test_unknown_package_and_bad_modes_422(client, user_store):
    token = await _pro_token(client, user_store)
    machine = await _machine(client, token)
    resp = await client.post(
        f"/v1/equipment/{machine['id']}/quote",
        json={"mode": "package", "packageName": "decade"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "PACKAGE_NOT_FOUND"

    resp = await client.post(
        f"/v1/equipment/{machine['id']}/quote",
        json={"mode": "moon"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_MODE"


async def test_missing_machine_404(client, user_store):
    token = await _pro_token(client, user_store)
    resp = await client.post(
        "/v1/equipment/eq-missing/quote",
        json={"mode": "hourly", "hours": 1},
        headers=_auth(token),
    )
    assert resp.status_code == 404
