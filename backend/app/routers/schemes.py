import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.pagination import InvalidCursor, decode_cursor, encode_cursor
from app.data.schemes_seed import PORTALS
from app.models.schemes import PortalEntry, SchemeApplyIn, SchemeApplyOut
from app.routers.users import require_role
from app.services.eligibility import evaluate, is_eligible, missing_documents
from app.services.schemes_match import match_schemes
from app.services.tasks import emit_task
from app.services.users import get_user

router = APIRouter(prefix="/schemes", tags=["schemes"])

# Deadline reminders: an eligible scheme whose `nextDeadline` falls inside this
# window emits a farmer task. The nightly sweep is scheduled in phase-07 ops; the
# endpoint below is the deterministic emission point the reminder job calls.
SCHEME_REMINDER_WINDOW_DAYS = 30
SCHEMES_DEEP_LINK = "/dashboard/p/schemes"

# Deferred(2026-10-03, phase-07): admin scheme editor UI (A3). Hook: scheme docs
# carry editable fields (name, eligibilityRules, nextDeadline, status,
# benefitAmount, documentsRequired, description, portal_url) via Firestore; the
# editor only needs CRUD over the `schemes` collection.


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "farmLandlord")
    return user


async def _vault_doc_types(uid: str) -> list[str]:
    docs = await query(f"users/{uid}/vault_documents", [], limit=200)
    return [str(d.get("docType") or "") for d in docs if d.get("docType")]


def _portal_url(scheme_id: str) -> str | None:
    for portal in PORTALS:
        if portal.get("schemeId") == scheme_id:
            return portal.get("portalUrl")
    return None


def _public(scheme: dict, user: dict) -> dict:
    return {
        "id": scheme["id"],
        "name": scheme["name"],
        "category": scheme["category"],
        "eligible": is_eligible(user, scheme.get("eligibilityRules") or {}),
        "benefitAmount": scheme["benefitAmount"],
        "documentsRequired": scheme.get("documentsRequired", []),
        "status": scheme["status"],
        "nextDeadline": scheme["nextDeadline"],
        "description": scheme["description"],
    }


def _missing_for(scheme: dict, vault_types: list[str]) -> list[str]:
    return missing_documents(scheme.get("documentsRequired") or [], vault_types)


@router.get("")
async def list_schemes(
    category: str | None = None,
    eligibleOnly: bool = False,
    cursor: str | None = Query(None),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(_user),
):
    """Discovery list — server-ordered matched-to-profile first (task 5.9).

    Cursor pagination (rule 7): the opaque cursor carries the next offset; the
    client never sees a page number.
    """
    vault_types = await _vault_doc_types(user["id"])
    schemes = await query("schemes", [], limit=200)
    items = [_public(s, user) for s in schemes]
    if category:
        items = [s for s in items if s["category"] == category]
    if eligibleOnly:
        items = [s for s in items if s["eligible"]]
    by_id = {s["id"]: s for s in schemes}
    items.sort(
        key=lambda s: (
            not s["eligible"],
            len(_missing_for(by_id.get(s["id"], {}), vault_types)),
            str(s["name"]).lower(),
        )
    )
    total = len(items)
    start = 0
    if cursor:
        try:
            start = int(decode_cursor(cursor))
        except (InvalidCursor, ValueError, TypeError):
            _error(400, "INVALID_CURSOR", "the pagination cursor is not valid")
    window = items[start : start + pageSize]
    next_cursor = encode_cursor(start + pageSize) if start + pageSize < total else None
    return {"data": window, "page": 1, "pageSize": pageSize, "total": total, "nextCursor": next_cursor}


@router.get("/portals")
async def list_portals(user: dict = Depends(_user)):
    return {"data": [PortalEntry(**p).model_dump() for p in PORTALS]}


@router.get("/matches")
async def list_matches(
    lang: str | None = Query(None),
    emitTasks: bool = Query(True),
    user: dict = Depends(_user),
):
    """AI scheme matching (M21, SDR). Rules decide eligibility; the model ranks
    and explains. Launches at `suggest`."""
    vault_types = await _vault_doc_types(user["id"])
    profile = {**user, "vaultDocTypes": vault_types}
    schemes = await query("schemes", [], limit=200)
    matches = await match_schemes(
        profile, schemes, lang=(lang or "en"), emit_tasks=emitTasks
    )
    return {"data": matches}


