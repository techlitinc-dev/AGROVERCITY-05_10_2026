from app.services.tasks import DEEP_LINKS  # noqa: F401
from datetime import datetime, timedelta, timezone

from app.services.tokens import create_access_token
from tests.test_equipment import second_farmer_token
from tests.test_equipment_owner import OWNER_MACHINE, _owner_token
from tests.test_users import _auth

IST = timezone(timedelta(hours=5, minutes=30))

OTHER_MACHINE = {
    **OWNER_MACHINE,
    "id": "eq-other",
    "name": "Other Owner Harvester",
    "ownerId": "uid-3",
}


def _verify_equipment_kyc(user_store, uid="uid-1"):
    """stands in for the admin KYC review: the owner's equipment case is verified."""
    user_store[f"kyc_cases/kyc_{uid[:8]}_equipmentRental"] = {
        "caseId": f"kyc_cases_kyc_{uid[:8]}_equipmentRental",
        "userId": uid,
        "persona": "equipmentRental",
        "status": "verified",
        "docs": [
            {"docId": f"kyc_{uid[:8]}_equipmentRental:equipment_rc", "type": "equipment_rc", "status": "verified"},
            {"docId": f"kyc_{uid[:8]}_equipmentRental:equipment_insurance", "type": "equipment_insurance", "status": "verified"},
        ],
    }


def _other_owner_token(user_store):
    user_store["users/uid-3"] = {
        "id": "uid-3",
        "name": "Dinkar Pawar",
        "linkedProfiles": ["equipmentRental"],
        "activeProfile": "equipmentRental",
        "primaryProfile": "equipmentRental",
        "mpinHash": None,
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    return create_access_token("uid-3")


def _date_plus(days):
    return (datetime.now(IST).date() + timedelta(days=days)).isoformat()


async def _book_pending(client, farmer_token, equipment_id, days_ahead=1):
    resp = await client.get(
        f"/v1/equipment/{equipment_id}/slots",
        params={"date": _date_plus(days_ahead)},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    slot = resp.json()["data"][0]
    resp = await client.post(
        f"/v1/equipment/slots/{slot['id']}/book",
        json={"farmerName": "Suresh Jadhav"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"
    return resp.json()["booking"]


def _notifications_for(user_store, uid):
    return [
        d for key, d in user_store.items()
        if key.startswith("notifications/") and d.get("userId") == uid
    ]


async def test_approve_pending_booking(client, user_store):
    owner_token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)
    booking = await _book_pending(client, farmer_token, "eq-own")
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve", headers=_auth(owner_token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "booked"
    assert user_store[f"equipment_bookings/{booking['id']}"]["status"] == "booked"
    assert user_store[f"equipment_slots/{booking['slotId']}"]["status"] == "booked"
    notes = _notifications_for(user_store, "uid-2")
    assert len(notes) == 1
    assert notes[0]["title"] == "बुकिंग स्वीकृत"


async def test_approve_non_pending_409(client, user_store):
    owner_token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)
    booking = await _book_pending(client, farmer_token, "eq-own")
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve", headers=_auth(owner_token)
    )
    assert resp.status_code == 200
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve", headers=_auth(owner_token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ILLEGAL_TRANSITION"


async def test_reject_frees_slot_with_reason(client, user_store):
    owner_token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)
    booking = await _book_pending(client, farmer_token, "eq-own")
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/reject",
        json={"reason": "मशीन खराब"},
        headers=_auth(owner_token),
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "promotedUserId": None}
    rejected = user_store[f"equipment_bookings/{booking['id']}"]
    assert rejected["status"] == "rejected"
    assert rejected["rejectionReason"] == "मशीन खराब"
    slot = user_store[f"equipment_slots/{booking['slotId']}"]
    assert slot["status"] == "available"
    assert slot["bookedByName"] is None
    notes = _notifications_for(user_store, "uid-2")
    assert len(notes) == 1
    assert "मशीन खराब" in notes[0]["body"]


