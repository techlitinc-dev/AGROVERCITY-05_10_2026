import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.resale import ResaleListingBook, ResaleListingCreate, StockAdjust, StockCreate
from app.routers.users import require_role
from app.services import idempotency
from app.services.chat import ensure_chat_room
from app.services.notify import notify_user
from app.services.users import get_user

# Stock endpoints hang off the seller module prefix.
seller_router = APIRouter(prefix="/seller", tags=["seller"])
# Resale listing marketplace endpoints.
router = APIRouter(prefix="/resale-listings", tags=["resale"])

LISTING_LIVE_STATUSES = ("open",)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _seller_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "seller")
    return uid


def _available(stock: dict) -> float:
    return round(
        float(stock.get("quantityQuintals") or 0) - float(stock.get("reservedQuintals") or 0), 3
    )


def _stock_view(stock: dict) -> dict:
    return {**stock, "availableQuintals": _available(stock)}


# ==========================================
# SELLER STOCK (seller_stock, ids stk_)
# ==========================================


@seller_router.post("/stock", status_code=201)
async def add_manual_stock(body: StockCreate, uid: str = Depends(_seller_user)):
    now = _now()
    doc = {
        **body.model_dump(),
        "id": f"stk_{uuid.uuid4().hex[:12]}",
        "sellerId": uid,
        "reservedQuintals": 0.0,
        "sourceType": "manual",
        "sourceId": None,
        "status": "active",
        "events": [
            {
                "at": now,
                "action": "added",
                "deltaQuintals": body.quantityQuintals,
                "reason": "manual entry",
            }
        ],
        "createdAt": now,
    }
    await set_doc("seller_stock", doc["id"], doc)
    return _stock_view(doc)


@seller_router.post("/stock/from-purchase/{purchase_id}", status_code=201)
async def stock_from_purchase(
    purchase_id: str,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_seller_user),
):
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required")
    scope = f"seller.stock.from_purchase.{purchase_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    purchase = await get_doc("purchases", purchase_id)
    if purchase is None:
        _error(404, "PURCHASE_NOT_FOUND", "purchase not found")
    if purchase.get("buyerId") != uid:
        _error(403, "FORBIDDEN", "only the buyer can convert this purchase to stock")
    if purchase.get("status") not in ("delivered", "completed"):
        _error(409, "PURCHASE_NOT_DELIVERED", "purchase must be delivered before it becomes stock")
    if purchase.get("stockConverted"):
        _error(409, "STOCK_ALREADY_CONVERTED", "this purchase is already converted to stock")
    qc = purchase.get("qc") or {}
    qty = float(qc.get("acceptedQty") or purchase.get("quantity") or 0)
    now = _now()
    doc = {
        "id": f"stk_{uuid.uuid4().hex[:12]}",
        "sellerId": uid,
        "crop": purchase.get("crop", ""),
        "variety": purchase.get("variety", ""),
        "grade": qc.get("grade"),
        "quantityQuintals": qty,
        "reservedQuintals": 0.0,
        "ratePerQuintal": purchase.get("agreedPricePerUnit", 0),
        "sourceType": "purchase",
        "sourceId": purchase_id,
        "location": None,
        "storedAt": None,
        "purchasedAt": purchase.get("createdAt"),
        "status": "active",
        "events": [
            {
                "at": now,
                "action": "added",
                "deltaQuintals": qty,
                "reason": f"from purchase {purchase_id}",
            }
        ],
        "createdAt": now,
    }
    await set_doc("seller_stock", doc["id"], doc)
    purchase["stockConverted"] = True
    purchase["stockId"] = doc["id"]
    purchase["updatedAt"] = now
    await set_doc("purchases", purchase_id, purchase)
    res = _stock_view(doc)
    await idempotency.store(scope, idempotency_key, res)
    return res


