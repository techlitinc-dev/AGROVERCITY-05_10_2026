import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.direct import AdvanceIn, CancelIn, PickupIn, PurchaseCreate
from app.services import settlements as settlements_service
from app.services.chat import ensure_chat_room
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(prefix="/purchases", tags=["purchases"])

TERMINAL_STATUSES = ("completed", "cancelled")

# Spec C5 commission engine — config-driven via platform_config/settlements
# (sellerPct / sellerMinRupees; see commission_for below). Defaults: 2% min ₹50,
# 0% farmer side (seasonal promos configurable).
# Spec F11 — handover OTP: 6-digit, single-use, 15-minute validity.
HANDOVER_OTP_VALID_MINUTES = 15
HANDOVER_OTP_MAX_ATTEMPTS = 5

STATUS_TRANSITIONS: dict[str, set[str]] = {
    "confirmed": {"advancePaid", "cancelled"},
    "advancePaid": {"pickupScheduled", "cancelled"},
    "pickupScheduled": {"inTransit", "cancelled"},
    "inTransit": {"delivered"},
    "delivered": {"completed", "qcDisputed"},
    "qcDisputed": {"completed"},
    "completed": set(),
    "cancelled": set(),
}


# features/Vyapari.md: new Vyaparis get a probation tier — max 3 bookings and a
# ₹50,000 cumulative escrow cap until the Verified trust tier is earned.
PROBATION_BOOKING_CAP = 3
PROBATION_ESCROW_CAP_RUPEES = 50000


async def probation_gate_booking(buyer_id: str):
    user = await get_user(buyer_id)
    if user is None or user.get("vyapariVerified"):
        return
    if "seller" not in (user.get("linkedProfiles") or []):
        return  # probation applies to vyapari buyers only
    purchases = await query("purchases", [("buyerId", "==", buyer_id)], limit=1000)
    bookings = [p for p in purchases if p.get("status") != "cancelled"]
    if len(bookings) >= PROBATION_BOOKING_CAP:
        _error(
            403,
            "PROBATION_BOOKING_CAP",
            f"new vyaparis are limited to {PROBATION_BOOKING_CAP} bookings until the Verified tier is earned",
        )


async def probation_gate_escrow(buyer_id: str, purchase_id: str, amount: int):
    user = await get_user(buyer_id)
    if user is None or user.get("vyapariVerified"):
        return
    if "seller" not in (user.get("linkedProfiles") or []):
        return
    purchases = await query("purchases", [("buyerId", "==", buyer_id)], limit=1000)
    funded = sum(
        int((p.get("escrow") or {}).get("amount", 0) or 0)
        for p in purchases
        if p.get("id") != purchase_id and p.get("status") != "cancelled"
    )
    if funded + int(amount) > PROBATION_ESCROW_CAP_RUPEES:
        _error(
            403,
            "PROBATION_ESCROW_CAP",
            f"new vyaparis are capped at ₹{PROBATION_ESCROW_CAP_RUPEES:,} cumulative escrow"
            " until the Verified tier is earned",
        )


# features/Vyapari.md: 3 completed bookings earn the "Verified Vyapari" tier.
VERIFIED_TIER_MIN_COMPLETED = 3


async def maybe_award_vyapari_verified(buyer_id: str):
    """Flip the trust tier once the probation requirements are met — the badge
    surfaces to farmers and the probation caps stop applying."""
    user = await get_user(buyer_id)
    if user is None or user.get("vyapariVerified"):
        return
    if "seller" not in (user.get("linkedProfiles") or []):
        return
    purchases = await query("purchases", [("buyerId", "==", buyer_id)], limit=1000)
    completed = [p for p in purchases if p.get("status") == "completed"]
    if len(completed) >= VERIFIED_TIER_MIN_COMPLETED:
        user["vyapariVerified"] = True
        user["vyapariVerifiedAt"] = _now()
        await set_doc("users", buyer_id, user)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_event(purchase: dict, status: str, note: str = ""):
    events = purchase.setdefault("events", [])
    events.append({"status": status, "at": _now(), "note": note})


