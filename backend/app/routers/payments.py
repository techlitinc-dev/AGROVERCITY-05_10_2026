"""Real money rails (WS-03): order → verify → signed webhook → refund.

Every write accepts an Idempotency-Key; every failure returns the standard
{"error": {code, message, fieldErrors}} envelope. All amounts are integer paisa.
"""
import hashlib
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.db import get_doc, query, set_doc
from app.core.deps import admin_action, current_user_id
from app.core.ratelimit import hit
from app.services.payments import (
    create_razorpay_order,
    refund_razorpay_payment,
    verify_razorpay_signature,
    verify_razorpay_webhook,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class PaymentOrderIn(BaseModel):
    amountPaisa: int = Field(..., gt=0)
    purpose: str = Field(..., min_length=3)
    refId: str = Field(..., min_length=1)


class PaymentVerifyIn(BaseModel):
    razorpayOrderId: str
    razorpayPaymentId: str
    razorpaySignature: str


class RefundIn(BaseModel):
    reason: str = Field(..., min_length=3)


class WebhookAck(BaseModel):
    ok: bool = True
    duplicate: bool = False


def _payment_id(uid: str, idempotency_key: str | None) -> str:
    if idempotency_key:
        digest = hashlib.sha256(f"{uid}:{idempotency_key}".encode()).hexdigest()
        return f"pay_idem_{digest[:16]}"
    return f"pay_{uuid.uuid4().hex[:12]}"


@router.post("/order")
async def create_payment_order(
    body: PaymentOrderIn,
    uid: str = Depends(current_user_id),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    await hit("payments", uid, 20, 60)
    if not settings.razorpay_key_id:
        _error(503, "PAYMENTS_NOT_CONFIGURED", "payments are not configured")

    payment_id = _payment_id(uid, idempotency_key)
    existing = await get_doc("payments", payment_id)
    if existing is not None:
        return {
            "paymentId": existing["id"],
            "razorpayOrderId": existing["razorpayOrderId"],
            "amountPaisa": existing["amountPaisa"],
            "currency": "INR",
            "keyId": settings.razorpay_key_id,
        }

    order = create_razorpay_order(body.amountPaisa, payment_id)
    payment = {
        "id": payment_id,
        "userId": uid,
        "amountPaisa": body.amountPaisa,
        "purpose": body.purpose,
        "refId": body.refId,
        "razorpayOrderId": order["id"],
        "status": "created",
        "createdAt": _now(),
    }
    await set_doc("payments", payment_id, payment)
    return {
        "paymentId": payment_id,
        "razorpayOrderId": order["id"],
        "amountPaisa": body.amountPaisa,
        "currency": "INR",
        "keyId": settings.razorpay_key_id,
    }


@router.post("/verify")
async def verify_payment(body: PaymentVerifyIn, uid: str = Depends(current_user_id)):
    await hit("payments", uid, 20, 60)
    matches = await query("payments", [("razorpayOrderId", "==", body.razorpayOrderId)], limit=1)
    payment = matches[0] if matches else None
    if payment is None:
        _error(404, "PAYMENT_NOT_FOUND", "no payment awaiting verification for this order")
    if payment["userId"] != uid:
        _error(403, "FORBIDDEN", "not your payment")
    if payment.get("status") == "paid":
        return {"ok": True, "status": "paid"}
    if not verify_razorpay_signature(
        body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature
    ):
        _error(400, "PAYMENT_SIGNATURE_INVALID", "payment signature verification failed")
    payment["status"] = "paid"
    payment["razorpayPaymentId"] = body.razorpayPaymentId
    payment["paidAt"] = _now()
    await set_doc("payments", payment["id"], payment)
    return {"ok": True, "status": "paid"}


@router.post("/{payment_id}/refund")
async def refund_payment(
    payment_id: str,
    body: RefundIn,
    _audit: dict = Depends(admin_action("PAYMENT_REFUND")),
):
    payment = await get_doc("payments", payment_id)
    if payment is None:
        _error(404, "PAYMENT_NOT_FOUND", "payment not found")
    if payment.get("status") != "paid":
        _error(409, "REFUND_NOT_APPLICABLE", "only paid payments can be refunded")
    refund = await refund_razorpay_payment(payment.get("razorpayPaymentId", ""), payment["amountPaisa"])
    payment["status"] = "refunded"
    payment["refundReason"] = body.reason
    payment["razorpayRefundId"] = refund.get("id")
    payment["refundedAt"] = _now()
    await set_doc("payments", payment_id, payment)
    return {"ok": True, "status": "refunded", "razorpayRefundId": refund.get("id")}


@router.post("/webhook", response_model=WebhookAck)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str | None = Header(None, alias="X-Razorpay-Signature"),
):
    """Signature-verified Razorpay webhook; idempotent on the event id."""
    raw = await request.body()
    if not x_razorpay_signature or not verify_razorpay_webhook(raw, x_razorpay_signature):
        _error(401, "WEBHOOK_SIGNATURE_INVALID", "webhook signature verification failed")
    try:
        event = await request.json()
    except Exception:
        _error(400, "WEBHOOK_MALFORMED", "webhook payload is not valid JSON")

    event_id = event.get("id") or hashlib.sha256(raw).hexdigest()[:32]
    existing = await get_doc("payment_events", event_id)
    if existing is not None:
        return WebhookAck(ok=True, duplicate=True)

    event_type = event.get("event", "unknown")
    entity = (((event.get("payload") or {}).get("payment") or {}).get("entity")) or {}
    order_id = entity.get("order_id")

    await set_doc(
        "payment_events",
        event_id,
        {
            "id": event_id,
            "type": event_type,
            "razorpayOrderId": order_id,
            "razorpayPaymentId": entity.get("id"),
            "receivedAt": _now(),
        },
    )

    if order_id:
        matches = await query("payments", [("razorpayOrderId", "==", order_id)], limit=1)
        if matches:
            payment = matches[0]
            if event_type == "payment.captured" and payment.get("status") == "created":
                payment["status"] = "paid"
                payment["razorpayPaymentId"] = entity.get("id")
                payment["paidAt"] = _now()
                await set_doc("payments", payment["id"], payment)
            elif event_type == "refund.processed" and payment.get("status") == "paid":
                payment["status"] = "refunded"
                payment["refundedAt"] = _now()
                await set_doc("payments", payment["id"], payment)
    return WebhookAck(ok=True, duplicate=False)
