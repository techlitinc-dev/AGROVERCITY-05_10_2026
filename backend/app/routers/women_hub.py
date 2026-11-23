"""Woman Hub persona — implements womeninstructions.md (womenhub 21nov.xlsx).

Part A (woman-facing):
  A1  Dashboard          — garden growth stages, total business, enterprise
                           profit total, notifications, Indian calendar,
                           reminders (garden water/fertilizer + alerts).
  A2  My Business & Mgmt — multiple businesses (tiffin/dabba, tailoring,
                           pickle-papad unit ...), search, edit/pause/delete,
                           per-business products, orders, enquiries, ratings.
  A3  Kitchen Garden     — nutrition-tagged vegetable catalog, stage pipeline
                           sowing→sprout→vegetative→flowering→harvest,
                           seasonal plans, water/fertilizer reminders, yield log.
  A4  Enterprise Income  — product lines (pickle/papad/ghee) with quantity &
                           price, monthly revenue−cost per product, expenses,
                           auto monthly total, profit graph, CSV export.
  A6  My Orders & Track  — packed→pickup→in_transit→delivered.
  A7  AI Analysis        — savings trend, loan repayment health, garden yield
                           prediction, livestock productivity, best-seller &
                           price suggestion (deterministic, in-platform data).

Part B (farmer-facing):
  B1 Discover businesses — browse/search, category & distance filters,
                           cards = photo, name, category, rating, location.
  B2 Business profile    — products, ratings & reviews, working days/time,
                           Enquire / Order / Chat. In-app only — no phone.
  B4 Farmer orders       — placed→accepted→packed→pickup→in_transit→delivered,
                           cancel only before acceptance.
  B5 Post requirement    — product + quantity + message; pending/responded.

Collections: women_businesses, women_business_products,
women_business_enquiries, women_business_orders, women_business_reviews,
garden_plans, garden_crops, home_enterprises, home_enterprise_months,
home_enterprise_expenses. Money is integer paisa. Distance is straight-line
haversine on profile coordinates — no external maps API.
"""
import csv
import io
import math
import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.emarket import UserProductCreate
from app.routers.user_products import create_listing
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
GARDEN_PLANS = "garden_plans"
GARDEN_CROPS = "garden_crops"
HOME_ENTERPRISES = "home_enterprises"
HOME_ENTERPRISE_MONTHS = "home_enterprise_months"
HOME_ENTERPRISE_EXPENSES = "home_enterprise_expenses"
HERD_COLLECTION = "livestock_animals"
VACCINATIONS_COLLECTION = "vaccination_schedules"

# xlsx Sr 4.0 — exact kitchen-garden growth-stage pipeline.
GARDEN_STAGES = ("sowing", "sprout", "vegetative", "flowering", "harvest")
GARDEN_STAGE_TRANSITIONS = {
    "sowing": {"sprout"},
    "sprout": {"vegetative"},
    "vegetative": {"flowering"},
    "flowering": {"harvest"},
    "harvest": set(),
}
REMINDER_TYPES = ("water", "fertilizer")

# xlsx Sr 4.0 — nutrition-focused seed list (spinach, methi, tomato, carrot,
# drumstick ... with iron/vitamin tags). Firestore `template: true` garden
# plan docs override this catalog when present.
VEGETABLE_CATALOG = (
    {
        "id": "veg_spinach",
        "category": "Leafy Greens",
        "items": [
            {
                "name": "Spinach",
                "vernacularName": "पालक",
                "nutrition": "Iron, Vitamin A, Folate",
                "companion": "Tomato, Cauliflower",
                "daysToHarvest": 45,
            }
        ],
        "order": 1,
    },
    {
        "id": "veg_methi",
        "category": "Leafy Greens",
        "items": [
            {
                "name": "Methi",
                "vernacularName": "मेथी",
                "nutrition": "Iron, Fibre, Vitamin C",
                "companion": "Coriander",
                "daysToHarvest": 30,
            }
        ],
        "order": 2,
    },
    {
        "id": "veg_tomato",
        "category": "Vegetables",
        "items": [
            {
                "name": "Tomato",
                "vernacularName": "टमाटर",
                "nutrition": "Vitamin C, Lycopene, Potassium",
                "companion": "Spinach, Onion",
                "daysToHarvest": 90,
            }
        ],
        "order": 3,
    },
    {
        "id": "veg_carrot",
        "category": "Vegetables",
        "items": [
            {
                "name": "Carrot",
                "vernacularName": "गाजर",
                "nutrition": "Vitamin A (beta-carotene), Fibre",
                "companion": "Tomato, Peas",
                "daysToHarvest": 75,
            }
        ],
        "order": 4,
    },
    {
        "id": "veg_drumstick",
        "category": "Trees/Perennials",
        "items": [
            {
                "name": "Drumstick",
                "vernacularName": "शेवगा",
                "nutrition": "Iron, Calcium, Vitamin C",
                "companion": "Curry leaf",
                "daysToHarvest": 180,
            }
        ],
        "order": 5,
    },
)