def _issue_invoice(purchase: dict, demand: dict | None = None):
    ym = datetime.now(timezone.utc).strftime("%y%m")
    trade_amount = purchase.get("finalAmount") or purchase.get("totalAmount") or 0
    lines = [
        {
            "description": f"{purchase.get('crop', 'Item')} trade",
            "amount": trade_amount,
        }
    ]
    source = purchase.get("source") or {}
    if isinstance(source, dict) and source.get("type") == "dairy":
        cat = (
            purchase.get("category")
            or (demand.get("category") if demand else None)
            or source.get("category")
            or ("milk" if (purchase.get("crop") or "").lower() == "milk" else "milk")
        ).lower()
        if "produce" in cat:
            pct = 5
        elif "livestock" in cat:
            pct = 2
        else:
            pct = 3  # milk
        commission_paisa = (trade_amount * pct) // 100
        comm_line = {
            "type": "commission",
            "description": f"Marketplace commission ({cat} {pct}%)",
            "category": cat,
            "ratePercent": pct,
            "amount": commission_paisa,
            "commissionPaisa": commission_paisa,
        }
        lines.append(comm_line)
        purchase["commissionLine"] = comm_line
        purchase["commissionAmount"] = commission_paisa

    purchase["invoice"] = {
        "number": f"INV-{purchase['id'][-8:].upper()}-{ym}",
        "issuedAt": _now(),
        "lines": lines,
        "totalAmount": trade_amount,
    }


def _paid_total(purchase: dict) -> int:
    return sum(p.get("amount", 0) for p in purchase.get("payments") or [])


def _amount_due(purchase: dict) -> int:
    billable = purchase.get("finalAmount") or purchase.get("totalAmount") or 0
    return billable - _paid_total(purchase)


async def commission_for(amount: int) -> int:
    """Spec C5 — commission on the settled amount (vyapari side), config-driven
    from platform_config/settlements (default 2% min ₹50; WS-03 step 8)."""
    if amount <= 0:
        return 0
    config = await settlements_service._config()
    pct = float(config.get("sellerPct", 2))
    floor = int(config.get("sellerMinRupees", 50))
    return max(floor, round(amount * pct / 100))


async def _release_escrow(purchase: dict):
    """Release held escrow at settlement (spec C4): minus commission.

    WS-03 release clock: once handover starts the clock (`releaseAt`), the
    release waits for the dispute window to close silently; a dispute opened
    inside the window pauses the release until it is resolved."""
    escrow = purchase.get("escrow") or {}
    if escrow.get("status") != "held":
        return
    if escrow.get("disputeOpenedAt") and not escrow.get("disputeResolvedAt"):
        return
    release_at = escrow.get("releaseAt")
    if release_at:
        try:
            if datetime.now(timezone.utc) < datetime.fromisoformat(release_at):
                return
        except ValueError:
            pass
    final = purchase.get("finalAmount") or purchase.get("totalAmount") or 0
    commission = await commission_for(final)
    escrow.update(
        status="released",
        releasedAt=_now(),
        commission=commission,
        netRelease=final - commission,
    )
    _append_event(purchase, "escrowReleased", f"commission {commission}")


def _refund_escrow(purchase: dict):
    """Auto-refund held escrow on cancellation (spec C4 / Task E)."""
    escrow = purchase.get("escrow") or {}
    if escrow.get("status") != "held":
        return
    escrow.update(status="refunded", refundedAt=_now())
    _append_event(purchase, "escrowRefunded")


def _redact(purchase: dict, uid: str) -> dict:
    """The handover OTP is farmer-only (shared verbally, spec F11/G2)."""
    if uid == purchase.get("farmerId"):
        return purchase
    handover = dict(purchase.get("handover") or {})
    handover.pop("otp", None)
    return {**purchase, "handover": handover}


async def _participant(purchase_id: str, uid: str) -> dict:
    doc = await get_doc("purchases", purchase_id)
    if doc is None:
        _error(404, "PURCHASE_NOT_FOUND", "purchase not found")
    if uid not in (doc.get("buyerId"), doc.get("farmerId")):
        from app.services.buyer_org import is_org_member_of_buyer
        buyer_id = doc.get("buyerId") or ""
        if not await is_org_member_of_buyer(uid, buyer_id):
            _error(403, "FORBIDDEN", "not a purchase participant")
    return doc


async def _transition(purchase: dict, target: str):
    allowed = STATUS_TRANSITIONS.get(purchase.get("status"), set())
    if target not in allowed:
        _error(
            400,
            "INVALID_STATUS_TRANSITION",
            f"cannot move purchase from {purchase.get('status')} to {target}",
        )
    purchase["status"] = target
    _append_event(purchase, target)
    purchase["updatedAt"] = _now()


