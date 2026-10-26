import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.cache import cache_delete, cache_get, cache_set
from app.core.db import get_doc, query
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services import agmarknet, agmarknet_sync
from app.services.mandi_forecast import CACHE_COLLECTION as FORECAST_COLLECTION
from app.services.mandi_forecast import forecast_doc_id
from app.services.mandi_smart import build_smart_select_state, decide_smart_select
from app.services.users import get_user

router = APIRouter(prefix="/mandi", tags=["mandi"])

MANDI_ROLES = ("farmer", "seller", "broker", "directBuyer")

# Agmarknet live feed caches: dashboard rows 15 min, filter catalog 24 h,
# manual refresh lock 10 min (the upstream scrape itself takes ~30 s).
LIVE_CACHE_TTL_SECONDS = 900
FILTERS_CACHE_TTL_SECONDS = 24 * 3600
REFRESH_LOCK_TTL_SECONDS = 600
REFRESH_RUNNING_TTL_SECONDS = 300

# Smart mandi selection (brief M12, SDR) — question set / AI-feature tag / cache
# live in services/mandi_smart.py (rule 10); the AI call is never triggered by a
# page view (task 1.12).
SMART_SELECT_CACHE_TTL_SECONDS = 900


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _mandi_user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, *MANDI_ROLES)
    return user


def _crop_match(crop: str, commodity: str) -> bool:
    return crop.lower() in commodity.lower()


async def _default_mandi(user: dict) -> str | None:
    """Fallback mandi for history/forecast when the caller omits `mandi`:
    the first registered mandi in the farmer's own district, else the
    district name itself (matches `… District APMC`-style mandi names)."""
    district = (user.get("district") or "").strip()
    if not district:
        return None
    docs = await query("mandis", [], limit=1000)
    for doc in docs:
        if (doc.get("district") or "").strip().lower() == district.lower() and doc.get("name"):
            return str(doc["name"])
    return district


@router.get("/prices")
async def list_prices(
    crop: str | None = None,
    district: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    page: int = 1,
    pageSize: int = 20,
    user: dict = Depends(_mandi_user),
):
    docs = await query("mandi_prices", [], limit=1000)
    if crop:
        docs = [d for d in docs if _crop_match(crop, d.get("commodity", ""))]
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


@router.get("/list")
async def mandi_list(user: dict = Depends(_mandi_user)):
    docs = await query("mandis", [], limit=1000)
    return {
        "data": [
            {"id": d["id"], "name": d["name"], "district": d["district"], "state": d["state"]}
            for d in docs
        ]
    }


@router.get("/vyapari-rates")
async def vyapari_rates(crops: str | None = None, user: dict = Depends(_mandi_user)):
    key = f"vyapari_rates:{crops or 'all'}"
    cached = await cache_get(key)
    if cached is not None:
        return json.loads(cached)
    docs = await query("vyapari_rates", [], limit=1000)
    if crops:
        wanted = [c.strip().lower() for c in crops.split(",")]
        docs = [d for d in docs if any(c in d.get("crop", "").lower() for c in wanted)]
    payload = {"data": docs, "cachedAt": datetime.now(timezone.utc).isoformat()}
    await cache_set(key, json.dumps(payload), ttl_seconds=7200)
    return payload


@router.get("/compare")
async def compare(
    crop: str | None = None,
    commodity: str | None = None,
    quantityQuintals: float = 20.0,
    lat: float | None = None,
    lng: float | None = None,
    user: dict = Depends(_mandi_user),
):
    target_crop = crop or commodity
    if not target_crop:
        _error(422, "VALIDATION_ERROR", "crop is required", {"crop": "required"})
    if quantityQuintals <= 0:
        _error(422, "INVALID_QUANTITY", "quantityQuintals must be greater than 0", {"quantityQuintals": "must be greater than 0"})
    docs = await query("mandi_prices", [], limit=1000)
    # National Agmarknet aggregates are benchmarks, not sellable mandis.
    docs = [d for d in docs if d.get("source") != "agmarknet"]
    docs = [d for d in docs if _crop_match(target_crop, d.get("commodity", ""))]
    if not docs:
        # Fallback to all nearby mandis for benchmark comparison
        docs = await query("mandi_prices", [], limit=20)
    items = [
        {
            "mandiName": d.get("mandiName", "APMC Mandi"),
            "commodity": d.get("commodity", crop),
            "modalPrice": d.get("modalPrice", 0),
            # Transport is priced at a flat ₹12/km (the spec'd rate): the raw
            # product is returned (not rounded) so the client sees the exact fare.
            "transportCost": float(d.get("distanceKm", 10)) * 12,
            "netProfit": round(float(d.get("modalPrice", 0)) * quantityQuintals - float(d.get("distanceKm", 10)) * 12),
        }
        for d in docs
    ]
    items.sort(key=lambda i: i["netProfit"], reverse=True)
    return {"data": items}


