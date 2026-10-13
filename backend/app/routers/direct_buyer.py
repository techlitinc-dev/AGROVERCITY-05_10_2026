import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.direct import SavedFarmerIn, StandingOrderCreate, StandingOrderUpdate
from app.routers.analytics import last_12_months, month_key
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/direct-buyer", tags=["direct-buyer"])

NON_TERMINAL = ("pending", "countered")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _direct_buyer(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "directBuyer", "seller")
    return user, uid


def _billable(purchase: dict) -> int:
    return purchase.get("finalAmount") or purchase.get("totalAmount") or 0


def _paid(purchase: dict) -> int:
    return sum(p.get("amount", 0) for p in purchase.get("payments") or [])


def _mandi_modal(crop: str, mandi_docs: list[dict]) -> int | None:
    matches = [d for d in mandi_docs if crop.lower() in d.get("commodity", "").lower()]
    if not matches:
        return None
    return round(sum(d.get("modalPrice", 0) for d in matches) / len(matches))


@router.get("/profile")
async def buyer_profile(ctx: tuple = Depends(_direct_buyer)):
    user, uid = ctx
    purchases = await query("purchases", [("buyerId", "==", uid)], limit=1000)
    demands = await query("demands", [("buyerId", "==", uid), ("status", "==", "open")], limit=500)
    role_profile = await get_doc(f"users/{uid}/role_profiles", "directBuyer") or {}
    stats = {
        "totalPurchases": len(purchases),
        "totalSpend": sum(_billable(p) for p in purchases if p.get("status") != "cancelled"),
        "completedPurchases": sum(1 for p in purchases if p.get("status") == "completed"),
        "activeDemands": len(demands),
    }
    return {**user, "roleProfile": role_profile, "stats": stats}


@router.get("/analytics")
async def buyer_analytics(ctx: tuple = Depends(_direct_buyer)):
    user, uid = ctx
    purchases = await query("purchases", [("buyerId", "==", uid)], limit=1000)
    live = [p for p in purchases if p.get("status") != "cancelled"]
    demands = await query("demands", [("buyerId", "==", uid), ("status", "==", "open")], limit=500)
    sent_offers = await query("offers", [("fromId", "==", uid)], limit=1000)
    by_status: dict[str, int] = {}
    months = {m: {"spend": 0, "volume": 0.0} for m in last_12_months()}
    crops: dict[str, dict] = {}
    suppliers: dict[str, dict] = {}
    qc_rejected = 0.0
    qc_total = 0.0
    for p in live:
        status = p.get("status", "unknown")
        by_status[status] = by_status.get(status, 0) + 1
        amount = _billable(p)
        key = month_key(p.get("createdAt"))
        if key in months:
            months[key]["spend"] += amount
            months[key]["volume"] += p.get("quantity") or 0
        crop = p.get("crop", "unknown")
        entry = crops.setdefault(crop, {"crop": crop, "spend": 0, "volume": 0.0})
        entry["spend"] += amount
        entry["volume"] += p.get("quantity") or 0
        farmer = suppliers.setdefault(
            p.get("farmerId", "unknown"),
            {"farmerId": p.get("farmerId", ""), "farmerName": p.get("farmerName", ""), "spend": 0, "purchases": 0},
        )
        farmer["spend"] += amount
        farmer["purchases"] += 1
        if p.get("qc"):
            qc_rejected += p["qc"].get("rejectedQty") or 0
            qc_total += (p["qc"].get("acceptedQty") or 0) + (p["qc"].get("rejectedQty") or 0)
    crop_breakdown = sorted(crops.values(), key=lambda c: c["spend"], reverse=True)
    for entry in crop_breakdown:
        entry["avgPrice"] = round(entry["spend"] / entry["volume"], 2) if entry["volume"] else 0
    top_suppliers = sorted(suppliers.values(), key=lambda s: s["spend"], reverse=True)[:5]
    mandi_docs = await query("mandi_prices", [], limit=1000)
    price_vs_mandi = [
        {
            "crop": entry["crop"],
            "avgPurchasePrice": entry["avgPrice"],
            "mandiModalPrice": _mandi_modal(entry["crop"], mandi_docs),
        }
        for entry in crop_breakdown
    ]
    completed = by_status.get("completed", 0)
    return {
        "totalSpend": sum(_billable(p) for p in live),
        "totalVolume": round(sum(p.get("quantity") or 0 for p in live), 3),
        "activeDemands": len(demands),
        "openOffers": sum(1 for o in sent_offers if o.get("status") in NON_TERMINAL),
        "purchasesByStatus": by_status,
        "monthlyProcurement": [
            {"month": m, "spend": v["spend"], "volume": round(v["volume"], 3)} for m, v in months.items()
        ],
        "cropBreakdown": crop_breakdown,
        "topSuppliers": top_suppliers,
        "avgPriceVsMandi": price_vs_mandi,
        "qcRejectionRate": round(qc_rejected / qc_total, 4) if qc_total else 0,
        "completionRate": round(completed / len(live), 4) if live else 0,
        "pendingBalance": sum(_billable(p) - _paid(p) for p in live),
    }


