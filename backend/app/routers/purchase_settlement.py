import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Header, UploadFile
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
from app.services import idempotency, storage
from app.services.billing import check_entitlement
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
    from app.services.buyer_org import require_org_role
    await require_org_role(uid, "finance", "admin", org_owner_uid=purchase.get("buyerId"))
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
    if isinstance(source, dict) and source.get("type") == "contract":
        # WS-02 step 10: 1–2% platform commission on every direct-buyer
        # (ProcurePro) settlement invoice, integer paisa.
        await _append_commission_line(purchase)


async def _append_commission_line(purchase: dict):
    from app.services import settlements as settlements_service

    invoice = purchase.get("invoice")
    if invoice is None:
        return
    config = await settlements_service._config()
    pct = int(config.get("directBuyerPct", 2))
    pct = min(2, max(1, pct))  # the direct-buyer band is 1–2%
    trade_amount = int(purchase.get("finalAmount") or purchase.get("totalAmount") or 0)
    commission_paisa = (trade_amount * pct) // 100
    line = {
        "type": "commission",
        "description": f"Platform commission (direct buyer {pct}%)",
        "ratePercent": pct,
        "amount": commission_paisa,
        "commissionPaisa": commission_paisa,
    }
    invoice.setdefault("lines", []).append(line)
    purchase["commissionLine"] = line
    purchase["commissionAmount"] = commission_paisa


@router.post("/{purchase_id}/qc")
async def record_qc(purchase_id: str, body: QcIn, uid: str = Depends(current_user_id)):
    purchase = await _participant(purchase_id, uid)
    from app.services.buyer_org import require_org_role
    await require_org_role(uid, "qa", "admin", org_owner_uid=purchase.get("buyerId"))
    if (purchase.get("source") or {}).get("type") == "contract":
        # WS-02 step 10: the ProcurePro QC suite is a Pro+ feature.
        await check_entitlement(purchase.get("buyerId"), "directBuyer", "qcSubmits")
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
    spec_snapshot = purchase.get("specSnapshot")
    if not spec_snapshot and purchase.get("source", {}).get("type") == "contract":
        contract_id = purchase.get("source", {}).get("refId") or purchase.get("contractId")
        if contract_id:
            contract = await get_doc("contracts", contract_id)
            if contract and contract.get("specSnapshot"):
                spec_snapshot = contract["specSnapshot"]
                purchase["specSnapshot"] = spec_snapshot

    if spec_snapshot:
        params = spec_snapshot.get("params") or []
        param_map = {p.get("name", "").strip().lower(): p for p in params if "name" in p}
        qty = float(purchase.get("quantity") or 1)
        accepted_qty = float(body.acceptedQty)

        per_unit_adj_sum = 0
        measured_details = []

        for m in body.measurements:
            p = param_map.get(m.name.strip().lower())
            if not p:
                measured_details.append({"name": m.name, "value": m.value, "specBound": "-", "adjustment": 0})
                continue
            p_min = p.get("min")
            p_max = p.get("max")
            adj_rate = int(p.get("adjustmentPerUnit") or 0)
            val = float(m.value)

            dev = 0.0
            if p_min is not None and p_max is not None:
                if val < p_min:
                    dev = val - p_min
                elif val > p_max:
                    dev = val - p_max
            elif p_min is not None and p_max is None:
                if adj_rate > 0:
                    dev = val - p_min
                else:
                    dev = p_min - val if val < p_min else 0.0
            elif p_min is None and p_max is not None:
                if val > p_max:
                    dev = val - p_max

            line_adj_per_unit = int(round(adj_rate * dev))
            per_unit_adj_sum += line_adj_per_unit

            if p_min is not None and p_max is not None:
                bound_str = f"{p_min} – {p_max} {p.get('unit', '')}".strip()
            elif p_min is not None:
                bound_str = f"≥ {p_min} {p.get('unit', '')}".strip()
            elif p_max is not None:
                bound_str = f"≤ {p_max} {p.get('unit', '')}".strip()
            else:
                bound_str = "Standard"

            measured_details.append({
                "name": m.name,
                "value": m.value,
                "unit": p.get("unit", ""),
                "specBound": bound_str,
                "adjustmentPerUnit": adj_rate,
                "deviation": dev,
                "adjustment": line_adj_per_unit,
            })

        total_quality_adj = int(round(per_unit_adj_sum * qty))
        base_rate_paisa = int(round(float(purchase.get("agreedPricePerUnit") or 0) * 100))
        final_rate_paisa = base_rate_paisa + (total_quality_adj // int(qty or 1))
        final_amount_paisa = int(round(final_rate_paisa * accepted_qty))
        final_amount = int(round(final_amount_paisa / 100))

        purchase["qualityAdjustment"] = total_quality_adj
        purchase["qualityAdjustmentPerUnit"] = per_unit_adj_sum
        purchase["finalRate"] = final_rate_paisa
        purchase["finalAmount"] = final_amount
        purchase["finalAmountPaisa"] = final_amount_paisa
        purchase["qc"] = {
            **body.model_dump(),
            "measurements": measured_details,
            "at": _now(),
        }

        if body.rejectedQty <= 0:
            purchase["status"] = "completed"
            _append_event(purchase, "qc", f"sliding QC (rate ₹{final_rate_paisa / 100:.2f})")
            await _release_escrow(purchase)
            _append_event(purchase, "completed")
            await _apply_invoice(purchase)
        else:
            purchase["status"] = "qcDisputed"
            escrow = purchase.setdefault("escrow", {})
            escrow["disputeOpenedAt"] = _now()
            _append_event(purchase, "qcDisputed", f"sliding QC: {body.rejectedQty} rejected")
    else:
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


@router.post("/{purchase_id}/qc/photos", status_code=201)
async def upload_qc_photo(
    purchase_id: str,
    file: UploadFile = File(...),
    uid: str = Depends(current_user_id),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    stored = await idempotency.replay("purchase.qc.photo", idempotency_key)
    if stored is not None:
        return stored

    purchase = await _participant(purchase_id, uid)
    if purchase.get("status") not in ("delivered", "qcDisputed"):
        _error(
            409,
            "INVALID_PURCHASE_STATUS",
            f"QC photos can only be uploaded when status is delivered or qcDisputed, current: {purchase.get('status')}",
        )

    qc = purchase.setdefault("qc", {})
    photos = qc.setdefault("photos", [])
    if len(photos) >= 5:
        _error(409, "MAX_PHOTOS_EXCEEDED", "maximum 5 photos per purchase allowed")

    data = await storage.validate_upload(file)
    filename = file.filename or "photo.jpg"
    content_type = file.content_type or "image/jpeg"
    blob_path, _ = storage.upload_user_file(uid, data, filename, content_type, prefix="purchases")
    download_url = storage.signed_download_url(blob_path)
    photos.append(blob_path)
    purchase["updatedAt"] = _now()
    await set_doc("purchases", purchase_id, purchase)

    res = {"photoKey": blob_path, "url": download_url, "photos": photos}
    if idempotency_key:
        await idempotency.store("purchase.qc.photo", idempotency_key, res)
    return res


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
