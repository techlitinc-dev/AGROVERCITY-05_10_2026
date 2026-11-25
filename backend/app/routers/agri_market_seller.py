"""Agri Market Seller persona — implements agrisellerinstructions.md
(Agri_market_seller 21 nov.xlsx): the pages an E-Market seller can see.

Seller-facing (this router):
  Sr 1  Shop Profile          — shop name, bank details, delivery area,
                                pickup address, documents (no new KYC —
                                reuses profile/bank/vault data).
  Sr 2  Dashboard             — revenue, orders received, product stats,
                                ad performance, alerts + KPI strip
                                (enquiries, pending quotations, low stock,
                                order status).
  Sr 3/24 Products & Pricing  — catalog fields on the shared products docs
                                (title/photos/price/stock/category/status)
                                plus variants, units, specifications, MOQ,
                                batch/expiry/compliance, quantity slabs and
                                min/max order quantities.
  Sr 4  Stock Management      — in/out entries, availability vs reserved,
                                low-stock alerts, movements + adjustment
                                history.
  Sr 5/25 Orders & Dispatch   — accept/reject, process → pack → ship →
                                deliver on the shared mall order engine
                                (labels per the file), cancellation handling,
                                invoice download (existing /orders invoice),
                                dispatch date / delivery partner / tracking.
  Sr 6  Offers & Coupons      — seller coupon codes with validity + usage
                                stats; offers = discounted catalog products.
  Sr 22/23 Enquiry & Quotation— farmer enquiries (quantity + product
                                context), response status, convert to
                                quotation/order; quotations with number,
                                items, unit price, quantity, discounts,
                                taxes, delivery, validity, status.
  Sr 26 Customer Reviews      — verified-purchase (marketplace_order)
                                reviews + seller response held subject to
                                in-platform moderation rules.
  Sr 27 Sales Reports         — daily/monthly sales, top products, order
                                status, discounts, cancellations, returns,
                                revenue.
  Sr 9  AI Analysis           — demand forecast, pricing suggestions, sales
                                insights from the seller's own marketplace
                                data only (deterministic).

Reused shared modules (no rebuild): diary/gyan/news/referrals/coins/tree/
pnl/land/chatbot/notifications (Sr 10-15, 17-20), ads (Sr 8, existing
ads.py), earnings reconciliation (Sr 7, existing settlements/payments),
mall shopping (Sr 16, shared /mall page).

Money is integer paisa. Seller-side endpoints accept the seller persona and
the agriMarketSeller persona; farmer-side write endpoints (post enquiry,
respond to quotation) accept any authenticated user.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services import chat_moderation, idempotency
from app.services.notify import notify_user
from app.services.rating_prompts import open_rating_prompt
from app.services.users import get_user

router = APIRouter(prefix="/agri-market-seller", tags=["agri-market-seller"])

SHOPS = "seller_shop_profiles"
STOCK = "seller_stock_entries"
ENQUIRIES = "seller_enquiries"
QUOTATIONS = "seller_quotations"
COUPONS = "seller_coupons"

LOW_STOCK_DEFAULT = 5
OPEN_ORDER_STATUSES = ("placed", "paid", "confirmed", "shipped", "out_for_delivery")

# xlsx Sr 5 order actions mapped onto the shared mall order engine
# (order_tracking.STATUS_TRANSITIONS). `process` is a label step on
# `confirmed` — the file's words stay in the UI and the seller timeline.
ORDER_ACTIONS = ("accept", "reject", "process", "pack", "ship", "deliver")
ACTION_TO_STATUS = {
    "accept": "confirmed",
    "reject": "cancelled",
    "process": "confirmed",
    "pack": "shipped",
    "ship": "out_for_delivery",
    "deliver": "delivered",
}
TERMINAL_ORDER_STATUSES = ("delivered", "closed", "cancelled", "returned")


class ShopIn(BaseModel):
    shopName: str = Field(min_length=2, max_length=120)
    bankName: str = Field(default="", max_length=120)
    bankAccountNumber: str = Field(default="", max_length=30)
    bankIfsc: str = Field(default="", max_length=20)
    deliveryArea: str = Field(default="", max_length=200)
    pickupAddress: str = Field(default="", max_length=300)
    documentIds: list[str] = Field(default_factory=list)


class ProductPricingIn(BaseModel):
    variants: list[dict] = Field(default_factory=list)
    units: str = Field(default="", max_length=40)
    specifications: dict[str, str] = Field(default_factory=dict)
    minOrderQty: int | None = Field(default=None, ge=1)
    maxOrderQty: int | None = Field(default=None, ge=1)
    batchNo: str | None = Field(default=None, max_length=60)
    expiryDate: str | None = Field(default=None, max_length=10)
    compliance: dict = Field(default_factory=dict)
    slabs: list[dict] = Field(default_factory=list)
    lowStockThreshold: int | None = Field(default=None, ge=0)


class StockEntryIn(BaseModel):
    productId: str = Field(min_length=1)
    kind: str = Field(min_length=1)  # in | out | adjust
    quantity: int = Field(ge=0)
    reason: str = Field(default="", max_length=200)


class OrderActionIn(BaseModel):
    action: str = Field(min_length=1)
    note: str = Field(default="", max_length=300)


class DispatchIn(BaseModel):
    dispatchDate: str = Field(default="", max_length=10)
    deliveryPartner: str = Field(default="", max_length=120)
    trackingRef: str = Field(default="", max_length=120)


class EnquiryIn(BaseModel):
    quantity: str = Field(default="", max_length=60)
    message: str = Field(default="", max_length=500)


class EnquiryRespondIn(BaseModel):
    response: str = Field(min_length=1, max_length=1000)


class EnquiryConvertIn(BaseModel):
    to: str = Field(min_length=1)  # quotation | order


class QuotationItemIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    unitPricePaisa: int = Field(ge=0)
    quantity: int = Field(gt=0, le=1000000)


class QuotationIn(BaseModel):
    enquiryId: str | None = Field(default=None, max_length=80)
    items: list[QuotationItemIn] = Field(min_length=1)
    discountPaisa: int = Field(default=0, ge=0)
    taxesPaisa: int = Field(default=0, ge=0)
    delivery: dict = Field(default_factory=dict)
    validUntil: str = Field(min_length=4, max_length=10)
    buyerUid: str | None = Field(default=None, max_length=80)


class QuotationRespondIn(BaseModel):
    action: str = Field(min_length=1)  # accept | decline


class ReviewRespondIn(BaseModel):
    response: str = Field(min_length=1, max_length=500)


class CouponIn(BaseModel):
    code: str = Field(min_length=3, max_length=30)
    discountPaisa: int = Field(default=0, ge=0)
    percentOff: float = Field(default=0, ge=0, le=100)
    validFrom: str = Field(default="", max_length=10)
    validUntil: str = Field(min_length=4, max_length=10)
    maxUses: int | None = Field(default=None, ge=1)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


async def _seller(uid: str = Depends(current_user_id)) -> str:
    """Seller-side endpoints accept the Agri Vyapari and Agri Market Seller personas."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "seller", "agriMarketSeller")
    return uid


