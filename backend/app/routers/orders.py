import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

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
from app.services.payments import (
    create_razorpay_order,
    refund_razorpay_payment,
    verify_razorpay_signature,
)
from app.services.users import get_user

router = APIRouter(tags=["orders"])

MARKET_ROLES = ("farmer", "farmLandlord", "transport", "seller", "customer", "directBuyer")


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
    final_total = total - discount
    now = datetime.now(timezone.utc).isoformat()
    order_id = f"ord_{uuid.uuid4().hex[:12]}"
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
    if coupon is not None:
        order["couponCode"] = body.couponCode
        order["discount"] = discount
        order["finalTotal"] = final_total
    await set_doc("orders", order_id, order)
    for item in body.items:
        product = products[item.productId]
        if isinstance(product.get("stock"), int):
            product["stock"] -= item.quantity
            await set_doc("products", item.productId, product)
    if coupon is not None:
        coupon["usedCount"] = coupon.get("usedCount", 0) + 1
        await set_doc("coupons", body.couponCode, coupon)
    await set_doc("carts", uid, {"items": {}})
    response = {"orderId": order_id, "total": total}
    if coupon is not None:
        response["discount"] = discount
        response["finalTotal"] = final_total
    if body.paymentMethod == "bnpl":
        response["bnplSchedule"] = [
            {"installment": 1, "dueInDays": 30, "amount": final_total / 2},
            {"installment": 2, "dueInDays": 60, "amount": final_total / 2},
        ]
    await set_doc("idempotency_keys", body.idempotencyKey, {"key": body.idempotencyKey, "response": response})
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
    return order


@router.post("/payments/razorpay/order")
async def razorpay_order(body: RazorpayOrderRequest, uid: str = Depends(_order_user)):
    await hit("payments", uid, 20, 60)
    order = await _own_order(body.orderId, uid)
    if not settings.razorpay_key_id:
        _error(503, "PAYMENTS_NOT_CONFIGURED", "payments are not configured")
    rzp = create_razorpay_order(int(order["total"] * 100), body.orderId)
    order["razorpayOrderId"] = rzp["id"]
    await set_doc("orders", body.orderId, order)
    return {
        "razorpayOrderId": rzp["id"],
        "amount": rzp["amount"],
        "currency": "INR",
        "keyId": settings.razorpay_key_id,
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
    refund = await refund_razorpay_payment(order["razorpayPaymentId"], int(order["total"] * 100))
    order["refundStatus"] = "processed"
    order["razorpayRefundId"] = refund["id"]
    await set_doc("orders", body.orderId, order)
    return {"ok": True, "refundStatus": "processed"}