IST = ZoneInfo("Asia/Kolkata")

# Exact xlsx order pipelines. `cancelled` is a terminal side-state reachable
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

SAKA_MONTHS = (
    "Chaitra",
    "Vaishakha",
    "Jyeshtha",
    "Ashadha",
    "Shravana",
    "Bhadrapada",
    "Ashwin",
    "Kartik",
    "Margashirsha",
    "Pausha",
    "Magha",
    "Phalguna",
)


class BusinessIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=1000)  # "what the business does"
    photo: str | None = Field(default=None, max_length=500)
    serviceArea: str = Field(default="", max_length=200)
    workingDays: str = Field(default="", max_length=60)
    workingTime: str = Field(default="", max_length=60)


class BusinessProductIn(BaseModel):
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


class GardenItemIn(BaseModel):
    name: str
    vernacularName: str = ""
    nutrition: str = ""
    companion: str = ""
    daysToHarvest: int = Field(ge=0)


class GardenPlanIn(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    items: list[GardenItemIn] = Field(default_factory=list)


class GardenCropIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    nutrition: str = Field(default="", max_length=200)
    planId: str | None = Field(default=None, max_length=80)
    season: str = Field(default="", max_length=60)
    sownOn: str = Field(default="")


class GardenStageIn(BaseModel):
    stage: str = Field(min_length=1)


class GardenReminderIn(BaseModel):
    type: str = Field(min_length=1)  # water | fertilizer (xlsx Sr 4.0)
    dueDate: str = Field(min_length=4, max_length=10)


class GardenYieldIn(BaseModel):
    date: str = Field(min_length=4, max_length=10)
    quantity: float = Field(ge=0)
    unit: str = Field(default="kg", max_length=20)


class EnterpriseIn(BaseModel):
    product: str = Field(min_length=1, max_length=120)
    monthlyProfitPaisa: int = Field(gt=0)
    revenuePaisa: int | None = Field(default=None, ge=0)
    # xlsx Sr 5.0 — product line detail: quantity + price.
    quantity: str = Field(default="", max_length=60)
    pricePaisa: int | None = Field(default=None, ge=0)


class EnterpriseMonthIn(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    revenuePaisa: int = Field(ge=0)
    costPaisa: int = Field(ge=0)


class EnterpriseExpenseIn(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    note: str = Field(default="", max_length=200)
    amountPaisa: int = Field(gt=0)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _woman(uid: str = Depends(current_user_id)) -> str:
    """Woman-side endpoints accept the farmer persona and the womenHub persona."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "womenHub")
    return uid


async def _woman_with_user(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "womenHub")
    return user, uid


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
    """In-app only — the responder's identity is shown to the owner only."""
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
    scope = f"women_hub.business.{uid}"
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


# --- per-business products (A2/A16 stock & pricing) -------------------------


@router.post("/women/businesses/{business_id}/products", status_code=201)
async def add_product(business_id: str, body: BusinessProductIn, uid: str = Depends(_woman)):
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
    business_id: str, product_id: str, body: BusinessProductIn, uid: str = Depends(_woman)
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


# --- orders: woman fulfils with the exact xlsx pipeline (A6) ----------------


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


# --- enquiries: woman responds (A2) ------------------------------------------


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
        deepLink="/farmer/women-hub/orders",
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
    # Nearest first when a distance filter is active, top-rated otherwise.
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


# --- Part B · Sr 5.0 — post requirement (enquiry) ----------------------------


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
            deepLink=f"/womenHub/businesses/{business_id}",
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


# --- Part B · Sr 4.0 — farmer orders -----------------------------------------


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
            deepLink=f"/womenHub/businesses/{business_id}",
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
            deepLink=f"/womenHub/businesses/{order.get('businessId')}",
        )
    return _order_visible(order, uid)


# --- ratings & reviews (A2/A16/A20, B1/B2) ------------------------------------


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
            deepLink=f"/womenHub/businesses/{business_id}",
        )
    result = dict(doc)
    result["ratingAvg"] = business["ratingAvg"]
    result["ratingCount"] = business["ratingCount"]
    result["updated"] = existing is not None
    return result


# =========================================================================
# Part A · Sr 4.0 — Kitchen Garden Planner
# =========================================================================


@router.get("/women/garden-plans")
async def garden_plans(uid: str = Depends(_woman)):
    docs = await query(GARDEN_PLANS, [], limit=500)
    visible = [d for d in docs if d.get("template") or d.get("ownerUid") == uid]
    visible.sort(
        key=lambda d: (
            0 if d.get("template") else 1,
            d.get("order", 99),
            d.get("createdAt", ""),
        )
    )
    return {"data": visible}


@router.get("/women/garden-templates")
async def garden_templates(uid: str = Depends(_woman)):
    """Nutrition-tagged vegetable catalog for the picker (xlsx Sr 4.0).

    Reads seeded `template: true` docs from the `garden_plans` collection;
    falls back to the in-module catalog when unseeded.
    """
    docs = [d for d in await query(GARDEN_PLANS, [("template", "==", True)], limit=50)]
    if not docs:
        docs = [dict(t, template=True) for t in VEGETABLE_CATALOG]
    docs.sort(key=lambda d: (d.get("order", 99), d.get("createdAt", "")))
    return {"data": docs}


@router.post("/women/garden-plans", status_code=201)
async def create_garden_plan(
    body: GardenPlanIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_woman),
):
    scope = f"women_hub.garden_plan.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    plan_id = f"gp_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": plan_id,
        "ownerUid": uid,
        "template": False,
        "category": body.category,
        "items": [item.model_dump() for item in body.items],
        "createdAt": _now(),
    }
    await set_doc(GARDEN_PLANS, plan_id, doc)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.put("/women/garden-plans/{plan_id}")
