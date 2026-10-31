"""Missing-endpoint audit items for the transport module.

Direct-connect: fare payments, in-trip escrow, wallet and payouts are removed —
the farmer pays the transporter directly. This suite now covers the direct-connect
terms gates, the report/support-case lane, confirm-delivery, and the 404 surface
for the removed money endpoints.
P1-27 ratings received + aggregate + tags (spec T10)
P2-36 multi-drop stops + per-stop POD (spec F15/E16)
P2-37 mid-trip breakdown (spec E11)
P2-38 personalized load matching + fare trends (spec T3/T4/F14)
P2-39 compliance view — strikes / cooldowns / penalty matrix (spec T11)

All tests drive the real API through the httpx ASGI harness.
"""

from datetime import datetime, timedelta, timezone

from tests.test_transport import (
    POD,
    _activate,
    _add_vehicle,
    _book,
    _other_transporter_token,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth


def _seed_user(user_store, uid, profiles):
    from app.services.tokens import create_access_token

    user_store[f"users/{uid}"] = {
        "id": uid,
        "linkedProfiles": list(profiles),
        "primaryProfile": profiles[0],
        "activeProfile": profiles[0],
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    return create_access_token(uid)


LOAD_BODY = {
    "pickupLocation": "Pimpalgaon",
    "dropLocation": "Nashik APMC",
    "crop": "Onion",
    "quantityQuintals": 20,
    "packaging": "Gunny Bags",
    "perishable": False,
    "preferredVehicleType": "Tractor Trolley",
    "pickupDate": "2026-11-05",
    "targetFare": 2500,
    "termsAccepted": True,
}


async def _accepted_booking(client, user_store, **vehicle_overrides):
    """Book → activate transport → verified vehicle → accept."""
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token, **vehicle_overrides)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    return token, booking, vehicle


async def _deliver(client, token, booking_id):
    for payload in ({"status": "enRoute"}, {"status": "delivered", **POD}):
        resp = await client.patch(
            f"/v1/transport/bookings/{booking_id}", json=payload, headers=_auth(token)
        )
        assert resp.status_code == 200


# ---------------- Direct-connect: money endpoints gone, terms gates live ----------------


async def test_money_endpoints_removed_under_direct_connect(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    for method, url in (
        ("POST", f"/v1/transport/bookings/{booking['id']}/payments"),
        ("POST", f"/v1/transport/bookings/{booking['id']}/escrow/release"),
        ("GET", "/v1/transport/wallet"),
        ("POST", "/v1/transport/payouts"),
        ("GET", "/v1/transport/payouts"),
        ("GET", f"/v1/transport/bookings/{booking['id']}/commission-invoice"),
        ("GET", "/v1/transport/settlements"),
    ):
        resp = await client.request(method, url, headers=_auth(token))
        assert resp.status_code == 404, f"{method} {url} → {resp.status_code}"


async def test_post_load_requires_terms_acceptance(client, user_store):
    token = await _token(client)
    body = {k: v for k, v in LOAD_BODY.items() if k != "termsAccepted"}
    resp = await client.post("/v1/transport/loads", json=body, headers=_auth(token))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TERMS_REQUIRED"

    resp = await client.post("/v1/transport/loads", json=LOAD_BODY, headers=_auth(token))
    assert resp.status_code == 201
    load = resp.json()
    accepted = [
        d for key, d in user_store.items()
        if key.startswith("terms_acceptances/") and d.get("acceptedFor") == "load"
    ]
    assert any(d["loadId"] == load["id"] and d["userId"] == "uid-1" for d in accepted)
    assert all(d["termsVersion"] for d in accepted)


async def test_accept_bid_requires_farmer_terms_confirmation(client, user_store):
    token = await _token(client)
    load = (await client.post("/v1/transport/loads", json=LOAD_BODY, headers=_auth(token))).json()
    await _activate(client, token)
    bid = (
        await client.post(
            f"/v1/transport/loads/{load['id']}/bid",
            json={"quotedFare": 2800, "termsAccepted": True, "mpin": "1234"},
            headers=_auth(token),
        )
    ).json()

    # without the farmer's confirmation contacts stay hidden
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid",
        json={"bidId": bid["id"]},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TERMS_REQUIRED"
    stored = (await client.get(f"/v1/transport/loads/{load['id']}/bids", headers=_auth(token))).json()
    assert stored["data"][0]["status"] == "pending"

    # with confirmation → booked, contacts revealed, both parties on record
    resp = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid",
        json={"bidId": bid["id"], "termsAccepted": True, "mpin": "1234"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    reveal = resp.json()["contactReveal"]
    assert reveal["farmer"]["phoneDigits"]
    assert reveal["transporter"]["phoneDigits"]
    booking = resp.json()["booking"]
    reveals = [
        d for key, d in user_store.items()
        if key.startswith("terms_acceptances/") and d.get("acceptedFor") == "contactReveal"
    ]
    parties = {d["userId"] for d in reveals if d.get("bookingId") == booking["id"]}
    assert parties == {"uid-1"}

    # chat room exists right after acceptance (no payment needed)
    assert user_store[f"chat_rooms/{booking['id']}"]["kind"] == "transport"


async def test_confirm_delivery_is_booker_gated_and_idempotent(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    await _deliver(client, token, booking["id"])

    # not delivered yet → nothing to confirm
    other = (await _book(client, token)).json()
    resp = await client.post(
        f"/v1/transport/bookings/{other['id']}/confirm-delivery", headers=_auth(token)
    )
    assert resp.status_code == 409

    # stranger cannot confirm
    stranger = _seed_user(user_store, "uid-9", ("farmer",))
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/confirm-delivery", headers=_auth(stranger)
    )
    assert resp.status_code == 403

    # booker confirms; second call is an idempotent no-op
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/confirm-delivery", headers=_auth(token)
    )
    assert resp.status_code == 200
    first = user_store[f"transport_bookings/{booking['id']}"]["farmerConfirmedAt"]
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/confirm-delivery", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert user_store[f"transport_bookings/{booking['id']}"]["farmerConfirmedAt"] == first
    notes = [d for key, d in user_store.items() if key.startswith("notifications/")]
    assert sum(1 for n in notes if n.get("type") == "delivery_confirmed") == 1


async def test_trip_report_support_case_lane(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200

    # a non-party cannot file
    stranger = _seed_user(user_store, "uid-9", ("transport",))
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/reports",
        json={"kind": "damage", "note": "cartons crushed"},
        headers=_auth(stranger),
    )
    assert resp.status_code == 403

    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/reports",
        json={"kind": "damage", "note": "cartons crushed", "photos": ["https://x/1.jpg"]},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    report = resp.json()
    assert report["kind"] == "damage"
    assert report["status"] == "open"
    assert "claimPaisa" not in report

    # unknown kinds coerce to "other"; the other party is notified
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/reports",
        json={"kind": "whatever", "note": "late arrival"},
        headers=_auth(token),
    )
    assert resp.json()["kind"] == "other"
    notes = [d for key, d in user_store.items() if key.startswith("notifications/")]
    assert any(n.get("type") == "trip_report_opened" for n in notes)

    listed = (
        await client.get(f"/v1/transport/bookings/{booking['id']}/reports", headers=_auth(token))
    ).json()
    assert listed["total"] == 2

    # old damage-dispute lane is gone
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/damage-disputes",
        json={"photos": [], "claimPaisa": 100},
        headers=_auth(token),
    )
    assert resp.status_code == 404


