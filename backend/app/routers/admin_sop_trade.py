"""Superadmin SOP modules 04-07 — trade ops console endpoints.

Implements the doc-path contracts from docs/superadmin-instructions:
04 (vyapari rate approvals + Agmarknet sync), 05 (produce lots + trader
procurement audit), 06 (marketplace products/orders + refunds) and
07 (buyer contracts). Where an equivalent already exists under a legacy
path (`admin_console` mandi rate decisions, `/admin/orders/{id}/refund`)
this router keeps the doc path and shares the same backing collections:
`vyapari_rates_pending` (queue), `vyapari_rates` (live feed), `market_lots`,
`purchases` (real trader procurement records — the doc's `procurements`
collection has no writer), `products`, `orders` and `contracts` with the
`contracts/{id}/acceptances` subcollection for signed agreements.
"""
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.cache import cache_delete
from app.core.db import get_doc, query, set_doc
from app.models.contracts import ContractSchedule
from app.routers.contracts import (
    TERMINAL_STATUSES,
    _enrich_with_current_price,
    _sync_legacy_mirror,
    _validate_price_rule,
)
from app.services import approvals
from app.services.admin_auth import admin_mutation_context, current_admin_user
from app.services.audit import log_admin_action
from app.services.payments import refund_razorpay_payment
from app.services.sync import MandiSyncError, sync_mandi_prices
from app.services.users import get_user

router = APIRouter(prefix="/admin", tags=["admin"])

# Doc 04 guardrail: validate trader rates against ±15% of the Agmarknet modal
# price (same band the legacy admin console uses for its review queue).
MANDI_BAND = 0.15
MANDI_SYNC_JOB = "mandi_prices_sync"
TRADER_ROLES = ("seller", "directBuyer", "exporter")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _admin_id(admin: dict) -> str:
    return admin.get("id") or admin.get("uid") or "admin"


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _paginate(rows: list[dict], page: int, page_size: int) -> dict:
    start = (page - 1) * page_size
    return {"data": rows[start : start + page_size], "page": page, "pageSize": page_size, "total": len(rows)}


async def _users_map() -> dict[str, dict]:
    users = await query("users", None, limit=1000)
    return {u["id"]: u for u in users if u.get("id")}


def _modal_reference(crop: str, mandi_name: str, mandi_docs: list[dict]) -> Optional[dict]:
    """Agmarknet reference row for a crop, preferring a loose mandi match
    (same heuristic the seller posting flow uses for its ±band check)."""
    crop_l = (crop or "").lower()
    matches = [d for d in mandi_docs if crop_l and crop_l in (d.get("commodity") or "").lower()]
    if not matches:
        return None
    words = [w for w in (mandi_name or "").lower().split() if len(w) > 3]
    if words:
        for doc in matches:
            if any(w in (doc.get("mandiName") or "").lower() for w in words):
                return doc
    return matches[0]


def _band_flags(rate_per_kg: float, modal_quintal: float) -> tuple[float, bool]:
    """(modal ₹/quintal, outside ±15% band) — 0/False when no reference exists."""
    if not modal_quintal or not rate_per_kg:
        return 0.0, False
    per_quintal = rate_per_kg * 100
    out = not (modal_quintal * (1 - MANDI_BAND) <= per_quintal <= modal_quintal * (1 + MANDI_BAND))
    return round(modal_quintal, 2), out


