"""E3: maintenance log per machine + service-due schedule with dashboard
task reminders (hours-based or date-based). The maintenance suite is a Pro
feature (WS-04 step 10)."""
from app.services.billing import seed_plans
from tests.test_equipment_owner import MACHINE_BODY, _owner_token
from tests.test_users import _auth

SCHEDULE = {"everyHours": 100, "nextServiceDate": "2027-01-01"}


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


async def _machine(client, token, **overrides):
    body = {**MACHINE_BODY, **overrides}
    resp = await client.post("/v1/equipment", json=body, headers=_auth(token))
    assert resp.status_code == 201
    return resp.json()


async def test_maintenance_requires_pro(client, user_store):
    await seed_plans()
    token = await _owner_token(client)
    machine = await _machine(client, token)
    blocked = await client.get("/v1/equipment/owner/maintenance", headers=_auth(token))
    assert blocked.status_code == 402
    assert blocked.json()["error"]["feature"] == "maintenanceSuite"

    resp = await client.post(
        f"/v1/equipment/{machine['id']}/maintenance",
        json={"date": "2026-10-01", "hoursAtService": 100},
        headers=_auth(token),
    )
    assert resp.status_code == 402


async def test_maintenance_log_append_resets_hours_clock(client, user_store):
    token = await _pro_token(client, user_store)
    machine = await _machine(client, token, serviceSchedule=SCHEDULE)
    assert machine["serviceSchedule"]["everyHours"] == 100

    resp = await client.post(
        f"/v1/equipment/{machine['id']}/maintenance",
        json={
            "date": "2026-10-01",
            "hoursAtService": 500,
            "costRupees": 3500,
            "partsReplaced": "engine oil, hydraulic filter",
            "notes": "full service",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    entry = resp.json()
    assert entry["equipmentId"] == machine["id"]
    assert entry["costRupees"] == 3500

    # the schedule's next-service-hours is rescheduled off the service odometer
    updated = user_store[f"equipment/{machine['id']}"]
    assert updated["serviceSchedule"]["nextServiceHours"] == 600


async def test_due_by_hours_emits_task(client, user_store):
    token = await _pro_token(client, user_store)
    machine = await _machine(client, token, serviceSchedule={"everyHours": 10})
    # completed job with hours beyond the 10h window, hoursAtService=0 default
    user_store[f"equipment_bookings/bk-1"] = {
        "id": "bk-1",
        "equipmentId": machine["id"],
        "status": "completed",
        "hoursLogged": 12,
        "priceRupees": 700,
    }

    resp = await client.get("/v1/equipment/owner/maintenance", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["dueCount"] == 1
    row = body["data"][0]
    assert row["equipmentId"] == machine["id"]
    assert row["due"] is True
    assert row["hoursSinceService"] == 12

    # the reminder landed as a dashboard task (dedupe-safe single task)
    tasks = [d for k, d in user_store.items() if k.startswith("tasks/")]
    assert len(tasks) == 1
    assert tasks[0]["kind"] == "service_due"
    assert tasks[0]["priority"] == "high"

    # a repeat check does not duplicate the task
    await client.get("/v1/equipment/owner/maintenance", headers=_auth(token))
    tasks = [d for k, d in user_store.items() if k.startswith("tasks/")]
    assert len(tasks) == 1


async def test_due_by_date_emits_task(client, user_store):
    token = await _pro_token(client, user_store)
    machine = await _machine(client, token, serviceSchedule={"nextServiceDate": "2026-01-01"})

    resp = await client.get("/v1/equipment/owner/maintenance", headers=_auth(token))
    body = resp.json()
    assert body["dueCount"] == 1
    assert body["data"][0]["due"] is True


async def test_not_due_without_schedule(client, user_store):
    token = await _pro_token(client, user_store)
    await _machine(client, token)

    resp = await client.get("/v1/equipment/owner/maintenance", headers=_auth(token))
    body = resp.json()
    assert body["dueCount"] == 0
    assert body["data"][0]["due"] is False


async def test_other_owner_cannot_log_maintenance(client, user_store):
    from app.services.tokens import create_access_token

    token = await _pro_token(client, user_store)
    machine = await _machine(client, token)
    user_store["users/uid-2"] = {
        "id": "uid-2",
        "linkedProfiles": ["equipmentRental"],
        "activeProfile": "equipmentRental",
        "primaryProfile": "equipmentRental",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post(
        f"/v1/equipment/{machine['id']}/maintenance",
        json={"date": "2026-10-01", "hoursAtService": 100},
        headers=_auth(create_access_token("uid-2")),
    )
    assert resp.status_code == 403
