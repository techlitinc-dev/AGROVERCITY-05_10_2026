import asyncio
import hashlib
import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.db import get_doc, set_doc
from app.models.claims import InsuranceClaimRecord
from app.models.diary import DiaryEntryIn
from app.models.equipment import BookSlotRequest
from app.models.fpo import JoinPoolRequest
from app.models.livestock import VetBookIn
from app.models.livestock_mgmt import AppointmentIn
from app.routers import diary as diary_router
from app.routers import equipment as equipment_router
from app.routers import fpo as fpo_router
from app.routers import insurance_claims as claims_router
from app.routers import livestock as livestock_router
from app.routers import livestock_vets as livestock_vets_router
from app.services import claims as claims_service
from app.services.users import get_user

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Agmarknet / eNAM mandi price sync (phase-05 WS-01 task 1.18).
#
# The live Agmarknet/eNAM adapter is not wired yet — the on-disk seed remains
# scripts/seed_mandi.py — so the fetcher is an explicit injection seam. What
# this job hardens is the failure mode: bounded retries with backoff, and a
# `last_success_at` timestamp on `platform_config/mandi_sync` so staleness is
# visible. (Health note only; the admin console is phase-07.)
# Deferred(2026-10-03, phase-07): surface mandi_sync.last_success_at in the admin
# health console — hook left behind: the platform_config/mandi_sync doc below.
# ---------------------------------------------------------------------------
MANDI_SYNC_CONFIG_DOC = "mandi_sync"
MANDI_SYNC_MAX_ATTEMPTS = 3
MANDI_SYNC_BACKOFF_SECONDS = 0.5


class MandiSyncError(RuntimeError):
    """Raised when every bounded retry of the Agmarknet/eNAM fetch failed."""


async def _default_mandi_fetch() -> list[dict]:
    """No Agmarknet/eNAM adapter is configured — fail loudly, never fabricate."""
    raise MandiSyncError("no Agmarknet/eNAM adapter configured")


async def sync_mandi_prices(fetch=None) -> dict:
    """Fetch mandi prices with bounded retries; stamp the last success.

    Retries up to `MANDI_SYNC_MAX_ATTEMPTS` with linear backoff. On success it
    writes `last_success_at` (ISO string) plus the row count and attempt number
    to the `platform_config/mandi_sync` doc, then returns the same summary. A
    fetch that keeps failing raises `MandiSyncError` and leaves the previous
    timestamp untouched.
    """
    fetcher = fetch or _default_mandi_fetch
    last_error: Exception | None = None
    for attempt in range(1, MANDI_SYNC_MAX_ATTEMPTS + 1):
        try:
            rows = await fetcher()
        except Exception as exc:  # noqa: BLE001 — retry every transport/source error
            last_error = exc
            logger.warning(
                "mandi sync fetch attempt %s/%s failed: %s",
                attempt,
                MANDI_SYNC_MAX_ATTEMPTS,
                exc,
            )
            if attempt < MANDI_SYNC_MAX_ATTEMPTS:
                await asyncio.sleep(MANDI_SYNC_BACKOFF_SECONDS * attempt)
            continue
        now = datetime.now(timezone.utc).isoformat()
        summary = {"last_success_at": now, "rows": len(rows or []), "attempts": attempt}
        await set_doc("platform_config", MANDI_SYNC_CONFIG_DOC, {"id": MANDI_SYNC_CONFIG_DOC, **summary})
        return summary
    raise MandiSyncError(str(last_error))


async def already_processed(key: str) -> dict | None:
    return await get_doc("idempotency_keys", hashlib.sha256(key.encode()).hexdigest())


async def mark_processed(key: str, result: dict) -> None:
    await set_doc(
        "idempotency_keys",
        hashlib.sha256(key.encode()).hexdigest(),
        {"result": result, "processedAt": datetime.now(timezone.utc).isoformat()},
    )


async def _handle_diary_create(uid: str, _resource_id: str | None, body: dict) -> dict:
    created = await diary_router.create_entry(DiaryEntryIn(**body), uid)
    return created.model_dump()


