import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.db import get_doc, set_doc
from app.core.deps import current_user_id
from app.models.direct import PayIn, QcIn, RateIn, ResolveIn
from app.routers.purchases import (
    HANDOVER_OTP_MAX_ATTEMPTS,
    HANDOVER_OTP_VALID_MINUTES,
    TERMINAL_STATUSES,
    _amount_due,
    _append_event,
    _error,
    _issue_invoice,
    _now,
    _participant,
    _redact,
    _release_escrow,
    maybe_award_vyapari_verified,
    probation_gate_escrow,
)
from app.routers.users import require_role
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(prefix="/purchases", tags=["purchases"])


class EscrowFundIn(BaseModel):
    """amount optional — defaults to the booking total."""

    amount: int | None = Field(default=None, gt=0)
    method: str = ""
    reference: str = ""


# ---------------- Escrow (spec C4) ----------------


@router.post("/{purchase_id}/escrow/fund")
async def fund_escrow(purchase_id: str, body: EscrowFundIn, uid: str = Depends(current_user_id)):
    """Vyapari funds the escrow at confirmation. Moves the purchase to
    advancePaid (PAYMENT_HELD in the spec state machine) and unlocks the
    handover OTP for the farmer."""
    purchase = await _participant(purchase_id, uid)
    if uid != purchase.get("buyerId"):
        _error(403, "FORBIDDEN", "only the buyer can fund escrow")
    escrow = purchase.setdefault("escrow", {})
    if escrow.get("status") == "held":
        _error(409, "ESCROW_ALREADY_HELD", "escrow is already funded")
    if purchase.get("status") != "confirmed":
        _error(400, "INVALID_STATUS_TRANSITION", f"cannot fund escrow from {purchase.get('status')}")
    amount = body.amount or purchase.get("totalAmount") or 0
    if amount <= 0 or amount > purchase.get("totalAmount", 0):
        _error(422, "VALIDATION_ERROR", "invalid escrow amount", {"amount": "must be between 1 and totalAmount"})
    await probation_gate_escrow(purchase["buyerId"], purchase_id, amount)
    escrow.update(
        status="held",
        amount=amount,
        method=body.method,
        reference=body.reference,
        fundedAt=_now(),
    )
    purchase["payments"] = (purchase.get("payments") or []) + [
        {
            "id": f"pay_{uuid.uuid4().hex[:10]}",
            "kind": "escrow",
            "amount": amount,
            "method": body.method,
            "reference": body.reference,
            "at": _now(),
        }
    ]
    purchase["status"] = "advancePaid"
    _append_event(purchase, "escrowFunded", f"{amount} held by platform")
    purchase["updatedAt"] = _now()
    await set_doc("purchases", purchase_id, purchase)
    await notify_user(
        purchase["farmerId"],
        type="escrow_funded",
        title="Escrow funded / एस्क्रो भरा गया",
        body=f"₹{amount} held for {purchase['crop']} — handover OTP is now unlocked",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    return _redact(purchase, uid)


# ---------------- Handover OTP (spec F11) ----------------


def _otp_fresh(handover: dict) -> bool:
    expires_at = handover.get("expiresAt")
    if not expires_at or not handover.get("otp"):
        return False
    try:
        return datetime.now(timezone.utc) < datetime.fromisoformat(expires_at)
    except ValueError:
        return False


@router.get("/{purchase_id}/handover-otp")
async def reveal_handover_otp(purchase_id: str, uid: str = Depends(current_user_id)):
    """Farmer reveals the 6-digit OTP once escrow is held (spec: OTP revealed
    at PAYMENT_HELD). Single-use, 15-minute validity, regenerate when expired."""
    purchase = await _participant(purchase_id, uid)
    if uid != purchase.get("farmerId"):
        _error(403, "FORBIDDEN", "only the farmer can view the handover OTP")
    escrow = purchase.get("escrow") or {}
    if escrow.get("status") != "held":
        _error(409, "ESCROW_NOT_HELD", "handover OTP unlocks after escrow is funded")
    handover = purchase.setdefault("handover", {})
    if handover.get("verifiedAt") or not _otp_fresh(handover):
        handover["otp"] = f"{secrets.randbelow(1000000):06d}"
        handover["generatedAt"] = _now()
        handover["expiresAt"] = (
            datetime.now(timezone.utc) + timedelta(minutes=HANDOVER_OTP_VALID_MINUTES)
        ).isoformat()
        handover["attempts"] = 0
        purchase["updatedAt"] = _now()
        await set_doc("purchases", purchase_id, purchase)
    return {
        "otp": handover["otp"],
        "expiresAt": handover["expiresAt"],
        "verifiedAt": handover.get("verifiedAt"),
    }


@router.post("/{purchase_id}/handover/verify")
async def verify_handover(purchase_id: str, body: dict, uid: str = Depends(current_user_id)):
    """Vyapari enters the farmer's OTP at physical handover → delivery proof;
    inspection (QC) is then enabled (spec: HANDED_OVER → INSPECTED)."""
    purchase = await _participant(purchase_id, uid)
    if uid != purchase.get("buyerId"):
        _error(403, "FORBIDDEN", "only the buyer can verify the handover OTP")
    escrow = purchase.get("escrow") or {}
    if escrow.get("status") != "held":
        _error(409, "ESCROW_NOT_HELD", "escrow must be funded before handover")
    if purchase.get("status") not in ("pickupScheduled", "inTransit", "delivered"):
        _error(400, "INVALID_STATUS_TRANSITION", f"cannot verify handover from {purchase.get('status')}")
    handover = purchase.setdefault("handover", {})
    if handover.get("verifiedAt"):
        _error(409, "ALREADY_VERIFIED", "handover OTP already verified")
    if not handover.get("otp"):
        _error(400, "OTP_NOT_GENERATED", "farmer must reveal the OTP first")
    if not _otp_fresh(handover):
        _error(400, "OTP_EXPIRED", "handover OTP expired — farmer should reveal again")
    if (handover.get("attempts") or 0) >= HANDOVER_OTP_MAX_ATTEMPTS:
        _error(429, "TOO_MANY_ATTEMPTS", "too many attempts — request a new OTP from the farmer")
    code = str(body.get("otp", "")).strip()
    if code != handover.get("otp"):
        handover["attempts"] = (handover.get("attempts") or 0) + 1
        purchase["updatedAt"] = _now()
        await set_doc("purchases", purchase_id, purchase)
        _error(400, "INVALID_OTP", "incorrect handover OTP")
    handover["verifiedAt"] = _now()
    handover["attempts"] = 0
    # WS-03: OTP confirmation starts the escrow release clock (dispute window).
    from app.services.escrow import start_clock

    start_clock(escrow)
    _append_event(purchase, "handedOver")
    purchase["updatedAt"] = _now()
    await set_doc("purchases", purchase_id, purchase)
    await notify_user(
        purchase["farmerId"],
        type="handover_verified",
        title="Handover verified / हैंडओवर पक्का",
        body=f"{purchase['crop']} — produce handed over, inspection next",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    return _redact(purchase, uid)


async def _apply_invoice(purchase: dict):
    source = purchase.get("source") or {}
    demand = None
    if isinstance(source, dict) and source.get("type") == "dairy" and source.get("refId"):
        if not purchase.get("category"):
            demand = await get_doc("dairy_demands", source["refId"])
            if demand and demand.get("category"):
                purchase["category"] = demand["category"]
    _issue_invoice(purchase, demand=demand)


@router.post("/{purchase_id}/qc")
async def record_qc(purchase_id: str, body: QcIn, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    if purchase.get("status") != "delivered":
        _error(400, "INVALID_STATUS_TRANSITION", f"cannot record QC from {purchase.get('status')}")
    escrow = purchase.get("escrow") or {}
    if escrow.get("status") == "held" and not (purchase.get("handover") or {}).get("verifiedAt"):
        _error(400, "HANDOVER_REQUIRED", "verify the handover OTP before filing inspection")
    if abs(body.acceptedQty + body.rejectedQty - purchase["quantity"]) > 0.001:
        _error(
            422,
            "VALIDATION_ERROR",
            "accepted and rejected quantities must sum to the purchase quantity",
            {"acceptedQty": "acceptedQty + rejectedQty must equal quantity"},
        )
    purchase["qc"] = {**body.model_dump(), "at": _now()}
    if body.rejectedQty <= 0:
        purchase["finalAmount"] = purchase["totalAmount"]
        purchase["status"] = "completed"
        _append_event(purchase, "qc", f"grade {body.grade}")
        await _release_escrow(purchase)
        _append_event(purchase, "completed")
        await _apply_invoice(purchase)
    else:
        purchase["finalAmount"] = round(purchase["agreedPricePerUnit"] * body.acceptedQty)
        purchase["status"] = "qcDisputed"
        # WS-03: a dispute opened inside the window pauses escrow release.
        escrow = purchase.setdefault("escrow", {})
        escrow["disputeOpenedAt"] = _now()
        _append_event(purchase, "qcDisputed", f"grade {body.grade}")
    purchase["updatedAt"] = _now()
    await set_doc("purchases", purchase_id, purchase)
    if purchase["status"] == "completed":
        await maybe_award_vyapari_verified(purchase["buyerId"])
        for party in (purchase["farmerId"], purchase["buyerId"]):
            await notify_user(
                party,
                type="deal_completed",
                title="Deal completed / सौदा पूरा 🎉",
                body=f"{purchase['crop']} — invoice {purchase['invoice']['number']}",
                path=f"/dashboard/p/purchases/{purchase_id}",
            )
    else:
        other = purchase["buyerId"] if uid == purchase["farmerId"] else purchase["farmerId"]
        await notify_user(
            other,
            type="qc_disputed",
            title="Quality dispute / गुणवत्ता विवाद",
            body=f"{purchase['crop']} — {body.rejectedQty} {purchase['unit']} rejected",
            path=f"/dashboard/p/purchases/{purchase_id}",
        )
    return _redact(purchase, uid)


@router.post("/{purchase_id}/resolve")
async def resolve_dispute(purchase_id: str, body: ResolveIn, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    if purchase.get("status") != "qcDisputed":
        _error(400, "INVALID_STATUS_TRANSITION", f"cannot resolve from {purchase.get('status')}")
    purchase["status"] = "completed"
    _append_event(purchase, "resolved", body.resolution)
    escrow = purchase.setdefault("escrow", {})
    escrow["disputeResolvedAt"] = _now()
    escrow["releaseAt"] = _now()
    await _release_escrow(purchase)
    _append_event(purchase, "completed")
    await _apply_invoice(purchase)
    purchase["updatedAt"] = _now()
    await set_doc("purchases", purchase_id, purchase)
    await maybe_award_vyapari_verified(purchase["buyerId"])
    await notify_user(
        purchase["buyerId"],
        type="dispute_resolved",
        title="Dispute resolved / विवाद सुलझा",
        body=f"{purchase['crop']} — final ₹{purchase['finalAmount']}",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    return _redact(purchase, uid)


@router.post("/{purchase_id}/pay")
async def record_payment(purchase_id: str, body: PayIn, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    if purchase.get("status") in TERMINAL_STATUSES:
        _error(409, "PAYMENT_NOT_ALLOWED", "purchase is already settled")
    due = _amount_due(purchase)
    if body.amount > due:
        _error(409, "PAYMENT_EXCEEDS_DUE", f"amount exceeds pending balance of {due}")
    payment = {
        "id": f"pay_{uuid.uuid4().hex[:10]}",
        "kind": body.kind,
        "amount": body.amount,
        "method": body.method,
        "reference": body.reference,
        "at": _now(),
    }
    purchase.setdefault("payments", []).append(payment)
    _append_event(purchase, "payment", f"{body.kind} {body.amount}")
    purchase["updatedAt"] = _now()
    await set_doc("purchases", purchase_id, purchase)
    await notify_user(
        purchase["farmerId"],
        type="payment_received",
        title="Payment received / भुगतान मिला",
        body=f"₹{body.amount} for {purchase['crop']}",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    return _redact(purchase, uid)


@router.post("/{purchase_id}/rate")
async def rate_counterparty(purchase_id: str, body: RateIn, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    if purchase.get("status") != "completed":
        _error(409, "NOT_COMPLETED", "only completed purchases can be rated")
    user = await get_user(uid)
    rating_doc = {"rating": body.rating, "review": body.review, "at": _now()}
    ratings = purchase.setdefault("rating", {"buyerToFarmer": None, "farmerToBuyer": None})
    if body.target == "farmer":
        if uid != purchase.get("buyerId") or user is None:
            _error(403, "FORBIDDEN", "only the buyer can rate the farmer")
        require_role(user, "directBuyer", "seller")
        if ratings.get("buyerToFarmer") is not None:
            _error(409, "ALREADY_RATED", "farmer already rated for this purchase")
        ratings["buyerToFarmer"] = rating_doc
    else:
        if uid != purchase.get("farmerId") or user is None:
            _error(403, "FORBIDDEN", "only the farmer can rate the buyer")
        require_role(user, "farmer")
        if ratings.get("farmerToBuyer") is not None:
            _error(409, "ALREADY_RATED", "buyer already rated for this purchase")
        ratings["farmerToBuyer"] = rating_doc
    purchase["updatedAt"] = _now()
    await set_doc("purchases", purchase_id, purchase)
    rated_party = purchase["farmerId"] if body.target == "farmer" else purchase["buyerId"]
    await notify_user(
        rated_party,
        type="rated",
        title="You got a rating / रेटिंग मिली",
        body=f"{'⭐' * body.rating} for {purchase['crop']}",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    return _redact(purchase, uid)


@router.get("/{purchase_id}/invoice")
async def get_invoice(purchase_id: str, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    invoice = purchase.get("invoice")
    if invoice is None:
        _error(404, "INVOICE_NOT_FOUND", "invoice not issued yet")
    return {"purchaseId": purchase_id, **invoice}