# ---------------- P1-27: ratings received ----------------


async def _two_user_delivered_trip(client, user_store, stars, transporter_token, vehicle):
    """Farmer (uid-1) books; the uid-2 transporter runs and delivers the trip,
    then the farmer rates through the existing /v1/ratings write-side."""
    farmer_token = await _token(client, profiles=("farmer",), primary="farmer")
    booking = (await _book(client, farmer_token)).json()
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(transporter_token),
    )
    assert resp.status_code == 200
    for payload in ({"status": "enRoute"}, {"status": "delivered", **POD}):
        resp = await client.patch(
            f"/v1/transport/bookings/{booking['id']}",
            json=payload,
            headers=_auth(transporter_token),
        )
        assert resp.status_code == 200
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "transport", "bookingId": booking["id"], "stars": stars},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 201
    return booking


async def test_transporter_ratings_received_with_aggregate(client, user_store):
    transporter_token = _other_transporter_token(user_store)
    vehicle = await _add_vehicle(client, transporter_token)
    user_store[f"vehicles/{vehicle['id']}"]["docStatus"] = "verified"
    user_store["kyc_cases/kyc_uid-2_transport"] = {
        "caseId": "kyc_uid-2_transport",
        "userId": "uid-2",
        "persona": "transport",
        "docs": [
            {"docId": "kyc_uid-2_transport:rc", "type": "rc", "status": "verified"},
            {"docId": "kyc_uid-2_transport:dl", "type": "dl", "status": "verified"},
        ],
        "status": "verified",
    }

    await _two_user_delivered_trip(client, user_store, 5, transporter_token, vehicle)
    await _two_user_delivered_trip(client, user_store, 4, transporter_token, vehicle)

    resp = await client.get("/v1/transport/ratings", headers=_auth(transporter_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["aggregate"]["count"] == 2
    assert body["aggregate"]["average"] == 4.5
    assert {r["stars"] for r in body["data"]} == {4, 5}
    # newest first
    assert body["data"][0]["createdAt"] >= body["data"][1]["createdAt"]

    # a transporter nobody rated sees an empty aggregate
    fresh = _seed_user(user_store, "uid-7", ("transport",))
    resp = await client.get("/v1/transport/ratings", headers=_auth(fresh))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["aggregate"] == {"average": None, "count": 0, "tags": {}}


# ---------------- P2-36: multi-drop stops + per-stop POD ----------------


async def test_multi_drop_stops_and_per_stop_pod(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()

    # a non-party cannot plan stops
    other = _other_transporter_token(user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/stops",
        json={"stops": [{"label": "Mandi gate"}]},
        headers=_auth(other),
    )
    assert resp.status_code == 403

    # the booker plans a two-drop milk-run
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/stops",
        json={
            "stops": [
                {"label": "APMC gate 1", "address": "Nashik APMC", "eta": "2026-09-20T06:00:00+00:00"},
                {"label": "Cold storage"},
            ]
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    stops = resp.json()["stops"]
    assert [s["stopNo"] for s in stops] == [1, 2]
    assert all(s["status"] == "pending" for s in stops)
    assert stops[0]["address"] == "Nashik APMC"

    # accept so the fleet side can file per-stop PODs
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200

    # photos are mandatory
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/stops/1/pod",
        json={"photos": []},
        headers=_auth(token),
    )
    assert resp.status_code == 422

    # unknown stop → 404
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/stops/9/pod",
        json={"photos": ["https://storage.example/pod/s9.jpg"]},
        headers=_auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "STOP_NOT_FOUND"

    # OTP-gated stop POD (spec E16): farmer reveals the trip POD OTP
    otp_resp = await client.get(
        f"/v1/transport/bookings/{booking['id']}/pod-otp", headers=_auth(token)
    )
    assert otp_resp.status_code == 200
    otp = otp_resp.json()["otp"]
    wrong = "000000" if otp != "000000" else "000001"
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/stops/2/pod",
        json={"photos": ["https://storage.example/pod/s2.jpg"], "otp": wrong},
        headers=_auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_OTP"

    # correct OTP + photos + note → stop 2 delivered
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/stops/2/pod",
        json={
            "photos": ["https://storage.example/pod/s2.jpg"],
            "note": "handed to cold-store keeper",
            "otp": otp,
            "receiverName": "Sham Rao",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200
    stop = resp.json()["stop"]
    assert stop["status"] == "delivered"
    assert stop["pod"]["otp"] == otp
    assert stop["pod"]["receiverName"] == "Sham Rao"

    # re-delivering the same stop → 409
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/stops/2/pod",
        json={"photos": ["https://storage.example/pod/again.jpg"]},
        headers=_auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "STOP_ALREADY_DELIVERED"

    # stop 1 stays pending — partial delivery scoped per leg
    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["stops"][0]["status"] == "pending"
    assert stored["stops"][1]["status"] == "delivered"


# ---------------- P2-37: mid-trip breakdown ----------------


async def test_breakdown_parks_trip_and_notifies_without_money_movement(client, user_store):
    """Direct-connect: a breakdown parks the trip and notifies the booker for
    the re-match — no pro-rata release, refund, wallet or ledger entries."""
    token, booking, _ = await _accepted_booking(client, user_store)
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}",
        json={"status": "enRoute"},
        headers=_auth(token),
    )
    assert resp.status_code == 200

    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/breakdown",
        json={
            "note": "clutch failure on the highway",
            "location": "NH-48 km 32",
            "completedDistanceKm": 10,
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "breakdown"
    assert body["breakdown"]["reportedBy"] == "uid-1"
    assert body["breakdown"]["completedDistanceKm"] == 10
    # no money movement anywhere
    assert "escrow" not in body
    assert "proRataFarePaisa" not in body["breakdown"]
    assert not any(k.startswith("transport_wallet_ledger/") for k in user_store)
    assert not any(
        k.startswith("platform_ledger/") for k in user_store
    )

    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["status"] == "breakdown"
    assert any(w["waypoint"] == "breakdown" for w in stored["waypointsLog"])

    # booker notified for the re-match
    notes = [d for key, d in user_store.items() if key.startswith("notifications/")]
    assert any(n.get("type") == "trip_breakdown" for n in notes)


async def test_breakdown_requires_assigned_live_trip(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()

    # a transporter who does not own the trip cannot report a breakdown
    other = _other_transporter_token(user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/breakdown",
        json={"note": "engine failure"},
        headers=_auth(other),
    )
    assert resp.status_code == 403

    # a requested (not yet accepted) booking cannot break down
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/breakdown",
        json={"note": "engine failure"},
        headers=_auth(token),
    )
    assert resp.status_code == 403  # uid-1 is not the assigned transporter yet

    # no completed distance recorded → booking still parks
    token2, booking2, _ = await _accepted_booking(client, user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking2['id']}/breakdown",
        json={"note": "tyre burst", "location": "State highway 30"},
        headers=_auth(token2),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "breakdown"
    assert resp.json()["breakdown"]["completedDistanceKm"] is None

    # already broken-down trip → 409
    resp = await client.post(
        f"/v1/transport/bookings/{booking2['id']}/breakdown",
        json={"note": "second failure"},
        headers=_auth(token2),
    )
    assert resp.status_code == 409


# ---------------- P2-38: personalized load matching + fare trends ----------------


async def test_loads_matched_ranked_for_my_fleet_and_routes(client, user_store):
    token = await _token(client)  # farmer + transport dual profile
    await _activate(client, token)
    resp = await client.put(
        "/v1/transport/profile",
        json={"operatingRoutes": ["मालेगाव ➔ सूरत"], "operatingStates": ["महाराष्ट्र"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    vehicle = await _add_vehicle(
        client, token, vehicleType="Bolero Maxi", capacityTonnes=1.5, registrationNo="MH15 BB 1111"
    )
    assert vehicle["vehicleType"] == "Bolero Maxi"

    load_a = (
        await client.post(
            "/v1/transport/loads",
            json={
                "pickupLocation": "मालेगाव, नासिक",
                "dropLocation": "सूरत सरदार मार्केट",
                "crop": "हरी मिर्च",
                "quantityQuintals": 12,
                "preferredVehicleType": "Bolero Maxi",
                "pickupDate": "2026-11-20",
                "targetFare": 9500,
                "termsAccepted": True,
            },
            headers=_auth(token),
        )
    ).json()
    load_b = (
        await client.post(
            "/v1/transport/loads",
            json={
                "pickupLocation": "पिंपलगाव, नासिक",
                "dropLocation": "आज़ादपुर मंडी, दिल्ली",
                "crop": "टमाटर",
                "quantityQuintals": 5,
                "preferredVehicleType": "Tata Ace",
                "pickupDate": "2026-11-21",
                "targetFare": 38000,
                "termsAccepted": True,
            },
            headers=_auth(token),
        )
    ).json()

    resp = await client.get("/v1/transport/loads/matched", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    by_id = {load["id"]: load for load in data}
    assert by_id[load_a["id"]]["score"] > by_id[load_b["id"]]["score"]
    assert data[0]["id"] == load_a["id"]
    assert "vehicle_match" in data[0]["matchReasons"]
    assert "route_preference" in data[0]["matchReasons"]
    assert data[0]["score"] == 3


async def test_fare_trends_from_completed_bookings(client, user_store):
    token = await _token(client)
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    # two delivered Tata Ace trips: 20 km (₹1200 → 60 ₹/km) and 100 km (₹4000 → 40 ₹/km)
    expected_fares = {20: 1200, 100: 4000}
    for distance_km in (20, 100):
        booking = (await _book(client, token, distanceKm=distance_km)).json()
        assert booking["fare"] == expected_fares[distance_km]
        for payload in (
            {"status": "accepted", "vehicleId": vehicle["id"]},
            {"status": "enRoute"},
            {"status": "delivered", **POD},
        ):
            resp = await client.patch(
                f"/v1/transport/bookings/{booking['id']}",
                json=payload,
                headers=_auth(token),
            )
            assert resp.status_code == 200

    resp = await client.get(
        "/v1/transport/fare-trends",
        params={"vehicleType": "Tata Ace"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["sampleSize"] == 2
    assert body["overall"]["avgPerKmPaisa"] == 5000.0
    assert body["overall"]["minPerKmPaisa"] == 4000.0
    assert body["overall"]["maxPerKmPaisa"] == 6000.0
    assert body["bands"]["under50km"]["count"] == 1
    assert body["bands"]["under50km"]["avgPerKmPaisa"] == 6000.0
    assert body["bands"]["50to200km"]["count"] == 1
    assert body["bands"]["200to500km"]["count"] == 0

    # route filter narrows by pickup tokens; a faraway route has no samples
    resp = await client.get(
        "/v1/transport/fare-trends", params={"pickup": "Pimplas"}, headers=_auth(token)
    )
    assert resp.json()["sampleSize"] == 2
    resp = await client.get(
        "/v1/transport/fare-trends", params={"pickup": "Bangalore"}, headers=_auth(token)
    )
    assert resp.json()["sampleSize"] == 0


# ---------------- P2-39: compliance view ----------------


async def test_compliance_view_lists_strikes_cooldowns_and_penalty_matrix(client, user_store):
    token = await _token(client, profiles=("transport",), primary="transport")
    user_store["users/uid-1/strikes/str_1"] = {
        "id": "str_1",
        "surface": "chat",
        "reason": "phone_share",
        "at": "2026-10-15T08:00:00+00:00",
    }
    user_store["users/uid-1/strikes/str_2"] = {
        "id": "str_2",
        "surface": "transport",
        "reason": "no_show",
        "at": "2026-10-16T08:00:00+00:00",
    }
    user = user_store["users/uid-1"]
    user["noShowStrikes"] = 2
    user["chatMutedUntil"] = (
        datetime.now(timezone.utc) + timedelta(hours=12)
    ).isoformat()
    user["loadBoardSuspended"] = True
    user["bookingRestricted"] = False

    resp = await client.get("/v1/transport/compliance", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["userId"] == "uid-1"
    assert body["strikeCount"] == 2
    assert body["strikes"][0]["id"] == "str_2"  # newest first
    assert body["noShowStrikes"] == 2
    assert body["cooldowns"]["chatMutedUntil"] is not None
    assert body["cooldowns"]["loadBoardSuspended"] is True
    assert body["cooldowns"]["suspended"] is False

    matrix = body["penaltyMatrix"]
    assert matrix["cancelWindowHours"] == 24
    assert matrix["strikesToSuspend"] == 3
    assert matrix["farmerCancelPenaltyPct"] == 10
    assert matrix["farmerLateCancelPenaltyPct"] == 25
    assert matrix["transporterCompensationPct"] == 50
    assert matrix["transporterCancelInsideWindow"] == "no_show_strike"

    # an expired mute no longer counts as an active cooldown
    user["chatMutedUntil"] = (
        datetime.now(timezone.utc) - timedelta(hours=1)
    ).isoformat()
    resp = await client.get("/v1/transport/compliance", headers=_auth(token))
    assert resp.json()["cooldowns"]["chatMutedUntil"] is None
