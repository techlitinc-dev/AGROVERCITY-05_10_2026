from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import query
from app.core.deps import current_user_id
from app.services.users import get_user

router = APIRouter(prefix="/intelligence", tags=["intelligence"])

BROKER_ACTIVE_STATUSES = ("negotiating", "contract_issued", "accepted", "in_transit")
TRIP_DONE = ("delivered", "cancelled")
TRIP_DELIVERED = "delivered"


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _last_months(n: int, now: datetime | None = None) -> list[str]:
    now = now or _now()
    keys = []
    for i in range(n - 1, -1, -1):
        month = now.month - i
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        keys.append(f"{year:04d}-{month:02d}")
    return keys


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _billable(purchase: dict) -> float:
    return purchase.get("finalAmount") or purchase.get("totalAmount") or 0


def _paid(purchase: dict) -> float:
    return sum(p.get("amount", 0) for p in purchase.get("payments") or [])


def _mandi_modal(crop: str, mandi_docs: list[dict]) -> float | None:
    matches = [d for d in mandi_docs if crop.lower() in d.get("commodity", "").lower()]
    if not matches:
        return None
    return round(sum(d.get("modalPrice", 0) for d in matches) / len(matches))


def _monthly_points(keys: list[str], buckets: dict[str, float]) -> list[dict]:
    return [{"label": k, "value": round(buckets.get(k, 0), 2)} for k in keys]


async def _broker_intel(uid: str, now: datetime) -> dict:
    deals = await query("broker_deals", [("brokerId", "==", uid)], limit=1000)
    mandi_docs = await query("mandi_prices", [], limit=1000)
    months = _last_months(6, now)

    kpis: list[dict] = []
    active = [d for d in deals if d.get("status") in BROKER_ACTIVE_STATUSES]
    completed = [d for d in deals if d.get("status") == "completed"]
    kpis.append({"key": "activeDeals", "labelKey": "intelActiveDeals", "value": len(active)})
    kpis.append(
        {
            "key": "totalEarned",
            "labelKey": "intelBrokerCommission",
            "value": round(sum(d.get("commissionAmount", 0) for d in completed), 2),
            "unit": "₹",
        }
    )
    kpis.append(
        {
            "key": "pendingPayout",
            "labelKey": "intelPendingPayout",
            "value": round(sum(d.get("commissionAmount", 0) for d in active), 2),
            "unit": "₹",
        }
    )
    close_days = []
    for d in completed:
        created = _parse_iso(d.get("createdAt"))
        updated = _parse_iso(d.get("updatedAt"))
        if created and updated and updated >= created:
            close_days.append((updated - created).total_seconds() / 86400)
    if close_days:
        kpis.append(
            {
                "key": "avgDaysToClose",
                "labelKey": "intelAvgDaysToClose",
                "value": round(sum(close_days) / len(close_days), 1),
                "unit": "days",
            }
        )

    buckets: dict[str, float] = {m: 0.0 for m in months}
    crops: dict[str, float] = {}
    rates: dict[str, list[float]] = {}
    for d in deals:
        month = (d.get("createdAt") or "")[:7]
        if month in buckets:
            buckets[month] += d.get("commissionAmount", 0)
        crop = d.get("commodity", "")
        if crop:
            crops[crop] = crops.get(crop, 0) + (d.get("commissionAmount", 0) or 0)
            rates.setdefault(crop, []).append(d.get("agreedRate", 0) or 0)
    series = []
    if deals:
        series.append(
            {
                "key": "monthlyCommission",
                "labelKey": "intelCommissionTrend",
                "points": _monthly_points(months, buckets),
            }
        )
    breakdowns = []
    if crops:
        top = sorted(crops.items(), key=lambda kv: kv[1], reverse=True)[:5]
        breakdowns.append(
            {
                "key": "topCrops",
                "labelKey": "intelTopCropsByCommission",
                "items": [{"label": c, "value": round(v, 2), "unit": "₹"} for c, v in top],
            }
        )

    insights = []
    for crop, commissions in sorted(crops.items(), key=lambda kv: kv[1], reverse=True):
        if len(insights) >= 4:
            break
        avg_rate = sum(rates[crop]) / len(rates[crop])
        modal = _mandi_modal(crop, mandi_docs)
        if modal and avg_rate > 0 and modal > avg_rate * 1.05:
            insights.append(
                {
                    "severity": "opportunity",
                    "labelKey": "mandi_up_for_your_crop",
                    "params": {"crop": crop, "pct": round((modal - avg_rate) / avg_rate * 100, 1)},
                }
            )
    return {"kpis": kpis, "series": series, "breakdowns": breakdowns, "insights": insights}


