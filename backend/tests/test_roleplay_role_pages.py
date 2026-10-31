"""Roleplay end-to-end saga: Sita the farmer, Ramesh the transporter and the
platform ops desk walk every feature built this session in one continuous
story, so each phase reuses the state the previous one created.

Sandbox notes (the conftest maps every non-admin bearer token to uid-1, so
Sita and Ramesh are two personas of ONE account and switch active profiles):

* Driver sub-accounts and /transport/ai-insights are Pro entitlements
  (billing.py: "Free is commission-only; driver sub-accounts / route
  analytics / priority load board are Pro+") — transport_starter has NO
  features in TIER_FEATURES at all. Ramesh therefore upgrades to
  transport_pro before the driver beat, and the AI-insights beat shows the
  402 gate on the ₹99 starter tier before his Pro plan is re-applied.
* The FT-3 rate-farmer flow mirrors a doc into the shared `ratings`
  collection under the transporter's raterId. With both parties on one uid,
  the farmer's POST /v1/ratings for the same booking is rejected 409
  ALREADY_RATED by the one-rating-per-party guard (with distinct uids both
  directions return 201 — see test_transport_missing_endpoints.py). The saga
  asserts the real 409 instead of patching around it.
* POST /transport/load-templates/{id}/repeat instantiates an open LOAD
  (transport_loads), not a transport_bookings row: the fresh load shows up on
  the load board and never in GET /transport/bookings.
* Diary endpoints are farmer-persona-gated, so the diary beat flips the
  shared account back to the farmer profile.
* POST /transport/bookings/{id}/assign-driver takes {driverName,
  driverPhone} (AssignDriverRequest), not {driverId}.
"""

from datetime import datetime, timedelta, timezone

