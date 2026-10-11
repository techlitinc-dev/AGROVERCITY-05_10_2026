"""Call-session lifecycle: context-gated dialing, masking policy, history."""

import asyncio

from app.services.tokens import create_access_token
from tests.test_users import _auth, _register

BOOKING_CTX = {"toUserId": "uid-2", "contextType": "transport_booking", "contextId": "trb_1"}
BOOKING_DOC = {
    "id": "trb_1",
    "userId": "uid-1",
    "transporterId": "uid-2",
    "driverPhone": "+919800000010",
    "status": "accepted",
}
CALLEE = {
    "id": "uid-2",
    "linkedProfiles": ["transport"],
    "activeProfile": "transport",
    "primaryProfile": "transport",
    "name": "Sham Transporter",
    "phone": "+919800000001",
    "mpinHash": None,
    "createdAt": "2026-10-01T00:00:00+00:00",
}


async def _caller_token(client):
    resp = await _register(client)
    assert resp.status_code == 200
    return resp.json()["accessToken"]


def _seed_callee(user_store):
    user_store["users/uid-2"] = dict(CALLEE)
    user_store["transport_bookings/trb_1"] = dict(BOOKING_DOC)
    return create_access_token("uid-2")


def _seed_user(user_store, uid, **extra):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "linkedProfiles": ["farmer"],
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "mpinHash": None,
        "createdAt": "2026-10-01T00:00:00+00:00",
        **extra,
    }
    return create_access_token(uid)


def _incoming_call_notifications(user_store):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("type") == "incoming_call"
    ]


async def test_call_lifecycle_answer_then_end(client, user_store):
    caller = await _caller_token(client)
    callee = _seed_callee(user_store)

    created = await client.post("/v1/calls", json=BOOKING_CTX, headers=_auth(caller))
    assert created.status_code == 201
    body = created.json()
    call = body["call"]
    assert call["status"] == "ringing"
    assert call["callerId"] == "uid-1"
    assert call["calleeId"] == "uid-2"
    assert call["contextType"] == "transport_booking"
    assert call["callerName"] == "Ram Patil"
    assert body["dial"] == {"number": "+919800000001", "masked": False}
    assert body["caller"] == {"id": "uid-1", "name": "Ram Patil"}

    # callee pinged with the deep link to this call
    notes = _incoming_call_notifications(user_store)
    assert len(notes) == 1
    assert notes[0]["userId"] == "uid-2"
    assert notes[0]["data"]["deepLink"] == f"/calls/{call['id']}"

    # only the callee answers
    wrong = await client.post(f"/v1/calls/{call['id']}/answer", headers=_auth(caller))
    assert wrong.status_code == 403
    answered = await client.post(f"/v1/calls/{call['id']}/answer", headers=_auth(callee))
    assert answered.status_code == 200
    assert answered.json()["call"]["status"] == "ongoing"
    assert answered.json()["call"]["answeredAt"]

    await asyncio.sleep(1.1)  # ensure a non-zero talk duration
    ended = await client.post(f"/v1/calls/{call['id']}/end", headers=_auth(caller))
    assert ended.status_code == 200
    assert ended.json()["call"]["status"] == "ended"
    assert ended.json()["call"]["durationSec"] > 0
    assert ended.json()["call"]["endedAt"]

    again = await client.post(f"/v1/calls/{call['id']}/end", headers=_auth(caller))
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "CALL_ALREADY_ENDED"


