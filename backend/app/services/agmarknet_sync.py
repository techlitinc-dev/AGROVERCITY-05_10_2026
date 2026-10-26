"""Sync + analytics over the Agmarknet daily dashboard data.

`refresh_from_agmarknet` scrapes every commodity group via the captcha-free
dashboard endpoint and upserts into the existing `mandi_prices` /
`mandi_price_history` collections (source-tagged "agmarknet") so the rest of
the mandi module — compare, smart-select, price history — reads real data.
"""
import logging
import re
from datetime import date, datetime, timedelta

from app.core.db import query, set_doc
from app.services import agmarknet

log = logging.getLogger(__name__)

SOURCE = "agmarknet"
MANDI_NAME = "National (Agmarknet)"

_FLOAT_FIELDS = (
    "as_on_price",
    "one_day_ago_price",
    "two_day_ago_price",
    "as_on_arrival",
    "one_day_ago_arrival",
    "two_day_ago_arrival",
)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (name or "").lower()).strip("_") or "unknown"


def _to_float(value) -> float | None:
    try:
        if value is None or value == "":
            return None
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


def _parse_reported_date(value: str | None) -> date:
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except (TypeError, ValueError):
            continue
    return date.today()


def normalize_record(rec: dict) -> dict | None:
    """Dashboard row → clean shape shared by the live endpoints and analytics."""
    name = (rec.get("cmdt_name") or "").strip()
    as_on = _to_float(rec.get("as_on_price"))
    if not name or as_on is None:
        return None
    day_ago = _to_float(rec.get("one_day_ago_price"))
    change_pct = None
    if day_ago:
        change_pct = round((as_on - day_ago) / day_ago * 100, 2)
    reported = _parse_reported_date(rec.get("reported_date"))
    msp = _to_float(rec.get("msp_price"))
    return {
        "commodity": name,
        "group": rec.get("cmdt_grp_name") or "",
        "modalPrice": as_on,
        "oneDayAgoPrice": day_ago,
        "twoDayAgoPrice": _to_float(rec.get("two_day_ago_price")),
        "arrivalMt": _to_float(rec.get("as_on_arrival")),
        "oneDayAgoArrivalMt": _to_float(rec.get("one_day_ago_arrival")),
        "msp": msp,
        "reportedDate": reported.isoformat(),
        "trend": "up" if (change_pct or 0) > 0.05 else "down" if (change_pct or 0) < -0.05 else "flat",
        "changePercent": change_pct,
        "aboveMsp": None if msp is None else as_on >= msp,
    }


