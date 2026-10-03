from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.direct import SavedFarmerIn
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
