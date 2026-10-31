"""Transporter SaaS entitlements (instructions.md WS-02 step 13 / robust.md §6.3):
Free = 1 vehicle; Pro ₹499/mo = fleet of 5 + driver
sub-accounts + route analytics + priority load board; Enterprise = unlimited
fleet + API dispatch + dedicated support. Direct-connect: the platform takes
no commission on transport fares at any tier — fares settle directly between
farmer and transporter, so no transport settlement accrues on any plan.
"""
from app.services.billing import seed_plans
from tests.test_transport import _activate, _add_vehicle, _token
from tests.test_transport_bids import LOAD_BODY
from tests.test_users import _auth


async def _subscribe(client, token, plan_id):
    resp = await client.post(
        "/v1/billing/subscribe", json={"planId": plan_id}, headers=_auth(token)
    )
    assert resp.status_code == 201
    return resp.json()


async def test_free_tier_unlimited_vehicles(client, user_store):
    """Direct-connect: fleet size is not paywalled — the free plan allows
    unlimited vehicles."""
    await seed_plans()
    token = await _token(client)
    await _activate(client, token)

    resp = await _add_vehicle(client, token)
    # direct-connect: usable immediately, no review
    assert resp["docStatus"] == "verified"

    # no 402 — keep adding well past the old Free limit of 1
    for i in range(4):
        extra = await client.post("/v1/transport/vehicles", json={
            "vehicleType": "Bolero Maxi",
            "registrationNo": f"MH15 CD 56{i}8",
            "capacityTonnes": 1.5,
        }, headers=_auth(token))
        assert extra.status_code == 201, extra.json()


async def test_pro_tier_unlimited_fleet(client, user_store):
    """Pro keeps its feature gates (drivers, analytics) but the fleet itself
    is unlimited on every tier."""
    await seed_plans()
    token = await _token(client)
    await _activate(client, token)
    await _subscribe(client, token, "transport_pro")

    for i in range(7):  # old Pro cap was 5
        resp = await client.post("/v1/transport/vehicles", json={
            "vehicleType": "Bolero Maxi",
            "registrationNo": f"MH15 CD {i}567",
            "capacityTonnes": 1.5,
        }, headers=_auth(token))
        assert resp.status_code == 201


async def test_enterprise_tier_unlimited_fleet(client, user_store):
    await seed_plans()
    token = await _token(client)
    await _activate(client, token)
    await _subscribe(client, token, "transport_enterprise")

    for _ in range(8):  # unlimited fleet (true on every tier now)
        await _add_vehicle(client, token)


async def test_driver_sub_accounts_are_pro_feature(client, user_store):
    await seed_plans()
    token = await _token(client)
    await _activate(client, token)

    blocked = await client.post(
        "/v1/transport/drivers", json={"name": "Mohan Driver"}, headers=_auth(token)
    )
    assert blocked.status_code == 402
    assert blocked.json()["error"]["code"] == "ENTITLEMENT_EXCEEDED"
    assert blocked.json()["error"]["feature"] == "driverSubAccounts"

    await _subscribe(client, token, "transport_pro")
    resp = await client.post(
        "/v1/transport/drivers", json={"name": "Mohan Driver"}, headers=_auth(token)
    )
    assert resp.status_code == 201
    assert resp.json()["fleetOwnerId"]


async def test_route_analytics_are_pro_feature(client, user_store):
    await seed_plans()
    token = await _token(client)
    await _activate(client, token)

    blocked = await client.get("/v1/transport/analytics", headers=_auth(token))
    assert blocked.status_code == 402
    assert blocked.json()["error"]["feature"] == "routeAnalytics"

    await _subscribe(client, token, "transport_pro")
    resp = await client.get("/v1/transport/analytics", headers=_auth(token))
    assert resp.status_code == 200
    assert "totalVehicles" in resp.json()


async def test_priority_load_board_ranks_pro_bids_first(client, user_store):
    from app.services.tokens import create_access_token

    await seed_plans()
    # farmer posts a load; two different transporters bid the SAME fare
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    resp = await client.post("/v1/transport/loads", json=LOAD_BODY, headers=_auth(farmer_token))
    assert resp.status_code == 201
    load = resp.json()

    for uid in ("uid-2", "uid-3"):
        user_store[f"users/{uid}"] = {
            "id": uid,
            "linkedProfiles": ["transport"],
            "activeProfile": "transport",
            "primaryProfile": "transport",
            "mpinHash": None,
            "createdAt": "2026-10-01T00:00:00+00:00",
        }
    free_token = create_access_token("uid-2")
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/bid",
        json={"quotedFare": 2800, "termsAccepted": True},
        headers=_auth(free_token),
    )
    assert resp.status_code == 201
    free_bid = resp.json()
    assert free_bid["priority"] is False

    pro_token = create_access_token("uid-3")
    await _subscribe(client, pro_token, "transport_pro")
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/bid",
        json={"quotedFare": 2800, "termsAccepted": True},
        headers=_auth(pro_token),
    )
    assert resp.status_code == 201
    pro_bid = resp.json()
    assert pro_bid["priority"] is True

    # same fare -> the priority (Pro) bid ranks first
    resp = await client.get(f"/v1/transport/loads/{load['id']}/bids", headers=_auth(farmer_token))
    bids = resp.json()["data"]
    assert bids[0]["id"] == pro_bid["id"]
    assert bids[1]["id"] == free_bid["id"]


async def test_no_transport_settlement_on_any_tier(client, user_store):
    """Direct-connect: a Pro transporter's delivered fares never accrue a
    platform settlement — fare payment is entirely between the parties."""
    await seed_plans()
    token = await _token(client)
    await _activate(client, token)
    await _subscribe(client, token, "transport_pro")

    user_store["vehicles/veh_uid-1"] = {"id": "veh_uid-1", "ownerId": "uid-1"}
    user_store["transport_bookings/b-pro-1"] = {
        "id": "b-pro-1",
        "status": "delivered",
        "fare": 1200,
        "vehicleId": "veh_uid-1",
        "date": "2026-09-08",
    }
    resp = await client.post(
        "/v1/jobs/settlements/run",
        json={"periodStart": "2026-09-07", "periodEnd": "2026-09-13"},
    )
    assert resp.status_code == 200
    assert not any(k.startswith("settlements/st_transport_") for k in user_store)
