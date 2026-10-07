import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.cache import cache_get, cache_set
from app.core.db import get_doc, query
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services.ai import gateway
from app.services.mandi_forecast import CACHE_COLLECTION as FORECAST_COLLECTION
from app.services.mandi_forecast import forecast_doc_id
from app.services.mandi_smart import build_smart_select_state
from app.services.users import get_user

router = APIRouter(prefix="/mandi", tags=["mandi"])

MANDI_ROLES = ("farmer", "seller", "broker", "directBuyer")

# Smart mandi selection (brief M12, SDR) — question set / AI-feature tag / cache.
SMART_SELECT_QUESTION_SET = "mandi.smart_select.v1"
SMART_SELECT_MODULE = "mandi_smart_select"
# 15-minute server-side cache keyed by (crop, district, mandi set) — the AI
# call is never triggered by a page view (task 1.12).
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
    crop: str,
    quantityQuintals: float,
    lat: float | None = None,
    lng: float | None = None,
    user: dict = Depends(_mandi_user),
):
    if quantityQuintals <= 0:
        _error(422, "INVALID_QUANTITY", "quantityQuintals must be greater than 0")
    docs = await query("mandi_prices", [], limit=1000)
    docs = [d for d in docs if _crop_match(crop, d.get("commodity", ""))]
    items = [
        {
            "mandiName": d["mandiName"],
            "modalPrice": d["modalPrice"],
            "transportCost": d["distanceKm"] * 12,
            "netProfit": d["modalPrice"] * quantityQuintals - d["distanceKm"] * 12,
        }
        for d in docs
    ]
    items.sort(key=lambda i: i["netProfit"], reverse=True)
    return {"data": items}


@router.get("/prices/history")
async def price_history(
    crop: str | None = None,
    mandi: str | None = None,
    months: int = 3,
    user: dict = Depends(_mandi_user),
):
    if not crop or not mandi:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "crop and mandi are required",
                "fieldErrors": {
                    **({"crop": "required"} if not crop else {}),
                    **({"mandi": "required"} if not mandi else {}),
                },
            },
        )
    months = max(1, min(36, months))
    docs = await query("mandi_price_history", [], limit=10000)
    docs = [
        d
        for d in docs
        if _crop_match(crop, d.get("commodity", "")) and mandi.lower() in d.get("mandiName", "").lower()
    ]
    docs.sort(key=lambda d: d["date"])
    docs = docs[-months * 30:]
    return {"data": [{"date": d["date"], "modalPrice": d["modalPrice"]} for d in docs]}


@router.get("/forecast")
async def forecast(
    crop: str | None = None,
    mandi: str | None = None,
    user: dict = Depends(_mandi_user),
):
    """Cached 7/30-day price band (brief M12, nightly SGR job).

    Read-only by design: it NEVER calls the model. The band is written by
    `services/mandi_forecast.run_nightly_forecast()`; without a cached band the
    endpoint answers the standard 404 envelope so the client keeps the plain
    compare view (no chart, no invented numbers).
    """
    if not crop or not mandi:
        _error(
            422,
            "VALIDATION_ERROR",
            "crop and mandi are required",
            {
                **({"crop": "required"} if not crop else {}),
                **({"mandi": "required"} if not mandi else {}),
            },
        )
    doc = await get_doc(FORECAST_COLLECTION, forecast_doc_id(crop, mandi))
    if doc is None:
        _error(404, "FORECAST_NOT_FOUND", "no cached forecast for this crop and mandi")
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
        result = await gateway.decide(
            state, SMART_SELECT_QUESTION_SET, ctx=str(user.get("id") or ""), module=SMART_SELECT_MODULE
        )
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
