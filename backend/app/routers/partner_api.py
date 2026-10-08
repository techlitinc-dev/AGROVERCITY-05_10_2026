"""B2B partner read API (phase-08 WS-03, robust.md §8.9 G11).

Scoped, aggregated, anonymized intelligence only — district/crop-level
aggregates with a k-anonymity floor (k=5). No user-level data ever leaves via
this API. Every call is rate-limited per key and metered for billing.
"""
import base64
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.cache import get_redis, REDIS_ERRORS
from app.core.db import query, set_doc
from app.core.deps import require_scope
from app.core import ratelimit

router = APIRouter(prefix="/partner", tags=["partner"])

K_ANONYMITY_FLOOR = 5


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _cursor_index(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        return int(base64.urlsafe_b64decode(cursor.encode()).decode())
    except Exception:  # noqa: BLE001
        _error(400, "INVALID_CURSOR", "the pagination cursor is malformed")


def _encode_index(index: int) -> str:
    return base64.urlsafe_b64encode(str(index).encode()).decode()


async def _meter_and_limit(partner: dict) -> None:
    """Per-key rate limiting + usage metering (Redis daily + Firestore monthly)."""
    key_id = partner.get("keyId") or "unknown"
    await ratelimit.hit("partner", key_id, int(partner.get("rateLimit") or 60), 60)

    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    month = datetime.now(timezone.utc).strftime("%Y%m")
    count = None
    try:
        r = await get_redis()
        count = await r.incr(f"partner:usage:{key_id}:{day}")
        await r.expire(f"partner:usage:{key_id}:{day}", 2 * 86400)
    except REDIS_ERRORS:
        count = None

    await set_doc(
        "partner_usage",
        f"{key_id}:{month}",
        {
            "id": f"{key_id}:{month}",
            "keyId": key_id,
            "partnerId": partner.get("partnerId"),
            "period": month,
            "requests": int(count) if count is not None else None,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    # Billing hook: a metered-usage record the phase-00 billing module invoices
    # (pricing itself is a business decision — wire the hook only).
    record_id = f"usage_{uuid4().hex[:12]}"
    await set_doc(
        "billing_usage_records",
        record_id,
        {
            "id": record_id,
            "partnerId": partner.get("partnerId"),
            "keyId": key_id,
            "metric": "partner_api_requests",
            "quantity": 1,
            "period": month,
            "at": datetime.now(timezone.utc).isoformat(),
        },
    )


@router.get("/mandi/prices")
async def partner_mandi_prices(
    crop: str | None = Query(None),
    district: str | None = Query(None),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    cursor: str | None = Query(None),
    pageSize: int = Query(50, ge=1, le=200),
    partner: dict = Depends(require_scope("mandi:read")),
):
    await _meter_and_limit(partner)
    docs = await query("mandi_prices", [], limit=5000)
    buckets: dict[tuple[str, str], list[float]] = {}
    for doc in docs:
        commodity = str(doc.get("commodity") or "").strip()
        if not commodity:
            continue
        if crop and crop.lower() not in commodity.lower():
            continue
        bucket_district = str(doc.get("district") or district or "unknown").strip().lower()
        if district and bucket_district != district.strip().lower():
            continue
        day = str(doc.get("date") or "")
        if from_ and day and day < from_:
            continue
        if to and day and day > to:
            continue
        try:
            price = float(doc.get("modalPrice") or 0)
        except (TypeError, ValueError):
            continue
        buckets.setdefault((commodity, bucket_district), []).append(price)

    rows = []
    for (commodity, bucket_district), prices in buckets.items():
        if len(prices) < K_ANONYMITY_FLOOR:
            continue  # k-anonymity suppression — no rows for small cohorts
        rows.append(
            {
                "crop": commodity,
                "district": bucket_district,
                "sampleCount": len(prices),
                "avgModalPricePaisa": int(round(sum(prices) / len(prices) * 100)),
            }
        )
    rows.sort(key=lambda r: (r["crop"].lower(), r["district"]))
    start = _cursor_index(cursor)
    page = rows[start:start + pageSize]
    next_cursor = _encode_index(start + pageSize) if start + pageSize < len(rows) else None
    return {"items": page, "nextCursor": next_cursor}


@router.get("/advisory/saturation")
async def partner_saturation(
    district: str = Query(...),
    crop: str = Query(...),
    cursor: str | None = Query(None),
    pageSize: int = Query(50, ge=1, le=200),
    partner: dict = Depends(require_scope("saturation:read")),
):
    await _meter_and_limit(partner)
    cycles = await query(
        "crop_cycles",
        [("crop", "==", crop), ("district", "==", district)],
        limit=5000,
    )
    count = len(cycles)
    if count < K_ANONYMITY_FLOOR:
        return {"items": [], "nextCursor": None, "suppressed": True}
    if count < 20:
        risk = "green"
    elif count < 60:
        risk = "yellow"
    else:
        risk = "red"
    row = {"district": district, "crop": crop, "sowingCount": count, "riskLevel": risk}
    return {"items": [row], "nextCursor": None, "suppressed": False}
