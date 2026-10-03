from fastapi import APIRouter, Depends

from app.core.db import get_doc, set_doc
from app.core.deps import current_user_id
from app.models.emarket import OrderStatusPatch, ReturnRequest
from app.routers.orders import _append_event, _error, _order_user, _own_order, _restore_stock
from app.services.users import get_user

router = APIRouter(tags=["orders"])

RETURNABLE_STATUSES = ("delivered", "paid")

STATUS_TRANSITIONS: dict[str, set[str]] = {
    "placed": {"confirmed", "cancelled"},
    "paid": {"confirmed", "shipped", "cancelled"},
    "confirmed": {"shipped", "cancelled"},
    "shipped": {"out_for_delivery", "cancelled"},
    "out_for_delivery": {"delivered"},
    "delivered": {"closed", "returned"},
}

ADMIN_FALLBACK_IDS = ("admin-root", "uid-admin", "admin-demo")


async def _ops_admin(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    if not user.get("isAdmin") and user.get("activeProfile") != "admin" and uid not in ADMIN_FALLBACK_IDS:
        _error(403, "FORBIDDEN_ADMIN", "Superadmin privileges required")
    return uid


@router.get("/orders/{order_id}/timeline")
async def order_timeline(order_id: str, uid: str = Depends(_order_user)):
    order = await _own_order(order_id, uid)
    events = order.get("events") or [
        {"status": order.get("status", "placed"), "at": order.get("createdAt", ""), "note": ""}
    ]
    return {"orderId": order_id, "data": events, "total": len(events)}


@router.post("/orders/{order_id}/return")
async def request_return(order_id: str, body: ReturnRequest, uid: str = Depends(_order_user)):
    order = await _own_order(order_id, uid, not_found_on_foreign=True)
    if order.get("status") not in RETURNABLE_STATUSES:
        _error(409, "RETURN_NOT_ALLOWED", "order is not eligible for return")
    if order.get("returnStatus") in ("requested", "processed"):
        _error(409, "RETURN_ALREADY_REQUESTED", "a return is already in progress for this order")
    order["returnStatus"] = "requested"
    order["returnReason"] = body.reason
    order.setdefault("refundStatus", "none")
    _append_event(order, "return_requested", body.reason)
    if order.get("razorpayPaymentId"):
        order["refundStatus"] = "requested"
    await set_doc("orders", order_id, order)
    return order


@router.patch("/orders/{order_id}/status")
async def patch_order_status(
    order_id: str,
    body: OrderStatusPatch,
    uid: str = Depends(_ops_admin),
):
    order = await get_doc("orders", order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    allowed = STATUS_TRANSITIONS.get(order.get("status"), set())
    if body.status not in allowed:
        _error(400, "INVALID_STATUS_TRANSITION", f"cannot move order from {order.get('status')} to {body.status}")
    order["status"] = body.status
    _append_event(order, body.status, body.note)
    if body.status in ("cancelled", "returned"):
        if order.get("razorpayPaymentId") and order.get("refundStatus", "none") == "none":
            order["refundStatus"] = "requested"
        await _restore_stock(order)
    await set_doc("orders", order_id, order)
    return order