def _order_seller_id(order: dict) -> str | None:
    if order.get("sellerId"):
        return order["sellerId"]
    items = order.get("items") or []
    return items[0].get("sellerId") if items else None


async def _require_seller_order(order_id: str, uid: str) -> dict:
    order = await get_doc("orders", order_id)
    seller_id = _order_seller_id(order or {})
    if order is None or seller_id != uid:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    return order


async def _restore_order_stock(order: dict) -> None:
    for item in order.get("items") or []:
        product = await get_doc("products", item.get("productId") or "")
        if product is not None and isinstance(product.get("stock"), int):
            product["stock"] += int(item.get("quantity") or 0)
            await set_doc("products", product["id"], product)


# ---------------------------------------------------------------------------
# Sr 1 — Shop Profile
# ---------------------------------------------------------------------------


@router.get("/shop")
async def get_shop(uid: str = Depends(_seller)):
    doc = await get_doc(SHOPS, uid) or {"ownerUid": uid}
    return doc


@router.put("/shop")
async def put_shop(body: ShopIn, uid: str = Depends(_seller)):
    doc = {
        "ownerUid": uid,
        "shopName": body.shopName,
        "bankName": body.bankName,
        "bankAccountNumber": body.bankAccountNumber,
        "bankIfsc": body.bankIfsc,
        "deliveryArea": body.deliveryArea,
        "pickupAddress": body.pickupAddress,
        "documentIds": body.documentIds,
        "updatedAt": _now(),
        "createdAt": (await get_doc(SHOPS, uid) or {}).get("createdAt") or _now(),
    }
    await set_doc(SHOPS, uid, doc)
    return doc