@router.post("/saved-farmers", status_code=201)
async def save_farmer(body: SavedFarmerIn, ctx: tuple = Depends(_direct_buyer)):
    user, uid = ctx
    farmer = await get_doc("users", body.farmerId)
    if farmer is None:
        _error(404, "FARMER_NOT_FOUND", "farmer not found")
    doc = {
        "farmerId": body.farmerId,
        "farmerName": farmer.get("name", ""),
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"users/{uid}/saved_farmers", body.farmerId, doc)
    return doc


@router.get("/saved-farmers")
async def list_saved_farmers(ctx: tuple = Depends(_direct_buyer)):
    user, uid = ctx
    saved = await query(f"users/{uid}/saved_farmers", [], limit=500)
    purchases = await query("purchases", [], limit=1000)
    ratings: dict[str, list] = {}
    for p in purchases:
        rating = (p.get("rating") or {}).get("buyerToFarmer")
        if rating:
            ratings.setdefault(p.get("farmerId", ""), []).append(rating["rating"])
    data = []
    for doc in saved:
        farmer = await get_doc("users", doc["farmerId"]) or {}
        scores = ratings.get(doc["farmerId"], [])
        data.append(
            {
                "farmerId": doc["farmerId"],
                "farmerName": farmer.get("name", doc.get("farmerName", "")),
                "village": farmer.get("village", ""),
                "district": farmer.get("district", ""),
                "rating": round(sum(scores) / len(scores), 1) if scores else None,
            }
        )
    data.sort(key=lambda d: d["farmerName"])
    return {"data": data, "total": len(data)}


@router.delete("/saved-farmers/{farmer_id}", status_code=204)
async def unsave_farmer(farmer_id: str, ctx: tuple = Depends(_direct_buyer)):
    user, uid = ctx
    await delete_doc(f"users/{uid}/saved_farmers", farmer_id)


@router.get("/feed")
async def buyer_feed(limit: int = 20, ctx: tuple = Depends(_direct_buyer)):
    user, uid = ctx
    demands = await query("demands", [("buyerId", "==", uid), ("status", "==", "open")], limit=500)
    crops = {d.get("crop", "").lower() for d in demands if d.get("crop")}
    saved = await query(f"users/{uid}/saved_farmers", [], limit=500)
    farmer_ids = {s.get("farmerId") for s in saved}
    lots = await query("market_lots", [("status", "==", "open")], limit=1000)
    feed = [
        lot
        for lot in lots
        if lot.get("crop", "").lower() in crops or lot.get("farmerId") in farmer_ids
    ]
    feed.sort(key=lambda l: l.get("createdAt", ""), reverse=True)
    limit = max(1, min(limit, 50))
    data = []
    for lot in feed[:limit]:
        farmer = await get_doc("users", lot.get("farmerId", "")) or {}
        data.append(
            {
                **lot,
                "farmerName": farmer.get("name", ""),
                "farmerVillage": farmer.get("village", ""),
            }
        )
    return {"data": data, "total": len(feed)}