async def update_garden_plan(
    plan_id: str,
    body: GardenPlanIn,
    uid: str = Depends(_woman),
):
    doc = await get_doc(GARDEN_PLANS, plan_id)
    if doc is None:
        _error(404, "GARDEN_PLAN_NOT_FOUND", "garden plan not found")
    if doc.get("template") or doc.get("ownerUid") != uid:
        _error(403, "FORBIDDEN", "garden plan belongs to another user")
    doc["category"] = body.category
    doc["items"] = [item.model_dump() for item in body.items]
    doc["updatedAt"] = _now()
    await set_doc(GARDEN_PLANS, plan_id, doc)
    return doc


def _indian_calendar(today: date) -> dict:
    """Approximate Indian national (Saka) calendar date — computed in-app.

    Month starts follow the standard Chaitra-1 = Mar 22 (Mar 21 in leap
    years) rule with fixed month lengths; accurate to ±1 day.
    """
    leap = today.year % 4 == 0 and (today.year % 100 != 0 or today.year % 400 == 0)
    if today >= date(today.year, 3, 21 if leap else 22):
        year = today.year - 78
        start = date(today.year, 3, 21 if leap else 22)
    else:
        year = today.year - 79
        prev_leap = (today.year - 1) % 4 == 0 and (
            (today.year - 1) % 100 != 0 or (today.year - 1) % 400 == 0
        )
        start = date(today.year - 1, 3, 21 if prev_leap else 22)
    year_leap = start.year % 4 == 0 and (start.year % 100 != 0 or start.year % 400 == 0)
    lengths = (31 if year_leap else 30, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30)
    day = start
    for idx, length in enumerate(lengths):
        nxt = day + timedelta(days=length)
        if day <= today < nxt:
            return {
                "sakaYear": year,
                "month": SAKA_MONTHS[idx],
                "day": (today - day).days + 1,
                "label": f"{SAKA_MONTHS[idx]} {(today - day).days + 1}, {year} Śaka",
            }
        day = nxt
    return {"sakaYear": year, "month": SAKA_MONTHS[11], "day": 30, "label": f"Phalguna 30, {year} Śaka"}


