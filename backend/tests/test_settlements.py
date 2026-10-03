from app.core.config import settings
from tests.test_diary import auth, seed_user

PERIOD = {"periodStart": "2026-09-07", "periodEnd": "2026-09-13"}


def _seed_transport(user_store, owner_uid, bookings):
    for i, fare in enumerate(bookings):
        vehicle_id = f"veh-{owner_uid}"
        user_store[f"vehicles/{vehicle_id}"] = {"id": vehicle_id, "ownerId": owner_uid}
        user_store[f"transport_bookings/b-{owner_uid}-{i}"] = {
            "id": f"b-{owner_uid}-{i}",
            "status": "delivered",
            "fare": fare,
            "vehicleId": vehicle_id,
            "date": "2026-09-08",
        }


async def test_job_aggregates_transport_fares(client, user_store):
    _seed_transport(user_store, "uid-t1", [800, 1200])
    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200
    assert resp.json()["created"] == 1
    doc = user_store["settlements/st_transport_uid-t1_2026-09-07"]
    assert doc["grossRupees"] == 2000
    assert doc["commissionRupees"] == 200
    assert doc["netRupees"] == 1800
    assert doc["status"] == "pending"


async def test_job_idempotent_rerun(client, user_store):
    _seed_transport(user_store, "uid-t1", [800, 1200])
    await client.post("/v1/jobs/settlements/run", json=PERIOD)
    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] == 0
    assert body["updated"] == 1
    docs = [k for k in user_store if k.startswith("settlements/")]
    assert len(docs) == 1


async def test_cron_secret_required(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "CRON_UNAUTHORIZED"
    resp = await client.post(
        "/v1/jobs/settlements/run", json=PERIOD, headers={"X-Cron-Secret": "wrong"}
    )
    assert resp.status_code == 401
    resp = await client.post(
        "/v1/jobs/settlements/run", json=PERIOD, headers={"X-Cron-Secret": "s3cret"}
    )
    assert resp.status_code == 200


async def test_persona_scoping(client, user_store):
    _seed_transport(user_store, "uid-t1", [800])
    _seed_transport(user_store, "uid-t2", [1200])
    await client.post("/v1/jobs/settlements/run", json=PERIOD)
    token_t1 = seed_user(user_store, uid="uid-t1", active_profile="transport")
    resp = await client.get("/v1/transport/settlements", headers=auth(token_t1))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["entityId"] == "uid-t1"
    token_farmer = seed_user(user_store, uid="uid-f1", active_profile="farmer")
    resp = await client.get("/v1/transport/settlements", headers=auth(token_farmer))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_pending_recomputed_approved_untouched(client, user_store):
    _seed_transport(user_store, "uid-a1", [800])
    _seed_transport(user_store, "uid-b1", [1200])
    await client.post("/v1/jobs/settlements/run", json=PERIOD)
    approved_key = "settlements/st_transport_uid-a1_2026-09-07"
    user_store[approved_key]["status"] = "approved"
    user_store["vehicles/veh-uid-a1b"] = {"id": "veh-uid-a1b", "ownerId": "uid-a1"}
    user_store["transport_bookings/b-extra-a"] = {
        "id": "b-extra-a",
        "status": "delivered",
        "fare": 500,
        "vehicleId": "veh-uid-a1b",
        "date": "2026-09-09",
    }
    user_store["vehicles/veh-uid-b1b"] = {"id": "veh-uid-b1b", "ownerId": "uid-b1"}
    user_store["transport_bookings/b-extra-b"] = {
        "id": "b-extra-b",
        "status": "delivered",
        "fare": 300,
        "vehicleId": "veh-uid-b1b",
        "date": "2026-09-09",
    }
    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200
    assert user_store[approved_key]["grossRupees"] == 800
    assert user_store[approved_key]["status"] == "approved"
    pending = user_store["settlements/st_transport_uid-b1_2026-09-07"]
    assert pending["grossRupees"] == 1500
    assert pending["netRupees"] == 1350


async def test_job_aggregates_broker_deal_gross(client, user_store):
    user_store["broker_deals/deal_b1"] = {
        "id": "deal_b1",
        "brokerId": "uid-b1",
        "status": "completed",
        "grossAmount": 110000,
        "commissionAmount": 2200,
        "createdAt": "2026-09-08T10:00:00+00:00",
    }
    user_store["broker_deals/deal_b2"] = {
        "id": "deal_b2",
        "brokerId": "uid-b1",
        "status": "in_transit",  # not completed — must be skipped
        "grossAmount": 50000,
        "createdAt": "2026-09-08T10:00:00+00:00",
    }
    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200
    doc = user_store["settlements/st_broker_uid-b1_2026-09-07"]
    assert doc["grossRupees"] == 110000
    assert doc["commissionRupees"] == 2200  # brokerPct 2
    assert doc["netRupees"] == 107800
    assert doc["sourceIds"] == ["deal_b1"]
    assert doc["status"] == "pending"