@router.get("/prices/history")
async def price_history(
    crop: str | None = None,
    commodity: str | None = None,
    mandi: str | None = None,
    months: int = 3,
    user: dict = Depends(_mandi_user),
):
    target = crop or commodity
    target_mandi = (mandi or "").strip() or await _default_mandi(user)
    if not target or not target_mandi:
        _error(
            422,
            "VALIDATION_ERROR",
            "crop and mandi are required",
            {k: "required" for k, v in (("crop", target), ("mandi", target_mandi)) if not v},
        )
    months = max(1, min(36, months))
    docs = await query("mandi_price_history", [], limit=10000)
    filtered = [
        d
        for d in docs
        if _crop_match(target, d.get("commodity", ""))
        and target_mandi.lower() in d.get("mandiName", "").lower()
    ]
    filtered.sort(key=lambda d: d.get("date", ""))
    filtered = filtered[-months * 30:]
    return {"data": [{"date": d["date"], "modalPrice": d["modalPrice"]} for d in filtered]}


@router.get("/forecast")
async def forecast(
    crop: str | None = None,
    commodity: str | None = None,
    mandi: str | None = None,
    user: dict = Depends(_mandi_user),
):
    target_crop = crop or commodity
    target_mandi = (mandi or "").strip() or await _default_mandi(user)
    missing = {}
    if not target_crop:
        missing["crop"] = "required"
    if not target_mandi:
        missing["mandi"] = "required"
    if missing:
        _error(422, "VALIDATION_ERROR", "crop and mandi are required", missing)
    doc = await get_doc(FORECAST_COLLECTION, forecast_doc_id(target_crop, target_mandi))
    if doc is None:
        _error(404, "FORECAST_NOT_FOUND", "no forecast cached for this crop and mandi — run the nightly job")
    return {"data": doc}


class SmartSelectRequest(BaseModel):
    crop: str
    quantityQuintals: float = Field(gt=0)
    district: str | None = None
    state: str | None = None


def _smart_select_candidates(docs: list[dict]) -> list[dict]:
    """Map mandi_prices docs to the state-builder candidate shape.

    `modalPrice` is stored in rupees/quintal (services/mandi_smart converts once
    to paisa). Commission is deducted only when a doc states it — never invented
    (rule 1); the default is no commission.
    """
    return [
        {
            "mandi": doc.get("mandiName") or "",
            "modalPrice": doc.get("modalPrice"),
            "distanceKm": doc.get("distanceKm", 0),
            "commission_paisa": doc.get("commissionPaisa"),
        }
        for doc in docs
        if doc.get("mandiName")
    ]