async def test_decline_caller_cancel_and_stranger_guard(client, user_store):
    caller = await _caller_token(client)
    callee = _seed_callee(user_store)
    stranger = _seed_user(user_store, "uid-3")

    # callee declines a ringing call
    first = (await client.post("/v1/calls", json=BOOKING_CTX, headers=_auth(caller))).json()["call"]
    declined = await client.post(f"/v1/calls/{first['id']}/decline", headers=_auth(callee))
    assert declined.status_code == 200
    assert declined.json()["call"]["status"] == "declined"
    assert declined.json()["call"]["endedAt"]
    redecline = await client.post(f"/v1/calls/{first['id']}/decline", headers=_auth(callee))
    assert redecline.status_code == 409
    assert redecline.json()["error"]["code"] == "CALL_NOT_RINGING"

    # caller cancels while still ringing
    second = (await client.post("/v1/calls", json=BOOKING_CTX, headers=_auth(caller))).json()["call"]
    cancelled = await client.post(f"/v1/calls/{second['id']}/end", headers=_auth(caller))
    assert cancelled.status_code == 200
    assert cancelled.json()["call"]["status"] == "cancelled"

    # callee ending an unanswered ring counts as a decline
    third = (await client.post("/v1/calls", json=BOOKING_CTX, headers=_auth(caller))).json()["call"]
    callee_ended = await client.post(f"/v1/calls/{third['id']}/end", headers=_auth(callee))
    assert callee_ended.status_code == 200
    assert callee_ended.json()["call"]["status"] == "declined"

    # a non-participant cannot touch the call
    fourth = (await client.post("/v1/calls", json=BOOKING_CTX, headers=_auth(caller))).json()["call"]
    denied = await client.post(f"/v1/calls/{fourth['id']}/end", headers=_auth(stranger))
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "CALL_FORBIDDEN"
    denied_answer = await client.post(f"/v1/calls/{fourth['id']}/answer", headers=_auth(stranger))
    assert denied_answer.status_code == 403


async def test_context_validation_errors(client, user_store):
    caller = await _caller_token(client)
    _seed_callee(user_store)

    # missing context doc
    missing = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-2", "contextType": "purchase", "contextId": "pur_missing"},
        headers=_auth(caller),
    )
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "CONTEXT_NOT_FOUND"

    # context exists but caller is not a party
    user_store["purchases/pur_1"] = {"id": "pur_1", "buyerId": "uid-9", "farmerId": "uid-10"}
    outsider = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-2", "contextType": "purchase", "contextId": "pur_1"},
        headers=_auth(caller),
    )
    assert outsider.status_code == 403
    assert outsider.json()["error"]["code"] == "CALL_FORBIDDEN"

    # offer context: maker or target owner only
    user_store["offers/off_1"] = {"id": "off_1", "fromId": "uid-1", "toId": "uid-7"}
    offer_call = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-2", "contextType": "offer", "contextId": "off_1"},
        headers=_auth(caller),
    )
    assert offer_call.status_code == 201

    # unknown callee
    no_callee = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-nope", "contextType": "transport_booking", "contextId": "trb_1"},
        headers=_auth(caller),
    )
    assert no_callee.status_code == 404
    assert no_callee.json()["error"]["code"] == "USER_NOT_FOUND"

    # calling yourself
    self_call = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-1", "contextType": "transport_booking", "contextId": "trb_1"},
        headers=_auth(caller),
    )
    assert self_call.status_code == 422
    assert self_call.json()["error"]["code"] == "SELF_CALL_FORBIDDEN"

    # future collections (other modules own them) -> 404 until they land
    for context_type, context_id in (
        ("resale_listing", "res_1"),
        ("quote", "q_1"),
        ("export_order", "eo_1"),
    ):
        resp = await client.post(
            "/v1/calls",
            json={"toUserId": "uid-2", "contextType": context_type, "contextId": context_id},
            headers=_auth(caller),
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "CONTEXT_NOT_FOUND"

    # booking driver (matched by phone) may call through the booking context
    driver = _seed_user(user_store, "uid-driver", phone="+919800000010")
    driver_call = await client.post("/v1/calls", json=BOOKING_CTX, headers=_auth(driver))
    assert driver_call.status_code == 201


async def test_vehicle_context_masking_policy(client, user_store):
    caller = await _caller_token(client)
    _seed_callee(user_store)
    user_store["vehicles/veh_1"] = {
        "id": "veh_1",
        "ownerId": "uid-2",
        "vehicleType": "Tata Ace",
        "registrationNo": "MH15 AB 1234",
    }

    # default (no platform_config doc): direct dialing with the real number
    direct = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-2", "contextType": "vehicle", "contextId": "veh_1"},
        headers=_auth(caller),
    )
    assert direct.status_code == 201
    assert direct.json()["dial"] == {"number": "+919800000001", "masked": False}
    assert "proxyNumber" not in direct.json()["call"]

    # proxy mode: dialer gets a pooled proxy number, the doc records it
    user_store["platform_config/call_masking"] = {
        "mode": "proxy",
        "proxyNumbers": ["+919999000001"],
    }
    proxied = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-2", "contextType": "vehicle", "contextId": "veh_1"},
        headers=_auth(caller),
    )
    assert proxied.status_code == 201
    assert proxied.json()["dial"] == {"number": "+919999000001", "masked": True}
    proxied_call = proxied.json()["call"]
    assert user_store[f"calls/{proxied_call['id']}"]["proxyNumber"] == "+919999000001"

    # the callee must own the vehicle being called about
    vehicle_ctx = {"contextType": "vehicle", "contextId": "veh_1"}
    not_owner = await client.post(
        "/v1/calls", json={"toUserId": "uid-1", **vehicle_ctx}, headers=_auth(create_access_token("uid-2"))
    )
    assert not_owner.status_code == 403
    assert not_owner.json()["error"]["code"] == "CALL_FORBIDDEN"

    # a callee without a phone on file cannot be dialed
    _seed_user(user_store, "uid-4")
    user_store["vehicles/veh_2"] = {"id": "veh_2", "ownerId": "uid-4"}
    no_phone = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-4", "contextType": "vehicle", "contextId": "veh_2"},
        headers=_auth(caller),
    )
    assert no_phone.status_code == 422
    assert no_phone.json()["error"]["code"] == "CALLEE_PHONE_UNAVAILABLE"

    missing_vehicle = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-2", "contextType": "vehicle", "contextId": "veh_nope"},
        headers=_auth(caller),
    )
    assert missing_vehicle.status_code == 404
    assert missing_vehicle.json()["error"]["code"] == "CONTEXT_NOT_FOUND"


