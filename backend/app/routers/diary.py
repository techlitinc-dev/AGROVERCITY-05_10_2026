import json
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.core.cache import cache_delete, cache_get, cache_set
from app.core.db import delete_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.diary import (
    DiaryAnalyticsOut,
    DiaryEntryCreated,
    DiaryEntryIn,
    DiaryEntryOut,
    DiaryPhotoUploadOut,
)
from app.services import reports, storage
from app.services.coins import award_coins
from app.services.diary_analytics import filter_by_range, summarize
from app.services.users import get_user
from app.routers.users import require_role

router = APIRouter(prefix="/diary", tags=["diary"])

MAX_PAGE_SIZE = 200
MAX_PHOTOS_PER_UPLOAD = 3
PHOTO_CONTENT_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
ANALYTICS_CACHE_TTL_SECONDS = 300


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _farmer_or_landlord(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "farmLandlord")
    return uid


async def list_subdocs(path: str) -> list[dict]:
    return await query(path, [], limit=1000)


def _analytics_cache_key(uid: str, from_date: str | None, to_date: str | None) -> str:
    return f"diary:analytics:{uid}:{from_date or ''}:{to_date or ''}"


async def _invalidate_analytics_cache(uid: str):
    # Only the unfiltered key is deleted eagerly; ranged variants expire via
    # TTL because cache.py has no scan/clear helper to enumerate from/to pairs.
    await cache_delete(_analytics_cache_key(uid, None, None))


async def _filtered_entries(
    uid: str,
    type: str | None,
    category: str | None,
    from_date: str | None,
    to_date: str | None,
) -> list[dict]:
    entries = await list_subdocs(f"users/{uid}/diary_entries")
    if type is not None:
        entries = [e for e in entries if e.get("type") == type]
    if category is not None:
        entries = [e for e in entries if e.get("category") == category]
    if from_date is not None:
        entries = [e for e in entries if e.get("date", "") >= from_date]
    if to_date is not None:
        entries = [e for e in entries if e.get("date", "") <= to_date]
    return sorted(entries, key=lambda e: e.get("date", ""), reverse=True)


@router.get("/entries")
async def list_entries(
    type: str | None = None,
    category: str | None = None,
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=MAX_PAGE_SIZE),
    uid: str = Depends(_farmer_or_landlord),
):
    entries = await _filtered_entries(uid, type, category, from_date, to_date)
    total = len(entries)
    start = (page - 1) * pageSize
    return {
        "data": entries[start:start + pageSize],
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }


@router.post("/entries", status_code=201, response_model=DiaryEntryCreated)
async def create_entry(body: DiaryEntryIn, uid: str = Depends(_farmer_or_landlord)):
    entry_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    entry = DiaryEntryOut(id=entry_id, createdAt=now, updatedAt=now, **body.model_dump())
    await set_doc(f"users/{uid}/diary_entries", entry_id, entry.model_dump())
    await award_coins(uid, 15, "diary_entry", entry_id)
    await _invalidate_analytics_cache(uid)
    return DiaryEntryCreated(entry=entry, agriCoinsEarned=15)


@router.put("/entries/{entry_id}")
async def update_entry(
    entry_id: str,
    body: DiaryEntryIn,
    uid: str = Depends(_farmer_or_landlord),
):
    entries = await list_subdocs(f"users/{uid}/diary_entries")
    existing = next((e for e in entries if e.get("id") == entry_id), None)
    if existing is None:
        _error(404, "ENTRY_NOT_FOUND", "diary entry not found")
    now = datetime.now(timezone.utc).isoformat()
    data = body.model_dump()
    data["id"] = entry_id
    data["createdAt"] = existing.get("createdAt") or now
    data["updatedAt"] = now
    await set_doc(f"users/{uid}/diary_entries", entry_id, data)
    await _invalidate_analytics_cache(uid)
    return {"entry": DiaryEntryOut(**data)}


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_entry(entry_id: str, uid: str = Depends(_farmer_or_landlord)):
    entries = await list_subdocs(f"users/{uid}/diary_entries")
    if not any(e.get("id") == entry_id for e in entries):
        _error(404, "ENTRY_NOT_FOUND", "diary entry not found")
    await delete_doc(f"users/{uid}/diary_entries", entry_id)
    await _invalidate_analytics_cache(uid)


