import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.pdfgen import canvas as _pdf_canvas

from app.core.db import get_doc, query, set_doc
from app.core.config import settings
from app.core.deps import current_user_id
from app.core.ratelimit import hit
from app.models.marketplace import (
    PlaceOrderRequest,
    RazorpayOrderRequest,
    RazorpayRefundRequest,
    RazorpayVerifyRequest,
)
from app.routers.coupons import coupon_discount, coupon_reject_reason
from app.routers.users import require_role
from app.services.coins import InsufficientCoins, spend_coins
from app.services.notify import notify_user
from app.services.payments import (
    create_razorpay_order,
    refund_razorpay_payment,
    verify_razorpay_signature,
)
from app.services.tasks import emit_task
from app.services.pnl_engine import record_auto_entry
from app.services.users import get_user

router = APIRouter(tags=["orders"])

MARKET_ROLES = ("farmer", "farmLandlord", "transport", "seller", "customer", "directBuyer", "nursery")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _order_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, *MARKET_ROLES)
    return uid


async def _own_order(order_id: str, uid: str, not_found_on_foreign: bool = False) -> dict:
    order = await get_doc("orders", order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    if order.get("userId") != uid:
        if not_found_on_foreign:
            _error(404, "ORDER_NOT_FOUND", "order not found")
        _error(403, "FORBIDDEN", "order belongs to another user")
    return order


def _append_event(order: dict, status: str, note: str = ""):
    events = order.setdefault("events", [])
    events.append({"status": status, "at": datetime.now(timezone.utc).isoformat(), "note": note})


async def _restore_stock(order: dict):
    for item in order.get("items", []):
        product = await get_doc("products", item["productId"])
        if product is not None and isinstance(product.get("stock"), int):
            product["stock"] += item["quantity"]
            await set_doc("products", item["productId"], product)
        await _restore_module_stock(product, item["quantity"])


# Module inventory lives in the nursery / gruh-udyog collections; a mall order
# against a module listing must move that stock too. Everything here is
# defensive — a missing module doc never breaks placement or cancellation.
async def _decrement_module_stock(product: dict | None, quantity: int) -> None:
    if product is None:
        return
    gruh_product_id = product.get("gruhProductId")
    if gruh_product_id:
        gruh_product = await get_doc("gruh_udyog_products", str(gruh_product_id))
        if gruh_product is not None and isinstance(gruh_product.get("stock"), int):
            gruh_product["stock"] = max(0, gruh_product["stock"] - quantity)
            await set_doc("gruh_udyog_products", str(gruh_product_id), gruh_product)
    if product.get("nurseryId"):
        plant = await get_doc("nursery_plants", product["id"])
        if plant is not None and isinstance(plant.get("stock"), int):
            plant["stock"] = max(0, plant["stock"] - quantity)
            await set_doc("nursery_plants", product["id"], plant)
        # Oldest open batch first (FEFO), mirroring nursery.py's stock-out flow.
        batches = await query("nursery_batches", [("plantId", "==", product["id"])], limit=500)
        batches = [b for b in batches if int(b.get("currentStock") or 0) > 0]
        batches.sort(key=lambda b: b.get("createdAt") or "")
        if batches:
            batch = batches[0]
            batch["currentStock"] = max(0, int(batch.get("currentStock") or 0) - quantity)
            await set_doc("nursery_batches", batch["id"], batch)


async def _restore_module_stock(product: dict | None, quantity: int) -> None:
    if product is None:
        return
    gruh_product_id = product.get("gruhProductId")
    if gruh_product_id:
        gruh_product = await get_doc("gruh_udyog_products", str(gruh_product_id))
        if gruh_product is not None and isinstance(gruh_product.get("stock"), int):
            gruh_product["stock"] += quantity
            await set_doc("gruh_udyog_products", str(gruh_product_id), gruh_product)
    if product.get("nurseryId"):
        plant = await get_doc("nursery_plants", product["id"])
        if plant is not None and isinstance(plant.get("stock"), int):
            plant["stock"] += quantity
            await set_doc("nursery_plants", product["id"], plant)
        batches = await query("nursery_batches", [("plantId", "==", product["id"])], limit=500)
        batches = [b for b in batches if int(b.get("currentStock") or 0) > 0]
        batches.sort(key=lambda b: b.get("createdAt") or "")
        if batches:
            batch = batches[0]
            batch["currentStock"] = int(batch.get("currentStock") or 0) + quantity
            await set_doc("nursery_batches", batch["id"], batch)


async def _notify_order_seller(order: dict, products: dict[str, dict]) -> None:
    """New-order task + notification for every seller behind the order's items.

    Seller id resolution is defensive: mall sellers expose `sellerId`, gruh-udyog
    listings carry `unitId` (+ `gruhProductId`) and nursery listings `nurseryId`;
    the owner user id is the same value on each module's docs.
    """
    seen: set[str] = set()
    total_qty = sum(int(i.get("quantity") or 0) for i in order.get("items", []))
    for item in order.get("items", []):
        product = products.get(item.get("productId") or "") or {}
        seller_id = (
            product.get("sellerId")
            or product.get("unitId")
            or product.get("nurseryId")
        )
        if not seller_id or seller_id in seen:
            continue
        seen.add(str(seller_id))
        order_id = str(order.get("id") or "")
        title = f"New order {order_id}"
        body = (
            f"You received a new Krishi Mall order ({order.get('paymentMethod')}) "
            f"for {total_qty} item(s). Pack and confirm it from your seller dashboard."
        )
        try:
            await emit_task(
                user_id=str(seller_id),
                persona="seller",
                module="marketplace",
                kind="new_order",
                title_en=title,
                title_hi=title,
                subtitle=order_id,
                priority="today",
                deep_link="/dashboard/p/seller/orders",
                source_id=order_id,
            )
            await notify_user(
                str(seller_id),
                type="order_status",
                title=title,
                body=body,
                deepLink="/dashboard/p/seller/orders",
            )
        except Exception:  # noqa: BLE001 — seller alerting must never block placement
            continue


def _bnpl_schedule(final_total: float) -> list[dict]:
    """Two equal installments at 30/60 days, exactly as the order response."""
    return [
        {"installment": 1, "dueInDays": 30, "amount": final_total / 2},
        {"installment": 2, "dueInDays": 60, "amount": final_total / 2},
    ]


# Buyer-facing task titles per order status (phase-05 WS-03 task 3.14).
ORDER_STATUS_TITLES: dict[str, tuple[str, str]] = {
    "placed": ("Order placed", "ऑर्डर दिया गया"),
    "paid": ("Payment received", "भुगतान प्राप्त हुआ"),
    "confirmed": ("Order confirmed", "ऑर्डर की पुष्टि हुई"),
    "shipped": ("Order shipped", "ऑर्डर भेज दिया गया"),
    "out_for_delivery": ("Order out for delivery", "ऑर्डर डिलीवरी के लिए निकला"),
    "delivered": ("Order delivered", "ऑर्डर पहुँच गया"),
    "closed": ("Order closed", "ऑर्डर पूर्ण हुआ"),
    "returned": ("Order returned", "ऑर्डर वापस हुआ"),
    "cancelled": ("Order cancelled", "ऑर्डर रद्द हुआ"),
    "return_requested": ("Return requested", "वापसी का अनुरोध किया"),
}


async def emit_order_status_task(order: dict, status: str) -> None:
    """Emit/refresh the buyer's order-status task (dedupe-safe per order)."""
    title_en, title_hi = ORDER_STATUS_TITLES.get(status, (f"Order {status}", f"ऑर्डर {status}"))
    order_id = str(order.get("id") or "")
    await emit_task(
        user_id=str(order.get("userId") or ""),
        persona="farmer",
        module="marketplace",
        kind="order_status",
        title_en=title_en,
        title_hi=title_hi,
        subtitle=order_id,
        priority="today",
        deep_link="/dashboard/p/orders",
        source_id=order_id or status,
    )
    await _write_order_notification(order, status)


# SR 24: customer-facing order-status notifications. One doc per transition on
# the fulfilment path (confirmed → shipped → out_for_delivery → delivered),
# shaped exactly like the notifications.py producer (id, userId, title, body,
# type, read:false, createdAt).
_ORDER_NOTIFICATION_COPY: dict[str, tuple[str, str]] = {
    "confirmed": (
        "Order confirmed",
        "Your order {id} is confirmed and is being packed by the seller.",
    ),
    "shipped": (
        "Order packed & picked up",
        "Your order {id} has been packed and handed over to the pickup agent.",
    ),
    "out_for_delivery": (
        "Delivering today",
        "Your order {id} is out for delivery — the delivery agent is delivering today. "
        "Please keep your phone reachable.",
    ),
    "delivered": (
        "Order delivered",
        "Your order {id} has been delivered. Thank you for shopping on Krishi Mall!",
    ),
}


async def _write_order_notification(order: dict, status: str) -> None:
    """Write a `notifications` doc for the buyer on key fulfilment transitions."""
    copy = _ORDER_NOTIFICATION_COPY.get(status)
    if copy is None:
        return
    title, body = copy
    notification_id = f"ntf_{uuid.uuid4().hex}"
    await set_doc(
        "notifications",
        notification_id,
        {
            "id": notification_id,
            "userId": str(order.get("userId") or ""),
            "title": title,
            "body": body.format(id=order.get("id")),
            "type": f"order_{status}",
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


async def _audit(order: dict, action: str, extra: dict | None = None) -> None:
    """Rule 3: every financial order mutation writes an audit_logs row."""
    audit_id = f"audit_{uuid.uuid4().hex[:12]}"
    await set_doc(
        "audit_logs",
        audit_id,
        {
            "id": audit_id,
            "action": action,
            "orderId": order.get("id"),
            "userId": order.get("userId"),
            "amountPaisa": int(round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100)),
            "at": datetime.now(timezone.utc).isoformat(),
            **(extra or {}),
        },
    )


@router.post("/orders")
async def place_order(body: PlaceOrderRequest, uid: str = Depends(_order_user)):
    existing = await get_doc("idempotency_keys", body.idempotencyKey)
    if existing is not None:
        return existing["response"]
    delivery_address = body.deliveryAddress
    if body.addressId:
        address = await get_doc("addresses", body.addressId)
        if address is None or address.get("userId") != uid:
            _error(404, "ADDRESS_NOT_FOUND", "address not found")
        delivery_address = (
            f"{address['line1']}, {address['village']}, {address['district']}, "
            f"{address['state']} - {address['pincode']}"
        )
    items = []
    total = 0
    products = {}
    for item in body.items:
        if item.quantity < 1:
            _error(422, "VALIDATION_ERROR", "invalid quantity", {"quantity": "must be at least 1"})
        product = await get_doc("products", item.productId)
        if product is None:
            _error(404, "PRODUCT_NOT_FOUND", f"product {item.productId} not found")
        min_order_qty = product.get("minOrderQty")
        if isinstance(min_order_qty, int) and min_order_qty > 1 and item.quantity < min_order_qty:
            _error(
                422,
                "MIN_ORDER_QTY",
                f"minimum orderable quantity for {product.get('title', item.productId)} is {min_order_qty}",
                {item.productId: f"order at least {min_order_qty} units"},
            )
        if isinstance(product.get("stock"), int) and product["stock"] < item.quantity:
            _error(
                409,
                "OUT_OF_STOCK",
                f"insufficient stock for {product.get('title', item.productId)}",
                {item.productId: f"only {product['stock']} left in stock"},
            )
        items.append({"productId": item.productId, "quantity": item.quantity})
        products[item.productId] = product
        total += product["discountedPrice"] * item.quantity
    # Doorstep delivery fee (paisa) is part of the payable: it is added to the
    # merchandise total BEFORE the coupon/coins math so discounts never dip
    # into the fee and coins can offset it like any other rupee.
    delivery_fee_paisa = int(body.deliveryFeePaisa or 0)
    delivery_fee = delivery_fee_paisa / 100
    discount = 0
    coupon = None
    if body.couponCode:
        coupon = await get_doc("coupons", body.couponCode)
        if coupon is None:
            _error(400, "COUPON_INVALID", "coupon not found")
        reason = coupon_reject_reason(coupon, total)
        if reason is not None:
            _error(400, "COUPON_INVALID", reason)
        discount = coupon_discount(coupon, total)
    final_total = total + delivery_fee - discount
    now = datetime.now(timezone.utc).isoformat()
    order_id = f"ord_{uuid.uuid4().hex[:12]}"

    # SR 8: Krushi Ratna coin redemption — 1 coin = Rs 1, capped at the order
    # total. Coins burn through the shared coin service so the per-user ledger,
    # shadow ledger and audit row (rule 3) stay consistent with every other
    # spend path.
    coins_redeemed = 0
    buyer: dict | None = None
    if body.coinsToRedeem > 0:
        buyer = await get_user(uid) or {}
        balance = int(buyer.get("agriCoins") or 0)
        if body.coinsToRedeem > balance:
            _error(
                422,
                "COINS_INSUFFICIENT",
                f"you have {balance} Krushi Ratna coins but tried to redeem {body.coinsToRedeem}",
                {"coinsToRedeem": f"available balance is {balance}"},
            )
        coins_redeemed = min(int(body.coinsToRedeem), int(final_total))
        if coins_redeemed > 0:
            try:
                await spend_coins(uid, coins_redeemed, "order_redemption", order_id)
            except InsufficientCoins:
                _error(422, "COINS_INSUFFICIENT", "insufficient Krushi Ratna coin balance")
        final_total -= coins_redeemed

    order = {
        "id": order_id,
        "userId": uid,
        "items": items,
        "paymentMethod": body.paymentMethod,
        "deliveryAddress": delivery_address,
        "total": total,
        "status": "placed",
        "refundStatus": "none",
        "events": [{"status": "placed", "at": now, "note": ""}],
        "createdAt": now,
    }
    if body.deliverySlot:
        order["deliverySlot"] = body.deliverySlot
    if delivery_fee_paisa > 0:
        order["deliveryFeePaisa"] = delivery_fee_paisa
        order["deliveryFee"] = delivery_fee
        order["finalTotal"] = final_total
    if coupon is not None:
        order["couponCode"] = body.couponCode
        order["discount"] = discount
        order["finalTotal"] = final_total
    if coins_redeemed > 0:
        order["coinsRedeemed"] = coins_redeemed
        order["coinDiscount"] = coins_redeemed
        order["finalTotal"] = final_total
    # Seller attribution for module dashboards (nursery queries orders by
    # nurseryId) and seller notifications — stamped from the product docs.
    for product in products.values():
        if product.get("nurseryId") and not order.get("nurseryId"):
            order["nurseryId"] = product["nurseryId"]
        seller_id = product.get("sellerId") or product.get("unitId")
        if seller_id and not order.get("sellerId"):
            order["sellerId"] = seller_id
    if body.plantTree:
        # SR 19: opt-in plant-a-tree — write the adoption doc directly with the
        # same shape tree.py's adoptions list reads (tree.py is owned elsewhere).
        if buyer is None:
            buyer = await get_user(uid) or {}
        adoption_id = f"adop_{uuid.uuid4().hex[:10]}"
        adoption = {
            "id": adoption_id,
            "farmerId": uid,
            "userId": uid,
            "sponsorName": buyer.get("name") or "Krishi Mall Customer",
            "treeSpecies": "Native mix",
            "species": "Native mix",
            "treesSponsored": 1,
            "adoptionDate": now[:10],
            "plantedAt": now,
            "createdAt": now,
            "status": "planted",
            "orderId": order_id,
            "source": "marketplace_order",
        }
        await set_doc("tree_adoptions", adoption_id, adoption)
        order["treeAdoptionId"] = adoption_id
    if body.paymentMethod == "bnpl":
        order["bnplSchedule"] = _bnpl_schedule(final_total)
    await set_doc("orders", order_id, order)
    for item in body.items:
        product = products[item.productId]
        if isinstance(product.get("stock"), int):
            product["stock"] -= item.quantity
            await set_doc("products", item.productId, product)
        await _decrement_module_stock(product, item.quantity)
    if coupon is not None:
        coupon["usedCount"] = coupon.get("usedCount", 0) + 1
        await set_doc("coupons", body.couponCode, coupon)
    await set_doc("carts", uid, {"items": {}})
    response = {"orderId": order_id, "total": total}
    if delivery_fee_paisa > 0:
        response["deliveryFeePaisa"] = delivery_fee_paisa
        response["finalTotal"] = final_total
    if coupon is not None:
        response["discount"] = discount
        response["finalTotal"] = final_total
    if coins_redeemed > 0:
        response["coinsRedeemed"] = coins_redeemed
        response["finalTotal"] = final_total
    if body.paymentMethod == "bnpl":
        response["bnplSchedule"] = order["bnplSchedule"]
    await set_doc("idempotency_keys", body.idempotencyKey, {"key": body.idempotencyKey, "response": response})
    await _audit(order, "order_placed")
    await emit_order_status_task(order, "placed")
    await _notify_order_seller(order, products)
    order_amount_paisa = int(
        round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100)
    )
    await record_auto_entry(
        uid, "expense", order_amount_paisa, "marketplace_order", "marketplace_order", order_id
    )
    return response


@router.get("/orders")
async def list_orders(page: int = 1, pageSize: int = 20, uid: str = Depends(_order_user)):
    docs = await query("orders", [("userId", "==", uid)], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


@router.get("/orders/{order_id}")
async def get_order(order_id: str, uid: str = Depends(_order_user)):
    return await _own_order(order_id, uid)


@router.get("/orders/{order_id}/bnpl-schedule")
async def get_bnpl_schedule(order_id: str, uid: str = Depends(_order_user)):
    """P2-17: the persisted BNPL installment plan (order owner only). Orders
    placed before persistence existed are computed lazily — exactly as POST
    /orders does — and then stored on the doc."""
    order = await _own_order(order_id, uid)
    schedule = order.get("bnplSchedule")
    if schedule is None:
        if order.get("paymentMethod") != "bnpl":
            _error(404, "BNPL_SCHEDULE_NOT_FOUND", "order has no BNPL schedule")
        final_total = float(order.get("finalTotal", order.get("total", 0)) or 0)
        schedule = _bnpl_schedule(final_total)
        order["bnplSchedule"] = schedule
        await set_doc("orders", order_id, order)
    return {"orderId": order_id, "bnplSchedule": schedule}


def _uncompressed_canvas(filename: str, **kwargs):
    """pageCompression=0 keeps text streams plain so invoice bytes are greppable
    (and mirrors the repo's SimpleDocTemplate PDF helpers otherwise)."""
    kwargs.pop("pageCompression", None)
    return _pdf_canvas.Canvas(filename, pageCompression=0, **kwargs)


def _build_order_invoice_pdf(order: dict, buyer_name: str, item_rows: list[list[str]], totals: list[list[str]]) -> str:
    path = f"/tmp/order_invoice_{order.get('id', uuid.uuid4().hex[:8])}.pdf"
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Agrovercity Krishi Mall - Order Invoice", styles["Title"]),
        Paragraph(
            f"Generated on: {datetime.now(timezone.utc).date().isoformat()}", styles["Normal"]
        ),
        Spacer(1, 12),
    ]
    meta = [
        ["Order ID", str(order.get("id", ""))],
        ["Date", str((order.get("createdAt") or "")[:10] or "—")],
        ["Customer", buyer_name or "—"],
        ["Payment Method", str(order.get("paymentMethod", ""))],
        ["Delivery Address", str(order.get("deliveryAddress") or "—")],
        ["Delivery Slot", str(order.get("deliverySlot") or "—")],
    ]
    meta_table = Table(meta, colWidths=[140, 320])
    meta_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 12))

    items_table = Table([["Item", "Qty", "Rate (Rs)", "Amount (Rs)"], *item_rows], colWidths=[240, 60, 90, 90])
    items_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ]
        )
    )
    story.append(items_table)
    story.append(Spacer(1, 12))

    totals_table = Table(totals, colWidths=[240, 240])
    totals_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ]
        )
    )
    story.append(totals_table)

    doc = SimpleDocTemplate(path, pagesize=A4)
    doc.build(story, canvasmaker=_uncompressed_canvas)
    return path