def _due_garden_reminders(crops: list[dict], within_days: int = 7) -> list[dict]:
    today = date.today()
    horizon = today + timedelta(days=within_days)
    due = []
    for crop in crops:
        for reminder in crop.get("reminders") or []:
            if reminder.get("doneAt"):
                continue
            raw = reminder.get("dueDate", "")
            try:
                due_date = date.fromisoformat(raw)
            except (ValueError, TypeError):
                continue
            if today <= due_date <= horizon:
                due.append(
                    {
                        "cropId": crop["id"],
                        "cropName": crop.get("name", ""),
                        "type": reminder.get("type", ""),
                        "dueDate": raw,
                        "daysLeft": (due_date - today).days,
                    }
                )
    due.sort(key=lambda item: item["dueDate"])
    return due


async def _owned_crop(crop_id: str, uid: str) -> dict:
    crop = await get_doc(GARDEN_CROPS, crop_id)
    if crop is None or crop.get("ownerUid") != uid:
        _error(404, "CROP_NOT_FOUND", "crop not found")
    return crop


@router.get("/women/garden-crops")
async def list_garden_crops(uid: str = Depends(_woman)):
    """Her crops with the xlsx growth-stage tracker, seasonal tag, reminders
    and yield log. Reminders due in the next 7 days feed the dashboard."""
    crops = await query(GARDEN_CROPS, [("ownerUid", "==", uid)], limit=500)
    crops.sort(key=lambda c: (c.get("sownOn") or c.get("createdAt", "")))
    return {
        "items": crops,
        "stages": list(GARDEN_STAGES),
        "dueReminders": _due_garden_reminders(crops),
        "calendar": _indian_calendar(date.today()),
    }


@router.post("/women/garden-crops", status_code=201)
async def add_garden_crop(
    body: GardenCropIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_woman),
):
    scope = f"women_hub.garden_crop.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    if body.planId:
        plan = await get_doc(GARDEN_PLANS, body.planId)
        if plan is None:
            _error(404, "GARDEN_PLAN_NOT_FOUND", "garden plan not found")
    crop_id = f"gc_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": crop_id,
        "ownerUid": uid,
        "planId": body.planId,
        "name": body.name,
        "nutrition": body.nutrition,
        "season": body.season,
        "sownOn": body.sownOn or date.today().isoformat(),
        "stage": "sowing",
        "reminders": [],
        "yieldLog": [],
        "createdAt": _now(),
    }
    await set_doc(GARDEN_CROPS, crop_id, doc)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc


@router.post("/women/garden-crops/{crop_id}/stage")
async def advance_crop_stage(crop_id: str, body: GardenStageIn, uid: str = Depends(_woman)):
    crop = await _owned_crop(crop_id, uid)
    current = crop.get("stage", "sowing")
    target = body.stage
    if target not in GARDEN_STAGE_TRANSITIONS.get(current, set()):
        _error(
            409,
            "INVALID_GARDEN_STAGE",
            f"crop cannot move from {current} to {target}",
        )
    crop["stage"] = target
    if target == "harvest" and not crop.get("harvestedOn"):
        crop["harvestedOn"] = date.today().isoformat()
    await set_doc(GARDEN_CROPS, crop_id, crop)
    return crop


@router.post("/women/garden-crops/{crop_id}/reminders", status_code=201)
async def add_crop_reminder(
    crop_id: str, body: GardenReminderIn, uid: str = Depends(_woman)
):
    crop = await _owned_crop(crop_id, uid)
    if body.type not in REMINDER_TYPES:
        _error(422, "INVALID_REMINDER_TYPE", f"type must be one of {REMINDER_TYPES}")
    reminder = {
        "id": f"rem_{uuid.uuid4().hex[:8]}",
        "type": body.type,
        "dueDate": body.dueDate,
        "doneAt": None,
        "createdAt": _now(),
    }
    crop["reminders"] = list(crop.get("reminders") or []) + [reminder]
    await set_doc(GARDEN_CROPS, crop_id, crop)
    return reminder


