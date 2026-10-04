from datetime import datetime, timedelta, timezone

from tests.test_equipment import second_farmer_token
from tests.test_users import _auth, _register

IST = timezone(timedelta(hours=5, minutes=30))

MACHINE_BODY = {"name": "John Deere 5050", "type": "tractor", "hourlyRate": 700}

CUSTOM_TEMPLATE = [
    {
        "slotName": "7:00 AM – 11:00 AM",
        "duration": "4 hours",
        "priceRupees": 900,
        "recommendedTask": "Bed making (बेड)",
    },
    {
        "slotName": "12:00 PM – 4:00 PM",
        "duration": "4 hours",
        "priceRupees": 1000,
        "recommendedTask": "Spraying (छिड़काव)",
    },
]

OWNER_MACHINE = {
    "id": "eq-own",
    "name": "Owner Rotavator",
    "type": "rotavator",
    "ownerType": "private",
    "ownerId": "uid-1",
    "hourlyRate": 500,
    "perAcreRate": None,
    "distanceKm": 0,
    "slotTemplate": None,
    "active": True,
    "docStatus": "verified",
    "rejectionReason": None,
    "createdAt": "2026-09-16T00:00:00+00:00",
}


async def _owner_token(client):
    resp = await _register(
        client, profiles=["farmer", "equipmentRental"], primaryProfile="equipmentRental"
    )
    return resp.json()["accessToken"]


def _tomorrow():
    return (datetime.now(IST).date() + timedelta(days=1)).isoformat()


