from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, set_doc
from app.core.deps import current_user_id
from app.models.emarket import WishlistItemRequest
from app.services.users import get_user

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _public_product(doc: dict) -> dict:
    product = dict(doc)
    in_stock = product.get("stock") is None or product.get("stock", 0) > 0
    product.pop("stock", None)
    product["inStock"] = in_stock
    return product


async def _any_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return uid


async def _wishlist_products(uid: str) -> list[dict]:
    wishlist = await get_doc("wishlists", uid) or {"items": []}
    data = []
    for product_id in wishlist.get("items", []):
        product = await get_doc("products", product_id)
        if product is not None:
            data.append(_public_product(product))
    return data


@router.get("")
async def get_wishlist(uid: str = Depends(_any_user)):
    data = await _wishlist_products(uid)
    return {"data": data, "total": len(data)}


@router.post("/items", status_code=201)
async def add_wishlist_item(body: WishlistItemRequest, uid: str = Depends(_any_user)):
    if await get_doc("products", body.productId) is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    wishlist = await get_doc("wishlists", uid) or {"items": []}
    items = wishlist.setdefault("items", [])
    if body.productId not in items:
        items.append(body.productId)
    wishlist["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("wishlists", uid, wishlist)
    data = await _wishlist_products(uid)
    return {"data": data, "total": len(data)}


@router.delete("/items/{product_id}", status_code=204)
async def delete_wishlist_item(product_id: str, uid: str = Depends(_any_user)):
    wishlist = await get_doc("wishlists", uid) or {"items": []}
    items = wishlist.setdefault("items", [])
    if product_id in items:
        items.remove(product_id)
    wishlist["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("wishlists", uid, wishlist)