@router.get("/shops")
async def list_shops(uid: str = Depends(current_user_id)):
    """Public seller-shop directory for the Agri Market page — every shop a
    seller has added. Safe fields only: bank details and documents are never
    exposed here (they stay on the seller's own /shop endpoint)."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    docs = await query(SHOPS, None, limit=200)
    docs = [d for d in docs if (d.get("shopName") or "").strip()]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    items = []
    for d in docs:
        owner = await get_user(d.get("ownerUid") or "")
        items.append(
            {
                "ownerUid": d.get("ownerUid"),
                "shopName": d.get("shopName", ""),
                "sellerName": (owner or {}).get("name", ""),
                "deliveryArea": d.get("deliveryArea", ""),
                "pickupAddress": d.get("pickupAddress", ""),
                "createdAt": d.get("createdAt", ""),
            }
        )
    return {"items": items}


# ---------------------------------------------------------------------------
# Sr 3/24 — My Products + pricing extensions
# ---------------------------------------------------------------------------


async def _my_products(uid: str) -> list[dict]:
    docs = await query("products", [("sellerId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return docs


@router.get("/products")
async def my_products(uid: str = Depends(_seller)):
    return {"items": await _my_products(uid)}


@router.put("/products/{product_id}/pricing")
async def put_product_pricing(product_id: str, body: ProductPricingIn, uid: str = Depends(_seller)):
    product = await get_doc("products", product_id)
    if product is None or product.get("sellerId") != uid:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    if body.maxOrderQty is not None and body.minOrderQty is not None:
        if body.maxOrderQty < body.minOrderQty:
            _error(422, "VALIDATION_ERROR", "max order quantity must be >= min order quantity")
    product.update(
        {
            "variants": body.variants,
            "units": body.units,
            "specifications": body.specifications,
            "minOrderQty": body.minOrderQty,
            "maxOrderQty": body.maxOrderQty,
            "batchNo": body.batchNo or product.get("batchNo"),
            "expiryDate": body.expiryDate,
            "compliance": body.compliance,
            "slabs": body.slabs,
            "lowStockThreshold": body.lowStockThreshold,
            "updatedAt": _now(),
        }
    )
    await set_doc("products", product_id, product)
    return product


# ---------------------------------------------------------------------------
# Sr 4 — Stock Management
# ---------------------------------------------------------------------------


@router.post("/stock/entries", status_code=201)
async def add_stock_entry(body: StockEntryIn, uid: str = Depends(_seller)):
    if body.kind not in ("in", "out", "adjust"):
        _error(422, "INVALID_STOCK_KIND", "kind must be one of in | out | adjust")
    product = await get_doc("products", body.productId)
    if product is None or product.get("sellerId") != uid:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    before = int(product.get("stock") or 0)
    if body.kind == "in":
        after = before + body.quantity
    elif body.kind == "out":
        after = max(0, before - body.quantity)
    else:  # adjust — quantity is the new absolute count
        after = body.quantity
    product["stock"] = after
    await set_doc("products", product["id"], product)
    entry = {
        "id": f"stk_{uuid.uuid4().hex[:10]}",
        "ownerUid": uid,
        "productId": product["id"],
        "productTitle": product.get("title", ""),
        "kind": body.kind,
        "quantity": body.quantity,
        "before": before,
        "after": after,
        "reason": body.reason,
        "createdAt": _now(),
    }
    await set_doc(STOCK, entry["id"], entry)
    return entry


async def _reserved_by_product(uid: str) -> dict[str, int]:
    """Stock reserved by open (not yet terminal) mall orders sold by the seller."""
    orders = await query("orders", [("sellerId", "==", uid)], limit=1000)
    reserved: dict[str, int] = {}
    for order in orders:
        if order.get("status") in TERMINAL_ORDER_STATUSES:
            continue
        for item in order.get("items") or []:
            pid = item.get("productId") or ""
            if pid:
                reserved[pid] = reserved.get(pid, 0) + int(item.get("quantity") or 0)
    return reserved


@router.get("/stock")
async def stock_overview(uid: str = Depends(_seller)):
    products = await _my_products(uid)
    reserved = await _reserved_by_product(uid)
    rows = []
    low_stock = []
    for product in products:
        availability = int(product.get("stock") or 0)
        threshold = int(product.get("lowStockThreshold") or LOW_STOCK_DEFAULT)
        row = {
            "productId": product["id"],
            "title": product.get("title", ""),
            "availability": availability,
            "reserved": reserved.get(product["id"], 0),
            "lowStockThreshold": threshold,
            "lowStock": availability <= threshold,
        }
        rows.append(row)
        if row["lowStock"]:
            low_stock.append(row)
    return {"items": rows, "lowStockAlerts": low_stock}


@router.get("/stock/movements")
async def stock_movements(productId: str | None = None, uid: str = Depends(_seller)):
    filters = [("ownerUid", "==", uid)]
    if productId:
        filters.append(("productId", "==", productId))
    entries = await query(STOCK, filters, limit=1000)
    entries.sort(key=lambda e: e.get("createdAt", ""), reverse=True)
    return {"items": entries}


# ---------------------------------------------------------------------------
# Sr 5/25 — Orders Received + Delivery & Dispatch
# ---------------------------------------------------------------------------


@router.get("/orders")
async def orders_received(status: str | None = None, uid: str = Depends(_seller)):
    docs = await query("orders", [("sellerId", "==", uid)], limit=1000)
    if status:
        docs = [o for o in docs if o.get("status") == status]
    docs.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return {"items": docs}


@router.get("/orders/{order_id}")
async def order_detail(order_id: str, uid: str = Depends(_seller)):
    return await _require_seller_order(order_id, uid)


@router.post("/orders/{order_id}/action")
async def order_action(order_id: str, body: OrderActionIn, uid: str = Depends(_seller)):
    order = await _require_seller_order(order_id, uid)
    if body.action not in ORDER_ACTIONS:
        _error(422, "INVALID_ORDER_ACTION", f"action must be one of {ORDER_ACTIONS}")
    current = order.get("status", "placed")
    target = ACTION_TO_STATUS[body.action]

    # xlsx Sr 5: reject is only possible at intake (before shipping).
    if body.action == "reject" and current not in ("placed", "paid", "confirmed"):
        _error(409, "INVALID_ORDER_ACTION", f"order in {current} cannot be rejected")
    if body.action == "accept" and current not in ("placed", "paid"):
        _error(409, "INVALID_ORDER_ACTION", f"order in {current} is already accepted")
    if body.action == "pack" and current != "confirmed":
        _error(409, "INVALID_ORDER_ACTION", f"order in {current} cannot be packed")
    if body.action == "ship" and current != "shipped":
        _error(409, "INVALID_ORDER_ACTION", f"order in {current} cannot be shipped")
    if body.action == "deliver" and current != "out_for_delivery":
        _error(409, "INVALID_ORDER_ACTION", f"order in {current} cannot be delivered")

    order["status"] = target
    order.setdefault("events", []).append(
        {"status": target, "at": _now(), "note": body.note, "label": body.action, "by": "seller"}
    )
    order.setdefault("sellerTimeline", []).append({"action": body.action, "at": _now(), "note": body.note})
    if body.action == "pack":
        order["packedAt"] = _now()
    if body.action == "reject":
        await _restore_order_stock(order)
    if body.action == "deliver":
        await open_rating_prompt(order.get("userId"), uid, order_id, "marketplace_order")
    await set_doc("orders", order_id, order)
    buyer = order.get("userId")
    if buyer and buyer != uid:
        await notify_user(
            buyer,
            type="order_status",
            title=f"Order {target.replace('_', ' ')}",
            body=f"Your order {order_id} is now {target}.",
            deepLink="/mall/orders",
        )
    return order


@router.get("/orders/{order_id}/dispatch")
async def get_dispatch(order_id: str, uid: str = Depends(_seller)):
    order = await _require_seller_order(order_id, uid)
    return {
        "orderId": order_id,
        "packedAt": order.get("packedAt"),
        "dispatchDate": order.get("dispatchDate", ""),
        "deliveryPartner": order.get("deliveryPartner", ""),
        "trackingRef": order.get("trackingRef", ""),
        "trackingStatus": order.get("status", ""),
    }


@router.put("/orders/{order_id}/dispatch")
async def put_dispatch(order_id: str, body: DispatchIn, uid: str = Depends(_seller)):
    order = await _require_seller_order(order_id, uid)
    order["dispatchDate"] = body.dispatchDate
    order["deliveryPartner"] = body.deliveryPartner
    order["trackingRef"] = body.trackingRef
    await set_doc("orders", order_id, order)
    return {
        "orderId": order_id,
        "packedAt": order.get("packedAt"),
        "dispatchDate": order["dispatchDate"],
        "deliveryPartner": order["deliveryPartner"],
        "trackingRef": order["trackingRef"],
        "trackingStatus": order.get("status", ""),
    }


# ---------------------------------------------------------------------------
# Sr 22 — Enquiry Management
# ---------------------------------------------------------------------------


@router.get("/enquiries")
async def enquiry_inbox(status: str | None = None, uid: str = Depends(_seller)):
    docs = await query(ENQUIRIES, [("sellerUid", "==", uid)], limit=500)
    if status:
        docs = [e for e in docs if e.get("status") == status]
    docs.sort(key=lambda e: e.get("createdAt", ""), reverse=True)
    return {"items": docs}


@router.post("/products/{product_id}/enquiries", status_code=201)
async def post_enquiry(
    product_id: str,
    body: EnquiryIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    """Farmer-side: send an enquiry on a seller's product (xlsx Sr 22)."""
    product = await get_doc("products", product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    seller_id = product.get("sellerId")
    if not seller_id:
        _error(404, "PRODUCT_NOT_FOUND", "product has no seller")
    scope = f"agri_market_seller.enquiry.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    user = await get_user(uid) or {}
    doc = {
        "id": f"enq_{uuid.uuid4().hex[:10]}",
        "sellerUid": seller_id,
        "productId": product_id,
        "productTitle": product.get("title", ""),
        "fromUid": uid,
        "fromName": user.get("name") or "",
        "quantity": body.quantity,
        "message": body.message,
        "status": "pending",
        "response": None,
        "createdAt": _now(),
    }
    await set_doc(ENQUIRIES, doc["id"], doc)
    if seller_id != uid:
        await notify_user(
            seller_id,
            type="seller_enquiry",
            title="New enquiry",
            body=f"{doc['fromName'] or uid} asked about {doc['productTitle']} ({body.quantity or 'qty ?'}).",
            deepLink="/agriMarketSeller/enquiries",
        )
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.post("/enquiries/{enquiry_id}/respond")
async def respond_enquiry(enquiry_id: str, body: EnquiryRespondIn, uid: str = Depends(_seller)):
    enquiry = await get_doc(ENQUIRIES, enquiry_id)
    if enquiry is None or enquiry.get("sellerUid") != uid:
        _error(404, "ENQUIRY_NOT_FOUND", "enquiry not found")
    if enquiry.get("status") != "pending":
        return enquiry
    enquiry["status"] = "responded"
    enquiry["response"] = body.response
    enquiry["respondedAt"] = _now()
    await set_doc(ENQUIRIES, enquiry_id, enquiry)
    if enquiry.get("fromUid") and enquiry["fromUid"] != uid:
        await notify_user(
            enquiry["fromUid"],
            type="seller_enquiry",
            title="Enquiry responded",
            body=f"The seller responded to your enquiry on {enquiry.get('productTitle', '')}.",
            deepLink="/mall",
        )
    return enquiry


async def _order_from_enquiry(enquiry: dict) -> dict:
    product = (await get_doc("products", enquiry.get("productId") or "")) or {}
    price_paisa = int(round(float(product.get("discountedPrice") or product.get("price") or 0) * 100))
    qty = 1
    try:
        qty = max(1, int(float(str(enquiry.get("quantity") or "1"))))
    except ValueError:
        pass
    order = {
        "id": f"ord_{uuid.uuid4().hex[:10]}",
        "userId": enquiry.get("fromUid"),
        "buyerName": enquiry.get("fromName", ""),
        "sellerId": enquiry.get("sellerUid"),
        "items": [
            {
                "productId": enquiry.get("productId"),
                "title": product.get("title") or enquiry.get("productTitle", ""),
                "quantity": qty,
                "price": price_paisa / 100,
            }
        ],
        "total": round(price_paisa * qty / 100, 2),
        "paymentMethod": "on_delivery",
        "status": "placed",
        "source": "seller_enquiry",
        "enquiryId": enquiry["id"],
        "events": [{"status": "placed", "at": _now(), "note": "converted from enquiry", "by": "seller"}],
        "createdAt": _now(),
    }
    await set_doc("orders", order["id"], order)
    if product.get("stock") is not None:
        product["stock"] = max(0, int(product["stock"]) - qty)
        await set_doc("products", product["id"], product)
    return order


@router.post("/enquiries/{enquiry_id}/convert", status_code=201)
async def convert_enquiry(enquiry_id: str, body: EnquiryConvertIn, uid: str = Depends(_seller)):
    if body.to not in ("quotation", "order"):
        _error(422, "INVALID_CONVERT_TARGET", "to must be quotation | order")
    enquiry = await get_doc(ENQUIRIES, enquiry_id)
    if enquiry is None or enquiry.get("sellerUid") != uid:
        _error(404, "ENQUIRY_NOT_FOUND", "enquiry not found")
    if enquiry.get("status") == "converted":
        _error(409, "ALREADY_CONVERTED", "enquiry already converted")

    if body.to == "order":
        order = await _order_from_enquiry(enquiry)
        enquiry["status"] = "converted"
        enquiry["convertedTo"] = "order"
        enquiry["convertedId"] = order["id"]
        await set_doc(ENQUIRIES, enquiry_id, enquiry)
        return {"convertedTo": "order", "order": order}

    product = (await get_doc("products", enquiry.get("productId") or "")) or {}
    price = int(round(float(product.get("discountedPrice") or product.get("price") or 0) * 100))
    qty = 1
    try:
        qty = max(1, int(float(str(enquiry.get("quantity") or "1"))))
    except ValueError:
        pass
    quotation = await _create_quotation(
        seller_uid=uid,
        buyer_uid=enquiry.get("fromUid"),
        enquiry_id=enquiry_id,
        items=[{"title": product.get("title") or enquiry.get("productTitle", ""), "unitPricePaisa": price, "quantity": qty}],
        discount_paisa=0,
        taxes_paisa=0,
        delivery={},
        valid_until=(datetime.now(timezone.utc).date() + timedelta(days=7)).isoformat(),
    )
    enquiry["status"] = "converted"
    enquiry["convertedTo"] = "quotation"
    enquiry["convertedId"] = quotation["id"]
    await set_doc(ENQUIRIES, enquiry_id, enquiry)
    return {"convertedTo": "quotation", "quotation": quotation}


# ---------------------------------------------------------------------------
# Sr 23 — Quotation Management
# ---------------------------------------------------------------------------


async def _next_quotation_number(uid: str) -> str:
    month = datetime.now(timezone.utc).strftime("%Y%m")
    prefix = f"QS-{month}-"
    existing = await query(QUOTATIONS, [("sellerUid", "==", uid)], limit=1000)
    seq = sum(1 for q in existing if str(q.get("number", "")).startswith(prefix)) + 1
    return f"{prefix}{seq:04d}"


async def _create_quotation(
    seller_uid: str,
    buyer_uid: str | None,
    enquiry_id: str | None,
    items: list[dict],
    discount_paisa: int,
    taxes_paisa: int,
    delivery: dict,
    valid_until: str,
) -> dict:
    subtotal = sum(int(i["unitPricePaisa"]) * int(i["quantity"]) for i in items)
    total = max(subtotal - discount_paisa, 0) + taxes_paisa
    doc = {
        "id": f"qt_{uuid.uuid4().hex[:10]}",
        "number": await _next_quotation_number(seller_uid),
        "sellerUid": seller_uid,
        "buyerUid": buyer_uid,
        "enquiryId": enquiry_id,
        "items": items,
        "subtotalPaisa": subtotal,
        "discountPaisa": discount_paisa,
        "taxesPaisa": taxes_paisa,
        "totalPaisa": total,
        "delivery": delivery,
        "validUntil": valid_until,
        "status": "sent",
        "createdAt": _now(),
    }
    await set_doc(QUOTATIONS, doc["id"], doc)
    return doc


@router.get("/quotations")
async def my_quotations(status: str | None = None, uid: str = Depends(_seller)):
    docs = await query(QUOTATIONS, [("sellerUid", "==", uid)], limit=500)
    today = _today()
    for doc in docs:
        if doc.get("status") == "sent" and doc.get("validUntil", "") < today:
            doc["status"] = "expired"
    if status:
        docs = [q for q in docs if q.get("status") == status]
    docs.sort(key=lambda q: q.get("createdAt", ""), reverse=True)
    return {"items": docs}


@router.post("/quotations", status_code=201)
async def create_quotation(body: QuotationIn, uid: str = Depends(_seller)):
    buyer_uid = body.buyerUid
    enquiry_id = body.enquiryId
    if enquiry_id:
        enquiry = await get_doc(ENQUIRIES, enquiry_id)
        if enquiry is None or enquiry.get("sellerUid") != uid:
            _error(404, "ENQUIRY_NOT_FOUND", "enquiry not found")
        buyer_uid = buyer_uid or enquiry.get("fromUid")
    doc = await _create_quotation(
        seller_uid=uid,
        buyer_uid=buyer_uid,
        enquiry_id=enquiry_id,
        items=[i.model_dump() for i in body.items],
        discount_paisa=body.discountPaisa,
        taxes_paisa=body.taxesPaisa,
        delivery=body.delivery,
        valid_until=body.validUntil,
    )
    if buyer_uid and buyer_uid != uid:
        await notify_user(
            buyer_uid,
            type="quotation_received",
            title=f"Quotation {doc['number']}",
            body=f"The seller sent you a quotation for ₹{doc['totalPaisa'] // 100}.",
            deepLink="/mall",
        )
    return doc


@router.get("/quotations/{quotation_id}")
async def get_quotation(quotation_id: str, uid: str = Depends(_seller)):
    doc = await get_doc(QUOTATIONS, quotation_id)
    if doc is None or doc.get("sellerUid") != uid:
        _error(404, "QUOTATION_NOT_FOUND", "quotation not found")
    return doc


@router.post("/quotations/{quotation_id}/respond")
async def respond_quotation(
    quotation_id: str, body: QuotationRespondIn, uid: str = Depends(current_user_id)
):
    """Farmer-side: accept or decline a quotation (accepted ones become orders)."""
    if body.action not in ("accept", "decline"):
        _error(422, "INVALID_QUOTATION_ACTION", "action must be accept | decline")
    doc = await get_doc(QUOTATIONS, quotation_id)
    if doc is None or doc.get("buyerUid") != uid:
        _error(404, "QUOTATION_NOT_FOUND", "quotation not found")
    if doc.get("status") != "sent":
        return doc
    if doc.get("validUntil", "") < _today():
        doc["status"] = "expired"
        await set_doc(QUOTATIONS, quotation_id, doc)
        return doc
    if body.action == "decline":
        doc["status"] = "declined"
        await set_doc(QUOTATIONS, quotation_id, doc)
        return doc
    # accept → order (xlsx Sr 23)
    items = []
    total_paisa = 0
    for item in doc.get("items") or []:
        items.append(
            {
                "productId": None,
                "title": item.get("title", ""),
                "quantity": int(item.get("quantity") or 1),
                "price": int(item.get("unitPricePaisa") or 0) / 100,
            }
        )
        total_paisa += int(item.get("unitPricePaisa") or 0) * int(item.get("quantity") or 1)
    total_paisa = max(total_paisa - int(doc.get("discountPaisa") or 0), 0) + int(doc.get("taxesPaisa") or 0)
    order = {
        "id": f"ord_{uuid.uuid4().hex[:10]}",
        "userId": uid,
        "sellerId": doc.get("sellerUid"),
        "items": items,
        "total": round(total_paisa / 100, 2),
        "paymentMethod": "on_delivery",
        "status": "placed",
        "source": "seller_quotation",
        "quotationId": doc["id"],
        "events": [{"status": "placed", "at": _now(), "note": f"quotation {doc['number']} accepted", "by": "buyer"}],
        "createdAt": _now(),
    }
    await set_doc("orders", order["id"], order)
    doc["status"] = "accepted"
    doc["orderId"] = order["id"]
    await set_doc(QUOTATIONS, quotation_id, doc)
    return doc


# ---------------------------------------------------------------------------
# Sr 26 — Customer Reviews (verified-purchase) + moderated seller responses
# ---------------------------------------------------------------------------


@router.get("/reviews")
async def my_reviews(uid: str = Depends(_seller)):
    docs = await query("ratings", [("providerId", "==", uid), ("bookingKind", "==", "marketplace_order")], limit=500)
    docs.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return {"items": docs}


@router.post("/reviews/{rating_id}/respond")
async def respond_review(rating_id: str, body: ReviewRespondIn, uid: str = Depends(_seller)):
    rating = await get_doc("ratings", rating_id)
    if rating is None or rating.get("providerId") != uid:
        _error(404, "RATING_NOT_FOUND", "review not found")
    if rating.get("sellerResponse"):
        _error(409, "ALREADY_REPLIED", "this review already has a seller response")
    # xlsx Sr 26: the response is held subject to moderation rules before display.
    scan = chat_moderation.scan(body.response)
    status = "rejected" if scan.get("violation") else "approved"
    rating["sellerResponse"] = body.response
    rating["sellerResponseStatus"] = status
    rating["sellerResponseAt"] = _now()
    await set_doc("ratings", rating_id, rating)
    return {"id": rating_id, "sellerResponse": body.response, "sellerResponseStatus": status}


# ---------------------------------------------------------------------------
# Sr 6 — Offers & Coupons
# ---------------------------------------------------------------------------


@router.get("/offers")
async def my_offers(uid: str = Depends(_seller)):
    """Products currently offered below MRP (= seller offers) with usage window."""
    products = await _my_products(uid)
    offers = [
        {
            "productId": p["id"],
            "title": p.get("title", ""),
            "mrpPaisa": int(round(float(p.get("mrp") or 0) * 100)),
            "pricePaisa": int(round(float(p.get("discountedPrice") or 0) * 100)),
            "stock": p.get("stock"),
            "status": p.get("status", "live"),
        }
        for p in products
        if float(p.get("discountedPrice") or 0) < float(p.get("mrp") or 0)
    ]
    return {"items": offers}


@router.get("/coupons")
async def my_coupons(uid: str = Depends(_seller)):
    docs = await query(COUPONS, [("sellerUid", "==", uid)], limit=200)
    today = _today()
    for doc in docs:
        uses = await query("orders", [("couponCode", "==", doc.get("code"))], limit=500)
        doc["usedCount"] = len(uses)
        doc["active"] = (not doc.get("validFrom") or doc["validFrom"] <= today) and doc.get("validUntil", "") >= today
    docs.sort(key=lambda c: c.get("createdAt", ""), reverse=True)
    return {"items": docs}


@router.post("/coupons", status_code=201)
async def create_coupon(body: CouponIn, uid: str = Depends(_seller)):
    code = body.code.strip().upper()
    existing = await query(COUPONS, [("sellerUid", "==", uid)], limit=200)
    if any(c.get("code") == code for c in existing):
        _error(409, "COUPON_EXISTS", "you already have a coupon with this code")
    if body.discountPaisa <= 0 and body.percentOff <= 0:
        _error(422, "VALIDATION_ERROR", "a coupon needs a flat discount or a percent off")
    doc = {
        "id": f"cpn_{uuid.uuid4().hex[:8]}",
        "sellerUid": uid,
        "code": code,
        "discountPaisa": body.discountPaisa,
        "percentOff": body.percentOff,
        "validFrom": body.validFrom,
        "validUntil": body.validUntil,
        "maxUses": body.maxUses,
        "createdAt": _now(),
    }
    await set_doc(COUPONS, doc["id"], doc)
    return doc


# ---------------------------------------------------------------------------
# Sr 2 — Dashboard
# ---------------------------------------------------------------------------


@router.get("/dashboard")
async def seller_dashboard(uid: str = Depends(_seller)):
    orders = await query("orders", [("sellerId", "==", uid)], limit=1000)
    products = await _my_products(uid)
    stock_view = await stock_overview(uid)
    enquiries = await query(ENQUIRIES, [("sellerUid", "==", uid)], limit=500)
    quotations = await query(QUOTATIONS, [("sellerUid", "==", uid)], limit=500)
    ads = await query("ad_campaigns", [("ownerUid", "==", uid)], limit=200)

    child_orders = [o for o in orders if not o.get("isParent")]
    revenue_paisa = 0
    status_counts: dict[str, int] = {}
    for order in child_orders:
        status = order.get("status", "placed")
        status_counts[status] = status_counts.get(status, 0) + 1
        if status in ("delivered", "closed", "paid"):
            revenue_paisa += int(round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100))
    low_stock = stock_view["lowStockAlerts"]
    today = _today()
    pending_quotations = sum(
        1 for q in quotations if q.get("status") == "sent" and q.get("validUntil", "") >= today
    )
    open_enquiries = sum(1 for e in enquiries if e.get("status") == "pending")

    ad_impressions = sum(int(a.get("impressions", 0) or 0) for a in ads)
    ad_clicks = sum(int(a.get("clicks", 0) or 0) for a in ads)

    return {
        "revenuePaisa": revenue_paisa,
        "ordersReceived": len(child_orders),
        "ordersByStatus": status_counts,
        "productStats": {
            "count": len(products),
            "lowStock": len(low_stock),
            "outOfStock": sum(1 for p in products if int(p.get("stock") or 0) <= 0),
        },
        "adPerformance": {
            "campaigns": len(ads),
            "impressions": ad_impressions,
            "clicks": ad_clicks,
        },
        "alerts": {
            "lowStock": low_stock,
            "openEnquiries": open_enquiries,
            "pendingQuotations": pending_quotations,
        },
        # xlsx Sr 2 KPI strip — each tile deep-links into its module.
        "kpis": {
            "enquiries": {"count": open_enquiries, "deepLink": "/agriMarketSeller/enquiries"},
            "pendingQuotations": {"count": pending_quotations, "deepLink": "/agriMarketSeller/quotations"},
            "lowStock": {"count": len(low_stock), "deepLink": "/agriMarketSeller/stock"},
            "orderStatus": {"counts": status_counts, "deepLink": "/agriMarketSeller/orders"},
        },
    }


