"""Real money rails (WS-03): order → verify → signed webhook → refund.

Every write accepts an Idempotency-Key; every failure returns the standard
{"error": {code, message, fieldErrors}} envelope. All amounts are integer paisa.
"""
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import Response
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
from app.services.users import get_user

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

    if event_type.startswith("subscription."):
        sub_entity = (((event.get("payload") or {}).get("subscription") or {}).get("entity")) or {}
        provider_ref = sub_entity.get("id")
        if provider_ref:
            matches = await query("subscriptions", [("providerRef", "==", provider_ref)], limit=1)
            if matches:
                subscription = matches[0]
                status_map = {
                    "subscription.activated": "active",
                    "subscription.charged": "active",
                    "subscription.halted": "past_due",
                    "subscription.cancelled": "cancelled",
                    "subscription.completed": "cancelled",
                }
                new_status = status_map.get(event_type)
                if new_status and subscription.get("status") != new_status:
                    subscription["status"] = new_status
                    subscription["updatedAt"] = _now()
                    await set_doc("subscriptions", subscription["subId"], subscription)

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


# ---------------------------------------------------------------------------
# Unified transaction ledger + user-initiated refund requests (SR 4)
# ---------------------------------------------------------------------------

# Domain collections that hold standalone payment records keyed by a user id,
# folded into the unified ledger alongside the canonical `payments` rail.
# Field-name variants are tolerated on read (amount/amountPaisa, status/state,
# purpose/type, payerId/fromUserId/userId, createdAt/at) because each domain
# writer evolved its own shape.
_TX_SOURCES = (
    {
        "collection": "payments",
        "payerFields": ("userId", "payerId", "fromUserId"),
        "payeeFields": ("payeeId", "toUserId", "sellerId", "farmerId"),
        "amountIsPaisa": True,
        "defaultType": "payment",
    },
    {
        "collection": "transport_payouts",
        "payerFields": (),
        "payeeFields": ("userId",),
        "amountIsPaisa": True,
        "defaultType": "payout",
    },
    {
        "collection": "nursery_payouts",
        "payerFields": (),
        "payeeFields": ("nurseryId", "userId"),
        "amountIsPaisa": False,
        "defaultType": "payout",
    },
)
_TX_SCAN_LIMIT = 2000  # bounded scan, same posture as jobs.reconcile / dairy slips
_TX_SUCCESS_STATUSES = ("paid", "captured", "success")


def _first(doc: dict, *keys: str):
    for key in keys:
        value = doc.get(key)
        if value is not None and value != "":
            return value
    return None


def _amount_rupees(doc: dict, amount_is_paisa: bool) -> float:
    paisa = _first(doc, "amountPaisa", "amount_paisa", "paisa")
    if isinstance(paisa, (int, float)) and not isinstance(paisa, bool):
        return round(float(paisa) / 100.0, 2)
    rupees = _first(doc, "amountRupees", "amount_rupees")
    if isinstance(rupees, (int, float)) and not isinstance(rupees, bool):
        return round(float(rupees), 2)
    amount = doc.get("amount")
    if isinstance(amount, (int, float)) and not isinstance(amount, bool):
        return round(float(amount) / 100.0, 2) if amount_is_paisa else round(float(amount), 2)
    return 0.0


def _tx_created_at(doc: dict) -> str:
    return str(_first(doc, "createdAt", "created_at", "at", "paidAt", "refundedAt", "updatedAt") or "")