# ===========================================================================
# Module 04 — Vyapari rate approval queue + Agmarknet sync
# ===========================================================================
@router.get("/rates/pending")
async def list_pending_rates(
    status: str = Query("pending", description="pending | approved | rejected | all"),
    crop: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Daily trader rate submission queue (`vyapari_rates_pending`) with the
    ±15% Agmarknet sanity-band flag the reviewer sees before deciding."""
    filters = None if status == "all" else [("status", "==", status)]
    docs = await query("vyapari_rates_pending", filters, limit=2000)
    mandi_docs = await query("mandi_prices", None, limit=1000)
    users_by_id = await _users_map()
    rows = []
    for doc in docs:
        if crop and crop.lower() not in (doc.get("crop") or "").lower():
            continue
        modal_doc = _modal_reference(doc.get("crop", ""), doc.get("mandiName", ""), mandi_docs)
        modal, out_of_band = _band_flags(
            float(doc.get("ratePerKg") or 0), float((modal_doc or {}).get("modalPrice") or 0)
        )
        seller = users_by_id.get(doc.get("sellerId", "")) or {}
        rows.append(
            {
                **doc,
                "modalPrice": modal or None,
                "outOfBand": out_of_band,
                "sellerName": seller.get("name", ""),
                "sellerPhone": seller.get("phone", ""),
            }
        )
    rows.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    return _paginate(rows, page, pageSize)


def _live_rate_doc_id(crop: str, mandi_name: str) -> str:
    digest = hashlib.sha256(f"{crop}|{mandi_name}".encode()).hexdigest()
    return f"vy_{digest[:12]}"


async def _publish_live_rate(rate: dict) -> str:
    """Upsert the approved rate into the live `vyapari_rates` feed (the
    collection `GET /mandi/vyapari-rates` serves, aggregated per crop+mandi)
    and invalidate the feed cache keys."""
    crop = rate.get("crop", "")
    mandi_name = rate.get("mandiName", "")
    live_id = _live_rate_doc_id(crop, mandi_name)
    mandi_docs = await query("mandi_prices", None, limit=1000)
    modal_doc = _modal_reference(crop, mandi_name, mandi_docs)
    modal_quintal = float((modal_doc or {}).get("modalPrice") or 0)
    rate_per_kg = float(rate.get("ratePerKg") or 0)
    delta = round(rate_per_kg * 100 - modal_quintal, 2) if modal_quintal else 0.0
    change_dir = "flat" if delta == 0 else ("up" if delta > 0 else "down")

    # vyapariCount = distinct traders with an approved rate for this crop+mandi.
    approved = await query("vyapari_rates_pending", [("crop", "==", crop), ("status", "==", "approved")], limit=2000)
    mandi_l = mandi_name.lower()
    reporters = {
        r.get("sellerId")
        for r in approved
        if (r.get("mandiName") or "").lower() == mandi_l
    }

    live_doc = {
        "id": live_id,
        "crop": crop,
        "rateDisplay": f"₹{rate_per_kg:g}/kg",
        "priceChange": f"{'+' if delta > 0 else ''}{delta:g}" if modal_quintal else "0",
        "changeDir": change_dir,
        "mandiName": mandi_name,
        "vyapariCount": max(1, len(reporters)),
        "lastUpdated": _now(),
        "ratePerKg": rate_per_kg,
        "approvedRateId": rate.get("id"),
    }
    await set_doc("vyapari_rates", live_id, live_doc)
    await cache_delete("vyapari_rates:all")
    await cache_delete(f"vyapari_rates:{crop}")
    return live_id


async def _decide_rate(rate_id: str, status: str, reason: str, ctx: dict) -> dict:
    rate = await get_doc("vyapari_rates_pending", rate_id)
    if rate is None:
        _error(404, "RATE_NOT_FOUND", "rate submission not found")
    if rate.get("status") in ("approved", "rejected"):
        _error(409, "RATE_ALREADY_REVIEWED", f"rate is already '{rate.get('status')}'")
    previous = {"status": rate.get("status")}
    now = _now()
    rate["status"] = status
    rate["reviewReason"] = reason
    rate["reviewedBy"] = _admin_id(ctx["admin"])
    rate["reviewedAt"] = now
    rate["updatedAt"] = now
    await set_doc("vyapari_rates_pending", rate_id, rate)
    live_id = None
    if status == "approved":
        live_id = await _publish_live_rate(rate)
    await log_admin_action(
        ctx["admin"], "rates", f"RATE_{status.upper()}", rate_id, previous,
        {"status": status, "liveRateId": live_id}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "id": rate_id, "status": status, "liveRateId": live_id}


@router.post("/rates/{rate_id}/approve")
async def approve_rate(rate_id: str, ctx: dict = Depends(admin_mutation_context)):
    """Approve a pending trader rate — it goes live on the mobile feed."""
    return await _decide_rate(rate_id, "approved", ctx["reason"], ctx)


class RateRejectIn(BaseModel):
    reason: str = Field(..., min_length=3, description="explanation sent back to the trader")


@router.post("/rates/{rate_id}/reject")
async def reject_rate(
    rate_id: str,
    body: RateRejectIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Reject a suspicious/predatory rate with feedback to the trader."""
    return await _decide_rate(rate_id, "rejected", body.reason, ctx)


@router.post("/mandi/sync")
async def trigger_mandi_sync(ctx: dict = Depends(admin_mutation_context)):
    """Trigger the manual Agmarknet/eNAM sync job (`services.sync.sync_mandi_prices`)
    and record a `cron_job_logs` row either way."""
    log_id = f"cron_{uuid.uuid4().hex[:12]}"
    admin_id = _admin_id(ctx["admin"])
    try:
        summary = await sync_mandi_prices()
    except MandiSyncError as exc:
        doc = {
            "id": log_id,
            "job": MANDI_SYNC_JOB,
            "ranAt": _now(),
            "status": "failed",
            "error": str(exc),
            "triggeredBy": admin_id,
            "reason": ctx["reason"],
        }
        await set_doc("cron_job_logs", log_id, doc)
        await log_admin_action(
            ctx["admin"], "mandi", "MANDI_SYNC", log_id, None,
            {"status": "failed", "error": str(exc)}, ctx["reason"], ctx["ip"],
        )
        return {"success": False, "logId": log_id, "status": "failed", "error": str(exc)}
    doc = {
        "id": log_id,
        "job": MANDI_SYNC_JOB,
        "ranAt": _now(),
        "status": "success",
        "rows": summary.get("rows", 0),
        "attempts": summary.get("attempts", 1),
        "lastSuccessAt": summary.get("last_success_at"),
        "triggeredBy": admin_id,
        "reason": ctx["reason"],
    }
    await set_doc("cron_job_logs", log_id, doc)
    await log_admin_action(
        ctx["admin"], "mandi", "MANDI_SYNC", log_id, None,
        {"status": "success", "rows": doc["rows"]}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "logId": log_id, "summary": summary}


# ===========================================================================
# Module 05 — Produce lots force-status + trader procurement audit
# ===========================================================================
class LotStatusIn(BaseModel):
    status: Literal["active", "suspended", "sold"]
    note: Optional[str] = None


# Platform lots use "open" for live listings (browse/discovery filters on it);
# the SOP doc vocabulary maps active -> open, suspended -> suspended.
_LOT_STATUS_MAP = {"active": "open", "suspended": "suspended", "sold": "sold"}


@router.put("/lots/{lot_id}/status")
async def force_lot_status(lot_id: str, body: LotStatusIn, ctx: dict = Depends(admin_mutation_context)):
    lot = await get_doc("market_lots", lot_id)
    if lot is None:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    previous_status = lot.get("status")
    if previous_status == "sold" and body.status != "sold":
        _error(409, "LOT_NOT_EDITABLE", "a sold lot is terminal and cannot be re-opened")
    mapped = _LOT_STATUS_MAP[body.status]
    previous = {"status": previous_status}
    now = _now()
    lot["status"] = mapped
    lot["statusReason"] = body.note or ctx["reason"]
    lot["statusUpdatedBy"] = _admin_id(ctx["admin"])
    lot["statusUpdatedAt"] = now
    lot["updatedAt"] = now
    await set_doc("market_lots", lot_id, lot)
    await log_admin_action(
        ctx["admin"], "lots", "UPDATE_LOT_STATUS", lot_id, previous,
        {"status": mapped, "note": body.note}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "id": lot_id, "status": mapped, "previousStatus": previous_status}


@router.get("/procurements")
async def list_procurements(
    status: Optional[str] = Query(None),
    buyerId: Optional[str] = Query(None),
    buyerRole: Optional[str] = Query(None, description=f"one of {TRADER_ROLES}; default: any trader role"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Audit trader procurement records and slips. The SOP doc names a
    `procurements` collection but no writer ever populates it — the real
    trader procurement records are the `purchases` docs booked by trader-role
    buyers (vyapari/seller, directBuyer, exporter), so those back this list."""
    if buyerRole and buyerRole not in TRADER_ROLES:
        _error(422, "VALIDATION_ERROR", f"buyerRole must be one of {', '.join(TRADER_ROLES)}", {"buyerRole": "invalid role"})
    docs = await query("purchases", None, limit=2000)
    users_by_id = await _users_map()
    allowed_roles = (buyerRole,) if buyerRole else TRADER_ROLES
    rows = []
    for doc in docs:
        buyer_id = doc.get("buyerId") or ""
        if buyerId and buyer_id != buyerId:
            continue
        buyer = users_by_id.get(buyer_id)
        roles = (buyer or {}).get("linkedProfiles") or []
        if not any(r in allowed_roles for r in roles):
            continue
        if status and doc.get("status") != status:
            continue
        if search:
            needle = search.lower()
            haystack = " ".join(
                str(doc.get(k) or "") for k in ("id", "crop", "buyerName", "farmerName", "buyerId", "farmerId")
            ).lower()
            if needle not in haystack:
                continue
        total = float(doc.get("totalAmount") or 0)
        paid = float(doc.get("advancePaid") or 0) + sum(
            float(p.get("amount") or 0) for p in doc.get("payments") or []
        )
        due = round(max(0.0, float(doc.get("finalAmount") or total) - paid), 2)
        escrow = doc.get("escrow") or {}
        rows.append(
            {
                **doc,
                "buyerVerified": bool((buyer or {}).get("vyapariVerified")),
                "paymentSummary": {
                    "totalAmount": doc.get("finalAmount") or total,
                    "paid": round(paid, 2),
                    "due": due,
                    "escrowStatus": escrow.get("status") or "unfunded",
                    "escrowAmount": escrow.get("amount") or 0,
                },
            }
        )
    rows.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    return _paginate(rows, page, pageSize)


# ===========================================================================
# Module 06 — Marketplace products CRUD + orders/refunds
# ===========================================================================
@router.get("/marketplace/products")
async def list_marketplace_products(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    docs = await query("products", None, limit=2000)
    rows = []
    for doc in docs:
        if category and doc.get("category") != category:
            continue
        if status and doc.get("status", "active") != status:
            continue
        if search:
            needle = search.lower()
            haystack = " ".join(str(doc.get(k) or "") for k in ("id", "title", "brand", "sellerName")).lower()
            if needle not in haystack:
                continue
        stock = doc.get("stock")
        rows.append({**doc, "stockState": "out_of_stock" if stock == 0 else "in_stock"})
    rows.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    return _paginate(rows, page, pageSize)


class ProductIn(BaseModel):
    title: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    brand: str = ""
    mrp: int = Field(..., gt=0)
    discountedPrice: int = Field(..., gt=0)
    stock: int = Field(0, ge=0)
    unit: str = ""
    description: Optional[str] = None
    imageUrl: Optional[str] = None
    status: Literal["active", "discontinued"] = "active"


@router.post("/marketplace/products", status_code=201)
async def create_marketplace_product(body: ProductIn, ctx: dict = Depends(admin_mutation_context)):
    if body.discountedPrice > body.mrp:
        _error(422, "VALIDATION_ERROR", "discounted price exceeds mrp", {"discountedPrice": "must not exceed mrp"})
    product_id = f"prod_{uuid.uuid4().hex[:10]}"
    admin_name = ctx["admin"].get("name") or "Agrovercity Admin"
    doc = {
        **body.model_dump(),
        "id": product_id,
        "sellerId": _admin_id(ctx["admin"]),
        "sellerName": admin_name,
        "dealerName": admin_name,
        "rating": 0.0,
        "reviewsCount": 0,
        "distanceKm": 0.0,
        "bnplAvailable": False,
        "batchNo": f"ADM-{uuid.uuid4().hex[:8].upper()}",
        "createdAt": _now(),
    }
    await set_doc("products", product_id, doc)
    await log_admin_action(
        ctx["admin"], "marketplace", "CREATE_PRODUCT", product_id, None,
        {"title": doc["title"], "status": doc["status"]}, ctx["reason"], ctx["ip"],
    )
    return doc


class ProductUpdateIn(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, min_length=1)
    brand: Optional[str] = None
    mrp: Optional[int] = Field(None, gt=0)
    discountedPrice: Optional[int] = Field(None, gt=0)
    stock: Optional[int] = Field(None, ge=0)
    unit: Optional[str] = None
    description: Optional[str] = None
    imageUrl: Optional[str] = None
    status: Optional[Literal["active", "discontinued"]] = None


@router.put("/marketplace/products/{product_id}")
async def update_marketplace_product(
    product_id: str, body: ProductUpdateIn, ctx: dict = Depends(admin_mutation_context)
):
    product = await get_doc("products", product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    updates = body.model_dump(exclude_none=True)
    merged_mrp = updates.get("mrp", product.get("mrp"))
    merged_price = updates.get("discountedPrice", product.get("discountedPrice"))
    if merged_mrp is not None and merged_price is not None and merged_price > merged_mrp:
        _error(422, "VALIDATION_ERROR", "discounted price exceeds mrp", {"discountedPrice": "must not exceed mrp"})
    previous = {k: product.get(k) for k in updates}
    for field, value in updates.items():
        product[field] = value
    product["updatedAt"] = _now()
    await set_doc("products", product_id, product)
    await log_admin_action(
        ctx["admin"], "marketplace", "UPDATE_PRODUCT", product_id, previous, updates, ctx["reason"], ctx["ip"]
    )
    return product


def _order_payment_status(order: dict) -> str:
    refund_status = order.get("refundStatus") or "none"
    if refund_status == "processed":
        return "refunded"
    if refund_status == "requested":
        return "refund_requested"
    if order.get("razorpayPaymentId"):
        return "paid"
    return "unpaid"


@router.get("/marketplace/orders")
async def list_marketplace_orders(
    status: Optional[str] = Query(None),
    paymentStatus: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Order lifecycle with delivery (`status`) and payment (`paymentStatus`,
    derived from refundStatus/razorpayPaymentId) columns."""
    docs = await query("orders", None, limit=2000)
    users_by_id = await _users_map()
    rows = []
    for doc in docs:
        if status and doc.get("status") != status:
            continue
        pay_status = _order_payment_status(doc)
        if paymentStatus and pay_status != paymentStatus:
            continue
        if search:
            needle = search.lower()
            haystack = f"{doc.get('id', '')} {doc.get('userId', '')}".lower()
            if needle not in haystack:
                continue
        buyer = users_by_id.get(doc.get("userId", "")) or {}
        rows.append(
            {
                "id": doc.get("id"),
                "userId": doc.get("userId"),
                "buyerName": buyer.get("name", ""),
                "items": doc.get("items") or [],
                "itemCount": len(doc.get("items") or []),
                "total": doc.get("total"),
                "finalTotal": doc.get("finalTotal"),
                "status": doc.get("status"),
                "paymentStatus": pay_status,
                "paymentMethod": doc.get("paymentMethod"),
                "deliveryAddress": doc.get("deliveryAddress"),
                "razorpayPaymentId": doc.get("razorpayPaymentId"),
                "refundStatus": doc.get("refundStatus"),
                "createdAt": doc.get("createdAt"),
                "updatedAt": doc.get("updatedAt"),
                "cancelledAt": doc.get("cancelledAt"),
            }
        )
    rows.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    return _paginate(rows, page, pageSize)


class OrderRefundIn(BaseModel):
    amountPaise: Optional[int] = Field(None, ge=1, description="defaults to the full order total")
    note: Optional[str] = None


async def _apply_order_refund(order_id: str, amount_paise: int, note: str, method_hint: Optional[str]) -> dict:
    """Shared refund executor: marks the order refunded and records the refund
    id (Razorpay when a payment id exists, manual otherwise)."""
    order = await get_doc("orders", order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    if order.get("refundStatus") == "processed":
        return {"orderId": order_id, "refundStatus": "processed", "razorpayRefundId": order.get("razorpayRefundId")}
    payment_id = order.get("razorpayPaymentId")
    if payment_id:
        refund = await refund_razorpay_payment(payment_id, amount_paise)
        refund_id = refund.get("id") or f"rfnd_{payment_id}"
        method = "razorpay"
    else:
        refund_id = f"rfnd_manual_{uuid.uuid4().hex[:10]}"
        method = method_hint or "manual"
    now = _now()
    order["refundStatus"] = "processed"
    order["razorpayRefundId"] = refund_id
    order["refundAmountPaise"] = amount_paise
    order["refundedAt"] = now
    order["updatedAt"] = now
    order.setdefault("events", []).append(
        {"status": "refund_processed", "at": now, "note": note or f"{method} refund {refund_id}"}
    )
    await set_doc("orders", order_id, order)
    return {
        "orderId": order_id,
        "refundStatus": "processed",
        "refundId": refund_id,
        "method": method,
        "amountPaise": amount_paise,
        "refundedAt": now,
    }


@router.post("/marketplace/orders/{order_id}/refund")
async def refund_marketplace_order(
    order_id: str, body: OrderRefundIn, ctx: dict = Depends(admin_mutation_context)
):
    """Trigger a refund record for a cancelled order (Razorpay when the order
    was paid online, manual otherwise)."""
    order = await get_doc("orders", order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    if order.get("refundStatus") == "processed":
        return {"success": True, "alreadyRefunded": True, "orderId": order_id, "refundStatus": "processed"}
    if order.get("status") != "cancelled":
        _error(409, "REFUND_NOT_APPLICABLE", "refund is only applicable for cancelled orders")
    amount_paise = body.amountPaise or int(round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100))
    payload = {"amountPaise": amount_paise, "targetId": order_id, "note": body.note}
    if amount_paise > approvals.MAKER_CHECKER_THRESHOLD_PAISE:
        pending = await approvals.maybe_require_approval(
            ctx["admin"], "marketplace", "order-refund", payload, ctx["reason"]
        )
        if pending is not None:
            return {"success": True, "requiresApproval": True, "approval": pending}
    previous = {"status": order.get("status"), "refundStatus": order.get("refundStatus")}
    result = await _apply_order_refund(order_id, amount_paise, body.note or ctx["reason"], None)
    await log_admin_action(
        ctx["admin"], "marketplace", "REFUND_ORDER", order_id, previous, result, ctx["reason"], ctx["ip"]
    )
    return {"success": True, **result}


async def _exec_marketplace_refund(approval: dict, approver: dict) -> None:
    payload = approval.get("payload") or {}
    await _apply_order_refund(
        payload.get("targetId") or "",
        int(payload.get("amountPaise") or 0),
        approval.get("reason") or "maker-checker approved refund",
        "manual",
    )


approvals.register_executor("marketplace", "order-refund", _exec_marketplace_refund)


# ===========================================================================
# Module 07 — Buyer contracts (publish / status / acceptances)
# ===========================================================================
@router.get("/contracts")
async def list_contracts(
    status: Optional[str] = Query(None),
    buyerId: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Buyer contracts across all stages (`contracts` collection) with the
    current mandi-linked price attached where computable."""
    docs = await query("contracts", None, limit=2000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    if buyerId:
        docs = [d for d in docs if d.get("buyerId") == buyerId]
    if search:
        needle = search.lower()
        docs = [
            d
            for d in docs
            if needle in str(d.get("id", "")).lower()
            or needle in (d.get("crop") or "").lower()
            or needle in (d.get("buyerCompany") or "").lower()
        ]
    docs.sort(key=lambda d: d.get("createdAt") or "", reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    page_docs = await _enrich_with_current_price(docs[start : start + pageSize])
    users_by_id = await _users_map()
    rows = []
    for doc in page_docs:
        farmer = users_by_id.get(doc.get("farmerId") or "") or {}
        buyer = users_by_id.get(doc.get("buyerId") or "") or {}
        rows.append(
            {
                **doc,
                "farmerName": farmer.get("name", ""),
                "buyerName": buyer.get("name", ""),
                "deliverySlots": len(doc.get("deliveries") or []),
            }
        )
    return {"data": rows, "page": page, "pageSize": pageSize, "total": total}


class ContractPublishIn(BaseModel):
    """Publish an institutional contract — an open (untargeted) offer any
    verified farmer can accept, per the `contracts` router's open flow."""

    buyerCompany: str = Field(..., min_length=2)
    crop: str = Field(..., min_length=1)
    title: str = ""
    quantityTotal: float = Field(..., gt=0)
    priceType: Literal["fixed", "mandiLinked"] = "fixed"
    baseRate: Optional[float] = None
    premiumPerQuintal: float = 0
    mandiName: str = ""
    schedule: ContractSchedule
    deliveryLocation: str = ""
    paymentTermsDays: int = 0
    termsText: str = ""
    specId: Optional[str] = None


@router.post("/contracts", status_code=201)
async def publish_contract(body: ContractPublishIn, ctx: dict = Depends(admin_mutation_context)):
    doc = body.model_dump(exclude_none=True)
    if body.specId and not doc.get("specSnapshot"):
        spec = await get_doc("crop_specs", body.specId)
        if spec:
            doc["specSnapshot"] = spec
    _validate_price_rule(doc)
    contract_id = f"con_{uuid.uuid4().hex[:12]}"
    now = _now()
    doc.update(
        {
            "id": contract_id,
            "buyerId": _admin_id(ctx["admin"]),
            "buyerRating": 0,
            "mspCurrentRate": 0,
            "premiumAboveMSP": "",
            "status": "open",
            "farmerId": None,
            "deliveries": [],
            "deliveriesGenerated": 0,
            "publishedBy": _admin_id(ctx["admin"]),
            "createdAt": now,
            "updatedAt": now,
        }
    )
    _sync_legacy_mirror(doc)
    await set_doc("contracts", contract_id, doc)
    await log_admin_action(
        ctx["admin"], "contracts", "PUBLISH_CONTRACT", contract_id, None,
        {"status": "open", "crop": doc.get("crop"), "buyerCompany": doc.get("buyerCompany")},
        ctx["reason"], ctx["ip"],
    )
    return doc


class ContractStatusIn(BaseModel):
    # The contracts router's machine only supports admin cancellation beyond
    # the farmer accept/decline flows — anything else is a 422.
    status: Literal["cancelled"]
    reason: str = Field(..., min_length=3, description="breach/cancellation explanation")


@router.put("/contracts/{contract_id}/status")
async def update_contract_status(
    contract_id: str, body: ContractStatusIn, ctx: dict = Depends(admin_mutation_context)
):
    contract = await get_doc("contracts", contract_id)
    if contract is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not found")
    previous_status = contract.get("status")
    if previous_status in TERMINAL_STATUSES:
        _error(409, "CONTRACT_NOT_OPEN", f"contract is already '{previous_status}'")
    previous = {"status": previous_status}
    contract["status"] = "cancelled"
    contract["cancelReason"] = body.reason
    contract["cancelledBy"] = _admin_id(ctx["admin"])
    contract["updatedAt"] = _now()
    await set_doc("contracts", contract_id, contract)
    await log_admin_action(
        ctx["admin"], "contracts", "UPDATE_CONTRACT_STATUS", contract_id, previous,
        {"status": "cancelled", "reason": body.reason}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "id": contract_id, "status": "cancelled", "previousStatus": previous_status}


@router.get("/contracts/{contract_id}/acceptances")
async def list_contract_acceptances(
    contract_id: str,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Signed farmer agreements — `contracts/{id}/acceptances` docs written by
    the MPIN e-sign flow."""
    contract = await get_doc("contracts", contract_id)
    if contract is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not found")
    docs = await query(f"contracts/{contract_id}/acceptances", None, limit=1000)
    docs.sort(key=lambda d: d.get("acceptedAt") or "", reverse=True)
    rows = []
    for doc in docs:
        farmer = await get_user(doc.get("userId") or "")
        rows.append({**doc, "farmerName": (farmer or {}).get("name", "")})
    return _paginate(rows, page, pageSize)


# ===========================================================================
# P1-31: Manual mandi rate entry/override (SOP-04 §3)
# ===========================================================================

class MandiRateOverrideIn(BaseModel):
    mandi: str = Field(..., min_length=2)
    crop: str = Field(..., min_length=2)
    district: Optional[str] = "Nashik"
    state: Optional[str] = "Maharashtra"
    modalPrice: float = Field(..., gt=0)
    minPrice: Optional[float] = None
    maxPrice: Optional[float] = None
    arrivalsQuintals: Optional[float] = 0.0
    date: Optional[str] = None
    overrideReason: str = Field("", description="Justification for manual override feed")


@router.post("/mandi/rates", status_code=201)
async def create_manual_mandi_rate(
    body: MandiRateOverrideIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """P1-31 (SOP-04): Manual mandi rate entry/override for mandis with broken government feeds."""
    rate_id = f"mnd_{uuid.uuid4().hex[:12]}"
    now = _now()
    doc = {
        "id": rate_id,
        "mandi": body.mandi,
        "crop": body.crop.lower(),
        "district": body.district,
        "state": body.state,
        "modalPrice": body.modalPrice,
        "minPrice": body.minPrice or body.modalPrice * 0.95,
        "maxPrice": body.maxPrice or body.modalPrice * 1.05,
        "arrivals": body.arrivalsQuintals,
        "date": body.date or now[:10],
        "status": "approved",
        "source": "admin_override",
        "overrideReason": body.overrideReason,
        "recordedBy": _admin_id(ctx["admin"]),
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("mandi_rates", rate_id, doc)
    await log_admin_action(
        ctx["admin"], "trade", "MANDI_RATE_OVERRIDE", rate_id, None,
        {"crop": body.crop, "mandi": body.mandi, "modalPrice": body.modalPrice},
        ctx["reason"], ctx["ip"],
    )
    return doc


# ===========================================================================
# P1-36: Product authenticity certificates (SOP-06 §3)
# ===========================================================================

class ProductCertificateIn(BaseModel):
    certType: str = Field(..., description="agmark | organic | fssai | ministry_qr | iso")
    certNumber: str = Field(..., min_length=2)
    issuer: str = Field(..., min_length=2)
    validUntil: Optional[str] = None
    certUrl: str = Field(..., min_length=1)


@router.post("/marketplace/products/{product_id}/certificates", status_code=201)
async def add_product_certificate(
    product_id: str,
    body: ProductCertificateIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """P1-36 (SOP-06): Upload and attach Agmark/Ministry QR authenticity certificate to a marketplace product."""
    product = await get_doc("products", product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")

    cert_id = f"cert_{uuid.uuid4().hex[:10]}"
    cert_entry = {
        "id": cert_id,
        "productId": product_id,
        **body.model_dump(exclude_none=True),
        "verified": True,
        "verifiedBy": _admin_id(ctx["admin"]),
        "attachedAt": _now(),
    }
    certs = product.setdefault("certificates", [])
    certs.append(cert_entry)
    product["isCertified"] = True
    product["updatedAt"] = _now()
    await set_doc("products", product_id, product)
    await set_doc("product_certificates", cert_id, cert_entry)
    await log_admin_action(
        ctx["admin"], "marketplace", "PRODUCT_CERTIFICATE_ATTACH", product_id,
        None, {"certType": body.certType, "certNumber": body.certNumber},
        ctx["reason"], ctx["ip"],
    )
    return cert_entry


@router.get("/marketplace/products/{product_id}/certificates")
async def list_product_certificates(
    product_id: str,
    user: dict = Depends(current_admin_user),
):
    """P1-36: List authenticity certificates for a marketplace product."""
    product = await get_doc("products", product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    certs = product.get("certificates") or []
    return {"productId": product_id, "data": certs, "total": len(certs)}
