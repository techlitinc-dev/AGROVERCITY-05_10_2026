"""SR 5 — cross-persona Ratings & Reviews center.

Covers GET /ratings/pending across prompt kinds, POST /ratings for the
prompt-resolved kinds (course_enrollment, lot_sale, lot_purchase) and the
vet_booking alias, plus the /mine, /given and reply self-service surface.
"""
from tests.test_diary import auth, seed_user


def seed_prompt(user_store, prompt_id, ratee_uid, kind, rater_uid="uid-1"):
    user_store[f"users/{rater_uid}/rating_prompts/{prompt_id}"] = {
        "id": prompt_id,
        "rateeUid": ratee_uid,
        "kind": kind,
        "transactionId": prompt_id,
        "status": "open",
        "createdAt": "2026-10-01T10:00:00+00:00",
    }


async def test_pending_lists_prompts_across_kinds(client, user_store):
    token = seed_user(user_store)
    seed_prompt(user_store, "trb-1", "uid-t1", "transport_delivery")
    seed_prompt(user_store, "eqb-1", "uid-o1", "equipment_booking")
    seed_prompt(user_store, "enr-1", "uid-i1", "course_enrollment")
    # a closed prompt must not surface
    closed = dict(user_store["users/uid-1/rating_prompts/eqb-1"])
    closed["status"] = "done"
    user_store["users/uid-1/rating_prompts/eqb-1"] = closed
    seed_prompt(user_store, "ord-9", "uid-s1", "marketplace_order")

    resp = await client.get("/v1/ratings/pending", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    kinds = {p["kind"] for p in body["data"]}
    assert kinds == {"transport_delivery", "course_enrollment", "marketplace_order"}


async def test_rate_via_course_enrollment_prompt_201(client, user_store):
    token = seed_user(user_store)
    seed_user(user_store, uid="uid-i1", active_profile="instructor")
    seed_prompt(user_store, "enr-1", "uid-i1", "course_enrollment")
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "course_enrollment", "bookingId": "enr-1", "stars": 5, "comment": "Great class"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["providerId"] == "uid-i1"
    # prompt closed after rating
    assert user_store["users/uid-1/rating_prompts/enr-1"]["status"] == "done"
    # aggregate lands on the instructor
    assert user_store["provider_ratings/uid-i1"]["ratingAvg"] == 5.0


async def test_rate_via_lot_prompts_201(client, user_store):
    token = seed_user(user_store)
    seed_prompt(user_store, "lot-1", "uid-b1", "lot_sale")
    seed_prompt(user_store, "lot-2", "uid-s1", "lot_purchase")
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "lot_sale", "bookingId": "lot-1", "stars": 4},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["providerId"] == "uid-b1"
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "lot_purchase", "bookingId": "lot-2", "stars": 3},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["providerId"] == "uid-s1"


async def test_rate_missing_prompt_404(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "lot_sale", "bookingId": "nope-1", "stars": 4},
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PROMPT_NOT_FOUND"


async def test_rate_vet_booking_alias_201(client, user_store):
    token = seed_user(user_store)
    user_store["users/uid-1/vet_bookings/vetb-9"] = {
        "id": "vetb-9",
        "vetId": "vet-7",
        "status": "completed",
        "createdAt": "2026-10-02T10:00:00+00:00",
    }
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "vet_booking", "bookingId": "vetb-9", "stars": 5},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["providerId"] == "vet-7"


async def test_vet_booking_not_completed_409(client, user_store):
    token = seed_user(user_store)
    user_store["users/uid-1/vet_bookings/vetb-9"] = {
        "id": "vetb-9",
        "vetId": "vet-7",
        "status": "booked",
        "createdAt": "2026-10-02T10:00:00+00:00",
    }
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "vet_booking", "bookingId": "vetb-9", "stars": 5},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "NOT_COMPLETED"


async def test_unsupported_kind_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "dairy_collection", "bookingId": "x-1", "stars": 4},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_mine_given_and_reply_flow(client, user_store):
    farmer_token = seed_user(user_store)
    transporter_token = seed_user(user_store, uid="uid-t1", active_profile="transport")
    user_store["transport_bookings/trb-1"] = {
        "id": "trb-1",
        "userId": "uid-1",
        "status": "delivered",
        "transporterId": "uid-t1",
        "createdAt": "2026-10-01T10:00:00+00:00",
    }
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": "trb-1", "stars": 4, "comment": "on time"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201
    rating_id = resp.json()["id"]

    # given list (farmer side)
    resp = await client.get("/v1/ratings/given", headers=auth(farmer_token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["bookingId"] == "trb-1"

    # mine (transporter side): aggregate + recent with rater name
    resp = await client.get("/v1/ratings/mine", headers=auth(transporter_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["average"] == 4.0
    assert body["count"] == 1
    assert body["recent"][0]["raterName"] == "Ram Patil"
    assert body["recent"][0]["comment"] == "on time"

    # only the rated party can reply
    resp = await client.post(
        f"/v1/ratings/{rating_id}/reply", json={"reply": "thanks!"}, headers=auth(farmer_token)
    )
    assert resp.status_code == 403

    # reply once as the transporter
    resp = await client.post(
        f"/v1/ratings/{rating_id}/reply", json={"reply": "thank you, safe travels"}, headers=auth(transporter_token)
    )
    assert resp.status_code == 200
    assert resp.json()["reply"] == "thank you, safe travels"
    assert user_store[f"ratings/{rating_id}"]["repliedAt"]

    # second reply is rejected
    resp = await client.post(
        f"/v1/ratings/{rating_id}/reply", json={"reply": "again"}, headers=auth(transporter_token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_REPLIED"
