"""Missing-endpoint audit coverage (P0-4, P1-5/6/7/8, P2-5/6/7).

Every test drives the real API through the ASGI client; docs are seeded into
the in-memory store only where the API itself cannot create them.
"""

import hashlib
import hmac
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.core.security import hash_mpin
from app.routers.equipment_rental import expire_pending_counters
from app.services.tokens import create_access_token
from tests.test_equipment import second_farmer_token
from tests.test_equipment_rental import (
    _booking,
    _machine,
    _notifications_for,
    _owner_token,
)
from tests.test_users import _auth

IST = timezone(timedelta(hours=5, minutes=30))
NOW = datetime.now(timezone.utc)

RZP_KEY_ID = "rzp_test_key"
RZP_KEY_SECRET = "rzp_test_secret"


@pytest.fixture
def rzp(monkeypatch):
    """Fake Razorpay keys + stubbed order/refund rails (signature check stays
    real, mirroring tests/test_orders.py)."""
    monkeypatch.setattr(settings, "razorpay_key_id", RZP_KEY_ID)
    monkeypatch.setattr(settings, "razorpay_key_secret", RZP_KEY_SECRET)

    def fake_create_order(amount_paise, receipt):
        return {
            "id": f"order_test_{receipt}",
            "amount": amount_paise,
            "currency": "INR",
            "status": "created",
        }

    async def fake_refund(payment_id, amount_paise):
        return {"id": f"rfnd_test_{payment_id}", "status": "processed", "amount": amount_paise}

    monkeypatch.setattr("app.routers.equipment_rental.create_razorpay_order", fake_create_order)
    monkeypatch.setattr("app.routers.equipment_rental.refund_razorpay_payment", fake_refund)


def _sig(order_id: str, payment_id: str) -> str:
    return hmac.new(
        RZP_KEY_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()


def _tomorrow():
    return (datetime.now(IST).date() + timedelta(days=1)).isoformat()


def _in_days(n: int) -> str:
    return (datetime.now(IST).date() + timedelta(days=n)).isoformat()


# ---------------- P0-4: security deposit collect / forfeit ----------------


async def test_security_deposit_collect_verify_and_forfeit(client, user_store, rzp):
    token = await _owner_token(client)  # uid-1, equipmentRental
    farmer = second_farmer_token(user_store)  # uid-2
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="booked", priceRupees=2000.0)

    body = {
        "amountRupees": 500,
        "razorpayOrderId": "order_dep_1",
        "razorpayPaymentId": "pay_dep_1",
        "signature": _sig("order_dep_1", "pay_dep_1"),
    }

    # only the owner collects the deposit
    resp = await client.post("/v1/equipment/bookings/eqb_1/deposit", json=body, headers=_auth(farmer))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "NOT_EQUIPMENT_OWNER"

    # bad signature -> 402, nothing stored
    bad = {**body, "razorpayPaymentId": "pay_dep_bad", "signature": "deadbeef"}
    resp = await client.post("/v1/equipment/bookings/eqb_1/deposit", json=bad, headers=_auth(token))
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "PAYMENT_VERIFICATION_FAILED"
    assert "deposit" not in user_store["equipment_bookings/eqb_1"]

    # owner collects: signature verified, deposit held on the booking
    resp = await client.post("/v1/equipment/bookings/eqb_1/deposit", json=body, headers=_auth(token))
    assert resp.status_code == 200
    deposit = resp.json()["deposit"]
    assert deposit["amountPaisa"] == 50000
    assert deposit["status"] == "held"
    assert deposit["paymentId"] == "pay_dep_1"
    assert user_store["equipment_bookings/eqb_1"]["deposit"]["status"] == "held"

    # replaying the same payment is idempotent; a new payment is blocked
    resp = await client.post("/v1/equipment/bookings/eqb_1/deposit", json=body, headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["alreadyHeld"] is True
    other = {**body, "razorpayPaymentId": "pay_dep_2", "signature": _sig("order_dep_1", "pay_dep_2")}
    resp = await client.post("/v1/equipment/bookings/eqb_1/deposit", json=other, headers=_auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DEPOSIT_ALREADY_HELD"

    # deduction cannot exceed the deposit
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/deposit/forfeit",
        json={"deductionPaisa": 60000},
        headers=_auth(token),
    )
    assert resp.status_code == 422

    # forfeit ₹200 of the ₹500 deposit -> ₹300 refunded via the PSP rail
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/deposit/forfeit",
        json={
            "deductionPaisa": 20000,
            "claimNote": "broken PTO shaft",
            "claimPhotoUrls": ["gs://b/after1.jpg"],
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200
    out = resp.json()
    assert out["deposit"]["status"] == "forfeited"
    assert out["deposit"]["deductedPaisa"] == 20000
    assert out["deposit"]["refundedPaisa"] == 30000
    assert out["refund"]["id"] == "rfnd_test_pay_dep_1"
    claim = out["claim"]
    assert claim["status"] == "resolved"
    assert claim["resolution"] == "deposit_forfeit"
    assert claim["confirmedDeductionPaisa"] == 20000
    assert claim["claimPaisa"] == 20000
    # claim persisted + mirrored on the booking
    assert user_store[f"equipment_damage_claims/{claim['id']}"]["bookingId"] == "eqb_1"
    booking = user_store["equipment_bookings/eqb_1"]
    assert booking["deposit"]["deductedPaisa"] == 20000
    assert booking["damageClaim"]["claimId"] == claim["id"]

    # farmer got the forfeit notification and can dispute via the existing flow
    assert len(_notifications_for(user_store, "uid-2", "equipment_deposit_forfeit")) == 1
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/disputes",
        json={"category": "damage deduction", "description": "PTO was already worn", "claimRupees": 200},
        headers=_auth(farmer),
    )
    assert resp.status_code == 201


async def test_deposit_forfeit_requires_held_deposit(client, user_store):
    token = await _owner_token(client)
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="booked")
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/deposit/forfeit", json={}, headers=_auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DEPOSIT_NOT_HELD"


