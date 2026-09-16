import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.cache import cache_get, cache_set
from app.core.db import query
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/mandi", tags=["mandi"])

MANDI_ROLES = ("farmer", "seller", "broker")


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
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