from app.services.billing import seed_plans
from tests.test_admin_extensions import (
    ADMIN_HEADERS,
    ADMIN_MUTATION_HEADERS,
    _past_iso,
)
from tests.test_transport import (
    POD,
    _activate,
    _add_vehicle,
    _book,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth

TODAY = datetime.now(timezone.utc).date().isoformat()
TOMORROW = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()

WAYPOINT_LABELS = {
    "arrivedPickup": "पिकअप स्थान पर पहुंचे",
    "loading": "लोडिंग चालू",
    "enRoute": "रास्ते में",
    "reachedDestination": "गंतव्य पर पहुंचे",
    "unloading": "अनलोडिंग चालू",
    "delivered": "डिलीवर पूर्ण",
}


async def _trip_step(client, token, booking_id, status, **extra):
    resp = await client.patch(
        f"/v1/transport/bookings/{booking_id}",
        json={"status": status, **extra},
        headers=_auth(token),
    )
    assert resp.status_code == 200, (status, resp.text)
    return resp.json()


async def test_roleplay_sita_ramesh_ops_saga(client, user_store):
    # ══════════════════════════════════════════════════════════════════
    # PHASE 1 — Sita the farmer plans her mandi dispatches
    # ══════════════════════════════════════════════════════════════════
    token = await _token(client, profiles=("farmer", "transport"), primary="farmer")

    # ── 1. Sita checks the fare estimate before booking ──
    resp = await client.post(
        "/v1/transport/fare-estimate",
        json={"vehicleType": "Tata Ace", "distanceKm": 20},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    estimate = resp.json()
    assert estimate["baseFare"] == 500
    assert estimate["distanceFare"] == 700
    assert estimate["totalFare"] == 1200
    assert estimate["breakdown"]["perKmRate"] == 35

    # ── 2. Sita raises two bookings: B1 (onion to Nashik APMC) and B2 ──
    resp = await _book(client, token)
    assert resp.status_code == 200
    b1 = resp.json()
    assert b1["status"] == "requested"
    assert b1["fare"] == 1200
    resp = await _book(client, token, pickup="Niphad")
    assert resp.status_code == 200
    b2 = resp.json()
    assert b2["status"] == "requested"
    assert b2["id"] != b1["id"]

    # ── 3. Sita saves her weekly run as a load template and repeats it ──
    template_body = {
        "name": "Weekly Nashik APMC run",
        "pickupLocation": "Pimplas",
        "dropLocation": "Nashik APMC",
        "crop": "Onion",
        "quantityQuintals": 12,
        "packaging": "Gunny Bags",
        "preferredVehicleType": "Tata Ace",
        "targetFare": 1200,
    }
    resp = await client.post(
        "/v1/transport/load-templates", json=template_body, headers=_auth(token)
    )
    assert resp.status_code == 201
    template = resp.json()
    assert template["name"] == "Weekly Nashik APMC run"

    resp = await client.get("/v1/transport/load-templates", headers=_auth(token))
    assert resp.status_code == 200
    assert any(t["id"] == template["id"] for t in resp.json()["data"])

    # Repeating the template instantiates a fresh OPEN LOAD for tomorrow.
    resp = await client.post(
        f"/v1/transport/load-templates/{template['id']}/repeat",
        json={"pickupDate": TOMORROW},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    repeated_load = resp.json()
    assert repeated_load["templateId"] == template["id"]
    assert repeated_load["pickupDate"] == TOMORROW
    assert repeated_load["status"] == "open"
    # The repeat is a load-board entry, not a booking row …
    resp = await client.get(
        "/v1/transport/loads", params={"crop": "Onion"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert any(ld["id"] == repeated_load["id"] for ld in resp.json()["data"])
    # … so it must NOT appear in her bookings list.
    resp = await client.get("/v1/transport/bookings", headers=_auth(token))
    assert all(b["id"] != repeated_load["id"] for b in resp.json()["data"])

    # ── 4. Sita's bookings list shows B1 and B2 both `requested` ──
    resp = await client.get("/v1/transport/bookings", headers=_auth(token))
    assert resp.status_code == 200
    rows = {b["id"]: b for b in resp.json()["data"]}
    assert rows[b1["id"]]["status"] == "requested"
    assert rows[b2["id"]]["status"] == "requested"

    # ══════════════════════════════════════════════════════════════════
    # PHASE 2 — Ramesh the transporter runs the trip end to end
    # (free tier = 1 vehicle; the same Tata Ace serves the whole saga)
    # ══════════════════════════════════════════════════════════════════
    await _activate(client, token, "transport")
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])

    # ── 1. Ramesh opens his booking-requests inbox and sees B1 ──
    resp = await client.get(
        "/v1/transport/bookings",
        params={"status": "requested"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    inbox = resp.json()["data"]
    assert any(b["id"] == b1["id"] for b in inbox)

    # ── 2. Negotiation: quote → counter → accept locks the fare ──
    resp = await client.post(
        f"/v1/transport/bookings/{b1['id']}/offer",
        json={"farePaise": 150000, "message": "ready to load today"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    offer1 = resp.json()
    assert offer1["fromRole"] == "transporter"
    assert offer1["round"] == 1
    assert offer1["status"] == "pending"
    assert offer1["farePaise"] == 150000

    # Back as Sita: counter at ₹1,300 (round 2).
    await _activate(client, token, "farmer")
    resp = await client.post(
        f"/v1/transport/bookings/{b1['id']}/offers/{offer1['offerId']}/counter",
        json={"farePaise": 130000, "message": "budget is tight this week"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    counter = resp.json()
    assert counter["fromRole"] == "farmer"
    assert counter["round"] == 2
    assert counter["farePaise"] == 130000

    # Back as Ramesh: his offer list shows round 1 countered and the
    # round-2 farmer counter pending his response; he accepts it.
    await _activate(client, token, "transport")
    resp = await client.get(
        f"/v1/transport/bookings/{b1['id']}/offers", headers=_auth(token)
    )
    assert resp.status_code == 200
    offers = {o["offerId"]: o for o in resp.json()["data"]}
    assert offers[offer1["offerId"]]["status"] == "countered"
    assert offers[counter["offerId"]]["status"] == "pending"
    assert offers[counter["offerId"]]["round"] == 2
    assert offers[counter["offerId"]]["fromRole"] == "farmer"

    resp = await client.post(
        f"/v1/transport/bookings/{b1['id']}/offers/{counter['offerId']}/accept",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
    stored = user_store[f"transport_bookings/{b1['id']}"]
    assert stored["status"] == "accepted"
    assert stored["farePaise"] == 130000
    assert stored["fare"] == 1300.0
    assert any(w["waypoint"] == "offer_accepted" for w in stored["waypointsLog"])

    # ── 3. Driver seat: Pro upgrade, add Kailash, assign him to B1 ──
    # Driver sub-accounts are a Pro entitlement (free tier has none), so
    # Ramesh upgrades before adding his fleet driver.
    await seed_plans()
    resp = await client.post(
        "/v1/billing/subscribe", json={"planId": "transport_pro"}, headers=_auth(token)
    )
    assert resp.status_code == 201

    resp = await client.post(
        "/v1/transport/drivers",
        json={"name": "Kailash Driver", "phone": "+919422211002"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    driver = resp.json()
    assert driver["linkedProfiles"] == ["driver"]
    assert driver["fleetOwnerId"] == "uid-1"

    # assign-driver takes {driverName, driverPhone} (AssignDriverRequest).
    resp = await client.post(
        f"/v1/transport/bookings/{b1['id']}/assign-driver",
        json={"driverName": driver["name"], "driverPhone": driver["phone"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["driverName"] == "Kailash Driver"
    assert resp.json()["driverPhone"] == "+919422211002"

    # ── 4. Trip tracker: every granular step, a GPS ping, then POD ──
    for status in ("arrivedPickup", "loading", "enRoute"):
        body = await _trip_step(client, token, b1["id"], status)
        assert body["status"] == status

    # Mid-transit GPS ping from the highway.
    resp = await client.post(
        f"/v1/transport/bookings/{b1['id']}/location",
        json={
            "lat": 20.0119,
            "lng": 73.7903,
            "speedKmH": 46.5,
            "heading": 98.0,
            "waypoint": "in_transit",
            "waypointLabel": "NH-60 highway",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["location"]["lat"] == 20.0119

    # Sita (and the driver view) reads the same ping back.
    resp = await client.get(
        f"/v1/transport/bookings/{b1['id']}/location", headers=_auth(token)
    )
    assert resp.status_code == 200
    loc = resp.json()
    assert loc["status"] == "enRoute"
    assert loc["route"] == "Pimplas ➔ Nashik APMC"
    assert loc["currentLocation"]["lat"] == 20.0119
    assert loc["currentLocation"]["speedKmH"] == 46.5
    assert isinstance(loc["waypoints"], list) and loc["waypoints"]

    for status in ("reachedDestination", "unloading"):
        await _trip_step(client, token, b1["id"], status)
    delivered = await _trip_step(client, token, b1["id"], "delivered", **POD)
    assert delivered["pod"]["receiverName"] == POD["receiverName"]

    # Every step left a labelled waypoint on the booking detail.
    resp = await client.get(
        f"/v1/transport/bookings/{b1['id']}", headers=_auth(token)
    )
    assert resp.status_code == 200
    by_waypoint = {w["waypoint"]: w["label"] for w in resp.json()["waypointsLog"]}
    for step, label in WAYPOINT_LABELS.items():
        assert by_waypoint[step] == label, step

    # ── 5. Earnings: direct-connect — wallet/escrow endpoints are gone; the
    #    receipt records the fare with a direct-settlement note ──
    resp = await client.get("/v1/transport/wallet", headers=_auth(token))
    assert resp.status_code == 404

    resp = await client.get(
        f"/v1/transport/bookings/{b1['id']}/receipt", headers=_auth(token)
    )
    assert resp.status_code == 200
    receipt = resp.json()
    assert receipt["farePaisa"] == 130000  # the negotiated counter fare
    assert "commissionPaisa" not in receipt
    assert "netPaise" not in receipt
    assert "escrowStatus" not in receipt
    assert "directly" in receipt["settlement"]

    resp = await client.get(
        f"/v1/transport/bookings/{b1['id']}/receipt.pdf", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert len(resp.content) > 0

    # ── 6. Ramesh rates Sita (two-way FT-3 rating) ──
    resp = await client.post(
        f"/v1/transport/bookings/{b1['id']}/rate-farmer",
        json={
            "rating": 5,
            "review": "crates ready at the gate",
            "tags": ["load_ready_on_time", "accurate_weight"],
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    rating_body = resp.json()
    assert rating_body["rating"]["rating"] == 5
    assert rating_body["rating"]["tags"] == ["load_ready_on_time", "accurate_weight"]
    stats = rating_body["farmerRatingStats"]
    assert stats["count"] == 1
    assert stats["average"] == 5.0
    assert stats["tags"]["load_ready_on_time"] == 1

    # ══════════════════════════════════════════════════════════════════
    # PHASE 3 — Sita shares the trip, inspects it, and wraps up
    # ══════════════════════════════════════════════════════════════════
    await _activate(client, token, "farmer")

    # ── 1. Sita shares the delivered trip with her family group ──
    resp = await client.post(
        f"/v1/transport/bookings/{b1['id']}/share", headers=_auth(token)
    )
    assert resp.status_code == 200
    share = resp.json()
    assert share["token"]
    assert share["expiresAt"]

    # An anonymous viewer (no Authorization header at all) opens the link.
    resp = await client.get(f"/v1/transport/shared/{share['token']}")
    assert resp.status_code == 200
    shared = resp.json()
    assert shared["bookingId"] == b1["id"]
    assert shared["status"] == "delivered"
    assert shared["route"] == {"pickup": "Pimplas", "drop": "Nashik APMC"}
    waypoint_names = [w["waypoint"] for w in shared["waypoints"]]
    assert "delivered" in waypoint_names
    assert "enRoute" in waypoint_names
    assert "farePaise" not in shared  # view-only share leaks no money fields

    # ── 2. Sita opens her booking detail: delivered, POD, agreed fare ──
    resp = await client.get(
        f"/v1/transport/bookings/{b1['id']}", headers=_auth(token)
    )
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["status"] == "delivered"
    assert detail["farePaise"] == 130000
    assert "pod" in detail and "photos" in detail["pod"]
    assert detail["pod"]["photos"] == POD["podPhotos"]
    assert detail["pod"]["receiverName"] == POD["receiverName"]

    # ── 3. Sita rates Ramesh back ──
    resp = await client.post(
        "/v1/ratings",
        json={
            "bookingKind": "transport",
            "bookingId": b1["id"],
            "stars": 5,
            "comment": "on time, careful driving",
        },
        headers=_auth(token),
    )
    # One rating per account per booking: Ramesh's FT-3 rate-farmer mirror
    # already wrote a `ratings` doc for this booking under the shared
    # household uid, so the collection-level guard rejects the second write.
    # With two distinct uids both directions return 201 (see
    # test_transport_missing_endpoints.py::test_transporter_ratings_received).
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_RATED"

    # Ramesh's received-ratings inbox still shows the B1 transport rating.
    await _activate(client, token, "transport")
    resp = await client.get("/v1/transport/ratings", headers=_auth(token))
    assert resp.status_code == 200
    received = resp.json()
    assert received["total"] >= 1
    assert any(r["bookingId"] == b1["id"] for r in received["data"])

    # ── 4. Sita cancels B2 (produce sold locally, no penalty on requested) ──
    await _activate(client, token, "farmer")
    resp = await client.post(
        f"/v1/transport/bookings/{b2['id']}/cancel",
        json={"reason": "produce sold locally"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert user_store[f"transport_bookings/{b2['id']}"]["cancelledBy"] == "farmer"

    # ── 5. One-tap rebook of the delivered trip for tomorrow ──
    resp = await client.post(
        f"/v1/transport/bookings/{b1['id']}/rebook",
        json={"date": TOMORROW},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    b3 = resp.json()
    assert b3["status"] == "requested"
    assert b3["rebookOf"] == b1["id"]
    assert b3["date"] == TOMORROW
    assert b3["fare"] == 1200  # catalog rates re-evaluated, no stale price

    # ══════════════════════════════════════════════════════════════════
    # PHASE 4 — the ops desk audits, configures and moderates the platform
    # ══════════════════════════════════════════════════════════════════

    # ── 1. KYC: a blurry PAN is sent back for resubmission ──
    case_id = "kyc_uid-1_farmer"
    user_store[f"kyc_cases/{case_id}"] = {
        "caseId": case_id,
        "userId": "uid-1",
        "persona": "farmer",
        "status": "pending",
        "docs": [
            {
                "docId": f"{case_id}:pan",
                "type": "pan",
                "status": "pending",
                "storagePath": "kyc/pan.pdf",
            }
        ],
        "submittedAt": _past_iso(60),
    }
    resp = await client.post(
        f"/v1/admin/kyc/{case_id}:pan/request-more",
        json={"note": "PAN photo is blurry, please re-upload"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "resubmission_requested"
    assert body["caseStatus"] == "pending"
    case = user_store[f"kyc_cases/{case_id}"]
    assert case["docs"][0]["status"] == "resubmission_requested"
    assert case["docs"][0]["reason"] == "PAN photo is blurry, please re-upload"

    # ── 2. Booking monitor: negotiation rounds, waypoints, fleet rows ──
    resp = await client.get(
        f"/v1/admin/transport/bookings/{b1['id']}", headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    monitor = resp.json()
    assert monitor["booking"]["id"] == b1["id"]
    assert monitor["booking"]["status"] == "delivered"
    assert monitor["booking"]["farePaise"] == 130000
    assert sorted(o["round"] for o in monitor["offers"]) == [1, 2]
    monitor_waypoints = [w["waypoint"] for w in monitor["waypointsLog"]]
    assert "offer_accepted" in monitor_waypoints
    assert "delivered" in monitor_waypoints
    assert monitor["lastLocation"]["lat"] == 20.0119
    assert monitor["podPhotos"] == POD["podPhotos"]
    assert monitor["parties"]["uid-1"]["name"] == "Ram Patil"

    # The ops desk sees Ramesh's fleet driver joined to his account.
    resp = await client.get("/v1/admin/transport/drivers", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    driver_row = next(
        r for r in resp.json()["data"] if r["id"] == driver["id"]
    )
    assert driver_row["transporterName"] == "Ram Patil"

    # …and the vehicle registry row carries the validity fields. The desk
    # recorded Kailash as the assigned driver and a fresh insurance date.
    user_store[f"vehicles/{vehicle['id']}"].update(
        {
            "insuranceExpiry": "2027-01-01T00:00:00+00:00",
            "rcStatus": "valid",
            "driverName": "Kailash Driver",
            "driverPhone": "+919422211002",
        }
    )
    resp = await client.get("/v1/admin/transport/vehicles", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    vehicle_row = next(
        r for r in resp.json()["data"] if r["id"] == vehicle["id"]
    )
    assert vehicle_row["insuranceExpiry"] == "2027-01-01T00:00:00+00:00"
    assert vehicle_row["rcStatus"] == "valid"
    assert vehicle_row["assignedDriverName"] == "Kailash Driver"
    assert vehicle_row["ownerName"] == "Ram Patil"

    # ── 3. Pickup exceptions: grace window + a booking stuck 2 h ──
    resp = await client.put(
        "/v1/admin/platform-config/grace-window",
        json={"pickupGraceMinutes": 30, "autoCancelEnabled": True},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get(
        "/v1/admin/platform-config/grace-window", headers=ADMIN_HEADERS
    )
    assert resp.json()["pickupGraceMinutes"] == 30
    assert resp.json()["autoCancelEnabled"] is True

    # Seed a booking stuck at `requested` with its pickup slot 2 h ago,
    # cloning the real B1 doc shape.
    stuck = {
        **user_store[f"transport_bookings/{b1['id']}"],
        "id": "stuck-1",
        "status": "requested",
        "pickupTime": _past_iso(120),
    }
    user_store["transport_bookings/stuck-1"] = stuck
    resp = await client.get("/v1/admin/exceptions/pickup", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    exceptions = resp.json()
    row = next(r for r in exceptions["data"] if r["bookingId"] == "stuck-1")
    assert row["status"] == "requested"
    assert row["minutesOverdue"] >= 119
    assert row["graceMinutes"] == 30
    assert row["autoCancelEnabled"] is True

    # ── 4. Master data: vehicle types CRUD + bulk import ──
    resp = await client.post(
        "/v1/admin/master/vehicle-types",
        json={"code": "pickup_15", "name": "Pickup 1.5T"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 201
    assert resp.json()["created"] is True

    resp = await client.get("/v1/admin/master/vehicle-types", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    entry = next(r for r in resp.json()["data"] if r["code"] == "pickup_15")
    assert entry["name"] == "Pickup 1.5T"
    assert entry["source"] == "firestore"

    resp = await client.post(
        "/v1/admin/master/vehicle-types/import",
        json={
            "rows": [
                {"code": "truck_32", "name": "Truck 3.2T"},
                {"code": "pickup_15", "name": "Pickup 1.5T XL"},
            ]
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["created"] >= 1
    assert resp.json()["updated"] >= 1

    resp = await client.put(
        "/v1/admin/master/vehicle-types/pickup_15",
        json={"name": "Pickup 1.5T Deluxe"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["entry"]["name"] == "Pickup 1.5T Deluxe"

    resp = await client.delete(
        "/v1/admin/master/vehicle-types/pickup_15", headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 200
    assert resp.json()["active"] is False
    resp = await client.get("/v1/admin/master/vehicle-types", headers=ADMIN_HEADERS)
    codes = [r["code"] for r in resp.json()["data"]]
    assert "pickup_15" not in codes

    # ── 5. Ads: Ramesh submits a campaign, the desk approves it ──
    await _activate(client, token, "transport")
    resp = await client.post(
        "/v1/ads",
        json={
            "title": "Monsoon fleet slots open",
            "headline": "Book Ramesh Logistics for kharif dispatches",
            "description": "Tata Ace fleet, Nashik district, POD on every trip",
            "bannerUrl": "https://cdn.example/banner.png",
            "budgetRupees": 2000.0,
            "dailyBudgetRupees": 200.0,
            "autoActivate": False,
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    ad = resp.json()
    assert ad["status"] == "pending_approval"

    resp = await client.get(
        "/v1/admin/ads", params={"status": "pending_approval"}, headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    assert any(r["id"] == ad["id"] for r in resp.json()["data"])

    resp = await client.post(
        f"/v1/admin/ads/{ad['id']}/approve", headers=ADMIN_MUTATION_HEADERS
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    resp = await client.get(
        f"/v1/admin/ads/{ad['id']}/analytics", headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    analytics = resp.json()
    assert analytics["impressions"] == 0
    assert analytics["clicks"] == 0
    assert analytics["remainingBudgetRupees"] == 2000.0

    resp = await client.put(
        "/v1/admin/platform-config/ads-pricing",
        json={
            "cpcPaise": 250,
            "minBudgetPaise": 75000,
            "targetingOptions": ["state", "persona"],
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get(
        "/v1/admin/platform-config/ads-pricing", headers=ADMIN_HEADERS
    )
    assert resp.json()["cpcPaise"] == 250
    assert resp.json()["minBudgetPaise"] == 75000
    assert resp.json()["targetingOptions"] == ["state", "persona"]

    # ── 6. Platform config round-trips ──
    resp = await client.get(
        "/v1/admin/platform-config/referrals", headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    assert resp.json()["referrerRewardCoins"] == 100
    resp = await client.put(
        "/v1/admin/platform-config/referrals",
        json={
            "referrerRewardCoins": 150,
            "refereeRewardCoins": 75,
            "maxReferralsPerMonth": 10,
            "enabled": False,
            "minKycTier": 1,
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get(
        "/v1/admin/platform-config/referrals", headers=ADMIN_HEADERS
    )
    assert resp.json()["referrerRewardCoins"] == 150
    assert resp.json()["enabled"] is False
    assert resp.json()["minKycTier"] == 1

    resp = await client.get("/v1/admin/platform-config/carbon", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    resp = await client.put(
        "/v1/admin/platform-config/carbon",
        json={
            "kgCo2PerTreePerYear": 25.0,
            "creditPricePaisePerKg": 90,
            "ecoCoinsPerCredit": 12,
            "payoutThresholdCredits": 20,
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/admin/platform-config/carbon", headers=ADMIN_HEADERS)
    carbon = resp.json()
    assert carbon["kgCo2PerTreePerYear"] == 25.0
    assert carbon["creditPricePaisePerKg"] == 90
    assert carbon["ecoCoinsPerCredit"] == 12
    assert carbon["payoutThresholdCredits"] == 20

    resp = await client.put(
        "/v1/admin/chatbot/intents",
        json={
            "intents": [
                {
                    "intent": "greeting",
                    "samplePhrases": ["hi", "hello"],
                    "response": "Namaste",
                    "enabled": True,
                }
            ]
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/admin/chatbot/intents", headers=ADMIN_HEADERS)
    intents_body = resp.json()
    assert intents_body["total"] == 1
    assert intents_body["intents"][0]["intent"] == "greeting"
    assert intents_body["intents"][0]["response"] == "Namaste"
    assert intents_body["intents"][0]["samplePhrases"] == ["hi", "hello"]

    resp = await client.get(
        "/v1/admin/chatbot/fallback-config", headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    resp = await client.put(
        "/v1/admin/chatbot/fallback-config",
        json={
            "fallbackMessages": ["samajh nahi aaya"],
            "escalateAfter": 2,
            "handoffMessage": "expert",
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get(
        "/v1/admin/chatbot/fallback-config", headers=ADMIN_HEADERS
    )
    assert resp.json()["fallbackMessages"] == ["samajh nahi aaya"]
    assert resp.json()["escalateAfter"] == 2
    assert resp.json()["handoffMessage"] == "expert"

    resp = await client.get(
        "/v1/admin/land-records/config", headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    resp = await client.put(
        "/v1/admin/land-records/config",
        json={
            "provider": "test",
            "apiUrl": "https://example.in",
            "apiKey": "secret123",
            "syncEnabled": True,
            "syncCron": "0 */6 * * *",
            "timeoutMs": 5000,
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get(
        "/v1/admin/land-records/config", headers=ADMIN_HEADERS
    )
    land = resp.json()
    assert land["provider"] == "test"
    assert land["apiUrl"] == "https://example.in"
    assert land["syncEnabled"] is True
    assert land["syncCron"] == "0 */6 * * *"
    assert land["timeoutMs"] == 5000
    assert "***" in land["apiKeyMasked"]
    assert "secret123" not in str(land)

    # ── 7. Money ops: subscriptions, escrow holdings, CSV reports ──
    resp = await client.get("/v1/admin/subscriptions", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    subs = resp.json()
    assert isinstance(subs["data"], list)
    assert subs["total"] >= 1
    assert any(
        (s.get("plan") or {}).get("planId") == "transport_pro" for s in subs["data"]
    )

    # A trade purchase sits held in escrow (direct-connect: transport trips
    # never carry escrow, so the holdings report is purchase-only).
    user_store["purchases/pur-held"] = {
        "id": "pur-held",
        "buyerId": "uid-1",
        "buyerName": "Ramesh Vyapari",
        "farmerName": "Sita Patil",
        "escrow": {"status": "held", "amount": 750.0, "fundedAt": _past_iso(90)},
        "createdAt": _past_iso(120),
    }
    resp = await client.get("/v1/admin/escrow/holdings", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    holdings = resp.json()
    kinds = {r["refId"]: r["kind"] for r in holdings["data"]}
    assert kinds["pur-held"] == "purchase"
    assert holdings["totals"]["byKind"]["purchase"]["amountPaise"] >= 75000
    assert holdings["totals"]["totalAmountPaise"] >= 75000

    day_from = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    day_to = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()
    resp = await client.get(
        "/v1/admin/reports/transactions",
        params={"from": day_from, "to": day_to, "format": "csv"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "kind" in resp.text  # CSV header row
    assert "transport_booking" in resp.text

    resp = await client.get(
        "/v1/admin/reports/crops",
        params={"format": "csv"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")

    # ── 8. Advisory CMS: publish + push, Sita reads it ──
    resp = await client.post(
        "/v1/admin/advisory/articles",
        json={
            "crop": "cotton",
            "region": "Nashik",
            "season": "kharif",
            "title": "Pink bollworm alert",
            "body": "Install pheromone traps this week and monitor twice a day.",
            "status": "published",
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 201
    article_id = resp.json()["article"]["articleId"]

    resp = await client.post(
        f"/v1/admin/advisory/articles/{article_id}/push",
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["notified"] >= 1  # Sita farms in Nashik district

    await _activate(client, token, "farmer")
    resp = await client.get(
        "/v1/advisory/articles", params={"crop": "cotton"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert any(a["articleId"] == article_id for a in resp.json()["data"])

    # ── 9. E-market admin: sellers board + category lifecycle ──
    resp = await client.get("/v1/admin/sellers", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json()["data"], list)

    resp = await client.post(
        "/v1/admin/marketplace/categories",
        json={"name": "Pulses"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 201
    cat = resp.json()["category"]
    assert cat["active"] is True

    resp = await client.get(
        "/v1/admin/marketplace/categories", headers=ADMIN_HEADERS
    )
    assert any(c["id"] == cat["id"] for c in resp.json()["data"])

    resp = await client.put(
        f"/v1/admin/marketplace/categories/{cat['id']}",
        json={"name": "Pulses & Lentils"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["category"]["name"] == "Pulses & Lentils"

    resp = await client.delete(
        f"/v1/admin/marketplace/categories/{cat['id']}",
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    resp = await client.get(
        "/v1/admin/marketplace/categories", headers=ADMIN_HEADERS
    )
    stored = next(c for c in resp.json()["data"] if c["id"] == cat["id"])
    assert stored["active"] is False

    # ── 10. Ramesh asks the chatbot for routing help ──
    await _activate(client, token, "transport")
    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "best route?"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["id"]
    resp = await client.get("/v1/chatbot/history", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # ══════════════════════════════════════════════════════════════════
    # PHASE 5 — Ramesh wraps up his week
    # ══════════════════════════════════════════════════════════════════

    # ── 1. His given-ratings list holds the five stars he gave Sita ──
    resp = await client.get("/v1/transport/ratings/given", headers=_auth(token))
    assert resp.status_code == 200
    given = resp.json()
    assert given["total"] >= 1
    assert any(
        r["bookingId"] == b1["id"] and r["stars"] == 5 for r in given["data"]
    )

    # ── 2. Diary: the week's diesel expense ──
    # Diary endpoints are farmer-persona-gated; the shared account flips
    # back to Sita's profile for this beat.
    await _activate(client, token, "farmer")
    resp = await client.post(
        "/v1/diary/entries",
        json={
            "title": "Diesel",
            "category": "fuel",
            "type": "expense",
            "amount": 3600,
            "quantity": 40,
            "unit": "litre",
            "tradeType": "buy",
            "date": TODAY,
            "notes": "APMC pump, trip to Nashik",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    entry = resp.json()["entry"]
    assert entry["title"] == "Diesel"
    assert entry["tradeType"] == "buy"

    resp = await client.get(
        "/v1/diary/entries", params={"q": "diesel"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert any(e["id"] == entry["id"] for e in resp.json()["data"])

    resp = await client.get(
        "/v1/diary/entries", params={"q": "nonexistent"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
    assert all(e["id"] != entry["id"] for e in resp.json()["data"])

    # ── 3. Saved items: pin the Cotton Nagpur mandi rate, then remove it ──
    resp = await client.post(
        "/v1/users/me/saved",
        json={"kind": "mandi-rate", "refId": "cotton_nagpur", "title": "Cotton Nagpur"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    resp = await client.get(
        "/v1/users/me/saved",
        params={"kind": "mandi-rate"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert any(s["refId"] == "cotton_nagpur" for s in resp.json()["data"])

    resp = await client.delete(
        "/v1/users/me/saved/mandi-rate/cotton_nagpur", headers=_auth(token)
    )
    assert resp.status_code == 204
    resp = await client.get(
        "/v1/users/me/saved",
        params={"kind": "mandi-rate"},
        headers=_auth(token),
    )
    assert all(s["refId"] != "cotton_nagpur" for s in resp.json()["data"])

    # ── 4. AI insights + plan catalog ──
    await _activate(client, token, "transport")
    await seed_plans()
    resp = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "transport_starter"},
        headers=_auth(token),
    )
    assert resp.status_code == 201

    # The ₹99 starter tier carries no routeAnalytics feature, so the AI
    # insights lane answers 402 ENTITLEMENT_EXCEEDED on it (the platform
    # reserves analytics for Pro — see billing.TIER_FEATURES).
    resp = await client.get("/v1/transport/ai-insights", headers=_auth(token))
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "ENTITLEMENT_EXCEEDED"

    # Ramesh keeps Pro for the analytics lane; insights now flow.
    resp = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "transport_pro"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    resp = await client.get("/v1/transport/ai-insights", headers=_auth(token))
    assert resp.status_code == 200
    insights = resp.json()
    assert isinstance(insights["suggestions"], list)
    assert len(insights["suggestions"]) >= 1
    assert "routeDemand" in insights
    assert "earningsTrend" in insights

    resp = await client.get(
        "/v1/billing/plans", params={"persona": "transport"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    plans = {p["planId"]: p for p in resp.json()["data"]}
    assert plans["transport_starter"]["priceMonthlyPaisa"] == 9900  # ₹99
    assert plans["transport_starter_annual"]["priceMonthlyPaisa"] == 99900  # ₹999
