from app.services.tasks import DEEP_LINKS
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user


async def test_lease_request_emits_task(client, user_store):
    seed_user(
        user_store, uid="uid-l1", active_profile="farmLandlord",
        name="Landlord Patil", phone="+919811100001",
    )
    user_store["land_listings/listing-1"] = {
        "id": "listing-1",
        "landlordId": "uid-l1",
        "landlordName": "Landlord Patil",
        "village": "Niphad",
        "district": "Nashik",
        "lat": 20.0,
        "lng": 74.0,
        "areaAcres": 5.0,
        "expectedRentRupees": 20000,
        "status": "open",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    farmer = seed_user(
        user_store, uid="uid-f1", active_profile="farmer",
        name="Sunil Pawar", phone="+919822200001",
    )
    resp = await client.post(
        "/v1/land/lease-requests",
        json={"listingId": "listing-1", "message": "interested", "durationMonths": 12},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    tasks = [
        doc
        for key, doc in user_store.items()
        if key.startswith("tasks/") and doc.get("userId") == "uid-l1"
    ]
    assert len(tasks) == 1
    task = tasks[0]
    assert task["module"] == "land"
    assert task["kind"] == "lease_request"
    assert task["status"] == "open"
    assert task["title"]["en"] and task["title"]["hi"]
    assert task["deepLink"] == DEEP_LINKS["land"]


async def test_landlord_summary_fields(client, user_store):
    seed_user(
        user_store, uid="uid-l1", active_profile="farmLandlord",
        name="Landlord Patil", phone="+919811100001",
    )
    user_store["users/uid-l1/land_plots/plot-1"] = {
        "id": "plot-1", "name": "North Field", "village": "Niphad",
        "district": "Nashik", "areaAcres": 5, "status": "leased",
    }
    user_store["users/uid-l1/land_leases/lease-1"] = {
        "id": "lease-1", "plotId": "plot-1", "tenantName": "Sunil",
        "tenantPhone": "+919822200001", "monthlyRentRupees": 10000,
        "startDate": "2026-01-01", "endDate": "2026-12-31", "status": "active",
    }
    farmer = seed_user(user_store, uid="uid-f1", active_profile="farmer")
    user_store["lease_requests/lr-1"] = {
        "id": "lr-1", "listingId": "listing-1", "farmerId": "uid-f1",
        "landlordId": "uid-l1", "status": "pending", "durationMonths": 12,
    }
    token = create_access_token("uid-l1")
    resp = await client.get("/v1/land/summary", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    for field in (
        "acresOwned",
        "acresLeased",
        "activeLeases",
        "rentDueThisMonthPaisa",
        "pendingRequests",
        "expiringLeases",
        "plotOccupancy",
    ):
        assert field in body
    assert isinstance(body["rentDueThisMonthPaisa"], int)
    assert body["activeLeases"] == 1
    assert body["acresOwned"] == 5
    assert body["acresLeased"] == 5
    assert body["pendingRequests"] == 1
    assert body["plotOccupancy"][0]["plotId"] == "plot-1"