@seller_router.get("/stock")
async def list_stock(uid: str = Depends(_seller_user)):
    docs = await query("seller_stock", [("sellerId", "==", uid)], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    entries = [_stock_view(d) for d in docs]
    groups: dict[tuple, dict] = {}
    for entry in entries:
        key = (entry.get("crop", "Unknown"), entry.get("grade"))
        row = groups.setdefault(
            key,
            {
                "crop": key[0],
                "grade": key[1],
                "quantityQuintals": 0.0,
                "availableQuintals": 0.0,
                "value": 0,
            },
        )
        row["quantityQuintals"] = round(row["quantityQuintals"] + float(entry.get("quantityQuintals") or 0), 3)
        row["availableQuintals"] = round(row["availableQuintals"] + float(entry["availableQuintals"]), 3)
        row["value"] += int(round(float(entry["availableQuintals"]) * float(entry.get("ratePerQuintal") or 0)))
    by_crop = list(groups.values())
    for row in by_crop:
        row["avgRate"] = (
            round(row["value"] / row["availableQuintals"], 2) if row["availableQuintals"] else 0
        )
    by_crop.sort(key=lambda r: r["availableQuintals"], reverse=True)
    totals = {
        "quantityQuintals": round(sum(r["quantityQuintals"] for r in by_crop), 3),
        "availableQuintals": round(sum(r["availableQuintals"] for r in by_crop), 3),
        "value": sum(r["value"] for r in by_crop),
    }
    return {"data": entries, "summary": {"byCrop": by_crop, "totals": totals}}


@seller_router.post("/stock/{stock_id}/adjust")
async def adjust_stock(stock_id: str, body: StockAdjust, uid: str = Depends(_seller_user)):
    stock = await get_doc("seller_stock", stock_id)
    if stock is None or stock.get("sellerId") != uid:
        _error(404, "STOCK_NOT_FOUND", "stock not found")
    if body.deltaQuintals == 0:
        _error(422, "VALIDATION_ERROR", "invalid adjustment", {"deltaQuintals": "must not be 0"})
    available = _available(stock)
    if available + body.deltaQuintals < 0:
        _error(
            422,
            "VALIDATION_ERROR",
            "invalid adjustment",
            {"deltaQuintals": "cannot exceed the available quantity"},
        )
    new_qty = round(float(stock.get("quantityQuintals") or 0) + body.deltaQuintals, 3)
    stock["quantityQuintals"] = new_qty
    stock["status"] = "exhausted" if new_qty <= 0 else "active"
    stock.setdefault("events", []).append(
        {
            "at": _now(),
            "action": "adjust",
            "deltaQuintals": body.deltaQuintals,
            "reason": body.reason,
        }
    )
    stock["updatedAt"] = _now()
    await set_doc("seller_stock", stock_id, stock)
    return _stock_view(stock)


# ==========================================
# RESALE LISTINGS (resale_listings, ids rel_)
# ==========================================


async def _load_stock_for_seller(stock_id: str, uid: str) -> dict:
    stock = await get_doc("seller_stock", stock_id)
    if stock is None or stock.get("sellerId") != uid:
        _error(404, "STOCK_NOT_FOUND", "stock not found")
    return stock


@router.post("", status_code=201)
async def create_listing(
    body: ResaleListingCreate,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_seller_user),
):
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required")
    replayed = await idempotency.replay("resale.listings", idempotency_key)
    if replayed is not None:
        return replayed
    stock = await _load_stock_for_seller(body.stockId, uid)
    available = _available(stock)
    if body.quantityQuintals > available:
        _error(
            422,
            "VALIDATION_ERROR",
            "invalid quantity",
            {"quantityQuintals": f"must not exceed available stock ({available})"},
        )
    now = _now()
    doc = {
        **body.model_dump(),
        "id": f"rel_{uuid.uuid4().hex[:12]}",
        "sellerId": uid,
        "crop": stock.get("crop", ""),
        "variety": stock.get("variety", ""),
        "grade": stock.get("grade"),
        "remainingQuintals": body.quantityQuintals,
        "status": "open",
        "createdAt": now,
    }
    await set_doc("resale_listings", doc["id"], doc)
    stock["reservedQuintals"] = round(
        float(stock.get("reservedQuintals") or 0) + body.quantityQuintals, 3
    )
    stock.setdefault("events", []).append(
        {
            "at": now,
            "action": "reserved",
            "deltaQuintals": body.quantityQuintals,
            "reason": f"listing {doc['id']}",
        }
    )
    stock["updatedAt"] = now
    await set_doc("seller_stock", stock["id"], stock)
    await idempotency.store("resale.listings", idempotency_key, doc)
    return doc