@router.post("/women/garden-crops/{crop_id}/reminders/{reminder_id}/done")
async def complete_crop_reminder(
    crop_id: str, reminder_id: str, uid: str = Depends(_woman)
):
    crop = await _owned_crop(crop_id, uid)
    reminders = crop.get("reminders") or []
    reminder = next((r for r in reminders if r.get("id") == reminder_id), None)
    if reminder is None:
        _error(404, "REMINDER_NOT_FOUND", "reminder not found")
    reminder["doneAt"] = _now()
    crop["reminders"] = reminders
    await set_doc(GARDEN_CROPS, crop_id, crop)
    return reminder


@router.post("/women/garden-crops/{crop_id}/yield", status_code=201)
async def log_crop_yield(crop_id: str, body: GardenYieldIn, uid: str = Depends(_woman)):
    crop = await _owned_crop(crop_id, uid)
    entry = {
        "date": body.date,
        "quantity": body.quantity,
        "unit": body.unit,
        "loggedAt": _now(),
    }
    crop["yieldLog"] = list(crop.get("yieldLog") or []) + [entry]
    await set_doc(GARDEN_CROPS, crop_id, crop)
    return entry


@router.delete("/women/garden-crops/{crop_id}", status_code=204)
async def delete_garden_crop(crop_id: str, uid: str = Depends(_woman)):
    await _owned_crop(crop_id, uid)
    await delete_doc(GARDEN_CROPS, crop_id)
    return Response(status_code=204)


# =========================================================================
# Part A · Sr 5.0 — Home Enterprise Income
# quantity/price lines + monthly revenue−cost per product + expenses +
# auto monthly total + profit graph + CSV export
# =========================================================================


@router.get("/women/home-enterprise")
async def home_enterprise(uid: str = Depends(_woman)):
    lines = await query(HOME_ENTERPRISES, [("ownerUid", "==", uid)], limit=200)
    lines.sort(key=lambda d: d.get("product", ""))
    return {
        "lines": lines,
        "totalMonthlyProfitPaisa": sum(int(line.get("monthlyProfitPaisa", 0)) for line in lines),
    }


@router.post("/women/home-enterprise", status_code=201)
async def create_enterprise_line(body: EnterpriseIn, uid: str = Depends(_woman)):
    line_id = f"he_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": line_id,
        "ownerUid": uid,
        "product": body.product,
        "monthlyProfitPaisa": body.monthlyProfitPaisa,
        "revenuePaisa": body.revenuePaisa,
        "quantity": body.quantity,
        "pricePaisa": body.pricePaisa,
        "createdAt": _now(),
    }
    await set_doc(HOME_ENTERPRISES, line_id, doc)
    return doc


@router.post("/women/home-enterprise/listings", status_code=201)
async def publish_listing(
    body: UserProductCreate,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    ctx: tuple = Depends(_woman_with_user),
):
    """Publish a home-enterprise product into the marketplace catalog."""
    user, uid = ctx
    scope = f"women_hub.listing.{uid}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    product = await create_listing(user, uid, body)
    product["source"] = "women_enterprise"
    await set_doc("products", product["id"], product)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, product)
    return product


async def _owned_enterprise_line(line_id: str, uid: str) -> dict:
    line = await get_doc(HOME_ENTERPRISES, line_id)
    if line is None or line.get("ownerUid") != uid:
        _error(404, "ENTERPRISE_LINE_NOT_FOUND", "product line not found")
    return line


async def _enterprise_month_doc(line_id: str, month: str) -> dict | None:
    return await get_doc(HOME_ENTERPRISE_MONTHS, f"{line_id}_{month}")


@router.post("/women/home-enterprise/{line_id}/entries", status_code=201)
async def upsert_enterprise_month(
    line_id: str, body: EnterpriseMonthIn, uid: str = Depends(_woman)
):
    """Monthly revenue & cost for one product line — profit = revenue − cost."""
    await _owned_enterprise_line(line_id, uid)
    profit = body.revenuePaisa - body.costPaisa
    doc = {
        "id": f"{line_id}_{body.month}",
        "lineId": line_id,
        "ownerUid": uid,
        "month": body.month,
        "revenuePaisa": body.revenuePaisa,
        "costPaisa": body.costPaisa,
        "profitPaisa": profit,
        "updatedAt": _now(),
    }
    await set_doc(HOME_ENTERPRISE_MONTHS, doc["id"], doc)
    return doc