@router.get("/orders/{order_id}/invoice.pdf")
async def order_invoice_pdf(order_id: str, uid: str = Depends(_order_user)):
    """SR 9: PDF tax invoice — the ordering customer or a seller whose products
    appear in the order."""
    order = await get_doc("orders", order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    if order.get("userId") != uid:
        seller_ids: set[str] = set()
        for item in order.get("items") or []:
            product = await get_doc("products", item.get("productId") or "")
            if product is not None and product.get("sellerId"):
                seller_ids.add(str(product["sellerId"]))
        if uid not in seller_ids:
            _error(403, "FORBIDDEN", "only the order owner or its seller can download this invoice")
    buyer = await get_user(str(order.get("userId") or "")) or {}
    item_rows: list[list[str]] = []
    for item in order.get("items") or []:
        product = await get_doc("products", item.get("productId") or "") or {}
        price = float(product.get("discountedPrice") or product.get("price") or 0)
        qty = int(item.get("quantity") or 0)
        item_rows.append(
            [
                str(product.get("title") or item.get("productId") or "Item"),
                str(qty),
                f"{price:.2f}",
                f"{price * qty:.2f}",
            ]
        )
    subtotal = float(order.get("total") or 0)
    coupon_discount_value = float(order.get("discount") or 0)
    coin_discount = float(order.get("coinDiscount") or order.get("coinsRedeemed") or 0)
    delivery_fee = float(order.get("deliveryFee") or 0)
    grand_total = float(order.get("finalTotal") or (subtotal - coupon_discount_value - coin_discount + delivery_fee))
    totals = [
        ["Subtotal", f"Rs {subtotal:.2f}"],
        ["Delivery Fee", f"Rs {delivery_fee:.2f}"],
    ]
    if coupon_discount_value > 0:
        totals.append([f"Coupon Discount ({order.get('couponCode')})", f"- Rs {coupon_discount_value:.2f}"])
    if coin_discount > 0:
        totals.append(["Krushi Ratna Coin Discount", f"- Rs {coin_discount:.2f}"])
    totals.append(["Total", f"Rs {grand_total:.2f}"])
    file_path = _build_order_invoice_pdf(order, str(buyer.get("name") or ""), item_rows, totals)
    with open(file_path, "rb") as handle:
        content = handle.read()
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="invoice-{order_id}.pdf"'},
    )