def _listing_purchase_counts(purchases: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for purchase in purchases:
        source = purchase.get("source") or {}
        if isinstance(source, dict) and source.get("type") == "resale_listing" and source.get("refId"):
            key = source["refId"]
            counts[key] = counts.get(key, 0) + 1
    return counts


@router.get("/mine")
async def my_listings(uid: str = Depends(_seller_user)):
    docs = await query("resale_listings", [("sellerId", "==", uid)], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    purchases = await query("purchases", [], limit=2000)
    counts = _listing_purchase_counts(purchases)
    return {
        "data": [{**d, "purchaseCount": counts.get(d["id"], 0)} for d in docs],
        "total": len(docs),
    }


def _seller_summary(seller: dict) -> dict:
    rating_stats = seller.get("ratingStats") or seller.get("farmerRatingStats") or {}
    return {
        "sellerId": seller.get("id", ""),
        "name": seller.get("name", ""),
        "verified": bool(seller.get("vyapariVerified")),
        "avgRating": rating_stats.get("average"),
    }


@router.get("")
async def browse_listings(
    crop: str | None = None,
    location: str | None = None,
    maxRate: float | None = None,
    minQty: float | None = None,
    sort: str = "newest",
    uid: str = Depends(current_user_id),
):
    """Open resale discovery for direct buyers, exporters and sellers (farmers excluded)."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "directBuyer", "seller", "exporter")
    docs = await query("resale_listings", [("status", "==", "open")], limit=1000)
    if crop:
        docs = [d for d in docs if crop.lower() in d.get("crop", "").lower()]
    if location:
        docs = [d for d in docs if location.lower() in (d.get("location") or "").lower()]
    if maxRate is not None:
        docs = [d for d in docs if float(d.get("askingRatePerQuintal") or 0) <= maxRate]
    if minQty is not None:
        docs = [d for d in docs if float(d.get("quantityQuintals") or 0) >= minQty]
    if sort == "rate":
        docs.sort(key=lambda d: float(d.get("askingRatePerQuintal") or 0))
    elif sort == "quantity":
        docs.sort(key=lambda d: float(d.get("quantityQuintals") or 0), reverse=True)
    else:
        docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    enriched = []
    for listing in docs:
        seller = await get_user(listing.get("sellerId") or "") or {}
        enriched.append({**listing, "seller": _seller_summary(seller)})
    return {"data": enriched, "total": len(enriched)}


@router.get("/{listing_id}")
async def get_listing(listing_id: str, uid: str = Depends(current_user_id)):
    doc = await get_doc("resale_listings", listing_id)
    if doc is None:
        _error(404, "LISTING_NOT_FOUND", "resale listing not found")
    return doc


@router.delete("/{listing_id}")
async def close_listing(listing_id: str, uid: str = Depends(_seller_user)):
    listing = await get_doc("resale_listings", listing_id)
    if listing is None or listing.get("sellerId") != uid:
        _error(404, "LISTING_NOT_FOUND", "resale listing not found")
    if listing.get("status") != "open":
        _error(409, "LISTING_NOT_OPEN", "only an open listing can be closed")
    remaining = float(listing.get("remainingQuintals") or 0)
    listing["status"] = "closed"
    listing["updatedAt"] = _now()
    await set_doc("resale_listings", listing_id, listing)
    if remaining > 0:
        stock = await get_doc("seller_stock", listing.get("stockId") or "")
        if stock is not None:
            stock["reservedQuintals"] = max(
                0.0, round(float(stock.get("reservedQuintals") or 0) - remaining, 3)
            )
            stock.setdefault("events", []).append(
                {
                    "at": _now(),
                    "action": "released",
                    "deltaQuintals": -remaining,
                    "reason": f"listing {listing_id} closed",
                }
            )
            stock["updatedAt"] = _now()
            await set_doc("seller_stock", stock["id"], stock)
    return listing


@router.post("/{listing_id}/book", status_code=201)
async def book_listing(
    listing_id: str,
    body: ResaleListingBook,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required")
    scope = f"resale.listings.book.{listing_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "directBuyer", "seller", "exporter")
    listing = await get_doc("resale_listings", listing_id)
    if listing is None:
        _error(404, "LISTING_NOT_FOUND", "resale listing not found")
    if listing.get("sellerId") == uid:
        _error(403, "OWN_LISTING", "cannot book your own listing")
    if listing.get("status") != "open":
        _error(409, "LISTING_NOT_OPEN", "listing is not open for booking")
    remaining = float(listing.get("remainingQuintals") or 0)
    qty = float(body.quantityQuintals) if body.quantityQuintals is not None else remaining
    min_qty = listing.get("minQtyPerBuyer")
    if min_qty is not None and qty < float(min_qty):
        _error(
            422,
            "VALIDATION_ERROR",
            "invalid quantity",
            {"quantityQuintals": f"must be at least {min_qty}"},
        )
    if qty > remaining or qty <= 0:
        _error(
            422,
            "VALIDATION_ERROR",
            "invalid quantity",
            {"quantityQuintals": f"must be between 0 and the remaining {remaining}"},
        )
    rate = float(listing.get("askingRatePerQuintal") or 0)
    purchase = {
        "id": f"pur_{uuid.uuid4().hex[:12]}",
        "buyerId": uid,
        "buyerName": user.get("name", ""),
        "farmerId": listing["sellerId"],
        "farmerName": (await get_user(listing["sellerId"]) or {}).get("name", ""),
        "source": {"type": "resale_listing", "refId": listing["id"]},
        "crop": listing.get("crop", ""),
        "variety": listing.get("variety", ""),
        "quantity": qty,
        "unit": "quintal",
        "agreedPricePerUnit": rate,
        "totalAmount": round(rate * qty),
        "advancePaid": 0,
        "status": "confirmed",
        "pickup": None,
        "payments": [],
        "qc": None,
        "finalAmount": None,
        "invoice": None,
        "events": [{"status": "confirmed", "at": _now(), "note": ""}],
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
        "requiredDate": body.requiredDate,
        "deliveryAddress": body.deliveryAddress,
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await set_doc("purchases", purchase["id"], purchase)
    await ensure_chat_room(purchase)
    await notify_user(
        listing["sellerId"],
        type="booking_confirmed",
        title="Booking confirmed / बुकिंग पक्की",
        body=f"{purchase['crop']} — {purchase['quantity']} {purchase['unit']} @ ₹{purchase['agreedPricePerUnit']}",
        deepLink=f"/dashboard/p/purchases/{purchase['id']}",
    )
    # Drain the listing and the underlying stock together.
    new_remaining = round(remaining - qty, 3)
    listing["remainingQuintals"] = new_remaining
    if new_remaining <= 0:
        listing["status"] = "sold"
    listing["updatedAt"] = _now()
    await set_doc("resale_listings", listing_id, listing)
    stock = await get_doc("seller_stock", listing.get("stockId") or "")
    if stock is not None:
        stock["reservedQuintals"] = max(
            0.0, round(float(stock.get("reservedQuintals") or 0) - qty, 3)
        )
        stock["quantityQuintals"] = round(float(stock.get("quantityQuintals") or 0) - qty, 3)
        if stock["quantityQuintals"] <= 0:
            stock["status"] = "exhausted"
        stock.setdefault("events", []).append(
            {
                "at": _now(),
                "action": "sold",
                "deltaQuintals": -qty,
                "reason": f"booking {purchase['id']}",
            }
        )
        stock["updatedAt"] = _now()
        await set_doc("seller_stock", stock["id"], stock)
    res = {"purchase": purchase, "listing": listing}
    await idempotency.store(scope, idempotency_key, res)
    return res
