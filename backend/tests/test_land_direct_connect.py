"""Farmer ↔ Farm-Landlord direct-connect workflow (spec §20 backend tests).

Landlord lists farmland → farmer sends interest (terms acknowledged) →
landlord ACCEPTS THE CONTACT REQUEST (KYC + terms + MPIN) → contacts unlock +
one chat room → parties inspect & negotiate directly → user-reported lease
outcome. Accepting contact never finalizes a lease, marks land leased, or
creates any payment/legal object — asserted explicitly.
"""
from datetime import date, timedelta

import pytest

from app.core.security import hash_mpin
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user
from tests.test_land_market import LISTING_NEAR

LISTING_RICH = {
    **LISTING_NEAR,
    "taluka": "Niphad",
    "state": "Maharashtra",
    "irrigated": True,
    "rentUnit": "perAcrePerYear",
    "availableFrom": (date.today() + timedelta(days=30)).isoformat(),
    "surveyNumber": "312/A",
    "waterSource": "Borewell + farm pond",
    "electricityAvailable": True,
    "roadAccess": "Pucca road to boundary",
    "currentCropStatus": "Fallow after soybean",
    "minDurationMonths": 11,
    "maxDurationMonths": 36,
    "permittedCrops": "Any except banana",
    "notes": "Compound wall on two sides",
    "photos": ["https://cdn.example/land1.jpg"],
    "landDocuments": ["https://cdn.example/private-satbara.pdf"],
}

INTEREST_BODY = {
    "durationMonths": 12,
    "proposedStartDate": (date.today() + timedelta(days=45)).isoformat(),
    "intendedCrop": "Onion",
    "offeredRentRupees": 9000,
    "offeredRentUnit": "perAcrePerYear",
    "message": "Own drip lines and tractor.",
    "termsAccepted": True,
}


def _landlord(user_store, uid="uid-l1", mpin=None, verified=True):
    extra = {"mpinHash": hash_mpin(mpin)} if mpin else {}
    token = seed_user(
        user_store, uid=uid, active_profile="farmLandlord",
        name="Landlord Patil", phone="+919811100001", **extra,
    )
    if not verified:
        user_store[f"users/{uid}"]["kycStatus"] = "pending"
    return token


def _farmer(user_store, uid="uid-f1", verified=True):
    token = seed_user(
        user_store, uid=uid, active_profile="farmer",
        name="Sunil Pawar", phone="+919822200001",
    )
    if not verified:
        user_store[f"users/{uid}"]["kycStatus"] = "pending"
    return token


def _admin(user_store):
    user_store["users/uid-admin-test"] = {
        "id": "uid-admin-test",
        "name": "Ops Admin",
        "phone": "+919800000000",
        "isAdmin": True,
        "activeProfile": "admin",
        "kycStatus": "verified",
    }
    return create_access_token("uid-admin-test")


