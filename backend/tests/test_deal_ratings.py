"""WS-05 step 8: two-sided deal ratings persisted server-side — one rating
per party per completed deal; duplicates rejected."""
from tests.test_broker_deals import DEAL_BODY, _seed_broker, _seed_farmer
from tests.test_diary import auth


async def _completed_deal(client, user_store):
    broker = _seed_broker(user_store)
    farmer = _seed_farmer(user_store)
    resp = await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))
    assert resp.status_code == 201
    deal = resp.json()
    user_store[f"broker_deals/{deal['id']}"]["status"] = "completed"
    return broker, farmer, deal


async def test_farmer_rates_broker_and_broker_rates_farmer(client, user_store):
    broker, farmer, deal = await _completed_deal(client, user_store)

    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "deal", "bookingId": deal["id"], "stars": 5,
              "comment": "fair dealing", "targetRole": "broker"},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    assert resp.json()["providerId"] == "uid-b1"

    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "deal", "bookingId": deal["id"], "stars": 4,
              "comment": "prompt payment", "targetRole": "farmer"},
        headers=auth(broker),
    )
    assert resp.status_code == 201
    assert resp.json()["providerId"] == "uid-f1"

    # aggregates land on each party
    assert user_store["provider_ratings/uid-b1"]["ratingCount"] == 1
    assert user_store["provider_ratings/uid-f1"]["ratingCount"] == 1


async def test_duplicate_rating_same_party_rejected(client, user_store):
    broker, farmer, deal = await _completed_deal(client, user_store)
    body = {"bookingKind": "deal", "bookingId": deal["id"], "stars": 5, "targetRole": "broker"}
    assert (await client.post("/v1/ratings", json=body, headers=auth(farmer))).status_code == 201

    dupe = {**body, "stars": 3}
    resp = await client.post("/v1/ratings", json=dupe, headers=auth(farmer))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_RATED"


async def test_wrong_side_cannot_rate(client, user_store):
    broker, farmer, deal = await _completed_deal(client, user_store)
    # the farmer cannot rate "the farmer" side; the broker cannot rate the broker
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "deal", "bookingId": deal["id"], "stars": 5, "targetRole": "farmer"},
        headers=auth(farmer),
    )
    assert resp.status_code == 403
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "deal", "bookingId": deal["id"], "stars": 5, "targetRole": "broker"},
        headers=auth(broker),
    )
    assert resp.status_code == 403


async def test_incomplete_deal_and_stranger_blocked(client, user_store):
    broker, farmer, deal = await _completed_deal(client, user_store)
    user_store[f"broker_deals/{deal['id']}"]["status"] = "negotiating"
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "deal", "bookingId": deal["id"], "stars": 5, "targetRole": "broker"},
        headers=auth(farmer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "NOT_COMPLETED"

    user_store[f"broker_deals/{deal['id']}"]["status"] = "completed"
    from app.services.tokens import create_access_token
    user_store["users/uid-9"] = {
        "id": "uid-9", "linkedProfiles": ["farmer"], "activeProfile": "farmer",
        "primaryProfile": "farmer", "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "deal", "bookingId": deal["id"], "stars": 5, "targetRole": "broker"},
        headers=auth(create_access_token("uid-9")),
    )
    assert resp.status_code == 403


async def test_missing_target_role_422(client, user_store):
    broker, farmer, deal = await _completed_deal(client, user_store)
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "deal", "bookingId": deal["id"], "stars": 5},
        headers=auth(farmer),
    )
    assert resp.status_code == 422