async def test_reject_promotes_waitlist_head(client, user_store):
    owner_token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)
    waiter_token = second_farmer_token(user_store, uid="uid-3", name="Dinkar Pawar")
    booking = await _book_pending(client, farmer_token, "eq-own")
    resp = await client.post(
        f"/v1/equipment/slots/{booking['slotId']}/waitlist", headers=_auth(waiter_token)
    )
    assert resp.status_code == 200
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/reject",
        json={"reason": "ऑपरेटर उपलब्ध नहीं"},
        headers=_auth(owner_token),
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "promotedUserId": "uid-3"}
    assert f"equipment_waitlists/{booking['slotId']}_uid-3" not in user_store
    promoted = [
        b for key, b in user_store.items()
        if key.startswith("equipment_bookings/") and b["userId"] == "uid-3"
    ]
    assert len(promoted) == 1
    assert promoted[0]["status"] == "pending"
    assert promoted[0]["slotId"] == booking["slotId"]
    assert user_store[f"equipment_slots/{booking['slotId']}"]["status"] == "pending"
    assert len(_notifications_for(user_store, "uid-2")) == 1
    assert len(_notifications_for(user_store, "uid-3")) == 1


async def test_non_owner_approve_403(client, user_store):
    await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)
    booking = await _book_pending(client, farmer_token, "eq-own")
    other_owner = _other_owner_token(user_store)
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve", headers=_auth(other_owner)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "NOT_EQUIPMENT_OWNER"
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve", headers=_auth(farmer_token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_reject_without_reason_422(client, user_store):
    owner_token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)
    booking = await _book_pending(client, farmer_token, "eq-own")
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/reject",
        json={"reason": "no"},
        headers=_auth(owner_token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_pending_inbox_lists_owner_pending_only(client, user_store):
    owner_token = await _owner_token(client)
    other_owner = _other_owner_token(user_store)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)
    user_store["equipment/eq-other"] = dict(OTHER_MACHINE)
    _verify_equipment_kyc(user_store, "uid-3")
    farmer_token = second_farmer_token(user_store)
    booking_own = await _book_pending(client, farmer_token, "eq-own", days_ahead=1)
    booking_other = await _book_pending(client, farmer_token, "eq-other", days_ahead=2)
    resp = await client.get("/v1/equipment/bookings/pending", headers=_auth(owner_token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert [row["bookingId"] for row in data] == [booking_own["id"]]
    assert data[0]["equipmentName"] == "Owner Rotavator"
    assert data[0]["farmerName"] == "Suresh Jadhav"
    assert data[0]["slotName"] == "6:00 AM – 10:00 AM"
    assert data[0]["priceRupees"] == 800
    resp = await client.get("/v1/equipment/bookings/pending", headers=_auth(other_owner))
    assert [row["bookingId"] for row in resp.json()["data"]] == [booking_other["id"]]


async def test_booking_approval_emits_task(client, user_store):
    await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)
    await _book_pending(client, farmer_token, "eq-own")
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 1
    task = tasks[0]
    assert task["userId"] == "uid-1"
    assert task["module"] == "equipment"
    assert task["kind"] == "booking_approval_needed"
    assert task["deepLink"] in DEEP_LINKS.values()


async def test_fpo_auto_confirm_vs_private_manual(client, user_store):
    """WS-04 step 6: FPO machines auto-confirm; private machines stay
    manual-approve in the owner's queue."""
    owner_token = await _owner_token(client)
    user_store["equipment/eq-own"] = {**OWNER_MACHINE, "ownerType": "fpo"}
    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)

    # FPO path: books straight to confirmed — nothing lands in the owner queue
    resp = await client.get(
        f"/v1/equipment/eq-own/slots", params={"date": _date_plus(3)}, headers=_auth(farmer_token)
    )
    fpo_slot = resp.json()["data"][0]
    resp = await client.post(
        f"/v1/equipment/slots/{fpo_slot['id']}/book",
        json={"farmerName": "Suresh Jadhav"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "booked"
    inbox = await client.get("/v1/equipment/bookings/pending", headers=_auth(owner_token))
    assert all(r["bookingId"] != resp.json()["booking"]["id"] for r in inbox.json()["data"])

    # private path: waits for owner approval and appears in the queue
    user_store["equipment/eq-own"]["ownerType"] = "private"
    resp = await client.get(
        f"/v1/equipment/eq-own/slots", params={"date": _date_plus(4)}, headers=_auth(farmer_token)
    )
    priv_slot = resp.json()["data"][0]
    resp = await client.post(
        f"/v1/equipment/slots/{priv_slot['id']}/book",
        json={"farmerName": "Suresh Jadhav"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"
    inbox = await client.get("/v1/equipment/bookings/pending", headers=_auth(owner_token))
    assert any(r["bookingId"] == resp.json()["booking"]["id"] for r in inbox.json()["data"])
