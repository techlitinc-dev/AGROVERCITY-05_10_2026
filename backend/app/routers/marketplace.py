from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query as db_query, set_doc
from app.core.deps import current_user_id
from app.models.marketplace import CartItemRequest, CartQuantityRequest
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(tags=["marketplace"])

MARKET_ROLES = ("farmer", "farmLandlord", "transport", "seller")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _market_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, *MARKET_ROLES)
    return uid


async def _require_product(product_id: str) -> dict:
    product = await get_doc("products", product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    return product


async def _cart_response(uid: str) -> dict:
    cart = await get_doc("carts", uid) or {"items": {}}
    data = []
    total = 0
    for product_id, quantity in cart.get("items", {}).items():
        product = await get_doc("products", product_id)
        if product is None:
            continue
        data.append({"productId": product_id, "quantity": quantity, "product": product})
        total += product["discountedPrice"] * quantity
    return {"data": data, "cartTotal": total}


@router.get("/products")
async def list_products(
    category: str | None = None,
    query: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_market_user),
):
    docs = await db_query("products", [], limit=1000)
    if category:
        docs = [d for d in docs if category.lower() in d.get("category", "").lower()]
    if query:
        q = query.lower()
        docs = [
            d
            for d in docs
            if q in d.get("title", "").lower() or q in d.get("vernacularTitle", "").lower()
        ]
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


@router.get("/products/{product_id}")
async def get_product(product_id: str, uid: str = Depends(_market_user)):
    return await _require_product(product_id)


@router.get("/products/{product_id}/certificate")
async def get_certificate(product_id: str, uid: str = Depends(_market_user)):
    product = await _require_product(product_id)
    cert = await get_doc("certificates", product["batchNo"])
    if cert is None:
        _error(404, "CERTIFICATE_NOT_FOUND", "certificate not found for this batch")
    return cert


@router.get("/cart")
async def get_cart(uid: str = Depends(_market_user)):
    return await _cart_response(uid)


@router.post("/cart/items")
async def add_cart_item(body: CartItemRequest, uid: str = Depends(_market_user)):
    if body.quantity < 1:
        _error(422, "VALIDATION_ERROR", "invalid quantity", {"quantity": "must be at least 1"})
    await _require_product(body.productId)
    cart = await get_doc("carts", uid) or {"items": {}}
    cart.setdefault("items", {})[body.productId] = body.quantity
    await set_doc("carts", uid, cart)
    return await _cart_response(uid)


@router.put("/cart/items/{product_id}")
async def update_cart_item(product_id: str, body: CartQuantityRequest, uid: str = Depends(_market_user)):
    cart = await get_doc("carts", uid) or {"items": {}}
    items = cart.setdefault("items", {})
    if body.quantity <= 0:
        items.pop(product_id, None)
    else:
        await _require_product(product_id)
        items[product_id] = body.quantity
    await set_doc("carts", uid, cart)
    return await _cart_response(uid)


@router.delete("/cart/items/{product_id}")
async def delete_cart_item(product_id: str, uid: str = Depends(_market_user)):
    cart = await get_doc("carts", uid) or {"items": {}}
    cart.setdefault("items", {}).pop(product_id, None)
    await set_doc("carts", uid, cart)
    return await _cart_response(uid)