@router.post("/orders/{order_id}/reorder")
async def reorder_order(order_id: str, uid: str = Depends(_order_user)):
    """SR 9: idempotent reorder payload for a delivered order — returns the
    items so the storefront cart store can re-add them (no write here)."""
    order = await _own_order(order_id, uid)
    if order.get("status") not in ("delivered", "closed"):
        _error(409, "ORDER_NOT_REORDERABLE", "only delivered orders can be reordered")
    items = [
        {"productId": item.get("productId"), "quantity": int(item.get("quantity") or 1)}
        for item in order.get("items") or []
    ]
    return {"orderId": order_id, "items": items}


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, uid: str = Depends(_order_user)):
    order = await _own_order(order_id, uid, not_found_on_foreign=True)
    if order.get("status") not in ("placed", "paid"):
        _error(409, "ORDER_NOT_CANCELLABLE", "order can no longer be cancelled")
    order["status"] = "cancelled"
    order["cancelledAt"] = datetime.now(timezone.utc).isoformat()
    order.setdefault("refundStatus", "none")
    _append_event(order, "cancelled")
    if order.get("razorpayPaymentId"):
        order["refundStatus"] = "requested"
    await _restore_stock(order)
    await set_doc("orders", order_id, order)
    await _audit(order, "order_cancelled")
    await emit_order_status_task(order, "cancelled")
    return order