async def _buyer_intel(uid: str, now: datetime) -> dict:
    purchases = await query("purchases", [("buyerId", "==", uid)], limit=1000)
    offers = await query("offers", [("fromId", "==", uid)], limit=1000)
    mandi_docs = await query("mandi_prices", [], limit=1000)
    months = _last_months(6, now)
    live = [p for p in purchases if p.get("status") != "cancelled"]

    kpis: list[dict] = [
        {"key": "totalSpend", "labelKey": "intelTotalSpend", "value": round(sum(_billable(p) for p in live), 2), "unit": "₹"},
        {
            "key": "completedPurchases",
            "labelKey": "intelCompletedPurchases",
            "value": sum(1 for p in live if p.get("status") == "completed"),
        },
        {
            "key": "activePurchases",
            "labelKey": "intelActivePurchases",
            "value": sum(1 for p in live if p.get("status") != "completed"),
        },
    ]
    actionable = [o for o in offers if o.get("status") != "withdrawn"]
    if actionable:
        wins = sum(1 for o in actionable if o.get("status") == "accepted")
        kpis.append(
            {
                "key": "offerWinRate",
                "labelKey": "intelOfferWinRate",
                "value": round(wins / len(actionable) * 100, 1),
                "unit": "%",
            }
        )

    buckets: dict[str, float] = {m: 0.0 for m in months}
    crops: dict[str, dict] = {}
    for p in live:
        month = (p.get("createdAt") or "")[:7]
        if month in buckets:
            buckets[month] += _billable(p)
        crop = p.get("crop", "")
        entry = crops.setdefault(crop, {"spend": 0.0, "volume": 0.0})
        entry["spend"] += _billable(p)
        entry["volume"] += p.get("quantity") or 0
    series = []
    if live:
        series.append(
            {"key": "monthlySpend", "labelKey": "intelSpendTrend", "points": _monthly_points(months, buckets)}
        )
    breakdowns = []
    if crops:
        top = sorted(crops.items(), key=lambda kv: kv[1]["spend"], reverse=True)[:5]
        breakdowns.append(
            {
                "key": "topCrops",
                "labelKey": "intelTopCropsBySpend",
                "items": [{"label": c, "value": round(v["spend"], 2), "unit": "₹"} for c, v in top],
            }
        )

    insights = []
    top_crop = max(crops.items(), key=lambda kv: kv[1]["spend"])[0] if crops else None
    if top_crop and crops[top_crop]["volume"] > 0:
        avg_price = crops[top_crop]["spend"] / crops[top_crop]["volume"]
        modal = _mandi_modal(top_crop, mandi_docs)
        if modal and avg_price < modal:
            insights.append(
                {
                    "severity": "opportunity",
                    "labelKey": "buying_below_mandi",
                    "params": {"crop": top_crop, "pct": round((modal - avg_price) / modal * 100, 1)},
                }
            )
    pending_balance = round(sum(_billable(p) - _paid(p) for p in live), 2)
    if pending_balance > 0:
        insights.append(
            {"severity": "info", "labelKey": "balance_due", "params": {"amount": pending_balance}}
        )
    return {"kpis": kpis, "series": series, "breakdowns": breakdowns, "insights": insights[:4]}


