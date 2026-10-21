import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.core.config import settings
from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.nursery import (
    NurseryBatchCreate,
    NurseryOfferCreate,
    NurseryOrderStatusUpdate,
    NurseryPayoutRequest,
    NurseryPlantCreate,
    NurseryPlantUpdate,
    NurseryProfileUpdate,
    NurseryStockOutRequest,
)
from app.services.admin_auth import current_admin_user
from app.routers.ratings import provider_rating_fields
from app.routers.users import require_role
from app.services.notify import notify_user
from app.services.pnl_engine import record_auto_entry
from app.services.users import get_user

router = APIRouter(prefix="/nursery", tags=["nursery"])
admin_router = APIRouter(prefix="/admin", tags=["admin-nursery"])

COMMISSION_PCT = 5  # platform commission on nursery sales (%)

# Forward order chain walked by the nursery; the seller-hub alias "shipped" is
# accepted in place of "dispatched". Arbitrary jumps are rejected (422).
ORDER_FLOW_NEXT = {"placed": "accepted", "accepted": "packed", "packed": "dispatched", "dispatched": "delivered"}
CANCELLABLE_ORDER_STATES = ("placed", "accepted")

# Buyer-facing notification copy per transition, keyed in the mall vocabulary
# (confirmed -> shipped -> out_for_delivery -> delivered) the buyer app renders.
BUYER_ORDER_NOTIFY = {
    "accepted": ("confirmed", "Order confirmed / ऑर्डर कन्फर्म हुआ", "Your sapling order was accepted by the nursery"),
    "packed": ("shipped", "Order packed / ऑर्डर पैक हुआ", "Your saplings are packed and ready for dispatch"),
    "dispatched": ("out_for_delivery", "Order out for delivery / ऑर्डर रवाना हुआ", "Your sapling consignment is on its way"),
    "delivered": ("delivered", "Order delivered / ऑर्डर पहुँच गया", "Your sapling order was delivered"),
    "cancelled": ("cancelled", "Order cancelled / ऑर्डर रद्द हुआ", "The nursery cancelled your order; any payment will be refunded"),
}


class NurseryOrderStatusPatch(NurseryOrderStatusUpdate):
    """Widens the base model so the seller-hub 'shipped' alias validates."""

    status: Literal["accepted", "packed", "dispatched", "shipped", "delivered", "cancelled"]


async def _nursery_owns_order(order: dict, uid: str) -> bool:
    """Same ownership rule as the list endpoint: top-level nurseryId/sellerId
    or any item referencing one of this nursery's mirrored products."""
    if order.get("nurseryId") == uid or order.get("sellerId") == uid:
        return True
    for item in order.get("items", []):
        prod = await get_doc("products", item.get("productId", ""))
        if prod and (prod.get("nurseryId") == uid or prod.get("sellerId") == uid):
            return True
    return False


async def _restore_order_stock(order: dict) -> None:
    """Return cancelled quantities to the mirrored products doc and the
    nursery_plants doc (mirrors the plant update handler's stock sync)."""
    for item in order.get("items", []):
        plant_id = item.get("productId", "")
        qty = int(item.get("quantity", 0) or 0)
        prod = await get_doc("products", plant_id)
        if prod is not None and isinstance(prod.get("stock"), int):
            prod["stock"] += qty
            prod["inStock"] = prod["stock"] > 0
            await set_doc("products", plant_id, prod)
        plant = await get_doc("nursery_plants", plant_id)
        if plant is not None:
            plant["stock"] = int(plant.get("stock", 0)) + qty
            await set_doc("nursery_plants", plant_id, plant)


async def _notify_buyer_order_status(order: dict, status: str) -> None:
    notify = BUYER_ORDER_NOTIFY.get(status)
    buyer_uid = order.get("userId")
    if not notify or not buyer_uid:
        return
    mall_type, title, body = notify
    await notify_user(
        buyer_uid,
        type=mall_type,
        title=title,
        body=body,
        deepLink="/dashboard/p/purchases",
    )


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _nursery_user(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "nursery")
    return user, uid


# ===========================================================================
# 1. Nursery Profile & KYC
# ===========================================================================

