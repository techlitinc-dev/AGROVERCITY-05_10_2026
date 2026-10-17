"""Dairy trade hub (extension-2026-10-12): dairy<->farmer procurement layer.

Public dairy/farmer cards, both dashboards, self ratings, live demand/bid
feeds, standing demand orders with full quality specs (fat/SNF bands, price
bands, calendar windows), dairy receipts with the buyer-side commission rule,
commission structure, and post-acceptance chat rooms.

Every payload is computed from real collections (users, role_profiles,
kyc_cases, dairy_demands, dairy_bids, dairy_collections, dairy_standing_orders,
rate_charts, dairy_stock_items, purchases, ratings, notifications) — no
synthetic/demo fallback anywhere in this module.
"""

import csv
import io
import re
import statistics
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.security import verify_mpin
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/dairy", tags=["dairy"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _address(user: dict) -> dict:
    return {
        "village": user.get("village", ""),
        "tehsil": user.get("tehsil", ""),
        "district": user.get("district", ""),
        "state": user.get("state", ""),
        "pincode": user.get("pincode", ""),
        "addressLine": user.get("addressLine", ""),
    }


async def _manager_ctx(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "dairyManager")
    return user, uid


async def _farmer_ctx(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller")
    return user, uid


async def _fssai_verified(uid: str) -> bool:
    from app.services import kyc as kyc_service

    for case in await kyc_service.cases_for_user(uid):
        for doc in case.get("docs") or []:
            if doc.get("type") in ("fssai",) and doc.get("status") in ("verified", "approved"):
                return True
    return False


async def _party_reviews(uid: str, purchase_key: str, purchase_filter: str) -> dict:
    """Rating aggregate + reviews from real dairy purchases and the
    `dairy_collection` ratings collection."""
    purchases = await query("purchases", [(purchase_filter, "==", uid)], limit=1000)
    reviews = []
    for p in purchases:
        if (p.get("source") or {}).get("type") != "dairy":
            continue
        rating = (p.get("rating") or {}).get(purchase_key)
        if rating:
            reviews.append(
                {
                    "stars": rating.get("rating"),
                    "review": rating.get("review", ""),
                    "at": rating.get("at", ""),
                    "purchaseId": p.get("id"),
                    "product": p.get("variety") or p.get("crop", ""),
                    "fromName": p.get("buyerName") if purchase_filter == "farmerId" else p.get("farmerName"),
                }
            )
    ratings = await query(
        "ratings", [("providerId", "==", uid), ("bookingKind", "==", "dairy_collection")], limit=1000
    )
    for r in ratings:
        reviews.append(
            {
                "stars": r.get("stars"),
                "review": r.get("comment", ""),
                "at": r.get("createdAt", ""),
                "purchaseId": r.get("bookingId"),
                "product": "",
                "fromName": "",
            }
        )
    reviews.sort(key=lambda r: r.get("at") or "", reverse=True)
    stars = [r["stars"] for r in reviews if r.get("stars")]
    return {
        "average": round(sum(stars) / len(stars), 1) if stars else None,
        "count": len(stars),
        "reviews": reviews[:20],
    }


async def _dairy_summary(manager_id: str) -> dict:
    owner = await get_user(manager_id) or {}
    role_profile = await get_doc(f"users/{manager_id}/role_profiles", "dairyManager") or {}
    rating = await _party_reviews(manager_id, "farmerToBuyer", "buyerId")
    return {
        "managerId": manager_id,
        "dairyName": role_profile.get("centerName", ""),
        "ownerName": owner.get("name", ""),
        "district": owner.get("district", ""),
        "state": owner.get("state", ""),
        "verified": await _fssai_verified(manager_id),
        "dailyCapacityLiters": role_profile.get("dailyCapacityLiters", 0),
        "serviceRadiusKm": role_profile.get("serviceRadiusKm", 0),
        "ratingAvg": rating["average"],
        "ratingCount": rating["count"],
    }


async def _farmer_summary(farmer_id: str) -> dict:
    farmer = await get_user(farmer_id) or {}
    rating = await _party_reviews(farmer_id, "buyerToFarmer", "farmerId")
    return {
        "farmerId": farmer_id,
        "name": farmer.get("name", ""),
        "village": farmer.get("village", ""),
        "district": farmer.get("district", ""),
        "ratingAvg": rating["average"],
        "ratingCount": rating["count"],
    }


# ---------------------------------------------------------------------------
# Public cards
# ---------------------------------------------------------------------------


@router.get("/dairies/{manager_id}")
async def dairy_card(manager_id: str, uid: str = Depends(current_user_id)):
    """Public dairy card: dairy name, owner name, address, verified badge
    (FSSAI), service radius, daily/monthly capacity, product names, rating and
    recent farmer reviews — strictly real docs."""
    owner = await get_user(manager_id)
    if owner is None:
        _error(404, "DAIRY_NOT_FOUND", "dairy not found")
    role_profile = await get_doc(f"users/{manager_id}/role_profiles", "dairyManager") or {}
    demands = await query("dairy_demands", [("managerId", "==", manager_id)], limit=500)
    charts = await query("rate_charts", [("centerId", "==", manager_id)], limit=50)
    stock = await query("dairy_stock_items", [("centerId", "==", manager_id)], limit=100)
    purchases = await query("purchases", [("buyerId", "==", manager_id)], limit=1000)
    products = sorted(
        {d.get("milkType", "") for d in demands if d.get("milkType")}
        | {f"{c.get('species')} milk" for c in charts if c.get("species")}
        | {s.get("name", "") for s in stock if s.get("name")}
        | {
            p.get("variety", "") or p.get("crop", "")
            for p in purchases
            if (p.get("source") or {}).get("type") == "dairy"
        }
        - {""}
    )
    daily_capacity = role_profile.get("dailyCapacityLiters", 0)
    rating = await _party_reviews(manager_id, "farmerToBuyer", "buyerId")
    return {
        "managerId": manager_id,
        "dairyName": role_profile.get("centerName", ""),
        "ownerName": owner.get("name", ""),
        "address": _address(owner),
        "verifiedBadge": {"fssaiVerified": await _fssai_verified(manager_id)},
        "serviceRadiusKm": role_profile.get("serviceRadiusKm", 0),
        "capacityPerDayLiters": daily_capacity,
        "capacityPerMonthLiters": round(daily_capacity * 30, 1),
        "products": products,
        "rating": {"average": rating["average"], "count": rating["count"]},
        "recentReviews": rating["reviews"][:5],
    }


@router.get("/farmers/{farmer_id}")
async def farmer_card(farmer_id: str, uid: str = Depends(current_user_id)):
    """Public farmer card in the dairy context: name, address, milk products
    supplied, rating and recent reviews from dairies."""
    farmer = await get_user(farmer_id)
    if farmer is None:
        _error(404, "FARMER_NOT_FOUND", "farmer not found")
    bids = await query("dairy_bids", [("farmerId", "==", farmer_id)], limit=500)
    collections = await query("dairy_collections", [("farmerId", "==", farmer_id)], limit=500)
    products = sorted(
        {b.get("milkType", "") for b in bids if b.get("milkType")}
        | {c.get("milkType", "") for c in collections if c.get("milkType")}
        | set(farmer.get("activeCrops") or [])
        - {""}
    )
    rating = await _party_reviews(farmer_id, "buyerToFarmer", "farmerId")
    return {
        "farmerId": farmer_id,
        "name": farmer.get("name", ""),
        "address": _address(farmer),
        "products": products,
        "rating": {"average": rating["average"], "count": rating["count"]},
        "recentReviews": rating["reviews"][:5],
    }


# ---------------------------------------------------------------------------
# Dashboards
# ---------------------------------------------------------------------------


def _dairy_purchase_view(p: dict) -> dict:
    return {
        "id": p.get("id"),
        "buyerId": p.get("buyerId", ""),
        "buyerName": p.get("buyerName", ""),
        "farmerId": p.get("farmerId", ""),
        "farmerName": p.get("farmerName", ""),
        "product": p.get("variety") or p.get("crop", ""),
        "quantity": p.get("quantity", 0),
        "unit": p.get("unit", "litre"),
        "ratePaisaPerUnit": p.get("agreedPricePerUnit", 0),
        "status": p.get("status", ""),
        "createdAt": p.get("createdAt", ""),
    }


@router.get("/farmer/home")
async def farmer_dairy_home(ctx: tuple = Depends(_farmer_ctx)):
    """Farmer dairy dashboard: today's dairy activity (active dairies, their
    rates and demand), recent dairy sales and the farmer's recent posts
    (bids)."""
    user, uid = ctx
    today = _today()

    daily: dict[str, dict] = {}

    async def _note(manager_id: str, kind: str, detail: str, at: str):
        if not manager_id:
            return
        entry = daily.setdefault(
            manager_id,
            {"managerId": manager_id, "dairyName": "", "activities": []},
        )
        entry["activities"].append({"kind": kind, "detail": detail, "at": at})

    for d in await query("dairy_demands", [], limit=1000):
        if (d.get("createdAt") or "").startswith(today):
            await _note(
                d.get("managerId", ""),
                "demand_posted",
                f"{d.get('dailyQuantityLiters')}L {d.get('milkType')} milk @ ₹{d.get('targetRatePerLiter')}/L",
                d.get("createdAt", ""),
            )
    for b in await query("dairy_bids", [("farmerId", "==", uid)], limit=1000):
        if (b.get("createdAt") or "").startswith(today):
            await _note(b.get("managerId", ""), "bid_sent", f"bid ₹{b.get('offeredRatePerLiter')}/L x {b.get('dailyLiters')}L", b.get("createdAt", ""))
        if b.get("status") == "accepted" and (b.get("acceptedAt") or "").startswith(today):
            await _note(b.get("managerId", ""), "request_accepted", f"accepted @ ₹{b.get('offeredRatePerLiter')}/L", b.get("acceptedAt", ""))
    for c in await query("dairy_collections", [("farmerId", "==", uid)], limit=1000):
        if (c.get("collectedAt") or "").startswith(today):
            await _note(c.get("managerId", ""), "collected", f"{c.get('quantityLiters')}L @ ₹{c.get('ratePerLiter')}/L", c.get("collectedAt", ""))

    daily_list = []
    for entry in daily.values():
        summary = await _dairy_summary(entry["managerId"])
        entry["dairyName"] = summary["dairyName"]
        entry["verified"] = summary["verified"]
        entry["activities"].sort(key=lambda a: a["at"], reverse=True)
        daily_list.append(entry)
    daily_list.sort(key=lambda e: e["activities"][0]["at"], reverse=True)

    # today's rates: every active rate chart, dairy by dairy
    rates = []
    for chart in await query("rate_charts", [], limit=1000):
        if not chart.get("active"):
            continue
        summary = await _dairy_summary(chart.get("centerId", ""))
        rates.append(
            {
                "managerId": chart.get("centerId"),
                "dairyName": summary["dairyName"],
                "species": chart.get("species", ""),
                "baseRate": chart.get("baseRate", 0),
                "effectiveFrom": chart.get("effectiveFrom", ""),
            }
        )

    purchases = await query("purchases", [("farmerId", "==", uid)], limit=1000)
    dairy_purchases = [p for p in purchases if (p.get("source") or {}).get("type") == "dairy"]
    dairy_purchases.sort(key=lambda p: p.get("createdAt", ""), reverse=True)
    bids = await query("dairy_bids", [("farmerId", "==", uid)], limit=1000)
    bids.sort(key=lambda b: b.get("createdAt", ""), reverse=True)
    live_demands = await query("dairy_demands", [("status", "==", "active")], limit=1000)
    unread = len(
        [n for n in await query("notifications", [("userId", "==", uid)], limit=1000) if not n.get("read")]
    )
    return {
        "dailyDairies": daily_list,
        "todaysRates": rates,
        "recentPurchases": [_dairy_purchase_view(p) for p in dairy_purchases[:5]],
        "recentPosts": [
            {
                "id": b.get("id"),
                "managerId": b.get("managerId"),
                "milkType": b.get("milkType", ""),
                "offeredRatePerLiter": b.get("offeredRatePerLiter", 0),
                "dailyLiters": b.get("dailyLiters", 0),
                "status": b.get("status", ""),
                "createdAt": b.get("createdAt", ""),
            }
            for b in bids[:5]
        ],
        "stats": {
            "liveDemands": len(live_demands),
            "myLiveBids": sum(1 for b in bids if b.get("status") in ("pending", "countered")),
            "todayLitersCollected": round(
                sum(
                    float(c.get("quantityLiters", 0))
                    for c in await query("dairy_collections", [("farmerId", "==", uid)], limit=1000)
                    if (c.get("collectedAt") or "").startswith(today)
                ),
                1,
            ),
            "unreadNotifications": unread,
        },
    }


@router.get("/dashboard")
async def dairy_dashboard(ctx: tuple = Depends(_manager_ctx)):
    """Dairy dashboard: today's live demands, recent procurement purchases,
    standing orders and key stats."""
    user, uid = ctx
    today = _today()
    demands = await query("dairy_demands", [("managerId", "==", uid)], limit=500)
    active = [d for d in demands if d.get("status") == "active"]
    todays_live = sorted(
        [d for d in active if (d.get("createdAt") or "").startswith(today)],
        key=lambda d: d.get("createdAt", ""),
        reverse=True,
    )
    purchases = await query("purchases", [("buyerId", "==", uid)], limit=1000)
    dairy_purchases = [p for p in purchases if (p.get("source") or {}).get("type") == "dairy"]
    dairy_purchases.sort(key=lambda p: p.get("createdAt", ""), reverse=True)
    standing = await query("dairy_standing_orders", [("managerId", "==", uid)], limit=500)
    bids = await query("dairy_bids", [("managerId", "==", uid)], limit=1000)
    live_bids = [b for b in bids if b.get("status") in ("pending", "countered")]
    collections = await query("dairy_collections", [("managerId", "==", uid)], limit=1000)
    unread = len(
        [n for n in await query("notifications", [("userId", "==", uid)], limit=1000) if not n.get("read")]
    )
    return {
        "todaysLiveDemands": todays_live,
        "recentPurchases": [_dairy_purchase_view(p) for p in dairy_purchases[:5]],
        "standingOrders": {
            "active": sum(1 for s in standing if s.get("status") == "open"),
            "data": sorted(
                [s for s in standing if s.get("status") == "open"],
                key=lambda s: s.get("createdAt", ""),
                reverse=True,
            )[:5],
        },
        "liveBids": live_bids[:10],
        "stats": {
            "activeDemands": len(active),
            "liveBids": len(live_bids),
            "todayLitersCollected": round(
                sum(
                    float(c.get("quantityLiters", 0))
                    for c in collections
                    if (c.get("collectedAt") or "").startswith(today)
                ),
                1,
            ),
            "unreadNotifications": unread,
        },
    }


# ---------------------------------------------------------------------------
# Self ratings
# ---------------------------------------------------------------------------


@router.get("/farmer/ratings")
async def farmer_dairy_ratings(ctx: tuple = Depends(_farmer_ctx)):
    """The farmer's own rating and reviews inside the dairy module."""
    user, uid = ctx
    rating = await _party_reviews(uid, "buyerToFarmer", "farmerId")
    return {"farmerId": uid, **rating}


@router.get("/ratings")
async def dairy_ratings(ctx: tuple = Depends(_manager_ctx)):
    """The dairy's own rating and reviews from supplying farmers."""
    user, uid = ctx
    rating = await _party_reviews(uid, "farmerToBuyer", "buyerId")
    return {"managerId": uid, **rating}


# ---------------------------------------------------------------------------
# Live feeds
# ---------------------------------------------------------------------------


@router.get("/demands/browse")
async def browse_dairy_demands(
    milkType: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    """Every active dairy demand (procurement post) live, enriched with the
    dairy card summary — farmers watch all dairy posts/demands live."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    docs = await query("dairy_demands", [("status", "==", "active")], limit=1000)
    if milkType:
        docs = [d for d in docs if d.get("milkType", "").lower() == milkType.lower()]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    data = []
    for d in docs[start:start + pageSize]:
        bids = await query("dairy_bids", [("rfqId", "==", d.get("id"))], limit=100)
        data.append(
            {
                **d,
                "bidsCount": len([b for b in bids if b.get("status") in ("pending", "countered")]),
                "dairySummary": await _dairy_summary(d.get("managerId", "")),
            }
        )
    return {"data": data, "page": page, "pageSize": pageSize, "total": total}


@router.get("/bids/browse")
async def browse_farmer_bids(
    milkType: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    ctx: tuple = Depends(_manager_ctx),
):
    """All live farmer posts (bids) — dairies discover every farmer offering
    milk, enriched with the farmer summary."""
    user, uid = ctx
    docs = await query("dairy_bids", [], limit=1000)
    docs = [b for b in docs if b.get("status") in ("pending", "countered")]
    if milkType:
        docs = [b for b in docs if b.get("milkType", "").lower() == milkType.lower()]
    docs.sort(key=lambda b: b.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    data = [
        {**b, "farmerSummary": await _farmer_summary(b.get("farmerId", ""))}
        for b in docs[start:start + pageSize]
    ]
    return {"data": data, "page": page, "pageSize": pageSize, "total": total}


# ---------------------------------------------------------------------------
# Standing demand orders (full specs)
# ---------------------------------------------------------------------------


class DairyStandingOrderIn(BaseModel):
    milkType: str = "Buffalo"
    minFatPercent: float = Field(ge=2.0, le=12.0)
    minSnfPercent: float = Field(ge=5.0, le=12.0)
    quantityPerSlotLiters: float = Field(gt=0)
    frequency: str = "daily"  # daily | weekly | monthly
    minRatePerLiter: float = Field(ge=0)
    maxRatePerLiter: float = Field(gt=0)
    startDate: str  # YYYY-MM-DD
    endDate: str  # YYYY-MM-DD
    procurementZone: str = ""
    pickupSlot: str = ""
    notes: str = ""


class DairyStandingOrderUpdateIn(BaseModel):
    milkType: str | None = None
    minFatPercent: float | None = Field(default=None, ge=2.0, le=12.0)
    minSnfPercent: float | None = Field(default=None, ge=5.0, le=12.0)
    quantityPerSlotLiters: float | None = Field(default=None, gt=0)
    frequency: str | None = None
    minRatePerLiter: float | None = Field(default=None, ge=0)
    maxRatePerLiter: float | None = Field(default=None, gt=0)
    startDate: str | None = None
    endDate: str | None = None
    procurementZone: str | None = None
    pickupSlot: str | None = None
    notes: str | None = None


def _validate_standing_window(body, doc: dict | None = None):
    candidate = dict(doc or {})
    for key in ("startDate", "endDate"):
        value = getattr(body, key, None)
        if value is not None:
            candidate[key] = value
    try:
        start = datetime.strptime(candidate.get("startDate", ""), "%Y-%m-%d").date()
        end = datetime.strptime(candidate.get("endDate", ""), "%Y-%m-%d").date()
    except ValueError:
        _error(422, "VALIDATION_ERROR", "invalid date", {"dates": "startDate and endDate must be YYYY-MM-DD"})
    if end < start:
        _error(422, "INVALID_DATE_RANGE", "endDate must be on or after startDate")


@router.post("/standing-orders", status_code=201)
async def create_dairy_standing_order(body: DairyStandingOrderIn, ctx: tuple = Depends(_manager_ctx)):
    """Standing demand order with full quality specs — e.g. '500L buffalo milk,
    fat ≥6%, SNF ≥9%, daily, ₹62–68/L, 2026-11-01 → 2026-12-31'."""
    user, uid = ctx
    _validate_standing_window(body)
    if body.minRatePerLiter > body.maxRatePerLiter:
        _error(422, "INVALID_PRICE_BAND", "minRatePerLiter must not exceed maxRatePerLiter")
    now = _now()
    doc = {
        **body.model_dump(),
        "id": f"dso_{uuid.uuid4().hex[:12]}",
        "managerId": uid,
        "managerName": user.get("name", ""),
        "status": "open",
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("dairy_standing_orders", doc["id"], doc)
    return doc


@router.get("/standing-orders")
async def list_dairy_standing_orders(status: str | None = None, ctx: tuple = Depends(_manager_ctx)):
    user, uid = ctx
    docs = await query("dairy_standing_orders", [("managerId", "==", uid)], limit=500)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


async def _own_standing_order(order_id: str, uid: str) -> dict:
    doc = await get_doc("dairy_standing_orders", order_id)
    if doc is None or doc.get("managerId") != uid:
        _error(404, "STANDING_ORDER_NOT_FOUND", "standing order not found")
    return doc


@router.put("/standing-orders/{order_id}")
async def update_dairy_standing_order(
    order_id: str, body: DairyStandingOrderUpdateIn, ctx: tuple = Depends(_manager_ctx)
):
    user, uid = ctx
    doc = await _own_standing_order(order_id, uid)
    if doc.get("status") != "open":
        _error(409, "STANDING_ORDER_CLOSED", "only open standing orders can be edited")
    _validate_standing_window(body, doc)
    merged = {**doc, **body.model_dump(exclude_none=True)}
    if merged.get("minRatePerLiter", 0) > merged.get("maxRatePerLiter", 0):
        _error(422, "INVALID_PRICE_BAND", "minRatePerLiter must not exceed maxRatePerLiter")
    doc.update(body.model_dump(exclude_none=True))
    doc["updatedAt"] = _now()
    await set_doc("dairy_standing_orders", order_id, doc)
    return doc


@router.post("/standing-orders/{order_id}/close")
async def close_dairy_standing_order(order_id: str, ctx: tuple = Depends(_manager_ctx)):
    user, uid = ctx
    doc = await _own_standing_order(order_id, uid)
    if doc.get("status") == "closed":
        return doc
    doc["status"] = "closed"
    doc["updatedAt"] = _now()
    await set_doc("dairy_standing_orders", order_id, doc)
    return doc


@router.get("/standing/browse")
async def browse_dairy_standing_orders(
    milkType: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    """Live public feed of open standing orders (full specs + price band +
    calendar window) with the dairy summary."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    docs = await query("dairy_standing_orders", [("status", "==", "open")], limit=1000)
    if milkType:
        docs = [d for d in docs if d.get("milkType", "").lower() == milkType.lower()]
    docs = [d for d in docs if (d.get("endDate") or "") >= _today()]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    data = [
        {**d, "dairySummary": await _dairy_summary(d.get("managerId", ""))}
        for d in docs[start:start + pageSize]
    ]
    return {"data": data, "page": page, "pageSize": pageSize, "total": total}


# ---------------------------------------------------------------------------
# Receipts & commission rule
# ---------------------------------------------------------------------------

DAIRY_CATEGORY_PCT = {"produce": 5, "livestock": 2}  # everything else (milk) = 3


async def _dairy_commission_purchase(purchase: dict) -> tuple[float, float]:
    """(percent, commission in trade units) for a dairy purchase — prefers the
    issued invoice line, else the category rule the invoice engine uses."""
    line = purchase.get("commissionLine") or {}
    trade = purchase.get("finalAmount") or purchase.get("totalAmount") or 0
    if line.get("ratePercent"):
        return float(line["ratePercent"]), float(purchase.get("commissionAmount") or 0)
    category = (
        purchase.get("category")
        or ((purchase.get("source") or {}).get("category"))
        or "milk"
    ).lower()
    pct = float(DAIRY_CATEGORY_PCT.get(category, 3))
    return pct, round(trade * pct / 100, 2)


@router.get("/purchases/{purchase_id}/receipt")
async def dairy_purchase_receipt(purchase_id: str, uid: str = Depends(current_user_id)):
    """Customer receipt for a dairy trade: calendar date, product info, milk
    quantity, dairy rate per liter, amounts, and the platform commission
    charged on the dairy side (never from the farmer)."""
    purchase = await get_doc("purchases", purchase_id)
    if purchase is None or (purchase.get("source") or {}).get("type") != "dairy":
        _error(404, "PURCHASE_NOT_FOUND", "dairy purchase not found")
    if uid not in (purchase.get("buyerId"), purchase.get("farmerId")) and not (await get_user(uid) or {}).get("isAdmin"):
        _error(403, "FORBIDDEN", "not a purchase participant")
    if purchase.get("status") == "cancelled":
        _error(409, "PURCHASE_CANCELLED", "cancelled purchases have no receipt")
    pct, commission = await _dairy_commission_purchase(purchase)
    trade_paisa = purchase.get("finalAmount") or purchase.get("totalAmount") or 0
    paid_paisa = sum(p.get("amount", 0) for p in purchase.get("payments") or [])
    pickup = purchase.get("pickup") or {}
    buyer = await get_user(purchase.get("buyerId", "")) or {}
    farmer = await get_user(purchase.get("farmerId", "")) or {}
    ym = datetime.now(timezone.utc).strftime("%y%m")
    return {
        "receiptNo": f"DRC-{purchase['id'][-8:].upper()}-{ym}",
        "purchaseId": purchase_id,
        "issuedAt": _now(),
        "tradeDate": (purchase.get("createdAt") or "")[:10],
        "deliveryDate": pickup.get("date", ""),
        "status": purchase.get("status", ""),
        "product": {
            "name": purchase.get("variety") or purchase.get("crop", "Milk"),
            "quantity": purchase.get("quantity", 0),
            "unit": purchase.get("unit", "litre"),
        },
        "dairyRatePaisaPerLiter": purchase.get("agreedPricePerUnit", 0),
        "dairyRateRupeesPerLiter": round((purchase.get("agreedPricePerUnit") or 0) / 100, 2),
        "amounts": {
            "tradeTotalRupees": round(trade_paisa / 100, 2),
            "paidRupees": round(paid_paisa / 100, 2),
            "dueRupees": round((trade_paisa - paid_paisa) / 100, 2),
        },
        "commission": {
            "percent": pct,
            "amountRupees": round(commission / 100, 2),
            "chargedFrom": "dairy",
            "farmerPayoutRupees": round((trade_paisa - commission) / 100, 2),
        },
        "dairy": {"id": purchase.get("buyerId", ""), "name": buyer.get("name", "")},
        "farmer": {"id": purchase.get("farmerId", ""), "name": farmer.get("name", "")},
        "payments": purchase.get("payments") or [],
    }


@router.get("/commission-structure")
async def dairy_commission_structure(uid: str = Depends(current_user_id)):
    """Dairy trade commission rule: charged from the dairy (buyer) side by
    category — the farmer always receives the full agreed amount."""
    return {
        "trade": "dairy",
        "categoryRatesPercent": {"milk": 3, "produce": 5, "livestock": 2},
        "chargedFrom": "dairy",
        "farmerSidePercent": 0,
        "notes": "Platform commission is charged on the dairy side of milk "
        "procurement; the farmer payout is never reduced by commission.",
    }


@router.get("/purchases/{purchase_id}/chat-room")
async def dairy_purchase_chat_room(purchase_id: str, uid: str = Depends(current_user_id)):
    """The in-app chat thread of a confirmed dairy trade. The window opens only
    after the bid/request is accepted (the purchase exists solely because of
    acceptance); cancelled deals lose chat access."""
    purchase = await get_doc("purchases", purchase_id)
    if purchase is None or (purchase.get("source") or {}).get("type") != "dairy":
        _error(404, "PURCHASE_NOT_FOUND", "dairy purchase not found")
    if uid not in (purchase.get("buyerId"), purchase.get("farmerId")):
        _error(403, "FORBIDDEN", "not a purchase participant")
    if purchase.get("status") == "cancelled":
        _error(409, "CHAT_NOT_AVAILABLE", "chat is closed for cancelled deals")
    from app.services.chat import ensure_chat_room

    room = await ensure_chat_room(purchase)
    return {"purchaseId": purchase_id, "roomId": room["id"], "room": room}


# ---------------------------------------------------------------------------
# Farm-gate collection farmer OTP reveal (F10/M6/E12, P0-7)
# ---------------------------------------------------------------------------


@router.get("/collections/{collection_id}/otp")
async def reveal_collection_otp(collection_id: str, uid: str = Depends(current_user_id)):
    """Farmer-side reveal: the farmer reads the collection OTP from their own
    app. Only the farmer of the collection can view it, and only while a fresh
    OTP exists (manager triggered it via POST /v1/dairy-manager/collections/otp/send)."""
    collection = await get_doc("dairy_collections", collection_id)
    if collection is None:
        _error(404, "COLLECTION_NOT_FOUND", "collection not found")
    if collection.get("farmerId") != uid:
        _error(403, "FORBIDDEN", "only the farmer of this collection can view the OTP")
    if not collection.get("farmerOtp") or not collection.get("farmerOtpExpiresAt"):
        _error(404, "OTP_NOT_FOUND", "no OTP was generated for this collection")
    try:
        fresh = datetime.now(timezone.utc) < datetime.fromisoformat(collection["farmerOtpExpiresAt"])
    except ValueError:
        fresh = False
    if not fresh:
        _error(409, "OTP_EXPIRED", "the collection OTP has expired — ask the manager to resend")
    return {
        "collectionId": collection_id,
        "otp": collection["farmerOtp"],
        "expiresAt": collection["farmerOtpExpiresAt"],
        "verifiedAt": collection.get("farmerOtpVerifiedAt"),
    }


# ---------------------------------------------------------------------------
# Booking contract & MPIN e-sign (F8/S10, P1-14)
# ---------------------------------------------------------------------------


class ContractEsignIn(BaseModel):
    mpin: str = Field(min_length=1)
    signatureData: str = ""
    consentTimestamp: str = ""


def _contract_term_sheet(purchase: dict) -> dict:
    """Auto-generated booking term sheet (F8/S10) computed from the purchase."""
    trade = purchase.get("finalAmount") or purchase.get("totalAmount") or 0
    pickup = purchase.get("pickup") or {}
    return {
        "product": purchase.get("variety") or purchase.get("crop", "Milk"),
        "quantity": purchase.get("quantity", 0),
        "unit": purchase.get("unit", "litre"),
        "ratePaisaPerUnit": purchase.get("agreedPricePerUnit", 0),
        "totalAmountPaisa": trade,
        "deliveryDate": pickup.get("date", ""),
        "terms": (
            "Auto-generated booking term sheet: quantity and rate as above; "
            "quality check at pickup anchors payment; the platform commission is "
            "charged on the dairy side only; escrow releases on farmer "
            "verification (OTP or QR) of the collection."
        ),
    }


@router.post("/purchases/{purchase_id}/contract/esign")
async def esign_purchase_contract(purchase_id: str, body: ContractEsignIn, uid: str = Depends(current_user_id)):
    """MPIN e-sign of the booking contract by either party. Acceptances are
    stored per uid under `purchases/{id}/acceptances`; when both the dairy and
    the farmer have signed, `contractStatus` flips to signed on the purchase."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    purchase = await get_doc("purchases", purchase_id)
    if purchase is None or (purchase.get("source") or {}).get("type") != "dairy":
        _error(404, "PURCHASE_NOT_FOUND", "dairy purchase not found")
    if uid not in (purchase.get("buyerId"), purchase.get("farmerId")):
        _error(403, "FORBIDDEN", "only the dairy or the farmer can sign this contract")
    if user.get("mpinHash") is None:
        _error(409, "MPIN_NOT_SET", "MPIN is not set for this account")
    if not verify_mpin(body.mpin, user["mpinHash"]):
        _error(401, "WRONG_MPIN", "incorrect MPIN")
    now = _now()
    acceptance = {
        "userId": uid,
        "signatureData": body.signatureData,
        "consentTimestamp": body.consentTimestamp,
        "acceptedAt": now,
    }
    await set_doc(f"purchases/{purchase_id}/acceptances", uid, acceptance)
    acceptances = await query(f"purchases/{purchase_id}/acceptances", None, limit=10)
    signed_by = {a.get("userId") for a in acceptances if a.get("userId")}
    contract_status = purchase.get("contractStatus") or "pending"
    if purchase.get("buyerId") in signed_by and purchase.get("farmerId") in signed_by:
        contract_status = "signed"
        purchase["contractStatus"] = "signed"
        purchase["contractSignedAt"] = now
        purchase["updatedAt"] = now
        await set_doc("purchases", purchase_id, purchase)
    return {
        "purchaseId": purchase_id,
        "acceptance": acceptance,
        "contractStatus": contract_status,
        "signedBy": sorted(signed_by),
        "termSheet": _contract_term_sheet(purchase),
    }


# ---------------------------------------------------------------------------
# Commission payout statement (M14, P2-12)
# ---------------------------------------------------------------------------

_COMMISSION_CSV_FIELDS = [
    "purchaseId",
    "date",
    "buyerName",
    "farmerName",
    "product",
    "quantity",
    "unit",
    "tradeAmountPaisa",
    "commissionPercent",
    "commissionPaisa",
    "farmerPayoutPaisa",
]


@router.get("/commission-statements")
async def commission_statements(
    month: str,
    format: str | None = None,
    uid: str = Depends(current_user_id),
):
    """Monthly commission statement: one row per dairy purchase of the month
    with the buyer-side commission, plus totals. `?format=csv` returns
    text/csv. Managers see purchases they bought; farmers see their own sales."""
    match = re.fullmatch(r"(\d{4})-(\d{2})", month or "")
    if not match or not 1 <= int(match.group(2)) <= 12:
        _error(422, "VALIDATION_ERROR", "month must be YYYY-MM", {"month": "must be YYYY-MM"})
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "dairyManager", "farmer", "seller")
    purchases = await query("purchases", [], limit=2000)
    mine = [
        p
        for p in purchases
        if (p.get("source") or {}).get("type") == "dairy"
        and (p.get("createdAt") or "")[:7] == month
        and uid in (p.get("buyerId"), p.get("farmerId"))
    ]
    mine.sort(key=lambda p: p.get("createdAt", ""))
    rows = []
    for p in mine:
        pct, commission_paisa = await _dairy_commission_purchase(p)
        trade_paisa = p.get("finalAmount") or p.get("totalAmount") or 0
        commission_paisa = int(round(commission_paisa))
        rows.append(
            {
                "purchaseId": p.get("id"),
                "date": (p.get("createdAt") or "")[:10],
                "buyerName": p.get("buyerName", ""),
                "farmerName": p.get("farmerName", ""),
                "product": p.get("variety") or p.get("crop", ""),
                "quantity": p.get("quantity", 0),
                "unit": p.get("unit", "litre"),
                "tradeAmountPaisa": trade_paisa,
                "commissionPercent": pct,
                "commissionPaisa": commission_paisa,
                "farmerPayoutPaisa": trade_paisa - commission_paisa,
            }
        )
    totals = {
        "tradeAmountPaisa": sum(r["tradeAmountPaisa"] for r in rows),
        "commissionPaisa": sum(r["commissionPaisa"] for r in rows),
        "farmerPayoutPaisa": sum(r["farmerPayoutPaisa"] for r in rows),
        "count": len(rows),
    }
    if format == "csv":
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=_COMMISSION_CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="commission-statement-{month}.csv"'},
        )
    return {"month": month, "rows": rows, "totals": totals}


# ---------------------------------------------------------------------------
# Farmer reliability score (M10, P2-13)
# ---------------------------------------------------------------------------

_RELIABILITY_FORMULA = (
    "reliabilityScore = round(0.5 * showUpRate + 0.3 * gradeConsistency + 0.2 * disputeScore); "
    "showUpRate = 100 * completedCollections / max(1, completedCollections + noShows) "
    "(100.0 when the farmer has no collection history); "
    "gradeConsistency = max(0, 100 - 25 * (stdDev(fatPercent) + stdDev(snfPercent))) "
    "across completed collections (0.0 deviation when fewer than 2 readings); "
    "disputeScore = max(0, 100 - 25 * disputeCount)."
)


@router.get("/farmers/{farmer_id}/reliability")
async def farmer_reliability(farmer_id: str, uid: str = Depends(current_user_id)):
    """Internal reliability score for a supplying farmer: show-up rate, grade
    consistency (FAT/SNF variance) and dispute count, rolled into a single
    deterministic 0-100 score. Visible to dairy managers and to the farmer
    themself. A collection doc with `noShow: true` records a scheduled pickup
    the farmer missed."""
    if farmer_id != uid:
        user = await get_user(uid)
        if user is None:
            _error(404, "NOT_FOUND", "user not found")
        require_role(user, "dairyManager")
    farmer = await get_user(farmer_id)
    if farmer is None:
        _error(404, "FARMER_NOT_FOUND", "farmer not found")

    collections = await query("dairy_collections", [("farmerId", "==", farmer_id)], limit=1000)
    completed = [
        c
        for c in collections
        if not c.get("noShow") and c.get("qualityStatus", "accepted") in ("accepted", "regraded")
    ]
    no_shows = [c for c in collections if c.get("noShow")]
    scheduled = len(completed) + len(no_shows)
    show_up_rate = round(100.0 * len(completed) / scheduled, 1) if scheduled else 100.0

    fat_readings = [float(c["fatPercent"]) for c in completed if c.get("fatPercent") is not None]
    snf_readings = [float(c["snfPercent"]) for c in completed if c.get("snfPercent") is not None]
    fat_std = round(statistics.pstdev(fat_readings), 2) if len(fat_readings) >= 2 else 0.0
    snf_std = round(statistics.pstdev(snf_readings), 2) if len(snf_readings) >= 2 else 0.0
    grade_consistency = round(max(0.0, 100.0 - 25.0 * (fat_std + snf_std)), 1)

    purchases = await query("purchases", [("farmerId", "==", farmer_id)], limit=1000)
    dairy_purchase_ids = {
        p.get("id") for p in purchases if (p.get("source") or {}).get("type") == "dairy"
    }
    disputes = 0
    if dairy_purchase_ids:
        for d in await query("disputes", [("source", "==", "purchase")], limit=2000):
            if d.get("sourceId") in dairy_purchase_ids:
                disputes += 1
    dispute_score = max(0, 100 - 25 * disputes)

    overall = round(0.5 * show_up_rate + 0.3 * grade_consistency + 0.2 * dispute_score, 1)
    overall = max(0.0, min(100.0, overall))
    return {
        "farmerId": farmer_id,
        "reliabilityScore": overall,
        "components": {
            "showUpRatePercent": show_up_rate,
            "gradeConsistencyPercent": grade_consistency,
            "disputeCount": disputes,
            "disputeScorePercent": dispute_score,
            "fatStdDev": fat_std,
            "snfStdDev": snf_std,
            "completedCollections": len(completed),
            "noShows": len(no_shows),
            "scheduledCollections": scheduled,
        },
        "formula": _RELIABILITY_FORMULA,
    }
