"""Farmer–Transporter direct-connect workflow tests (spec §17).

Covers the transport requirement lifecycle end to end: posting (plain /
produce-lot prefill / any-vehicle), transporter quoting (terms + MPIN + KYC +
vehicle gates + duplicate prevention), farmer acceptance (atomic, exactly one
booking, contact reveal, consent audit, sibling rejection), the direct-request
entry point (accept / decline without destructive side effects), and the
privacy rules (contacts hidden on every public surface, participant-only
GPS/POD/chat/contact access, no escrow/payment step anywhere in the journey).
"""

from datetime import datetime, timedelta, timezone

from app.services.tokens import create_access_token
from tests.test_lots import LOT_BODY
from tests.test_transport import (
    _activate,
    _add_vehicle,
    _book,
    _other_transporter_token,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth, _register

FUTURE_DATE = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()

LOAD_BODY = {
    "pickupLocation": "Pimpalgaon, Nashik",
    "dropLocation": "Nashik APMC",
    "crop": "Onion",
    "quantityQuintals": 20,  # 2.0T — fits a Tractor Trolley (3.0T) in one trip
    "packaging": "Gunny Bags",
    "preferredVehicleType": "Tractor Trolley",
    "pickupDate": FUTURE_DATE,
    "targetFare": 2500,
    "termsAccepted": True,
}


def _notifications(user_store, ntype):
    notes = []
    for key, doc in user_store.items():
        if key.startswith("notifications/") and doc.get("type") == ntype:
            notes.append(doc)
    return notes


async def _post_load(client, token, **overrides):
    resp = await client.post("/v1/transport/loads", json={**LOAD_BODY, **overrides}, headers=_auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _bid_on(client, load_id, token, **overrides):
    return await client.post(
        f"/v1/transport/loads/{load_id}/bid",
        json={"quotedFare": 2800, "termsAccepted": True, "mpin": "1234", **overrides},
        headers=_auth(token),
    )


# --------------------------------------------------------------------------
# Posting: vehicle preference, any-vehicle, produce-lot prefill, validation
# --------------------------------------------------------------------------


async def test_post_load_with_valid_vehicle_preference(client, user_store):
    token = await _token(client)
    load = await _post_load(client, token)
    assert load["status"] == "open"
    assert load["preferredVehicleType"] == "Tractor Trolley"
    # consent audit recorded at posting time
    terms = [d for d in user_store.values() if str(d.get("id", "")).startswith("ta_")]
    assert any(t.get("acceptedFor") == "load" and t.get("loadId") == load["id"] for t in terms)
    assert all(t.get("termsVersion") == "dc-1.0" for t in terms)


async def test_post_load_any_suitable_vehicle(client):
    token = await _token(client)
    load = await _post_load(client, token, preferredVehicleType="Any")
    assert load["preferredVehicleType"] == "Any"
    # normalized spellings all work too
    for spelling in (None, "any suitable vehicle"):
        body = {**LOAD_BODY, "preferredVehicleType": spelling}
        if spelling is None:
            del body["preferredVehicleType"]
        resp = await client.post("/v1/transport/loads", json=body, headers=_auth(token))
        assert resp.status_code == 201, resp.text
        assert resp.json()["preferredVehicleType"] == "Any"


async def test_post_load_unknown_vehicle_type_rejected(client):
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/loads",
        json={**LOAD_BODY, "preferredVehicleType": "Spaceship"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UNKNOWN_VEHICLE_TYPE"


async def test_post_load_capacity_insufficient_blocked(client):
    """40q (4T) cannot ride a 3T tractor trolley in one trip — block it."""
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/loads",
        json={**LOAD_BODY, "quantityQuintals": 40},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VEHICLE_CAPACITY_INSUFFICIENT"


async def test_post_load_past_pickup_date_rejected(client):
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/loads",
        json={**LOAD_BODY, "pickupDate": "2020-01-01"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "PICKUP_IN_PAST"


async def test_post_load_requires_terms(client):
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/loads",
        json={**LOAD_BODY, "termsAccepted": False},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TERMS_REQUIRED"


async def test_produce_lot_prefill_uses_server_side_lot_fields(client, user_store):
    """Option B: sourceLotId validates ownership and ground-truths crop/qty."""
    token = await _token(client)
    lot = (await client.post("/v1/market/lots", json=LOT_BODY, headers=_auth(token))).json()
    load = await _post_load(
        client,
        token,
        sourceLotId=lot["id"],
        crop="CLIENT-SENT-IGNORED",
        quantityQuintals=999,
        pickupLocation="Client Village",
    )
    assert load["sourceLotId"] == lot["id"]
    assert load["crop"] == lot["crop"]
    assert load["quantityQuintals"] == lot["quantityQuintals"]


async def test_produce_lot_prefill_rejects_other_farmers_lot(client, user_store):
    token = await _token(client)
    other = create_access_token("uid-stranger")
    user_store["users/uid-stranger"] = {
        "id": "uid-stranger",
        "linkedProfiles": ["farmer"],
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    lot = (await client.post("/v1/market/lots", json=LOT_BODY, headers=_auth(token))).json()
    resp = await client.post(
        "/v1/transport/loads",
        json={**LOAD_BODY, "sourceLotId": lot["id"]},
        headers=_auth(other),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOT_NOT_FOUND"


async def test_produce_lot_prefill_rejects_missing_lot(client):
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/loads",
        json={**LOAD_BODY, "sourceLotId": "lot_nope"},
        headers=_auth(token),
    )
    assert resp.status_code == 404


# --------------------------------------------------------------------------
# Load board privacy + discovery
# --------------------------------------------------------------------------


async def test_load_board_hides_farmer_contact_details(client, user_store):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    load = await _post_load(client, farmer_token)

    transporter = _other_transporter_token(user_store)
    board = await client.get("/v1/transport/loads", headers=_auth(transporter))
    assert board.status_code == 200
    entry = next(l for l in board.json()["data"] if l["id"] == load["id"])
    assert "farmerPhone" not in entry
    assert "contactReveal" not in entry
    assert "farmerPhone" not in str(entry)

    detail = await client.get(f"/v1/transport/loads/{load['id']}", headers=_auth(transporter))
    assert detail.status_code == 200
    assert "farmerPhone" not in detail.json()

    # The owner still sees their own load untouched.
    mine = await client.get(f"/v1/transport/loads/{load['id']}", headers=_auth(farmer_token))
    assert mine.status_code == 200
    assert mine.json()["farmerPhone"]


async def test_load_board_filters(client, user_store):
    token = await _token(client)
    await _post_load(client, token, crop="Onion", urgent=True)
    await _post_load(client, token, crop="Tomato", urgent=False, preferredVehicleType="Bolero Maxi", quantityQuintals=12)

    other = _other_transporter_token(user_store)
    urgent = await client.get("/v1/transport/loads?urgent=true", headers=_auth(other))
    assert all(l["urgent"] for l in urgent.json()["data"])

    by_crop = await client.get("/v1/transport/loads?crop=tomato", headers=_auth(other))
    assert all("tomato" in l["crop"].lower() for l in by_crop.json()["data"])

    by_vehicle = await client.get("/v1/transport/loads?vehicleType=bolero", headers=_auth(other))
    assert all("bolero" in (l.get("preferredVehicleType") or "").lower() for l in by_vehicle.json()["data"])

    by_qty = await client.get("/v1/transport/loads?minQuantity=15&maxQuantity=25", headers=_auth(other))
    assert all(15 <= float(l.get("quantityQuintals") or 0) <= 25 for l in by_qty.json()["data"])


async def test_load_board_matching_fleet_filter(client, user_store):
    token = await _token(client)
    await _post_load(client, token, preferredVehicleType="Tata Ace", quantityQuintals=5)  # postable but not an Eicher match
    load_any = await _post_load(client, token, preferredVehicleType="Any")

    transporter = _other_transporter_token(user_store)
    big = await _add_vehicle(client, transporter, vehicleType="Eicher 6-Wheeler", registrationNo="MH12 CD 9011", capacityTonnes=6.0)
    _verify_vehicle(user_store, big["id"])

    matched = await client.get("/v1/transport/loads?matchingFleet=true", headers=_auth(transporter))
    ids = {l["id"] for l in matched.json()["data"]}
    assert load_any["id"] in ids          # Any vehicle + 2T ≤ 6T fleet capacity
    assert len(ids) == 1                  # the Tata-Ace-only load can't be carried


# --------------------------------------------------------------------------
# Quoting: gates, duplicate prevention, privacy
# --------------------------------------------------------------------------


async def _transporter_with_vehicle(client, user_store, **overrides):
    token = await _token(client)
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token, **overrides)
    _verify_vehicle(user_store, vehicle["id"])
    return token, vehicle


async def test_quote_requires_valid_vehicle_terms_mpin(client, user_store):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    load = await _post_load(client, farmer_token)
    t_token, vehicle = await _transporter_with_vehicle(
        client, user_store, vehicleType="Eicher 6-Wheeler", registrationNo="MH12 CD 9011", capacityTonnes=6.0
    )
    await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}/availability",
        json={"availableDates": [LOAD_BODY["pickupDate"]]},
        headers=_auth(t_token),
    )

    # terms missing
    resp = await _bid_on(client, load["id"], t_token, termsAccepted=False)
    assert resp.status_code == 422
    # wrong MPIN
    resp = await _bid_on(client, load["id"], t_token, mpin="9999")
    assert resp.status_code == 401
    # someone else's vehicle
    stranger = _other_transporter_token(user_store)
    resp = await _bid_on(client, load["id"], stranger, vehicleId=vehicle["id"])
    assert resp.status_code in (403, 404)
    # under-capacity vehicle (Tata Ace 0.75T < 2T)
    small = await _add_vehicle(client, t_token, vehicleType="Tata Ace", registrationNo="MH15 AB 1234", capacityTonnes=0.75)
    await client.put(
        f"/v1/transport/vehicles/{small['id']}/availability",
        json={"availableDates": [LOAD_BODY["pickupDate"]]},
        headers=_auth(t_token),
    )
    resp = await _bid_on(client, load["id"], t_token, vehicleId=small["id"], termsAccepted=True)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VEHICLE_CAPACITY_INSUFFICIENT"
    # valid quote
    resp = await _bid_on(client, load["id"], t_token, vehicleId=vehicle["id"], termsAccepted=True)
    assert resp.status_code == 201
    assert resp.json()["vehicleNo"] == "MH12 CD 9011"
    # plain MPIN never stored on the bid
    assert "1234" not in str(resp.json())


async def test_quote_blocked_when_kyc_failed(client, user_store):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    load = await _post_load(client, farmer_token)
    t_token, _ = await _transporter_with_vehicle(client, user_store)
    user_store["users/uid-1"]["kycStatus"] = "failed"
    resp = await _bid_on(client, load["id"], t_token)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"


async def test_quote_blocked_when_vehicle_unavailable_or_docs_expired(client, user_store):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    load = await _post_load(client, farmer_token)
    t_token, vehicle = await _transporter_with_vehicle(
        client, user_store, vehicleType="Eicher 6-Wheeler", registrationNo="MH12 CD 9011", capacityTonnes=6.0
    )
    await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}/availability",
        json={"availableDates": ["2030-01-01"]},
        headers=_auth(t_token),
    )
    resp = await _bid_on(client, load["id"], t_token, vehicleId=vehicle["id"], termsAccepted=True)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "VEHICLE_NOT_AVAILABLE"

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}/availability",
        json={"availableDates": [LOAD_BODY["pickupDate"]]},
        headers=_auth(t_token),
    )
    await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}",
        json={"fitnessExpiry": yesterday},
        headers=_auth(t_token),
    )
    resp = await _bid_on(client, load["id"], t_token, vehicleId=vehicle["id"], termsAccepted=True)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VEHICLE_NOT_VERIFIED"