@router.post("/women/home-enterprise/{line_id}/expenses", status_code=201)
async def add_enterprise_expense(
    line_id: str, body: EnterpriseExpenseIn, uid: str = Depends(_woman)
):
    await _owned_enterprise_line(line_id, uid)
    expense_id = f"exp_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": expense_id,
        "lineId": line_id,
        "ownerUid": uid,
        "month": body.month,
        "note": body.note,
        "amountPaisa": body.amountPaisa,
        "createdAt": _now(),
    }
    await set_doc(HOME_ENTERPRISE_EXPENSES, expense_id, doc)
    return doc


@router.delete("/women/home-enterprise/expenses/{expense_id}", status_code=204)
async def delete_enterprise_expense(expense_id: str, uid: str = Depends(_woman)):
    expense = await get_doc(HOME_ENTERPRISE_EXPENSES, expense_id)
    if expense is None or expense.get("ownerUid") != uid:
        _error(404, "EXPENSE_NOT_FOUND", "expense not found")
    await delete_doc(HOME_ENTERPRISE_EXPENSES, expense_id)
    return Response(status_code=204)


def _ledger_for_month(lines: list[dict], months_docs: list[dict], expenses: list[dict], month: str | None) -> dict:
    month_docs = [m for m in months_docs if month is None or m.get("month") == month]
    month_expenses = [e for e in expenses if month is None or e.get("month") == month]
    per_line = []
    for line in lines:
        doc = next((m for m in month_docs if m.get("lineId") == line["id"]), None)
        line_expenses = [e for e in month_expenses if e.get("lineId") == line["id"]]
        expense_total = sum(int(e.get("amountPaisa", 0)) for e in line_expenses)
        per_line.append(
            {
                "lineId": line["id"],
                "product": line.get("product", ""),
                "quantity": line.get("quantity", ""),
                "pricePaisa": line.get("pricePaisa"),
                "monthlyProfitPaisa": line.get("monthlyProfitPaisa"),
                "revenuePaisa": (doc or {}).get("revenuePaisa"),
                "costPaisa": (doc or {}).get("costPaisa"),
                "profitPaisa": (doc or {}).get("profitPaisa"),
                "expenses": [
                    {
                        "id": e["id"],
                        "note": e.get("note", ""),
                        "amountPaisa": e.get("amountPaisa", 0),
                        "month": e.get("month", ""),
                    }
                    for e in line_expenses
                ],
                "expenseTotalPaisa": expense_total,
            }
        )
    revenue_total = sum(int(m.get("revenuePaisa", 0)) for m in month_docs)
    cost_total = sum(int(m.get("costPaisa", 0)) for m in month_docs)
    expense_total = sum(int(e.get("amountPaisa", 0)) for e in month_expenses)
    return {
        "month": month,
        "lines": per_line,
        "revenueTotalPaisa": revenue_total,
        "costTotalPaisa": cost_total,
        "expenseTotalPaisa": expense_total,
        # xlsx: auto-calculated monthly total profit (revenue − cost − expenses).
        "totalProfitPaisa": revenue_total - cost_total - expense_total,
    }


@router.get("/women/home-enterprise/ledger")
async def enterprise_ledger(
    month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    uid: str = Depends(_woman),
):
    lines = await query(HOME_ENTERPRISES, [("ownerUid", "==", uid)], limit=200)
    months_docs = await query(HOME_ENTERPRISE_MONTHS, [("ownerUid", "==", uid)], limit=500)
    expenses = await query(HOME_ENTERPRISE_EXPENSES, [("ownerUid", "==", uid)], limit=500)
    return _ledger_for_month(lines, months_docs, expenses, month)


@router.get("/women/home-enterprise/graph")
async def enterprise_profit_graph(uid: str = Depends(_woman)):
    """Monthly total-profit series for the profit graph (last 6 months)."""
    lines = await query(HOME_ENTERPRISES, [("ownerUid", "==", uid)], limit=200)
    months_docs = await query(HOME_ENTERPRISE_MONTHS, [("ownerUid", "==", uid)], limit=500)
    expenses = await query(HOME_ENTERPRISE_EXPENSES, [("ownerUid", "==", uid)], limit=500)
    series = []
    for key in _last_months(6):
        ledger = _ledger_for_month(lines, months_docs, expenses, key)
        series.append({"month": key, "totalProfitPaisa": ledger["totalProfitPaisa"]})
    return {"series": series}