async def test_owner_create_update_machine(client, user_store):
    token = await _owner_token(client)
    resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(token))
    assert resp.status_code == 201
    machine = resp.json()
    assert machine["ownerType"] == "private"
    assert machine["ownerId"] == "uid-1"
    assert machine["distanceKm"] == 0
    resp = await client.get("/v1/equipment/owner/fleet", headers=_auth(token))
    assert any(row["equipmentId"] == machine["id"] for row in resp.json()["data"])
    resp = await client.put(
        f"/v1/equipment/{machine['id']}",
        json={**MACHINE_BODY, "slotTemplate": CUSTOM_TEMPLATE},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["slotTemplate"] == CUSTOM_TEMPLATE
    # stands in for the admin KYC verification (Day 14)
    user_store[f"equipment/{machine['id']}"]["docStatus"] = "verified"
    resp = await client.get(
        f"/v1/equipment/{machine['id']}/slots",
        params={"date": _tomorrow()},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    slots = resp.json()["data"]
    assert [s["slotName"] for s in slots] == [t["slotName"] for t in CUSTOM_TEMPLATE]
    assert [s["priceRupees"] for s in slots] == [900, 1000]
    assert all(s["status"] == "available" for s in slots)


async def test_owner_forbidden_for_farmer(client):
    resp = await _register(client)
    token = resp.json()["accessToken"]
    resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_fleet_summary(client, user_store):
    owner_token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    from tests.test_equipment_approve import _verify_equipment_kyc

    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)
    resp = await client.get("/v1/equipment/eq-own/slots", headers=_auth(farmer_token))
    slot = resp.json()["data"][0]
    resp = await client.post(
        f"/v1/equipment/slots/{slot['id']}/book",
        json={"farmerName": "Suresh Jadhav"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/equipment/owner/fleet", headers=_auth(owner_token))
    assert resp.status_code == 200
    row = next(r for r in resp.json()["data"] if r["equipmentId"] == "eq-own")
    assert row["bookedHoursThisWeek"] == 4
    assert row["weeklyIncome"] == 800
    assert row["status"] == "active"


async def test_new_machine_pending_hidden_from_farmers(client, user_store):
    owner_token = await _owner_token(client)
    resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(owner_token))
    machine = resp.json()
    assert machine["docStatus"] == "pending"
    assert machine["rejectionReason"] is None
    farmer_token = second_farmer_token(user_store)
    resp = await client.get("/v1/equipment", headers=_auth(farmer_token))
    assert resp.status_code == 200
    assert all(d["id"] != machine["id"] for d in resp.json()["data"])
    resp = await client.get(f"/v1/equipment/{machine['id']}/slots", headers=_auth(farmer_token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "EQUIPMENT_NOT_FOUND"


async def test_verified_machine_visible(client, user_store):
    owner_token = await _owner_token(client)
    resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(owner_token))
    machine = resp.json()
    # stands in for the admin KYC verification (Day 14)
    user_store[f"equipment/{machine['id']}"]["docStatus"] = "verified"
    farmer_token = second_farmer_token(user_store)
    resp = await client.get("/v1/equipment", headers=_auth(farmer_token))
    assert any(d["id"] == machine["id"] for d in resp.json()["data"])
    resp = await client.get(f"/v1/equipment/{machine['id']}/slots", headers=_auth(farmer_token))
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 4


async def test_fleet_includes_doc_status(client, user_store):
    owner_token = await _owner_token(client)
    resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(owner_token))
    machine = resp.json()
    resp = await client.get("/v1/equipment/owner/fleet", headers=_auth(owner_token))
    row = next(r for r in resp.json()["data"] if r["equipmentId"] == machine["id"])
    assert row["docStatus"] == "pending"
    assert row["rejectionReason"] is None
    # stands in for the admin KYC verification (Day 14)
    user_store[f"equipment/{machine['id']}"]["docStatus"] = "verified"
    resp = await client.get("/v1/equipment/owner/fleet", headers=_auth(owner_token))
    row = next(r for r in resp.json()["data"] if r["equipmentId"] == machine["id"])
    assert row["docStatus"] == "verified"


async def test_owner_dashboard_summary_fields(client, user_store):
    from tests.test_equipment_approve import _verify_equipment_kyc

    token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)

    # one booking today -> pending approval; one completed earlier this week
    resp = await client.get("/v1/equipment/eq-own/slots", headers=_auth(farmer_token))
    slot = resp.json()["data"][0]
    resp = await client.post(
        f"/v1/equipment/slots/{slot['id']}/book",
        json={"farmerName": "Suresh Jadhav"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    week_day = _tomorrow()
    user_store["equipment_bookings/eqb-done"] = {
        "id": "eqb-done",
        "equipmentId": "eq-own",
        "status": "completed",
        "priceRupees": 800,
        "date": week_day,
    }
    user_store["equipment_damage_claims/claim-1"] = {
        "id": "claim-1",
        "ownerId": "uid-1",
        "status": "open",
    }
    user_store["equipment/eq-own"]["serviceSchedule"] = {"nextServiceDate": "2026-11-01"}

    resp = await client.get("/v1/equipment/owner/dashboard", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "machines",
        "pendingApprovals",
        "machinesOutNow",
        "damageClaimsOpen",
        "nextServiceDue",
        "weeklyIncomePaisa",
        "nextPayout",
    ):
        assert key in body

    assert body["machines"]["count"] == 1
    assert body["pendingApprovals"] == 1
    assert body["damageClaimsOpen"] == 1
    assert body["nextServiceDue"] == "2026-11-01"
    assert isinstance(body["weeklyIncomePaisa"], int)

    # a pending settlement surfaces as the next payout in integer paisa
    user_store["settlements/stl_eq"] = {
        "id": "stl_eq",
        "role": "equipmentRental",
        "entityId": "uid-1",
        "periodStart": "2026-09-29",
        "periodEnd": "2026-10-05",
        "netRupees": 8800,
        "status": "pending",
    }
    resp = await client.get("/v1/equipment/owner/dashboard", headers=_auth(token))
    assert resp.json()["nextPayout"] == {
        "periodStart": "2026-09-29",
        "periodEnd": "2026-10-05",
        "netPaisa": 880000,
    }


async def test_owner_dashboard_summary_fields(client, user_store):
    token = await _owner_token(client)
    user_store["equipment/eq-own"] = {
        **OWNER_MACHINE,
        "serviceSchedule": {"nextServiceDate": "2026-11-01"},
    }
    from tests.test_equipment_approve import _verify_equipment_kyc

    _verify_equipment_kyc(user_store)
    farmer = second_farmer_token(user_store)

    # one pending approval + one completed job this week
    resp = await client.get(f"/v1/equipment/eq-own/slots", headers=_auth(farmer))
    slot = resp.json()["data"][0]
    await client.post(
        f"/v1/equipment/slots/{slot['id']}/book",
        json={"farmerName": "Suresh Jadhav"},
        headers=_auth(farmer),
    )
    user_store["equipment_bookings/eqb-done"] = {
        "id": "eqb-done",
        "equipmentId": "eq-own",
        "status": "completed",
        "priceRupees": 1200,
        "date": _tomorrow() if False else __import__("datetime").date.today().isoformat(),
    }
    user_store["equipment_damage_claims/claim-1"] = {
        "id": "claim-1",
        "ownerId": "uid-1",
        "status": "open",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }

    resp = await client.get("/v1/equipment/owner/dashboard", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "machines",
        "pendingApprovals",
        "machinesOutNow",
        "damageClaimsOpen",
        "nextServiceDue",
        "weeklyIncomePaisa",
        "nextPayout",
    ):
        assert key in body

    assert body["machines"]["count"] == 1
    assert body["pendingApprovals"] == 1
    assert body["damageClaimsOpen"] == 1
    assert body["nextServiceDue"] == "2026-11-01"
    assert body["weeklyIncomePaisa"] == 120000
    assert body["nextPayout"] is None