async def test_withdraw_pending_bid(client, user_store):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    load = await _post_load(client, farmer_token)
    t_token, _ = await _transporter_with_vehicle(client, user_store)

    bid = (await _bid_on(client, load["id"], t_token)).json()
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/bids/{bid['id']}/withdraw", headers=_auth(t_token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "withdrawn"
    # withdrawing releases the slot — a fresh quote is allowed again
    resp = await _bid_on(client, load["id"], t_token)
    assert resp.status_code == 201
    # a stranger cannot withdraw someone else's bid
    stranger = _other_transporter_token(user_store)
    bid2 = (await _bid_on(client, load["id"], stranger)).json()
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/bids/{bid2['id']}/withdraw", headers=_auth(t_token)
    )
    assert resp.status_code == 404


# --------------------------------------------------------------------------
# Farmer acceptance: authorization, atomicity, booking, reveal, audit
# --------------------------------------------------------------------------


async def _load_with_two_bids(client, user_store):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    load = await _post_load(client, farmer_token)
    t_token, vehicle = await _transporter_with_vehicle(
        client,
        user_store,
        vehicleType="Eicher 6-Wheeler",
        registrationNo="MH12 CD 9011",
        capacityTonnes=6.0,
    )
    await client.put(
        f"/v1/transport/vehicles/{vehicle['id']}/availability",
        json={"availableDates": [LOAD_BODY["pickupDate"]]},
        headers=_auth(t_token),
    )
    t2_token = _other_transporter_token(user_store)
    bid1 = (await _bid_on(client, load["id"], t_token, vehicleId=vehicle["id"])).json()
    bid2 = (await _bid_on(client, load["id"], t2_token, quotedFare=2600)).json()
    return farmer_token, load, (t_token, vehicle), bid1, t2_token, bid2


