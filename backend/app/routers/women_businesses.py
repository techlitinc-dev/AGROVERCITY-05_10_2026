"""Women Hub — My Business & Management + farmer discovery (womenhub 21nov.xlsx).

Implements exactly the xlsx feature set, nothing more:

  Part A · Sr 2.0 "My Business & Management" (woman-facing):
    - create MULTIPLE businesses (tiffin/dabba service, tailoring,
      pickle-papad unit ...) via 'Create Business'
    - business list + search bar over her own businesses
    - business details = business name, category, what the business does,
      photo, service area, working days/time
    - edit / pause / delete business
    - per-business products, orders, enquiries, ratings

  Part A · Sr 7.0 "My Orders & Track" (woman side) and Part B · Sr 4.0
  (farmer side) share one order pipeline with the exact xlsx statuses:
    woman:   packed → pickup → in transit → delivered
    farmer:  placed → accepted → packed → pickup → in transit → delivered
    farmer cancel is allowed only BEFORE acceptance.

  Part B · Sr 1.0 "Discover Women Hub Businesses" (NEW, farmer-facing):
    browse & search, filter by category & distance, business cards =
    photo, name, category, rating, location.

  Part B · Sr 2.0 "Women Hub Business Profile / Store" (NEW):
    what the business does, products/services (photos, price, stock),
    ratings & reviews, working days/time; buttons = Enquire, Order, Chat.
    In-app only — no phone number is ever exposed.

  Part B · Sr 5.0 "post requirement":
    product + quantity + message on any Women Hub product/service,
    enquiry history with status pending / responded.

Data lives in real Firestore collections (no hardcoded data):
  - `women_businesses`           one doc per business (owner can have many)
  - `women_business_products`    per-business products (photo/price/stock)
  - `women_business_enquiries`   farmer requirements (pending/responded)
  - `women_business_orders`      farmer orders on business products
  - `women_business_reviews`     farmer ratings & reviews on a business

Money is integer paisa. Distance uses straight-line haversine on the
owner-profile coordinates copied onto the business at create time — no
external maps API.
"""
import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services import idempotency
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(tags=["women-hub"])

BUSINESSES = "women_businesses"
PRODUCTS = "women_business_products"
ENQUIRIES = "women_business_enquiries"
ORDERS = "women_business_orders"
REVIEWS = "women_business_reviews"

# Exact xlsx order pipeline. `cancelled` is a terminal side-state reachable
# only from `placed` (cancel before acceptance).
ORDER_FLOW = ("placed", "accepted", "packed", "pickup", "in_transit", "delivered")
ORDER_TRANSITIONS = {
    "placed": {"accepted", "cancelled"},
    "accepted": {"packed"},
    "packed": {"pickup"},
    "pickup": {"in_transit"},
    "in_transit": {"delivered"},
    "delivered": set(),
    "cancelled": set(),
}
# The xlsx woman-side tracker starts at "packed": she acts from acceptance on.
WOMAN_FLOW = ("packed", "pickup", "in_transit", "delivered")

ENQUIRY_STATUSES = ("pending", "responded")

# Only the most recent e-market orders are merged into a business's orders
# view — mall history stays on the seller desk.
EMARKET_ORDERS_LIMIT = 20

BUSINESS_CARD_FIELDS = ("id", "name", "category", "photo", "location", "ratingAvg", "ratingCount")


class BusinessIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=1000)  # "what the business does"
    photo: str | None = Field(default=None, max_length=500)
    serviceArea: str = Field(default="", max_length=200)
    workingDays: str = Field(default="", max_length=60)
    workingTime: str = Field(default="", max_length=60)


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    photo: str | None = Field(default=None, max_length=500)
    pricePaisa: int = Field(ge=0)
    stock: int = Field(default=0, ge=0)


class EnquiryIn(BaseModel):
    productId: str | None = Field(default=None, max_length=80)
    productName: str = Field(default="", max_length=120)
    quantity: str = Field(default="", max_length=60)
    message: str = Field(default="", max_length=500)


class EnquiryRespondIn(BaseModel):
    response: str = Field(min_length=1, max_length=1000)


class OrderIn(BaseModel):
    productId: str = Field(min_length=1)
    quantity: int = Field(gt=0, le=100000)


