"""Government open-data mandi price feed (data.gov.in records via techlitinc.in).

Replaces the retired Agmarknet scraper on the active /mandi/live path:

    React → FastAPI /mandi/live → this service → GET {base}/mandi_prices.php

The upstream PHP endpoint serves government open data originating from
data.gov.in (district / commodity / limit / offset query params, prices in
INR per quintal). Successful responses are cached for 15 minutes and a
separate last-good entry is kept so a failed refresh can fall back to stale
data (flagged "stale": true). Normalized records are snapshotted daily into
`mandi_price_history` under deterministic document keys so genuine history
accumulates without duplicates.
"""
import hashlib
import json
import logging
import re
from datetime import datetime, timezone

import httpx

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.core.db import set_doc

log = logging.getLogger(__name__)

SOURCE = "Open Government Data Platform India"
SOURCE_TAG = "gov-data"
SNAPSHOT_COLLECTION = "mandi_price_history"

CACHE_TTL_SECONDS = 15 * 60
UPSTREAM_TIMEOUT_SECONDS = 8.0
MIN_LIMIT = 1
MAX_LIMIT = 200
DEFAULT_LIMIT = 100
MAX_NAME_LENGTH = 80

# Last-good entries survive 7 days so a weekend upstream outage still has a
# stale fallback to show.
LAST_GOOD_TTL_SECONDS = 7 * 24 * 3600


class GovFeedError(RuntimeError):
    """Upstream failure. kind: transport | http | malformed."""

    def __init__(self, message: str, *, kind: str = "transport", status: int | None = None):
        super().__init__(message)
        self.kind = kind
        self.status = status


# ---------------- validation ----------------

def clean_name(value: object, field: str) -> str:
    """Non-empty, bounded, trimmed name. Raises GovFeedError on bad input."""
    text = str(value or "").strip()
    if not text:
        raise GovFeedError(f"{field} must be a non-empty string", kind="validation")
    if len(text) > MAX_NAME_LENGTH:
        raise GovFeedError(f"{field} is too long", kind="validation")
    return text


def clamp_limit(limit: int) -> int:
    return max(MIN_LIMIT, min(MAX_LIMIT, limit))


# ---------------- normalization ----------------

def _to_price(value: object) -> float | None:
    """Numeric INR/quintal price, or None when missing/unparseable.

    Malformed values are NEVER coerced to zero — callers drop the record.
    """
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        try:
            number = float(value.strip().replace(",", ""))
        except ValueError:
            return None
    else:
        return None
    if number != number or number < 0:  # NaN / negative
        return None
    return round(number, 2)


def _parse_price_date(value: object) -> str | None:
    """DD/MM/YYYY → YYYY-MM-DD; None when missing/invalid."""
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, "%d/%m/%Y").date().isoformat()
    except ValueError:
        return None


def _slug_part(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "na"


def record_id(district: str, market: str, commodity: str, variety: str, grade: str, price_date: str) -> str:
    """Deterministic id from location + crop + quality + date (never just commodity/market)."""
    raw = "|".join((district, market, commodity, variety, grade, price_date))
    return f"gov-{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:16]}"


def normalize_record(rec: object) -> dict | None:
    """Upstream record → normalized shape. Malformed records return None."""
    if not isinstance(rec, dict):
        return None
    state = str(rec.get("state") or "").strip()
    district = str(rec.get("district") or "").strip()
    market = str(rec.get("market") or "").strip()
    commodity = str(rec.get("commodity") or "").strip()
    if not district or not market or not commodity:
        return None
    price_date = _parse_price_date(rec.get("arrival_date"))
    if not price_date:
        return None
    min_price = _to_price(rec.get("min_price"))
    max_price = _to_price(rec.get("max_price"))
    modal_price = _to_price(rec.get("modal_price"))
    if min_price is None or max_price is None or modal_price is None:
        return None
    variety = str(rec.get("variety") or "").strip()
    grade = str(rec.get("grade") or "").strip()
    return {
        "id": record_id(district, market, commodity, variety, grade, price_date),
        "state": state,
        "district": district,
        "mandiName": market,
        "commodity": commodity,
        "variety": variety,
        "grade": grade,
        "minPrice": min_price,
        "maxPrice": max_price,
        "modalPrice": modal_price,
        "priceDate": price_date,
        "unit": "INR_PER_QUINTAL",
    }


# ---------------- upstream ----------------

def _endpoint() -> str:
    base = settings.mandi_gov_data_base_url.rstrip("/")
    return f"{base}/mandi_prices.php"


async def _fetch_once(params: dict[str, str]) -> dict:
    async with httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT_SECONDS) as client:
        resp = await client.get(_endpoint(), params=params)
    if resp.status_code != 200:
        raise GovFeedError(
            f"upstream HTTP {resp.status_code}",
            kind="http",
            status=resp.status_code,
        )
    try:
        payload = resp.json()
    except ValueError as exc:
        raise GovFeedError("upstream returned a non-JSON response", kind="malformed") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
        raise GovFeedError("upstream payload is malformed", kind="malformed")
    return payload