@router.post("/deadline-reminders")
async def deadline_reminders(
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user: dict = Depends(_user),
):
    """Emit a task for every eligible scheme whose deadline is approaching.

    Dedupe-safe via the task engine (`schemes:scheme_deadline:<id>`); the nightly
    reminder job calls this same function. `Idempotency-Key` is accepted on the
    write per rule 7 (the emission itself is already idempotent).
    """
    task_ids = await emit_scheme_deadline_tasks(user)
    return {"data": {"emitted": task_ids}}


@router.get("/{scheme_id}")
async def scheme_detail(scheme_id: str, user: dict = Depends(_user)):
    """Scheme detail + eligibility checklist + required-document vault status.

    The checklist is computed server-side (`services/eligibility.py`); the client
    renders each criterion met/unmet and never re-derives eligibility.
    """
    scheme = await get_doc("schemes", scheme_id)
    if scheme is None:
        _error(404, "SCHEME_NOT_FOUND", "scheme not found")
    vault_types = await _vault_doc_types(user["id"])
    required = scheme.get("documentsRequired") or []
    missing = set(_missing_for(scheme, vault_types))
    documents = [{"name": doc, "present": doc not in missing} for doc in required]
    return {
        "id": scheme["id"],
        "name": scheme["name"],
        "category": scheme["category"],
        "eligible": is_eligible(user, scheme.get("eligibilityRules") or {}),
        "benefitAmount": scheme["benefitAmount"],
        "status": scheme["status"],
        "nextDeadline": scheme["nextDeadline"],
        "description": scheme["description"],
        "eligibility": evaluate(user, scheme.get("eligibilityRules") or {}),
        "documents": documents,
        "documentsRequired": required,
        "portalUrl": _portal_url(scheme_id),
    }


@router.post("/{scheme_id}/apply", status_code=201, response_model=SchemeApplyOut)
async def apply_scheme(scheme_id: str, body: SchemeApplyIn, user: dict = Depends(_user)):
    scheme = await get_doc("schemes", scheme_id)
    if scheme is None:
        _error(404, "SCHEME_NOT_FOUND", "scheme not found")
    uid = user["id"]
    existing = await get_doc(f"users/{uid}/scheme_applications", scheme_id)
    if existing is not None:
        _error(409, "ALREADY_APPLIED", "पहले से आवेदन किया हुआ")
    if not is_eligible(user, scheme.get("eligibilityRules") or {}):
        _error(403, "NOT_ELIGIBLE", "आप इस योजना के लिए पात्र नहीं हैं")
    for doc_id in body.documentIds:
        if await get_doc(f"users/{uid}/vault_documents", doc_id) is None:
            _error(400, "INVALID_DOCUMENT_ID", "document not found in vault")
    application = {
        "id": uuid.uuid4().hex,
        "applicationId": scheme_id,
        "status": "submitted",
        "documentIds": body.documentIds,
        "submittedAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"users/{uid}/scheme_applications", scheme_id, application)
    return SchemeApplyOut(applicationId=scheme_id, status="submitted")


def _days_until(deadline: str | None) -> int | None:
    if not deadline:
        return None
    try:
        due = date.fromisoformat(str(deadline)[:10])
    except ValueError:
        return None
    return (due - date.today()).days


async def emit_scheme_deadline_tasks(user: dict) -> list[str]:
    """Emit (dedupe-safe) a task per eligible scheme with an approaching deadline."""
    uid = user["id"]
    schemes = await query("schemes", [], limit=200)
    task_ids: list[str] = []
    for scheme in schemes:
        if not is_eligible(user, scheme.get("eligibilityRules") or {}):
            continue
        days = _days_until(scheme.get("nextDeadline"))
        if days is None or days < 0 or days > SCHEME_REMINDER_WINDOW_DAYS:
            continue
        name = scheme.get("name")
        task_id = await emit_task(
            uid,
            persona="farmer",
            module="schemes",
            kind="scheme_deadline",
            title_en=f"{name} deadline in {days} day(s)",
            title_hi=f"{name} की अंतिम तिथि {days} दिन में",
            subtitle=f"{name} · {scheme.get('nextDeadline')}",
            priority="today" if days <= 7 else "upcoming",
            deep_link=f"{SCHEMES_DEEP_LINK}/{scheme.get('id')}",
            source_id=str(scheme.get("id")),
            due_at=str(scheme.get("nextDeadline")),
        )
        task_ids.append(task_id)
    return task_ids