class OrderStatusIn(BaseModel):
    status: str = Field(min_length=1)


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    review: str = Field(default="", max_length=1000)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _woman(uid: str = Depends(current_user_id)) -> str:
    """Woman-side endpoints accept the farmer persona and the womenShg persona."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "womenShg")
    return uid


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _location_label(user: dict, service_area: str) -> str:
    parts = [p for p in (service_area, user.get("village"), user.get("district")) if p]
    seen: list[str] = []
    for part in parts:
        if part not in seen:
            seen.append(part)
    return ", ".join(seen)


def _business_card(doc: dict, distance_km: float | None = None) -> dict:
    card = {k: doc.get(k) for k in BUSINESS_CARD_FIELDS}
    card["status"] = doc.get("status", "active")
    if distance_km is not None:
        card["distanceKm"] = round(distance_km, 1)
    return card


def _enquiry_visible(enquiry: dict, business: dict, uid: str) -> dict:
    """In-app only — strips every field except the buyer's own name."""
    is_owner = business.get("ownerUid") == uid
    from_name = enquiry.get("fromName") if is_owner else (enquiry.get("fromName") or "")
    return {
        "id": enquiry["id"],
        "businessId": enquiry["businessId"],
        "productId": enquiry.get("productId"),
        "productName": enquiry.get("productName", ""),
        "quantity": enquiry.get("quantity", ""),
        "message": enquiry.get("message", ""),
        "status": enquiry.get("status", "pending"),
        "response": enquiry.get("response"),
        "createdAt": enquiry.get("createdAt", ""),
        "respondedAt": enquiry.get("respondedAt"),
        **({"fromUid": enquiry.get("fromUid"), "fromName": from_name} if is_owner else {}),
    }


def _order_visible(order: dict, uid: str) -> dict:
    is_seller = order.get("sellerUid") == uid
    item = {
        "id": order["id"],
        "businessId": order["businessId"],
        "businessName": order.get("businessName", ""),
        "productId": order.get("productId"),
        "productName": order.get("productName", ""),
        "photo": order.get("photo"),
        "quantity": order.get("quantity"),
        "pricePaisa": order.get("pricePaisa"),
        "totalPaisa": order.get("totalPaisa"),
        "status": order.get("status", "placed"),
        "timeline": order.get("timeline", []),
        "createdAt": order.get("createdAt", ""),
        "source": "women_hub",
    }
    if is_seller:
        item["buyerUid"] = order.get("buyerUid")
        item["buyerName"] = order.get("buyerName", "")
    else:
        item["sellerUid"] = order.get("sellerUid")
    return item


async def _emarket_orders_view(uid: str, business_id: str) -> list[dict]:
    """The woman's Krishi Mall (e-market) orders as seller, normalized into the
    business orders view.

    The xlsx order list is "from farmers/e-market": mall orders sit alongside
    the business's own Women Hub orders. Mall orders keep their own status
    pipeline (managed on the seller desk) and are tagged source="e_market" so
    nothing in this view ever advances them.
    """
    docs = await query("orders", [("sellerId", "==", uid)], limit=500)
    docs.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    docs = docs[:EMARKET_ORDERS_LIMIT]
    if not docs:
        return []
    product_ids = {
        i["productId"] for o in docs for i in (o.get("items") or []) if i.get("productId")
    }
    products = {pid: (await get_doc("products", pid)) or {} for pid in product_ids}
    buyer_ids = {o.get("userId") for o in docs if o.get("userId")}
    buyers = {bid: (await get_user(bid) or {}) for bid in buyer_ids}
    views = []
    for order in docs:
        items = order.get("items") or []
        quantity = sum(int(i.get("quantity", 0) or 0) for i in items)
        names = [
            (products.get(i.get("productId")) or {}).get("title") or i.get("productId", "")
            for i in items
        ]
        photo = next(
            (
                (products.get(i.get("productId")) or {}).get("imageUrl")
                for i in items
                if (products.get(i.get("productId")) or {}).get("imageUrl")
            ),
            None,
        )
        total_paisa = int(round(float(order.get("finalTotal", order.get("total", 0)) or 0) * 100))
        buyer = buyers.get(order.get("userId")) or {}
        views.append(
            {
                "id": order["id"],
                "businessId": business_id,
                "businessName": "E-market",
                "productId": items[0].get("productId") if items else None,
                "productName": ", ".join(n for n in names if n) or "Mall order",
                "photo": photo,
                "quantity": quantity,
                "pricePaisa": int(round(total_paisa / quantity)) if quantity else total_paisa,
                "totalPaisa": total_paisa,
                "status": order.get("status", "placed"),
                "timeline": [
                    {"status": e.get("status", ""), "at": e.get("at", ""), "by": "e_market"}
                    for e in (order.get("events") or [])
                ],
                "createdAt": order.get("createdAt", ""),
                "source": "e_market",
                "buyerUid": order.get("userId"),
                "buyerName": buyer.get("name") or "",
            }
        )
    return views


