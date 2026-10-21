"""Mahila Gruh Udyog module — the women's home-enterprise persona.

A mahila registers her home enterprise ("unit"), adds homemade products
(papad, pickles, masala, handicrafts, textiles...), and publishes them into
the Krishi Shopping Mall catalog (`products` collection -> `GET /v1/products`).
Also covers production batches, stock, certifications (verified FSSAI is a
hard gate for food categories), time-boxed offers, mall-order fulfilment,
and a unit dashboard.

Data lives in real Firestore collections (global rule 1 — no hardcoded data):
  - `gruh_udyog_units`             one unit per owner
  - `gruh_udyog_products`          module-side product records (draft/live/paused)
  - `gruh_udyog_batches`           production batches (optional stock add)
  - `gruh_udyog_certifications`    fssai / udyam / shg / handicraft marks
  - `gruh_udyog_offers`            time-boxed discounts applied to the mall price
Mall integration reuses the shared `products` + `orders` collections; a live
listing is a mall doc with `source == "gruh_udyog"` + `unitId` + the module
product id in `gruhProductId`.

Prices are integer rupees (the mall catalog convention); the dashboard reports
revenue in paisa like every other ledger. Every write accepts `Idempotency-Key`.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.security import verify_mpin
from app.routers.users import require_role
from app.services import idempotency
from app.services.notify import notify_user
from app.services.payments import create_razorpayx_payout
from app.services.users import get_user

router = APIRouter(prefix="/gruh-udyog", tags=["gruh-udyog"])

UNITS = "gruh_udyog_units"
PRODUCTS = "gruh_udyog_products"
BATCHES = "gruh_udyog_batches"
CERTS = "gruh_udyog_certifications"
OFFERS = "gruh_udyog_offers"
SETTLEMENTS = "gruh_settlements"
PAYOUTS = "gruh_payouts"
MALL_PRODUCTS = "products"
ORDERS = "orders"
PLATFORM_CONFIG = "platform_config"

GRUH_CATEGORIES = (
    "Papad & Fryums",
    "Pickles & Chutneys",
    "Spices & Masala",
    "Dairy & Sweets",
    "Grains & Flours",
    "Handicrafts",
    "Textiles & Apparel",
    "Bamboo & Cane",
    "Candles & Diyas",
    "Herbal & Cosmetics",
    "Other",
)
FOOD_CATEGORIES = frozenset(
    ("Papad & Fryums", "Pickles & Chutneys", "Spices & Masala", "Dairy & Sweets", "Grains & Flours")
)
CERT_TYPES = ("fssai", "agmark", "other", "udyam", "shg", "handicraft_mark", "pan")
OPEN_ORDER_STATUSES = frozenset(("placed", "paid"))
FULFILMENT_OPEN = frozenset(("accepted", "packed", "shipped"))
# accepted → packed → shipped → delivered; `cancel` is allowed only before
# `packed` (see cancel_order). The website's older "dispatched" label is
# accepted as an alias for `shipped`.
FULFILMENT_TRANSITIONS = {"packed": "accepted", "shipped": "packed", "delivered": "shipped"}
STATUS_ALIASES = {"dispatched": "shipped"}
LOW_STOCK_DEFAULT = 5
BATCH_EXPIRY_WARN_DAYS = 30

# Platform commission on delivered gruh-udyog mall revenue. Config key lives in
# `platform_config/settlements` (read pattern mirrors services/settlements.py).
GRUH_COMMISSION_DEFAULT_PCT = 5

# Buyer-notification vocabulary mirrors the Krishi Mall order lifecycle
# (app/routers/orders.py): gruh accepted→confirmed, packed→shipped,
# shipped→out_for_delivery, delivered→delivered, cancel→cancelled.
MALL_STATUS_BY_FULFILMENT = {
    "accepted": "confirmed",
    "packed": "shipped",
    "shipped": "out_for_delivery",
    "delivered": "delivered",
    "cancelled": "cancelled",
}
_BUYER_STATUS_COPY = {
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
    "cancelled": (
        "Order cancelled",
        "Your order {id} was cancelled by the seller. Any payment made will be refunded.",
    ),
}


class UnitIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    vernacularName: str = ""
    category: str = Field(min_length=2, max_length=60)
    description: str = ""
    village: str = ""
    district: str = ""
    state: str = ""
    shgName: str = ""
    establishedYear: int | None = Field(default=None, ge=1950, le=2100)
    capacityPerWeek: int = Field(default=0, ge=0)
    imageUrl: str = ""


class UnitUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    vernacularName: str | None = None
    category: str | None = Field(default=None, min_length=2, max_length=60)
    description: str | None = None
    village: str | None = None
    district: str | None = None
    state: str | None = None
    shgName: str | None = None
    establishedYear: int | None = Field(default=None, ge=1950, le=2100)
    capacityPerWeek: int | None = Field(default=None, ge=0)
    imageUrl: str | None = None


class ProductIn(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    vernacularTitle: str = ""
    category: str
    description: str = ""
    ingredients: str = ""
    mrp: int = Field(gt=0)
    price: int = Field(gt=0)
    stock: int = Field(default=0, ge=0)
    unit: str = ""
    imageUrls: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    shelfLifeDays: int = Field(default=0, ge=0)
    isVeg: bool = True


class ProductUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=140)
    vernacularTitle: str | None = None
    category: str | None = None
    description: str | None = None
    ingredients: str | None = None
    mrp: int | None = Field(default=None, gt=0)
    price: int | None = Field(default=None, gt=0)
    unit: str | None = None
    imageUrls: list[str] | None = None
    tags: list[str] | None = None
    shelfLifeDays: int | None = Field(default=None, ge=0)
    isVeg: bool | None = None


class StockIn(BaseModel):
    stock: int = Field(ge=0)


class BatchIn(BaseModel):
    batchNo: str = ""
    quantity: int = Field(gt=0)
    productionDate: date
    expiryDate: date | None = None
    addToStock: bool = False


class BatchStatusIn(BaseModel):
    status: str = Field(pattern="^(sold_out|expired)$")


class CertIn(BaseModel):
    type: str = Field(pattern="^(fssai|agmark|other|udyam|shg|handicraft_mark|pan)$")
    number: str = Field(min_length=3, max_length=60)
    issuingAuthority: str = ""
    validUntil: date | None = None
    documentUrl: str = ""


class OfferIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    discountPercent: int = Field(gt=0, le=90)
    validFrom: date
    validUntil: date


class FulfillmentStatusIn(BaseModel):
    status: str = Field(pattern="^(packed|shipped|dispatched|delivered)$")
    note: str = ""


class RejectIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class CancelIn(BaseModel):
    reason: str = ""


class PayoutIn(BaseModel):
    unitId: str = Field(min_length=1)
    amountPaisa: int = Field(gt=0)
    mpin: str = Field(min_length=4, max_length=4)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> date:
    return datetime.now(timezone.utc).date()


async def _owner(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "womenShg")
    return uid


async def _commission_pct() -> int:
    config = await get_doc(PLATFORM_CONFIG, "settlements") or {}
    try:
        pct = int(config.get("gruhCommissionPct", GRUH_COMMISSION_DEFAULT_PCT))
    except (TypeError, ValueError):
        pct = GRUH_COMMISSION_DEFAULT_PCT
    if not 0 <= pct < 100:
        return GRUH_COMMISSION_DEFAULT_PCT
    return pct


async def _notify_buyer(order: dict, fulfilment_status: str):
    vocab = MALL_STATUS_BY_FULFILMENT.get(fulfilment_status)
    copy = _BUYER_STATUS_COPY.get(vocab or "")
    if not copy:
        return
    title, body = copy
    await notify_user(
        str(order.get("userId") or ""),
        type=f"order_{vocab}",
        title=title,
        body=body.format(id=order.get("id")),
        deepLink="/dashboard/p/orders",
    )


async def _my_unit(unit_id: str, uid: str) -> dict:
    unit = await get_doc(UNITS, unit_id)
    if unit is None:
        _error(404, "UNIT_NOT_FOUND", "gruh udyog unit not found")
    if unit.get("ownerUid") != uid:
        _error(403, "FORBIDDEN", "unit belongs to another user")
    return unit


async def _my_product(product_id: str, uid: str) -> dict:
    product = await get_doc(PRODUCTS, product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    if product.get("ownerUid") != uid:
        _error(403, "FORBIDDEN", "product belongs to another user")
    return product


def _check_category(category: str):
    if category not in GRUH_CATEGORIES:
        _error(
            422,
            "VALIDATION_ERROR",
            "unknown gruh udyog category",
            {"category": f"must be one of {sorted(GRUH_CATEGORIES)}"},
        )


def _check_price(mrp: int, price: int):
    if price > mrp:
        _error(
            422,
            "VALIDATION_ERROR",
            "selling price exceeds mrp",
            {"price": "must not exceed mrp"},
        )


async def _sync_to_mall(product: dict):
    """Push editable fields onto the live mall listing (best-effort by design)."""
    mall_id = product.get("mallProductId")
    if not mall_id:
        return
    mall = await get_doc(MALL_PRODUCTS, mall_id)
    if mall is None:
        return
    active_offer = await _active_offer(product["id"])
    mall.update(
        {
            "title": product["title"],
            "vernacularTitle": product.get("vernacularTitle", ""),
            "description": product.get("description", ""),
            "category": product["category"],
            "mrp": product["mrp"],
            "discountedPrice": active_offer["offerPrice"] if active_offer else product["price"],
            "unit": product.get("unit", ""),
            "imageUrl": (product.get("imageUrls") or [""])[0],
            "stock": product.get("stock", 0),
            "updatedAt": _now(),
        }
    )
    await set_doc(MALL_PRODUCTS, mall_id, mall)


async def _active_offer(product_id: str) -> dict | None:
    today = _today()
    offers = await query(OFFERS, [("productId", "==", product_id)], limit=100)
    for offer in offers:
        if (
            offer.get("status") == "active"
            and offer.get("validFrom", date.min.isoformat()) <= today.isoformat()
            and offer.get("validUntil", date.max.isoformat()) >= today.isoformat()
        ):
            return offer
    return None


async def _unit_product_ids(unit_id: str) -> set[str]:
    products = await query(PRODUCTS, [("unitId", "==", unit_id)], limit=1000)
    return {p["id"] for p in products}


async def _unit_orders(unit_id: str) -> list[dict]:
    """Orders containing at least one item sold by this unit (mall id join)."""
    products = await query(PRODUCTS, [("unitId", "==", unit_id)], limit=1000)
    mall_ids = {p.get("mallProductId") for p in products if p.get("mallProductId")}
    if not mall_ids:
        return []
    orders = await query(ORDERS, [], limit=1000)
    mine = []
    for order in orders:
        if any(item.get("productId") in mall_ids for item in order.get("items", [])):
            mine.append(order)
    mine.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return mine


def _fulfillment(order: dict, unit_id: str) -> dict | None:
    return (order.get("gruhFulfillment") or {}).get(unit_id)


def _unit_items(order: dict, mall_ids: set[str]) -> list[dict]:
    return [item for item in order.get("items", []) if item.get("productId") in mall_ids]


async def _order_for_unit(order_id: str, unit: dict) -> tuple[dict, set[str]]:
    order = await get_doc(ORDERS, order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    mall_ids = {
        p.get("mallProductId")
        for p in await query(PRODUCTS, [("unitId", "==", unit["id"])], limit=1000)
        if p.get("mallProductId")
    }
    if not _unit_items(order, mall_ids):
        _error(404, "ORDER_NOT_FOUND", "order not found for this unit")
    return order, mall_ids


# =========================================================================
# Unit registration + public brand card
# =========================================================================


@router.get("/categories")
async def list_categories(uid: str = Depends(_owner)):
    return {
        "data": [
            {"category": c, "isFood": c in FOOD_CATEGORIES, "requiresFssai": c in FOOD_CATEGORIES}
            for c in GRUH_CATEGORIES
        ]
    }


@router.post("/units", status_code=201)
async def register_unit(
    body: UnitIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_owner),
):
    scope = f"gruh.unit.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    existing = await query(UNITS, [("ownerUid", "==", uid)], limit=1)
    if existing:
        _error(409, "UNIT_ALREADY_EXISTS", "this user already runs a gruh udyog unit")
    unit_id = f"gu_{uuid.uuid4().hex[:10]}"
    doc = {
        **body.model_dump(exclude_none=True),
        "id": unit_id,
        "ownerUid": uid,
        "status": "active",
        "createdAt": _now(),
    }
    await set_doc(UNITS, unit_id, doc)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.get("/units/me")
async def my_unit(uid: str = Depends(_owner)):
    units = await query(UNITS, [("ownerUid", "==", uid)], limit=1)
    if not units:
        _error(404, "UNIT_NOT_FOUND", "no gruh udyog unit registered for this user")
    return units[0]


@router.get("/units/{unit_id}")
async def unit_card(unit_id: str, uid: str = Depends(_owner)):
    """Public brand card: unit story + verified certifications + live product count."""
    unit = await get_doc(UNITS, unit_id)
    if unit is None:
        _error(404, "UNIT_NOT_FOUND", "gruh udyog unit not found")
    products = await query(PRODUCTS, [("unitId", "==", unit_id)], limit=1000)
    live = [p for p in products if p.get("status") == "live"]
    certs = await query(CERTS, [("unitId", "==", unit_id)], limit=100)
    verified = [c for c in certs if c.get("status") == "verified"]
    return {
        "unit": unit,
        "productsCount": len(products),
        "liveProductsCount": len(live),
        "certifications": verified if unit.get("ownerUid") != uid else certs,
    }


@router.put("/units/{unit_id}")
async def update_unit(unit_id: str, body: UnitUpdateIn, uid: str = Depends(_owner)):
    unit = await _my_unit(unit_id, uid)
    for field, value in body.model_dump(exclude_none=True).items():
        unit[field] = value
    unit["updatedAt"] = _now()
    await set_doc(UNITS, unit_id, unit)
    return unit


@router.post("/units/{unit_id}/pause")
async def pause_unit(unit_id: str, uid: str = Depends(_owner)):
    unit = await _my_unit(unit_id, uid)
    unit["status"] = "paused"
    unit["updatedAt"] = _now()
    await set_doc(UNITS, unit_id, unit)
    return unit


@router.post("/units/{unit_id}/resume")
async def resume_unit(unit_id: str, uid: str = Depends(_owner)):
    unit = await _my_unit(unit_id, uid)
    unit["status"] = "active"
    unit["updatedAt"] = _now()
    await set_doc(UNITS, unit_id, unit)
    return unit


# =========================================================================
# Products — add, edit, stock, publish/unpublish to the Krishi Shopping Mall
# =========================================================================


@router.post("/units/{unit_id}/products", status_code=201)
async def add_product(
    unit_id: str,
    body: ProductIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_owner),
):
    unit = await _my_unit(unit_id, uid)
    if unit.get("status") != "active":
        _error(403, "UNIT_PAUSED", "resume the unit before adding products")
    _check_category(body.category)
    _check_price(body.mrp, body.price)
    scope = f"gruh.product.{unit_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    product_id = f"gup_{uuid.uuid4().hex[:10]}"
    doc = {
        **body.model_dump(),
        "id": product_id,
        "unitId": unit_id,
        "ownerUid": uid,
        "status": "draft",
        "mallProductId": None,
        "createdAt": _now(),
    }
    await set_doc(PRODUCTS, product_id, doc)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.get("/units/{unit_id}/products")
async def list_products(unit_id: str, uid: str = Depends(_owner)):
    unit = await get_doc(UNITS, unit_id)
    if unit is None:
        _error(404, "UNIT_NOT_FOUND", "gruh udyog unit not found")
    products = await query(PRODUCTS, [("unitId", "==", unit_id)], limit=1000)
    if unit.get("ownerUid") != uid:
        products = [p for p in products if p.get("status") == "live"]
    products.sort(key=lambda p: p.get("createdAt", ""), reverse=True)
    return {"data": products, "total": len(products)}


@router.get("/products/{product_id}")
async def product_detail(product_id: str, uid: str = Depends(_owner)):
    product = await get_doc(PRODUCTS, product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    batches = await query(BATCHES, [("productId", "==", product_id)], limit=100)
    batches.sort(key=lambda b: b.get("productionDate", ""), reverse=True)
    return {
        "product": product,
        "batches": batches if product.get("ownerUid") == uid else [],
        "activeOffer": await _active_offer(product_id),
    }


@router.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductUpdateIn, uid: str = Depends(_owner)):
    product = await _my_product(product_id, uid)
    updates = body.model_dump(exclude_none=True)
    if "category" in updates:
        _check_category(updates["category"])
    merged = {**product, **updates}
    _check_price(merged["mrp"], merged["price"])
    product.update(updates)
    product["updatedAt"] = _now()
    await set_doc(PRODUCTS, product_id, product)
    if product.get("status") == "live":
        await _sync_to_mall(product)
    return product


@router.put("/products/{product_id}/stock")
async def set_stock(product_id: str, body: StockIn, uid: str = Depends(_owner)):
    product = await _my_product(product_id, uid)
    product["stock"] = body.stock
    product["updatedAt"] = _now()
    await set_doc(PRODUCTS, product_id, product)
    if product.get("status") == "live":
        await _sync_to_mall(product)
    return {"id": product_id, "stock": body.stock}


@router.post("/products/{product_id}/publish")
async def publish_product(
    product_id: str,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_owner),
):
    """Push a draft product into the Krishi Shopping Mall (`products` catalog)."""
    product = await _my_product(product_id, uid)
    scope = f"gruh.publish.{product_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    if product.get("status") == "live":
        _error(409, "ALREADY_LIVE", "product is already live on the mall")
    unit = await get_doc(UNITS, product["unitId"])
    if unit is None or unit.get("status") != "active":
        _error(403, "UNIT_PAUSED", "resume the unit before publishing")
    if int(product.get("stock", 0)) <= 0:
        _error(422, "STOCK_REQUIRED", "add stock before publishing", {"stock": "must be greater than 0"})
    fssai_status = None
    if product["category"] in FOOD_CATEGORIES:
        certs = await query(CERTS, [("unitId", "==", product["unitId"])], limit=100)
        for cert in certs:
            if cert.get("type") != "fssai":
                continue
            if cert.get("validUntil") and cert["validUntil"] < _today().isoformat():
                continue
            if cert.get("status") == "verified":
                fssai_status = "verified"
                break
            if cert.get("status") == "pending" and fssai_status is None:
                # Pending FSSAI no longer blocks publishing — the listing goes
                # live with a visible `fssaiStatus: "pending"` badge instead.
                fssai_status = "pending"
        if fssai_status is None:
            _error(
                403,
                "FSSAI_REQUIRED",
                "food products need an FSSAI certification (verified, or pending with a visible badge) to go live",
            )
    user = await get_user(uid)
    mall_id = f"gprod_{uuid.uuid4().hex[:10]}"
    active_offer = await _active_offer(product_id)
    mall_doc = {
        "id": mall_id,
        "title": product["title"],
        "category": product["category"],
        "brand": unit.get("name", ""),
        "vernacularTitle": product.get("vernacularTitle", ""),
        "description": product.get("description", ""),
        "mrp": product["mrp"],
        "discountedPrice": active_offer["offerPrice"] if active_offer else product["price"],
        "stock": product.get("stock", 0),
        "unit": product.get("unit", ""),
        "imageUrl": (product.get("imageUrls") or [""])[0],
        "batchNo": f"GU-{uuid.uuid4().hex[:8].upper()}",
        "sellerId": uid,
        "sellerName": (user or {}).get("name", ""),
        "dealerName": unit.get("name", ""),
        "rating": 0.0,
        "reviewsCount": 0,
        "distanceKm": 0.0,
        "bnplAvailable": False,
        "source": "gruh_udyog",
        "unitId": unit["id"],
        "gruhProductId": product_id,
        "createdAt": _now(),
    }
    if fssai_status is not None:
        mall_doc["fssaiStatus"] = fssai_status
    await set_doc(MALL_PRODUCTS, mall_id, mall_doc)
    product["status"] = "live"
    product["mallProductId"] = mall_id
    product["publishedAt"] = _now()
    product["updatedAt"] = _now()
    await set_doc(PRODUCTS, product_id, product)
    result = {"product": product, "mallProductId": mall_id}
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, result)
    return result


@router.post("/products/{product_id}/unpublish")
async def unpublish_product(product_id: str, uid: str = Depends(_owner)):
    product = await _my_product(product_id, uid)
    if product.get("status") != "live":
        _error(409, "NOT_LIVE", "product is not live on the mall")
    mall_id = product.get("mallProductId")
    for order in await query(ORDERS, [], limit=1000):
        if not any(item.get("productId") == mall_id for item in order.get("items", [])):
            continue
        fulfillment = _fulfillment(order, product["unitId"])
        if order.get("status") in OPEN_ORDER_STATUSES or (
            fulfillment and fulfillment.get("status") in FULFILMENT_OPEN
        ):
            _error(409, "OPEN_ORDERS_EXIST", "open orders exist for this product; fulfil them first")
    if mall_id:
        await delete_doc(MALL_PRODUCTS, mall_id)
    product["status"] = "draft"
    product["mallProductId"] = None
    product["unpublishedAt"] = _now()
    product["updatedAt"] = _now()
    await set_doc(PRODUCTS, product_id, product)
    return product


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: str, uid: str = Depends(_owner)):
    product = await _my_product(product_id, uid)
    if product.get("status") == "live":
        _error(409, "PRODUCT_LIVE", "unpublish the product before deleting it")
    offers = await query(OFFERS, [("productId", "==", product_id)], limit=100)
    for offer in offers:
        await delete_doc(OFFERS, offer["id"])
    await delete_doc(PRODUCTS, product_id)


# =========================================================================
# Production batches
# =========================================================================


@router.post("/products/{product_id}/batches", status_code=201)
async def add_batch(
    product_id: str,
    body: BatchIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_owner),
):
    product = await _my_product(product_id, uid)
    if body.expiryDate and body.expiryDate < body.productionDate:
        _error(
            422,
            "VALIDATION_ERROR",
            "expiry date precedes production date",
            {"expiryDate": "must be on or after productionDate"},
        )
    scope = f"gruh.batch.{product_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    batch_id = f"gub_{uuid.uuid4().hex[:10]}"
    doc = {
        **body.model_dump(mode="json"),
        "id": batch_id,
        "productId": product_id,
        "unitId": product["unitId"],
        "status": "active",
        "createdAt": _now(),
    }
    if not doc["batchNo"]:
        doc["batchNo"] = f"GU-{uuid.uuid4().hex[:8].upper()}"
    await set_doc(BATCHES, batch_id, doc)
    if body.addToStock:
        product["stock"] = int(product.get("stock", 0)) + body.quantity
        product["updatedAt"] = _now()
        await set_doc(PRODUCTS, product_id, product)
        if product.get("status") == "live":
            await _sync_to_mall(product)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.post("/batches/{batch_id}/status")
async def set_batch_status(batch_id: str, body: BatchStatusIn, uid: str = Depends(_owner)):
    batch = await get_doc(BATCHES, batch_id)
    if batch is None:
        _error(404, "BATCH_NOT_FOUND", "batch not found")
    await _my_unit(batch["unitId"], uid)
    if batch.get("status") != "active":
        _error(409, "BATCH_CLOSED", "batch is already closed")
    batch["status"] = body.status
    batch["closedAt"] = _now()
    await set_doc(BATCHES, batch_id, batch)
    return batch


# =========================================================================
# Certifications (FSSAI gate for food categories lives in publish)
# =========================================================================


@router.post("/units/{unit_id}/certifications", status_code=201)
async def add_certification(
    unit_id: str,
    body: CertIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_owner),
):
    await _my_unit(unit_id, uid)
    certs = await query(CERTS, [("unitId", "==", unit_id)], limit=100)
    if any(c.get("type") == body.type and c.get("number") == body.number for c in certs):
        _error(409, "DUPLICATE_CERTIFICATION", "this certification is already registered")
    scope = f"gruh.cert.{unit_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    cert_id = f"guc_{uuid.uuid4().hex[:10]}"
    doc = {
        **body.model_dump(mode="json", exclude_none=True),
        "id": cert_id,
        "unitId": unit_id,
        "ownerUid": uid,
        "status": "pending",
        "createdAt": _now(),
    }
    await set_doc(CERTS, cert_id, doc)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.get("/units/{unit_id}/certifications")
async def list_certifications(unit_id: str, uid: str = Depends(_owner)):
    unit = await get_doc(UNITS, unit_id)
    if unit is None:
        _error(404, "UNIT_NOT_FOUND", "gruh udyog unit not found")
    certs = await query(CERTS, [("unitId", "==", unit_id)], limit=100)
    if unit.get("ownerUid") != uid:
        certs = [c for c in certs if c.get("status") == "verified"]
    certs.sort(key=lambda c: c.get("createdAt", ""), reverse=True)
    return {"data": certs, "total": len(certs)}


# =========================================================================
# Offers — time-boxed discounts applied to the live mall price
# =========================================================================


@router.post("/products/{product_id}/offers", status_code=201)
async def add_offer(
    product_id: str,
    body: OfferIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_owner),
):
    product = await _my_product(product_id, uid)
    if body.validUntil < body.validFrom:
        _error(
            422,
            "VALIDATION_ERROR",
            "offer end precedes start",
            {"validUntil": "must be on or after validFrom"},
        )
    offer_price = round(product["mrp"] * (100 - body.discountPercent) / 100)
    if offer_price < 1:
        _error(422, "VALIDATION_ERROR", "discount leaves a zero-rupee price", {"discountPercent": "too high"})
    scope = f"gruh.offer.{product_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    offer_id = f"guo_{uuid.uuid4().hex[:10]}"
    doc = {
        **body.model_dump(mode="json"),
        "id": offer_id,
        "productId": product_id,
        "unitId": product["unitId"],
        "ownerUid": uid,
        "offerPrice": offer_price,
        "status": "active",
        "createdAt": _now(),
    }
    await set_doc(OFFERS, offer_id, doc)
    if product.get("status") == "live":
        await _sync_to_mall(product)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.get("/units/{unit_id}/offers")
async def list_offers(unit_id: str, uid: str = Depends(_owner)):
    unit = await get_doc(UNITS, unit_id)
    if unit is None:
        _error(404, "UNIT_NOT_FOUND", "gruh udyog unit not found")
    offers = await query(OFFERS, [("unitId", "==", unit_id)], limit=500)
    offers.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return {"data": offers, "total": len(offers)}


@router.delete("/offers/{offer_id}", status_code=204)
async def delete_offer(offer_id: str, uid: str = Depends(_owner)):
    offer = await get_doc(OFFERS, offer_id)
    if offer is None:
        _error(404, "OFFER_NOT_FOUND", "offer not found")
    if offer.get("ownerUid") != uid:
        _error(403, "FORBIDDEN", "offer belongs to another user")
    product = await get_doc(PRODUCTS, offer["productId"])
    await delete_doc(OFFERS, offer_id)
    if product and product.get("status") == "live":
        await _sync_to_mall(product)


# =========================================================================
# Mall-order fulfilment for this unit's products
# =========================================================================


@router.get("/units/{unit_id}/orders")
async def unit_orders(unit_id: str, status: str | None = None, uid: str = Depends(_owner)):
    unit = await _my_unit(unit_id, uid)
    products = await query(PRODUCTS, [("unitId", "==", unit_id)], limit=1000)
    mall_ids = {p.get("mallProductId") for p in products if p.get("mallProductId")}
    data = []
    for order in await _unit_orders(unit_id):
        fulfillment = _fulfillment(order, unit_id)
        if status and (fulfillment or {}).get("status", "placed") != status:
            continue
        data.append(
            {
                "orderId": order["id"],
                "buyerId": order.get("userId"),
                "orderStatus": order.get("status"),
                "fulfillment": fulfillment,
                "items": _unit_items(order, mall_ids),
                "createdAt": order.get("createdAt"),
            }
        )
    return {"data": data, "total": len(data)}


@router.post("/orders/{order_id}/accept")
async def accept_order(order_id: str, uid: str = Depends(_owner)):
    unit = await _owner_unit(uid)
    order, mall_ids = await _order_for_unit(order_id, unit)
    fulfillment = order.setdefault("gruhFulfillment", {}).setdefault(
        unit["id"], {"status": "placed", "history": []}
    )
    if fulfillment.get("status") not in ("placed", "rejected"):
        _error(409, "ALREADY_ACCEPTED", "order already accepted by this unit")
    if order.get("status") not in OPEN_ORDER_STATUSES:
        _error(409, "ORDER_NOT_OPEN", "order is no longer open")
    products = {
        p.get("mallProductId"): p
        for p in await query(PRODUCTS, [("unitId", "==", unit["id"])], limit=1000)
        if p.get("mallProductId")
    }
    items_total = 0
    for item in _unit_items(order, mall_ids):
        price = (products.get(item["productId"]) or {}).get("price", 0)
        items_total += price * item.get("quantity", 0)
    fulfillment["status"] = "accepted"
    fulfillment["itemsTotal"] = items_total
    fulfillment["acceptedAt"] = _now()
    fulfillment["history"].append({"status": "accepted", "at": _now()})
    await set_doc(ORDERS, order_id, order)
    await _notify_buyer(order, "accepted")
    return {"orderId": order_id, "fulfillment": fulfillment}


@router.post("/orders/{order_id}/reject")
async def reject_order(order_id: str, body: RejectIn, uid: str = Depends(_owner)):
    unit = await _owner_unit(uid)
    order, _ = await _order_for_unit(order_id, unit)
    fulfillment = order.setdefault("gruhFulfillment", {}).setdefault(
        unit["id"], {"status": "placed", "history": []}
    )
    if fulfillment.get("status") in FULFILMENT_OPEN or fulfillment.get("status") == "delivered":
        _error(409, "ORDER_NOT_REJECTABLE", "order already in fulfilment; it can no longer be rejected")
    if order.get("status") not in OPEN_ORDER_STATUSES:
        _error(409, "ORDER_NOT_OPEN", "order is no longer open")
    fulfillment["status"] = "rejected"
    fulfillment["rejectedAt"] = _now()
    fulfillment["rejectReason"] = body.reason
    fulfillment["history"].append({"status": "rejected", "at": _now(), "note": body.reason})
    await set_doc(ORDERS, order_id, order)
    return {"orderId": order_id, "fulfillment": fulfillment}


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, body: CancelIn, uid: str = Depends(_owner)):
    """Cancel an accepted (not yet packed) order and restore the buyer-facing
    mall stock, mirroring the stock-restore in app/routers/orders.py."""
    unit = await _owner_unit(uid)
    order, mall_ids = await _order_for_unit(order_id, unit)
    fulfillment = _fulfillment(order, unit["id"])
    if fulfillment is None or fulfillment.get("status") not in ("placed", "accepted"):
        _error(
            409,
            "ORDER_NOT_CANCELLABLE",
            "only orders that are not yet packed can be cancelled",
        )
    if body.reason.strip():
        fulfillment["cancelReason"] = body.reason.strip()
    fulfillment["status"] = "cancelled"
    fulfillment["cancelledAt"] = _now()
    fulfillment["history"].append(
        {"status": "cancelled", "at": _now(), "note": body.reason.strip()}
    )
    for item in _unit_items(order, mall_ids):
        mall_product = await get_doc(MALL_PRODUCTS, item["productId"])
        if mall_product is not None and isinstance(mall_product.get("stock"), int):
            mall_product["stock"] += item.get("quantity", 0)
            await set_doc(MALL_PRODUCTS, item["productId"], mall_product)
    await set_doc(ORDERS, order_id, order)
    await _notify_buyer(order, "cancelled")
    return {"orderId": order_id, "fulfillment": fulfillment}


@router.post("/orders/{order_id}/status")
async def update_fulfillment_status(
    order_id: str, body: FulfillmentStatusIn, uid: str = Depends(_owner)
):
    unit = await _owner_unit(uid)
    order, _ = await _order_for_unit(order_id, unit)
    status = STATUS_ALIASES.get(body.status, body.status)
    fulfillment = _fulfillment(order, unit["id"])
    if fulfillment is None or fulfillment.get("status") != FULFILMENT_TRANSITIONS[status]:
        _error(
            409,
            "BAD_TRANSITION",
            f"order must be {FULFILMENT_TRANSITIONS[status]} before {status}",
        )
    fulfillment["status"] = status
    fulfillment["history"].append({"status": status, "at": _now(), "note": body.note})
    if status == "delivered":
        fulfillment["deliveredAt"] = _now()
    await set_doc(ORDERS, order_id, order)
    await _notify_buyer(order, status)
    if status == "delivered":
        await _accrue_settlement(unit, order, fulfillment)
    return {"orderId": order_id, "fulfillment": fulfillment}


async def _accrue_settlement(unit: dict, order: dict, fulfillment: dict):
    """One settlement line per delivered order: revenue (this unit's item
    total, integer paisa) minus the platform commission from
    `platform_config/settlements gruhCommissionPct` (default 5%)."""
    existing = await query(SETTLEMENTS, [("orderId", "==", order["id"])], limit=10)
    if any(line.get("unitId") == unit["id"] for line in existing):
        return
    revenue_paisa = int(fulfillment.get("itemsTotal", 0)) * 100
    pct = await _commission_pct()
    commission_paisa = round(revenue_paisa * pct / 100)
    now = _now()
    doc = {
        "id": f"gus_{uuid.uuid4().hex[:10]}",
        "unitId": unit["id"],
        "orderId": order["id"],
        "period": now[:7],
        "revenuePaisa": revenue_paisa,
        "commissionPct": pct,
        "commissionPaisa": commission_paisa,
        "netPaisa": revenue_paisa - commission_paisa,
        "status": "accrued",
        "createdAt": now,
    }
    await set_doc(SETTLEMENTS, doc["id"], doc)


async def _settlement_balance(unit_id: str) -> dict:
    lines = await query(SETTLEMENTS, [("unitId", "==", unit_id)], limit=1000)
    payouts = await query(PAYOUTS, [("unitId", "==", unit_id)], limit=1000)
    revenue = sum(int(line.get("revenuePaisa", 0)) for line in lines)
    commission = sum(int(line.get("commissionPaisa", 0)) for line in lines)
    paid_out = sum(
        int(p.get("amountPaisa", 0))
        for p in payouts
        if p.get("status") in ("pending", "processed")
    )
    return {
        "revenuePaisa": revenue,
        "commissionPaisa": commission,
        "paidOutPaisa": paid_out,
        "availablePaisa": revenue - commission - paid_out,
    }


@router.get("/units/{unit_id}/settlements")
async def unit_settlements(unit_id: str, uid: str = Depends(_owner)):
    unit = await _my_unit(unit_id, uid)
    lines = await query(SETTLEMENTS, [("unitId", "==", unit["id"])], limit=1000)
    lines.sort(key=lambda line: line.get("createdAt", ""), reverse=True)
    payouts = await query(PAYOUTS, [("unitId", "==", unit["id"])], limit=1000)
    payouts.sort(key=lambda p: p.get("requestedAt", ""), reverse=True)
    return {
        "lines": lines,
        "payouts": payouts,
        "balance": await _settlement_balance(unit["id"]),
    }


@router.post("/payouts", status_code=201)
async def create_payout(body: PayoutIn, uid: str = Depends(_owner)):
    """MPIN-gated payout of the unit's available settlement balance (the
    transport-payout pattern: services/payments.py auto-marks the payout
    `processed` in dev when Razorpay keys are unset)."""
    unit = await _my_unit(body.unitId, uid)
    user = await get_user(uid) or {}
    stored = user.get("mpinHash")
    if not stored:
        _error(409, "MPIN_NOT_SET", "set an MPIN before requesting a payout")
    if not verify_mpin(body.mpin, stored):
        _error(401, "WRONG_MPIN", "incorrect MPIN")
    balance = (await _settlement_balance(unit["id"]))["availablePaisa"]
    if body.amountPaisa > balance:
        _error(
            422,
            "INSUFFICIENT_BALANCE",
            f"payout exceeds the available balance of ₹{balance / 100:.2f}",
            {"amountPaisa": f"must be <= {balance}"},
        )
    payout_id = f"gupay_{uuid.uuid4().hex[:12]}"
    result = await create_razorpayx_payout("", body.amountPaisa, payout_id)
    now = _now()
    payout = {
        "id": payout_id,
        "unitId": unit["id"],
        "ownerUid": uid,
        "amountPaisa": body.amountPaisa,
        "status": result.get("status", "pending"),
        "razorpayPayoutId": result.get("id"),
        "requestedAt": now,
    }
    if payout["status"] == "processed":
        payout["processedAt"] = now
    await set_doc(PAYOUTS, payout_id, payout)
    return payout


async def _owner_unit(uid: str) -> dict:
    units = await query(UNITS, [("ownerUid", "==", uid)], limit=1)
    if not units:
        _error(404, "UNIT_NOT_FOUND", "no gruh udyog unit registered for this user")
    return units[0]


# =========================================================================
# Dashboard
# =========================================================================


@router.get("/units/{unit_id}/dashboard")
async def unit_dashboard(unit_id: str, uid: str = Depends(_owner)):
    unit = await _my_unit(unit_id, uid)
    products = await query(PRODUCTS, [("unitId", "==", unit_id)], limit=1000)
    live = [p for p in products if p.get("status") == "live"]
    batches = await query(BATCHES, [("unitId", "==", unit_id)], limit=500)
    warn_before = (_today() + timedelta(days=BATCH_EXPIRY_WARN_DAYS)).isoformat()
    expiring = [
        b
        for b in batches
        if b.get("status") == "active" and b.get("expiryDate") and b["expiryDate"] <= warn_before
    ]
    orders = await _unit_orders(unit_id)
    revenue_paisa = 0
    state_counts: dict[str, int] = {}
    for order in orders:
        fulfillment = _fulfillment(order, unit_id) or {}
        state = fulfillment.get("status", "placed")
        state_counts[state] = state_counts.get(state, 0) + 1
        if state == "delivered":
            revenue_paisa += int(fulfillment.get("itemsTotal", 0)) * 100
    return {
        "unit": {"id": unit["id"], "name": unit.get("name"), "status": unit.get("status")},
        "products": len(products),
        "liveProducts": len(live),
        "draftProducts": len([p for p in products if p.get("status") == "draft"]),
        "lowStock": [p for p in live if int(p.get("stock", 0)) <= LOW_STOCK_DEFAULT],
        "orderStates": state_counts,
        "orders": len(orders),
        "revenuePaisa": revenue_paisa,
        "expiringBatches": len(expiring),
        "generatedAt": _now(),
    }
