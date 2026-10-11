"""Export trade module: RFQs from exporters, seller quotes, export orders with
shipment / documents / LC-remittance finance, supplier aggregation, analytics.

Collections: export_rfqs (erq_), export_quotes (exq_), export_orders (exo_).
Accepting a quote mirrors the purchases.py doc shape (exporter = buyer, seller
occupies the supplier slot) so settlement, chat and calls all work unchanged.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.exporter import (
    LcIn,
    OrderDocumentIn,
    OrderStatusIn,
    QuoteAccept,
    QuoteCreate,
    RemittanceIn,
    RfqCreate,
    ShipmentEventIn,
    ShipmentIn,
)
from app.routers.users import require_role
from app.services import idempotency
from app.services import settlements as settlements_service
from app.services.chat import ensure_chat_room, ensure_direct_room
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(prefix="/exporter", tags=["exporter"])

# Forward-only flow (cancelled is a terminal side state, not a flow position).
ORDER_FLOW = [
    "confirmed",
    "sourcing",
    "packed",
    "pickedUp",
    "inTransit",
    "customsCleared",
    "shipped",
    "delivered",
]
CANCELABLE_STATUSES = ("confirmed", "sourcing")

REQUIRED_SHIPMENT_DOCS = [
    "phytosanitary",
    "fumigation",
    "commercialInvoice",
    "packingList",
    "certificateOfOrigin",
    "healthCertificate",
]

RFQ_MATCH_NOTIFY_CAP = 50


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_dt(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


async def _exporter(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "exporter")
    return uid


async def _seller(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "seller")
    return uid


async def _own_rfq(rfq_id: str, uid: str) -> dict:
    rfq = await get_doc("export_rfqs", rfq_id)
    if rfq is None:
        _error(404, "RFQ_NOT_FOUND", "export RFQ not found")
    if rfq.get("exporterId") != uid:
        _error(403, "RFQ_FORBIDDEN", "only the RFQ owner can access this")
    return rfq


async def _own_order(order_id: str, uid: str) -> dict:
    order = await get_doc("export_orders", order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "export order not found")
    if order.get("exporterId") != uid:
        _error(403, "ORDER_FORBIDDEN", "only the exporter can access this order")
    return order


async def _order_participant(order_id: str, uid: str) -> tuple[dict, bool]:
    """Order + is_owner. Line sellers get a sanitized (finance-stripped) view."""
    order = await get_doc("export_orders", order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "export order not found")
    seller_ids = [line.get("sellerId") for line in (order.get("lines") or [])]
    if uid != order.get("exporterId") and uid not in seller_ids:
        _error(403, "ORDER_FORBIDDEN", "you are not a party to this export order")
    return order, uid == order.get("exporterId")


def _order_totals(lines: list[dict]) -> dict:
    return {
        "totalQuintals": round(sum(float(l.get("quantityQuintals") or 0) for l in lines), 3),
        "totalValue": int(round(sum(float(l.get("lineValue") or 0) for l in lines))),
    }


def _documents_checklist(order: dict) -> dict:
    uploaded = sorted({doc.get("docType") for doc in (order.get("documents") or [])})
    missing = [doc_type for doc_type in REQUIRED_SHIPMENT_DOCS if doc_type not in uploaded]
    return {
        "required": list(REQUIRED_SHIPMENT_DOCS),
        "uploaded": uploaded,
        "missing": missing,
    }


def _purchase_paid(purchase: dict) -> int:
    return int(sum(p.get("amount", 0) or 0 for p in purchase.get("payments") or []))


async def _finance_block(order: dict) -> dict:
    order_value = int((order.get("totals") or {}).get("totalValue") or 0)
    supplier_paid = 0
    supplier_due = 0
    completed_value = 0
    for line in order.get("lines") or []:
        purchase = await get_doc("purchases", line.get("purchaseId") or "")
        if purchase is None:
            continue
        billable = int(purchase.get("finalAmount") or purchase.get("totalAmount") or 0)
        paid = _purchase_paid(purchase)
        supplier_paid += paid
        supplier_due += max(billable - paid, 0)
        if purchase.get("status") == "completed":
            completed_value += billable
    config = await settlements_service._config()
    pct = float(config.get("sellerPct", 2))
    floor = int(config.get("sellerMinRupees", 50))
    platform_fees = (
        max(floor, round(completed_value * pct / 100)) if completed_value > 0 else 0
    )
    remittances = order.get("remittances") or []
    remittance_total = int(round(sum(float(r.get("amount") or 0) for r in remittances)))
    return {
        "orderValue": order_value,
        "supplierPaid": supplier_paid,
        "supplierDue": supplier_due,
        "platformFees": platform_fees,
        "remittanceTotal": remittance_total,
        "balanceVsRemittances": order_value - remittance_total,
    }


def _order_view(order: dict, is_owner: bool) -> dict:
    if is_owner:
        return order
    sanitized = {k: v for k, v in order.items() if k not in ("lc", "remittances")}
    sanitized.pop("financeSummary", None)
    return sanitized


def _append_order_event(order: dict, action: str, note: str | None = None):
    order.setdefault("events", []).append({"at": _now(), "action": action, "note": note})


async def _quotes_analytics(rfq: dict, quotes: list[dict]) -> dict:
    live = [q for q in quotes if q.get("status") == "pending"]
    rates = [float(q.get("ratePerQuintal") or 0) for q in live]
    total_available = round(sum(float(q.get("availableQuintals") or 0) for q in live), 3)
    best_quote_id = None
    cheapest_full_qty_cost = None
    if live:
        ranked = sorted(live, key=lambda q: float(q.get("ratePerQuintal") or 0))
        best_quote_id = ranked[0]["id"]
        needed = float(rfq.get("quantityQuintals") or 0)
        cost = 0.0
        for quote in ranked:
            take = min(float(quote.get("availableQuintals") or 0), needed)
            cost += take * float(quote.get("ratePerQuintal") or 0)
            needed -= take
            if needed <= 0:
                break
        if needed <= 0:
            cheapest_full_qty_cost = int(round(cost))
    return {
        "count": len(quotes),
        "bestRate": min(rates) if rates else None,
        "avgRate": round(sum(rates) / len(rates), 2) if rates else None,
        "totalAvailableQty": total_available,
        "bestQuoteId": best_quote_id,
        "cheapestFullQtyCost": cheapest_full_qty_cost,
    }


async def _exporter_summary(exporter_id: str) -> dict:
    user = await get_user(exporter_id) or {}
    profile = await get_doc(f"users/{exporter_id}/role_profiles", "exporter") or {}
    cases = await query("kyc_cases", [("userId", "==", exporter_id)], limit=50)
    cases = [c for c in cases if c.get("persona") == "exporter"]
    cases.sort(key=lambda c: c.get("submittedAt") or "", reverse=True)
    kyc_status = cases[0].get("status") if cases else None
    return {
        "exporterId": exporter_id,
        "name": user.get("name", ""),
        "companyName": profile.get("companyName", ""),
        "verified": kyc_status == "verified",
        "kycStatus": kyc_status,
    }


async def _notify_matching_sellers(rfq: dict) -> int:
    """Seller_stock owners with a matching active crop get one RFQ ping each."""
    stocks = await query("seller_stock", [("status", "==", "active")], limit=2000)
    crop = (rfq.get("crop") or "").lower()
    seller_ids: list[str] = []
    for stock in stocks:
        if (stock.get("crop") or "").lower() != crop:
            continue
        seller_id = stock.get("sellerId")
        if seller_id and seller_id not in seller_ids:
            seller_ids.append(seller_id)
    notified = 0
    for seller_id in seller_ids[:RFQ_MATCH_NOTIFY_CAP]:
        await notify_user(
            seller_id,
            type="rfq_matched",
            title="New export RFQ / नया निर्यात आरएफक्यू",
            body=f"{rfq.get('crop')} — {rfq.get('quantityQuintals')} quintals wanted",
            deepLink="/dashboard/p/seller/export-rfqs",
        )
        notified += 1
    return notified


# ==========================================
# RFQs (export_rfqs, ids erq_)
# ==========================================


@router.post("/rfqs", status_code=201)
async def create_rfq(
    body: RfqCreate,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_exporter),
):
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required")
    scope = "exporter.rfqs"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    window_from = _parse_dt(body.deliveryWindow.from_)
    window_to = _parse_dt(body.deliveryWindow.to)
    if window_from and window_to and window_from > window_to:
        _error(
            422,
            "VALIDATION_ERROR",
            "invalid delivery window",
            {"deliveryWindow": "from must be on or before to"},
        )
    now = _now()
    doc = {
        **body.model_dump(by_alias=True),
        "id": f"erq_{uuid.uuid4().hex[:12]}",
        "exporterId": uid,
        "status": "open",
        "fulfilledQuintals": 0.0,
        "createdAt": now,
        "closedAt": None,
    }
    await set_doc("export_rfqs", doc["id"], doc)
    await _notify_matching_sellers(doc)
    await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.get("/rfqs/browse")
async def browse_rfqs(
    crop: str | None = None,
    deliveryLocation: str | None = None,
    minRate: float | None = None,
    sort: str = "newest",
    uid: str = Depends(_seller),
):
    """Open export RFQs visible to sellers (farmers excluded)."""
    docs = await query("export_rfqs", [("status", "==", "open")], limit=1000)
    if crop:
        docs = [d for d in docs if crop.lower() in d.get("crop", "").lower()]
    if deliveryLocation:
        docs = [
            d
            for d in docs
            if deliveryLocation.lower() in (d.get("deliveryLocation") or "").lower()
        ]
    if minRate is not None:
        docs = [
            d
            for d in docs
            if d.get("maxRatePerQuintal") is None
            or float(d.get("maxRatePerQuintal") or 0) >= minRate
        ]
    if sort == "quantity":
        docs.sort(key=lambda d: float(d.get("quantityQuintals") or 0), reverse=True)
    elif sort == "rate":
        docs.sort(
            key=lambda d: (
                float(d.get("maxRatePerQuintal") or 0) if d.get("maxRatePerQuintal") else float("inf")
            )
        )
    else:
        docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    enriched = []
    for rfq in docs:
        enriched.append({**rfq, "exporter": await _exporter_summary(rfq.get("exporterId") or "")})
    return {"data": enriched, "total": len(enriched)}


@router.get("/rfqs")
async def list_rfqs(status: str | None = None, uid: str = Depends(_exporter)):
    docs = await query("export_rfqs", [("exporterId", "==", uid)], limit=1000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    enriched = []
    for rfq in docs:
        quotes = await query("export_quotes", [("rfqId", "==", rfq["id"])], limit=1000)
        enriched.append({**rfq, "quoteCount": len(quotes)})
    return {"data": enriched, "total": len(enriched)}


@router.get("/rfqs/{rfq_id}")
async def get_rfq(rfq_id: str, uid: str = Depends(_exporter)):
    rfq = await _own_rfq(rfq_id, uid)
    quotes = await query("export_quotes", [("rfqId", "==", rfq_id)], limit=1000)
    return {**rfq, "quotesSummary": await _quotes_analytics(rfq, quotes)}


@router.post("/rfqs/{rfq_id}/close")
async def close_rfq(rfq_id: str, uid: str = Depends(_exporter)):
    rfq = await _own_rfq(rfq_id, uid)
    if rfq.get("status") != "open":
        _error(409, "RFQ_NOT_OPEN", "only an open RFQ can be closed")
    rfq["status"] = "closed"
    rfq["closedAt"] = _now()
    await set_doc("export_rfqs", rfq_id, rfq)
    return rfq


@router.post("/rfqs/{rfq_id}/reopen")
async def reopen_rfq(rfq_id: str, uid: str = Depends(_exporter)):
    rfq = await _own_rfq(rfq_id, uid)
    if rfq.get("status") != "closed":
        _error(409, "RFQ_NOT_CLOSED", "only a closed RFQ can be reopened")
    rfq["status"] = "open"
    rfq["closedAt"] = None
    await set_doc("export_rfqs", rfq_id, rfq)
    return rfq


@router.delete("/rfqs/{rfq_id}", status_code=204)
async def delete_rfq(rfq_id: str, uid: str = Depends(_exporter)):
    rfq = await _own_rfq(rfq_id, uid)
    if rfq.get("status") != "open":
        _error(409, "RFQ_NOT_OPEN", "only an open RFQ can be deleted")
    await delete_doc("export_rfqs", rfq_id)


# ==========================================
# QUOTES (export_quotes, ids exq_)
# ==========================================


@router.post("/rfqs/{rfq_id}/quotes", status_code=201)
async def create_quote(rfq_id: str, body: QuoteCreate, uid: str = Depends(_seller)):
    rfq = await get_doc("export_rfqs", rfq_id)
    if rfq is None:
        _error(404, "RFQ_NOT_FOUND", "export RFQ not found")
    if rfq.get("status") != "open":
        _error(409, "RFQ_NOT_OPEN", "this RFQ is not open for quotes")
    ready_at = _parse_dt(body.readyDate)
    today = datetime.now(timezone.utc)
    if ready_at is None:
        _error(422, "VALIDATION_ERROR", "invalid ready date", {"readyDate": "must be a valid date"})
    if ready_at.date() < today.date():
        _error(422, "VALIDATION_ERROR", "invalid ready date", {"readyDate": "must not be in the past"})

    seller = await get_user(uid) or {}
    exporter_id = rfq.get("exporterId") or ""
    exporter = await get_user(exporter_id) or {}

    existing = await query(
        "export_quotes", [("rfqId", "==", rfq_id), ("sellerId", "==", uid)], limit=10
    )
    live = [q for q in existing if q.get("status") == "pending"]
    now = _now()
    if live:
        # One live quote per seller per RFQ: a re-POST refreshes the pending one.
        quote = live[0]
        quote.update(
            {
                "ratePerQuintal": body.ratePerQuintal,
                "availableQuintals": body.availableQuintals,
                "grade": body.grade,
                "pickupLocation": body.pickupLocation,
                "readyDate": body.readyDate,
                "paymentTermsDays": body.paymentTermsDays,
                "notes": body.notes,
                "updatedAt": now,
            }
        )
        await set_doc("export_quotes", quote["id"], quote)
    else:
        quote = {
            **body.model_dump(),
            "id": f"exq_{uuid.uuid4().hex[:12]}",
            "rfqId": rfq_id,
            "exporterId": exporter_id,
            "sellerId": uid,
            "sellerName": seller.get("name", ""),
            "status": "pending",
            "createdAt": now,
        }
        await set_doc("export_quotes", quote["id"], quote)
        await notify_user(
            exporter_id,
            type="quote_received",
            title="New export quote / नया निर्यात कोटेशन",
            body=f"{quote['sellerName'] or 'A seller'} quoted ₹{body.ratePerQuintal}/quintal for {rfq.get('crop')}",
            deepLink=f"/dashboard/p/exporter/rfqs/{rfq_id}",
        )
    room = await ensure_direct_room(
        exporter_id, exporter.get("name", ""), uid, seller.get("name", ""), rfq.get("crop", "")
    )
    return {**quote, "chatRoomId": room["id"]}


@router.get("/rfqs/{rfq_id}/quotes")
async def list_rfq_quotes(rfq_id: str, uid: str = Depends(_exporter)):
    rfq = await _own_rfq(rfq_id, uid)
    quotes = await query("export_quotes", [("rfqId", "==", rfq_id)], limit=1000)
    quotes.sort(key=lambda q: float(q.get("ratePerQuintal") or 0))
    return {
        "data": quotes,
        "analytics": await _quotes_analytics(rfq, quotes),
    }


@router.get("/quotes/mine")
async def my_quotes(uid: str = Depends(_seller)):
    docs = await query("export_quotes", [("sellerId", "==", uid)], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    enriched = []
    for quote in docs:
        rfq = await get_doc("export_rfqs", quote.get("rfqId") or "") or {}
        enriched.append(
            {
                **quote,
                "rfq": {
                    "crop": rfq.get("crop"),
                    "quantityQuintals": rfq.get("quantityQuintals"),
                    "deliveryLocation": rfq.get("deliveryLocation"),
                    "deliveryWindow": rfq.get("deliveryWindow"),
                    "status": rfq.get("status"),
                },
            }
        )
    return {"data": enriched, "total": len(enriched)}


@router.post("/quotes/{quote_id}/accept", status_code=201)
async def accept_quote(
    quote_id: str,
    body: QuoteAccept,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_exporter),
):
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required")
    scope = f"exporter.quotes.accept.{quote_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    quote = await get_doc("export_quotes", quote_id)
    if quote is None:
        _error(404, "QUOTE_NOT_FOUND", "export quote not found")
    if quote.get("exporterId") != uid:
        _error(403, "QUOTE_FORBIDDEN", "this quote belongs to another exporter")
    if quote.get("status") != "pending":
        _error(409, "QUOTE_NOT_PENDING", "only a pending quote can be accepted")
    rfq = await get_doc("export_rfqs", quote.get("rfqId") or "")
    if rfq is None:
        _error(404, "RFQ_NOT_FOUND", "export RFQ not found")
    if rfq.get("status") != "open":
        _error(409, "RFQ_NOT_OPEN", "this RFQ is closed")
    qty = float(body.quantityQuintals) if body.quantityQuintals is not None else float(
        quote.get("availableQuintals") or 0
    )
    available = float(quote.get("availableQuintals") or 0)
    if qty <= 0 or qty > available:
        _error(
            422,
            "VALIDATION_ERROR",
            "invalid quantity",
            {"quantityQuintals": f"must be between 0 and the available {available}"},
        )
    order = None
    if body.orderId:
        order = await get_doc("export_orders", body.orderId)
        if order is None:
            _error(404, "ORDER_NOT_FOUND", "export order not found")
        if order.get("exporterId") != uid:
            _error(403, "ORDER_FORBIDDEN", "this export order belongs to another exporter")

    now = _now()
    rate = float(quote.get("ratePerQuintal") or 0)
    line_value = int(round(rate * qty))
    crop = rfq.get("crop", "")
    seller_id = quote.get("sellerId") or ""
    seller = await get_user(seller_id) or {}
    exporter = await get_user(uid) or {}

    quote["status"] = "accepted"
    quote["acceptedQuintals"] = qty
    quote["acceptedAt"] = now
    await set_doc("export_quotes", quote_id, quote)

    purchase = {
        "id": f"pur_{uuid.uuid4().hex[:12]}",
        "buyerId": uid,
        "buyerName": exporter.get("name", ""),
        "farmerId": seller_id,
        "farmerName": seller.get("name", ""),
        "source": {"type": "export_quote", "refId": quote["id"]},
        "crop": crop,
        "variety": rfq.get("variety", ""),
        "quantity": qty,
        "unit": "quintal",
        "agreedPricePerUnit": rate,
        "totalAmount": line_value,
        "advancePaid": 0,
        "status": "confirmed",
        "pickup": None,
        "payments": [],
        "qc": None,
        "finalAmount": None,
        "invoice": None,
        "events": [{"status": "confirmed", "at": now, "note": f"export quote {quote_id}"}],
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
        "exportOrderId": None,
        "createdAt": now,
        "updatedAt": now,
    }
    line = {
        "purchaseId": purchase["id"],
        "sellerId": seller_id,
        "sellerName": seller.get("name", ""),
        "crop": crop,
        "quantityQuintals": qty,
        "ratePerQuintal": rate,
        "lineValue": line_value,
        "purchaseStatus": "confirmed",
    }

    if order is None:
        order = {
            "id": f"exo_{uuid.uuid4().hex[:12]}",
            "exporterId": uid,
            "title": f"{crop} export order",
            "status": "confirmed",
            "lines": [],
            "totals": {"totalQuintals": 0.0, "totalValue": 0},
            "documents": [],
            "remittances": [],
            "events": [],
            "createdAt": now,
        }
        _append_order_event(order, "created", f"RFQ {rfq['id']}")
    purchase["exportOrderId"] = order["id"]
    order.setdefault("lines", []).append(line)
    order["totals"] = _order_totals(order["lines"])
    order["updatedAt"] = now
    await set_doc("purchases", purchase["id"], purchase)
    await set_doc("export_orders", order["id"], order)
    await ensure_chat_room(purchase)
    await notify_user(
        seller_id,
        type="quote_accepted",
        title="Quote accepted / कोटेशन स्वीकृत",
        body=f"{crop} — {qty} quintals @ ₹{rate}/quintal",
        deepLink=f"/dashboard/p/purchases/{purchase['id']}",
    )

    rfq["fulfilledQuintals"] = round(float(rfq.get("fulfilledQuintals") or 0) + qty, 3)
    if rfq["fulfilledQuintals"] >= float(rfq.get("quantityQuintals") or 0):
        rfq["status"] = "closed"
        rfq["closedAt"] = now
        siblings = await query("export_quotes", [("rfqId", "==", rfq["id"])], limit=1000)
        for sibling in siblings:
            if sibling.get("status") == "pending" and sibling["id"] != quote_id:
                sibling["status"] = "withdrawn"
                sibling["withdrawnAt"] = now
                await set_doc("export_quotes", sibling["id"], sibling)
                await notify_user(
                    sibling.get("sellerId") or "",
                    type="quote_withdrawn",
                    title="Quote withdrawn / कोटेशन वापस",
                    body=f"{rfq.get('crop')} RFQ is fully fulfilled — your pending quote was withdrawn",
                    deepLink="/dashboard/p/seller/export-quotes",
                )
    rfq["updatedAt"] = now
    await set_doc("export_rfqs", rfq["id"], rfq)

    res = {"purchase": purchase, "order": order, "quote": quote}
    await idempotency.store(scope, idempotency_key, res)
    return res


@router.post("/quotes/{quote_id}/reject")
async def reject_quote(quote_id: str, uid: str = Depends(_exporter)):
    quote = await get_doc("export_quotes", quote_id)
    if quote is None:
        _error(404, "QUOTE_NOT_FOUND", "export quote not found")
    if quote.get("exporterId") != uid:
        _error(403, "QUOTE_FORBIDDEN", "this quote belongs to another exporter")
    if quote.get("status") != "pending":
        _error(409, "QUOTE_NOT_PENDING", "only a pending quote can be rejected")
    quote["status"] = "rejected"
    quote["rejectedAt"] = _now()
    await set_doc("export_quotes", quote_id, quote)
    return quote


# ==========================================
# EXPORT ORDERS (export_orders, ids exo_)
# ==========================================


@router.get("/orders")
async def list_orders(status: str | None = None, uid: str = Depends(_exporter)):
    docs = await query("export_orders", [("exporterId", "==", uid)], limit=1000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.get("/orders/{order_id}")
async def get_order(order_id: str, uid: str = Depends(current_user_id)):
    order, is_owner = await _order_participant(order_id, uid)
    view = _order_view(order, is_owner)
    view = {**view, "documentsChecklist": _documents_checklist(order)}
    if is_owner:
        view = {**view, "financeSummary": await _finance_block(order)}
    return view


@router.post("/orders/{order_id}/status")
async def set_order_status(order_id: str, body: OrderStatusIn, uid: str = Depends(_exporter)):
    order = await _own_order(order_id, uid)
    current = order.get("status")
    target = body.status
    if target == "cancelled":
        if current not in CANCELABLE_STATUSES:
            _error(409, "INVALID_ORDER_STATUS", f"cannot cancel an order in {current}")
    elif target in ORDER_FLOW:
        if current not in ORDER_FLOW or ORDER_FLOW.index(target) <= ORDER_FLOW.index(current):
            _error(
                409,
                "INVALID_ORDER_STATUS",
                f"cannot move order from {current} to {target}",
            )
    else:
        _error(409, "INVALID_ORDER_STATUS", f"unknown order status {target}")
    order["status"] = target
    _append_order_event(order, target, body.note)
    order["updatedAt"] = _now()
    await set_doc("export_orders", order_id, order)
    if target in ("pickedUp", "shipped"):
        seller_ids = {line.get("sellerId") for line in (order.get("lines") or [])}
        for seller_id in seller_ids:
            await notify_user(
                seller_id or "",
                type="order_status",
                title="Export order update / निर्यात आर्डर अपडेट",
                body=f"{order.get('title')} is now {target}",
                deepLink="/dashboard/p/seller/orders",
            )
    return order


@router.put("/orders/{order_id}/shipment")
async def set_shipment(order_id: str, body: ShipmentIn, uid: str = Depends(_exporter)):
    order = await _own_order(order_id, uid)
    if order.get("status") in ("delivered", "cancelled"):
        _error(409, "INVALID_ORDER_STATUS", "shipment cannot change after delivery/cancel")
    for container_no in body.containerNos:
        if not (container_no or "").strip():
            _error(422, "VALIDATION_ERROR", "invalid container", {"containerNos": "must be non-empty strings"})
    existing_events = (order.get("shipment") or {}).get("events") or []
    order["shipment"] = {
        **body.model_dump(),
        "containerNos": [str(c).strip() for c in body.containerNos],
        "events": existing_events,
    }
    order["updatedAt"] = _now()
    await set_doc("export_orders", order_id, order)
    return order


@router.post("/orders/{order_id}/shipment/events")
async def add_shipment_event(order_id: str, body: ShipmentEventIn, uid: str = Depends(_exporter)):
    order = await _own_order(order_id, uid)
    if order.get("status") in ("delivered", "cancelled"):
        _error(409, "INVALID_ORDER_STATUS", "shipment is closed for this order")
    shipment = order.setdefault("shipment", None)
    if shipment is None:
        _error(409, "SHIPMENT_NOT_SET", "set the shipment block before logging events")
    at = body.at or _now()
    shipment.setdefault("events", []).append(
        {"event": body.event, "location": body.location, "at": at, "note": body.note}
    )
    _append_order_event(order, body.event, body.note)
    # Auto-sync: departed → inTransit, cleared → customsCleared, delivered → delivered.
    auto_status = {
        "departed": "inTransit",
        "cleared": "customsCleared",
        "delivered": "delivered",
    }.get(body.event)
    if auto_status and auto_status != order.get("status"):
        current = order.get("status")
        if current in ORDER_FLOW and ORDER_FLOW.index(auto_status) > ORDER_FLOW.index(current):
            order["status"] = auto_status
            _append_order_event(order, auto_status, f"auto:{body.event}")
    order["updatedAt"] = _now()
    await set_doc("export_orders", order_id, order)
    return order


# ==========================================
# DOCUMENTS + CHECKLIST
# ==========================================


@router.post("/orders/{order_id}/documents", status_code=201)
async def add_order_document(order_id: str, body: OrderDocumentIn, uid: str = Depends(_exporter)):
    order = await _own_order(order_id, uid)
    doc = {
        **body.model_dump(),
        "id": f"doc_{uuid.uuid4().hex[:12]}",
        "uploadedAt": _now(),
    }
    order.setdefault("documents", []).append(doc)
    order["updatedAt"] = _now()
    await set_doc("export_orders", order_id, order)
    return doc


@router.get("/orders/{order_id}/documents")
async def list_order_documents(order_id: str, uid: str = Depends(current_user_id)):
    order, _is_owner = await _order_participant(order_id, uid)
    return {
        "data": order.get("documents") or [],
        "checklist": _documents_checklist(order),
    }


@router.delete("/orders/{order_id}/documents/{doc_id}", status_code=204)
async def delete_order_document(order_id: str, doc_id: str, uid: str = Depends(_exporter)):
    order = await _own_order(order_id, uid)
    documents = order.get("documents") or []
    remaining = [doc for doc in documents if doc.get("id") != doc_id]
    if len(remaining) == len(documents):
        _error(404, "DOCUMENT_NOT_FOUND", "document not found on this order")
    order["documents"] = remaining
    order["updatedAt"] = _now()
    await set_doc("export_orders", order_id, order)


# ==========================================
# FINANCE (LC + remittances)
# ==========================================


@router.post("/orders/{order_id}/lc")
async def set_order_lc(order_id: str, body: LcIn, uid: str = Depends(_exporter)):
    order = await _own_order(order_id, uid)
    order["lc"] = {
        **body.model_dump(),
        "status": "confirmed",
        "createdAt": _now(),
    }
    order["updatedAt"] = _now()
    await set_doc("export_orders", order_id, order)
    return order["lc"]


@router.post("/orders/{order_id}/remittances", status_code=201)
async def add_remittance(order_id: str, body: RemittanceIn, uid: str = Depends(_exporter)):
    order = await _own_order(order_id, uid)
    remittance = {**body.model_dump(), "id": f"rem_{uuid.uuid4().hex[:12]}", "createdAt": _now()}
    order.setdefault("remittances", []).append(remittance)
    order["updatedAt"] = _now()
    await set_doc("export_orders", order_id, order)
    return remittance


@router.get("/orders/{order_id}/finance")
async def order_finance(order_id: str, uid: str = Depends(_exporter)):
    order = await _own_order(order_id, uid)
    return {
        **await _finance_block(order),
        "lc": order.get("lc"),
        "remittances": order.get("remittances") or [],
    }


# ==========================================
# SUPPLIERS
# ==========================================


async def _suppliers_for(exporter_id: str) -> list[dict]:
    orders = await query("export_orders", [("exporterId", "==", exporter_id)], limit=1000)
    grouped: dict[str, dict] = {}
    order_ids: dict[str, set] = {}
    for order in orders:
        for line in order.get("lines") or []:
            seller_id = line.get("sellerId") or ""
            if not seller_id:
                continue
            row = grouped.setdefault(
                seller_id,
                {
                    "sellerId": seller_id,
                    "name": line.get("sellerName") or "",
                    "role": "seller",
                    "totalQuintals": 0.0,
                    "totalValue": 0,
                    "ordersCount": 0,
                    "lastDealAt": "",
                },
            )
            if not row["name"]:
                row["name"] = line.get("sellerName") or ""
            row["totalQuintals"] = round(
                row["totalQuintals"] + float(line.get("quantityQuintals") or 0), 3
            )
            row["totalValue"] += int(round(float(line.get("lineValue") or 0)))
            order_ids.setdefault(seller_id, set()).add(order.get("id"))
            if (order.get("createdAt") or "") > row["lastDealAt"]:
                row["lastDealAt"] = order.get("createdAt") or ""
    # Purchases not linked to an order line yet still count as deals.
    purchases = await query("purchases", [("buyerId", "==", exporter_id)], limit=2000)
    for purchase in purchases:
        source = purchase.get("source") or {}
        if not (isinstance(source, dict) and source.get("type") == "export_quote"):
            continue
        seller_id = purchase.get("farmerId") or ""
        if not seller_id or seller_id in grouped:
            continue
        grouped[seller_id] = {
            "sellerId": seller_id,
            "name": purchase.get("farmerName") or "",
            "role": "seller",
            "totalQuintals": round(float(purchase.get("quantity") or 0), 3),
            "totalValue": int(round(float(purchase.get("totalAmount") or 0))),
            "ordersCount": 0,
            "lastDealAt": purchase.get("createdAt") or "",
        }
    rows = list(grouped.values())
    for row in rows:
        row["ordersCount"] = len(order_ids.get(row["sellerId"], set()))
    rows.sort(key=lambda r: r["totalValue"], reverse=True)
    return rows


@router.get("/suppliers")
async def list_suppliers(uid: str = Depends(_exporter)):
    return {"data": await _suppliers_for(uid)}


@router.get("/suppliers/saved")
async def list_saved_suppliers(uid: str = Depends(_exporter)):
    docs = await query(f"users/{uid}/saved_suppliers", [], limit=500)
    docs.sort(key=lambda d: d.get("savedAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.post("/suppliers/{seller_id}/save", status_code=201)
async def save_supplier(seller_id: str, uid: str = Depends(_exporter)):
    seller = await get_user(seller_id)
    if seller is None:
        _error(404, "SELLER_NOT_FOUND", "seller not found")
    doc = {"sellerId": seller_id, "name": seller.get("name", ""), "savedAt": _now()}
    await set_doc(f"users/{uid}/saved_suppliers", seller_id, doc)
    return doc


@router.delete("/suppliers/{seller_id}/saved", status_code=204)
async def unsave_supplier(seller_id: str, uid: str = Depends(_exporter)):
    await delete_doc(f"users/{uid}/saved_suppliers", seller_id)


# ==========================================
# ANALYTICS + DASHBOARD + PROFILE
# ==========================================


def _month_key(at: str | None) -> str:
    return (at or "")[:7]


async def _kpis(exporter_id: str) -> dict:
    orders = await query("export_orders", [("exporterId", "==", exporter_id)], limit=1000)
    rfqs = await query("export_rfqs", [("exporterId", "==", exporter_id)], limit=1000)
    purchases = await query("purchases", [("buyerId", "==", exporter_id)], limit=2000)
    active_orders = [o for o in orders if o.get("status") not in ("delivered", "cancelled")]
    open_rfqs = [r for r in rfqs if r.get("status") == "open"]
    quotes_pending = 0
    for rfq in rfqs:
        quotes = await query("export_quotes", [("rfqId", "==", rfq["id"])], limit=1000)
        quotes_pending += sum(1 for q in quotes if q.get("status") == "pending")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    shipped_last_30d = 0
    for order in orders:
        ship_ats = [
            e.get("at")
            for e in (order.get("events") or [])
            if e.get("action") in ("shipped", "delivered") and e.get("at")
        ]
        if ship_ats and min(ship_ats) >= cutoff:
            shipped_last_30d += 1
    total_spend = int(
        round(sum(float(p.get("totalAmount") or 0) for p in purchases if p.get("status") != "cancelled"))
    )
    supplier_ids = {p.get("farmerId") for p in purchases if p.get("farmerId")}
    for order in orders:
        supplier_ids |= {line.get("sellerId") for line in (order.get("lines") or [])}
    supplier_ids.discard(None)
    return {
        "activeOrders": len(active_orders),
        "openRfqs": len(open_rfqs),
        "quotesPending": quotes_pending,
        "shippedLast30d": shipped_last_30d,
        "totalSpend": total_spend,
        "supplierCount": len(supplier_ids),
    }


async def _analytics(exporter_id: str) -> dict:
    orders = await query("export_orders", [("exporterId", "==", exporter_id)], limit=1000)
    purchases = await query("purchases", [("buyerId", "==", exporter_id)], limit=2000)
    live_purchases = [p for p in purchases if p.get("status") != "cancelled"]

    # Last-12-month spend/quintals from purchase payments.
    monthly: dict[str, dict] = {}
    now = datetime.now(timezone.utc)
    for i in range(12):
        month = (now - timedelta(days=30 * i)).strftime("%Y-%m")
        monthly[month] = {"month": month, "spend": 0, "quintals": 0.0}
    for purchase in live_purchases:
        for payment in purchase.get("payments") or []:
            month = _month_key(payment.get("at"))
            if month in monthly:
                monthly[month]["spend"] += int(payment.get("amount") or 0)
                monthly[month]["quintals"] = round(
                    monthly[month]["quintals"] + float(purchase.get("quantity") or 0), 3
                )
    monthly_spend = sorted(monthly.values(), key=lambda m: m["month"])

    crop_map: dict[str, dict] = {}
    for purchase in live_purchases:
        crop = purchase.get("crop") or "Unknown"
        row = crop_map.setdefault(crop, {"crop": crop, "spend": 0, "quintals": 0.0})
        row["spend"] += int(round(float(purchase.get("totalAmount") or 0)))
        row["quintals"] = round(row["quintals"] + float(purchase.get("quantity") or 0), 3)
    crop_breakdown = sorted(crop_map.values(), key=lambda r: r["spend"], reverse=True)

    suppliers = await _suppliers_for(exporter_id)
    top_suppliers = [
        {"sellerId": s["sellerId"], "name": s["name"], "totalValue": s["totalValue"]}
        for s in suppliers[:5]
    ]

    qc_accepted = 0.0
    qc_rejected = 0.0
    for purchase in purchases:
        qc = purchase.get("qc")
        if not qc:
            continue
        qc_accepted += float(qc.get("acceptedQty") or 0)
        qc_rejected += float(qc.get("rejectedQty") or 0)
    qc_total = qc_accepted + qc_rejected
    qc_rejection_rate = round(qc_rejected / qc_total, 3) if qc_total > 0 else None

    on_time = 0
    delivered_with_eta = 0
    for order in orders:
        if order.get("status") != "delivered":
            continue
        eta = _parse_dt((order.get("shipment") or {}).get("eta"))
        if eta is None:
            continue
        delivered_ats = [
            _parse_dt(e.get("at"))
            for e in (order.get("events") or [])
            if e.get("action") == "delivered" and e.get("at")
        ]
        delivered_ats = [d for d in delivered_ats if d is not None]
        if not delivered_ats:
            continue
        delivered_with_eta += 1
        if min(delivered_ats) <= eta:
            on_time += 1
    on_time_rate = round(on_time / delivered_with_eta, 3) if delivered_with_eta > 0 else None

    return {
        "kpis": await _kpis(exporter_id),
        "monthlySpend": monthly_spend,
        "cropBreakdown": crop_breakdown,
        "topSuppliers": top_suppliers,
        "qcRejectionRate": qc_rejection_rate,
        "onTimeDeliveryRate": on_time_rate,
    }


@router.get("/analytics")
async def exporter_analytics(uid: str = Depends(_exporter)):
    return await _analytics(uid)


@router.get("/dashboard")
async def exporter_dashboard(uid: str = Depends(_exporter)):
    analytics = await _analytics(uid)
    orders = await query("export_orders", [("exporterId", "==", uid)], limit=1000)
    rfqs = await query("export_rfqs", [("exporterId", "==", uid)], limit=1000)
    orders.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    rfqs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)

    quotes_awaiting = 0
    for rfq in rfqs:
        if rfq.get("status") != "open":
            continue
        quotes = await query("export_quotes", [("rfqId", "==", rfq["id"])], limit=1000)
        if any(q.get("status") == "pending" for q in quotes):
            quotes_awaiting += 1
    orders_missing_docs = 0
    eta_soon = 0
    eta_cutoff = datetime.now(timezone.utc) + timedelta(days=7)
    for order in orders:
        if order.get("status") == "cancelled":
            continue
        if _documents_checklist(order)["missing"]:
            orders_missing_docs += 1
        etd = _parse_dt((order.get("shipment") or {}).get("etd"))
        if (
            etd is not None
            and datetime.now(timezone.utc) <= etd <= eta_cutoff
            and order.get("status") not in ("delivered", "cancelled")
        ):
            eta_soon += 1
    return {
        "kpis": analytics["kpis"],
        "pendingActions": {
            "quotesAwaiting": quotes_awaiting,
            "ordersMissingDocs": orders_missing_docs,
            "shipmentsEtaSoon": eta_soon,
        },
        "recentOrders": orders[:5],
        "recentRfqs": rfqs[:5],
    }


@router.get("/profile")
async def exporter_profile(uid: str = Depends(_exporter)):
    user = await get_user(uid) or {}
    role_profile = await get_doc(f"users/{uid}/role_profiles", "exporter") or {}
    cases = await query("kyc_cases", [("userId", "==", uid)], limit=50)
    cases = [c for c in cases if c.get("persona") == "exporter"]
    cases.sort(key=lambda c: c.get("submittedAt") or "", reverse=True)
    orders = await query("export_orders", [("exporterId", "==", uid)], limit=1000)
    purchases = await query("purchases", [("buyerId", "==", uid)], limit=2000)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    shipped_last_30d = 0
    for order in orders:
        ship_ats = [
            e.get("at")
            for e in (order.get("events") or [])
            if e.get("action") in ("shipped", "delivered") and e.get("at")
        ]
        if ship_ats and min(ship_ats) >= cutoff:
            shipped_last_30d += 1
    total_spend = int(
        round(sum(float(p.get("totalAmount") or 0) for p in purchases if p.get("status") != "cancelled"))
    )
    supplier_ids = {p.get("farmerId") for p in purchases if p.get("farmerId")}
    supplier_ids.discard(None)
    return {
        "user": user,
        "roleProfile": role_profile,
        "kyc": {"status": cases[0].get("status") if cases else None},
        "stats": {
            "activeOrders": len(
                [o for o in orders if o.get("status") not in ("delivered", "cancelled")]
            ),
            "totalOrders": len(orders),
            "shippedLast30d": shipped_last_30d,
            "totalSpend": total_spend,
            "supplierCount": len(supplier_ids),
        },
    }