@router.post("/payments/razorpay/order")
async def razorpay_order(body: RazorpayOrderRequest, uid: str = Depends(_order_user)):
    await hit("payments", uid, 20, 60)
    order = await _own_order(body.orderId, uid)
    if not settings.razorpay_key_id:
        _error(503, "PAYMENTS_NOT_CONFIGURED", "payments are not configured")
    # Charge the final payable (post coupon/coins/delivery fee), never the
    # pre-discount merchandise total.
    amount_paisa = int(
        round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100)
    )
    rzp = create_razorpay_order(amount_paisa, body.orderId)
    order["razorpayOrderId"] = rzp["id"]
    await set_doc("orders", body.orderId, order)
    return {
        "razorpayOrderId": rzp["id"],
        "amount": rzp["amount"],
        "currency": "INR",
        "keyId": settings.razorpay_key_id,
    }


@router.get("/orders/{order_id}/payment-status")
async def order_payment_status(order_id: str, uid: str = Depends(_order_user)):
    """Retry-payment state for one order: what is due, what was already paid."""
    order = await _own_order(order_id, uid)
    amount_paisa = int(
        round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100)
    )
    paid = bool(order.get("razorpayPaymentId"))
    return {
        "orderId": order_id,
        "status": order.get("status"),
        "paymentMethod": order.get("paymentMethod"),
        "paid": paid,
        "canRetry": order.get("status") == "placed" and not paid,
        "razorpayOrderId": order.get("razorpayOrderId"),
        "razorpayPaymentId": order.get("razorpayPaymentId"),
        "amountPaisa": amount_paisa,
        "currency": "INR",
        "keyId": settings.razorpay_key_id,
    }