@router.post("/smart-select")
async def smart_select(body: SmartSelectRequest, user: dict = Depends(_mandi_user)):
    """Smart mandi selection (brief M12, SDR) — launches at `suggest`.

    Net-after-transport is always plain integer-paisa arithmetic
    (`services/mandi_smart.net_after_transport_paisa`): the AI (via the gateway —
    rule 10) only supplies the ordering + a vernacular `explain_key`, and any
    missing/invalid answer degrades to the deterministic net ranking.
    """
    crop = body.crop.strip()
    if not crop:
        _error(422, "VALIDATION_ERROR", "crop is required", {"crop": "required"})
    qty = int(round(body.quantityQuintals))
    if qty < 1:
        _error(422, "INVALID_QUANTITY", "quantityQuintals must be at least 1")

    docs = await query("mandi_prices", [], limit=1000)
    # National Agmarknet aggregates are benchmarks, not sellable mandis.
    docs = [d for d in docs if d.get("source") != "agmarknet"]
    docs = [d for d in docs if _crop_match(crop, d.get("commodity", ""))]
    if not docs:
        _error(
            422,
            "NO_MANDI_DATA",
            "crop has no mandi data",
            {"crop": "no mandi data for this crop"},
        )

    district = (body.district or user.get("district") or "").strip()
    state = build_smart_select_state(
        {"crop": crop, "quantity_quintals": qty, "district": district},
        {
            "district": district,
            "state": (body.state or user.get("state") or "").strip(),
            "village": str(user.get("village") or ""),
        },
        _smart_select_candidates(docs),
    )

    cache_key = "mandi_smart_select:" + ":".join(
        [
            crop.lower(),
            district.lower(),
            ",".join(sorted(candidate["mandi"].lower() for candidate in state["candidates"])),
        ]
    )
    decision: dict | None = None
    raw = await cache_get(cache_key)
    if raw is not None:
        try:
            decision = json.loads(raw)
        except ValueError:
            decision = None
    if decision is None:
        result = await decide_smart_select(state, str(user.get("id") or ""))
        decision = {
            "ranking": list((result.answers or {}).get("ranking") or []),
            "explainKey": (result.answers or {}).get("explain_key"),
            "confidence": float(result.confidence or 0.0),
            "decisionId": result.decision_id,
            "source": result.source,
        }
        await cache_set(
            cache_key, json.dumps(decision), ttl_seconds=SMART_SELECT_CACHE_TTL_SECONDS
        )

    # Deterministic net ranking is the truth the AI order is validated against.
    deterministic = [candidate["mandi"] for candidate in state["candidates"]]
    by_name = {candidate["mandi"]: candidate for candidate in state["candidates"]}
    ai_ranking = [str(name) for name in (decision.get("ranking") or [])]
    used_ai = (
        decision.get("source") in ("jev", "gemini", "shim")
        and len(ai_ranking) == len(deterministic)
        and set(ai_ranking) == set(deterministic)
    )
    ranking = ai_ranking if used_ai else deterministic

    candidates = []
    for index, name in enumerate(ranking, start=1):
        item = by_name[name]
        candidates.append(
            {
                "rank": index,
                "mandi": name,
                "modalPricePaisa": item["modal_price_paisa"],
                "distanceKm": item["distance_km"],
                "transportFarePaisa": item["transport_fare_paisa"],
                "commissionPaisa": item["commission_paisa"],
                "netPaisa": item["net_paisa"],
            }
        )

    return {
        "data": {
            "crop": crop,
            "quantityQuintals": qty,
            "district": district,
            "source": "ai" if used_ai else "fallback",
            "automationLevel": "suggest",
            "confidence": float(decision.get("confidence") or 0.0),
            "decisionId": decision.get("decisionId"),
            "explainKey": str(decision.get("explainKey") or "net_after_transport"),
            "best": candidates[0] if candidates else None,
            "candidates": candidates,
        }
    }


# ---------- Agmarknet live feed (captcha-free dashboard endpoint) ----------


def _live_error(exc: agmarknet.AgmarknetError):
    _error(502, "AGMARKNET_UNAVAILABLE", str(exc))


@router.get("/live/filters")
async def live_filters(user: dict = Depends(_mandi_user)):
    """Commodity groups / commodities / states + allowed date range."""
    cached = await cache_get("agmarknet:filters")
    if cached is not None:
        return json.loads(cached)
    try:
        data = await agmarknet.fetch_filters()
    except agmarknet.AgmarknetError as exc:
        _live_error(exc)
    price_range = (data.get("range_data") or [{}])[0].get("price") or {}
    payload = {
        "groups": [
            {"id": g["id"], "name": g["cmdt_grp_name"]}
            for g in data.get("cmdt_group_data", [])
            if isinstance(g.get("id"), int)
        ],
        "commodities": [
            {"id": c["cmdt_id"], "name": c["cmdt_name"], "groupId": c.get("cmdt_group_id")}
            for c in data.get("cmdt_data", [])
        ],
        "states": [
            {"id": s["state_id"], "name": s["state_name"]}
            for s in data.get("state_data", [])
        ],
        "marketsCount": len(data.get("market_data") or []),
        "fromDate": price_range.get("from_date"),
        "toDate": price_range.get("to_date"),
        "source": "agmarknet.gov.in",
    }
    await cache_set("agmarknet:filters", json.dumps(payload), ttl_seconds=FILTERS_CACHE_TTL_SECONDS)
    return payload


