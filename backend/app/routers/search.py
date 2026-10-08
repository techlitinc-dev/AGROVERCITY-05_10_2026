"""Global keyword search (phase-05 WS-09, tasks 9.4 / 9.5).

`GET /v1/search?q=` performs case-insensitive substring/prefix keyword matching
across six indexes — schemes, products, news, crops (reference), courses, lots —
and returns them grouped by module::

    {
      "query": "pyaz",
      "schemes":  [...], "products": [...], "news": [...],
      "crops":    [...], "courses":  [...], "lots": [...],
      "nextCursor": {"schemes": null|"<cursor>", "products": ..., ...}
    }

Each group carries its own opaque pagination cursor (rule 7). To advance a single
group pass `cursorLots=<cursor>` (or `cursorSchemes`, `cursorProducts`,
`cursorNews`, `cursorCrops`, `cursorCourses`) — the other groups are returned
from their first page. Failures use the standard
`{"error": {code, message, fieldErrors}}` envelope.

No AI calls live here: matching is plain substring on the searchable fields. The
shape (per-index cursors + grouped hits) is deliberately kept compatible with the
phase-06 M23 embeddings/intent upgrade — each index answers the same contract.
"""

from typing import Callable

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import settings
from app.core.db import query
from app.core.deps import current_user_id
from app.core.pagination import InvalidCursor, decode_cursor, encode_cursor
from app.services import search_index
from app.services.ai import config_store, gateway, privacy

router = APIRouter(prefix="/search", tags=["search"])

SEARCH_INTENT_MODULE = "search_intent"
SEARCH_EMBEDDINGS_MODULE = "search_embeddings"

# The six indexes, in stable response order.
GROUPS: tuple[str, ...] = ("schemes", "products", "news", "crops", "courses", "lots")

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
_SCAN_LIMIT = 1000


class _InvalidCursor(Exception):
    """Raised when a per-group cursor cannot be decoded."""


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def _norm(value) -> str:
    return "" if value is None else str(value).lower()


def _hit(needle: str, *values) -> bool:
    """Case-insensitive substring match (a prefix is a substring)."""
    for value in values:
        if isinstance(value, (list, tuple, set)):
            if any(needle in _norm(v) for v in value):
                return True
        elif needle in _norm(value):
            return True
    return False