@router.post("/orders/{order_id}/pay")
async def pay_order(order_id: str, uid: str = Depends(_order_user)):
    """Retry payment for an unpaid `placed` order: returns a Razorpay order id
    the checkout.js flow can open directly. Idempotent — an existing unpaid
    razorpayOrderId is reused instead of creating a duplicate gateway order."""
    await hit("payments", uid, 20, 60)
    order = await _own_order(order_id, uid)
    if not settings.razorpay_key_id:
        _error(503, "PAYMENTS_NOT_CONFIGURED", "payments are not configured")
    if order.get("paymentMethod") != "upi":
        _error(409, "PAYMENT_NOT_APPLICABLE", "only UPI orders pay through Razorpay")
    if order.get("status") != "placed" or order.get("razorpayPaymentId"):
        _error(409, "PAYMENT_NOT_DUE", "this order has no pending online payment")
    existing = order.get("razorpayOrderId")
    if existing:
        amount_paisa = int(
            round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100)
        )
        return {
            "razorpayOrderId": existing,
            "amount": amount_paisa,
            "currency": "INR",
            "keyId": settings.razorpay_key_id,
            "reused": True,
        }
    amount_paisa = int(
        round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100)
    )
    rzp = create_razorpay_order(amount_paisa, order_id)
    order["razorpayOrderId"] = rzp["id"]
    await set_doc("orders", order_id, order)
    return {
        "razorpayOrderId": rzp["id"],
        "amount": rzp["amount"],
        "currency": "INR",
        "keyId": settings.razorpay_key_id,
        "reused": False,
    }