async def _business_orders_view(business: dict, uid: str) -> list[dict]:
    """Merged orders for a business: its Women Hub orders + the owner's
    e-market orders (xlsx A2/A6: order list "from farmers/e-market")."""
    orders = await query(ORDERS, [("businessId", "==", business["id"])], limit=500)
    views = [_order_visible(o, uid) for o in orders]
    views.extend(await _emarket_orders_view(uid, business["id"]))
    views.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return views


async def _my_business(business_id: str, uid: str) -> dict:
    business = await get_doc(BUSINESSES, business_id)
    if business is None or business.get("ownerUid") != uid:
        _error(404, "BUSINESS_NOT_FOUND", "business not found")
    return business


async def _active_business(business_id: str) -> dict:
    business = await get_doc(BUSINESSES, business_id)
    if business is None or business.get("status") != "active":
        _error(404, "BUSINESS_NOT_FOUND", "business not found")
    return business


# =========================================================================
# Part A · Sr 2.0 — My Business & Management (woman side)
# =========================================================================


@router.post("/women/businesses", status_code=201)
async def create_business(
    body: BusinessIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_woman),
):
    scope = f"women.business.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    user = await get_user(uid) or {}
    business_id = f"wb_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": business_id,
        "ownerUid": uid,
        "ownerName": user.get("name") or "",
        "name": body.name,
        "category": body.category,
        "description": body.description,
        "photo": body.photo,
        "serviceArea": body.serviceArea,
        "workingDays": body.workingDays,
        "workingTime": body.workingTime,
        # Discovery card / distance-filter fields, copied from the owner
        # profile at create time (no external lookup).
        "location": _location_label(user, body.serviceArea),
        "village": user.get("village") or "",
        "district": user.get("district") or "",
        "lat": user.get("lat"),
        "lng": user.get("lng"),
        "status": "active",
        "ratingAvg": 0.0,
        "ratingCount": 0,
        "createdAt": _now(),
    }
    await set_doc(BUSINESSES, business_id, doc)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.get("/women/businesses")
async def my_businesses(
    q: str | None = Query(None),
    uid: str = Depends(_woman),
):
    """Her businesses + search bar over her own businesses (xlsx Sr 2.0)."""
    docs = await query(BUSINESSES, [("ownerUid", "==", uid)], limit=200)
    if q:
        needle = q.strip().lower()
        docs = [
            d
            for d in docs
            if needle in (d.get("name") or "").lower()
            or needle in (d.get("category") or "").lower()
            or needle in (d.get("description") or "").lower()
        ]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"items": [_business_card(d) | {"description": d.get("description", "")} for d in docs]}


@router.get("/women/businesses/{business_id}")
async def my_business_detail(business_id: str, uid: str = Depends(_woman)):
    """Business details + its products, orders, enquiries and ratings."""
    business = await _my_business(business_id, uid)
    products = await query(PRODUCTS, [("businessId", "==", business_id)], limit=200)
    orders = await _business_orders_view(business, uid)
    enquiries = await query(ENQUIRIES, [("businessId", "==", business_id)], limit=500)
    enquiries.sort(key=lambda e: e.get("createdAt", ""), reverse=True)
    reviews = await query(REVIEWS, [("businessId", "==", business_id)], limit=500)
    reviews.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return {
        "business": business,
        "products": products,
        "orders": orders,
        "enquiries": [_enquiry_visible(e, business, uid) for e in enquiries],
        "ratings": reviews,
    }


@router.put("/women/businesses/{business_id}")
async def update_business(business_id: str, body: BusinessIn, uid: str = Depends(_woman)):
    business = await _my_business(business_id, uid)
    business.update(
        {
            "name": body.name,
            "category": body.category,
            "description": body.description,
            "photo": body.photo,
            "serviceArea": body.serviceArea,
            "workingDays": body.workingDays,
            "workingTime": body.workingTime,
            "updatedAt": _now(),
        }
    )
    user = await get_user(uid) or {}
    business["location"] = _location_label(user, body.serviceArea)
    await set_doc(BUSINESSES, business_id, business)
    return business