@router.get("/women/home-enterprise/export")
async def export_enterprise_ledger(
    month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    uid: str = Depends(_woman),
):
    """Export ledger — CSV download of the monthly income ledger."""
    lines = await query(HOME_ENTERPRISES, [("ownerUid", "==", uid)], limit=200)
    months_docs = await query(HOME_ENTERPRISE_MONTHS, [("ownerUid", "==", uid)], limit=500)
    expenses = await query(HOME_ENTERPRISE_EXPENSES, [("ownerUid", "==", uid)], limit=500)
    ledger = _ledger_for_month(lines, months_docs, expenses, month)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["product", "quantity", "month", "revenue_paisa", "cost_paisa", "profit_paisa", "expenses_paisa"])
    for line in ledger["lines"]:
        writer.writerow(
            [
                line["product"],
                line["quantity"],
                ledger["month"] or "all",
                line.get("revenuePaisa") or 0,
                line.get("costPaisa") or 0,
                line.get("profitPaisa") or 0,
                line["expenseTotalPaisa"],
            ]
        )
    writer.writerow([])
    writer.writerow(
        [
            "TOTAL",
            "",
            ledger["month"] or "all",
            ledger["revenueTotalPaisa"],
            ledger["costTotalPaisa"],
            ledger["totalProfitPaisa"] + ledger["expenseTotalPaisa"],
            ledger["expenseTotalPaisa"],
        ]
    )
    filename = f"enterprise-ledger-{ledger['month'] or 'all'}.csv"
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =========================================================================
# Part A · Sr 1.0 — Dashboard aggregate
# =========================================================================


def _garden_stage_summary(crops: list[dict]) -> dict:
    by_stage: dict[str, int] = {}
    for crop in crops:
        stage = crop.get("stage", "sowing")
        by_stage[stage] = by_stage.get(stage, 0) + 1
    recent = []
    for crop in sorted(crops, key=lambda c: (c.get("sownOn") or c.get("createdAt", "")))[:5]:
        recent.append(
            {
                "id": crop["id"],
                "name": crop.get("name", ""),
                "stage": crop.get("stage", "sowing"),
                "season": crop.get("season", ""),
                "sownOn": crop.get("sownOn", ""),
            }
        )
    return {"byStage": by_stage, "recent": recent}


@router.get("/women/dashboard")
async def women_hub_dashboard(uid: str = Depends(_woman)):
    """xlsx Sr 1.0 — one home screen: garden growth stages, total business,
    enterprise profit total, notifications, Indian calendar, reminders."""
    crops = await query(GARDEN_CROPS, [("ownerUid", "==", uid)], limit=500)
    businesses = await query(BUSINESSES, [("ownerUid", "==", uid)], limit=200)
    enterprise_lines = await query(HOME_ENTERPRISES, [("ownerUid", "==", uid)], limit=200)
    notifications = await query("notifications", [("userId", "==", uid)], limit=50)
    notifications.sort(key=lambda n: n.get("createdAt", ""), reverse=True)
    due_reminders = _due_garden_reminders(crops)
    return {
        "garden": _garden_stage_summary(crops),
        "businesses": {
            "count": len(businesses),
            "activeCount": len([b for b in businesses if b.get("status") == "active"]),
        },
        "enterprise": {
            "totalMonthlyProfitPaisa": sum(
                int(line.get("monthlyProfitPaisa", 0)) for line in enterprise_lines
            ),
            "lineCount": len(enterprise_lines),
        },
        "notifications": {
            "items": [
                {
                    "id": n.get("id"),
                    "title": n.get("title", ""),
                    "body": n.get("body", ""),
                    "type": n.get("type", ""),
                    "read": bool(n.get("read")),
                    "createdAt": n.get("createdAt", ""),
                }
                for n in notifications[:5]
            ]
        },
        "calendar": _indian_calendar(date.today()),
        "reminders": due_reminders,
    }



def _last_months(count: int) -> list[str]:
    """The last `count` 'YYYY-MM' keys, oldest first, in IST."""
    today = datetime.now(timezone.utc).astimezone(IST).date()
    months = []
    month_index = today.year * 12 + today.month - 1
    for offset in range(count - 1, -1, -1):
        idx = month_index - offset
        months.append(f"{idx // 12:04d}-{idx % 12 + 1:02d}")
    return months