async def refresh_from_agmarknet() -> dict:
    """Scrape all commodity groups and upsert into mandi_prices + history."""
    filters = await agmarknet.fetch_filters()
    groups = [g["id"] for g in filters.get("cmdt_group_data", []) if isinstance(g.get("id"), int)]
    if not groups:
        groups = [agmarknet.ALL_GROUP]

    merged: dict[str, dict] = {}
    empty_groups = 0
    errors = 0
    for gid in groups:
        try:
            records = await agmarknet.fetch_dashboard(group_ids=[gid])
        except agmarknet.AgmarknetError as exc:
            errors += 1
            log.warning("agmarknet group %s fetch failed: %s", gid, exc)
            continue
        if not records:
            empty_groups += 1
        for rec in records:
            name = (rec.get("cmdt_name") or "").strip()
            if name and name not in merged:
                merged[name] = rec

    stored_prices = 0
    stored_history = 0
    for name, rec in merged.items():
        norm = normalize_record(rec)
        if norm is None:
            continue
        slug = _slug(name)
        reported = _parse_reported_date(rec.get("reported_date"))
        change = f"{norm['changePercent']:+.1f}%" if norm["changePercent"] is not None else "—"
        await set_doc(
            "mandi_prices",
            f"agm-{slug}",
            {
                "id": f"agm-{slug}",
                "mandiName": MANDI_NAME,
                "district": "All India",
                "state": "India",
                "commodity": name,
                "variety": norm["group"],
                "minPrice": norm["twoDayAgoPrice"] or norm["modalPrice"],
                "maxPrice": norm["modalPrice"],
                "modalPrice": norm["modalPrice"],
                "msp": norm["msp"],
                "trend": norm["trend"],
                "changePercent": change,
                "arrivalsQuintals": round((norm["arrivalMt"] or 0) * 10, 1),
                "updatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
                "date": norm["reportedDate"],
                "source": SOURCE,
            },
        )
        stored_prices += 1
        # 3 daily points per commodity → existing /prices/history reads these.
        for offset, key in ((0, "modalPrice"), (1, "oneDayAgoPrice"), (2, "twoDayAgoPrice")):
            price = norm[key]
            if price is None:
                continue
            point_date = (reported - timedelta(days=offset)).isoformat()
            await set_doc(
                "mandi_price_history",
                f"agm-{slug}-{point_date}",
                {
                    "commodity": name,
                    "mandiName": MANDI_NAME,
                    "date": point_date,
                    "modalPrice": price,
                    "source": SOURCE,
                },
            )
            stored_history += 1

    result = {
        "commodities": stored_prices,
        "historyPoints": stored_history,
        "groups": len(groups),
        "emptyGroups": empty_groups,
        "groupErrors": errors,
        "reportedDate": max(
            (normalize_record(r) or {}).get("reportedDate", "") for r in merged.values()
        ) if merged else None,
        "refreshedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
    }
    log.info("agmarknet refresh: %s", result)
    return result


async def stored_snapshot() -> list[dict]:
    """Latest normalized snapshot from the stored agmarknet docs (if any)."""
    docs = await query("mandi_prices", [("source", "==", SOURCE)], limit=1000)
    out = []
    for d in docs:
        modal = _to_float(d.get("modalPrice"))
        if modal is None:
            continue
        change = d.get("changePercent") or "—"
        change_pct = None
        if isinstance(change, str) and change.endswith("%"):
            change_pct = _to_float(change.rstrip("%"))
        out.append(
            {
                "commodity": d.get("commodity", ""),
                "group": d.get("variety", ""),
                "modalPrice": modal,
                "oneDayAgoPrice": None,
                "twoDayAgoPrice": _to_float(d.get("minPrice")) if d.get("minPrice") != modal else None,
                "arrivalMt": (_to_float(d.get("arrivalsQuintals")) or 0) / 10 or None,
                "oneDayAgoArrivalMt": None,
                "msp": _to_float(d.get("msp")),
                "reportedDate": d.get("date") or "",
                "trend": d.get("trend") or "flat",
                "changePercent": change_pct,
                "aboveMsp": None,
            }
        )
    return out


def movers(records: list[dict], limit: int = 5) -> dict:
    """Top gainers / losers by 1-day % change + MSP spread, from normalized rows."""
    ranked = [r for r in records if r.get("changePercent") is not None]
    ranked.sort(key=lambda r: r["changePercent"], reverse=True)
    gainers = [
        {**r, "changePercent": r["changePercent"]} for r in ranked[:limit] if r["changePercent"] > 0
    ]
    losers = [
        {**r, "changePercent": r["changePercent"]}
        for r in reversed(ranked[-limit:])
        if r["changePercent"] < 0
    ]
    msp_rows = []
    for r in records:
        msp = r.get("msp")
        if msp:
            msp_rows.append({**r, "aboveMsp": r["modalPrice"] >= msp})
    msp_rows.sort(key=lambda r: (r["modalPrice"] - r["msp"]) / r["msp"], reverse=True)
    return {
        "gainers": gainers,
        "losers": losers,
        "mspComparison": msp_rows[:10],
        "mspBelowCount": sum(1 for r in msp_rows if not r["aboveMsp"]),
        "mspTotalCount": len(msp_rows),
    }