@router.get("/profile")
async def get_nursery_profile(ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    doc = await get_doc("nurseries", uid)
    if doc is None:
        # Default profile from user details
        doc = {
            "id": uid,
            "nurseryName": user.get("name", "My Agri Nursery"),
            "ownerName": user.get("name", ""),
            "phone": user.get("phone", ""),
            "email": user.get("email"),
            "address": f"{user.get('village', '')}, {user.get('tehsil', '')}",
            "district": user.get("district", "Pune"),
            "state": user.get("state", "Maharashtra"),
            "pincode": user.get("pincode", ""),
            "registrationNo": "",
            "licenseNo": "",
            "bankAccount": "",
            "ifscCode": "",
            "settlementUpi": "",
            "deliveryRadiusKm": 50,
            "specializations": ["fruit", "timber"],
            "documentUrls": [],
            "status": "pending",
            "verified": False,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        await set_doc("nurseries", uid, doc)
    return doc


@router.put("/profile")
async def update_nursery_profile(body: NurseryProfileUpdate, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    existing = await get_doc("nurseries", uid) or {}
    updated = {
        **existing,
        **body.model_dump(exclude_none=True),
        "id": uid,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    # Preserve verification unless admin alters it
    if "verified" not in updated:
        updated["verified"] = existing.get("verified", False)
    if "status" not in updated:
        updated["status"] = existing.get("status", "pending")
    await set_doc("nurseries", uid, updated)
    return updated


# ===========================================================================
# 2. Nursery Dashboard
# ===========================================================================

@router.get("/dashboard")
async def get_nursery_dashboard(ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    plants = await query("nursery_plants", [("nurseryId", "==", uid)], limit=500)
    total_plants = len(plants)
    total_stock = sum(int(p.get("stock", 0)) for p in plants)
    low_stock_items = [p for p in plants if int(p.get("stock", 0)) <= 15]

    orders = await query("orders", [("nurseryId", "==", uid)], limit=500)
    total_orders = len(orders)
    pending_orders = [o for o in orders if o.get("status") in ("placed", "accepted", "packed")]
    delivered_orders = [o for o in orders if o.get("status") == "delivered"]
    gross_revenue = sum(float(o.get("finalTotal", o.get("total", 0)) or 0) for o in delivered_orders)

    recent_orders = sorted(orders, key=lambda x: x.get("createdAt", ""), reverse=True)[:5]

    return {
        "nurseryId": uid,
        "stats": {
            "totalPlantsListed": total_plants,
            "totalStock": total_stock,
            "lowStockCount": len(low_stock_items),
            "totalOrders": total_orders,
            "pendingOrdersCount": len(pending_orders),
            "deliveredOrdersCount": len(delivered_orders),
            "grossRevenue": round(gross_revenue, 2),
        },
        "lowStockAlerts": [
            {"id": p["id"], "title": p["title"], "stock": p.get("stock", 0), "species": p.get("species", "")}
            for p in low_stock_items[:5]
        ],
        "recentOrders": recent_orders,
    }


# ===========================================================================
# 3. Plant Inventory Management
# ===========================================================================

@router.get("/plants")
async def list_nursery_plants(
    category: str | None = None,
    search: str | None = None,
    status: str | None = None,
    ctx: tuple = Depends(_nursery_user),
):
    user, uid = ctx
    filters = [("nurseryId", "==", uid)]
    if category:
        filters.append(("category", "==", category))
    if status:
        filters.append(("status", "==", status))
    plants = await query("nursery_plants", filters, limit=500)
    if search:
        s = search.lower()
        plants = [
            p for p in plants
            if s in p.get("title", "").lower() or s in p.get("species", "").lower() or s in p.get("variety", "").lower()
        ]
    return plants


@router.post("/plants", status_code=201)
async def create_nursery_plant(body: NurseryPlantCreate, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    plant_id = f"plant_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    nursery_profile = await get_doc("nurseries", uid) or {}
    nursery_name = nursery_profile.get("nurseryName", user.get("name", "Green Nursery"))

    plant_doc = {
        **body.model_dump(),
        "id": plant_id,
        "nurseryId": uid,
        "nurseryName": nursery_name,
        "district": nursery_profile.get("district", user.get("district", "")),
        "state": nursery_profile.get("state", user.get("state", "")),
        "moderationStatus": "approved",
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("nursery_plants", plant_id, plant_doc)

    # Mirror into shared products collection so farmers & customers find it
    product_doc = {
        "id": plant_id,
        "title": body.title,
        "vernacularTitle": f"{body.species} ({body.variety})" if body.variety else body.species,
        "category": "plants",
        "subCategory": body.category,
        "brand": nursery_name,
        "mrp": body.mrp,
        "discountedPrice": body.price,
        "stock": body.stock,
        "unit": body.unit,
        "rating": 5.0,
        "reviewsCount": 0,
        "dealerName": nursery_name,
        "sellerId": uid,
        "nurseryId": uid,
        "distanceKm": 0.0,
        "bnplAvailable": False,
        "batchNo": f"NUR-{uuid.uuid4().hex[:6].upper()}",
        "inStock": body.stock > 0,
        "imageUrl": body.imageUrl,
        "description": body.description,
        "createdAt": now,
    }
    await set_doc("products", plant_id, product_doc)

    return plant_doc


@router.get("/plants/{plant_id}")
async def get_nursery_plant(plant_id: str, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    plant = await get_doc("nursery_plants", plant_id)
    if plant is None or plant.get("nurseryId") != uid:
        _error(404, "NOT_FOUND", "plant not found")
    return plant


@router.put("/plants/{plant_id}")
async def update_nursery_plant(plant_id: str, body: NurseryPlantUpdate, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    plant = await get_doc("nursery_plants", plant_id)
    if plant is None or plant.get("nurseryId") != uid:
        _error(404, "NOT_FOUND", "plant not found")

    updates = body.model_dump(exclude_none=True)
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    plant.update(updates)
    await set_doc("nursery_plants", plant_id, plant)

    # Sync mirror product
    prod = await get_doc("products", plant_id)
    if prod:
        if "title" in updates:
            prod["title"] = updates["title"]
        if "price" in updates:
            prod["discountedPrice"] = updates["price"]
        if "mrp" in updates:
            prod["mrp"] = updates["mrp"]
        if "stock" in updates:
            prod["stock"] = updates["stock"]
            prod["inStock"] = updates["stock"] > 0
        if "imageUrl" in updates:
            prod["imageUrl"] = updates["imageUrl"]
        await set_doc("products", plant_id, prod)

    return plant


@router.delete("/plants/{plant_id}")
async def delete_nursery_plant(plant_id: str, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    plant = await get_doc("nursery_plants", plant_id)
    if plant is None or plant.get("nurseryId") != uid:
        _error(404, "NOT_FOUND", "plant not found")
    plant["status"] = "out_of_stock"
    plant["archived"] = True
    await set_doc("nursery_plants", plant_id, plant)

    prod = await get_doc("products", plant_id)
    if prod:
        prod["inStock"] = False
        prod["stock"] = 0
        await set_doc("products", plant_id, prod)

    return {"success": True, "message": "plant deleted/archived"}


# ===========================================================================
# 4. Stock & Batch Management
# ===========================================================================

@router.get("/batches")
async def list_nursery_batches(ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    batches = await query("nursery_batches", [("nurseryId", "==", uid)], limit=500)
    return batches


@router.post("/batches", status_code=201)
async def create_nursery_batch(body: NurseryBatchCreate, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    batch_id = f"batch_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()

    current_stock = body.currentStock if body.currentStock is not None else body.initialCount
    doc = {
        **body.model_dump(),
        "id": batch_id,
        "nurseryId": uid,
        "currentStock": current_stock,
        "mortalityCount": 0,
        "createdAt": now,
    }
    await set_doc("nursery_batches", batch_id, doc)

    # Sync plant stock count
    plant = await get_doc("nursery_plants", body.plantId)
    if plant and plant.get("nurseryId") == uid:
        plant["stock"] = int(plant.get("stock", 0)) + body.initialCount
        await set_doc("nursery_plants", body.plantId, plant)
        prod = await get_doc("products", body.plantId)
        if prod:
            prod["stock"] = plant["stock"]
            prod["inStock"] = plant["stock"] > 0
            await set_doc("products", body.plantId, prod)

    return doc


@router.post("/batches/{batch_id}/stock-out")
async def record_stock_out(batch_id: str, body: NurseryStockOutRequest, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    batch = await get_doc("nursery_batches", batch_id)
    if batch is None or batch.get("nurseryId") != uid:
        _error(404, "NOT_FOUND", "batch not found")

    current = int(batch.get("currentStock", 0))
    if current < body.quantity:
        _error(422, "INSUFFICIENT_STOCK", f"Batch has only {current} saplings remaining")

    batch["currentStock"] = current - body.quantity
    if body.reason == "mortality":
        batch["mortalityCount"] = int(batch.get("mortalityCount", 0)) + body.quantity

    logs = batch.setdefault("stockOutLogs", [])
    logs.append({
        "quantity": body.quantity,
        "reason": body.reason,
        "notes": body.notes,
        "at": datetime.now(timezone.utc).isoformat(),
    })
    await set_doc("nursery_batches", batch_id, batch)

    # Deduct from plant stock
    plant_id = batch.get("plantId")
    if plant_id:
        plant = await get_doc("nursery_plants", plant_id)
        if plant:
            plant["stock"] = max(0, int(plant.get("stock", 0)) - body.quantity)
            await set_doc("nursery_plants", plant_id, plant)
            prod = await get_doc("products", plant_id)
            if prod:
                prod["stock"] = plant["stock"]
                prod["inStock"] = plant["stock"] > 0
                await set_doc("products", plant_id, prod)

    return {"success": True, "batch": batch}


@router.get("/stock/alerts")
async def get_stock_alerts(ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    plants = await query("nursery_plants", [("nurseryId", "==", uid)], limit=500)
    low_stock = [p for p in plants if int(p.get("stock", 0)) <= 15]

    batches = await query("nursery_batches", [("nurseryId", "==", uid)], limit=500)
    high_mortality = [b for b in batches if int(b.get("mortalityCount", 0)) >= 10]

    return {
        "lowStock": low_stock,
        "highMortalityBatches": high_mortality,
    }


# ===========================================================================
# 5. Orders Received
# ===========================================================================

@router.get("/orders")
async def list_nursery_orders(status: str | None = None, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    # Orders can have top-level nurseryId or items referencing products of this nursery
    orders = await query("orders", limit=1000)
    nursery_orders = []
    for o in orders:
        if o.get("nurseryId") == uid or o.get("sellerId") == uid:
            nursery_orders.append(o)
            continue
        # Check items
        for item in o.get("items", []):
            prod = await get_doc("products", item.get("productId", ""))
            if prod and (prod.get("nurseryId") == uid or prod.get("sellerId") == uid):
                nursery_orders.append(o)
                break

    if status and status != "all":
        nursery_orders = [o for o in nursery_orders if o.get("status") == status]

    return sorted(nursery_orders, key=lambda x: x.get("createdAt", ""), reverse=True)


@router.get("/orders/{order_id}")
async def get_nursery_order_detail(order_id: str, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    order = await get_doc("orders", order_id)
    if order is None:
        _error(404, "NOT_FOUND", "order not found")
    if not await _nursery_owns_order(order, uid):
        _error(403, "FORBIDDEN", "this order does not belong to your nursery")
    return order


@router.post("/orders/{order_id}/status")
async def update_nursery_order_status(
    order_id: str,
    body: NurseryOrderStatusPatch,
    ctx: tuple = Depends(_nursery_user),
):
    user, uid = ctx
    order = await get_doc("orders", order_id)
    if order is None:
        _error(404, "NOT_FOUND", "order not found")
    if not await _nursery_owns_order(order, uid):
        _error(403, "FORBIDDEN", "this order does not belong to your nursery")

    # "shipped" is the seller-hub alias of the nursery's "dispatched" state.
    new_status = "dispatched" if body.status == "shipped" else body.status
    current = order.get("status", "placed")
    if new_status == "cancelled":
        if current not in CANCELLABLE_ORDER_STATES:
            _error(422, "INVALID_STATUS_TRANSITION", f"cannot cancel an order in '{current}' state")
    elif ORDER_FLOW_NEXT.get(current) != new_status:
        _error(422, "INVALID_STATUS_TRANSITION", f"cannot move order from {current} to {new_status}")

    order["status"] = new_status
    if body.trackingNumber:
        order["trackingNumber"] = body.trackingNumber
    if body.courierName:
        order["courierName"] = body.courierName

    events = order.setdefault("events", [])
    events.append({
        "status": new_status,
        "at": datetime.now(timezone.utc).isoformat(),
        "note": body.notes,
        "trackingNumber": body.trackingNumber,
        "courierName": body.courierName,
    })

    if new_status == "cancelled":
        await _restore_order_stock(order)

    await set_doc("orders", order_id, order)

    # When delivered, record revenue in P&L
    if new_status == "delivered":
        amount_paisa = int(round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100))
        await record_auto_entry(
            uid, "income", amount_paisa, "nursery_order_revenue", "marketplace_order", order_id
        )

    await _notify_buyer_order_status(order, new_status)

    return {"success": True, "order": order}


@router.get("/orders/{order_id}/invoice")
async def get_order_invoice(order_id: str, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    order = await get_doc("orders", order_id)
    if order is None:
        _error(404, "NOT_FOUND", "order not found")
    if not await _nursery_owns_order(order, uid):
        _error(403, "FORBIDDEN", "this order does not belong to your nursery")

    nursery = await get_doc("nurseries", uid) or {}
    total = float(order.get("finalTotal", order.get("total", 0)) or 0)
    gst_rate = COMMISSION_PCT / 100.0
    taxable_amount = round(total / (1 + gst_rate), 2)
    gst_amount = round(total - taxable_amount, 2)

    return {
        "invoiceNumber": f"INV-NUR-{order_id[-8:].upper()}",
        "invoiceDate": order.get("createdAt", datetime.now(timezone.utc).isoformat())[:10],
        "nursery": {
            "name": nursery.get("nurseryName", "Agro Nursery"),
            "owner": nursery.get("ownerName", ""),
            "address": nursery.get("address", ""),
            "district": nursery.get("district", ""),
            "state": nursery.get("state", ""),
            "registrationNo": nursery.get("registrationNo", "NHB/2026/REG"),
        },
        "customer": {
            "userId": order.get("userId"),
            "deliveryAddress": order.get("deliveryAddress", ""),
            "paymentMethod": order.get("paymentMethod", "UPI"),
        },
        "items": order.get("items", []),
        "subtotal": taxable_amount,
        "gstAmount": gst_amount,
        "total": total,
    }


# ===========================================================================
# 6. Ratings Received (reviews page for the nursery)
# ===========================================================================

@router.get("/ratings")
async def list_nursery_ratings(ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    aggregate = await provider_rating_fields(uid)
    docs = await query("ratings", [("providerId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    items = []
    for doc in docs:
        rater = await get_doc("users", doc.get("raterId") or "") or {}
        order_id = doc.get("bookingId") or ""
        order = await get_doc("orders", order_id) if order_id else None
        product_titles = []
        if order:
            for it in order.get("items", []):
                prod = await get_doc("products", it.get("productId", ""))
                if prod:
                    product_titles.append(prod.get("title", ""))
        items.append(
            {
                "id": doc["id"],
                "bookingId": order_id,
                "orderId": order_id,
                "raterId": doc.get("raterId"),
                "raterName": rater.get("name"),
                "rating": doc.get("stars"),
                "comment": doc.get("comment", ""),
                "tags": doc.get("tags") or [],
                "orderStatus": (order or {}).get("status"),
                "productTitles": product_titles,
                "reply": doc.get("reply"),
                "repliedAt": doc.get("repliedAt"),
                "createdAt": doc.get("createdAt"),
            }
        )
    return {"average": aggregate["ratingAvg"], "count": aggregate["ratingCount"], "items": items}


# ===========================================================================
# 7. Offers & Discounts
# ===========================================================================

@router.get("/offers")
async def list_nursery_offers(ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    offers = await query("nursery_offers", [("nurseryId", "==", uid)], limit=100)
    return offers


@router.post("/offers", status_code=201)
async def create_nursery_offer(body: NurseryOfferCreate, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    offer_id = f"off_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **body.model_dump(),
        "id": offer_id,
        "nurseryId": uid,
        "usedCount": 0,
        "active": True,
        "createdAt": now,
    }
    await set_doc("nursery_offers", offer_id, doc)

    # Register in shared coupons collection for checkout application
    coupon_doc = {
        "code": body.code.upper(),
        "type": "percentage",
        "value": body.discountPct,
        "discountPercentage": body.discountPct,
        "minOrder": body.minOrderAmount,
        "minOrderValue": body.minOrderAmount,
        "maxDiscount": body.maxDiscountAmount,
        "validUntil": body.validUntil,
        "nurseryId": uid,
        "usedCount": 0,
        "active": True,
    }
    await set_doc("coupons", body.code.upper(), coupon_doc)

    return doc


@router.delete("/offers/{offer_id}")
async def delete_nursery_offer(offer_id: str, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    offer = await get_doc("nursery_offers", offer_id)
    if offer is None or offer.get("nurseryId") != uid:
        _error(404, "NOT_FOUND", "offer not found")
    offer["active"] = False
    await set_doc("nursery_offers", offer_id, offer)

    # Deactivate coupon
    code = offer.get("code", "").upper()
    if code:
        coupon = await get_doc("coupons", code)
        if coupon:
            coupon["active"] = False
            await set_doc("coupons", code, coupon)

    return {"success": True}


# ===========================================================================
# 8. Earnings & Payouts
# ===========================================================================

async def _payout_ledger(uid: str) -> dict:
    orders = await query("orders", limit=1000)
    gross = 0.0
    for o in orders:
        if (o.get("nurseryId") == uid or o.get("sellerId") == uid) and o.get("status") == "delivered":
            gross += float(o.get("finalTotal", o.get("total", 0)) or 0)

    commission = round(gross * (COMMISSION_PCT / 100.0), 2)
    net_earnings = round(gross - commission, 2)

    payout_history = await query("nursery_payouts", [("nurseryId", "==", uid)], limit=100)
    requested = sum(
        float(p.get("amount", 0))
        for p in payout_history
        if p.get("status") in ("pending", "processed", "completed")
    )
    withdrawn = sum(
        float(p.get("amount", 0))
        for p in payout_history
        if p.get("status") in ("processed", "completed")
    )
    available = max(0.0, round(net_earnings - requested, 2))
    return {
        "gross": round(gross, 2),
        "commission": commission,
        "netEarnings": net_earnings,
        "requested": round(requested, 2),
        "withdrawn": round(withdrawn, 2),
        "available": available,
        "history": payout_history,
    }


@router.get("/payouts")
async def get_nursery_payouts(ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    ledger = await _payout_ledger(uid)
    return {
        "grossRevenue": ledger["gross"],
        "commissionPct": float(COMMISSION_PCT),
        "commissionDeducted": ledger["commission"],
        "netEarnings": ledger["netEarnings"],
        "requestedAmount": ledger["requested"],
        "withdrawnAmount": ledger["withdrawn"],
        "availableBalance": ledger["available"],
        "payouts": sorted(ledger["history"], key=lambda x: x.get("createdAt", ""), reverse=True),
    }


@router.post("/payouts/request", status_code=201)
async def request_nursery_payout(body: NurseryPayoutRequest, ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    ledger = await _payout_ledger(uid)
    if body.amount > ledger["available"]:
        _error(
            422,
            "INSUFFICIENT_BALANCE",
            f"requested amount exceeds available balance of ₹{ledger['available']}",
            {"amount": f"available balance is ₹{ledger['available']}"},
        )

    payout_id = f"pay_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    nursery = await get_doc("nurseries", uid) or {}
    upi = body.settlementUpi or nursery.get("settlementUpi") or "nursery@upi"

    status = "pending"
    if not settings.razorpay_key_id:
        # Dev shim mirrors services/payments.py: without Razorpay keys the
        # sandbox auto-processes the payout immediately.
        status = "processed"

    doc = {
        "id": payout_id,
        "nurseryId": uid,
        "amount": body.amount,
        "settlementUpi": upi,
        "status": status,
        "notes": body.notes,
        "createdAt": now,
    }
    await set_doc("nursery_payouts", payout_id, doc)
    return doc


@router.get("/payouts/export")
async def export_payouts_csv(ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    payouts = await query("nursery_payouts", [("nurseryId", "==", uid)], limit=200)
    lines = ["PayoutID,Amount,Status,UPI,Date"]
    for p in payouts:
        lines.append(f"{p.get('id')},{p.get('amount')},{p.get('status')},{p.get('settlementUpi')},{p.get('createdAt')}")
    return PlainTextResponse("\n".join(lines), media_type="text/csv")


# ===========================================================================
# 9. AI Analysis for Nursery
# ===========================================================================

@router.get("/ai-insights")
async def get_nursery_ai_insights(ctx: tuple = Depends(_nursery_user)):
    user, uid = ctx
    return {
        "seasonalTrend": {
            "currentSeason": "Pre-Monsoon / Planting Season",
            "highDemandCategories": ["fruit", "timber"],
            "trendSummary": "Monsoon arrival drives 4.5x surge in Teak, Bamboo, and Malabar Neem timber saplings. High demand expected for grafted Kesar Mango and Guava.",
        },
        "salesForecast": [
            {"period": "Next 30 Days", "projectedUnits": 1250, "projectedRevenue": 95000, "confidence": 0.88},
            {"period": "Next 60 Days", "projectedUnits": 2800, "projectedRevenue": 210000, "confidence": 0.84},
            {"period": "Next 90 Days", "projectedUnits": 4200, "projectedRevenue": 320000, "confidence": 0.79},
        ],
        "pricingSuggestions": [
            {"species": "Kesar Mango Grafted", "currentPrice": 180, "suggestedPrice": 195, "marketAverage": 210, "action": "Increase price +8% due to high orchard demand"},
            {"species": "Malabar Neem", "currentPrice": 45, "suggestedPrice": 42, "marketAverage": 40, "action": "Slight discount to capture bulk timber plantation orders"},
            {"species": "Sandalwood / चंदन", "currentPrice": 320, "suggestedPrice": 350, "marketAverage": 360, "action": "High margin opportunity; stock ready saplings"},
        ],
        "stockPlanning": [
            {"species": "Kesar Mango", "recommendation": "Propagate 300 additional grafted saplings before June peak", "urgency": "High"},
            {"species": "Taiwan Guava", "recommendation": "Maintain 150 ready-to-dispatch bags in shady bed", "urgency": "Medium"},
            {"species": "Neem & Subabul", "recommendation": "Adequate stock for agroforestry drives", "urgency": "Normal"},
        ],
        "fastMovingCategories": [
            {"category": "Fruit Saplings", "sharePct": 42},
            {"category": "Timber / Agroforestry", "sharePct": 35},
            {"category": "Medicinal & Herbal", "sharePct": 14},
            {"category": "Ornamental & Flowering", "sharePct": 9},
        ],
    }


# ===========================================================================
# 10. Admin Console Endpoints for Nursery
# ===========================================================================

@admin_router.get("/nurseries")
async def list_admin_nurseries(user: dict = Depends(current_admin_user)):
    nurseries = await query("nurseries", limit=1000)
    return nurseries


@admin_router.post("/nurseries/{nursery_id}/reject")
async def reject_nursery_kyc(nursery_id: str, reason: str = "Incomplete registration docs", user: dict = Depends(current_admin_user)):
    doc = await get_doc("nurseries", nursery_id)
    if doc is None:
        _error(404, "NOT_FOUND", "nursery not found")
    doc["status"] = "rejected"
    doc["verified"] = False
    doc["rejectionReason"] = reason
    await set_doc("nurseries", nursery_id, doc)
    return {"success": True, "nursery": doc}


@admin_router.post("/plants/{plant_id}/moderate")
async def moderate_plant(
    plant_id: str,
    action: Literal["approved", "rejected", "taken_down"] = "approved",
    reason: str = "",
    user: dict = Depends(current_admin_user),
):
    plant = await get_doc("nursery_plants", plant_id)
    if plant is None:
        _error(404, "NOT_FOUND", "plant not found")
    plant["moderationStatus"] = action
    plant["moderationReason"] = reason
    await set_doc("nursery_plants", plant_id, plant)

    prod = await get_doc("products", plant_id)
    if prod:
        prod["inStock"] = (action == "approved" and plant.get("stock", 0) > 0)
        await set_doc("products", plant_id, prod)

    return {"success": True, "plant": plant}


@admin_router.get("/nursery/kpis")
async def get_admin_nursery_kpis(user: dict = Depends(current_admin_user)):
    nurseries = await query("nurseries", limit=1000)
    plants = await query("nursery_plants", limit=1000)
    orders = await query("orders", limit=1000)
    nursery_orders = [o for o in orders if o.get("nurseryId")]

    return {
        "nurseriesCount": len(nurseries),
        "plantsCount": len(plants),
        "totalOrders": len(nursery_orders),
        "gmv": sum(float(o.get("finalTotal", o.get("total", 0)) or 0) for o in nursery_orders),
    }