# ---------------- P1-5: counter accept/decline + expiry ----------------


async def _countered(client, user_store, bid="eqb_1", farmer_id="uid-2"):
    token = await _owner_token(client)
    _machine(user_store, "uid-1")
    _booking(user_store, bid, "eq-9", "uid-1", status="pending", farmer_id=farmer_id)
    resp = await client.post(
        f"/v1/equipment/bookings/{bid}/counter",
        json={"revisedRateRupees": 2400, "reason": "peak season", "validityHours": 48},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    return token


async def test_counter_accept_updates_rate_and_confirms(client, user_store):
    token = await _countered(client, user_store)
    farmer = create_access_token("uid-2")
    user_store["equipment_slots/slot_eqb_1"] = {
        "id": "slot_eqb_1", "equipmentId": "eq-9", "date": _tomorrow(),
        "slotName": "6:00 AM – 10:00 AM", "status": "pending",
    }

    # only the farmer answers the counter
    resp = await client.post("/v1/equipment/bookings/eqb_1/counter/accept", headers=_auth(token))
    assert resp.status_code == 403

    resp = await client.post("/v1/equipment/bookings/eqb_1/counter/accept", headers=_auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["priceRupees"] == 2400
    assert body["counterStatus"] == "accepted"
    assert body["status"] == "booked"
    stored = user_store["equipment_bookings/eqb_1"]
    assert stored["priceRupees"] == 2400
    assert user_store["equipment_slots/slot_eqb_1"]["status"] == "booked"
    assert len(_notifications_for(user_store, "uid-1", "equipment_counter")) == 1


async def test_counter_decline_closes_booking(client, user_store):
    token = await _countered(client, user_store)
    farmer = create_access_token("uid-2")
    resp = await client.post("/v1/equipment/bookings/eqb_1/counter/decline", headers=_auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["counterStatus"] == "declined"
    assert body["status"] == "rejected"
    # a spent counter cannot be answered again
    resp = await client.post("/v1/equipment/bookings/eqb_1/counter/accept", headers=_auth(farmer))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "COUNTER_NOT_PENDING"


async def test_counter_accept_without_counter_409(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="pending")
    resp = await client.post("/v1/equipment/bookings/eqb_1/counter/accept", headers=_auth(farmer))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "COUNTER_NOT_PENDING"


async def test_expired_counter_rejected_with_409(client, user_store):
    token = await _countered(client, user_store)
    farmer = create_access_token("uid-2")
    user_store["equipment_bookings/eqb_1"]["counterExpiresAt"] = (
        NOW - timedelta(hours=1)
    ).isoformat()

    resp = await client.post("/v1/equipment/bookings/eqb_1/counter/accept", headers=_auth(farmer))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "COUNTER_EXPIRED"
    stored = user_store["equipment_bookings/eqb_1"]
    assert stored["counterStatus"] == "expired"
    assert stored["status"] == "pending"


async def test_counter_expires_lazily_on_booking_read(client, user_store):
    token = await _owner_token(client)
    _machine(user_store, "uid-1")
    _booking(
        user_store,
        "eqb_1",
        "eq-9",
        "uid-1",
        status="countered",
        counterRateRupees=2400,
        counterExpiresAt=(NOW - timedelta(minutes=5)).isoformat(),
    )
    resp = await client.get("/v1/equipment/bookings/eqb_1/execution", headers=_auth(token))
    assert resp.status_code == 200
    stored = user_store["equipment_bookings/eqb_1"]
    assert stored["counterStatus"] == "expired"
    assert stored["status"] == "pending"


async def test_expire_pending_counters_job(client, user_store):
    token = await _owner_token(client)
    _machine(user_store, "uid-1")
    _booking(
        user_store, "eqb_1", "eq-9", "uid-1", status="countered",
        counterRateRupees=2400, counterExpiresAt=(NOW - timedelta(hours=2)).isoformat(),
    )
    _booking(
        user_store, "eqb_2", "eq-9", "uid-1", status="countered", farmer_id="uid-f9",
        counterRateRupees=2500, counterExpiresAt=(NOW + timedelta(hours=10)).isoformat(),
    )
    _booking(user_store, "eqb_3", "eq-9", "uid-1", status="pending", farmer_id="uid-f9")

    result = await expire_pending_counters()
    assert result["scanned"] == 2
    assert result["expired"] == 1
    assert user_store["equipment_bookings/eqb_1"]["counterStatus"] == "expired"
    assert user_store["equipment_bookings/eqb_1"]["status"] == "pending"
    assert "counterStatus" not in user_store["equipment_bookings/eqb_2"]
    assert user_store["equipment_bookings/eqb_2"]["status"] == "countered"

    # second sweep is a no-op
    result = await expire_pending_counters()
    assert result["expired"] == 0


# ---------------- P1-6: booking-gated chat room (spec §D) ----------------


async def test_chat_room_unlocks_after_confirmation_and_esign(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="booked")

    # confirmed but contract not e-signed -> locked
    resp = await client.get("/v1/equipment/bookings/eqb_1/chat-room", headers=_auth(farmer))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CHAT_LOCKED"

    # generate + e-sign the contract
    resp = await client.post("/v1/equipment/bookings/eqb_1/contract", headers=_auth(token))
    assert resp.status_code == 201
    user_store["users/uid-2"]["mpinHash"] = hash_mpin("4321")
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/contract/esign",
        json={"mpin": "4321", "consentTimestamp": NOW.isoformat()},
        headers=_auth(farmer),
    )
    assert resp.status_code == 200

    # unlocked: lazy room creation, one room per booking
    resp = await client.get("/v1/equipment/bookings/eqb_1/chat-room", headers=_auth(farmer))
    assert resp.status_code == 200
    room = resp.json()
    assert room["kind"] == "equipment"
    assert room["bookingId"] == "eqb_1"
    assert room["farmerId"] == "uid-2"
    assert room["buyerId"] == "uid-1"
    assert "chat_rooms/eqb_1" in user_store
    # owner sees the same room (idempotent)
    resp = await client.get("/v1/equipment/bookings/eqb_1/chat-room", headers=_auth(token))
    assert resp.json()["id"] == room["id"]
    # a pending booking stays locked even with a signed contract
    _booking(user_store, "eqb_2", "eq-9", "uid-1", status="pending")
    resp = await client.get("/v1/equipment/bookings/eqb_2/chat-room", headers=_auth(farmer))
    assert resp.status_code == 409
    # stranger blocked
    user_store["users/uid-x"] = {
        "id": "uid-x", "name": "Rando", "linkedProfiles": ["farmer"], "activeProfile": "farmer",
    }
    resp = await client.get(
        "/v1/equipment/bookings/eqb_1/chat-room", headers=_auth(create_access_token("uid-x"))
    )
    assert resp.status_code == 403


# ---------------- P1-7: PSP-verified payment capture ----------------


async def test_psp_verified_payment_capture(client, user_store, rzp):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="booked", priceRupees=2000.0)

    # order for the full pending amount
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/payments/order", json={}, headers=_auth(farmer)
    )
    assert resp.status_code == 200
    order_id = resp.json()["razorpayOrderId"]
    assert order_id.startswith("order_test_")
    assert resp.json()["amountPaisa"] == 200000
    assert resp.json()["duePaisa"] == 200000

    # bad signature -> 402, ledger untouched
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/payments/verify",
        json={"razorpayOrderId": order_id, "razorpayPaymentId": "pay_bad", "signature": "nope"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "PAYMENT_VERIFICATION_FAILED"
    assert "paymentsLedger" not in user_store["equipment_bookings/eqb_1"]

    # verified capture appends to the payments ledger
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/payments/verify",
        json={
            "razorpayOrderId": order_id,
            "razorpayPaymentId": "pay_good",
            "signature": _sig(order_id, "pay_good"),
        },
        headers=_auth(farmer),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["captured"] is True
    assert body["entry"]["amountPaisa"] == 200000
    assert body["entry"]["status"] == "captured"
    assert body["paidPaisa"] == 200000
    assert body["duePaisa"] == 0
    ledger = user_store["equipment_bookings/eqb_1"]["paymentsLedger"]
    assert len(ledger) == 1
    assert ledger[0]["razorpayPaymentId"] == "pay_good"
    # owner notified of the capture
    assert len(_notifications_for(user_store, "uid-1", "equipment_payment")) == 1

    # re-verifying the same payment is idempotent
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/payments/verify",
        json={
            "razorpayOrderId": order_id,
            "razorpayPaymentId": "pay_good",
            "signature": _sig(order_id, "pay_good"),
        },
        headers=_auth(farmer),
    )
    assert resp.json()["alreadyCaptured"] is True
    assert len(user_store["equipment_bookings/eqb_1"]["paymentsLedger"]) == 1

    # unknown order / over-order rejected
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/payments/verify",
        json={
            "razorpayOrderId": "order_nope",
            "razorpayPaymentId": "pay_x",
            "signature": _sig("order_nope", "pay_x"),
        },
        headers=_auth(farmer),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PAYMENT_ORDER_NOT_FOUND"
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/payments/order", json={}, headers=_auth(farmer)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PAYMENT_EXCEEDS_DUE"