async def test_call_history_and_participant_reads(client, user_store):
    caller = await _caller_token(client)
    callee = _seed_callee(user_store)

    for _ in range(2):
        created = await client.post("/v1/calls", json=BOOKING_CTX, headers=_auth(caller))
        assert created.status_code == 201

    outgoing = await client.get(
        "/v1/calls", params={"direction": "outgoing"}, headers=_auth(caller)
    )
    assert outgoing.status_code == 200
    body = outgoing.json()
    assert body["total"] == 2
    assert body["page"] == 1 and body["pageSize"] == 20
    assert all(c["direction"] == "outgoing" for c in body["data"])

    incoming = await client.get(
        "/v1/calls", params={"direction": "incoming"}, headers=_auth(callee)
    )
    assert incoming.json()["total"] == 2
    assert all(c["direction"] == "incoming" for c in incoming.json()["data"])

    # context filter narrows the list
    filtered = await client.get(
        "/v1/calls", params={"contextType": "vehicle"}, headers=_auth(caller)
    )
    assert filtered.json()["total"] == 0

    # single-call read is participant-gated
    call_id = body["data"][0]["id"]
    as_callee = await client.get(f"/v1/calls/{call_id}", headers=_auth(callee))
    assert as_callee.status_code == 200
    assert as_callee.json()["direction"] == "incoming"

    stranger = _seed_user(user_store, "uid-3")
    denied = await client.get(f"/v1/calls/{call_id}", headers=_auth(stranger))
    assert denied.status_code == 403

    missing = await client.get("/v1/calls/cal_nope", headers=_auth(caller))
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "CALL_NOT_FOUND"