async def _new_purchase(
    *,
    buyer_id: str,
    buyer_name: str,
    farmer_id: str,
    farmer_name: str,
    source: dict,
    crop: str,
    variety: str,
    quantity: float,
    unit: str,
    price: int,
) -> dict:
    await probation_gate_booking(buyer_id)
    purchase = {
        "id": f"pur_{uuid.uuid4().hex[:12]}",
        "buyerId": buyer_id,
        "buyerName": buyer_name,
        "farmerId": farmer_id,
        "farmerName": farmer_name,
        "source": source,
        "crop": crop,
        "variety": variety,
        "quantity": quantity,
        "unit": unit,
        "agreedPricePerUnit": price,
        "totalAmount": round(price * quantity),
        "advancePaid": 0,
        "status": "confirmed",
        "pickup": None,
        "payments": [],
        "qc": None,
        "finalAmount": None,
        "invoice": None,
        "events": [],
        "rating": {"buyerToFarmer": None, "farmerToBuyer": None},
        "escrow": {
            "status": "unfunded",
            "amount": 0,
            "method": "",
            "reference": "",
            "fundedAt": None,
            "releasedAt": None,
            "refundedAt": None,
            "commission": None,
            "netRelease": None,
        },
        "handover": {
            "otp": None,
            "generatedAt": None,
            "expiresAt": None,
            "verifiedAt": None,
            "attempts": 0,
        },
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    _append_event(purchase, "confirmed")
    return purchase


async def create_purchase_from_offer(offer: dict) -> dict:
    price = offer["counter"]["pricePerUnit"] if offer.get("counter") else offer["pricePerUnit"]
    if offer["targetType"] == "demand":
        target = await get_doc("demands", offer["targetId"])
        if target is None:
            _error(404, "DEMAND_NOT_FOUND", "demand not found")
        purchase = await _new_purchase(
            buyer_id=target["buyerId"],
            buyer_name=target["buyerName"],
            farmer_id=offer["fromId"],
            farmer_name=offer["fromName"],
            source={"type": "offer", "refId": offer["id"]},
            crop=target["crop"],
            variety=target.get("variety", ""),
            quantity=offer["quantity"],
            unit=target.get("unit", "quintal"),
            price=price,
        )
        target["status"] = "fulfilled"
        target["updatedAt"] = _now()
        await set_doc("demands", target["id"], target)
    else:
        target = await get_doc("market_lots", offer["targetId"])
        if target is None:
            _error(404, "LOT_NOT_FOUND", "lot not found")
        farmer = await get_user(target["farmerId"]) or {}
        purchase = await _new_purchase(
            buyer_id=offer["fromId"],
            buyer_name=offer["fromName"],
            farmer_id=target["farmerId"],
            farmer_name=farmer.get("name", ""),
            source={"type": "offer", "refId": offer["id"]},
            crop=target["crop"],
            variety=target.get("variety", ""),
            quantity=offer["quantity"],
            unit="quintal",
            price=price,
        )
        target["status"] = "sold"
        await set_doc("market_lots", target["id"], target)
    await set_doc("purchases", purchase["id"], purchase)
    await ensure_chat_room(purchase)  # spec §4.1 — room created by CONFIRMED event
    return purchase


@router.post("", status_code=201)
async def create_purchase(body: PurchaseCreate, uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    lot = await get_doc("market_lots", body.lotId)
    if lot is None:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    if lot.get("farmerId") == uid:
        _error(403, "OWN_LOT", "cannot buy your own lot")
    if lot.get("status") != "open":
        _error(409, "LOT_NOT_OPEN", "lot is not open for purchase")
    available = lot.get("quantityQuintals") or 0
    qty = min(body.quantity or available, available)
    if qty <= 0:
        _error(422, "VALIDATION_ERROR", "invalid quantity", {"quantity": "must be greater than 0"})
    farmer = await get_user(lot["farmerId"]) or {}
    purchase = await _new_purchase(
        buyer_id=uid,
        buyer_name=user.get("name", ""),
        farmer_id=lot["farmerId"],
        farmer_name=farmer.get("name", ""),
        source={"type": "lot", "refId": lot["id"]},
        crop=lot["crop"],
        variety=lot.get("variety", ""),
        quantity=qty,
        unit="quintal",
        price=lot.get("expectedRate", 0),
    )
    await set_doc("purchases", purchase["id"], purchase)
    await ensure_chat_room(purchase)  # spec §4.1 — room created by CONFIRMED event
    await notify_user(
        purchase["farmerId"],
        type="booking_confirmed",
        title="Booking confirmed / बुकिंग पक्की",
        body=f"{purchase['crop']} — {purchase['quantity']} {purchase['unit']} @ ₹{purchase['agreedPricePerUnit']}",
        path=f"/dashboard/p/purchases/{purchase['id']}",
    )
    remaining = round(available - qty, 3)
    lot["quantityQuintals"] = remaining
    if remaining <= 0:
        lot["status"] = "sold"
    await set_doc("market_lots", lot["id"], lot)
    return _redact(purchase, uid)


@router.get("")
async def list_purchases(
    role: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    view = role or ("farmer" if user.get("activeProfile") == "farmer" else "buyer")
    if view == "farmer":
        docs = await query("purchases", [("farmerId", "==", uid)], limit=1000)
    else:
        docs = await query("purchases", [("buyerId", "==", uid)], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {
        "data": [_redact(d, uid) for d in docs[start:start + pageSize]],
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }


@router.get("/{purchase_id}")
async def get_purchase(purchase_id: str, uid: str = Depends(current_user_id)):
    return _redact(await _participant(purchase_id, uid), uid)


@router.post("/{purchase_id}/advance")
async def pay_advance(purchase_id: str, body: AdvanceIn, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    if purchase.get("status") != "confirmed":
        _error(400, "INVALID_STATUS_TRANSITION", f"cannot pay advance from {purchase.get('status')}")
    if body.amount > purchase["totalAmount"]:
        _error(422, "VALIDATION_ERROR", "advance exceeds total", {"amount": "must not exceed totalAmount"})
    await _transition(purchase, "advancePaid")
    payment = {
        "id": f"pay_{uuid.uuid4().hex[:10]}",
        "kind": "advance",
        "amount": body.amount,
        "method": body.method,
        "reference": body.reference,
        "at": _now(),
    }
    purchase.setdefault("payments", []).append(payment)
    purchase["advancePaid"] = body.amount
    purchase["updatedAt"] = _now()
    await set_doc("purchases", purchase_id, purchase)
    await notify_user(
        purchase["farmerId"],
        type="payment_received",
        title="Advance received / एडवांस मिला",
        body=f"₹{body.amount} for {purchase['crop']}",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    return _redact(purchase, uid)


@router.post("/{purchase_id}/pickup")
async def schedule_pickup(purchase_id: str, body: PickupIn, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    await _transition(purchase, "pickupScheduled")
    purchase["pickup"] = body.model_dump()
    purchase["updatedAt"] = _now()
    await set_doc("purchases", purchase_id, purchase)
    await notify_user(
        purchase["farmerId"],
        type="pickup_scheduled",
        title="Pickup scheduled / पिकअप तय हुआ",
        body=f"{purchase['crop']} — {(body.model_dump().get('date') or '')}",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    return _redact(purchase, uid)


@router.post("/{purchase_id}/dispatch")
async def dispatch_purchase(purchase_id: str, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    await _transition(purchase, "inTransit")
    await set_doc("purchases", purchase_id, purchase)
    await notify_user(
        purchase["farmerId"],
        type="dispatched",
        title="Vehicle dispatched / गाड़ी रवाना",
        body=f"{purchase['crop']} — {purchase['quantity']} {purchase['unit']}",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    return _redact(purchase, uid)


@router.post("/{purchase_id}/deliver")
async def deliver_purchase(purchase_id: str, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    await _transition(purchase, "delivered")
    await set_doc("purchases", purchase_id, purchase)
    await notify_user(
        purchase["farmerId"],
        type="delivered",
        title="Marked delivered / डिलीवर हुआ",
        body=f"{purchase['crop']} — share the handover OTP now",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    return _redact(purchase, uid)


@router.post("/{purchase_id}/cancel")
async def cancel_purchase(purchase_id: str, body: CancelIn, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    if purchase.get("status") not in ("confirmed", "advancePaid", "pickupScheduled"):
        _error(400, "INVALID_STATUS_TRANSITION", f"cannot cancel from {purchase.get('status')}")
    purchase["status"] = "cancelled"
    _refund_escrow(purchase)
    _append_event(purchase, "cancelled", body.reason)
    purchase["updatedAt"] = _now()
    await set_doc("purchases", purchase_id, purchase)
    other = purchase["buyerId"] if uid == purchase["farmerId"] else purchase["farmerId"]
    await notify_user(
        other,
        type="booking_cancelled",
        title="Booking cancelled / बुकिंग रद्द",
        body=f"{purchase['crop']} — {body.reason or 'no reason given'}",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    return _redact(purchase, uid)