async def test_farmer_cannot_accept_another_users_load_or_quote(client, user_store):
    farmer_token, load, (t_token, _), bid, _, _ = await _load_with_two_bids(client, user_store)
    stranger = create_access_token("uid-stranger")
    user_store["users/uid-stranger"] = {
        "id": "uid-stranger",
        "linkedProfiles": ["farmer"],
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid",
        json={"bidId": bid["id"], "termsAccepted": True, "mpin": "1234"},
        headers=_auth(stranger),
    )
    assert resp.status_code == 404


async def test_accept_quote_creates_exactly_one_booking_and_reveals_contacts(client, user_store):
    farmer_token, load, (t_token, vehicle), bid, t2_token, bid2 = await _load_with_two_bids(client, user_store)

    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid",
        json={"bidId": bid["id"], "termsAccepted": True, "mpin": "1234"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    booking = body["booking"]
    assert booking["status"] == "accepted"
    assert booking["fare"] == bid["quotedFare"]
    assert booking["vehicleNo"] == vehicle["registrationNo"]
    assert body["contactReveal"]["farmer"]["phoneDigits"]
    assert body["contactReveal"]["transporter"]["phoneDigits"]
    assert booking["consent"]["termsVersion"] == "dc-1.0"
    assert booking["consent"]["contactRevealedAt"]

    # exactly one booking for the load, stored and pointed to by the load
    bookings = [k for k in user_store if k.startswith("transport_bookings/")]
    assert len(bookings) == 1
    assert user_store[f"transport_loads/{load['id']}"]["acceptedBookingId"] == booking["id"]
    assert user_store[f"transport_loads/{load['id']}"]["status"] == "booked"

    # sibling bid auto-rejected with notification
    sib = user_store[f"transport_loads/{load['id']}/bids/{bid2['id']}"]
    assert sib["status"] == "rejected"
    assert _notifications(user_store, "load_bid_rejected")

    # notifications carry valid, party-correct links and no phone numbers
    import re

    confirmed = _notifications(user_store, "booking_confirmed")
    assert confirmed and confirmed[0]["data"]["deepLink"] == f"/transporter/trips/{booking['id']}"
    chat = _notifications(user_store, "chat_unlocked")
    assert chat and all(n["data"]["deepLink"].startswith("/chat?room=") for n in chat)
    for note in confirmed + chat:
        body = note["data"].get("body", "")
        assert not re.search(r"\d{10,}", body)

    # the winner sees the farmer's contact on their bid tracker
    mine = await client.get("/v1/transport/loads/my-bids", headers=_auth(t_token))
    entry = next(b for b in mine.json()["data"] if b["id"] == bid["id"])
    assert entry["contactReveal"]["farmer"]["phoneDigits"]


async def test_double_acceptance_prevented(client, user_store):
    farmer_token, load, (t_token, _), bid, t2_token, bid2 = await _load_with_two_bids(client, user_store)
    first = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid",
        json={"bidId": bid["id"], "termsAccepted": True, "mpin": "1234"},
        headers=_auth(farmer_token),
    )
    assert first.status_code == 200

    second = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid",
        json={"bidId": bid2["id"], "termsAccepted": True, "mpin": "1234"},
        headers=_auth(farmer_token),
    )
    assert second.status_code == 409
    bookings = [k for k in user_store if k.startswith("transport_bookings/")]
    assert len(bookings) == 1


