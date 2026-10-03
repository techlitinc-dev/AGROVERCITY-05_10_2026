from app.services.billing import seed_plans
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user

PLOT = {"name": "North Field", "village": "Niphad", "district": "Nashik", "areaAcres": 2.0}


async def _make_pro(user_store, uid="uid-l1"):
    await seed_plans()
    user_store["subscriptions/sub_pro_landlord"] = {
        "subId": "sub_pro_landlord",
        "userId": uid,
        "planId": "farmLandlord_pro",
        "status": "active",
        "provider": "razorpay_sub",
        "providerRef": "sub_test_1",
        "currentPeriodEnd": "2027-01-01T00:00:00+00:00",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }


async def test_free_tier_plot_limit(client, user_store):
    token = seed_user(user_store, uid="uid-l1", active_profile="farmLandlord")
    first = await client.post("/v1/land/plots", json=PLOT, headers=auth(token))
    assert first.status_code == 201
    second = await client.post(
        "/v1/land/plots", json={**PLOT, "name": "South Field"}, headers=auth(token)
    )
    assert second.status_code == 402
    error = second.json()["error"]
    assert error["code"] == "ENTITLEMENT_EXCEEDED"
    assert "plots" in error["fieldErrors"]


async def test_pro_tier_unlocks_second_plot(client, user_store):
    token = seed_user(user_store, uid="uid-l1", active_profile="farmLandlord")
    await _make_pro(user_store)
    first = await client.post("/v1/land/plots", json=PLOT, headers=auth(token))
    assert first.status_code == 201
    second = await client.post(
        "/v1/land/plots", json={**PLOT, "name": "South Field"}, headers=auth(token)
    )
    assert second.status_code == 201


async def test_free_tier_pdf_and_analytics_blocked(client, user_store):
    seed_user(user_store, uid="uid-l1", active_profile="farmLandlord")
    user_store["users/uid-l1/land_leases/lease-1"] = {
        "id": "lease-1",
        "plotId": "plot-1",
        "tenantName": "Sunil",
        "tenantPhone": "+919822200001",
        "monthlyRentRupees": 10000,
        "startDate": "2026-01-01",
        "endDate": "2026-12-31",
        "status": "active",
    }
    token = create_access_token("uid-l1")
    agreement = await client.get(
        "/v1/land/leases/lease-1/agreement-pdf", headers=auth(token)
    )
    assert agreement.status_code == 402
    assert agreement.json()["error"]["code"] == "UPGRADE_REQUIRED"
    analytics = await client.get("/v1/land/analytics", headers=auth(token))
    assert analytics.status_code == 402
