"""Farmer-posted land requirements (the "create request" flow).

A farmer posts the land they need (POST /land/requirements), sees their own
board (GET /land/requirements/mine), and closes entries (DELETE). Landlords
browse open requests (GET /land/requirements/browse) and respond
(POST /land/requirements/{id}/respond) — the response opens a direct chat room
and notifies the farmer.
"""
from tests.test_diary import auth, seed_user


def _landlord(user_store, uid="uid-l1"):
    return seed_user(
        user_store, uid=uid, active_profile="farmLandlord",
        name="Landlord Patil", phone="+919811100001",
    )


def _farmer(user_store, uid="uid-f1", phone="+919822200001"):
    return seed_user(
        user_store, uid=uid, active_profile="farmer",
        name="Sunil Pawar", phone=phone,
    )


REQ_BODY = {
    "areaAcres": 5,
    "district": "Nashik",
    "state": "Maharashtra",
    "durationMonths": 24,
    "intendedCrop": "Onion",
    "maxRentPerAcrePerYear": 30000,
    "termsAccepted": True,
}


async def test_farmer_creates_and_lists_requirement(client, user_store):
    farmer = _farmer(user_store)
    resp = await client.post("/v1/land/requirements", json=REQ_BODY, headers=auth(farmer))
    assert resp.status_code == 201
    req = resp.json()
    assert req["status"] == "open"
    assert req["farmerId"] == "uid-f1"
    assert req["responses"] == []

    resp = await client.get("/v1/land/requirements/mine", headers=auth(farmer))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == req["id"]


async def test_create_requires_terms_and_kyc(client, user_store):
    farmer = _farmer(user_store)
    body = {k: v for k, v in REQ_BODY.items() if k != "termsAccepted"}
    resp = await client.post("/v1/land/requirements", json=body, headers=auth(farmer))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TERMS_REQUIRED"

    user_store["users/uid-f1"]["kycStatus"] = "pending"
    resp = await client.post("/v1/land/requirements", json=REQ_BODY, headers=auth(farmer))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"


async def test_landlord_browse_and_respond_flow(client, user_store):
    farmer = _farmer(user_store)
    landlord = _landlord(user_store)
    req = (
        await client.post("/v1/land/requirements", json=REQ_BODY, headers=auth(farmer))
    ).json()

    # Only landlords see the browse board.
    resp = await client.get("/v1/land/requirements/browse", headers=auth(farmer))
    assert resp.status_code == 403
    resp = await client.get("/v1/land/requirements/browse", headers=auth(landlord))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # Respond without terms → 422; with terms → 201 + chat room + notification.
    resp = await client.post(
        f"/v1/land/requirements/{req['id']}/respond",
        json={"message": "I have 6 acres near Pimpalgaon, call me"},
        headers=auth(landlord),
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/v1/land/requirements/{req['id']}/respond",
        json={"message": "I have 6 acres near Pimpalgaon", "termsAccepted": True},
        headers=auth(landlord),
    )
    assert resp.status_code == 201
    out = resp.json()
    assert out["chatRoomId"]

    # Duplicate response blocked.
    resp = await client.post(
        f"/v1/land/requirements/{req['id']}/respond",
        json={"message": "again", "termsAccepted": True},
        headers=auth(landlord),
    )
    assert resp.status_code == 409

    # Farmer sees the response with the landlord's name + verification.
    resp = await client.get("/v1/land/requirements/mine", headers=auth(farmer))
    mine = resp.json()["data"][0]
    assert len(mine["responses"]) == 1
    assert mine["responses"][0]["landlordName"] == "Landlord Patil"
    assert mine["responses"][0]["landlordVerified"] is True

    # Farmer was notified.
    notes = [
        d for k, d in user_store.items()
        if k.startswith("notifications/") and d.get("type") == "land_requirement_response"
    ]
    assert len(notes) == 1
    assert notes[0]["userId"] == "uid-f1"


async def test_close_requirement_blocks_responses(client, user_store):
    farmer = _farmer(user_store)
    landlord = _landlord(user_store)
    req = (
        await client.post("/v1/land/requirements", json=REQ_BODY, headers=auth(farmer))
    ).json()

    resp = await client.delete(f"/v1/land/requirements/{req['id']}", headers=auth(farmer))
    assert resp.status_code == 204
    assert user_store[f"land_requirements/{req['id']}"]["status"] == "closed"

    resp = await client.post(
        f"/v1/land/requirements/{req['id']}/respond",
        json={"message": "still there?", "termsAccepted": True},
        headers=auth(landlord),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "REQUIREMENT_CLOSED"

    # Closed request disappears from the landlord board.
    resp = await client.get("/v1/land/requirements/browse", headers=auth(landlord))
    assert resp.json()["total"] == 0


async def test_browse_annotates_already_requested_listings(client, user_store):
    """Find Farm Land must mark the listings the farmer already sent interest
    on — the card shows 'Interest sent' instead of a duplicate-request 409."""
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord, user_store)
    farmer = _farmer(user_store)

    resp = await client.get("/v1/land/listings", headers=auth(farmer))
    row = next(d for d in resp.json()["data"] if d["id"] == listing_id)
    assert "myRequestStatus" not in row

    await client.post(
        "/v1/land/lease-requests",
        json={"listingId": listing_id, "durationMonths": 12, "termsAccepted": True},
        headers=auth(farmer),
    )
    resp = await client.get("/v1/land/listings", headers=auth(farmer))
    row = next(d for d in resp.json()["data"] if d["id"] == listing_id)
    assert row["myRequestStatus"] == "pending"


async def _make_listing(client, token, user_store, body=None):
    payload = body or {
        "village": "Pimplas",
        "district": "Nashik",
        "lat": 20.0,
        "lng": 73.85,
        "areaAcres": 2.0,
        "expectedRentRupees": 8000,
    }
    resp = await client.post("/v1/land/listings", json=payload, headers=auth(token))
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_landlord_lists_own_responses(client, user_store):
    """My Connections for the landlord includes the farmer requirements they
    responded to — with the farmer card and chat room."""
    farmer = _farmer(user_store)
    landlord = _landlord(user_store)
    req = (
        await client.post("/v1/land/requirements", json=REQ_BODY, headers=auth(farmer))
    ).json()
    await client.post(
        f"/v1/land/requirements/{req['id']}/respond",
        json={"message": "6 acres available", "termsAccepted": True},
        headers=auth(landlord),
    )

    resp = await client.get("/v1/land/requirements/responded", headers=auth(landlord))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["id"] == req["id"]
    assert data[0]["farmerName"] == "Sunil"
    assert data[0]["myResponses"][0]["chatRoomId"]

    # Farmers can't read the landlord-side board.
    resp = await client.get("/v1/land/requirements/responded", headers=auth(farmer))
    assert resp.status_code == 403