def _normalize_tx(doc: dict, source: dict, uid: str) -> dict | None:
    """Map one raw payment doc to the ledger shape; None when uid is not involved."""
    payer_id = _first(doc, *source["payerFields"])
    payee_id = _first(doc, *source["payeeFields"])
    if payer_id == uid:
        direction = "sent"
        counterparty_id = payee_id if isinstance(payee_id, str) and payee_id != uid else None
    elif payee_id == uid:
        direction = "received"
        counterparty_id = payer_id if isinstance(payer_id, str) and payer_id != uid else None
    else:
        return None
    kind = str(_first(doc, "purpose", "type", "kind") or source["defaultType"])
    return {
        "id": str(doc.get("id") or doc.get("paymentId") or ""),
        "source": source["collection"],
        "direction": direction,
        "amount": _amount_rupees(doc, source["amountIsPaisa"]),
        "currency": str(doc.get("currency") or "INR"),
        "status": str(_first(doc, "status", "state") or "unknown").lower(),
        "type": kind,
        "purpose": kind,
        "counterparty": {"userId": counterparty_id} if counterparty_id else None,
        "createdAt": _tx_created_at(doc),
        "invoiceUrl": _first(doc, "invoiceUrl", "invoice_url", "invoice"),
        "refundStatus": _first(doc, "refundStatus", "refund_status"),
    }


@router.get("/transactions")
async def list_transactions(
    direction: str | None = None,
    status: str | None = None,
    tx_type: str | None = Query(None, alias="type"),
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    """Unified paged ledger of every payment the caller sent or received."""
    await hit("payments", uid, 20, 60)
    if direction not in (None, "received", "sent"):
        _error(422, "INVALID_DIRECTION", "direction must be 'received' or 'sent'", {"direction": "must be received or sent"})
    if page < 1 or pageSize < 1:
        _error(422, "INVALID_PAGINATION", "page and pageSize must be >= 1", {"page": "must be >= 1", "pageSize": "must be >= 1"})
    page_size = min(pageSize, 100)

    items: list[dict] = []
    for source in _TX_SOURCES:
        docs = await query(source["collection"], [], limit=_TX_SCAN_LIMIT)
        for doc in docs:
            item = _normalize_tx(doc, source, uid)
            if item is not None and item["id"]:
                items.append(item)

    if direction:
        items = [i for i in items if i["direction"] == direction]
    if status:
        want = status.lower()
        items = [i for i in items if i["status"] == want]
    if tx_type:
        needle = tx_type.lower()
        items = [i for i in items if needle in i["type"].lower() or needle in i["purpose"].lower()]
    if date_from:
        # A bare YYYY-MM-DD is inclusive on the calendar day.
        items = [i for i in items if i["createdAt"][:10] >= date_from] if len(date_from) == 10 else [i for i in items if i["createdAt"] >= date_from]
    if date_to:
        items = [i for i in items if i["createdAt"][:10] <= date_to] if len(date_to) == 10 else [i for i in items if i["createdAt"] <= date_to]

    items.sort(key=lambda i: i["createdAt"], reverse=True)

    # Summary is computed across the full filtered set (all pages), so the
    # frontend cards stay accurate while the user pages through.
    totals = {
        "totalReceived": round(sum(i["amount"] for i in items if i["direction"] == "received"), 2),
        "totalSent": round(sum(i["amount"] for i in items if i["direction"] == "sent"), 2),
        "refundsPending": sum(1 for i in items if i.get("refundStatus") == "requested"),
    }

    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start:start + page_size]
    for item in page_items:
        counterparty = item.get("counterparty")
        if not counterparty:
            continue
        user = await get_user(counterparty["userId"])
        counterparty["name"] = (user or {}).get("name", "")
        counterparty["persona"] = (user or {}).get("activeProfile") or (user or {}).get("primaryProfile") or ""

    return {"data": page_items, "page": page, "pageSize": page_size, "total": total, "totals": totals}


