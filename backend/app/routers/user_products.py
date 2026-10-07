import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.emarket import UserProductCreate, UserProductUpdate
from app.services.users import get_user

router = APIRouter(prefix="/my-products", tags=["my-products"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _any_user(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return user, uid


def _check_price(mrp: int | None, discounted_price: int | None):
    if mrp is not None and discounted_price is not None and discounted_price > mrp:
        _error(
            422,
            "VALIDATION_ERROR",
            "discounted price exceeds mrp",
            {"discountedPrice": "must not exceed mrp"},
        )


async def create_listing(user: dict, uid: str, body: UserProductCreate) -> dict:
    """Publish a user product into the marketplace `products` catalog.

    Shared by `POST /v1/my-products` and the Women Farmer Hub home-enterprise
    listing form (phase-05 WS-08 task 8.20) so both go through the same shape.
    """
    _check_price(body.mrp, body.discountedPrice)
    product_id = f"prod_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    seller_name = user.get("name", "")
    doc = {
        **body.model_dump(exclude_none=True),
        "id": product_id,
        "sellerId": uid,
        "sellerName": seller_name,
        "dealerName": seller_name,
        "rating": 0.0,
        "reviewsCount": 0,
        "distanceKm": 0.0,
        "bnplAvailable": False,
        "createdAt": now,
    }
    if not doc.get("batchNo"):
        doc["batchNo"] = f"USR-{uuid.uuid4().hex[:8].upper()}"
    await set_doc("products", product_id, doc)
    return doc


@router.post("", status_code=201)
async def create_product(body: UserProductCreate, ctx: tuple = Depends(_any_user)):
    user, uid = ctx
    return await create_listing(user, uid, body)


@router.get("")
async def list_my_products(ctx: tuple = Depends(_any_user)):
    _, uid = ctx
    docs = await query("products", [("sellerId", "==", uid)], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.put("/{product_id}")
async def update_product(product_id: str, body: UserProductUpdate, ctx: tuple = Depends(_any_user)):
    _, uid = ctx
    product = await get_doc("products", product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    if product.get("sellerId") != uid:
        _error(403, "FORBIDDEN", "product belongs to another user")
    updates = body.model_dump(exclude_none=True)
    _check_price(updates.get("mrp", product.get("mrp")), updates.get("discountedPrice", product.get("discountedPrice")))
    for field, value in updates.items():
        product[field] = value
    product["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("products", product_id, product)
    return product


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: str, ctx: tuple = Depends(_any_user)):
    _, uid = ctx
    product = await get_doc("products", product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    if product.get("sellerId") != uid:
        _error(403, "FORBIDDEN", "product belongs to another user")
    orders = await query("orders", limit=1000)
    for order in orders:
        if order.get("status") == "cancelled":
            continue
        if any(item.get("productId") == product_id for item in order.get("items", [])):
            _error(409, "PRODUCT_HAS_ORDERS", "product has orders and cannot be deleted")
    await delete_doc("products", product_id)
