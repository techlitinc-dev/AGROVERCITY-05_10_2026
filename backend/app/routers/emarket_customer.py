"""e-Market customer 'FarmGate' (phase-04 WS-03).

Escrow guardrails (deposit on high-value accepts, E5 inspection matrix, E1/E2/E3
penalties), fair-price bands (C5/E8), anti-hoarding caps (E9), multi-farmer cart
(C6), subscriptions (C2), consolidated GST invoicing + credit ledger (C9) and
business-buyer KYC gating. All money is integer paisa; every financial mutation
writes audit_logs; write endpoints accept Idempotency-Key.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services import billing, idempotency, settlements as settlements_service
from app.services import worm as worm_service
from app.services.chat_moderation import record_strike
from app.services.fair_price import fair_price_band
from app.services.geo import freshness_days, haversine_km
from app.services.kyc import emarket_business_verified_docs
from app.services.payments import refund_razorpay_payment
from app.services.users import get_user

router = APIRouter(prefix="/customer", tags=["emarket-customer"])

LOGISTICS_MODES = ("farmer_delivery", "customer_pickup", "platform_transport")
ESCROW_FROZEN = "frozen"

DEPOSIT_IDEM_SCOPE = "customer.quote.accept"
CART_IDEM_SCOPE = "customer.cart.checkout"
CANCEL_IDEM_SCOPE = "customer.order.cancel"
NOSHOW_IDEM_SCOPE = "customer.order.no_show"
QUOTE_IDEM_SCOPE = "customer.quote.create"
SUBSCRIPTION_IDEM_SCOPE = "customer.subscription.create"

FREQUENCY_DELTAS = {"daily": timedelta(days=1), "weekly": timedelta(days=7), "seasonal": timedelta(days=90)}
INSPECTION_WINDOW_HOURS = 72
FARMER_FREE_CANCEL_HOURS = 2
CUSTOMER_FREE_CANCEL_HOURS = 4
CUSTOMER_PICKUP_PENALTY_HOURS = 2


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None, **extra):
    detail = {"code": code, "message": message, "fieldErrors": field_errors or {}}
    detail.update(extra)
    raise HTTPException(status_code=status_code, detail=detail)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _customer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    profiles = user.get("linkedProfiles") or [user.get("activeProfile") or "customer"]
    if "customer" not in profiles and not user.get("isAdmin"):
        require_role(user, "customer", "directBuyer")
    return user


async def _audit(action: str, **fields) -> None:
    """Global rule 3: every financial mutation writes an audit_logs entry."""
    await set_doc(
        "audit_logs",
        f"aud_{action.lower()}_{uuid.uuid4().hex[:12]}",
        {"action": action, **fields, "at": _now()},
    )


async def _emarket_config() -> dict:
    return await settlements_service._config()


def _order_value_paisa(price_per_quintal: float, quantity_quintals: float) -> int:
    return int(round(float(price_per_quintal) * float(quantity_quintals) * 100))


def _append_timeline(order: dict, status: str) -> None:
    order.setdefault("statusTimeline", []).append({"status": status, "at": _now()})


def _new_escrow() -> dict:
    """Phase-00 escrow convention (purchases.py): status held/released/refunded."""
    return {
        "status": "unfunded",
        "amount": 0,
        "method": "",
        "reference": "",
        "fundedAt": None,
        "releasedAt": None,
        "refundedAt": None,
        "disputeOpenedAt": None,
        "disputeResolvedAt": None,
    }


def _new_order(
    *,
    customer_id: str,
    customer_name: str,
    farmer_id: str,
    farmer_name: str,
    crop: str,
    grade: str,
    quantity_quintals: float,
    price_per_quintal: float,
    district: str,
    lot_id: str | None,
    quote_id: str | None,
    logistics_mode: str,
    subscription_id: str | None = None,
) -> dict:
    value_paisa = _order_value_paisa(price_per_quintal, quantity_quintals)
    return {
        "id": f"ord_{uuid.uuid4().hex[:10]}",
        "customerId": customer_id,
        "customerName": customer_name,
        "farmerId": farmer_id,
        "farmerName": farmer_name,
        "crop": crop,
        "grade": grade,
        "district": district,
        "quantityQuintals": float(quantity_quintals),
        "pricePerQuintal": float(price_per_quintal),
        "totalAmountRupees": round(value_paisa / 100, 2),
        "orderValuePaisa": value_paisa,
        "unitPricePaisa": int(round(float(price_per_quintal) * 100)),
        "lotId": lot_id,
        "quoteId": quote_id,
        "subscriptionId": subscription_id,
        "logisticsMode": logistics_mode,
        "escrow": _new_escrow(),
        "escrowStatus": "unfunded",
        "status": "created",
        "statusTimeline": [{"status": "created", "at": _now()}],
        "inspection": None,
        "createdAt": _now(),
    }


async def _apply_deposit(order: dict, config: dict) -> None:
    """Task 3.14: high-value orders hold a deposit in escrow (integer paisa);
    low-value orders confirm directly with no deposit."""
    pct = int(config.get("emarketDepositPct", 20))
    threshold = int(config.get("emarketHighValueThresholdPaisa", 1000000))
    value_paisa = int(order.get("orderValuePaisa") or 0)
    if value_paisa >= threshold:
        deposit_paisa = value_paisa * pct // 100
        escrow = order["escrow"]
        escrow.update(
            status="held",
            amount=deposit_paisa,
            method="platform_escrow",
            reference=order["id"],
            fundedAt=_now(),
        )
        order["depositPaisa"] = deposit_paisa
        order["escrowStatus"] = "funded"
        order["status"] = "deposit_pending"
        await _audit(
            "EMARKET_DEPOSIT_HELD",
            orderId=order["id"],
            customerId=order["customerId"],
            farmerId=order["farmerId"],
            amountPaisa=deposit_paisa,
            orderValuePaisa=value_paisa,
        )
    else:
        order["status"] = "confirmed"
    _append_timeline(order, order["status"])
    if config.get("emarketSurgeMode"):
        # E9: surge caps commission, never price — invoices disclose the spike.
        order["surgeSurchargeDisclosed"] = True


async def _release_escrow(order: dict) -> bool:
    """Phase-00 release path (deposit release on inspection acceptance / QR
    handover). Returns True when a held escrow was released."""
    escrow = order.get("escrow") or {}
    if escrow.get("status") != "held":
        return False
    escrow.update(status="released", releasedAt=_now())
    order["escrowStatus"] = "released"
    await _audit(
        "EMARKET_ESCROW_RELEASED",
        orderId=order["id"],
        customerId=order.get("customerId"),
        farmerId=order.get("farmerId"),
        amountPaisa=int(escrow.get("amount") or 0),
    )
    return True


async def _freeze_escrow(order: dict) -> None:
    """E5 dispute: freeze the deposit until a ruling (escrow.py pause flag)."""
    escrow = order.get("escrow") or {}
    if escrow.get("status") == "held":
        escrow["disputeOpenedAt"] = _now()
    order["escrowStatus"] = ESCROW_FROZEN


async def _refund_escrow_to_source(order: dict, reason: str) -> None:
    """Phase-00 refund path (payments.py record-level mechanics): refund the
    held deposit back to the source payment."""
    escrow = order.get("escrow") or {}
    if escrow.get("status") != "held":
        return
    refund = await refund_razorpay_payment(
        escrow.get("reference") or order["id"], int(escrow.get("amount") or 0)
    )
    escrow.update(status="refunded", refundedAt=_now(), refundRef=refund.get("id"))
    order["escrowStatus"] = "refunded"
    await _audit(
        "EMARKET_ESCROW_REFUNDED",
        orderId=order["id"],
        customerId=order.get("customerId"),
        amountPaisa=int(escrow.get("amount") or 0),
        refundRef=refund.get("id"),
        reason=reason,
    )


def _check_hoarding_cap(crop: str, qty: float, config: dict) -> None:
    """Task 3.20 (E9): per-crop max qty per buyer; boundary inclusive."""
    caps = config.get("emarketMaxQtyPerCrop") or {}
    cap = caps.get(crop)
    if cap is not None and float(qty) > float(cap):
        _error(
            422,
            "HOARDING_CAP",
            f"maximum orderable quantity for {crop} is {cap} units per buyer",
            {"quantity": f"exceeds the {crop} cap of {cap}"},
        )


async def _write_credit_ledger(order: dict, uid: str) -> None:
    """C9: credit_terms-entitled buyers accrue a customer_credit_ledger entry."""
    plan = await billing.effective_plan(uid, "emarket")
    if "credit_terms" not in (plan.get("features") or []):
        return
    days = int((plan.get("limits") or {}).get("creditTermsDays") or 30)
    due_at = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    await set_doc(
        "customer_credit_ledger",
        f"credit_{order['id']}",
        {
            "orderId": order["id"],
            "customerId": uid,
            "creditTermsDays": days,
            "dueAt": due_at,
            "amountPaisa": int(order.get("orderValuePaisa") or 0),
            "settledAt": None,
        },
    )


async def _load_order(order_id: str) -> dict:
    order = await get_doc("customer_orders", order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    return order


class CustomerDemandIn(BaseModel):
    crop: str
    variety: str = "Standard"
    grade: str = "A"
    quantityQuintals: float = Field(gt=0)
    targetMinPrice: float = Field(gt=0)
    targetMaxPrice: float = Field(gt=0)
    recurringFrequency: str = "Daily"
    deliveryWindow: str = "7 Days"
    district: str = ""
    notes: str = ""


class BindingQuoteIn(BaseModel):
    demandId: str | None = None
    lotId: str | None = None
    farmerId: str | None = None
    farmerName: str | None = None
    crop: str
    offeredPricePerQuintal: float = Field(gt=0)
    quantityQuintals: float = Field(gt=0)
    deliveryMode: str = "pickup"
    notes: str = ""
    antiHoardingAccepted: bool | None = None
    noOffPlatformAccepted: bool | None = None


class QuoteCounterIn(BaseModel):
    counterPricePerQuintal: float = Field(gt=0)
    reason: str = ""


class QuoteAcceptIn(BaseModel):
    logisticsMode: Literal["farmer_delivery", "customer_pickup", "platform_transport"] | None = None


class DeliveryInspectionIn(BaseModel):
    damagePct: int = Field(ge=0, le=100)
    gradeMatch: bool = True
    photoUrls: list[str] = []
    notes: str = ""


class FavoriteSupplierIn(BaseModel):
    farmerId: str
    farmerName: str
    primaryCrops: list[str] = []
    location: str = ""


class CartLineIn(BaseModel):
    farmerId: str
    lotId: str
    qty: float = Field(gt=0)
    logisticsMode: Literal["farmer_delivery", "customer_pickup", "platform_transport"] = "customer_pickup"


class CartCheckoutIn(BaseModel):
    lines: list[CartLineIn] = Field(min_length=1)


class SubscriptionIn(BaseModel):
    farmerIds: list[str] = Field(min_length=1)
    crop: str
    grade: str = "A"
    qtyKg: float = Field(gt=0)
    targetPriceBandPaisa: dict = Field(default_factory=dict)
    deliveryWindow: str = ""
    frequency: Literal["daily", "weekly", "seasonal"]


def _order_amount_paisa(order: dict) -> int:
    if order.get("orderValuePaisa") is not None:
        return int(order["orderValuePaisa"])
    return int(round(float(order.get("totalAmountRupees") or 0) * 100))


# ---------------------------------------------------------------- analytics


@router.get("/analytics")
async def get_customer_analytics(user: dict = Depends(_customer)):
    uid = user["id"]
    demands = await query("customer_demands", [("customerId", "==", uid)], limit=500)
    quotes = await query("customer_quotes", [("customerId", "==", uid)], limit=500)
    orders = await query("customer_orders", [("customerId", "==", uid)], limit=500)

    spend_orders = [o for o in orders if not o.get("isParent")]
    spent_paisa = sum(_order_amount_paisa(o) for o in spend_orders if o.get("status") in ("delivered", "settled", "confirmed"))
    total_volume_q = sum(float(o.get("quantityQuintals", 0)) for o in spend_orders if o.get("status") in ("delivered", "settled", "confirmed"))

    active_orders = [o for o in spend_orders if o.get("status") in ("confirmed", "deposit_pending", "in_fulfillment", "dispatched")]
    active_demands = [d for d in demands if d.get("status", "open") == "open"]

    by_month: dict[str, dict] = {}
    for o in spend_orders:
        month = (o.get("createdAt") or "")[:7]
        if not month:
            continue
        bucket = by_month.setdefault(month, {"spend": 0, "tonnage": 0.0})
        bucket["spend"] += _order_amount_paisa(o) / 100
        bucket["tonnage"] += float(o.get("quantityQuintals") or 0)
    monthly_trend = [
        {"month": month, "spend": round(vals["spend"], 2), "tonnage": round(vals["tonnage"], 1)}
        for month, vals in sorted(by_month.items())
    ]

    by_category: dict[str, float] = {}
    for o in spend_orders:
        category = o.get("category")
        if not category:
            continue
        by_category[category] = round(by_category.get(category, 0) + _order_amount_paisa(o) / 100, 2)

    live = [o for o in spend_orders if o.get("status") not in ("cancelled",)]
    fulfilled = [o for o in live if o.get("status") in ("delivered", "settled")]
    sla_percent = round(len(fulfilled) * 100 / len(live), 1) if live else 0.0

    return {
        "totalSpendRupees": round(spent_paisa / 100, 2),
        "totalTonnageMT": round(total_volume_q / 10, 1),
        "totalVolumeQuintals": round(total_volume_q, 1),
        "activeOrdersCount": len(active_orders),
        "standingDemandsCount": len(active_demands),
        "openQuotesCount": sum(1 for q in quotes if q.get("status") in ("pending", "countered", "quote_pending")),
        "mandiSavingsPercent": 0,
        "fulfillmentSlaPercent": sla_percent,
        "categorySpend": [{"category": k, "amount": v} for k, v in by_category.items()],
        "monthlySpendTrend": monthly_trend,
    }


# ---------------------------------------------------------------- demands


@router.get("/demands")
async def list_customer_demands(user: dict = Depends(_customer)):
    demands = await query("customer_demands", [("customerId", "==", user["id"])], limit=500)
    demands.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": demands, "total": len(demands)}


@router.post("/demands", status_code=201)
async def create_customer_demand(body: CustomerDemandIn, user: dict = Depends(_customer)):
    did = f"dem_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": did,
        "customerId": user["id"],
        "customerName": user.get("name") or "Enterprise Buyer",
        "crop": body.crop,
        "variety": body.variety,
        "grade": body.grade,
        "quantityQuintals": body.quantityQuintals,
        "targetMinPrice": body.targetMinPrice,
        "targetMaxPrice": body.targetMaxPrice,
        "recurringFrequency": body.recurringFrequency,
        "deliveryWindow": body.deliveryWindow,
        "district": body.district or user.get("district", ""),
        "notes": body.notes,
        "status": "open",
        "bidsCount": 0,
        "createdAt": _now(),
    }
    await set_doc("customer_demands", did, doc)
    return doc


@router.delete("/demands/{demand_id}", status_code=204)
async def delete_customer_demand(demand_id: str, user: dict = Depends(_customer)):
    demand = await get_doc("customer_demands", demand_id)
    if demand and demand.get("customerId") == user["id"]:
        await delete_doc("customer_demands", demand_id)


# ---------------------------------------------------------------- quotes


def _quote_expiry_fields(config: dict) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(hours=24)).isoformat()
    lock_minutes = int(config.get("emarketPriceLockMinutes", 30))
    price_lock_until = (now + timedelta(minutes=lock_minutes)).isoformat()
    return expires_at, price_lock_until


async def _business_buyer_gate(user: dict, body: BindingQuoteIn) -> None:
    """Task 3.38: business buyers quote only with verified gstin + pan, and
    attest anti-hoarding + no-off-platform on the first quote. Households exempt."""
    if user.get("accountType", "household") != "business":
        return
    cases = await query("kyc_cases", [("userId", "==", user["id"])], limit=50)
    cases = [c for c in cases if c.get("persona") == "emarket_business"]
    cases.sort(key=lambda c: c.get("submittedAt") or "", reverse=True)
    verified = emarket_business_verified_docs(cases[0]) if cases else set()
    if not {"gstin", "pan"} <= verified:
        _error(403, "KYC_REQUIRED", "business buyers need verified GSTIN + PAN before quoting")
    already_attested = bool(
        user.get("antiHoardingAcceptedAt") and user.get("noOffPlatformAcceptedAt")
    )
    if not already_attested and not (body.antiHoardingAccepted and body.noOffPlatformAccepted):
        _error(
            422,
            "ATTESTATION_REQUIRED",
            "first quote requires the anti-hoarding and no-off-platform declarations",
            {
                "antiHoardingAccepted": "must be true",
                "noOffPlatformAccepted": "must be true",
            },
        )
    if not already_attested:
        user["antiHoardingAccepted"] = True
        user["antiHoardingAcceptedAt"] = _now()
        user["noOffPlatformAccepted"] = True
        user["noOffPlatformAcceptedAt"] = _now()
        await set_doc("users", user["id"], user)


@router.get("/quotes")
async def list_customer_quotes(user: dict = Depends(_customer)):
    quotes = await query("customer_quotes", [("customerId", "==", user["id"])], limit=500)
    quotes.sort(key=lambda q: q.get("createdAt", ""), reverse=True)
    for quote in quotes:
        district = quote.get("district") or user.get("district") or ""
        quote["fairPriceBand"] = await fair_price_band(quote.get("crop") or "", district)
    return {"data": quotes, "total": len(quotes)}


@router.post("/quotes", status_code=201)
async def submit_binding_quote(
    body: BindingQuoteIn,
    user: dict = Depends(_customer),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    stored = await idempotency.replay(QUOTE_IDEM_SCOPE, idempotency_key)
    if stored is not None:
        return stored

    await _business_buyer_gate(user, body)
    config = await _emarket_config()
    expires_at, price_lock_until = _quote_expiry_fields(config)

    demand = await get_doc("customer_demands", body.demandId) if body.demandId else None
    district = (demand or {}).get("district") or user.get("district") or ""
    qid = f"quot_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": qid,
        "customerId": user["id"],
        "customerName": user.get("name") or "Verified Buyer",
        "demandId": body.demandId,
        "lotId": body.lotId,
        "farmerId": body.farmerId or "",
        "farmerName": body.farmerName or "",
        "farmerIds": [body.farmerId] if body.farmerId else [],
        "crop": body.crop,
        "district": district,
        "offeredPricePerQuintal": body.offeredPricePerQuintal,
        "quantityQuintals": body.quantityQuintals,
        "totalValueRupees": round(body.offeredPricePerQuintal * body.quantityQuintals, 2),
        "orderValuePaisa": _order_value_paisa(body.offeredPricePerQuintal, body.quantityQuintals),
        "deliveryMode": body.deliveryMode,
        "notes": body.notes,
        "negotiationRound": 1,
        "counterRounds": 0,
        "expiresAt": expires_at,
        "priceLockUntil": price_lock_until,
        "status": "pending",
        "createdAt": _now(),
    }
    await set_doc("customer_quotes", qid, doc)
    if idempotency_key:
        await idempotency.store(QUOTE_IDEM_SCOPE, idempotency_key, doc)
    return doc


def _quote_expired(quote: dict) -> bool:
    expires_at = quote.get("expiresAt")
    if not expires_at:
        return False
    try:
        return datetime.now(timezone.utc) > datetime.fromisoformat(expires_at)
    except ValueError:
        return False


@router.post("/quotes/{quote_id}/counter")
async def counter_quote(quote_id: str, body: QuoteCounterIn, user: dict = Depends(_customer)):
    quote = await get_doc("customer_quotes", quote_id)
    if quote is None:
        _error(404, "QUOTE_NOT_FOUND", "quote not found")
    if quote.get("customerId") != user["id"]:
        _error(403, "FORBIDDEN", "not your quote")
    if _quote_expired(quote):
        _error(410, "QUOTE_EXPIRED", "the quote's 24h validity has lapsed")

    band = await fair_price_band(quote.get("crop") or "", quote.get("district") or "")
    config = await _emarket_config()
    counter_rounds = int(quote.get("counterRounds") or 0)
    if counter_rounds >= 3:
        # E8 deadlock nudge: cap hit — surface the fair-price band.
        _error(
            422,
            "COUNTER_ROUND_CAP",
            "maximum 3 counter rounds allowed per e-market spec",
            bandNudge=True,
            fairPriceBand=band,
        )

    quote["offeredPricePerQuintal"] = body.counterPricePerQuintal
    quote["totalValueRupees"] = round(body.counterPricePerQuintal * quote.get("quantityQuintals", 1), 2)
    quote["orderValuePaisa"] = _order_value_paisa(
        body.counterPricePerQuintal, quote.get("quantityQuintals", 1)
    )
    quote["negotiationRound"] = int(quote.get("negotiationRound") or 1) + 1
    quote["counterRounds"] = counter_rounds + 1
    quote["counterReason"] = body.reason
    quote["status"] = "countered"
    _, price_lock_until = _quote_expiry_fields(config)
    quote["priceLockUntil"] = price_lock_until
    quote["fairPriceBand"] = band
    quote["updatedAt"] = _now()
    await set_doc("customer_quotes", quote_id, quote)
    return quote


@router.post("/quotes/{quote_id}/accept", status_code=201)
async def accept_quote(
    quote_id: str,
    body: QuoteAcceptIn | None = None,
    user: dict = Depends(_customer),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    stored = await idempotency.replay(DEPOSIT_IDEM_SCOPE, idempotency_key)
    if stored is not None:
        return stored

    quote = await get_doc("customer_quotes", quote_id)
    if quote is None:
        _error(404, "QUOTE_NOT_FOUND", "quote not found")
    if quote.get("customerId") != user["id"]:
        _error(403, "FORBIDDEN", "not your quote")
    if _quote_expired(quote):
        _error(410, "QUOTE_EXPIRED", "the quote's 24h validity has lapsed")

    config = await _emarket_config()
    _check_hoarding_cap(quote.get("crop") or "", quote.get("quantityQuintals") or 0, config)

    logistics_mode = (body.logisticsMode if body else None) or quote.get("deliveryMode") or "customer_pickup"
    if logistics_mode not in LOGISTICS_MODES:
        logistics_mode = "customer_pickup"
    farmer_id = quote.get("farmerId") or ""
    farmer = await get_user(farmer_id) or {}
    order = _new_order(
        customer_id=user["id"],
        customer_name=user.get("name") or "",
        farmer_id=farmer_id,
        farmer_name=farmer.get("name") or quote.get("farmerName") or "",
        crop=quote.get("crop") or "",
        grade=quote.get("grade") or "",
        quantity_quintals=quote.get("quantityQuintals") or 0,
        price_per_quintal=quote.get("offeredPricePerQuintal") or 0,
        district=quote.get("district") or "",
        lot_id=quote.get("lotId"),
        quote_id=quote_id,
        logistics_mode=logistics_mode,
        subscription_id=quote.get("subscriptionId"),
    )
    await _apply_deposit(order, config)
    await _write_credit_ledger(order, user["id"])

    quote["status"] = "accepted"
    quote["updatedAt"] = _now()
    await set_doc("customer_quotes", quote_id, quote)
    await set_doc("customer_orders", order["id"], order)
    if idempotency_key:
        await idempotency.store(DEPOSIT_IDEM_SCOPE, idempotency_key, order)
    return order


# ---------------------------------------------------------------- orders


@router.get("/orders")
async def list_customer_orders(user: dict = Depends(_customer)):
    orders = await query("customer_orders", [("customerId", "==", user["id"])], limit=500)
    orders.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return {"data": orders, "total": len(orders)}


@router.post("/orders/{order_id}/inspection")
async def record_delivery_inspection(
    order_id: str,
    body: DeliveryInspectionIn,
    user: dict = Depends(_customer),
):
    order = await _load_order(order_id)

    delivered_at = order.get("deliveredAt")
    delivered_on = None
    if delivered_at:
        try:
            delivered_on = datetime.fromisoformat(delivered_at)
            if delivered_on.tzinfo is None:
                delivered_on = delivered_on.replace(tzinfo=timezone.utc)
        except ValueError:
            delivered_on = None
    window_close = (
        delivered_on + timedelta(hours=INSPECTION_WINDOW_HOURS) if delivered_on else None
    )
    if window_close is None or datetime.now(timezone.utc) > window_close:
        _error(422, "INSPECTION_WINDOW_EXPIRED", "inspection is allowed only within 72h of delivery")

    # E5 damage matrix (integer paisa).
    value_paisa = _order_amount_paisa(order)
    if body.damagePct > 20 or not body.gradeMatch:
        outcome = "dispute"
        deduction_paisa = 0
    elif body.damagePct <= 5:
        outcome = "normal"
        deduction_paisa = 0
    else:
        outcome = "pro_rata"
        deduction_paisa = value_paisa * body.damagePct // 100

    inspected_at = _now()
    evidence_payload = {
        "orderId": order_id,
        "damagePct": body.damagePct,
        "gradeMatch": body.gradeMatch,
        "photoUrls": body.photoUrls,
        "notes": body.notes,
        "inspectionOutcome": outcome,
        "deductionPaisa": deduction_paisa,
        "inspectedAt": inspected_at,
        "inspectedBy": user.get("id"),
    }
    worm_path = await worm_service.put_evidence("inspection", order_id, evidence_payload)

    inspection_record = {
        "damagePct": body.damagePct,
        "gradeMatch": body.gradeMatch,
        "photoUrls": body.photoUrls,
        "notes": body.notes,
        "inspectionOutcome": outcome,
        "deductionPaisa": deduction_paisa,
        "inspectedAt": inspected_at,
        "inspectedBy": user.get("name") or "Customer QA Inspector",
        "wormEvidencePath": worm_path,
    }
    order["inspection"] = inspection_record
    order["inspectionOutcome"] = outcome
    order["deductionPaisa"] = deduction_paisa

    if outcome == "dispute":
        order["status"] = "disputed"
        await _freeze_escrow(order)
        _append_timeline(order, "disputed")
    else:
        order["status"] = "delivered"
        await _release_escrow(order)
        _append_timeline(order, "delivered")
    order["updatedAt"] = _now()
    await set_doc("customer_orders", order_id, order)
    return order


@router.post("/orders/{order_id}/qr-handover")
async def verify_qr_handover(order_id: str, user: dict = Depends(_customer)):
    order = await _load_order(order_id)
    order["qrVerifiedAt"] = _now()
    order["custodyTransferred"] = True
    await _release_escrow(order)
    _append_timeline(order, "custody_transferred")
    await set_doc("customer_orders", order_id, order)
    return {"success": True, "orderId": order_id, "status": "custody_transferred"}


@router.post("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(_customer),
):
    stored = await idempotency.replay(CANCEL_IDEM_SCOPE, idempotency_key)
    if stored is not None:
        return stored

    order = await _load_order(order_id)
    uid = user["id"]
    value_paisa = _order_amount_paisa(order)
    now = datetime.now(timezone.utc)
    try:
        created_at = datetime.fromisoformat(order.get("createdAt") or "")
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
    except ValueError:
        created_at = now
    age_hours = (now - created_at).total_seconds() / 3600

    if uid == order.get("farmerId"):
        # E1 farmer cancel: <=2h free; later 2% from future payout + relist.
        if age_hours > FARMER_FREE_CANCEL_HOURS:
            amount_paisa = value_paisa * 2 // 100
            penalty_id = f"pen_{uuid.uuid4().hex[:10]}"
            await set_doc(
                "emarket_penalties",
                penalty_id,
                {
                    "id": penalty_id,
                    "orderId": order_id,
                    "role": "farmer",
                    "pct": 2,
                    "amountPaisa": amount_paisa,
                    "appliedTo": "future_payout",
                    "createdAt": _now(),
                },
            )
            await _audit(
                "EMARKET_PENALTY",
                orderId=order_id,
                role="farmer",
                pct=2,
                amountPaisa=amount_paisa,
                appliedTo="future_payout",
            )
            lot_id = order.get("lotId")
            if lot_id:
                lot = await get_doc("market_lots", lot_id)
                if lot is not None:
                    lot["status"] = "open"
                    await set_doc("market_lots", lot_id, lot)
    elif uid == order.get("customerId"):
        # E2 customer cancel: <=4h free; within 2h of pickup 10%; else 5% to
        # farmer compensation; the prepaid remainder refunds to source.
        pickup_at = order.get("pickupAt")
        pickup_close = None
        if pickup_at:
            try:
                pickup_dt = datetime.fromisoformat(pickup_at)
                if pickup_dt.tzinfo is None:
                    pickup_dt = pickup_dt.replace(tzinfo=timezone.utc)
                pickup_close = pickup_dt - timedelta(hours=CUSTOMER_PICKUP_PENALTY_HOURS)
            except ValueError:
                pickup_close = None
        if age_hours > CUSTOMER_FREE_CANCEL_HOURS:
            pct = 10 if (pickup_close is not None and now >= pickup_close) else 5
            amount_paisa = value_paisa * pct // 100
            penalty_id = f"pen_{uuid.uuid4().hex[:10]}"
            await set_doc(
                "emarket_penalties",
                penalty_id,
                {
                    "id": penalty_id,
                    "orderId": order_id,
                    "role": "customer",
                    "pct": pct,
                    "amountPaisa": amount_paisa,
                    "appliedTo": "farmer_compensation",
                    "createdAt": _now(),
                },
            )
            order["farmerCompensationPaisa"] = amount_paisa
            await _audit(
                "EMARKET_PENALTY",
                orderId=order_id,
                role="customer",
                pct=pct,
                amountPaisa=amount_paisa,
                appliedTo="farmer_compensation",
            )
    else:
        _error(403, "FORBIDDEN", "only the order's farmer or customer can cancel it")

    await _refund_escrow_to_source(order, "order_cancelled")
    order["status"] = "cancelled"
    _append_timeline(order, "cancelled")
    order["updatedAt"] = _now()
    await set_doc("customer_orders", order_id, order)
    if idempotency_key:
        await idempotency.store(CANCEL_IDEM_SCOPE, idempotency_key, order)
    return order


@router.post("/orders/{order_id}/no-show")
async def report_farmer_no_show(
    order_id: str,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(_customer),
):
    stored = await idempotency.replay(NOSHOW_IDEM_SCOPE, idempotency_key)
    if stored is not None:
        return stored

    order = await _load_order(order_id)
    uid = user["id"]
    if uid != order.get("customerId") and not user.get("isAdmin"):
        _error(403, "FORBIDDEN", "only the ordering customer can report a farmer no-show")

    farmer_id = order.get("farmerId") or ""
    if farmer_id:
        await record_strike(farmer_id, "emarket", None, None)

    value_paisa = _order_amount_paisa(order)
    amount_paisa = value_paisa * 10 // 100
    penalty_id = f"pen_{uuid.uuid4().hex[:10]}"
    await set_doc(
        "emarket_penalties",
        penalty_id,
        {
            "id": penalty_id,
            "orderId": order_id,
            "role": "farmer",
            "pct": 10,
            "amountPaisa": amount_paisa,
            "appliedTo": "customer_credit",
            "createdAt": _now(),
        },
    )
    order["customerCreditPaisa"] = amount_paisa
    await _audit(
        "EMARKET_PENALTY",
        orderId=order_id,
        role="farmer",
        pct=10,
        amountPaisa=amount_paisa,
        appliedTo="customer_credit",
    )
    await _refund_escrow_to_source(order, "farmer_no_show")
    order["status"] = "cancelled"
    _append_timeline(order, "cancelled")
    order["updatedAt"] = _now()
    await set_doc("customer_orders", order_id, order)
    if idempotency_key:
        await idempotency.store(NOSHOW_IDEM_SCOPE, idempotency_key, order)
    return order


# ---------------------------------------------------------------- cart checkout


@router.post("/cart/checkout", status_code=201)
async def checkout_cart(
    body: CartCheckoutIn,
    user: dict = Depends(_customer),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    stored = await idempotency.replay(CART_IDEM_SCOPE, idempotency_key)
    if stored is not None:
        return stored

    config = await _emarket_config()

    # Validate every line against its lot before writing anything.
    validated = []
    for line in body.lines:
        lot = await get_doc("market_lots", line.lotId)
        if lot is None:
            _error(404, "LOT_NOT_FOUND", f"lot {line.lotId} not found")
        if lot.get("status") != "open":
            _error(422, "LOT_NOT_AVAILABLE", f"lot {line.lotId} is not available", {"lotId": line.lotId})
        if lot.get("farmerId") != line.farmerId:
            _error(
                422,
                "LOT_FARMER_MISMATCH",
                f"lot {line.lotId} belongs to a different farmer",
                {"farmerId": "does not own the lot"},
            )
        available = float(lot.get("quantityQuintals") or 0)
        if line.qty > available:
            _error(
                422,
                "INSUFFICIENT_QUANTITY",
                f"only {available} quintals available on lot {line.lotId}",
                {"qty": f"exceeds available {available}"},
            )
        validated.append((line, lot))

    qty_by_crop: dict[str, float] = {}
    for line, lot in validated:
        crop = lot.get("crop") or ""
        qty_by_crop[crop] = qty_by_crop.get(crop, 0.0) + line.qty
    for crop, qty in qty_by_crop.items():
        _check_hoarding_cap(crop, qty, config)

    total_paisa = sum(
        _order_value_paisa(float(lot.get("expectedRate") or 0), line.qty) for line, lot in validated
    )
    parent_id = f"ord_{uuid.uuid4().hex[:10]}"
    parent = {
        "id": parent_id,
        "customerId": user["id"],
        "customerName": user.get("name") or "",
        "farmerId": "",
        "isParent": True,
        "orderValuePaisa": total_paisa,
        "totalAmountRupees": round(total_paisa / 100, 2),
        "escrow": _new_escrow(),
        "escrowStatus": "unfunded",
        "status": "confirmed",
        "statusTimeline": [{"status": "created", "at": _now()}],
        "createdAt": _now(),
    }

    children: list[dict] = []
    lines_by_farmer: dict[str, list[tuple]] = {}
    for line, lot in validated:
        lines_by_farmer.setdefault(line.farmerId, []).append((line, lot))
    for farmer_id, farmer_lines in lines_by_farmer.items():
        farmer = await get_user(farmer_id) or {}
        first_line, first_lot = farmer_lines[0]
        child_value = sum(
            _order_value_paisa(float(lot.get("expectedRate") or 0), line.qty)
            for line, lot in farmer_lines
        )
        qty = sum(line.qty for line, _ in farmer_lines)
        child = _new_order(
            customer_id=user["id"],
            customer_name=user.get("name") or "",
            farmer_id=farmer_id,
            farmer_name=farmer.get("name") or "",
            crop=first_lot.get("crop") or "",
            grade=first_lot.get("grade") or "",
            quantity_quintals=qty,
            price_per_quintal=child_value / 100 / qty if qty else 0,
            district=first_lot.get("district") or user.get("district") or "",
            lot_id=first_line.lotId if len(farmer_lines) == 1 else None,
            quote_id=None,
            logistics_mode=first_line.logisticsMode,
        )
        child["orderValuePaisa"] = child_value
        child["totalAmountRupees"] = round(child_value / 100, 2)
        child["parentOrderId"] = parent_id
        child["lotIds"] = [line.lotId for line, _ in farmer_lines]
        await _apply_deposit(child, config)
        await _write_credit_ledger(child, user["id"])
        children.append(child)

    await set_doc("customer_orders", parent_id, parent)
    for child in children:
        await set_doc("customer_orders", child["id"], child)

    response = {"parentOrderId": parent_id, "orders": children}
    if idempotency_key:
        await idempotency.store(CART_IDEM_SCOPE, idempotency_key, response)
    return response


# ---------------------------------------------------------------- subscriptions


def _subscription_next_run(frequency: str) -> str:
    return (datetime.now(timezone.utc) + FREQUENCY_DELTAS[frequency]).isoformat()


@router.get("/subscriptions")
async def list_subscriptions(
    page: int = 1,
    pageSize: int = 20,
    user: dict = Depends(_customer),
):
    subs = await query("customer_subscriptions", [("customerId", "==", user["id"])], limit=500)
    subs.sort(key=lambda s: s.get("createdAt", ""), reverse=True)
    total = len(subs)
    start = (page - 1) * pageSize
    return {"data": subs[start:start + pageSize], "total": total, "page": page, "pageSize": pageSize}


@router.post("/subscriptions", status_code=201)
async def create_subscription(
    body: SubscriptionIn,
    user: dict = Depends(_customer),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    stored = await idempotency.replay(SUBSCRIPTION_IDEM_SCOPE, idempotency_key)
    if stored is not None:
        return stored
    sid = f"sub_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": sid,
        "customerId": user["id"],
        "farmerIds": body.farmerIds,
        "crop": body.crop,
        "grade": body.grade,
        "qtyKg": body.qtyKg,
        "targetPriceBandPaisa": body.targetPriceBandPaisa,
        "deliveryWindow": body.deliveryWindow,
        "frequency": body.frequency,
        "nextRunAt": _subscription_next_run(body.frequency),
        "status": "active",
        "createdAt": _now(),
    }
    await set_doc("customer_subscriptions", sid, doc)
    if idempotency_key:
        await idempotency.store(SUBSCRIPTION_IDEM_SCOPE, idempotency_key, doc)
    return doc


@router.delete("/subscriptions/{subscription_id}")
async def cancel_subscription(subscription_id: str, user: dict = Depends(_customer)):
    sub = await get_doc("customer_subscriptions", subscription_id)
    if sub is None or sub.get("customerId") != user["id"]:
        _error(404, "SUBSCRIPTION_NOT_FOUND", "subscription not found")
    sub["status"] = "cancelled"
    sub["updatedAt"] = _now()
    await set_doc("customer_subscriptions", subscription_id, sub)
    return sub


async def create_subscription_quote(subscription: dict) -> dict:
    """Task 3.31: the planner's quote — same machinery as a buyer-posted quote
    (24h expiry, price lock, counters) but status quote_pending and tagged with
    the subscription. Escrow is never bypassed: acceptance goes through the
    normal deposit path."""
    config = await _emarket_config()
    expires_at, price_lock_until = _quote_expiry_fields(config)
    band = subscription.get("targetPriceBandPaisa") or {}
    offered = float(band.get("max") or band.get("min") or 0) / 100
    qid = f"quot_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": qid,
        "customerId": subscription["customerId"],
        "demandId": None,
        "lotId": None,
        "farmerId": (subscription.get("farmerIds") or [""])[0],
        "farmerIds": subscription.get("farmerIds") or [],
        "crop": subscription.get("crop") or "",
        "district": subscription.get("district") or "",
        "offeredPricePerQuintal": offered,
        "quantityQuintals": round(float(subscription.get("qtyKg") or 0) / 100, 3),
        "qtyKg": subscription.get("qtyKg"),
        "targetPriceBandPaisa": band,
        "deliveryWindow": subscription.get("deliveryWindow") or "",
        "subscriptionId": subscription["id"],
        "negotiationRound": 1,
        "counterRounds": 0,
        "expiresAt": expires_at,
        "priceLockUntil": price_lock_until,
        "status": "quote_pending",
        "createdAt": _now(),
    }
    await set_doc("customer_quotes", qid, doc)
    return doc


# ---------------------------------------------------------------- invoices


@router.get("/invoices/consolidated")
async def consolidated_invoice(period: str, user: dict = Depends(_customer)):
    """C9: one consolidated GST invoice per buyer per YYYY-MM period, gated by
    the emarket_business plan's consolidated_gst_invoice entitlement."""
    plan = await billing.effective_plan(user["id"], "emarket")
    if "consolidated_gst_invoice" not in (plan.get("features") or []):
        billing.raise_entitlement_required("consolidated_gst_invoice", plan)

    orders = await query("customer_orders", [("customerId", "==", user["id"])], limit=1000)
    lines = [
        o
        for o in orders
        if not o.get("isParent") and (o.get("createdAt") or "")[:7] == period
    ]
    total_paisa = sum(_order_amount_paisa(o) for o in lines)
    gst_paisa = int(round(total_paisa * settlements_service.GST_RATE))
    invoice_id = f"cinv_{user['id'][:8]}_{period}"
    doc = {
        "id": invoice_id,
        "customerId": user["id"],
        "period": period,
        "lineItemCount": len(lines),
        "totalPaisa": total_paisa,
        "gstPaisa": gst_paisa,
        "createdAt": _now(),
    }
    await set_doc("customer_invoices", invoice_id, doc)
    await _audit(
        "EMARKET_CONSOLIDATED_INVOICE",
        invoiceId=invoice_id,
        customerId=user["id"],
        period=period,
        lineItemCount=len(lines),
        totalPaisa=total_paisa,
        gstPaisa=gst_paisa,
    )
    return doc