# ---------------------------------------------------------------------------
# Direct-trade hub: profile cards, dashboards, ratings, standing orders.
# Every payload below is computed from real collections (users, purchases,
# demands, market_lots, offers, ratings, kyc_cases) — no seeded demo fallback.
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_prefix() -> str:
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


async def _kyc_verified(uid: str, persona: str) -> bool:
    cases = await query("kyc_cases", [("userId", "==", uid)], limit=50)
    return any(
        c.get("persona") == persona and c.get("status") == "verified" for c in cases
    )


def _purchase_rating(purchase: dict, key: str) -> dict | None:
    rating = (purchase.get("rating") or {}).get(key)
    if rating:
        return {
            "stars": rating.get("rating"),
            "review": rating.get("review", ""),
            "at": rating.get("at", ""),
            "purchaseId": purchase.get("id"),
            "crop": purchase.get("crop", ""),
        }
    return None


async def _party_rating(uid: str, purchase_field: str, purchase_filter: str) -> dict:
    """Aggregate rating + reviews for `uid` from real purchase ratings and the
    ratings collection (WS-03 prompt kinds)."""
    purchases = await query("purchases", [(purchase_filter, "==", uid)], limit=1000)
    reviews = []
    for p in purchases:
        entry = _purchase_rating(p, purchase_field)
        if entry:
            entry["fromName"] = p.get("buyerName") if purchase_filter == "farmerId" else p.get("farmerName")
            reviews.append(entry)
    kind = "lot_sale" if purchase_field == "buyerToFarmer" else "lot_purchase"
    ratings = await query(
        "ratings", [("providerId", "==", uid), ("bookingKind", "==", kind)], limit=1000
    )
    for r in ratings:
        reviews.append(
            {
                "stars": r.get("stars"),
                "review": r.get("comment", ""),
                "at": r.get("createdAt", ""),
                "purchaseId": r.get("bookingId"),
                "crop": "",
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


@router.get("/farmers/{farmer_id}")
async def farmer_card(farmer_id: str, uid: str = Depends(current_user_id)):
    """Public farmer profile card: identity, address, products grown/sold,
    live availability (open lots), rating and recent buyer reviews."""
    farmer = await get_user(farmer_id)
    if farmer is None:
        _error(404, "FARMER_NOT_FOUND", "farmer not found")
    lots = await query("market_lots", [("farmerId", "==", farmer_id)], limit=500)
    open_lots = [l for l in lots if l.get("status") == "open"]
    products = sorted(
        {c for c in (farmer.get("activeCrops") or []) if c}
        | {l.get("crop", "") for l in open_lots if l.get("crop")}
    )
    rating = await _party_rating(farmer_id, "buyerToFarmer", "farmerId")
    return {
        "farmerId": farmer_id,
        "name": farmer.get("name", ""),
        "address": _address(farmer),
        "products": products,
        "availability": {
            "openLots": len(open_lots),
            "byCrop": [
                {
                    "crop": l.get("crop", ""),
                    "quantityQuintals": l.get("quantityQuintals", 0),
                    "expectedRate": l.get("expectedRate", 0),
                    "harvestDate": l.get("harvestDate", ""),
                }
                for l in open_lots
            ],
        },
        "landAreaAcres": farmer.get("landAreaAcres", 0),
        "rating": {"average": rating["average"], "count": rating["count"]},
        "recentReviews": rating["reviews"][:5],
    }


@router.get("/buyers/{buyer_id}")
async def buyer_card(buyer_id: str, uid: str = Depends(current_user_id)):
    """Public buyer profile card: identity, address, verified badge, service
    radius, daily/monthly capacity, product names, rating and farmer reviews."""
    buyer = await get_user(buyer_id)
    if buyer is None:
        _error(404, "BUYER_NOT_FOUND", "buyer not found")
    role_profile = await get_doc(f"users/{buyer_id}/role_profiles", "directBuyer") or {}
    demands = await query("demands", [("buyerId", "==", buyer_id)], limit=500)
    demand_crops = {d.get("crop", "") for d in demands if d.get("crop")}
    products = sorted(
        {c for c in (role_profile.get("products") or []) if c} | demand_crops
    )
    rating = await _party_rating(buyer_id, "farmerToBuyer", "buyerId")
    return {
        "buyerId": buyer_id,
        "name": buyer.get("name", ""),
        "companyName": role_profile.get("companyName", ""),
        "buyerType": role_profile.get("buyerType", ""),
        "address": _address(buyer),
        "verifiedBadge": {
            "vyapariVerified": bool(buyer.get("vyapariVerified")),
            "kycVerified": await _kyc_verified(buyer_id, "directBuyer"),
        },
        "serviceRadiusKm": role_profile.get("serviceRadiusKm", 0),
        "serviceAreaAddress": role_profile.get("serviceAreaAddress", ""),
        "capacityPerDay": role_profile.get("capacityPerDay", 0),
        "capacityPerMonth": role_profile.get("capacityPerMonth", 0),
        "products": products,
        "rating": {"average": rating["average"], "count": rating["count"]},
        "recentReviews": rating["reviews"][:5],
    }


async def _farmer_ctx(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return user, uid


async def _company_of(uid: str) -> str:
    profile = await get_doc(f"users/{uid}/role_profiles", "directBuyer") or {}
    company = profile.get("companyName", "")
    if not company:
        seller_profile = await get_doc(f"users/{uid}/role_profiles", "seller") or {}
        company = seller_profile.get("shopName", "")
    if not company:
        exporter_profile = await get_doc(f"users/{uid}/role_profiles", "exporter") or {}
        company = exporter_profile.get("companyName", "")
    return company


@router.get("/farmer/home")
async def farmer_home(ctx: tuple = Depends(_farmer_ctx)):
    """Farmer dashboard for direct-buyer trade: today's buyer activity, recent
    sales (purchases), recent posts (lots) — all from real collections."""
    user, uid = ctx
    today = _today_prefix()
    my_lots = await query("market_lots", [("farmerId", "==", uid)], limit=500)
    my_crops = {c.lower() for c in (user.get("activeCrops") or []) if c} | {
        l.get("crop", "").lower() for l in my_lots if l.get("crop")
    }
    lot_ids = {l.get("id") for l in my_lots}

    daily_buyers: dict[str, dict] = {}

    async def _note(kind: str, buyer_id: str, buyer_name: str, crop: str, at: str, detail: str):
        buyer = await get_user(buyer_id) or {}
        entry = daily_buyers.setdefault(
            buyer_id,
            {
                "buyerId": buyer_id,
                "buyerName": buyer.get("name", buyer_name),
                "buyerCompany": "",
                "activities": [],
            },
        )
        company = (await get_doc(f"users/{buyer_id}/role_profiles", "directBuyer") or {}).get(
            "companyName", ""
        )
        if company:
            entry["buyerCompany"] = company
        entry["activities"].append({"kind": kind, "crop": crop, "at": at, "detail": detail})

    for offer in await query("offers", [("toId", "==", uid), ("targetType", "==", "lot")], limit=1000):
        if offer.get("targetId") in lot_ids and (offer.get("createdAt") or "").startswith(today):
            await _note(
                "offer_received",
                offer.get("fromId", ""),
                offer.get("fromName", ""),
                "",
                offer.get("createdAt", ""),
                f"₹{offer.get('pricePerUnit')}/{offer.get('unit', 'quintal')} x {offer.get('quantity')}",
            )
    for p in await query("purchases", [("farmerId", "==", uid)], limit=1000):
        if (p.get("createdAt") or "").startswith(today):
            await _note(
                "purchase",
                p.get("buyerId", ""),
                p.get("buyerName", ""),
                p.get("crop", ""),
                p.get("createdAt", ""),
                f"{p.get('quantity')} {p.get('unit', 'quintal')} @ ₹{p.get('agreedPricePerUnit')}",
            )
    for d in await query("demands", [("status", "==", "open")], limit=1000):
        if (d.get("createdAt") or "").startswith(today) and d.get("crop", "").lower() in my_crops:
            await _note(
                "demand_posted",
                d.get("buyerId", ""),
                d.get("buyerName", ""),
                d.get("crop", ""),
                d.get("createdAt", ""),
                f"wants {d.get('quantity')} {d.get('unit', 'quintal')} by {d.get('neededBy') or '—'}",
            )
    daily = sorted(daily_buyers.values(), key=lambda e: e["activities"][0]["at"], reverse=True)

    purchases = await query("purchases", [("farmerId", "==", uid)], limit=1000)
    purchases.sort(key=lambda p: p.get("createdAt", ""), reverse=True)
    recent_purchases = [_sale_view(p) for p in purchases[:5]]
    lots = sorted(my_lots, key=lambda l: l.get("createdAt", ""), reverse=True)
    rating = await _party_rating(uid, "buyerToFarmer", "farmerId")
    unread = len(
        [n for n in await query("notifications", [("userId", "==", uid)], limit=1000) if not n.get("read")]
    )
    return {
        "dailyBuyers": daily,
        "recentPurchases": recent_purchases,
        "recentPosts": [
            {
                "id": l.get("id"),
                "crop": l.get("crop", ""),
                "quantityQuintals": l.get("quantityQuintals", 0),
                "expectedRate": l.get("expectedRate", 0),
                "status": l.get("status", ""),
                "createdAt": l.get("createdAt", ""),
            }
            for l in lots[:5]
        ],
        "stats": {
            "openLots": sum(1 for l in my_lots if l.get("status") == "open"),
            "activeSales": sum(1 for p in purchases if p.get("status") not in ("completed", "cancelled")),
            "liveDemands": len(
                [d for d in await query("demands", [("status", "==", "open")], limit=1000)]
            ),
            "myRating": rating["average"],
            "unreadNotifications": unread,
        },
    }


def _sale_view(p: dict) -> dict:
    return {
        "id": p.get("id"),
        "buyerId": p.get("buyerId", ""),
        "buyerName": p.get("buyerName", ""),
        "crop": p.get("crop", ""),
        "quantity": p.get("quantity", 0),
        "unit": p.get("unit", "quintal"),
        "agreedPricePerUnit": p.get("agreedPricePerUnit", 0),
        "totalAmount": p.get("totalAmount", 0),
        "finalAmount": p.get("finalAmount"),
        "status": p.get("status", ""),
        "createdAt": p.get("createdAt", ""),
    }


@router.get("/dashboard")
async def buyer_home(ctx: tuple = Depends(_direct_buyer)):
    """Buyer dashboard: today's live demands, recent purchases, recent posts
    (demands), standing orders — all from real collections."""
    user, uid = ctx
    today = _today_prefix()
    demands = await query("demands", [("buyerId", "==", uid)], limit=1000)
    open_demands = [d for d in demands if d.get("status") == "open"]
    todays_live = [
        d
        for d in open_demands
        if (d.get("neededBy") or "") == today or (d.get("createdAt") or "").startswith(today)
    ]
    todays_live.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    purchases = await query("purchases", [("buyerId", "==", uid)], limit=1000)
    purchases.sort(key=lambda p: p.get("createdAt", ""), reverse=True)
    posts = sorted(demands, key=lambda d: d.get("createdAt", ""), reverse=True)
    standing = await query("standing_orders", [("buyerId", "==", uid)], limit=500)
    rating = await _party_rating(uid, "farmerToBuyer", "buyerId")
    unread = len(
        [n for n in await query("notifications", [("userId", "==", uid)], limit=1000) if not n.get("read")]
    )
    return {
        "todaysLiveDemands": todays_live[:10],
        "recentPurchases": [_sale_view(p) for p in purchases[:5]],
        "recentPosts": [
            {
                "id": d.get("id"),
                "crop": d.get("crop", ""),
                "quantity": d.get("quantity", 0),
                "unit": d.get("unit", "quintal"),
                "maxPrice": d.get("maxPrice", 0),
                "status": d.get("status", ""),
                "createdAt": d.get("createdAt", ""),
            }
            for d in posts[:5]
        ],
        "standingOrders": {
            "active": sum(1 for s in standing if s.get("status") == "open"),
            "data": sorted(
                [s for s in standing if s.get("status") == "open"],
                key=lambda s: s.get("createdAt", ""),
                reverse=True,
            )[:5],
        },
        "stats": {
            "activeDemands": len(open_demands),
            "activePurchases": sum(
                1 for p in purchases if p.get("status") not in ("completed", "cancelled")
            ),
            "myRating": rating["average"],
            "unreadNotifications": unread,
        },
    }


@router.get("/farmer/ratings")
async def farmer_self_ratings(ctx: tuple = Depends(_farmer_ctx)):
    """The farmer's own rating aggregate and the reviews buyers left them."""
    user, uid = ctx
    rating = await _party_rating(uid, "buyerToFarmer", "farmerId")
    return {"farmerId": uid, **rating}


@router.get("/ratings")
async def buyer_self_ratings(ctx: tuple = Depends(_direct_buyer)):
    """The buyer's own rating aggregate and the reviews farmers left them."""
    user, uid = ctx
    rating = await _party_rating(uid, "farmerToBuyer", "buyerId")
    return {"buyerId": uid, **rating}


@router.get("/farmer-posts")
async def farmer_posts_live(
    crop: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    ctx: tuple = Depends(_direct_buyer),
):
    """Every open farmer lot (live) enriched with farmer name, village, rating
    and verified badge — the buyer-side view of all farmer posts."""
    user, uid = ctx
    lots = await query("market_lots", [("status", "==", "open")], limit=1000)
    lots = [l for l in lots if l.get("farmerId") != uid]
    if crop:
        lots = [l for l in lots if crop.lower() in l.get("crop", "").lower()]
    lots.sort(key=lambda l: l.get("createdAt", ""), reverse=True)
    total = len(lots)
    start = (page - 1) * pageSize
    data = []
    for lot in lots[start:start + pageSize]:
        farmer = await get_user(lot.get("farmerId", "")) or {}
        rating = await _party_rating(lot.get("farmerId", ""), "buyerToFarmer", "farmerId")
        data.append(
            {
                **lot,
                "farmerName": farmer.get("name", ""),
                "farmerVillage": farmer.get("village", ""),
                "farmerDistrict": farmer.get("district", ""),
                "farmerRating": rating["average"],
                "farmerReviewCount": rating["count"],
                "farmerVerified": bool(farmer.get("vyapariVerified")),
            }
        )
    return {"data": data, "page": page, "pageSize": pageSize, "total": total}


@router.get("/commission-structure")
async def commission_structure(uid: str = Depends(current_user_id)):
    """Admin commission on direct-buyer trades: charged to the buyer side,
    never deducted from the farmer payout (config-driven)."""
    from app.services import settlements as settlements_service

    config = await settlements_service._config()
    pct = int(config.get("directBuyerPct", 2))
    pct = min(2, max(1, pct))
    floor = int(config.get("sellerMinRupees", 50))
    return {
        "trade": "directBuyer",
        "commissionPercent": pct,
        "bandPercent": [1, 2],
        "minRupees": floor,
        "chargedFrom": "buyer",
        "farmerSidePercent": 0,
        "notes": "Platform commission is charged on the buyer side of direct "
        "trades; the farmer receives the full agreed amount.",
    }


# ---------------- Standing demand orders ----------------


def _validate_standing_dates(body: StandingOrderCreate | StandingOrderUpdate, doc: dict | None = None):
    candidate = dict(doc or {})
    for k in ("startDate", "endDate"):
        value = getattr(body, k, None)
        if value is not None:
            candidate[k] = value
    try:
        start = datetime.strptime(candidate.get("startDate", ""), "%Y-%m-%d").date()
        end = datetime.strptime(candidate.get("endDate", ""), "%Y-%m-%d").date()
    except ValueError:
        _error(422, "VALIDATION_ERROR", "invalid date", {"dates": "startDate and endDate must be YYYY-MM-DD"})
    if end < start:
        _error(422, "INVALID_DATE_RANGE", "endDate must be on or after startDate")
    min_price = getattr(body, "minPrice", None)
    max_price = getattr(body, "maxPrice", None)
    if min_price is not None and max_price is not None and min_price > max_price:
        _error(422, "INVALID_PRICE_BAND", "minPrice must not exceed maxPrice")


@router.post("/standing-orders", status_code=201)
async def create_standing_order(body: StandingOrderCreate, ctx: tuple = Depends(_direct_buyer)):
    """Buyer posts a standing (recurring) demand with a price band, calendar
    window, per-slot quantity and a service area."""
    user, uid = ctx
    _validate_standing_dates(body)
    if body.minPrice > body.maxPrice:
        _error(422, "INVALID_PRICE_BAND", "minPrice must not exceed maxPrice")
    now = _now_iso()
    doc = {
        **body.model_dump(),
        "id": f"sod_{uuid.uuid4().hex[:12]}",
        "buyerId": uid,
        "buyerName": user.get("name", ""),
        "buyerCompany": await _company_of(uid),
        "state": user.get("state", ""),
        "status": "open",
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("standing_orders", doc["id"], doc)
    return doc


@router.get("/standing-orders")
async def list_standing_orders(
    status: str | None = None, ctx: tuple = Depends(_direct_buyer)
):
    user, uid = ctx
    docs = await query("standing_orders", [("buyerId", "==", uid)], limit=500)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


async def _own_standing_order(order_id: str, uid: str) -> dict:
    doc = await get_doc("standing_orders", order_id)
    if doc is None or doc.get("buyerId") != uid:
        _error(404, "STANDING_ORDER_NOT_FOUND", "standing order not found")
    return doc


@router.put("/standing-orders/{order_id}")
async def update_standing_order(
    order_id: str, body: StandingOrderUpdate, ctx: tuple = Depends(_direct_buyer)
):
    user, uid = ctx
    doc = await _own_standing_order(order_id, uid)
    if doc.get("status") != "open":
        _error(409, "STANDING_ORDER_CLOSED", "only open standing orders can be edited")
    _validate_standing_dates(body, doc)
    merged = {**doc, **body.model_dump(exclude_none=True)}
    if merged.get("minPrice", 0) > merged.get("maxPrice", 0):
        _error(422, "INVALID_PRICE_BAND", "minPrice must not exceed maxPrice")
    doc.update(body.model_dump(exclude_none=True))
    doc["updatedAt"] = _now_iso()
    await set_doc("standing_orders", order_id, doc)
    return doc


@router.post("/standing-orders/{order_id}/close")
async def close_standing_order(order_id: str, ctx: tuple = Depends(_direct_buyer)):
    user, uid = ctx
    doc = await _own_standing_order(order_id, uid)
    if doc.get("status") == "closed":
        return doc
    doc["status"] = "closed"
    doc["updatedAt"] = _now_iso()
    await set_doc("standing_orders", order_id, doc)
    return doc
