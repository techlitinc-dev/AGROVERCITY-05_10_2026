from app.data.livestock_seed import VETS
from app.services.trust import compute_trust_tier
from tests.test_diary import auth, seed_user


def seed_transport_booking(user_store, booking_id="trb-1", user_id="uid-1", status="delivered", transporter_id="uid-t1"):
    user_store[f"transport_bookings/{booking_id}"] = {
        "id": booking_id,
        "userId": user_id,
        "vehicleType": "Tata Ace",
        "status": status,
        "transporterId": transporter_id,
        "fare": 850,
        "createdAt": "2026-09-15T10:00:00+00:00",
    }


async def test_rate_delivered_transport_booking_201(client, user_store):
    token = seed_user(user_store)
    seed_transport_booking(user_store)
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": "trb-1", "stars": 5, "comment": "वेळेत पोहोचले"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["providerId"] == "uid-t1"
    assert user_store["provider_ratings/uid-t1"]["ratingCount"] == 1
    assert user_store["provider_ratings/uid-t1"]["ratingAvg"] == 5.0


async def test_not_completed_409(client, user_store):
    token = seed_user(user_store)
    seed_transport_booking(user_store, status="requested")
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": "trb-1", "stars": 4},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "NOT_COMPLETED"


async def test_double_rating_409(client, user_store):
    token = seed_user(user_store)
    seed_transport_booking(user_store)
    payload = {"bookingKind": "transport", "bookingId": "trb-1", "stars": 5}
    resp = await client.post("/v1/ratings", json=payload, headers=auth(token))
    assert resp.status_code == 201
    resp = await client.post("/v1/ratings", json=payload, headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_RATED"


async def test_foreign_booking_404(client, user_store):
    token = seed_user(user_store)
    seed_transport_booking(user_store, user_id="uid-other")
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": "trb-1", "stars": 5},
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "BOOKING_NOT_FOUND"


async def test_provider_list_shows_rating(client, user_store):
    token = seed_user(user_store)
    for vet in VETS:
        user_store[f"vets/{vet['id']}"] = vet
    user_store["users/uid-1/vet_bookings/vetb-1"] = {
        "id": "vetb-1",
        "vetId": "vet-1",
        "vetName": "Dr. Anand Kulkarni (M.V.Sc)",
        "visitType": "farm",
        "slot": "2026-09-10T16:30:00+05:30",
        "animalType": "गाय",
        "status": "completed",
        "createdAt": "2026-09-09T10:00:00+00:00",
    }
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "vet", "bookingId": "vetb-1", "stars": 4},
        headers=auth(token),
    )
    assert resp.status_code == 201
    resp = await client.get("/v1/vets", headers=auth(token))
    assert resp.status_code == 200
    vet1 = next(v for v in resp.json()["data"] if v["id"] == "vet-1")
    assert vet1["ratingAvg"] == 4.0
    assert vet1["ratingCount"] == 1
    vet2 = next(v for v in resp.json()["data"] if v["id"] == "vet-2")
    assert vet2["ratingAvg"] is None
    assert vet2["ratingCount"] == 0


async def test_aggregate_averages(client, user_store):
    token1 = seed_user(user_store)
    token2 = seed_user(user_store, uid="uid-2")
    seed_transport_booking(user_store, booking_id="trb-1", user_id="uid-1")
    seed_transport_booking(user_store, booking_id="trb-2", user_id="uid-2")
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": "trb-1", "stars": 4},
        headers=auth(token1),
    )
    assert resp.status_code == 201
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": "trb-2", "stars": 2},
        headers=auth(token2),
    )
    assert resp.status_code == 201
    aggregate = user_store["provider_ratings/uid-t1"]
    assert aggregate["ratingAvg"] == 3.0
    assert aggregate["ratingCount"] == 2


def test_trust_tier_table():
    # boundaries documented in app/services/trust.py
    assert compute_trust_tier({"completed": 50, "avgRating": 4.5, "disputeRate": 0.01, "kycVerified": True}) == "top"
    # dispute rate not < 0.02 → falls to established
    assert compute_trust_tier({"completed": 50, "avgRating": 4.5, "disputeRate": 0.02, "kycVerified": True}) == "established"
    # KYC missing blocks top
    assert compute_trust_tier({"completed": 50, "avgRating": 4.5, "disputeRate": 0.0, "kycVerified": False}) == "established"
    assert compute_trust_tier({"completed": 20, "avgRating": 4.2, "disputeRate": 0.04, "kycVerified": False}) == "established"
    assert compute_trust_tier({"completed": 5, "avgRating": 4.0, "disputeRate": 0.0, "kycVerified": False}) == "trusted"
    assert compute_trust_tier({"completed": 4, "avgRating": 4.9, "disputeRate": 0.0, "kycVerified": True}) == "new"
    assert compute_trust_tier({"completed": 0, "avgRating": 0.0, "disputeRate": 0.0, "kycVerified": False}) == "new"


async def test_rating_updates_ratee_trust_tier(client, user_store):
    token = seed_user(user_store)
    seed_transport_booking(user_store)
    seed_user(user_store, uid="uid-t1", active_profile="transport")
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": "trb-1", "stars": 5},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert user_store["users/uid-t1"]["trustTier"] == "new"