@router.get("/live")
async def live_prices(
    groupId: int | None = None,
    commodityId: int | None = None,
    commodity: str | None = None,
    date: str | None = None,
    user: dict = Depends(_mandi_user),
):
    """Daily modal price / arrival / MSP rows straight from Agmarknet."""
    key = f"agmarknet:live:{groupId}-{commodityId}-{commodity}-{date}"
    cached = await cache_get(key)
    if cached is not None:
        return json.loads(cached)

    commodity_ids = [commodityId] if commodityId else None
    if commodity and not commodity_ids:
        filters = await agmarknet.fetch_filters()
        wanted = commodity.strip().lower()
        commodity_ids = [
            c["cmdt_id"]
            for c in filters.get("cmdt_data", [])
            if wanted in c["cmdt_name"].lower()
        ][:20]
        if not commodity_ids:
            _error(404, "NO_DATA", f"no Agmarknet commodity matches '{commodity}'")

    try:
        records = await agmarknet.fetch_dashboard(
            group_ids=[groupId] if groupId else None,
            commodity_ids=commodity_ids,
            on_date=date,
        )
    except agmarknet.AgmarknetError as exc:
        _live_error(exc)

    data = [n for n in (agmarknet_sync.normalize_record(r) for r in records) if n]
    data.sort(key=lambda r: r["modalPrice"], reverse=True)
    payload = {
        "data": data,
        "count": len(data),
        "reportedDate": max((r["reportedDate"] for r in data), default=None),
        "source": "agmarknet.gov.in",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }
    await cache_set(key, json.dumps(payload), ttl_seconds=LIVE_CACHE_TTL_SECONDS)
    return payload


@router.post("/live/refresh")
async def live_refresh(user: dict = Depends(_mandi_user)):
    """Scrape Agmarknet now and upsert into mandi_prices / mandi_price_history.

    Throttled: while a refresh runs (or ran < 10 min ago) the last result is
    returned instead of hitting the upstream again.
    """
    running = await cache_get("agmarknet:refresh:lock")
    if running is not None:
        return {**json.loads(running), "throttled": True}
    await cache_set("agmarknet:refresh:lock", json.dumps({"status": "running"}), ttl_seconds=REFRESH_LOCK_TTL_SECONDS)
    try:
        result = await agmarknet_sync.refresh_from_agmarknet()
    except Exception:  # noqa: BLE001 — clear the lock so the next call can retry
        await cache_delete("agmarknet:refresh:lock")
        raise
    result["throttled"] = False
    await cache_set("agmarknet:refresh:lock", json.dumps(result), ttl_seconds=REFRESH_LOCK_TTL_SECONDS)
    return result


@router.get("/analytics/movers")
async def analytics_movers(
    groupId: int | None = None,
    commodity: str | None = None,
    user: dict = Depends(_mandi_user),
):
    """Top gainers / losers by 1-day change + MSP spread (Agmarknet data)."""
    try:
        records = await agmarknet.fetch_dashboard(
            group_ids=[groupId] if groupId else None
        )
        rows = [n for n in (agmarknet_sync.normalize_record(r) for r in records) if n]
        source = "live"
    except agmarknet.AgmarknetError:
        rows = await agmarknet_sync.stored_snapshot()
        source = "stored"
    if commodity:
        wanted = commodity.strip().lower()
        rows = [r for r in rows if wanted in r["commodity"].lower()]
    if not rows:
        _error(404, "NO_DATA", "no Agmarknet data available yet — run POST /mandi/live/refresh")
    payload = {
        **agmarknet_sync.movers(rows),
        "count": len(rows),
        "reportedDate": max((r["reportedDate"] for r in rows), default=None),
        "source": source,
    }
    return payload