async def _handle_claim_create(uid: str, _resource_id: str | None, body: dict) -> dict:
    # metadata-only replay: body carries already-uploaded photo URLs —
    # photos are NOT replayable via sync
    policy = await get_doc(f"users/{uid}/insurance_policies", body.get("policyId", ""))
    if policy is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "POLICY_NOT_FOUND", "message": "पॉलिसी नहीं मिली", "fieldErrors": {}},
        )
    user = await get_user(uid) or {"id": uid}
    now = datetime.now(timezone.utc).isoformat()
    claim = {
        "id": uuid.uuid4().hex,
        "claimNumber": await claims_service.next_claim_number(user.get("state", "")),
        "policyId": body["policyId"],
        "cropName": body["cropName"],
        "calamityType": body["calamityType"],
        "dateOfDamage": body["dateOfDamage"],
        "cropStage": body["cropStage"],
        "estimatedLossPercent": body["estimatedLossPercent"],
        "requestedAmount": round(policy["sumInsured"] * body["estimatedLossPercent"] / 100, 2),
        "approvedAmount": None,
        "status": "intimated",
        "statusText": claims_service.STATUS_TEXT["intimated"],
        **claims_service.auto_assign_surveyor(user.get("district", "")),
        "gpsCoordinates": body.get("gpsCoordinates", ""),
        "village": body.get("village", ""),
        "damagePhotos": body.get("damagePhotos", []),
        "submittedAt": now,
        "dbtTransactionId": None,
        "bankAccountLast4": await claims_router._bank_account_last4(uid, user),
        "appealCount": 0,
        "rejectionReason": None,
        "timeline": [
            {"status": "intimated", "at": now, "note": "Claim intimated within 72h window"}
        ],
    }
    await set_doc(f"users/{uid}/insurance_claims", claim["id"], claim)
    return InsuranceClaimRecord(**claim).model_dump()


async def _handle_equipment_book(uid: str, slot_id: str, body: dict) -> dict:
    return await equipment_router.book_slot(slot_id, BookSlotRequest(**body), uid)


async def _handle_vet_book(uid: str, vet_id: str, body: dict) -> dict:
    return await livestock_router.book_vet(vet_id, VetBookIn(**body), uid)


async def _handle_appointment_create(uid: str, _resource_id: str | None, body: dict) -> dict:
    return await livestock_vets_router.create_appointment(AppointmentIn(**body), uid)


async def _handle_pool_join(uid: str, pool_id: str, body: dict) -> dict:
    return await fpo_router.join_pool(pool_id, JoinPoolRequest(**body), uid)


# REPLAYABLE whitelist — the only paths /sync will execute
_EXACT_HANDLERS = {
    "/v1/diary/entries": _handle_diary_create,
    "/v1/insurance/claims": _handle_claim_create,
    "/v1/livestock/appointments": _handle_appointment_create,
}
_PREFIX_HANDLERS = (
    ("/v1/equipment/slots/", "/book", _handle_equipment_book),
    ("/v1/vets/", "/book", _handle_vet_book),
    ("/v1/fpo/pools/", "/join", _handle_pool_join),
)


def _match(path: str):
    if path in _EXACT_HANDLERS:
        return _EXACT_HANDLERS[path], None
    for prefix, suffix, handler in _PREFIX_HANDLERS:
        if path.startswith(prefix) and path.endswith(suffix):
            resource_id = path[len(prefix):len(path) - len(suffix)]
            if resource_id:
                return handler, resource_id
    return None, None


def _envelope_error(code: str, message: str) -> dict:
    return {"code": code, "message": message, "fieldErrors": {}}


# server-wins fields per the X19 conflict matrix — never replayed from client bodies
SERVER_OWNED_FIELDS = {
    "agriCoins",
    "agriCoinsEarned",
    "status",
    "approvedAmount",
    "timeline",
    "bankAccountLast4",
    "kisanCreditScore",
    "kccLimit",
    "priceRupees",
}


def _strip_server_owned(body: dict) -> dict:
    stripped = SERVER_OWNED_FIELDS.intersection(body)
    if stripped:
        logger.warning("sync replay: stripped server-owned fields %s", sorted(stripped))
    return {k: v for k, v in body.items() if k not in SERVER_OWNED_FIELDS}


async def dispatch(uid: str, op: dict) -> dict:
    key = op.get("idempotencyKey", "")
    base = {"idempotencyKey": key}
    processed = await already_processed(key)
    if processed is not None:
        stored = processed["result"]
        return {
            **base,
            "status": "duplicate",
            "httpStatus": stored.get("httpStatus"),
            "result": stored.get("result"),
            "replayed": False,
        }
    if op.get("method", "").upper() != "POST":
        return {
            **base,
            "status": "error",
            "httpStatus": 400,
            "error": _envelope_error("UNSUPPORTED_METHOD", "only POST ops are replayable"),
            "replayed": True,
        }
    handler, resource_id = _match(op.get("path", ""))
    if handler is None:
        return {
            **base,
            "status": "error",
            "httpStatus": 400,
            "error": _envelope_error("UNSUPPORTED_PATH", "path is not replayable via sync"),
            "replayed": True,
        }
    try:
        result_body = await handler(uid, resource_id, _strip_server_owned(dict(op.get("body") or {})))
        result = {
            **base,
            "status": "applied",
            "httpStatus": 201,
            "result": result_body,
            "replayed": True,
        }
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else _envelope_error("ERROR", str(exc.detail))
        result = {
            **base,
            "status": "error",
            "httpStatus": exc.status_code,
            "error": detail,
            "replayed": True,
        }
    await mark_processed(key, result)
    return result