async def _farmer_intel(uid: str, now: datetime) -> dict:
    lots = await query("market_lots", [("farmerId", "==", uid)], limit=1000)
    purchases = await query("purchases", [("farmerId", "==", uid)], limit=1000)
    offers = await query("offers", [("toId", "==", uid)], limit=1000)
    mandi_docs = await query("mandi_prices", [], limit=1000)
    history = await query("mandi_price_history", [], limit=5000)
    months = _last_months(6, now)
    live_sales = [p for p in purchases if p.get("status") != "cancelled"]
    this_month = now.strftime("%Y-%m")

    kpis: list[dict] = [
        {
            "key": "activeLots",
            "labelKey": "intelActiveLots",
            "value": sum(1 for l in lots if l.get("status") == "open"),
        },
        {
            "key": "offersReceived",
            "labelKey": "intelOffersReceived",
            "value": sum(1 for o in offers if (o.get("createdAt") or "")[:7] == this_month),
        },
        {
            "key": "completedSales",
            "labelKey": "intelCompletedSales",
            "value": sum(1 for p in live_sales if p.get("status") == "completed"),
        },
    ]
    crops: dict[str, dict] = {}
    for p in live_sales:
        crop = p.get("crop", "")
        entry = crops.setdefault(crop, {"spend": 0.0, "volume": 0.0})
        entry["spend"] += _billable(p)
        entry["volume"] += p.get("quantity") or 0
    if crops:
        top_crop, top = max(crops.items(), key=lambda kv: kv[1]["volume"])
        if top["volume"] > 0:
            avg_price = top["spend"] / top["volume"]
            modal = _mandi_modal(top_crop, mandi_docs)
            if modal:
                delta = round((avg_price - modal) / modal * 100, 1)
                kpis.append(
                    {
                        "key": "realizedVsMandiPct",
                        "labelKey": "intelRealizedVsMandi",
                        "value": delta,
                        "unit": "%",
                        "direction": "up" if delta > 0 else ("down" if delta < 0 else "flat"),
                    }
                )

    buckets: dict[str, float] = {m: 0.0 for m in months}
    for p in live_sales:
        month = (p.get("createdAt") or "")[:7]
        if month in buckets:
            buckets[month] += _billable(p)
    series = []
    if live_sales:
        series.append(
            {"key": "monthlySales", "labelKey": "intelSalesTrend", "points": _monthly_points(months, buckets)}
        )
    breakdowns = []
    if crops:
        top = sorted(crops.items(), key=lambda kv: kv[1]["volume"], reverse=True)[:5]
        breakdowns.append(
            {
                "key": "topCrops",
                "labelKey": "intelTopCropsByVolume",
                "items": [
                    {"label": c, "value": round(v["volume"], 3), "unit": "quintal"} for c, v in top
                ],
            }
        )

    insights = []
    for lot in lots:
        if lot.get("status") != "open" or len(insights) >= 4:
            continue
        created = _parse_iso(lot.get("createdAt"))
        if created is None or (now - created).total_seconds() <= 7 * 86400:
            continue
        has_offer = any(
            o.get("targetType") == "lot" and o.get("targetId") == lot.get("id") for o in offers
        )
        if not has_offer:
            insights.append(
                {
                    "severity": "warning",
                    "labelKey": "stale_lot",
                    "params": {"crop": lot.get("crop", "")},
                }
            )
    by_crop_month: dict[tuple, dict] = {}
    for p in live_sales:
        key = (p.get("crop", ""), (p.get("createdAt") or "")[:7])
        entry = by_crop_month.setdefault(key, {"spend": 0.0, "volume": 0.0})
        entry["spend"] += _billable(p)
        entry["volume"] += p.get("quantity") or 0
    for (crop, month), agg in by_crop_month.items():
        if len(insights) >= 4 or not crop or agg["volume"] <= 0:
            continue
        hist = [
            d
            for d in history
            if crop.lower() in d.get("commodity", "").lower() and (d.get("date") or "")[:7] == month
        ]
        if not hist:
            continue
        modal = sum(d.get("modalPrice", 0) for d in hist) / len(hist)
        avg_price = agg["spend"] / agg["volume"]
        if modal and avg_price < modal * 0.9:
            insights.append(
                {"severity": "info", "labelKey": "sold_below_mandi", "params": {"crop": crop}}
            )
    return {"kpis": kpis, "series": series, "breakdowns": breakdowns, "insights": insights[:4]}


