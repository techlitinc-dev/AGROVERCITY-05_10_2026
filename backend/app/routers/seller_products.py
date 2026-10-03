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
    for field, value in body.model_dump(exclude_none=True).items():
        product[field] = value
    product["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("products", product_id, product)
    return product
