import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.seller import SellerProductCreate, SellerProductUpdate
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/seller", tags=["seller"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _seller_user(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "seller")
    return user, uid


async def _write_notification(user_id: str, ntype: str, title: str, body: str) -> None:
    nid = f"ntf_{uuid.uuid4().hex}"
    await set_doc(
        "notifications",
        nid,
        {
            "id": nid,
            "userId": user_id,
            "title": title,
            "body": body,
            "type": ntype,
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


async def _notify_product_subscribers(product_id: str, kind: str, title: str, body: str) -> None:
    """Fan out to product_alerts subscribers of one kind. Best-effort — a broken
    subscriber doc or failed write must never break the product flow."""
    try:
        subs = await query("product_alerts", [("productId", "==", product_id)], limit=1000)
        for sub in subs:
            if kind not in (sub.get("kinds") or []):
                continue
            user_id = sub.get("userId")
            if not user_id:
                continue
            try:
                await _write_notification(user_id, kind, title, body)
            except Exception:
                continue
    except Exception:
        pass


async def _notify_new_listing(seller_id: str, seller_name: str, product_title: str) -> None:
    """Followed-seller new product alert — doubles as the back-in-season alert."""
    try:
        followers = await query("follows", [("targetId", "==", seller_id)], limit=1000)
        for follow in followers:
            follower_id = follow.get("followerId")
            if not follower_id:
                continue
            try:
                await _write_notification(
                    follower_id,
                    "farmer_new_listing",
                    "New listing / नई लिस्टिंग",
                    f"{seller_name} listed {product_title}",
                )
            except Exception:
                continue
    except Exception:
        pass


@router.post("/products", status_code=201)
async def create_product(body: SellerProductCreate, ctx: tuple = Depends(_seller_user)):
    user, uid = ctx
    product_id = f"prod_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    seller_name = user.get("name", "")
    doc = {
        **body.model_dump(exclude_none=True),
        "id": product_id,
        "vernacularTitle": "",
        "rating": 0.0,
        "reviewsCount": 0,
        "dealerName": seller_name,
        "sellerId": uid,
        "sellerName": seller_name,
        "distanceKm": 0.0,
        "bnplAvailable": False,
        "batchNo": f"SLR-{uuid.uuid4().hex[:8].upper()}",
        "createdAt": now,
    }
    await set_doc("products", product_id, doc)
    await _notify_new_listing(uid, seller_name, doc.get("title", "a new product"))
    return doc


@router.get("/products")
async def list_my_products(ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    docs = await query("products", [("sellerId", "==", uid)], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.put("/products/{product_id}")
async def update_product(product_id: str, body: SellerProductUpdate, ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    product = await get_doc("products", product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    if product.get("sellerId") != uid:
        _error(403, "FORBIDDEN", "product belongs to another seller")
    old_price = product.get("discountedPrice")
    old_stock = product.get("stock")
    for field, value in body.model_dump(exclude_none=True).items():
        product[field] = value
    product["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("products", product_id, product)
    title = product.get("title") or product_id
    new_price = product.get("discountedPrice")
    new_stock = product.get("stock")
    if (
        isinstance(old_price, (int, float))
        and isinstance(new_price, (int, float))
        and new_price < old_price
    ):
        await _notify_product_subscribers(
            product_id,
            "price_drop",
            "Price drop / कीमत गिरावट",
            f"{title}: ₹{old_price} → ₹{new_price}",
        )
    if (old_stock is None or old_stock == 0) and isinstance(new_stock, (int, float)) and new_stock > 0:
        await _notify_product_subscribers(
            product_id,
            "restock",
            "Back in stock / स्टॉक उपलब्ध",
            f"{title} is back in stock ({new_stock} units)",
        )
    return product