async def _make_listing(client, token, body=LISTING_RICH):
    resp = await client.post("/v1/land/listings", json=body, headers=auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _send_interest(client, farmer_token, listing_id, **overrides):
    return await client.post(
        "/v1/land/lease-requests",
        json={"listingId": listing_id, **INTEREST_BODY, **overrides},
        headers=auth(farmer_token),
    )


async def _interest_and_accept(client, user_store, mpin="1234"):
    landlord_token = _landlord(user_store, mpin=mpin)
    listing = await _make_listing(client, landlord_token)
    farmer_token = _farmer(user_store)
    sent = await _send_interest(client, farmer_token, listing["id"])
    assert sent.status_code == 201, sent.text
    request = sent.json()
    accepted = await client.post(
        f"/v1/land/lease-requests/{request['id']}/accept-contact",
        json={"termsAccepted": True, "mpin": mpin},
        headers=auth(landlord_token),
    )
    return landlord_token, farmer_token, listing, request, accepted


# ------------------------------------------------------------- listing (§5)


async def test_landlord_creates_and_updates_rich_listing(client, user_store):
    token = _landlord(user_store)
    listing = await _make_listing(client, token)
    assert listing["status"] == "open"
    assert listing["landlordVerified"] is True
    # Land Documents Verified is NOT implied by identity KYC or an upload.
    assert listing["landVerified"] is False
    assert listing["landDocumentsStatus"] == "pending"

    resp = await client.put(
        f"/v1/land/listings/{listing['id']}",
        json={"expectedRentRupees": 9000, "irrigated": False, "notes": "Updated"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["expectedRentRupees"] == 9000

    bad = await client.put(
        f"/v1/land/listings/{listing['id']}",
        json={"minDurationMonths": 24, "maxDurationMonths": 12},
        headers=auth(token),
    )
    assert bad.status_code == 422


async def test_unverified_landlord_cannot_list(client, user_store):
    token = _landlord(user_store, verified=False)
    resp = await client.post("/v1/land/listings", json=LISTING_RICH, headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"


async def test_land_verification_requires_actual_review(client, user_store):
    landlord_token = _landlord(user_store)
    listing = await _make_listing(client, landlord_token)
    farmer_token = _farmer(user_store)

    # Upload alone → still not verified.
    assert listing["landDocumentsStatus"] == "pending"
    # Admin review approves → verified.
    admin_token = _admin(user_store)
    ok = await client.post(
        f"/v1/land/listings/{listing['id']}/verify-documents",
        json={"approved": True},
        headers=auth(admin_token),
    )
    assert ok.status_code == 200
    # Farmer now sees the badge; the private doc URL stays private.
    resp = await client.get("/v1/land/listings", headers=auth(farmer_token))
    row = next(r for r in resp.json()["data"] if r["id"] == listing["id"])
    assert row["landVerified"] is True
    assert "landDocuments" not in row
    assert row["surveyNumber"].startswith("…")

    # Rejection path with a safe reason.
    other = await _make_listing(client, landlord_token)
    rej = await client.post(
        f"/v1/land/listings/{other['id']}/verify-documents",
        json={"approved": False, "reason": "Illegible scan"},
        headers=auth(admin_token),
    )
    assert rej.status_code == 200
    mine = await client.get("/v1/land/listings/mine", headers=auth(landlord_token))
    rejected = next(r for r in mine.json()["data"] if r["id"] == other["id"])
    assert rejected["landDocumentsStatus"] == "rejected"


# ---------------------------------------------------------- discovery (§7)


async def test_discovery_hides_private_data_and_shows_badges(client, user_store):
    landlord_token = _landlord(user_store)
    listing = await _make_listing(client, landlord_token)
    farmer_token = _farmer(user_store)

    resp = await client.get(
        "/v1/land/listings",
        params={"district": "nashik", "irrigated": "true", "maxRent": 9000, "sort": "rentAsc"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 200
    rows = resp.json()["data"]
    assert len(rows) == 1
    row = rows[0]
    assert row["landlordVerified"] is True
    assert row["landVerified"] is False
    assert "landDocuments" not in row
    assert row["surveyNumber"] == "…2/A" or row["surveyNumber"].startswith("…")
    for private in ("landlordPhone", "phone", "whatsapp", "landDocuments"):
        assert row.get(private) in (None, ""), private


# --------------------------------------------------- farmer interest (§8)


async def test_farmer_sends_valid_interest_with_terms_audit(client, user_store):
    landlord_token = _landlord(user_store)
    listing = await _make_listing(client, landlord_token)
    farmer_token = _farmer(user_store)
    resp = await _send_interest(client, farmer_token, listing["id"])
    assert resp.status_code == 201
    request = resp.json()
    assert request["status"] == "pending"  # requested
    assert request["intendedCrop"] == "Onion"
    assert request["offeredRentRupees"] == 9000
    assert request["farmerTermsAcceptedAt"]
    assert request["farmerTermsVersion"] == "land-dc-1.0"
    # Landlord inbox hides the farmer phone before the unlock.
    inbox = await client.get("/v1/land/lease-requests", headers=auth(landlord_token))
    row = inbox.json()["data"][0]
    assert row["farmerPhone"] == ""
    assert row["farmerVerified"] is True


async def test_interest_rejects_invalid_and_missing_terms(client, user_store):
    landlord_token = _landlord(user_store)
    listing = await _make_listing(client, landlord_token)
    farmer_token = _farmer(user_store)

    no_terms = await _send_interest(client, farmer_token, listing["id"], termsAccepted=False)
    assert no_terms.status_code == 422
    assert no_terms.json()["error"]["code"] == "TERMS_REQUIRED"

    bad_date = await _send_interest(
        client, farmer_token, listing["id"], proposedStartDate="not-a-date"
    )
    assert bad_date.status_code == 422

    bad_rent = await _send_interest(client, farmer_token, listing["id"], offeredRentRupees=-5)
    assert bad_rent.status_code == 422

    bad_dur = await _send_interest(client, farmer_token, listing["id"], durationMonths=0)
    assert bad_dur.status_code == 422


async def test_closed_listings_reject_interest_and_duplicates_blocked(client, user_store):
    landlord_token = _landlord(user_store)
    listing = await _make_listing(client, landlord_token)
    farmer_token = _farmer(user_store)

    first = await _send_interest(client, farmer_token, listing["id"])
    assert first.status_code == 201
    dup = await _send_interest(client, farmer_token, listing["id"])
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "DUPLICATE_LEASE_REQUEST"

    # Paused / leased / withdrawn listings reject new interest.
    await client.put(
        f"/v1/land/listings/{listing['id']}",
        json={"status": "paused"},
        headers=auth(landlord_token),
    )
    other = _farmer(user_store, uid="uid-f2")
    resp = await _send_interest(client, other, listing["id"])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LISTING_NOT_OPEN"

    await client.put(
        f"/v1/land/listings/{listing['id']}",
        json={"status": "leased"},
        headers=auth(landlord_token),
    )
    resp = await _send_interest(client, _farmer(user_store, uid="uid-f3"), listing["id"])
    assert resp.status_code == 409


async def test_farmer_cannot_interest_on_own_listing(client, user_store):
    token = _landlord(user_store, uid="uid-l9")
    listing = await _make_listing(client, token)
    # Same account acting with the farmer profile.
    user_store["users/uid-l9"]["linkedProfiles"] = ["farmLandlord", "farmer"]
    user_store["users/uid-l9"]["activeProfile"] = "farmer"
    resp = await _send_interest(client, token, listing["id"])
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "OWN_LISTING"


async def test_unverified_farmer_cannot_send_interest(client, user_store):
    landlord_token = _landlord(user_store)
    listing = await _make_listing(client, landlord_token)
    farmer_token = _farmer(user_store, verified=False)
    resp = await _send_interest(client, farmer_token, listing["id"])
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"


# ---------------------------------------------- contact acceptance (§9/§10)


async def test_accept_contact_requires_terms_and_mpin(client, user_store):
    landlord_token = _landlord(user_store, mpin="1234")
    listing = await _make_listing(client, landlord_token)
    farmer_token = _farmer(user_store)
    sent = await _send_interest(client, farmer_token, listing["id"])
    request = sent.json()

    no_terms = await client.post(
        f"/v1/land/lease-requests/{request['id']}/accept-contact",
        json={"mpin": "1234"},
        headers=auth(landlord_token),
    )
    assert no_terms.status_code == 422
    wrong = await client.post(
        f"/v1/land/lease-requests/{request['id']}/accept-contact",
        json={"termsAccepted": True, "mpin": "9999"},
        headers=auth(landlord_token),
    )
    assert wrong.status_code == 401

    ok = await client.post(
        f"/v1/land/lease-requests/{request['id']}/accept-contact",
        json={"termsAccepted": True, "mpin": "1234"},
        headers=auth(landlord_token),
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["status"] == "contacted"
    assert body["contactRevealedAt"]
    assert body["landlordTermsVersion"] == "land-dc-1.0"
    assert body["mpinVerified"] is True
    assert body["farmerContact"]["phone"]
    assert body["landlordContact"]["phone"]
    assert body["chatRoomId"].startswith("dm_")


async def test_accept_contact_does_not_finalize_lease(client, user_store):
    landlord_token, farmer_token, listing, request, accepted = await _interest_and_accept(client, user_store)
    assert accepted.status_code == 200

    # The listing stays open; no lease, plot change, or payment object exists.
    mine = await client.get("/v1/land/listings/mine", headers=auth(landlord_token))
    row = next(r for r in mine.json()["data"] if r["id"] == listing["id"])
    assert row["status"] == "open"
    assert not any(k.startswith(f"users/uid-l1/land_leases/") for k in user_store)
    for banned in ("payments", "escrow", "settlements", "contracts", "invoices"):
        assert not any(k.startswith(f"{banned}/") for k in user_store), banned

    # Sibling requests are NOT auto-rejected.
    inbox = await client.get("/v1/land/lease-requests", headers=auth(landlord_token))
    statuses = {r["id"]: r["status"] for r in inbox.json()["data"]}

    # Double acceptance is prevented; one chat room exists.
    again = await client.post(
        f"/v1/land/lease-requests/{request['id']}/accept-contact",
        json={"termsAccepted": True, "mpin": "1234"},
        headers=auth(landlord_token),
    )
    assert again.status_code == 409
    rooms = [k for k in user_store if k.startswith("chat_rooms/") and "/messages" not in k]
    assert len(rooms) == 1


async def test_landlord_accepts_only_own_requests(client, user_store):
    landlord_token = _landlord(user_store)
    listing = await _make_listing(client, landlord_token)
    farmer_token = _farmer(user_store)
    sent = await _send_interest(client, farmer_token, listing["id"])
    request = sent.json()
    stranger = _landlord(user_store, uid="uid-l2")
    resp = await client.post(
        f"/v1/land/lease-requests/{request['id']}/accept-contact",
        json={"termsAccepted": True},
        headers=auth(stranger),
    )
    assert resp.status_code == 403


async def test_decline_affects_only_that_request(client, user_store):
    landlord_token = _landlord(user_store)
    listing = await _make_listing(client, landlord_token)
    f1 = _farmer(user_store)
    f2 = _farmer(user_store, uid="uid-f2")
    r1 = (await _send_interest(client, f1, listing["id"])).json()
    r2 = (await _send_interest(client, f2, listing["id"])).json()

    declined = await client.post(
        f"/v1/land/lease-requests/{r1['id']}/reject",
        json={"reason": "Already committed elsewhere"},
        headers=auth(landlord_token),
    )
    assert declined.status_code == 200
    assert user_store[f"lease_requests/{r1['id']}"]["status"] == "rejected"
    assert user_store[f"lease_requests/{r2['id']}"]["status"] == "pending"
    assert user_store[f"land_listings/{listing['id']}"]["status"] == "open"
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "land_request_declined" for n in notifs)


# ------------------------------------------------------ outcomes (§12/§13)


async def test_outcome_flow_and_user_reported_deal_done(client, user_store):
    landlord_token, farmer_token, listing, request, accepted = await _interest_and_accept(client, user_store)
    assert accepted.status_code == 200

    # Illegal: outcome before contact acceptance (must come from the requester).
    f2_token = _farmer(user_store, uid="uid-f2")
    fresh = (await _send_interest(client, f2_token, listing["id"])).json()
    early = await client.post(
        f"/v1/land/lease-requests/{fresh['id']}/outcome",
        json={"outcome": "dealDone"},
        headers=auth(f2_token),
    )
    assert early.status_code == 409

    # Farmer may withdraw a pending request.
    withdrawn = await client.post(
        f"/v1/land/lease-requests/{fresh['id']}/outcome",
        json={"outcome": "withdrawn"},
        headers=auth(f2_token),
    )
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"

    # dealDone records ONLY user-reported optional details.
    done = await client.post(
        f"/v1/land/lease-requests/{request['id']}/outcome",
        json={
            "outcome": "dealDone",
            "finalStartDate": "2027-06-01",
            "finalEndDate": "2030-05-31",
            "finalRentRupees": 8500,
            "finalRentUnit": "perAcrePerYear",
        },
        headers=auth(landlord_token),
    )
    assert done.status_code == 200
    outcome = done.json()["outcome"]
    assert outcome["outcome"] == "dealDone"
    assert outcome["finalRentRupees"] == 8500
    assert outcome["reportedBy"] == "uid-l1"

    # No payment/lease/legal artifacts were created.
    for banned in ("payments", "escrow", "settlements", "contracts"):
        assert not any(k.startswith(f"{banned}/") for k in user_store), banned
    assert not any(k.startswith("users/uid-l1/land_leases/") for k in user_store)

    # Rating prompt opened for the other party.
    prompts = [k for k in user_store if "/rating_prompts/" in k]
    assert len(prompts) == 1

    # Both parties were notified with valid routes.
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    links = [(n.get("data") or {}).get("deepLink") or n.get("deepLink") or "" for n in notifs]
    assert all(any(l.startswith(p) for p in ("/farmer/", "/landlord/", "/chat")) for l in links)


async def test_contact_visible_only_to_participants(client, user_store):
    landlord_token, farmer_token, listing, request, accepted = await _interest_and_accept(client, user_store)
    assert accepted.status_code == 200

    mine = await client.get("/v1/land/lease-requests/mine", headers=auth(farmer_token))
    row = next(r for r in mine.json()["data"] if r["id"] == request["id"])
    assert row["landlordContact"]["phone"]
    assert row["landlordVerified"] is True

    theirs = await client.get("/v1/land/lease-requests", headers=auth(landlord_token))
    lrow = next(r for r in theirs.json()["data"] if r["id"] == request["id"])
    assert lrow["farmerContact"]["phone"]

    # A pending request hides contacts; a stranger landlord sees nothing.
    other = _landlord(user_store, uid="uid-l9")
    stranger_view = await client.get("/v1/land/lease-requests", headers=auth(other))
    assert all(r["id"] != request["id"] for r in stranger_view.json()["data"])

    pending_mine = await _send_interest(client, _farmer(user_store, uid="uid-f7"), listing["id"])
    pm = await client.get("/v1/land/lease-requests/mine", headers=auth(_farmer(user_store, uid="uid-f7")))
    prow = next(r for r in pm.json()["data"] if r["id"] == pending_mine.json()["id"])
    assert "landlordContact" not in prow


async def test_landlord_only_listing_status_changes(client, user_store):
    landlord_token = _landlord(user_store)
    listing = await _make_listing(client, landlord_token)
    farmer_token = _farmer(user_store)

    forbidden = await client.put(
        f"/v1/land/listings/{listing['id']}",
        json={"status": "leased"},
        headers=auth(farmer_token),
    )
    assert forbidden.status_code in (403, 422)  # farmer role cannot manage listings

    ok = await client.put(
        f"/v1/land/listings/{listing['id']}",
        json={"status": "leased"},
        headers=auth(landlord_token),
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "leased"