async def _transport_intel(uid: str, now: datetime) -> dict:
    vehicles = await query("vehicles", [("ownerId", "==", uid)], limit=1000)
    vehicle_ids = {v.get("id") for v in vehicles}
    bookings = await query("transport_bookings", [], limit=1000)
    mine = [b for b in bookings if b.get("vehicleId") in vehicle_ids]
    settlements = await query("settlements", [("role", "==", "transport"), ("entityId", "==", uid)], limit=500)
    months = _last_months(6, now)
    this_month = now.strftime("%Y-%m")

    delivered = [b for b in mine if b.get("status") == TRIP_DELIVERED]
    active = [b for b in mine if b.get("status") not in TRIP_DONE]
    settled = [b for b in mine if b.get("status") != "cancelled"]
    kpis: list[dict] = [
        {"key": "activeTrips", "labelKey": "intelActiveTrips", "value": len(active)},
        {
            "key": "monthlyRevenue",
            "labelKey": "intelMonthlyRevenue",
            "value": round(sum(b.get("fare", 0) for b in delivered if (b.get("date") or "")[:7] == this_month), 2),
            "unit": "₹",
        },
        {"key": "completedTrips", "labelKey": "intelCompletedTrips", "value": len(delivered)},
    ]
    if settled:
        kpis.append(
            {
                "key": "completionRate",
                "labelKey": "intelCompletionRate",
                "value": round(len(delivered) / len(settled) * 100, 1),
                "unit": "%",
            }
        )

    buckets: dict[str, float] = {m: 0.0 for m in months}
    per_vehicle: dict[str, dict] = {}
    for b in delivered:
        month = (b.get("date") or "")[:7]
        if month in buckets:
            buckets[month] += b.get("fare", 0)
        vid = b.get("vehicleId") or "unknown"
        entry = per_vehicle.setdefault(vid, {"label": b.get("vehicleNo") or vid, "revenue": 0.0})
        entry["revenue"] += b.get("fare", 0)
    for v in vehicles:
        if v.get("id") in per_vehicle and per_vehicle[v["id"]]["label"] == v["id"]:
            per_vehicle[v["id"]]["label"] = v.get("registrationNo") or v["id"]
    series = []
    if delivered:
        series.append(
            {"key": "monthlyRevenue", "labelKey": "intelRevenueTrend", "points": _monthly_points(months, buckets)}
        )
    breakdowns = []
    if per_vehicle:
        top = sorted(per_vehicle.values(), key=lambda e: e["revenue"], reverse=True)[:5]
        breakdowns.append(
            {
                "key": "revenuePerVehicle",
                "labelKey": "intelRevenuePerVehicle",
                "items": [{"label": e["label"], "value": round(e["revenue"], 2), "unit": "₹"} for e in top],
            }
        )

    insights = []
    pending = round(
        sum(s.get("netRupees", 0) for s in settlements if s.get("status") == "pending"), 2
    )
    if pending > 0:
        insights.append(
            {"severity": "info", "labelKey": "settlement_pending", "params": {"amount": pending}}
        )
    return {"kpis": kpis, "series": series, "breakdowns": breakdowns, "insights": insights}


@router.get("")
async def intelligence(uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    persona = user.get("activeProfile") or ""
    now = _now()
    if persona in ("seller", "directBuyer"):
        computed = await _buyer_intel(uid, now)
    elif persona in ("transport", "transporter"):
        computed = await _transport_intel(uid, now)
    elif persona == "farmer":
        computed = await _farmer_intel(uid, now)
    elif persona == "broker":
        computed = await _broker_intel(uid, now)
    else:
        _error(404, "INTELLIGENCE_NOT_AVAILABLE", f"no intelligence module for profile {persona}")
    return {
        "persona": persona,
        "generatedAt": now.isoformat(),
        "kpis": computed["kpis"][:6],
        "series": computed["series"][:3],
        "breakdowns": computed["breakdowns"][:3],
        "insights": computed["insights"][:4],
    }