@router.post("/women/businesses/{business_id}/pause")
async def pause_business(business_id: str, uid: str = Depends(_woman)):
    business = await _my_business(business_id, uid)
    business["status"] = "paused"
    business["updatedAt"] = _now()
    await set_doc(BUSINESSES, business_id, business)
    return business


@router.post("/women/businesses/{business_id}/resume")
async def resume_business(business_id: str, uid: str = Depends(_woman)):
    business = await _my_business(business_id, uid)
    business["status"] = "active"
    business["updatedAt"] = _now()
    await set_doc(BUSINESSES, business_id, business)
    return business


@router.delete("/women/businesses/{business_id}", status_code=204)
async def delete_business(business_id: str, uid: str = Depends(_woman)):
    business = await _my_business(business_id, uid)
    for product in await query(PRODUCTS, [("businessId", "==", business_id)], limit=500):
        await delete_doc(PRODUCTS, product["id"])
    for enquiry in await query(ENQUIRIES, [("businessId", "==", business_id)], limit=500):
        await delete_doc(ENQUIRIES, enquiry["id"])
    for order in await query(ORDERS, [("businessId", "==", business_id)], limit=500):
        await delete_doc(ORDERS, order["id"])
    for review in await query(REVIEWS, [("businessId", "==", business_id)], limit=500):
        await delete_doc(REVIEWS, review["id"])
    await delete_doc(BUSINESSES, business["id"])
    return Response(status_code=204)


# --- per-business products -------------------------------------------------


@router.post("/women/businesses/{business_id}/products", status_code=201)
async def add_product(business_id: str, body: ProductIn, uid: str = Depends(_woman)):
    business = await _my_business(business_id, uid)
    product_id = f"wbp_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": product_id,
        "businessId": business_id,
        "ownerUid": uid,
        "businessName": business.get("name", ""),
        "name": body.name,
        "photo": body.photo,
        "pricePaisa": body.pricePaisa,
        "stock": body.stock,
        "createdAt": _now(),
    }
    await set_doc(PRODUCTS, product_id, doc)
    return doc


@router.put("/women/businesses/{business_id}/products/{product_id}")
async def update_product(
    business_id: str, product_id: str, body: ProductIn, uid: str = Depends(_woman)
):
    await _my_business(business_id, uid)
    product = await get_doc(PRODUCTS, product_id)
    if product is None or product.get("businessId") != business_id:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    product.update(
        {
            "name": body.name,
            "photo": body.photo,
            "pricePaisa": body.pricePaisa,
            "stock": body.stock,
            "updatedAt": _now(),
        }
    )
    await set_doc(PRODUCTS, product_id, product)
    return product


@router.delete("/women/businesses/{business_id}/products/{product_id}", status_code=204)
async def delete_product(business_id: str, product_id: str, uid: str = Depends(_woman)):
    await _my_business(business_id, uid)
    product = await get_doc(PRODUCTS, product_id)
    if product is None or product.get("businessId") != business_id:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    await delete_doc(PRODUCTS, product_id)
    return Response(status_code=204)


# --- orders: woman fulfils with the exact xlsx pipeline --------------------


async def _seller_order(order_id: str, uid: str) -> dict:
    order = await get_doc(ORDERS, order_id)
    if order is None or order.get("sellerUid") != uid:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    return order


@router.get("/women/businesses/{business_id}/orders")
async def business_orders(business_id: str, uid: str = Depends(_woman)):
    business = await _my_business(business_id, uid)
    return {"items": await _business_orders_view(business, uid)}