@router.get("/analytics/summary", response_model=DiaryAnalyticsOut)
async def analytics_summary(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    uid: str = Depends(_farmer_or_landlord),
):
    key = _analytics_cache_key(uid, from_date, to_date)
    cached = await cache_get(key)
    if cached is not None:
        return json.loads(cached)
    filters = []
    if from_date is not None:
        filters.append(("date", ">=", from_date))
    if to_date is not None:
        filters.append(("date", "<=", to_date))
    entries = await query(f"users/{uid}/diary_entries", filters, limit=1000)
    payload = summarize(filter_by_range(entries, from_date, to_date))
    payload["from"] = from_date
    payload["to"] = to_date
    await cache_set(key, json.dumps(payload), ttl_seconds=ANALYTICS_CACHE_TTL_SECONDS)
    return payload


@router.post("/entries/{entry_id}/photos", status_code=201, response_model=DiaryPhotoUploadOut)
async def upload_entry_photos(
    entry_id: str,
    files: list[UploadFile] = File(...),
    uid: str = Depends(_farmer_or_landlord),
):
    entries = await list_subdocs(f"users/{uid}/diary_entries")
    if not any(e.get("id") == entry_id for e in entries):
        _error(404, "ENTRY_NOT_FOUND", "diary entry not found")
    if not 1 <= len(files) <= MAX_PHOTOS_PER_UPLOAD:
        _error(
            400,
            "VALIDATION_ERROR",
            "एक से तीन फोटो अपलोड करें",
            {"files": f"between 1 and {MAX_PHOTOS_PER_UPLOAD} photos allowed"},
        )
    urls = []
    for file in files:
        if file.content_type not in PHOTO_CONTENT_TYPES:
            _error(
                400,
                "VALIDATION_ERROR",
                "केवल JPEG, PNG या WebP फोटो स्वीकार्य हैं",
                {"files": f"unsupported content type: {file.content_type}"},
            )
        data = await file.read()
        if len(data) > storage.MAX_UPLOAD_BYTES:
            _error(
                400,
                "VALIDATION_ERROR",
                "प्रत्येक फोटो 5 MB से छोटी होनी चाहिए",
                {"files": "file exceeds 5 MB"},
            )
        ext = PHOTO_CONTENT_TYPES[file.content_type]
        blob_path, _ = storage.upload_user_file(
            uid,
            data,
            f"{entry_id}/{uuid.uuid4().hex}.{ext}",
            file.content_type,
            prefix="diary",
        )
        urls.append(storage.signed_download_url(blob_path))
    return DiaryPhotoUploadOut(photoUrls=urls)


@router.get("/report")
async def diary_report(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    uid: str = Depends(_farmer_or_landlord),
):
    today = date.today()
    if from_date is None:
        from_date = today.replace(day=1).isoformat()
    if to_date is None:
        if today.month == 12:
            first_next = today.replace(year=today.year + 1, month=1, day=1)
        else:
            first_next = today.replace(month=today.month + 1, day=1)
        to_date = (first_next - timedelta(days=1)).isoformat()
    entries = await _filtered_entries(uid, None, None, from_date, to_date)
    path = reports.build_diary_pdf(uid, entries, from_date, to_date)
    url = reports.upload_to_storage(path, f"reports/{uid}/diary_{uuid.uuid4().hex[:8]}.pdf")
    return {
        "reportUrl": url,
        "entryCount": len(entries),
        "from": from_date,
        "to": to_date,
    }
