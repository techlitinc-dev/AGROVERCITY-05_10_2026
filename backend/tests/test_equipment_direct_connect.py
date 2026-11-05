"""Farmer ↔ Equipment-Owner direct-connect workflow (spec §18 backend tests).

Owner lists equipment → farmer sends a request (terms acknowledged) → owner
accepts (KYC + terms + MPIN) → contacts unlock + one chat room → parties
coordinate directly → work moves inProgress → completed → ratings/issues.

Nothing here creates a payment, escrow, settlement, deposit, or invoice —
asserted explicitly.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.tokens import create_access_token
from tests.test_equipment import second_farmer_token
from tests.test_equipment_owner import OWNER_MACHINE, _owner_token
from tests.test_equipment_approve import _verify_equipment_kyc
from tests.test_users import _auth, _register

IST = timezone(timedelta(hours=5, minutes=30))


@pytest.fixture(autouse=True)
def _seed_owner_machine(user_store):
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)


def _farmer(user_store, uid="uid-2", name="Suresh Jadhav"):
    """Verified farmer WITH a phone so contact snapshots are meaningful."""
    token = second_farmer_token(user_store, uid=uid, name=name)
    user_store[f"users/{uid}"]["phone"] = "+919876543210"
    user_store[f"users/{uid}"]["whatsapp"] = "+919876543210"
    return token

LISTING_BODY = {
    "name": "Swaraj 744 FE",
    "type": "tractor",
    "hourlyRate": 750,
    "location": "Niphad, Nashik",
    "operatorOption": "both",
    "capacity": "45 HP",
    "pricingUnit": "perHour",
    "fuelIncluded": False,
    "travelCharge": "₹15/km beyond 10 km",
    "minBookingQty": 2,
    "notes": "Rotavator attachment available",
}

REQUEST_BODY = {
    "farmerName": "Suresh Jadhav",
    "workLocation": "Pimplas, Niphad",
    "workType": "Ploughing",
    "workQuantity": 3.5,
    "workUnit": "acres",
    "notes": "Black cotton soil",
    "termsAccepted": True,
}


def _tomorrow():
    return (datetime.now(IST).date() + timedelta(days=1)).isoformat()


def _unverified_owner(user_store, uid="uid-unv"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": "Unverified Owner",
        "phone": "+919812340001",
        "linkedProfiles": ["equipmentRental"],
        "activeProfile": "equipmentRental",
        "primaryProfile": "equipmentRental",
        "kycStatus": "pending",
        "mpinHash": None,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    return create_access_token(uid)


async def _book_slot(client, farmer_token, equipment_id="eq-own", date=None, **overrides):
    slots = (
        await client.get(
            f"/v1/equipment/{equipment_id}/slots",
            params={"date": date or _tomorrow()},
            headers=_auth(farmer_token),
        )
    ).json()["data"]
    slot = slots[0]
    resp = await client.post(
        f"/v1/equipment/slots/{slot['id']}/book",
        json={**REQUEST_BODY, **overrides},
        headers=_auth(farmer_token),
    )
    return resp, slot


async def _request_and_accept(client, user_store, mpin="1234"):
    owner_token = await _owner_token(client)
    farmer_token = _farmer(user_store)
    resp, slot = await _book_slot(client, farmer_token)
    assert resp.status_code == 200, resp.text
    booking = resp.json()["booking"]
    accepted = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve",
        json={"termsAccepted": True, "mpin": mpin},
        headers=_auth(owner_token),
    )
    return owner_token, farmer_token, booking, accepted


# ------------------------------------------------------------- listing (§5)


async def test_owner_creates_listing_with_direct_connect_fields(client):
    token = await _owner_token(client)
    resp = await client.post("/v1/equipment", json=LISTING_BODY, headers=_auth(token))
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["operatorOption"] == "both"
    assert doc["pricingUnit"] == "perHour"
    assert doc["location"] == "Niphad, Nashik"
    assert doc["capacity"] == "45 HP"
    assert doc["docStatus"] == "pending"  # equipment verification is separate
    # Editing keeps the fields.
    resp = await client.put(
        f"/v1/equipment/{doc['id']}",
        json={**LISTING_BODY, "hourlyRate": 800, "operatorOption": "withOperator"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["operatorOption"] == "withOperator"


async def test_unverified_owner_cannot_list_equipment(client, user_store):
    token = _unverified_owner(user_store)
    resp = await client.post("/v1/equipment", json=LISTING_BODY, headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"


async def test_owner_cannot_create_with_invalid_pricing_unit(client):
    token = await _owner_token(client)
    resp = await client.post(
        "/v1/equipment", json={**LISTING_BODY, "pricingUnit": "perWeek"}, headers=_auth(token)
    )
    assert resp.status_code == 422


# ---------------------------------------------------------- discovery (§6)


async def test_discovery_has_badges_and_no_private_contacts(client, user_store):
    owner_token = await _owner_token(client)
    farmer_token = _farmer(user_store)
    resp = await client.post("/v1/equipment", json=LISTING_BODY, headers=_auth(owner_token))
    machine_id = resp.json()["id"]
    user_store[f"equipment/{machine_id}"]["docStatus"] = "verified"

    resp = await client.get("/v1/equipment", headers=_auth(farmer_token))
    assert resp.status_code == 200
    row = next(r for r in resp.json()["data"] if r["id"] == machine_id)
    assert row["ownerVerified"] is True
    # Equipment Verified appears ONLY for a completed document review.
    assert row["equipmentVerified"] is True
    for private in ("ownerPhone", "ownerPhoneDigits", "ownerWhatsapp", "phone", "whatsapp"):
        assert row.get(private) in (None, ""), private

    # An unverified (still-under-review) machine stays listed — activation is
    # the visibility trigger; only the Equipment Verified badge is withheld
    # until the document review completes.
    user_store[f"equipment/{machine_id}"]["docStatus"] = "pending"
    resp = await client.get("/v1/equipment", headers=_auth(farmer_token))
    row = next(r for r in resp.json()["data"] if r["id"] == machine_id)
    assert row["equipmentVerified"] is False
    # The owner still sees it with its real document state.
    fleet = await client.get("/v1/equipment/owner/fleet", headers=_auth(owner_token))
    frow = next(r for r in fleet.json()["data"] if r["equipmentId"] == machine_id)
    assert frow["docStatus"] == "pending"


# ----------------------------------------------------- farmer request (§7)


async def test_farmer_creates_valid_request_with_terms_audit(client, user_store):
    await _owner_token(client)
    farmer_token = _farmer(user_store)
    resp, slot = await _book_slot(client, farmer_token)
    assert resp.status_code == 200
    booking = resp.json()["booking"]
    assert booking["status"] == "pending"  # requested
    assert booking["workQuantity"] == 3.5
    assert booking["workUnit"] == "acres"
    assert booking["workType"] == "Ploughing"
    assert booking["farmerTermsAccepted"] is True
    assert booking["farmerTermsVersion"] == "eq-dc-1.0"
    assert booking["farmerTermsAcceptedAt"]
    assert booking["statusHistory"][0]["status"] == "requested"


async def test_request_requires_terms(client, user_store):
    await _owner_token(client)
    farmer_token = _farmer(user_store)
    resp, _slot = await _book_slot(client, farmer_token, termsAccepted=False)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TERMS_REQUIRED"


async def test_request_rejects_invalid_quantity_and_unit(client, user_store):
    await _owner_token(client)
    farmer_token = _farmer(user_store)
    resp, _ = await _book_slot(client, farmer_token, workQuantity=-1)
    assert resp.status_code == 422
    resp, _ = await _book_slot(client, farmer_token, workQuantity=2, workUnit="weeks")
    assert resp.status_code == 422


async def test_unavailable_schedule_rejected_and_duplicate_prevented(client, user_store):
    await _owner_token(client)
    farmer_token = _farmer(user_store)
    other_farmer = _farmer(user_store, uid="uid-3", name="Other Farmer")
    resp, slot = await _book_slot(client, farmer_token)
    assert resp.status_code == 200

    # Second farmer cannot book the now-held slot.
    resp2, _ = await _book_slot(client, other_farmer, date=_tomorrow())
    assert resp2.status_code == 409

    # Same farmer re-requesting the same equipment+schedule is a duplicate,
    # even if the slot appears available again.
    user_store[f"equipment_slots/{slot['id']}"]["status"] = "available"
    resp3, _ = await _book_slot(client, farmer_token)
    assert resp3.status_code == 409
    assert resp3.json()["error"]["code"] == "DUPLICATE_REQUEST"


async def test_unverified_farmer_cannot_request(client, user_store):
    await _owner_token(client)
    farmer_token = _farmer(user_store)
    user_store["users/uid-2"]["kycStatus"] = "pending"
    resp, _ = await _book_slot(client, farmer_token)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"


async def test_farmer_cannot_request_own_equipment(client):
    # Active profile farmer (uid-1) who also owns eq-own.
    resp = await _register(client, profiles=["farmer", "equipmentRental"], primaryProfile="farmer")
    owner_farmer_token = resp.json()["accessToken"]
    slots = (
        await client.get(
            f"/v1/equipment/eq-own/slots", params={"date": _tomorrow()}, headers=_auth(owner_farmer_token)
        )
    ).json()["data"]
    resp = await client.post(
        f"/v1/equipment/slots/{slots[0]['id']}/book",
        json={**REQUEST_BODY, "farmerName": "Ram Patil"},
        headers=_auth(owner_farmer_token),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "OWN_EQUIPMENT"


# ------------------------------------------------------- acceptance (§9)


async def test_acceptance_requires_terms_and_mpin(client, user_store):
    owner_token = await _owner_token(client)
    farmer_token = _farmer(user_store)
    resp, _ = await _book_slot(client, farmer_token)
    booking = resp.json()["booking"]

    no_terms = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve",
        json={"mpin": "1234"},
        headers=_auth(owner_token),
    )
    assert no_terms.status_code == 422
    wrong_mpin = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve",
        json={"termsAccepted": True, "mpin": "9999"},
        headers=_auth(owner_token),
    )
    assert wrong_mpin.status_code == 401

    ok = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve",
        json={"termsAccepted": True, "mpin": "1234"},
        headers=_auth(owner_token),
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["status"] == "booked"  # accepted
    assert body["ownerTermsAccepted"] is True
    assert body["ownerTermsVersion"] == "eq-dc-1.0"
    assert body["mpinVerified"] is True
    assert body["contactRevealedAt"]
    assert body["farmerContact"]["phone"]
    assert body["ownerContact"]["phone"]
    assert body["chatRoomId"].startswith("dm_")


async def test_acceptance_blocks_schedule_and_prevents_double_accept(client, user_store):
    owner_token, farmer_token, booking, accepted = await _request_and_accept(client, user_store)
    assert accepted.status_code == 200
    slot_id = booking["slotId"]
    assert user_store[f"equipment_slots/{slot_id}"]["status"] == "booked"

    again = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve",
        json={"termsAccepted": True, "mpin": "1234"},
        headers=_auth(owner_token),
    )
    assert again.status_code == 409  # double acceptance

    # Exactly one chat room was created for the connection.
    rooms = [k for k in user_store if k.startswith("chat_rooms/") and "/messages" not in k]
    assert len(rooms) == 1


async def test_owner_accepts_only_own_requests(client, user_store):
    await _owner_token(client)
    farmer_token = _farmer(user_store)
    resp, _ = await _book_slot(client, farmer_token)
    booking = resp.json()["booking"]
    # A different owner account cannot accept it.
    user_store["users/uid-stranger"] = {
        "id": "uid-stranger",
        "name": "Stranger Owner",
        "phone": "+919812340099",
        "linkedProfiles": ["equipmentRental"],
        "activeProfile": "equipmentRental",
        "primaryProfile": "equipmentRental",
        "kycStatus": "verified",
        "mpinHash": None,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    stranger = create_access_token("uid-stranger")
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve",
        json={"termsAccepted": True},
        headers=_auth(stranger),
    )
    assert resp.status_code == 403


# -------------------------------------------------- decline & cancel (§8/§11)


async def test_decline_releases_only_that_request(client, user_store):
    owner_token = await _owner_token(client)
    farmer_token = _farmer(user_store)
    slots = (
        await client.get(
            "/v1/equipment/eq-own/slots", params={"date": _tomorrow()}, headers=_auth(farmer_token)
        )
    ).json()["data"]
    r1 = await client.post(
        f"/v1/equipment/slots/{slots[0]['id']}/book", json=REQUEST_BODY, headers=_auth(farmer_token)
    )
    r2 = await client.post(
        f"/v1/equipment/slots/{slots[1]['id']}/book", json=REQUEST_BODY, headers=_auth(farmer_token)
    )
    b1, b2 = r1.json()["booking"], r2.json()["booking"]

    declined = await client.post(
        f"/v1/equipment/bookings/{b1['id']}/reject",
        json={"reason": "Machine in service that day"},
        headers=_auth(owner_token),
    )
    assert declined.status_code == 200
    assert user_store[f"equipment_bookings/{b1['id']}"]["status"] == "rejected"
    assert user_store[f"equipment_slots/{slots[0]['id']}"]["status"] == "available"
    # The sibling request is untouched.
    assert user_store[f"equipment_bookings/{b2['id']}"]["status"] == "pending"
    assert user_store[f"equipment_slots/{slots[1]['id']}"]["status"] == "pending"


async def test_cancellation_releases_block_and_notifies_owner(client, user_store):
    owner_token = await _owner_token(client)
    farmer_token = _farmer(user_store)
    resp, slot = await _book_slot(client, farmer_token)
    booking = resp.json()["booking"]
    cancelled = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/cancel",
        json={"reason": "Rain forecast"},
        headers=_auth(farmer_token),
    )
    assert cancelled.status_code == 200
    assert user_store[f"equipment_slots/{slot['id']}"]["status"] == "available"
    stored = user_store[f"equipment_bookings/{booking['id']}"]
    assert stored["cancellationReason"] == "Rain forecast"
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "equipment_booking_cancelled" for n in notifs)


# --------------------------------------------- status lifecycle & privacy


async def test_work_moves_in_progress_to_completed_without_payment(client, user_store):
    owner_token, farmer_token, booking, accepted = await _request_and_accept(client, user_store)
    assert accepted.status_code == 200

    started = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/execution",
        json={"jobStatus": "work_started"},
        headers=_auth(owner_token),
    )
    assert started.status_code == 200
    assert user_store[f"equipment_bookings/{booking['id']}"]["status"] == "in_progress"

    done = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/execution",
        json={"jobStatus": "completed", "hoursLogged": 4},
        headers=_auth(owner_token),
    )
    assert done.status_code == 200
    stored = user_store[f"equipment_bookings/{booking['id']}"]
    assert stored["status"] == "completed"
    statuses = [h["status"] for h in stored["statusHistory"]]
    assert "requested" in statuses and "accepted" in statuses and "completed" in statuses

    # Completion is a user-reported outcome — no payment artifacts exist.
    for banned in ("payments", "escrow", "settlements", "invoices", "deposits"):
        assert not any(k.startswith(f"{banned}/") for k in user_store), banned

    # Rating prompts opened for BOTH directions.
    prompts = [k for k in user_store if k.startswith("users/") and "/rating_prompts/" in k]
    assert len(prompts) == 2
    # Started/completed notifications reached the farmer.
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "equipment_work_completed" for n in notifs)


async def test_contact_visible_only_to_participants_after_unlock(client, user_store):
    owner_token, farmer_token, booking, accepted = await _request_and_accept(client, user_store)
    assert accepted.status_code == 200

    # The farmer sees the owner contact in their own list…
    mine = await client.get("/v1/equipment/my-bookings", headers=_auth(farmer_token))
    row = next(r for r in mine.json()["data"] if r["id"] == booking["id"])
    assert row["ownerContact"]["phone"]

    # …the owner sees the farmer contact in their requests…
    theirs = await client.get("/v1/equipment/owner/requests", headers=_auth(owner_token))
    orow = next(r for r in theirs.json()["data"] if r["id"] == booking["id"])
    assert orow["farmerContact"]["phone"]

    # …and an unrelated farmer sees no contact at all.
    bystander = _farmer(user_store, uid="uid-9", name="Bystander")
    other = await client.get("/v1/equipment/my-bookings", headers=_auth(bystander))
    assert all(r["id"] != booking["id"] for r in other.json()["data"])


async def test_pending_booking_hides_owner_contact(client, user_store):
    await _owner_token(client)
    farmer_token = _farmer(user_store)
    resp, _ = await _book_slot(client, farmer_token)
    assert resp.status_code == 200
    booking_id = resp.json()["booking"]["id"]
    mine = await client.get("/v1/equipment/my-bookings", headers=_auth(farmer_token))
    row = next(r for r in mine.json()["data"] if r["id"] == booking_id)
    assert "ownerContact" not in row
    assert row["ownerVerified"] is True


# ------------------------------------------------------ ratings & issues


async def test_issue_report_by_either_participant_only(client, user_store):
    owner_token, farmer_token, booking, accepted = await _request_and_accept(client, user_store)
    assert accepted.status_code == 200

    farmer_report = await client.post(
        "/v1/equipment/reports",
        json={
            "targetUserId": "uid-1",
            "bookingId": booking["id"],
            "category": "equipmentIssue",
            "details": "Rotavator blades worn",
        },
        headers=_auth(farmer_token),
    )
    assert farmer_report.status_code == 201
    assert user_store[f"user_reports/{farmer_report.json()['id']}"]["category"] == "equipmentIssue"

    owner_report = await client.post(
        "/v1/equipment/reports",
        json={
            "targetUserId": "uid-2",
            "bookingId": booking["id"],
            "category": "conduct",
            "details": "Late at the field",
        },
        headers=_auth(owner_token),
    )
    assert owner_report.status_code == 201

    # A bystander cannot report on a booking they are not part of.
    bystander = _farmer(user_store, uid="uid-9", name="Bystander")
    forbidden = await client.post(
        "/v1/equipment/reports",
        json={"targetUserId": "uid-1", "bookingId": booking["id"], "category": "safety"},
        headers=_auth(bystander),
    )
    assert forbidden.status_code == 403

    # Unknown category rejected.
    bad = await client.post(
        "/v1/equipment/reports",
        json={"targetUserId": "uid-1", "category": "nonsense"},
        headers=_auth(farmer_token),
    )
    assert bad.status_code == 422


async def test_owner_requests_status_filters(client, user_store):
    owner_token, farmer_token, booking, accepted = await _request_and_accept(client, user_store)
    assert accepted.status_code == 200
    pending = await client.get(
        "/v1/equipment/owner/requests", params={"status": "pending"}, headers=_auth(owner_token)
    )
    assert pending.json()["data"] == []
    upcoming = await client.get(
        "/v1/equipment/owner/requests", params={"status": "upcoming"}, headers=_auth(owner_token)
    )
    assert [r["id"] for r in upcoming.json()["data"]] == [booking["id"]]
    assert upcoming.json()["data"][0]["farmerVerified"] is True