def _decode_offset(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        return max(0, int(decode_cursor(cursor)))
    except (InvalidCursor, ValueError, TypeError) as exc:
        raise _InvalidCursor from exc


def _paginate(items: list[dict], cursor: str | None, page_size: int) -> tuple[list[dict], str | None]:
    start = _decode_offset(cursor)
    window = items[start : start + page_size]
    has_more = start + page_size < len(items)
    next_cursor = encode_cursor(start + page_size) if has_more and window else None
    return window, next_cursor


async def _search_schemes(needle: str) -> list[dict]:
    docs = await query("schemes", [], limit=_SCAN_LIMIT)
    items = [
        {
            "id": d.get("id"),
            "name": d.get("name"),
            "category": d.get("category"),
            "benefitAmount": d.get("benefitAmount"),
            "nextDeadline": d.get("nextDeadline"),
            "description": d.get("description"),
            "deepLink": f"/dashboard/p/schemes/{d.get('id')}",
        }
        for d in docs
        if _hit(needle, d.get("name"), d.get("category"), d.get("description"))
    ]
    items.sort(key=lambda i: _norm(i.get("name")))
    return items


async def _search_products(needle: str) -> list[dict]:
    docs = await query("products", [], limit=_SCAN_LIMIT)
    items = [
        {
            "id": d.get("id"),
            "title": d.get("title"),
            "vernacularTitle": d.get("vernacularTitle"),
            "category": d.get("category"),
            "brand": d.get("brand"),
            "mrp": d.get("mrp"),
            "discountedPrice": d.get("discountedPrice"),
            "deepLink": f"/dashboard/p/marketplace/{d.get('id')}",
        }
        for d in docs
        if _hit(needle, d.get("title"), d.get("vernacularTitle"), d.get("category"), d.get("brand"))
    ]
    items.sort(key=lambda i: _norm(i.get("title")))
    return items


async def _search_news(needle: str) -> list[dict]:
    docs = await query("news", [], limit=_SCAN_LIMIT)
    items = [
        {
            "id": d.get("id"),
            "title": d.get("title"),
            "vernacularTitle": d.get("vernacularTitle"),
            "summary": d.get("summary"),
            "category": d.get("category"),
            "timestamp": d.get("timestamp"),
            "deepLink": f"/dashboard/p/agriNews/{d.get('id')}",
        }
        for d in docs
        if _hit(
            needle,
            d.get("title"),
            d.get("vernacularTitle"),
            d.get("summary"),
            d.get("content"),
            d.get("category"),
        )
    ]
    items.sort(key=lambda i: str(i.get("timestamp") or ""), reverse=True)
    return items


async def _search_crops(needle: str) -> list[dict]:
    """Crops index — the reference crop catalog (`crops`) merged with the
    MSP-notified crop names (`msp_reference`, seeded by seeding script; see
    routers/reference.py). A crop present in both is deduped by name.
    """
    items: list[dict] = []
    seen: set[str] = set()
    catalog = await query("crops", [], limit=_SCAN_LIMIT)
    for d in catalog:
        key = _norm(d.get("name"))
        seen.add(key)
        if _hit(needle, d.get("name"), d.get("vernacularName"), d.get("category"), d.get("aliases")):
            items.append(
                {
                    "id": d.get("id") or key,
                    "name": d.get("name"),
                    "vernacularName": d.get("vernacularName"),
                    "category": d.get("category"),
                    "mspPaisa": d.get("msp_paisa"),
                    "deepLink": f"/dashboard/p/mandi?crop={d.get('name')}",
                }
            )
    msp_docs = await query("msp_reference", [], limit=_SCAN_LIMIT)
    for d in msp_docs:
        key = _norm(d.get("crop"))
        if key in seen:
            continue
        seen.add(key)
        if _hit(needle, d.get("crop")):
            items.append(
                {
                    "id": d.get("id") or key,
                    "name": d.get("crop"),
                    "vernacularName": None,
                    "category": "reference",
                    "mspPaisa": d.get("msp_paisa"),
                    "deepLink": f"/dashboard/p/mandi?crop={d.get('crop')}",
                }
            )
    items.sort(key=lambda i: _norm(i.get("name")))
    return items


async def _search_courses(needle: str) -> list[dict]:
    docs = await query("courses", [], limit=_SCAN_LIMIT)
    items = [
        {
            "id": d.get("id"),
            "title": d.get("title"),
            "subtitle": d.get("subtitle"),
            "category": d.get("category"),
            "instructorName": d.get("instructorName"),
            "priceRupees": d.get("priceRupees"),
            "thumbnailUrl": d.get("thumbnailUrl"),
            "deepLink": f"/dashboard/p/courses/{d.get('id')}",
        }
        for d in docs
        if d.get("status") == "published"
        and _hit(
            needle,
            d.get("title"),
            d.get("subtitle"),
            d.get("description"),
            d.get("instructorName"),
            d.get("category"),
            d.get("tags"),
        )
    ]
    items.sort(key=lambda i: _norm(i.get("title")))
    return items


async def _search_lots(needle: str) -> list[dict]:
    docs = await query("market_lots", [], limit=_SCAN_LIMIT)
    items = []
    for d in docs:
        status = d.get("status")
        if status is not None and status != "open":
            continue
        loc = d.get("location") or {}
        if _hit(
            needle,
            d.get("crop"),
            d.get("grade"),
            d.get("variety"),
            loc.get("village"),
            loc.get("district"),
            loc.get("state"),
        ):
            items.append(
                {
                    "id": d.get("id"),
                    "crop": d.get("crop"),
                    "grade": d.get("grade"),
                    "quantityQuintals": d.get("quantityQuintals"),
                    "expectedRate": d.get("expectedRate"),
                    "harvestDate": d.get("harvestDate"),
                    "location": loc,
                    "status": status,
                    "deepLink": f"/dashboard/p/browseLots/{d.get('id')}",
                }
            )
    items.sort(key=lambda i: str(i.get("harvestDate") or ""), reverse=True)
    return items


_BUILDERS: dict[str, Callable] = {
    "schemes": _search_schemes,
    "products": _search_products,
    "news": _search_news,
    "crops": _search_crops,
    "courses": _search_courses,
    "lots": _search_lots,
}


def merge_hits(keyword_items: list[dict], semantic_hits: list[dict]) -> list[dict]:
    """Merge keyword + cosine hits by doc id (WS-08 M23).

    Final score = keyword score + cosine score; a keyword match wins ties, so a
    doc matching both ranks above a keyword-only doc, which ranks above a
    cosine-only doc.
    """
    merged: dict[str, dict] = {}
    for item in keyword_items:
        merged[item["id"]] = {"item": item, "score": 1.0, "keyword": True}
    for hit in semantic_hits:
        doc_id = hit.get("docId")
        if doc_id is None:
            continue
        entry = merged.get(doc_id)
        if entry is not None:
            entry["score"] += float(hit.get("score") or 0.0)
        else:
            merged[doc_id] = {
                "item": {"id": doc_id, "text": hit.get("text", "")},
                "score": float(hit.get("score") or 0.0),
                "keyword": False,
            }
    ordered = sorted(merged.values(), key=lambda entry: (-entry["score"], not entry["keyword"]))
    return [entry["item"] for entry in ordered]


async def _semantic_enabled() -> bool:
    """Embedding path runs only with a real provider and the module flag on."""
    if settings.ai_provider == "shim":
        return False
    return await config_store.module_enabled(SEARCH_EMBEDDINGS_MODULE)


async def _intent_index(needle: str) -> str | None:
    state = privacy.sanitize_state({"query": needle})
    answers = (
        await gateway.decide(state, "search.intent.v1", module=SEARCH_INTENT_MODULE)
    ).answers
    index = (answers or {}).get("index")
    return index if index in GROUPS else None


@router.get("")
async def global_search(
    q: str = Query(default=""),
    pageSize: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    cursorSchemes: str | None = Query(None),
    cursorProducts: str | None = Query(None),
    cursorNews: str | None = Query(None),
    cursorCrops: str | None = Query(None),
    cursorCourses: str | None = Query(None),
    cursorLots: str | None = Query(None),
    _uid: str = Depends(current_user_id),
):
    needle = (q or "").strip().lower()
    if not needle:
        _error(400, "EMPTY_QUERY", "query parameter 'q' is required")

    cursors = {
        "schemes": cursorSchemes,
        "products": cursorProducts,
        "news": cursorNews,
        "crops": cursorCrops,
        "courses": cursorCourses,
        "lots": cursorLots,
    }

    semantic = await _semantic_enabled()
    chosen = await _intent_index(needle)
    order = GROUPS if not chosen else (chosen, *[g for g in GROUPS if g != chosen])

    response: dict = {"query": q, "nextCursor": {}}
    try:
        for group in order:
            items = await _BUILDERS[group](needle)
            if semantic:
                try:
                    hits = await search_index.search_similar(group, needle, limit=20)
                    items = merge_hits(items, hits)
                except Exception:  # noqa: BLE001 — semantic failure falls back to keyword
                    pass
            window, next_cursor = _paginate(items, cursors[group], pageSize)
            response[group] = window
            response["nextCursor"][group] = next_cursor
    except _InvalidCursor:
        _error(400, "INVALID_CURSOR", "the pagination cursor is not valid")
    return response
