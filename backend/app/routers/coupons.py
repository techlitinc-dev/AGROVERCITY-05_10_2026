from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query
from app.core.deps import current_user_id
from app.models.emarket import CouponValidateRequest
from app.services.users import get_user

router = APIRouter(prefix="/coupons", tags=["coupons"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _any_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return uid


def _is_expired(coupon: dict) -> bool:
    valid_until = coupon.get("validUntil")
    if not valid_until:
        return False
    return valid_until < datetime.now(timezone.utc).isoformat()


def _is_exhausted(coupon: dict) -> bool:
    usage_limit = coupon.get("usageLimit")
    return usage_limit is not None and coupon.get("usedCount", 0) >= usage_limit


def coupon_reject_reason(coupon: dict, cart_total: int) -> str | None:
    if not coupon.get("active", False):
        return "coupon is not active"
    if _is_expired(coupon):
        return "coupon has expired"
    if _is_exhausted(coupon):
        return "coupon usage limit exhausted"
    if cart_total < coupon.get("minOrder", 0):
        return f"minimum order of ₹{coupon['minOrder']} required"
    return None


def coupon_discount(coupon: dict, cart_total: int) -> int:
    if coupon["type"] == "percentage":
        discount = int(cart_total * coupon["value"] / 100)
        cap = coupon.get("maxDiscount")
        if cap is not None:
            discount = min(discount, cap)
    else:
        discount = min(coupon["value"], cart_total)
    return max(discount, 0)


def _public_coupon(coupon: dict, cart_total: int | None) -> dict:
    out = {
        "code": coupon["code"],
        "type": coupon["type"],
        "value": coupon["value"],
        "minOrder": coupon.get("minOrder", 0),
        "maxDiscount": coupon.get("maxDiscount"),
        "validUntil": coupon.get("validUntil"),
        "description": coupon.get("description", ""),
    }
    if cart_total is not None:
        out["applicable"] = coupon_reject_reason(coupon, cart_total) is None
    return out


@router.get("")
async def list_coupons(cartTotal: int | None = None, uid: str = Depends(_any_user)):
    coupons = await query("coupons", [], limit=1000)
    data = [
        _public_coupon(c, cartTotal)
        for c in coupons
        if c.get("active", False) and not _is_expired(c)
    ]
    return {"data": data, "total": len(data)}


@router.post("/validate")
async def validate_coupon(body: CouponValidateRequest, uid: str = Depends(_any_user)):
    coupon = await get_doc("coupons", body.code)
    reason = coupon_reject_reason(coupon, body.cartTotal) if coupon else "coupon not found"
    if reason is not None:
        return {"valid": False, "discount": 0, "finalTotal": body.cartTotal, "message": reason}
    discount = coupon_discount(coupon, body.cartTotal)
    return {
        "valid": True,
        "discount": discount,
        "finalTotal": body.cartTotal - discount,
        "message": "coupon applied",
    }
