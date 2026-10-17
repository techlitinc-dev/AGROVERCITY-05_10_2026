"""Missing-endpoint audit items for the transport module.

P0-1  fare payments + in-trip escrow + wallet + payouts (spec F10/S4/T9)
P1-27 ratings received + aggregate + tags (spec T10)
P2-36 multi-drop stops + per-stop POD (spec F15/E16)
P2-37 mid-trip breakdown + pro-rata settlement (spec E11)
P2-38 personalized load matching + fare trends (spec T3/T4/F14)
P2-39 compliance view — strikes / cooldowns / penalty matrix (spec T11)

All tests drive the real API through the httpx ASGI harness.
"""

import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.routers import transport as transport_router
from app.services.tokens import create_access_token
from tests.test_transport import (
    BOOKING_BODY,
    POD,
    _activate,
    _add_vehicle,
    _book,
    _other_transporter_token,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth

RZP_SECRET = "rzp_test_secret"


def _sign(order_id: str, payment_id: str) -> str:
    return hmac.new(
        RZP_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()


def _seed_user(user_store, uid, profiles):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "linkedProfiles": list(profiles),
        "primaryProfile": profiles[0],
        "activeProfile": profiles[0],
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    return create_access_token(uid)


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


async def _pay_fare(client, token, booking_id, monkeypatch, payment_id="pay_test_1"):
    """Create the fare order, then verify the capture (real API, test keys)."""
    order_resp = await client.post(
        f"/v1/transport/bookings/{booking_id}/payments", json={}, headers=_auth(token)
    )
    assert order_resp.status_code == 200
    order = order_resp.json()
    verify_resp = await client.post(
        f"/v1/transport/bookings/{booking_id}/payments",
        json={
            "razorpayOrderId": order["orderId"],
            "razorpayPaymentId": payment_id,
            "razorpaySignature": _sign(order["orderId"], payment_id),
        },
        headers=_auth(token),
    )
    assert verify_resp.status_code == 200
    return order, verify_resp.json()


async def _deliver(client, token, booking_id):
    for payload in ({"status": "enRoute"}, {"status": "delivered", **POD}):
        resp = await client.patch(
            f"/v1/transport/bookings/{booking_id}", json=payload, headers=_auth(token)
        )
        assert resp.status_code == 200


# ---------------- P0-1: fare payment & escrow ----------------


async def test_fare_payment_order_and_verify_funds_escrow(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_key_secret", RZP_SECRET)
    token = await _token(client)
    booking = (await _book(client, token)).json()
    fare_paisa = booking["fare"] * 100

    # only the booker can pay
    stranger = _seed_user(user_store, "uid-9", ("farmer",))
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/payments", json={}, headers=_auth(stranger)
    )
    assert resp.status_code == 403

    # order creation → orderId for the full fare
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/payments", json={}, headers=_auth(token)
    )
    assert resp.status_code == 200
    order = resp.json()
    assert order["orderId"].startswith("order_dev_")
    assert order["amountPaisa"] == fare_paisa
    assert order["status"] == "created"

    # bad signature → 400
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/payments",
        json={
            "razorpayOrderId": order["orderId"],
            "razorpayPaymentId": "pay_bad",
            "razorpaySignature": "bogus",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "PAYMENT_SIGNATURE_INVALID"

    # mismatched order → 400
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/payments",
        json={
            "razorpayOrderId": "order_dev_someone_else",
            "razorpayPaymentId": "pay_bad",
            "razorpaySignature": "bogus",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "ORDER_MISMATCH"

    # good signature → captured, escrow held
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/payments",
        json={
            "razorpayOrderId": order["orderId"],
            "razorpayPaymentId": "pay_ok",
            "razorpaySignature": _sign(order["orderId"], "pay_ok"),
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    payment = body["payment"]
    assert payment["amountPaisa"] == fare_paisa
    assert payment["razorpayOrderId"] == order["orderId"]
    assert payment["razorpayPaymentId"] == "pay_ok"
    assert payment["status"] == "captured"
    assert body["escrow"]["status"] == "held"
    assert body["escrow"]["amountPaisa"] == fare_paisa
    assert body["escrow"]["releaseAt"]
    assert body["escrow"]["disputeWindowHours"] == settings.escrow_dispute_window_hours

    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["payments"][0]["status"] == "captured"

    # re-verifying the same payment is an idempotent no-op
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/payments",
        json={
            "razorpayOrderId": order["orderId"],
            "razorpayPaymentId": "pay_ok",
            "razorpaySignature": _sign(order["orderId"], "pay_ok"),
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["duplicate"] is True
    assert user_store[f"transport_bookings/{booking['id']}"]["escrow"]["amountPaisa"] == fare_paisa


async def test_fare_payment_rejected_on_terminal_bookings(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_key_secret", RZP_SECRET)
    token = await _token(client)
    booking = (await _book(client, token)).json()
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/cancel",
        json={"reason": "plans changed"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/payments", json={}, headers=_auth(token)
    )
    assert resp.status_code == 409


async def test_escrow_release_on_delivery_credits_wallet_and_ledger(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_key_secret", RZP_SECRET)
    token, booking, _ = await _accepted_booking(client, user_store)
    await _pay_fare(client, token, booking["id"], monkeypatch)
    amount_paisa = booking["fare"] * 100
    commission = int(round(amount_paisa * 0.10))

    # window still open and trip not delivered → release blocked
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/escrow/release", headers=_auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ESCROW_NOT_DUE"

    # unpaid booking → not held
    other_booking = (await _book(client, token)).json()
    resp = await client.post(
        f"/v1/transport/bookings/{other_booking['id']}/escrow/release", headers=_auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ESCROW_NOT_HELD"

    # non-party cannot release
    stranger = _seed_user(user_store, "uid-9", ("transport",))
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/escrow/release", headers=_auth(stranger)
    )
    assert resp.status_code == 403

    await _deliver(client, token, booking["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/escrow/release", headers=_auth(token)
    )
    assert resp.status_code == 200
    escrow = resp.json()["escrow"]
    assert escrow["status"] == "released"
    assert escrow["releasedAt"]
    assert escrow["commissionPaisa"] == commission
    assert escrow["netReleasePaisa"] == amount_paisa - commission

    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["escrow"]["status"] == "released"

    # settlement/ledger entries written
    ledger = user_store[f"platform_ledger/escrow_rel_{booking['id']}"]
    assert ledger["kind"] == "transport_escrow_release"
    assert ledger["amountPaisa"] == amount_paisa - commission
    wallet_entries = [
        d for key, d in user_store.items() if key.startswith("transport_wallet_ledger/")
    ]
    assert len(wallet_entries) == 1
    assert wallet_entries[0]["kind"] == "credit"
    assert wallet_entries[0]["amountPaisa"] == amount_paisa - commission

    # wallet read: balance + TDS 194-O summary
    resp = await client.get("/v1/transport/wallet", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["balancePaisa"] == amount_paisa - commission
    assert body["tds"]["tdsDeductedPaisa"] == int(round(amount_paisa * 0.01))
    assert body["tds"]["tdsRatePct"] == 1.0
    assert body["entryCount"] == 1


async def test_release_booking_escrow_module_helper_is_clock_gated(client, user_store, monkeypatch):
    """The nightly-job import: releases only when held, unpaused and due."""
    monkeypatch.setattr(settings, "razorpay_key_secret", RZP_SECRET)
    token, booking, _ = await _accepted_booking(client, user_store)
    await _pay_fare(client, token, booking["id"], monkeypatch)
    amount_paisa = booking["fare"] * 100

    # not due yet → untouched
    stored = user_store[f"transport_bookings/{booking['id']}"]
    result = await transport_router.release_booking_escrow(stored)
    assert result["escrow"]["status"] == "held"

    # dispute inside the window pauses the release
    stored["escrow"]["disputeOpenedAt"] = datetime.now(timezone.utc).isoformat()
    result = await transport_router.release_booking_escrow(stored)
    assert result["escrow"]["status"] == "held"

    # window closed silently → released with settlement entries
    stored["escrow"]["disputeOpenedAt"] = None
    stored["escrow"]["disputeResolvedAt"] = datetime.now(timezone.utc).isoformat()
    stored["escrow"]["releaseAt"] = (
        datetime.now(timezone.utc) - timedelta(hours=1)
    ).isoformat()
    result = await transport_router.release_booking_escrow(stored)
    assert result["escrow"]["status"] == "released"
    assert result["escrow"]["netReleasePaisa"] == amount_paisa - int(round(amount_paisa * 0.10))
    assert user_store[f"transport_bookings/{booking['id']}"]["escrow"]["status"] == "released"
    wallet_entries = [
        d for key, d in user_store.items() if key.startswith("transport_wallet_ledger/")
    ]
    assert len(wallet_entries) == 1


async def test_wallet_payout_is_mpin_gated(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_key_secret", RZP_SECRET)
    token, booking, _ = await _accepted_booking(client, user_store)
    await _pay_fare(client, token, booking["id"], monkeypatch)
    await _deliver(client, token, booking["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/escrow/release", headers=_auth(token)
    )
    assert resp.status_code == 200
    balance = booking["fare"] * 100 - int(round(booking["fare"] * 100 * 0.10))

    # a user without an MPIN gets 409 (registered users default to mpin "1234")
    no_mpin = _seed_user(user_store, "uid-9", ("transport",))
    resp = await client.post(
        "/v1/transport/payouts", json={"mpin": "4567"}, headers=_auth(no_mpin)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "MPIN_NOT_SET"

    # wrong MPIN → 401 (registration set mpin "1234")
    resp = await client.post(
        "/v1/transport/payouts", json={"mpin": "0000"}, headers=_auth(token)
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"

    # no verified bank account → 422
    resp = await client.post(
        "/v1/transport/payouts", json={"mpin": "1234"}, headers=_auth(token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "NO_VERIFIED_BANK_ACCOUNT"

    user_store["users/uid-1/bank_accounts/ba_1"] = {
        "id": "ba_1",
        "verifyStatus": "verified",
        "isPrimary": True,
        "razorpayFundAccountId": "fa_test_1",
        "createdAt": "2026-09-01T00:00:00+00:00",
    }

    # over-balance request → 422
    resp = await client.post(
        "/v1/transport/payouts",
        json={"mpin": "1234", "amountPaisa": balance + 100},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INSUFFICIENT_BALANCE"

    calls = []

    async def fake_payout(fund_account_id, amount_paise, reference_id):
        calls.append((fund_account_id, amount_paise, reference_id))
        return {"id": "po_test_1", "status": "processed"}

    monkeypatch.setattr("app.routers.transport.create_razorpayx_payout", fake_payout)

    # full-balance payout → processed, wallet drained
    resp = await client.post(
        "/v1/transport/payouts", json={"mpin": "1234"}, headers=_auth(token)
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["amountPaisa"] == balance
    assert body["status"] == "processed"
    assert body["razorpayPayoutId"] == "po_test_1"
    assert calls[0][0] == "fa_test_1"
    assert calls[0][1] == balance

    payouts = [d for key, d in user_store.items() if key.startswith("transport_payouts/")]
    assert len(payouts) == 1
    assert payouts[0]["userId"] == "uid-1"

    resp = await client.get("/v1/transport/wallet", headers=_auth(token))
    assert resp.json()["balancePaisa"] == 0
    kinds = [e["kind"] for e in resp.json()["entries"]]
    assert kinds.count("credit") == 1
    assert kinds.count("debit") == 1


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


async def test_breakdown_settles_escrow_pro_rata_and_notifies(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_key_secret", RZP_SECRET)
    token, booking, _ = await _accepted_booking(client, user_store)
    await _pay_fare(client, token, booking["id"], monkeypatch)
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}",
        json={"status": "enRoute"},
        headers=_auth(token),
    )
    assert resp.status_code == 200

    # half the distance covered before the breakdown
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
    fare_paisa = booking["fare"] * 100
    assert body["breakdown"]["proRataFarePaisa"] == fare_paisa // 2
    assert body["breakdown"]["refundPaisa"] == fare_paisa // 2
    assert body["breakdown"]["reportedBy"] == "uid-1"

    # escrow split: pro-rata net released, remainder refunded to the booker
    escrow = body["escrow"]
    assert escrow["status"] == "released"
    pro_rata = fare_paisa // 2
    commission = int(round(pro_rata * 0.10))
    assert escrow["commissionPaisa"] == commission
    assert escrow["netReleasePaisa"] == pro_rata - commission
    assert escrow["breakdownRefundPaisa"] == pro_rata
    refund = body["breakdown"]["refund"]
    assert refund["amountPaisa"] == pro_rata
    assert refund["razorpayRefundId"].startswith("rfnd_dev_")

    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["status"] == "breakdown"
    assert any(w["waypoint"] == "breakdown" for w in stored["waypointsLog"])
    ledger = user_store[f"platform_ledger/brk_{booking['id']}"]
    assert ledger["kind"] == "transport_breakdown_prorata"
    assert ledger["refundPaisa"] == pro_rata
    wallet_entries = [
        d for key, d in user_store.items() if key.startswith("transport_wallet_ledger/")
    ]
    assert len(wallet_entries) == 1
    assert wallet_entries[0]["amountPaisa"] == pro_rata - commission

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

    # no completed distance → pro-rata stays zero, booking still parks
    token2, booking2, _ = await _accepted_booking(client, user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking2['id']}/breakdown",
        json={"note": "tyre burst", "location": "State highway 30"},
        headers=_auth(token2),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "breakdown"
    assert resp.json()["breakdown"]["proRataFarePaisa"] == 0

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
                "quantityQuintals": 22,
                "preferredVehicleType": "Bolero Maxi",
                "pickupDate": "2026-10-20",
                "targetFare": 9500,
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
                "quantityQuintals": 35,
                "preferredVehicleType": "Tata Ace",
                "pickupDate": "2026-10-21",
                "targetFare": 38000,
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