# ---------------------------------------------------------------------------
# Sr 7 — Earnings & Payouts (reconciled with the existing settlement system)
# ---------------------------------------------------------------------------


@router.get("/earnings")
async def seller_earnings(uid: str = Depends(_seller)):
    orders = [o for o in await query("orders", [("sellerId", "==", uid)], limit=1000) if not o.get("isParent")]
    settled = [o for o in orders if o.get("status") in ("delivered", "closed", "paid")]
    sales_paisa = sum(
        int(round(float(o.get("finalTotal", o.get("total", 0)) or 0) * 100)) for o in settled
    )
    from app.services.billing import COMMISSIONS

    commission_text = COMMISSIONS.get("seller", "0")
    # Platform commission on the seller tier: "2% min ₹50".
    pct = 0.0
    try:
        pct = float(commission_text.split("%")[0]) / 100
    except (ValueError, IndexError):
        pct = 0.0
    commission_paisa = int(round(sales_paisa * pct))

    settlements = await query("settlements", [("sellerId", "==", uid)], limit=500)
    settlements.sort(key=lambda s: s.get("createdAt", ""), reverse=True)
    payout_history = [
        {
            "id": s.get("id"),
            "amountPaisa": int(round(float(s.get("amount", 0) or 0) * 100)),
            "status": s.get("status", "pending"),
            "createdAt": s.get("createdAt", ""),
        }
        for s in settlements
    ]
    return {
        "salesRevenuePaisa": sales_paisa,
        "commissionPct": round(pct * 100, 2),
        "commissionPaisa": commission_paisa,
        "netPayoutPaisa": sales_paisa - commission_paisa,
        "payoutHistory": payout_history,
    }