@router.post("/women/businesses/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusIn, uid: str = Depends(_woman)):
    order = await _seller_order(order_id, uid)
    current = order.get("status", "placed")
    target = body.status
    if target not in ORDER_TRANSITIONS.get(current, set()):
        _error(409, "INVALID_ORDER_STATUS", f"order cannot move from {current} to {target}")
    order["status"] = target
    order["timeline"] = list(order.get("timeline") or []) + [
        {"status": target, "at": _now(), "by": "seller"}
    ]
    await set_doc(ORDERS, order_id, order)
    buyer_title = {
        "accepted": "Order accepted",
        "packed": "Order packed",
        "pickup": "Ready for pickup",
        "in_transit": "Order in transit",
        "delivered": "Order delivered",
        "cancelled": "Order cancelled",
    }.get(target, f"Order {target}")
    await notify_user(
        order["buyerUid"],
        type="women_hub_order",
        title=buyer_title,
        body=f"Order {order_id} ({order.get('productName', '')}) is now {target}.",
        deepLink="/farmer/women-hub/orders",
    )
    return _order_visible(order, uid)


# --- enquiries: woman responds ----------------------------------------------


@router.get("/women/businesses/{business_id}/enquiries")
async def business_enquiries(business_id: str, uid: str = Depends(_woman)):
    business = await _my_business(business_id, uid)
    enquiries = await query(ENQUIRIES, [("businessId", "==", business["id"])], limit=500)
    enquiries.sort(key=lambda e: e.get("createdAt", ""), reverse=True)
    return {"items": [_enquiry_visible(e, business, uid) for e in enquiries]}


@router.post("/women/businesses/enquiries/{enquiry_id}/respond")
async def respond_enquiry(enquiry_id: str, body: EnquiryRespondIn, uid: str = Depends(_woman)):
    enquiry = await get_doc(ENQUIRIES, enquiry_id)
    if enquiry is None:
        _error(404, "ENQUIRY_NOT_FOUND", "enquiry not found")
    business = await get_doc(BUSINESSES, enquiry["businessId"])
    if business is None or business.get("ownerUid") != uid:
        _error(404, "ENQUIRY_NOT_FOUND", "enquiry not found")
    if enquiry.get("status") == "responded":
        return _enquiry_visible(enquiry, business, uid)
    enquiry["status"] = "responded"
    enquiry["response"] = body.response
    enquiry["respondedAt"] = _now()
    await set_doc(ENQUIRIES, enquiry_id, enquiry)
    await notify_user(
        enquiry["fromUid"],
        type="women_hub_enquiry",
        title="Requirement responded",
        body=f"{business.get('name', '')} responded to your requirement.",
        deepLink="/farmer/women-hub/enquiries",
    )
    return _enquiry_visible(enquiry, business, uid)


# =========================================================================
# Part B · Sr 1.0/2.0 — farmer discovery + business profile/store
# =========================================================================


@router.get("/women-hub/businesses")
async def discover_businesses(
    q: str | None = Query(None),
    category: str | None = Query(None),
    distanceKm: float | None = Query(None, ge=0),
    uid: str = Depends(current_user_id),
):
    """Farmer directory: browse & search, filter by category & distance.

    Business cards carry exactly: photo, name, category, rating, location.
    """
    docs = await query(BUSINESSES, [("status", "==", "active")], limit=1000)
    if q:
        needle = q.strip().lower()
        docs = [
            d
            for d in docs
            if needle in (d.get("name") or "").lower()
            or needle in (d.get("category") or "").lower()
            or needle in (d.get("description") or "").lower()
        ]
    if category:
        docs = [d for d in docs if (d.get("category") or "").lower() == category.strip().lower()]

    me = await get_user(uid) or {}
    my_lat, my_lng = me.get("lat"), me.get("lng")
    cards = []
    for doc in docs:
        distance = None
        blat, blng = doc.get("lat"), doc.get("lng")
        if (
            distanceKm is not None
            and my_lat is not None
            and my_lng is not None
            and blat is not None
            and blng is not None
        ):
            distance = _haversine_km(float(my_lat), float(my_lng), float(blat), float(blng))
            if distance > distanceKm:
                continue
        cards.append(_business_card(doc, distance))
    # Nearest first when a distance filter is active, newest otherwise.
    if distanceKm is not None:
        cards.sort(key=lambda c: c.get("distanceKm", 1e9))
    else:
        cards.sort(key=lambda c: (c.get("ratingAvg") or 0, c.get("ratingCount") or 0), reverse=True)
    return {"items": cards[:50]}


@router.get("/women-hub/businesses/{business_id}")
async def business_profile(business_id: str, uid: str = Depends(current_user_id)):
    """Public store page: business info, products, ratings & reviews,
    working days/time. Deliberately exposes no phone number (xlsx Sr 2.0)."""
    business = await _active_business(business_id)
    products = await query(PRODUCTS, [("businessId", "==", business_id)], limit=200)
    products = [p for p in products if int(p.get("stock", 0) or 0) > 0]
    reviews = await query(REVIEWS, [("businessId", "==", business_id)], limit=200)
    reviews.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    my_enquiry_ids = {
        e["id"]
        for e in await query(ENQUIRIES, [("fromUid", "==", uid)], limit=500)
        if e.get("businessId") == business_id
    }
    return {
        "business": {
            "id": business["id"],
            "name": business.get("name", ""),
            "category": business.get("category", ""),
            "description": business.get("description", ""),
            "photo": business.get("photo"),
            "location": business.get("location", ""),
            "workingDays": business.get("workingDays", ""),
            "workingTime": business.get("workingTime", ""),
            "ownerName": business.get("ownerName", ""),
            "sellerUid": business.get("ownerUid"),
            "ratingAvg": business.get("ratingAvg", 0.0),
            "ratingCount": business.get("ratingCount", 0),
        },
        "products": [
            {
                "id": p["id"],
                "name": p.get("name", ""),
                "photo": p.get("photo"),
                "pricePaisa": p.get("pricePaisa", 0),
                "stock": p.get("stock", 0),
            }
            for p in products
        ],
        "reviews": [
            {
                "id": r["id"],
                "rating": r.get("rating"),
                "review": r.get("review", ""),
                "fromName": r.get("fromName", ""),
                "createdAt": r.get("createdAt", ""),
            }
            for r in reviews
        ],
        "myEnquiryIds": sorted(my_enquiry_ids),
    }


# --- Part B · Sr 5.0 — post requirement (enquiry) ---------------------------


@router.post("/women-hub/businesses/{business_id}/enquiries", status_code=201)
async def post_requirement(
    business_id: str,
    body: EnquiryIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    """product + quantity + message; history status pending / responded."""
    business = await _active_business(business_id)
    scope = f"women_hub.enquiry.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    product_name = body.productName
    if body.productId:
        product = await get_doc(PRODUCTS, body.productId)
        if product is None or product.get("businessId") != business_id:
            _error(404, "PRODUCT_NOT_FOUND", "product not found")
        product_name = product.get("name", product_name)
    user = await get_user(uid) or {}
    enquiry_id = f"enq_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": enquiry_id,
        "businessId": business_id,
        "fromUid": uid,
        "fromName": user.get("name") or "",
        "productId": body.productId,
        "productName": product_name,
        "quantity": body.quantity,
        "message": body.message,
        "status": "pending",
        "response": None,
        "createdAt": _now(),
    }
    await set_doc(ENQUIRIES, enquiry_id, doc)
    owner = business.get("ownerUid")
    if owner and owner != uid:
        await notify_user(
            owner,
            type="women_hub_enquiry",
            title="New requirement",
            body=f"{doc['fromName'] or uid} asked about {product_name or 'your business'}.",
            deepLink=f"/women/hub/businesses/{business_id}",
        )
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.get("/women-hub/enquiries")
async def my_enquiries(uid: str = Depends(current_user_id)):
    """The farmer's enquiry history with status pending / responded."""
    docs = await query(ENQUIRIES, [("fromUid", "==", uid)], limit=500)
    docs.sort(key=lambda e: e.get("createdAt", ""), reverse=True)
    items = []
    for enquiry in docs:
        business = await get_doc(BUSINESSES, enquiry["businessId"])
        items.append(
            {
                "id": enquiry["id"],
                "businessId": enquiry["businessId"],
                "businessName": (business or {}).get("name", ""),
                "productName": enquiry.get("productName", ""),
                "quantity": enquiry.get("quantity", ""),
                "message": enquiry.get("message", ""),
                "status": enquiry.get("status", "pending"),
                "response": enquiry.get("response"),
                "createdAt": enquiry.get("createdAt", ""),
                "respondedAt": enquiry.get("respondedAt"),
            }
        )
    return {"items": items}


# --- Part B · Sr 4.0 — farmer orders ----------------------------------------


@router.post("/women-hub/businesses/{business_id}/orders", status_code=201)
async def place_order(
    business_id: str,
    body: OrderIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    business = await _active_business(business_id)
    product = await get_doc(PRODUCTS, body.productId)
    if product is None or product.get("businessId") != business_id:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    if int(product.get("stock", 0) or 0) < body.quantity:
        _error(409, "INSUFFICIENT_STOCK", "not enough stock for this order")
    if business.get("ownerUid") == uid:
        _error(409, "CANNOT_ORDER_OWN_BUSINESS", "you cannot order your own business")
    scope = f"women_hub.order.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    user = await get_user(uid) or {}
    order_id = f"wbo_{uuid.uuid4().hex[:10]}"
    price = int(product.get("pricePaisa", 0))
    doc = {
        "id": order_id,
        "businessId": business_id,
        "businessName": business.get("name", ""),
        "productId": product["id"],
        "productName": product.get("name", ""),
        "photo": product.get("photo"),
        "quantity": body.quantity,
        "pricePaisa": price,
        "totalPaisa": price * body.quantity,
        "buyerUid": uid,
        "buyerName": user.get("name") or "",
        "sellerUid": business.get("ownerUid"),
        "status": "placed",
        "timeline": [{"status": "placed", "at": _now(), "by": "buyer"}],
        "createdAt": _now(),
    }
    await set_doc(ORDERS, order_id, doc)
    product["stock"] = int(product.get("stock", 0) or 0) - body.quantity
    await set_doc(PRODUCTS, product["id"], product)
    owner = business.get("ownerUid")
    if owner and owner != uid:
        await notify_user(
            owner,
            type="women_hub_order",
            title="New order",
            body=f"{doc['buyerName'] or uid} ordered {body.quantity} × {doc['productName']}.",
            deepLink=f"/women/hub/businesses/{business_id}",
        )
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return _order_visible(doc, uid)


@router.get("/women-hub/orders")
async def my_orders(uid: str = Depends(current_user_id)):
    docs = await query(ORDERS, [("buyerUid", "==", uid)], limit=500)
    docs.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return {"items": [_order_visible(o, uid) for o in docs]}


@router.post("/women-hub/orders/{order_id}/cancel")
async def cancel_order(order_id: str, uid: str = Depends(current_user_id)):
    order = await get_doc(ORDERS, order_id)
    if order is None or order.get("buyerUid") != uid:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    if order.get("status") != "placed":
        _error(409, "INVALID_ORDER_STATUS", "cancel is allowed only before acceptance")
    order["status"] = "cancelled"
    order["timeline"] = list(order.get("timeline") or []) + [
        {"status": "cancelled", "at": _now(), "by": "buyer"}
    ]
    await set_doc(ORDERS, order_id, order)
    product = await get_doc(PRODUCTS, order.get("productId") or "")
    if product is not None:
        product["stock"] = int(product.get("stock", 0) or 0) + int(order.get("quantity", 0))
        await set_doc(PRODUCTS, product["id"], product)
    seller = order.get("sellerUid")
    if seller and seller != uid:
        await notify_user(
            seller,
            type="women_hub_order",
            title="Order cancelled",
            body=f"Order {order_id} ({order.get('productName', '')}) was cancelled by the buyer.",
            deepLink=f"/women/hub/businesses/{order.get('businessId')}",
        )
    return _order_visible(order, uid)


# --- ratings & reviews -------------------------------------------------------


@router.post("/women-hub/businesses/{business_id}/rate")
async def rate_business(business_id: str, body: ReviewIn, uid: str = Depends(current_user_id)):
    business = await get_doc(BUSINESSES, business_id)
    if business is None:
        _error(404, "BUSINESS_NOT_FOUND", "business not found")
    if business.get("ownerUid") == uid:
        _error(409, "CANNOT_RATE_OWN_BUSINESS", "you cannot rate your own business")
    user = await get_user(uid) or {}
    review_id = f"rev_{business_id}_{uid}"
    existing = await get_doc(REVIEWS, review_id)
    doc = {
        "id": review_id,
        "businessId": business_id,
        "fromUid": uid,
        "fromName": user.get("name") or "",
        "rating": body.rating,
        "review": body.review,
        "createdAt": _now(),
    }
    await set_doc(REVIEWS, review_id, doc)
    all_reviews = await query(REVIEWS, [("businessId", "==", business_id)], limit=500)
    business["ratingAvg"] = round(
        sum(int(r.get("rating", 0)) for r in all_reviews) / max(len(all_reviews), 1), 1
    )
    business["ratingCount"] = len(all_reviews)
    await set_doc(BUSINESSES, business_id, business)
    owner = business.get("ownerUid")
    if owner and owner != uid:
        await notify_user(
            owner,
            type="women_hub_rating",
            title="New rating",
            body=f"{doc['fromName'] or uid} rated {body.rating}★ for {business.get('name', '')}.",
            deepLink=f"/women/hub/businesses/{business_id}",
        )
    result = dict(doc)
    result["ratingAvg"] = business["ratingAvg"]
    result["ratingCount"] = business["ratingCount"]
    result["updated"] = existing is not None
    return result
