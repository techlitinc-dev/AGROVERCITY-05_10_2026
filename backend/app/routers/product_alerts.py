"""Per-product alert subscriptions (SR 13) — price drop, restock, back-in-season.

Followed from any product page; producers in seller_products.py fan out
`notifications` docs when a subscribed product's price drops, comes back in
stock, or a followed seller lists a new product (back-in-season).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id

router = APIRouter(prefix="/customer", tags=["product-alerts"])

ALERT_KINDS = ("price_drop", "restock", "back_in_season")


class ProductAlertCreate(BaseModel):
    productId: str
    kinds: list[str]


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _kinds_out(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [k for k in raw if k in ALERT_KINDS]


def _alert_out(doc: dict, product: dict) -> dict:
    return {
        "productId": doc["productId"],
        "name": product.get("title") or product.get("name") or doc["productId"],
        "price": product.get("discountedPrice") if product.get("discountedPrice") is not None else product.get("mrp"),
        "stockQty": product.get("stock") or 0,
        "kinds": _kinds_out(doc.get("kinds")),
        "since": doc.get("createdAt", ""),
    }


@router.post("/product-alerts", status_code=201)
async def subscribe_product_alert(body: ProductAlertCreate, uid: str = Depends(current_user_id)):
    """Subscribe (upsert) — re-subscribing replaces the kind list."""
    product = await get_doc("products", body.productId)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    doc_id = f"{uid}_{body.productId}"
    existing = await get_doc("product_alerts", doc_id)
    doc = {
        "userId": uid,
        "productId": body.productId,
        "kinds": _kinds_out(body.kinds),
        "createdAt": (existing or {}).get("createdAt") or datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("product_alerts", doc_id, doc)
    return _alert_out(doc, product)


@router.get("/product-alerts")
async def list_product_alerts(uid: str = Depends(current_user_id)):
    """Own subscriptions joined with live product name/price/stock."""
    docs = await query("product_alerts", [("userId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    items = []
    for doc in docs:
        product_id = doc.get("productId")
        if not product_id:
            continue
        product = await get_doc("products", product_id)
        if product is None:
            continue  # listing gone — drop rather than error the list
        items.append(_alert_out(doc, product))
    return {"items": items}


@router.delete("/product-alerts/{product_id}", status_code=204)
async def unsubscribe_product_alert(product_id: str, uid: str = Depends(current_user_id)):
    doc_id = f"{uid}_{product_id}"
    doc = await get_doc("product_alerts", doc_id)
    if doc is None or doc.get("userId") != uid:
        _error(404, "ALERT_NOT_FOUND", "alert not found")
    await delete_doc("product_alerts", doc_id)