@router.get("/{payment_id}/receipt.pdf")
async def download_payment_receipt(payment_id: str, uid: str = Depends(current_user_id)):
    """Branded PDF receipt for one payment — payer or payee only.

    The ₹ glyph is not in reportlab's built-in Helvetica (WinAnsi), so the
    amount renders as "Rs N.NN" exactly like every other PDF in this repo.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    await hit("payments", uid, 20, 60)
    payment = await get_doc("payments", payment_id)
    if payment is None:
        _error(404, "PAYMENT_NOT_FOUND", "payment not found")
    payer_id = _first(payment, *_TX_SOURCES[0]["payerFields"])
    payee_id = _first(payment, *_TX_SOURCES[0]["payeeFields"])
    if uid not in (payer_id, payee_id):
        _error(403, "FORBIDDEN", "only the payer or payee can download this receipt")

    caller_is_payer = payer_id == uid
    counterparty_id = payee_id if caller_is_payer else payer_id
    counterparty = await get_user(counterparty_id) if isinstance(counterparty_id, str) else None
    counterparty_name = (counterparty or {}).get("name", "") or "Agrovercity Platform"
    counterparty_label = "Paid to" if caller_is_payer else "Received from"

    amount_rupees = _amount_rupees(payment, True)
    status = str(_first(payment, "status", "state") or "unknown").lower()
    paid_at = _first(payment, "paidAt", "createdAt") or ""
    purpose = str(_first(payment, "purpose", "type") or "payment")

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title", parent=styles["Heading1"], fontSize=15, leading=19,
        alignment=1, textColor=colors.HexColor("#065f46"),
    )
    sub_style = ParagraphStyle(
        "Sub", parent=styles["Normal"], fontSize=9, leading=13,
        alignment=1, textColor=colors.HexColor("#334155"),
    )
    cell_style = ParagraphStyle("Cell", parent=styles["Normal"], fontSize=9, leading=12)
    header_style = ParagraphStyle(
        "Header", parent=styles["Normal"], fontSize=9, leading=12,
        fontName="Helvetica-Bold", textColor=colors.white,
    )

    story = [
        Paragraph("AGROVERCITY", title_style),
        Paragraph("<b>PAYMENT RECEIPT</b>", sub_style),
        Spacer(1, 10),
    ]
    detail_data = [
        [Paragraph("Receipt No", header_style), Paragraph(str(payment["id"]), cell_style)],
        [Paragraph("Date", header_style), Paragraph(str(paid_at)[:19] or "-", cell_style)],
        [Paragraph("Amount", header_style), Paragraph(f"Rs {amount_rupees:.2f}", cell_style)],
        [Paragraph("Status", header_style), Paragraph(status, cell_style)],
        [Paragraph("Type / Purpose", header_style), Paragraph(purpose, cell_style)],
        [Paragraph(counterparty_label, header_style), Paragraph(counterparty_name, cell_style)],
    ]
    table = Table(detail_data, colWidths=[150, 370])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#065f46")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(table)
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "<i>This is a computer generated receipt and does not require a physical signature.</i>",
        sub_style,
    ))

    doc.build(story)
    buffer.seek(0)
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="receipt_{payment["id"]}.pdf"'},
    )


@router.post("/{payment_id}/refund-request")
async def request_refund(payment_id: str, uid: str = Depends(current_user_id)):
    """Payer-initiated refund request. Idempotent: re-requests return the doc.

    Only marks the request — the admin `/refund` rail executes the money
    movement after review.
    """
    await hit("payments", uid, 20, 60)
    payment = await get_doc("payments", payment_id)
    if payment is None:
        _error(404, "PAYMENT_NOT_FOUND", "payment not found")
    payer_id = _first(payment, *_TX_SOURCES[0]["payerFields"])
    if payer_id != uid:
        _error(403, "FORBIDDEN", "only the payer can request a refund")
    if payment.get("refundStatus") == "requested":
        return payment
    status = str(_first(payment, "status", "state") or "").lower()
    if status not in _TX_SUCCESS_STATUSES:
        _error(409, "REFUND_NOT_APPLICABLE", "only captured or successful payments can be refunded")
    payment["refundStatus"] = "requested"
    payment["refundRequestedAt"] = _now()
    await set_doc("payments", payment_id, payment)

    notification_id = f"ntf_{uuid.uuid4().hex}"
    amount_rupees = _amount_rupees(payment, True)
    await set_doc(
        "notifications",
        notification_id,
        {
            "id": notification_id,
            "userId": uid,
            "title": "Refund requested",
            "body": f"Your refund request for ₹{amount_rupees:.2f} ({payment.get('purpose') or 'payment'}) was received. We will review it shortly.",
            "type": "payment_refund_requested",
            "read": False,
            "createdAt": _now(),
        },
    )
    return payment