# ---------------------------------------------------------------- browse


@router.get("/browse/near-me")
async def browse_near_me(
    lat: float,
    lng: float,
    crop: str | None = None,
    radiusKm: float = 50,
    sort: str = "distance",
    page: int = 1,
    pageSize: int = 20,
    user: dict = Depends(_customer),
):
    """S3 produce near me: open lots with coordinates inside the radius, ranked
    by price | distance | grade | rating | freshness (default distance)."""
    lots = await query("market_lots", [("status", "==", "open")], limit=1000)
    items = []
    for lot in lots:
        if lot.get("latitude") is None or lot.get("longitude") is None:
            continue
        if crop and crop.lower() not in (lot.get("crop") or "").lower():
            continue
        distance_km = round(haversine_km(lat, lng, float(lot["latitude"]), float(lot["longitude"])), 2)
        if distance_km > radiusKm:
            continue
        farmer = await get_user(lot.get("farmerId") or "") or {}
        items.append(
            {
                "lotId": lot.get("id"),
                "farmerId": lot.get("farmerId"),
                "farmerName": farmer.get("name") or "",
                "crop": lot.get("crop") or "",
                "grade": lot.get("grade") or "",
                "qtyAvailable": float(lot.get("quantityQuintals") or 0),
                "pricePaisa": int(round(float(lot.get("expectedRate") or 0) * 100)),
                "distanceKm": distance_km,
                "harvestDate": lot.get("harvestDate") or "",
                "freshnessDays": freshness_days(lot.get("harvestDate")),
                "farmerRating": farmer.get("rating"),
            }
        )
    if sort == "price":
        items.sort(key=lambda i: (i["pricePaisa"], i["distanceKm"]))
    elif sort == "grade":
        items.sort(key=lambda i: i["grade"])
    elif sort == "rating":
        items.sort(key=lambda i: (i["farmerRating"] is None, -(i["farmerRating"] or 0)))
    elif sort == "freshness":
        items.sort(key=lambda i: i["harvestDate"], reverse=True)
    else:
        items.sort(key=lambda i: (i["distanceKm"], i["pricePaisa"]))
    total = len(items)
    start = (page - 1) * pageSize
    return {"data": items[start:start + pageSize], "total": total, "page": page, "pageSize": pageSize}