# ---------------------------------------------------------------------------
# Sr 27 — Sales Reports
# ---------------------------------------------------------------------------


@router.get("/reports/sales")
async def sales_reports(uid: str = Depends(_seller)):
    orders = [o for o in await query("orders", [("sellerId", "==", uid)], limit=1000) if not o.get("isParent")]
    daily: dict[str, dict] = {}
    monthly: dict[str, dict] = {}
    top_products: dict[str, dict] = {}
    status_counts: dict[str, int] = {}
    discounts_paisa = 0
    cancellations = 0
    returns = 0
    revenue_paisa = 0

    for order in orders:
        status = order.get("status", "placed")
        status_counts[status] = status_counts.get(status, 0) + 1
        created = str(order.get("createdAt") or "")[:10]
        month = created[:7]
        total_paisa = int(round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100))
        discount = int(round(float(order.get("couponDiscount", 0) or 0) * 100))
        discounts_paisa += discount
        if status in ("delivered", "closed", "paid"):
            revenue_paisa += total_paisa
        if status == "cancelled":
            cancellations += 1
        if status in ("returned", "closed") and order.get("returnStatus"):
            returns += 1
        for item in order.get("items") or []:
            key = item.get("title") or item.get("productId") or "Item"
            row = top_products.setdefault(key, {"title": key, "quantity": 0, "revenuePaisa": 0})
            qty = int(item.get("quantity") or 0)
            row["quantity"] += qty
            row["revenuePaisa"] += int(round(float(item.get("price", 0) or 0) * 100)) * qty
        if created:
            day_row = daily.setdefault(created, {"date": created, "orders": 0, "revenuePaisa": 0})
            day_row["orders"] += 1
            day_row["revenuePaisa"] += total_paisa if status in ("delivered", "closed", "paid") else 0
        if month:
            month_row = monthly.setdefault(month, {"month": month, "orders": 0, "revenuePaisa": 0})
            month_row["orders"] += 1
            month_row["revenuePaisa"] += total_paisa if status in ("delivered", "closed", "paid") else 0

    return {
        "daily": sorted(daily.values(), key=lambda r: r["date"]),
        "monthly": sorted(monthly.values(), key=lambda r: r["month"]),
        "topProducts": sorted(top_products.values(), key=lambda r: -r["revenuePaisa"])[:10],
        "ordersByStatus": status_counts,
        "discountsPaisa": discounts_paisa,
        "cancellations": cancellations,
        "returns": returns,
        "revenuePaisa": revenue_paisa,
    }