async def test_legacy_free_text_payment_route_still_works(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="booked", priceRupees=2000.0)
    resp = await client.post(
        "/v1/equipment/bookings/eqb_1/payments",
        json={"amountRupees": 800, "kind": "advance", "method": "upi"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 201
    assert resp.json()["paidRupees"] == 800


# ---------------- P1-8: admin damage-claims queue (SOP-09) ----------------


async def test_admin_damage_claims_list_with_status_filter(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    _machine(user_store, "uid-1")
    _booking(user_store, "eqb_1", "eq-9", "uid-1", status="completed")
    _booking(user_store, "eqb_2", "eq-9", "uid-1", status="completed", farmer_id="uid-f9")

    resp = await client.post(
        "/v1/equipment/owner/damage-claims",
        json={
            "bookingId": "eqb_1",
            "equipmentId": "eq-9",
            "incidentDate": "2026-10-15",
            "description": "clutch plate burnt",
            "estimatedRepairCostRupees": 3200,
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    claim_open = resp.json()
    resp = await client.post(
        "/v1/equipment/owner/damage-claims",
        json={
            "bookingId": "eqb_2",
            "equipmentId": "eq-9",
            "incidentDate": "2026-10-14",
            "description": "tyre cut",
            "estimatedRepairCostRupees": 900,
        },
        headers=_auth(token),
    )
    claim_resolved = resp.json()
    admin_headers = {
        "Authorization": "Bearer admin-token",
        "X-Audit-Reason": "photos verified against checklist",
        "X-Admin-Role": "superadmin",
    }
    resp = await client.post(
        f"/v1/equipment/owner/damage-claims/{claim_resolved['id']}/resolve",
        json={"resolution": "approved partial"},
        headers=admin_headers,
    )
    assert resp.status_code == 200

    # admin queue joins claim -> booking -> farmer
    resp = await client.get("/v1/admin/equipment/damage-claims", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    row = next(r for r in body["data"] if r["id"] == claim_open["id"])
    assert row["farmerId"] == "uid-2"
    assert row["farmerName"] == "Suresh Jadhav"
    assert row["bookingStatus"] == "completed"
    assert row["equipmentName"] == "John Deere 5050"

    # status filter + non-admin rejection
    resp = await client.get(
        "/v1/admin/equipment/damage-claims?status=open", headers=admin_headers
    )
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == claim_open["id"]
    resp = await client.get(
        "/v1/admin/equipment/damage-claims",
        headers={"Authorization": "Bearer plain-token"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ADMIN_REQUIRED"


# ---------------- P2-5: owner quotes on demand posts ----------------


async def test_owner_quotes_on_demand_post(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    resp = await client.post(
        "/v1/equipment/demand-posts",
        json={
            "machineType": "harvester", "acres": 12, "dateFrom": _tomorrow(),
            "dateTo": _in_days(5), "village": "Pimplas", "budgetPerHourRupees": 1200,
        },
        headers=_auth(farmer),
    )
    assert resp.status_code == 201
    post_id = resp.json()["id"]

    # owners only
    resp = await client.post(
        f"/v1/equipment/demand-posts/{post_id}/quotes",
        json={"rateRupees": 1100},
        headers=_auth(farmer),
    )
    assert resp.status_code == 403

    resp = await client.post(
        f"/v1/equipment/demand-posts/{post_id}/quotes",
        json={
            "rateRupees": 1100,
            "message": "with operator and fuel",
            "availableFrom": _tomorrow(),
            "availableTo": _in_days(4),
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    quote = resp.json()["quote"]
    assert quote["ownerId"] == "uid-1"
    assert quote["rateRupees"] == 1100
    assert quote["status"] == "open"

    # quote is visible on the existing demand-post read for the poster
    resp = await client.get("/v1/equipment/demand-posts", headers=_auth(farmer))
    post = next(d for d in resp.json()["data"] if d["id"] == post_id)
    assert post["quotes"][0]["rateRupees"] == 1100
    assert len(_notifications_for(user_store, "uid-2", "equipment_demand_quote")) == 1

    # re-quoting updates the owner's single quote
    resp = await client.post(
        f"/v1/equipment/demand-posts/{post_id}/quotes",
        json={"rateRupees": 1050},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["quoteCount"] == 1
    assert user_store[f"equipment_demand_posts/{post_id}"]["quotes"][0]["rateRupees"] == 1050

    # invalid window
    resp = await client.post(
        f"/v1/equipment/demand-posts/{post_id}/quotes",
        json={"rateRupees": 1000, "availableFrom": _in_days(6), "availableTo": _tomorrow()},
        headers=_auth(token),
    )
    assert resp.status_code == 422

    # closed post
    user_store[f"equipment_demand_posts/{post_id}"]["status"] = "closed"
    resp = await client.post(
        f"/v1/equipment/demand-posts/{post_id}/quotes",
        json={"rateRupees": 1000},
        headers=_auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DEMAND_NOT_OPEN"


# ---------------- P2-6: owner pricing rules ----------------


async def test_owner_pricing_rules_put(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    _machine(user_store, "uid-1")

    body = {
        "minBillingRupees": 2000,
        "travelChargePerKmRupees": 15,
        "idleChargePerHourRupees": 100,
        "blockedDates": [_tomorrow()],
        "discounts": [{"label": "off-season", "percent": 10, "validUntil": "2026-12-31"}],
    }
    resp = await client.put("/v1/equipment/eq-9/pricing-rules", json=body, headers=_auth(token))
    assert resp.status_code == 200
    rules = user_store["equipment/eq-9"]["pricingRules"]
    assert rules["minBillingRupees"] == 2000
    assert rules["travelChargePerKmRupees"] == 15
    assert rules["idleChargePerHourRupees"] == 100
    assert rules["blockedDates"] == [_tomorrow()]
    assert rules["discounts"][0]["label"] == "off-season"

    # only the owner of the machine
    resp = await client.put("/v1/equipment/eq-9/pricing-rules", json=body, headers=_auth(farmer))
    assert resp.status_code == 403
    resp = await client.put("/v1/equipment/eq-nope/pricing-rules", json=body, headers=_auth(token))
    assert resp.status_code == 404

    # validation: bad blocked date, bad discount percent, missing label
    resp = await client.put(
        "/v1/equipment/eq-9/pricing-rules",
        json={"blockedDates": ["not-a-date"]},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    resp = await client.put(
        "/v1/equipment/eq-9/pricing-rules",
        json={"discounts": [{"label": "x", "percent": 150}]},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    resp = await client.put(
        "/v1/equipment/eq-9/pricing-rules",
        json={"discounts": [{"percent": 10}]},
        headers=_auth(token),
    )
    assert resp.status_code == 422


# ---------------- P2-7: owner TDS statements ----------------


async def test_owner_tds_statements(client, user_store):
    token = await _owner_token(client)
    farmer = second_farmer_token(user_store)
    user_store["tds_ledger/tds_st_1"] = {
        "txnId": "st_1", "persona": "equipmentRental", "entityId": "uid-1",
        "grossPaisa": 500000, "tdsPaisa": 5000, "section": "194-O",
        "period": "2026-10-05..2026-10-11", "at": NOW.isoformat(),
    }
    user_store["tds_ledger/tds_st_2"] = {
        "txnId": "st_2", "persona": "equipmentRental", "entityId": "uid-other",
        "grossPaisa": 900000, "tdsPaisa": 9000, "section": "194-O",
        "period": "2026-10-05..2026-10-11", "at": NOW.isoformat(),
    }
    user_store["tds_ledger/tds_st_3"] = {
        "txnId": "st_3", "persona": "seller", "entityId": "uid-1",
        "grossPaisa": 100000, "tdsPaisa": 1000, "section": "194-O",
        "period": "2026-10-05..2026-10-11", "at": NOW.isoformat(),
    }

    resp = await client.get("/v1/equipment/owner/tds-statements", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["totalTdsPaisa"] == 5000
    assert body["tdsRate"] == 0.01
    assert body["section"] == "194-O"
    row = body["data"][0]
    assert row["txnId"] == "st_1"
    assert row["grossPaisa"] == 500000
    assert row["tdsPaisa"] == 5000
    assert row["period"] == "2026-10-05..2026-10-11"

    # farmer persona cannot read the owner surface
    resp = await client.get("/v1/equipment/owner/tds-statements", headers=_auth(farmer))
    assert resp.status_code == 403