@router.get("/storefronts/{farmer_id}")
async def get_farmer_storefront(farmer_id: str, user: dict = Depends(_customer)):
    farmer = await get_user(farmer_id)
    if farmer is None:
        _error(404, "FARMER_NOT_FOUND", "farmer not found")
    lots = await query("market_lots", [("farmerId", "==", farmer_id), ("status", "==", "open")], limit=500)
    lots.sort(key=lambda l: l.get("createdAt", ""), reverse=True)
    storefront_lots = [
        {
            "lotId": lot.get("id"),
            "farmerId": farmer_id,
            "crop": lot.get("crop") or "",
            "grade": lot.get("grade") or "",
            "qtyAvailable": float(lot.get("quantityQuintals") or 0),
            "pricePaisa": int(round(float(lot.get("expectedRate") or 0) * 100)),
            "harvestDate": lot.get("harvestDate") or "",
            "freshnessDays": freshness_days(lot.get("harvestDate")),
        }
        for lot in lots
    ]
    credentials = []
    cases = await query("kyc_cases", [("userId", "==", farmer_id)], limit=50)
    for case in cases:
        for doc_entry in case.get("docs") or []:
            if doc_entry.get("status") == "verified":
                credentials.append(
                    {"type": doc_entry.get("type"), "verifiedAt": doc_entry.get("reviewedAt")}
                )
    return {
        "farmerId": farmer_id,
        "farmerName": farmer.get("name") or "",
        "farmerRating": farmer.get("rating"),
        "credentials": credentials,
        "lots": storefront_lots,
    }