async def test_accept_bid_requires_farmer_mpin_when_on_file(client, user_store):
    farmer_token, load, (t_token, _), bid, _, _ = await _load_with_two_bids(client, user_store)
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid",
        json={"bidId": bid["id"], "termsAccepted": True},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 401
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid",
        json={"bidId": bid["id"], "termsAccepted": True, "mpin": "9999"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 401


# --------------------------------------------------------------------------
# Farmer cancellation of an open requirement
# --------------------------------------------------------------------------


async def test_farmer_cancels_open_load_and_pending_bidders_notified(client, user_store):
    farmer_token, load, (t_token, _), bid, _, _ = await _load_with_two_bids(client, user_store)
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/cancel",
        json={"reason": "crop sold locally"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert user_store[f"transport_loads/{load['id']}/bids/{bid['id']}"]["status"] == "rejected"
    notes = _notifications(user_store, "load_cancelled")
    assert notes
    assert notes[0]["data"]["deepLink"] == "/transporter/loads"

    # a stranger cannot cancel the load
    load2 = await _post_load(client, farmer_token)
    stranger = _other_transporter_token(user_store)
    resp = await client.post(
        f"/v1/transport/loads/{load2['id']}/cancel",
        json={"reason": "nope"},
        headers=_auth(stranger),
    )
    assert resp.status_code == 404


# --------------------------------------------------------------------------
# Option C — direct transporter requests
# --------------------------------------------------------------------------


async def _direct_request(client, user_store, transporter_uid="uid-t1"):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    user_store[f"users/{transporter_uid}"] = {
        "id": transporter_uid,
        "name": "Ganesh Transport",
        "phone": "+919876543210",
        "whatsapp": "+919876543210",
        "linkedProfiles": ["transport"],
        "activeProfile": "transport",
        "primaryProfile": "transport",
        "mpinHash": None,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post(
        "/v1/transport/bookings",
        json={
            "vehicleType": "Tata Ace",
            "distanceKm": 20,
            "pickup": "Pimpalgaon",
            "drop": "Nashik APMC",
            "date": FUTURE_DATE,
            "commodity": "Onion",
            "weightQuintals": 5,
            "transporterId": transporter_uid,
            "termsAccepted": True,
        },
        headers=_auth(farmer_token),
    )
    return farmer_token, resp


async def test_direct_request_requires_terms_and_valid_transporter(client, user_store):
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    user_store["users/uid-t1"] = {
        "id": "uid-t1",
        "linkedProfiles": ["transport"],
        "activeProfile": "transport",
        "primaryProfile": "transport",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    base = {
        "vehicleType": "Tata Ace",
        "distanceKm": 20,
        "pickup": "Pimpalgaon",
        "drop": "Nashik APMC",
        "date": FUTURE_DATE,
        "transporterId": "uid-t1",
    }
    resp = await client.post("/v1/transport/bookings", json=base, headers=_auth(farmer_token))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TERMS_REQUIRED"

    resp = await client.post(
        "/v1/transport/bookings",
        json={**base, "termsAccepted": True, "transporterId": "uid-nope"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 404


async def test_direct_request_accept_unlocks_contacts_and_opens_chat(client, user_store):
    farmer_token, resp = await _direct_request(client, user_store)
    assert resp.status_code == 200
    booking = resp.json()
    assert booking["status"] == "requested"
    assert booking["requestKind"] == "direct"

    t_token = create_access_token("uid-t1")
    accepted = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": None, "termsAccepted": True},
        headers=_auth(t_token),
    )
    assert accepted.status_code == 200
    body = accepted.json()
    assert body["status"] == "accepted"
    reveal = body["contactReveal"]
    assert reveal["farmer"]["phoneDigits"]
    assert reveal["transporter"]["phoneDigits"]
    assert body["consent"]["termsVersion"] == "dc-1.0"

    # farmer notified with the transporter contact + valid deep link
    notes = _notifications(user_store, "direct_request_accepted")
    assert notes
    assert notes[0]["data"]["deepLink"] == f"/farmer/transport/{booking['id']}"
    # chat room exists for the booking
    assert user_store[f"chat_rooms/{booking['id']}"]["kind"] == "transport"

    # another transporter cannot accept a request addressed to someone else
    farmer_token2, resp2 = await _direct_request(client, user_store, transporter_uid="uid-t2")
    booking2 = resp2.json()
    intruder = _other_transporter_token(user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking2['id']}/accept",
        json={"termsAccepted": True},
        headers=_auth(intruder),
    )
    assert resp.status_code == 403


async def test_direct_request_decline_leaves_requirement_intact(client, user_store):
    farmer_token, resp = await _direct_request(client, user_store)
    booking = resp.json()

    t_token = create_access_token("uid-t1")
    declined = await client.post(
        f"/v1/transport/bookings/{booking['id']}/reject",
        json={"reason": "vehicle under repair"},
        headers=_auth(t_token),
    )
    assert declined.status_code == 200
    assert declined.json()["status"] == "cancelled"
    assert declined.json()["cancelledBy"] == "transporter"

    notes = _notifications(user_store, "direct_request_declined")
    assert notes
    assert notes[0]["data"]["deepLink"] == "/farmer/transport"

    # the farmer can immediately post the requirement to the load board —
    # declining the direct request had no destructive side effect.
    load = await _post_load(client, farmer_token)
    assert load["status"] == "open"


# --------------------------------------------------------------------------
# Trip lifecycle: transitions, POD, no escrow prerequisite, access control
# --------------------------------------------------------------------------


async def _accepted_trip(client, user_store):
    farmer_token = await _token(client)
    booking = (await _book(client, farmer_token)).json()
    await _activate(client, farmer_token)
    vehicle = await _add_vehicle(client, farmer_token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    return farmer_token, booking["id"]


async def test_trip_transitions_and_pod_requirements(client, user_store):
    token, booking_id = await _accepted_trip(client, user_store)
    # illegal transition: accepted → loading skips the mandatory arrival step
    resp = await client.patch(
        f"/v1/transport/bookings/{booking_id}", json={"status": "loading"}, headers=_auth(token)
    )
    assert resp.status_code == 409
    resp = await client.patch(
        f"/v1/transport/bookings/{booking_id}", json={"status": "delivered"}, headers=_auth(token)
    )
    assert resp.status_code == 409  # illegal transition, not just missing POD

    # legal transition, but delivery without POD/receiver is rejected
    resp = await client.patch(
        f"/v1/transport/bookings/{booking_id}", json={"status": "enRoute"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    resp = await client.patch(
        f"/v1/transport/bookings/{booking_id}",
        json={"status": "delivered"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "POD_REQUIRED"

    resp = await client.patch(
        f"/v1/transport/bookings/{booking_id}",
        json={"status": "delivered", "podPhotos": ["https://storage.example/pod/1.jpg"], "receiverName": "Ram Patil"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["pod"]["receiverName"] == "Ram Patil"
    # delivered is terminal
    resp = await client.patch(
        f"/v1/transport/bookings/{booking_id}", json={"status": "enRoute"}, headers=_auth(token)
    )
    assert resp.status_code == 409


async def test_trip_completes_without_any_payment_step(client, user_store):
    """Direct-connect: no escrow/advance status exists or is required — the
    booking carries only the agreed fare, and the trip runs to delivery."""
    token, booking_id = await _accepted_trip(client, user_store)
    booking = (await client.get(f"/v1/transport/bookings/{booking_id}", headers=_auth(token))).json()
    assert "fare" in booking
    for forbidden in ("escrowStatus", "advancePaid", "paymentStatus", "settlementStatus"):
        assert forbidden not in booking
    resp = await client.patch(
        f"/v1/transport/bookings/{booking_id}", json={"status": "enRoute"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    resp = await client.patch(
        f"/v1/transport/bookings/{booking_id}",
        json={"status": "delivered", "podPhotos": ["https://storage.example/pod/2.jpg"], "receiverName": "Sham"},
        headers=_auth(token),
    )
    assert resp.status_code == 200


async def test_private_trip_details_participant_only(client, user_store):
    token, booking_id = await _accepted_trip(client, user_store)
    stranger = _other_transporter_token(user_store)

    # GPS / driver details
    resp = await client.get(f"/v1/transport/bookings/{booking_id}/location", headers=_auth(stranger))
    assert resp.status_code == 403
    resp = await client.get(f"/v1/transport/bookings/{booking_id}/location", headers=_auth(token))
    assert resp.status_code == 200
    # booking detail incl. contact fields
    resp = await client.get(f"/v1/transport/bookings/{booking_id}", headers=_auth(stranger))
    assert resp.status_code == 403
    # transporter P&L / expenses
    resp = await client.get(f"/v1/transport/bookings/{booking_id}/expenses", headers=_auth(stranger))
    assert resp.status_code == 403
    # trip reports visible to participants only
    resp = await client.get(f"/v1/transport/bookings/{booking_id}/reports", headers=_auth(stranger))
    assert resp.status_code == 403


async def test_breakdown_and_delivery_notifications_have_valid_links(client, user_store):
    token, booking_id = await _accepted_trip(client, user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking_id}/breakdown",
        json={"note": "clutch failure on NH-60", "location": "Sinnar"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    notes = _notifications(user_store, "trip_breakdown")
    assert notes
    assert notes[0]["data"]["deepLink"] == f"/farmer/transport/{booking_id}"
    # the breakdown/exception state blocks normal movement until resolved
    resp = await client.patch(
        f"/v1/transport/bookings/{booking_id}", json={"status": "enRoute"}, headers=_auth(token)
    )
    assert resp.status_code == 409

    # a fresh trip runs to POD-backed delivery with valid notifications
    token2, booking2 = await _accepted_trip(client, user_store)
    resp = await client.patch(
        f"/v1/transport/bookings/{booking2}", json={"status": "enRoute"}, headers=_auth(token2)
    )
    assert resp.status_code == 200
    await client.patch(
        f"/v1/transport/bookings/{booking2}",
        json={"status": "delivered", "podPhotos": ["https://storage.example/pod/3.jpg"], "receiverName": "Sham"},
        headers=_auth(token2),
    )
    delivered = _notifications(user_store, "trip_delivered")
    assert delivered
    assert delivered[0]["data"]["deepLink"] == f"/farmer/transport/{booking2}"
    # rating prompts open for both parties
    assert f"users/uid-1/rating_prompts/{booking2}" in user_store


async def test_issue_report_does_not_freeze_escrow_or_trigger_refund(client, user_store):
    token, booking_id = await _accepted_trip(client, user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking_id}/reports",
        json={"kind": "damage", "note": "20 kg tomatoes crushed at the bottom layer"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    report = resp.json()
    assert "claimAmount" not in report
    assert "refund" not in str(report.get("status", "")).lower()
    # booking state untouched — trips keep their status, no payment flags appear
    booking = (await client.get(f"/v1/transport/bookings/{booking_id}", headers=_auth(token))).json()
    assert booking["status"] == "accepted"
    for forbidden in ("escrowFrozen", "refundStatus"):
        assert forbidden not in booking