@router.post("/payments/razorpay/verify")
async def razorpay_verify(body: RazorpayVerifyRequest, uid: str = Depends(_order_user)):
    await hit("payments", uid, 20, 60)
    order = await _own_order(body.orderId, uid)
    if not verify_razorpay_signature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature):
        _error(400, "PAYMENT_SIGNATURE_INVALID", "payment signature verification failed")
    order["status"] = "paid"
    order["razorpayPaymentId"] = body.razorpayPaymentId
    _append_event(order, "paid")
    await set_doc("orders", body.orderId, order)
    await _audit(order, "payment_received", {"razorpayPaymentId": body.razorpayPaymentId})
    await emit_order_status_task(order, "paid")
    return {"ok": True, "status": "paid"}


@router.post("/payments/razorpay/refund")
async def razorpay_refund(body: RazorpayRefundRequest, uid: str = Depends(_order_user)):
    order = await _own_order(body.orderId, uid)
    order.setdefault("refundStatus", "none")
    if order["refundStatus"] == "processed":
        return {"ok": True, "refundStatus": "processed"}
    if (
        order.get("status") != "cancelled"
        or order["refundStatus"] != "requested"
        or not order.get("razorpayPaymentId")
    ):
        _error(409, "REFUND_NOT_APPLICABLE", "refund is not applicable for this order")
    refund_amount_paisa = int(
        round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100)
    )
    refund = await refund_razorpay_payment(order["razorpayPaymentId"], refund_amount_paisa)
    order["refundStatus"] = "processed"
    order["razorpayRefundId"] = refund["id"]
    await set_doc("orders", body.orderId, order)
    await _audit(order, "refund_processed", {"razorpayRefundId": refund["id"]})
    return {"ok": True, "refundStatus": "processed"}
