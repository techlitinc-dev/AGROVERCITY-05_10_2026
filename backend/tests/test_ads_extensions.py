"""Ad campaign extensions — own-listing targets for lots, vehicles, equipment
and women-hub offers, plus pause/resume/edit/delete round-trips.

Covers the SR 9 gap: ads could only target course/workshop/external/product/
demand. Produce lots (market_lots.farmerId), transport vehicles
(vehicles.ownerId), equipment fleet (equipment.ownerId) and gruh udyog
offers/products (gruh_udyog_offers|gruh_udyog_products.ownerUid) are now
valid own-listing targets with ownership enforcement (403 FORBIDDEN).
"""
from app.services.tokens import create_access_token

UID = "uid-1"
OTHER = "uid-other"

AD_BODY = {
    "title": "Kharif surplus promotion",
    "headline": "Fresh soybean lots direct from the farmgate",
    "description": "Grade A produce with doorstep pickup",
    "bannerUrl": "https://cdn.example.com/banner.png",
    "budgetRupees": 3000.0,
    "dailyBudgetRupees": 200.0,
}


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def seed_caller(user_store, uid=UID):
    user_store[f"users/{uid}"] = {"id": uid, "name": "Ram Patil"}
    return create_access_token(uid)


async def _create_ad(client, token, **overrides):
    resp = await client.post("/v1/ads", json={**AD_BODY, **overrides}, headers=auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_lot_target_ad(client, user_store):
    token = seed_caller(user_store)
    user_store["market_lots/lot_1"] = {
        "id": "lot_1", "farmerId": UID, "crop": "Soybean", "status": "open",
    }
    ad = await _create_ad(client, token, targetType="lot", targetId="lot_1")
    assert ad["targetType"] == "lot"
    assert ad["targetId"] == "lot_1"
    assert ad["advertiserId"] == UID
    assert ad["status"] == "active"


async def test_create_vehicle_target_ad(client, user_store):
    token = seed_caller(user_store)
    user_store["vehicles/veh_1"] = {
        "id": "veh_1", "ownerId": UID, "registrationNumber": "MH12AB1234",
    }
    ad = await _create_ad(client, token, targetType="vehicle", targetId="veh_1")
    assert ad["targetType"] == "vehicle"
    assert ad["targetId"] == "veh_1"


async def test_create_equipment_and_women_offer_target_ads(client, user_store):
    token = seed_caller(user_store)
    user_store["equipment/eq_1"] = {"id": "eq_1", "ownerId": UID, "name": "Rotavator"}
    user_store["gruh_udyog_offers/guo_1"] = {
        "id": "guo_1", "ownerUid": UID, "productId": "gup_1", "status": "active",
    }
    user_store["gruh_udyog_products/gup_1"] = {
        "id": "gup_1", "ownerUid": UID, "name": "Papad 500g", "status": "live",
    }

    ad = await _create_ad(client, token, targetType="equipment", targetId="eq_1")
    assert ad["targetType"] == "equipment"

    ad = await _create_ad(client, token, targetType="women_offer", targetId="guo_1")
    assert ad["targetType"] == "women_offer"

    # a gruh udyog product doc is also an acceptable women_offer target
    ad = await _create_ad(client, token, targetType="women_offer", targetId="gup_1")
    assert ad["targetId"] == "gup_1"


async def test_owned_target_rejected_for_non_owner(client, user_store):
    token = seed_caller(user_store)
    user_store[f"users/{OTHER}"] = {"id": OTHER, "name": "Sham Rao"}
    user_store["market_lots/lot_2"] = {"id": "lot_2", "farmerId": OTHER, "crop": "Wheat"}
    user_store["vehicles/veh_2"] = {"id": "veh_2", "ownerId": OTHER}

    resp = await client.post(
        "/v1/ads",
        json={**AD_BODY, "targetType": "lot", "targetId": "lot_2"},
        headers=auth(token),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"

    resp = await client.post(
        "/v1/ads",
        json={**AD_BODY, "targetType": "vehicle", "targetId": "veh_2"},
        headers=auth(token),
    )
    assert resp.status_code == 403


async def test_owned_target_missing_returns_404(client, user_store):
    token = seed_caller(user_store)
    resp = await client.post(
        "/v1/ads",
        json={**AD_BODY, "targetType": "lot", "targetId": "lot-nope"},
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "AD_TARGET_NOT_FOUND"


async def test_owned_target_requires_target_id(client, user_store):
    token = seed_caller(user_store)
    resp = await client.post(
        "/v1/ads", json={**AD_BODY, "targetType": "vehicle", "targetId": ""}, headers=auth(token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_pause_and_resume_via_put(client, user_store):
    token = seed_caller(user_store)
    user_store["market_lots/lot_3"] = {"id": "lot_3", "farmerId": UID, "crop": "Bajra"}
    ad = await _create_ad(client, token, targetType="lot", targetId="lot_3")
    ad_id = ad["id"]
    assert ad["status"] == "active"

    resp = await client.put(f"/v1/ads/{ad_id}", json={"status": "paused"}, headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "paused"

    resp = await client.put(f"/v1/ads/{ad_id}", json={"status": "active"}, headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    # paused ads drop out of the public active feed
    await client.put(f"/v1/ads/{ad_id}", json={"status": "paused"}, headers=auth(token))
    feed = await client.get("/v1/ads/active")
    assert all(a["id"] != ad_id for a in feed.json()["data"])


async def test_edit_ad_fields(client, user_store):
    token = seed_caller(user_store)
    user_store["market_lots/lot_4"] = {"id": "lot_4", "farmerId": UID, "crop": "Maize"}
    user_store["market_lots/lot_5"] = {"id": "lot_5", "farmerId": UID, "crop": "Jowar"}
    ad = await _create_ad(client, token, targetType="lot", targetId="lot_4")
    ad_id = ad["id"]

    resp = await client.put(
        f"/v1/ads/{ad_id}",
        json={
            "title": "Updated monsoon push",
            "headline": "New headline for the harvest push",
            "budgetRupees": 5000.0,
            "targetVillage": "Hivare",
        },
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Updated monsoon push"
    assert body["headline"] == "New headline for the harvest push"
    assert body["budgetRupees"] == 5000.0
    assert body["targetVillage"] == "Hivare"
    assert body["targetId"] == "lot_4"  # untouched fields keep their values

    # switching to another own lot is allowed
    resp = await client.put(
        f"/v1/ads/{ad_id}", json={"targetId": "lot_5"}, headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["targetId"] == "lot_5"


async def test_edit_revalidates_target_ownership(client, user_store):
    token = seed_caller(user_store)
    user_store[f"users/{OTHER}"] = {"id": OTHER, "name": "Sham Rao"}
    user_store["market_lots/lot_6"] = {"id": "lot_6", "farmerId": UID, "crop": "Gram"}
    user_store["market_lots/lot_7"] = {"id": "lot_7", "farmerId": OTHER, "crop": "Tur"}
    ad = await _create_ad(client, token, targetType="lot", targetId="lot_6")
    ad_id = ad["id"]

    resp = await client.put(
        f"/v1/ads/{ad_id}", json={"targetId": "lot_7"}, headers=auth(token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"

    resp = await client.put(
        f"/v1/ads/{ad_id}", json={"targetId": "lot-missing"}, headers=auth(token)
    )
    assert resp.status_code == 404


async def test_cannot_mutate_someone_elses_ad(client, user_store):
    token = seed_caller(user_store)
    other_token = seed_caller(user_store, uid=OTHER)
    ad = await _create_ad(client, token)
    resp = await client.put(f"/v1/ads/{ad['id']}", json={"title": "Hijack attempt"}, headers=auth(other_token))
    assert resp.status_code == 403
    resp = await client.delete(f"/v1/ads/{ad['id']}", headers=auth(other_token))
    assert resp.status_code == 403


async def test_delete_ad(client, user_store):
    token = seed_caller(user_store)
    ad = await _create_ad(client, token)
    ad_id = ad["id"]

    resp = await client.delete(f"/v1/ads/{ad_id}", headers=auth(token))
    assert resp.status_code == 204

    resp = await client.get(f"/v1/ads/{ad_id}", headers=auth(token))
    assert resp.status_code == 404

    mine = await client.get("/v1/ads/mine", headers=auth(token))
    assert all(a["id"] != ad_id for a in mine.json()["data"])


async def test_analytics_still_works_with_owned_targets(client, user_store):
    token = seed_caller(user_store)
    user_store["market_lots/lot_8"] = {"id": "lot_8", "farmerId": UID, "crop": "Onion"}
    ad = await _create_ad(client, token, targetType="lot", targetId="lot_8")
    ad_id = ad["id"]

    resp = await client.post(f"/v1/ads/{ad_id}/impression")
    assert resp.status_code == 200
    resp = await client.post(f"/v1/ads/{ad_id}/click")
    assert resp.status_code == 200

    resp = await client.get(f"/v1/ads/{ad_id}/analytics", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["adId"] == ad_id
    assert body["impressions"] == 1
    assert body["clicks"] == 1
    assert body["ctrPercent"] == 100.0
    assert body["spentRupees"] == 2.5  # ₹0.50 CPM + ₹2.00 CPC
    assert len(body["dailyBreakdown"]) == 3