# ---------------------------------------------------------------- planner + favorites


@router.get("/planner")
async def get_procurement_planner():
    return {
        "recommendedCommodities": [
            {
                "crop": "Sharbati Wheat",
                "currentMandiPrice": 3250,
                "projectedNextMonth": 3600,
                "priceTrend": "rising",
                "recommendation": "Pre-book 60% of quarterly volume now before post-Diwali spike",
                "peakHarvestMonth": "March - April",
            },
            {
                "crop": "Soybean (Yellow)",
                "currentMandiPrice": 4600,
                "projectedNextMonth": 4450,
                "priceTrend": "softening",
                "recommendation": "Wait for Kharif arrivals to stabilize in 2 weeks",
                "peakHarvestMonth": "October - November",
            },
            {
                "crop": "Red Onion (Nashik)",
                "currentMandiPrice": 2800,
                "projectedNextMonth": 3400,
                "priceTrend": "sharp_rise",
                "recommendation": "Execute forward contracts; storage stock depleting fast",
                "peakHarvestMonth": "November - December",
            },
            {
                "crop": "Basmati 1121 Paddy",
                "currentMandiPrice": 3800,
                "projectedNextMonth": 3950,
                "priceTrend": "stable",
                "recommendation": "Maintain staggered weekly procurement",
                "peakHarvestMonth": "October - November",
            },
        ]
    }


@router.get("/suppliers/favorites")
async def list_favorite_suppliers(user: dict = Depends(_customer)):
    favs = await query("customer_favorite_suppliers", [("customerId", "==", user["id"])], limit=100)
    favs.sort(key=lambda f: f.get("createdAt", ""), reverse=True)
    return {"data": favs, "total": len(favs)}


@router.post("/suppliers/favorites", status_code=201)
async def add_favorite_supplier(body: FavoriteSupplierIn, user: dict = Depends(_customer)):
    fid = f"fav_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": fid,
        "customerId": user["id"],
        "farmerId": body.farmerId,
        "farmerName": body.farmerName,
        "primaryCrops": body.primaryCrops,
        "location": body.location,
        "rating": None,
        "totalOrders": 0,
        "trustBadge": "Verified Producer",
        "createdAt": _now(),
    }
    await set_doc("customer_favorite_suppliers", fid, doc)
    return doc