async def fetch_prices(
    district: str,
    commodity: str | None = None,
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
) -> dict:
    """Fetch the raw upstream payload. Retries once on timeout/5xx only."""
    params: dict[str, str] = {"district": district, "limit": str(clamp_limit(limit))}
    if commodity:
        params["commodity"] = commodity
    if offset:
        params["offset"] = str(offset)

    try:
        return await _fetch_once(params)
    except GovFeedError as exc:
        retryable = (
            exc.kind == "transport"
            or (exc.kind == "http" and exc.status is not None and exc.status >= 500)
        )
        if not retryable:
            raise
        log.warning("mandi gov feed retrying after %s", exc)
    return await _fetch_once(params)


# ---------------- history snapshots ----------------

def snapshot_doc_id(rec: dict) -> str:
    return record_id(
        rec["district"], rec["mandiName"], rec["commodity"],
        rec.get("variety") or "", rec.get("grade") or "", rec["priceDate"],
    )


async def snapshot_records(records: list[dict]) -> int:
    """Idempotent daily snapshots into `mandi_price_history` (deterministic keys).

    set_doc overwrites by id, so refetching the same upstream record never
    creates duplicates. Snapshot failures are logged and swallowed — they must
    never block the live-price response.
    """
    stored = 0
    for rec in records:
        try:
            await set_doc(
                SNAPSHOT_COLLECTION,
                snapshot_doc_id(rec),
                {
                    "id": snapshot_doc_id(rec),
                    "state": rec.get("state") or "",
                    "district": rec["district"],
                    "mandiName": rec["mandiName"],
                    "commodity": rec["commodity"],
                    "variety": rec.get("variety") or "",
                    "grade": rec.get("grade") or "",
                    "minPrice": rec["minPrice"],
                    "maxPrice": rec["maxPrice"],
                    "modalPrice": rec["modalPrice"],
                    "priceDate": rec["priceDate"],
                    # legacy `date` alias so existing /mandi/prices/history readers work
                    "date": rec["priceDate"],
                    "source": SOURCE_TAG,
                    "snapshotAt": datetime.now(timezone.utc).isoformat(),
                },
            )
            stored += 1
        except Exception as exc:  # noqa: BLE001 — snapshots must not break the live response
            log.warning("mandi history snapshot failed for %s: %s", rec.get("id"), exc)
    return stored


# ---------------- live service ----------------

def live_cache_key(district: str, commodity: str | None, limit: int, offset: int) -> str:
    return f"mandi-gov:live:{district.lower()}:{(commodity or '').lower()}:{limit}:{offset}"


def _build_payload(raw: dict, district: str, commodity: str | None, limit: int, offset: int) -> dict:
    records = [n for n in (normalize_record(r) for r in raw.get("records") or []) if n]
    price_dates = [r["priceDate"] for r in records]
    return {
        "data": records,
        "count": len(records),
        "total": raw.get("total") if isinstance(raw.get("total"), int) else len(records),
        "limit": limit,
        "offset": offset,
        "district": district,
        "commodity": commodity or "",
        "reportedDate": max(price_dates) if price_dates else None,
        "fetchedAt": raw.get("fetched_at")
        if isinstance(raw.get("fetched_at"), str)
        else datetime.now(timezone.utc).isoformat(),
        "source": SOURCE,
        "stale": False,
    }


async def get_live_prices(
    district: str,
    commodity: str | None = None,
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
    *,
    refresh: bool = False,
) -> dict:
    """Cached live prices with stale fallback. Raises GovFeedError when the
    upstream fails and no last-good response exists."""
    limit = clamp_limit(limit)
    key = live_cache_key(district, commodity, limit, offset)
    if not refresh:
        cached = await cache_get(key)
        if cached is not None:
            return json.loads(cached)

    try:
        raw = await fetch_prices(district, commodity=commodity, limit=limit, offset=offset)
    except GovFeedError:
        last = await cache_get(f"mandi-gov:last:{key}")
        if last is not None:
            payload = json.loads(last)
            payload["stale"] = True
            return payload
        raise

    payload = _build_payload(raw, district, commodity, limit, offset)
    await cache_set(key, json.dumps(payload), ttl_seconds=CACHE_TTL_SECONDS)
    await cache_set(f"mandi-gov:last:{key}", json.dumps(payload), ttl_seconds=LAST_GOOD_TTL_SECONDS)
    try:
        await snapshot_records(payload["data"])
    except Exception as exc:  # noqa: BLE001 — belt & braces; snapshot_records already swallows
        log.warning("mandi snapshot batch failed: %s", exc)
    return payload