# ---------------------------------------------------------------------------
# Sr 9 — AI Analysis (deterministic, own marketplace data only)
# ---------------------------------------------------------------------------


@router.get("/insights")
async def seller_insights(uid: str = Depends(_seller)):
    orders = [o for o in await query("orders", [("sellerId", "==", uid)], limit=1000) if not o.get("isParent")]
    products = await _my_products(uid)

    sold: dict[str, int] = {}
    monthly_units: dict[str, dict[str, int]] = {}
    for order in orders:
        if order.get("status") not in ("delivered", "closed", "paid"):
            continue
        month = str(order.get("createdAt") or "")[:7]
        for item in order.get("items") or []:
            title = item.get("title") or item.get("productId") or "Item"
            qty = int(item.get("quantity") or 0)
            sold[title] = sold.get(title, 0) + qty
            monthly_units.setdefault(title, {})
            monthly_units[title][month] = monthly_units[title].get(month, 0) + qty

    # Demand forecast: last month's units per product (zero-data → null).
    last_month = (datetime.now(timezone.utc).replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    demand_forecast = None
    if sold:
        demand_forecast = {
            "month": last_month,
            "perProduct": {
                title: monthly_units.get(title, {}).get(last_month, 0) for title in sorted(sold)
            },
        }

    # Pricing suggestions: products with no slab discount where sales exist.
    pricing_suggestions = []
    for product in products:
        title = product.get("title", "")
        if not title or title not in sold:
            continue
        price = float(product.get("discountedPrice") or 0)
        mrp = float(product.get("mrp") or 0)
        if mrp and price >= mrp and not product.get("slabs"):
            pricing_suggestions.append(
                {
                    "productId": product["id"],
                    "title": title,
                    "suggestion": f"Add a quantity slab or set a price below ₹{mrp:.0f} MRP to lift conversions.",
                }
            )

    best_seller = max(sold.items(), key=lambda kv: kv[1], default=None)
    sales_insights = None
    if sold:
        sales_insights = {
            "bestSeller": {"title": best_seller[0], "unitsSold": best_seller[1]},
            "distinctProductsSold": len(sold),
            "fulfilledOrders": sum(
                1 for o in orders if o.get("status") in ("delivered", "closed", "paid")
            ),
        }

    return {
        "demandForecast": demand_forecast,
        "pricingSuggestions": pricing_suggestions,
        "salesInsights": sales_insights,
    }
