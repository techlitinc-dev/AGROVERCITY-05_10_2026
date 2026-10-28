"""SOP-25/SOP-26 superadmin surface — broadcasts, moderation reports & global KPIs.

Implements the doc-26 contract paths on top of the real platform data:

- ``POST /admin/broadcast`` — targeted FCM broadcast to user segments
  (persona / state / district), persisted in ``broadcasts`` and delivered
  through the real sender in ``app.services.notifications``.
- ``GET /admin/reports`` — the ``user_reports`` moderation queue.
- ``POST /admin/reports/{id}/resolve`` — resolve a report with
  ``warning | ban | dismiss``, reusing the same enforcement as the legacy
  ``/admin/moderation/{item_id}/action`` route.
- ``GET /admin/analytics/summary`` — global KPI dashboard computed entirely
  from Firestore (no hardcoded health/lease constants).
- ``POST /threads`` — server-side chat thread creation for a confirmed order
  (feature doc ``farm_e-market_customer.md`` §D.1: clients cannot create
  threads; the thread is bound to the order id + both user ids).
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.routers.analytics import _order_amount
from app.services import kyc as kyc_service
from app.services.admin_auth import (
    admin_mutation_context,
    current_admin_user,
    require_admin_role,
)
from app.services.audit import log_admin_action
from app.services.chat import first_name
from app.services.notifications import send_fcm_to_user
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(prefix="/admin", tags=["admin"])

# Chat threads are NOT under /admin (feature doc §D.1 server endpoint).
threads_router = APIRouter(prefix="", tags=["threads"])

# Order statuses that still mean "not confirmed yet" / "dead" for the e-market
# flow (routers/emarket_customer.py state machine).
_EMARKET_PRE_CONFIRM_STATUSES = ("created", "cancelled")
_EMARKET_CONFIRMED_STATUSES = (
    "deposit_pending",
    "confirmed",
    "in_fulfillment",
    "dispatched",
    "delivered",
    "settled",
    "disputed",
)

# Claim states that still need an adjudication decision (services/claims.py
# CLAIM_TRANSITIONS: only disbursed/rejected are terminal).
_CLAIM_PENDING_STATUSES = ("intimated", "surveyorAssigned", "fieldAssessed", "dbtApproved")

# Transport booking terminal states (routers/chat.py transport rooms).
_BOOKING_TERMINAL_STATUSES = ("delivered", "cancelled")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# POST /admin/broadcast — targeted FCM broadcast (doc 26)
# ---------------------------------------------------------------------------
class BroadcastSendIn(BaseModel):
    segment: dict = Field(
        default_factory=dict,
        description="filters: persona (linkedProfiles), state, district",
    )
    titleEn: str = Field(..., min_length=1)
    titleHi: str = Field(..., min_length=1)
    bodyEn: str = Field(..., min_length=1)
    bodyHi: str = Field(..., min_length=1)


def _segment_match(user: dict, segment: dict) -> bool:
    persona = (segment.get("persona") or "").strip().lower()
    if persona:
        profiles = [str(p).lower() for p in user.get("linkedProfiles") or []]
        if persona not in profiles:
            return False
    state = (segment.get("state") or "").strip().lower()
    if state and state != (user.get("state") or "").strip().lower():
        return False
    district = (segment.get("district") or "").strip().lower()
    if district and district != (user.get("district") or "").strip().lower():
        return False
    return True


@router.post("/broadcast")
async def send_broadcast(
    body: BroadcastSendIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    """Targeted FCM push to a user segment (persona/state/district), doc 26."""
    admin = ctx["admin"]
    segment = body.segment or {}

    users_list = await query("users", limit=2000)
    targets = [u for u in users_list if _segment_match(u, segment)]

    broadcast_id = f"bc_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": broadcast_id,
        "segment": segment,
        "titleEn": body.titleEn,
        "titleHi": body.titleHi,
        "bodyEn": body.bodyEn,
        "bodyHi": body.bodyHi,
        "status": "sent",
        "channel": "fcm",
        "recipientCount": len(targets),
        "createdBy": admin.get("id") or admin.get("uid"),
        "createdAt": _now(),
    }
    await set_doc("broadcasts", broadcast_id, doc)

    sent = 0
    for target in targets:
        uid = target.get("id") or target.get("uid")
        if not uid:
            continue
        await send_fcm_to_user(
            uid,
            body.titleEn,
            body.bodyEn,
            {
                "type": "broadcast",
                "broadcastId": broadcast_id,
                "titleHi": body.titleHi,
                "bodyHi": body.bodyHi,
            },
        )
        sent += 1
    doc["sentCount"] = sent
    await set_doc("broadcasts", broadcast_id, doc)

    await log_admin_action(
        admin, "broadcasts", "send", broadcast_id, None, doc, ctx["reason"], ctx["ip"]
    )
    return {
        "success": True,
        "broadcast": doc,
        "targetedUsers": len(targets),
        "notificationsSent": sent,
    }


# ---------------------------------------------------------------------------
# GET /admin/reports — reported users/content moderation queue (doc 26)
# ---------------------------------------------------------------------------
@router.get("/reports")
async def list_reports(
    status: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Reported users/content queue from the real ``user_reports`` collection."""
    docs = await query("user_reports", [], limit=2000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    if module:
        docs = [d for d in docs if d.get("module") == module]
    docs.sort(key=lambda d: d.get("createdAt") or "", reverse=True)
    start = (page - 1) * pageSize
    return {
        "data": docs[start : start + pageSize],
        "page": page,
        "pageSize": pageSize,
        "total": len(docs),
    }


# ---------------------------------------------------------------------------
# POST /admin/reports/{id}/resolve — warning | ban | dismiss (doc 26)
# ---------------------------------------------------------------------------
class ReportResolveIn(BaseModel):
    action: str = Field(..., description="warning | ban | dismiss")
    note: Optional[str] = None


@router.post("/reports/{report_id}/resolve")
async def resolve_report(
    report_id: str,
    body: ReportResolveIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Resolve one report; ``ban`` suspends the reported user account.

    Mirrors the enforcement behind ``POST /admin/moderation/{item_id}/action``
    (user status write + immutable audit record) over the ``user_reports`` queue.
    """
    if body.action not in ("warning", "ban", "dismiss"):
        _error(422, "VALIDATION_ERROR", "action must be warning, ban or dismiss")

    report = await get_doc("user_reports", report_id)
    if report is None:
        _error(404, "REPORT_NOT_FOUND", "report not found")
    if report.get("status") not in ("open", "pending"):
        _error(409, "REPORT_ALREADY_RESOLVED", "report has already been resolved")

    admin = ctx["admin"]
    now = _now()
    previous = {"status": report.get("status")}

    report["status"] = "resolved"
    report["action"] = body.action
    report["resolutionNote"] = body.note
    report["resolvedBy"] = admin.get("id") or admin.get("uid")
    report["resolvedAt"] = now
    await set_doc("user_reports", report_id, report)

    if body.action == "ban":
        target_uid = report.get("targetUserId")
        target = await get_user(target_uid) if target_uid else None
        if target is not None:
            target["status"] = "banned"
            target["statusReason"] = ctx["reason"]
            target["statusUpdatedAt"] = now
            target["statusUpdatedBy"] = admin.get("id") or admin.get("uid")
            await set_doc("users", target_uid, target)

    await log_admin_action(
        admin,
        "moderation",
        f"report.{body.action}",
        report_id,
        previous,
        {"status": "resolved", "action": body.action, "targetUserId": report.get("targetUserId")},
        ctx["reason"],
        ctx["ip"],
    )
    return {"success": True, "reportId": report_id, "status": "resolved", "action": body.action}


# ---------------------------------------------------------------------------
# GET /admin/analytics/summary — global platform KPI dashboard (doc 26)
# ---------------------------------------------------------------------------
@router.get("/analytics/summary")
async def analytics_summary(user: dict = Depends(current_admin_user)):
    """Global KPIs computed from Firestore — no hardcoded constants."""
    users_list = await query("users", limit=1000)
    persona_counts: dict[str, int] = {}
    for u in users_list:
        for persona in u.get("linkedProfiles") or []:
            persona_counts[persona] = persona_counts.get(persona, 0) + 1

    orders = await query("orders", limit=2000)
    live_orders = [o for o in orders if o.get("status") != "cancelled"]
    gmv = round(sum(_order_amount(o) for o in live_orders), 2)

    emarket_orders = await query("customer_orders", limit=2000)
    emarket_gmv = round(
        sum(
            float(o.get("totalAmountRupees") or 0)
            for o in emarket_orders
            if o.get("status") != "cancelled"
        ),
        2,
    )

    # Active farmland leases live in the landlord-scoped subcollection that
    # routers/land.py + land_ops.py actually write (status "active").
    active_leases = 0
    for u in users_list:
        uid = u.get("id")
        if not uid:
            continue
        leases = await query(f"users/{uid}/land_leases", [("status", "==", "active")], limit=500)
        active_leases += len(leases)

    claims = await query("insurance_claims", limit=2000)
    pending_claims = sum(1 for c in claims if c.get("status") in _CLAIM_PENDING_STATUSES)

    settlements = await query("settlements", limit=2000)
    pending_settlements = [s for s in settlements if s.get("status") == "pending"]
    pending_settlements_volume = round(
        sum(float(s.get("netRupees") or 0) for s in pending_settlements), 2
    )

    bookings = await query("transport_bookings", limit=2000)
    active_bookings = sum(
        1 for b in bookings if b.get("status") not in _BOOKING_TERMINAL_STATUSES
    )

    open_reports = await query("user_reports", [("status", "==", "open")], limit=2000)

    return {
        "activeUsersTotal": len(users_list),
        "personaBreakdown": persona_counts,
        "totalOrders": len(orders),
        "marketplaceGMV": gmv,
        "emarketOrders": len(emarket_orders),
        "emarketGMV": emarket_gmv,
        "activeFarmlandLeases": active_leases,
        "pendingKycCount": await kyc_service.pending_doc_count(),
        "pendingClaimsCount": pending_claims,
        "pendingSettlementsCount": len(pending_settlements),
        "pendingSettlementsAmount": pending_settlements_volume,
        "transportBookingsTotal": len(bookings),
        "transportBookingsActive": active_bookings,
        "openReportsCount": len(open_reports),
        "timestamp": _now(),
    }


# ---------------------------------------------------------------------------
# POST /threads — server-side chat thread creation (feature doc §D.1)
# ---------------------------------------------------------------------------
class ThreadCreateIn(BaseModel):
    orderId: str = Field(..., min_length=1)


async def _resolve_order_participants(order_id: str) -> tuple[dict, str, str] | None:
    """Return (order, farmer_id, buyer_id) from the real order collections.

    Primary: ``customer_orders`` (e-market flow — both ids are on the doc).
    Fallback: ``orders`` (retail flow — buyer is ``userId``, seller resolves
    through the first item's product).
    """
    order = await get_doc("customer_orders", order_id)
    if order is not None:
        farmer_id = order.get("farmerId") or ""
        buyer_id = order.get("customerId") or ""
        if farmer_id and buyer_id:
            return order, farmer_id, buyer_id
        return None

    order = await get_doc("orders", order_id)
    if order is None:
        return None
    buyer_id = order.get("userId") or ""
    farmer_id = ""
    items = order.get("items") or []
    if items:
        product = await get_doc("products", items[0].get("productId") or "") or {}
        farmer_id = product.get("sellerId") or ""
    if not (farmer_id and buyer_id):
        return None
    return order, farmer_id, buyer_id


@threads_router.post("/threads", status_code=201)
async def create_thread(
    body: ThreadCreateIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Create the order-bound chat thread — admin/system-only per spec §D.1.

    The thread is a real ``chat_rooms`` document (same shape services/chat.py
    writes) keyed by the order id; 409 when one already exists.
    """
    resolved = await _resolve_order_participants(body.orderId)
    if resolved is None:
        _error(404, "ORDER_NOT_FOUND", "order not found or missing participants")
    order, farmer_id, buyer_id = resolved

    existing = await get_doc("chat_rooms", body.orderId)
    if existing is not None:
        _error(409, "THREAD_EXISTS", "a chat thread already exists for this order")

    order_status = order.get("status") or ""
    is_emarket_order = "customerId" in order
    if is_emarket_order and order_status in _EMARKET_PRE_CONFIRM_STATUSES:
        _error(
            409,
            "THREAD_NOT_CONFIRMED",
            "chat unlocks only after the order is confirmed",
        )
    if not is_emarket_order and order_status == "cancelled":
        _error(409, "ORDER_CANCELLED", "chat is closed for cancelled orders")

    farmer = await get_user(farmer_id) or {}
    buyer = await get_user(buyer_id) or {}
    now = _now()
    room = {
        "id": body.orderId,
        "kind": "purchase",
        "purchaseId": None,
        "orderId": body.orderId,
        "farmerId": farmer_id,
        "farmerName": first_name(order.get("farmerName") or farmer.get("name") or ""),
        "buyerId": buyer_id,
        "buyerName": first_name(order.get("customerName") or buyer.get("name") or ""),
        "crop": order.get("crop") or "",
        "createdAt": now,
        "lastMessageAt": None,
        "lastMessageText": "",
        "readByFarmer": True,
        "readByBuyer": True,
    }
    await set_doc("chat_rooms", room["id"], room)

    await log_admin_action(
        ctx["admin"],
        "chat",
        "THREAD_CREATED",
        room["id"],
        None,
        {"orderId": body.orderId, "farmerId": farmer_id, "buyerId": buyer_id},
        ctx["reason"],
        ctx["ip"],
    )

    for participant_id in (farmer_id, buyer_id):
        await notify_user(
            participant_id,
            type="chat_unlocked",
            title="Chat unlocked / चैट खुल गई",
            body=f"Chat is now open for order {body.orderId}",
            deepLink=f"/dashboard/p/chats/{room['id']}",
        )

    return room


# ===========================================================================
# P1-33: Penalty matrix config & manual waive (features/farm_transporter.md C8)
# ===========================================================================

class PenaltyConfigIn(BaseModel):
    tiers: Optional[dict[str, float]] = None
    strikeRules: Optional[dict[str, int]] = None
    noShowPenaltyPaisa: Optional[int] = None
    defaultWaiverWindowHours: Optional[int] = None


class WaivePenaltyIn(BaseModel):
    userId: str
    penaltyId: str
    reason: str = Field(..., min_length=3)


@router.get("/platform-config/penalties")
async def get_penalty_matrix_config(user: dict = Depends(current_admin_user)):
    """P1-33: Read platform penalty matrix config and cancellation fee schedule."""
    cfg = await get_doc("platform_config", "penalties")
    if not cfg:
        cfg = {
            "id": "penalties",
            "tiers": {"freeNoticeHours": 24, "standardPenaltyPercent": 10.0, "lastMinutePenaltyPercent": 25.0},
            "strikeRules": {"maxStrikesBeforeSuspension": 3, "cooldownDays": 30},
            "noShowPenaltyPaisa": 50000,
            "defaultWaiverWindowHours": 48,
            "updatedAt": _now(),
        }
    return cfg


@router.put("/platform-config/penalties")
async def update_penalty_matrix_config(
    body: PenaltyConfigIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """P1-33: Update platform penalty matrix config."""
    existing = await get_doc("platform_config", "penalties") or {}
    new_cfg = {
        **existing,
        **body.model_dump(exclude_none=True),
        "id": "penalties",
        "updatedAt": _now(),
        "updatedBy": ctx["admin"].get("id"),
    }
    await set_doc("platform_config", "penalties", new_cfg)
    await log_admin_action(
        ctx["admin"], "platform", "UPDATE_PENALTY_CONFIG", "penalties",
        existing, new_cfg, ctx["reason"], ctx["ip"],
    )
    return new_cfg


@router.post("/platform-config/penalties/waive")
async def waive_penalty(
    body: WaivePenaltyIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """P1-33: Manually waive a user penalty with audited justification."""
    record = {
        "id": f"wv_{uuid.uuid4().hex[:10]}",
        "userId": body.userId,
        "penaltyId": body.penaltyId,
        "reason": body.reason,
        "waivedBy": ctx["admin"].get("id"),
        "waivedAt": _now(),
    }
    await set_doc("penalty_waivers", record["id"], record)
    await log_admin_action(
        ctx["admin"], "platform", "WAIVE_PENALTY", body.penaltyId,
        None, record, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "waiver": record}


# ===========================================================================
# P2-35: Notification-template CMS (features/farm_transporter.md C11)
# ===========================================================================

class NotificationTemplateItem(BaseModel):
    templateKey: str = Field(..., min_length=2)
    title: str = Field(..., min_length=2)
    body: str = Field(..., min_length=2)
    category: str = "transactional"
    variables: Optional[list[str]] = None


class NotificationTemplatesUpdateIn(BaseModel):
    templates: list[NotificationTemplateItem]


@router.get("/notification-templates")
async def get_notification_templates(user: dict = Depends(current_admin_user)):
    """P2-35 (C11): Read notification template CMS registry."""
    doc = await get_doc("platform_config", "notification_templates")
    if not doc:
        return {
            "templates": [
                {"templateKey": "deal_accepted", "title": "Farmer accepted", "body": "{commodity} deal confirmed", "category": "transactional"},
                {"templateKey": "pickup_scheduled", "title": "Trip scheduled", "body": "Vehicle pickup on {date}", "category": "transactional"},
                {"templateKey": "payout_released", "title": "Payout released", "body": "₹{amount} disbursed to bank", "category": "transactional"},
            ],
            "total": 3,
        }
    templates = doc.get("templates") or []
    return {"templates": templates, "total": len(templates)}


@router.put("/notification-templates")
async def update_notification_templates(
    body: NotificationTemplatesUpdateIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """P2-35 (C11): Update notification templates in CMS."""
    doc = {
        "id": "notification_templates",
        "templates": [t.model_dump() for t in body.templates],
        "updatedAt": _now(),
        "updatedBy": ctx["admin"].get("id"),
    }
    await set_doc("platform_config", "notification_templates", doc)
    await log_admin_action(
        ctx["admin"], "cms", "UPDATE_NOTIFICATION_TEMPLATES", "notification_templates",
        None, {"templateCount": len(body.templates)}, ctx["reason"], ctx["ip"],
    )
    return doc


# ===========================================================================
# Master data management (P2 layer on top of static reference data)
# ===========================================================================
#
# Master lists (mandis, crops, varieties, grades, categories, states, units,
# vehicle-types) are served statically by routers/reference.py. This desk lets
# admins override or extend them: every override lives in the `master_data`
# collection as `{collection}_{code}` and is merged over the static list, so
# GET /reference keeps working untouched.

from app.data.states import INDIAN_STATES

MASTER_COLLECTIONS = ("mandis", "crops", "varieties", "grades", "categories", "states", "units", "vehicle-types")

_STATIC_MASTER: dict[str, list[dict]] = {
    "mandis": [],
    "crops": [
        {"code": "wheat", "name": "Wheat"},
        {"code": "rice", "name": "Rice (Paddy)"},
        {"code": "cotton", "name": "Cotton"},
        {"code": "sugarcane", "name": "Sugarcane"},
        {"code": "soybean", "name": "Soybean"},
        {"code": "maize", "name": "Maize"},
        {"code": "onion", "name": "Onion"},
        {"code": "tomato", "name": "Tomato"},
        {"code": "chilli", "name": "Chilli"},
        {"code": "bajra", "name": "Bajra (Pearl Millet)"},
        {"code": "jowar", "name": "Jowar (Sorghum)"},
        {"code": "mustard", "name": "Mustard"},
        {"code": "groundnut", "name": "Groundnut"},
        {"code": "banana", "name": "Banana"},
        {"code": "grapes", "name": "Grapes"},
    ],
    "varieties": [],
    "grades": [
        {"code": "A", "name": "Grade A"},
        {"code": "B", "name": "Grade B"},
        {"code": "C", "name": "Grade C"},
        {"code": "fancy", "name": "Fancy"},
    ],
    "categories": [],
    "states": [{"code": s.lower().replace(" ", "_"), "name": s} for s in INDIAN_STATES],
    "units": [
        {"code": "kg", "name": "Kilogram"},
        {"code": "quintal", "name": "Quintal"},
        {"code": "tonne", "name": "Tonne"},
        {"code": "litre", "name": "Litre"},
        {"code": "dozen", "name": "Dozen"},
        {"code": "bag", "name": "Bag"},
        {"code": "acre", "name": "Acre"},
    ],
    # vehicle-types has no static rows anymore — the rate card lives in the
    # `vehicle_catalog` collection (see _vehicle_type_rows below).
    "vehicle-types": [],
}

MASTER_IMPORT_MAX_ROWS = 500


def _master_doc_id(collection: str, code: str) -> str:
    return f"{collection}_{code}"


def _require_master_collection(collection: str) -> None:
    if collection not in MASTER_COLLECTIONS:
        _error(
            422,
            "VALIDATION_ERROR",
            f"collection must be one of {', '.join(MASTER_COLLECTIONS)}",
            {"collection": "unknown master collection"},
        )


async def _static_master_rows(collection: str) -> list[dict]:
    """Static base layer for a master collection. `vehicle-types` is served
    from the `vehicle_catalog` rate card instead of hardcoded rows."""
    if collection == "vehicle-types":
        from app.routers.transport import _vehicle_catalog

        return [
            {
                "code": vt["type"].lower().replace(" ", "_"),
                "name": vt["type"],
                "baseFare": vt.get("baseFare"),
                "perKmRate": vt.get("perKmRate"),
                "capacityTonnes": vt.get("capacityTonnes"),
            }
            for vt in await _vehicle_catalog()
        ]
    return _STATIC_MASTER.get(collection, [])


async def _merged_master(collection: str) -> list[dict]:
    """Static reference entries overlaid with Firestore `master_data` overrides
    (doc id `{collection}_{code}`). Overrides win per code."""
    merged: dict[str, dict] = {}
    for entry in await _static_master_rows(collection):
        merged[entry["code"]] = {**entry, "active": True, "source": "static"}
    for doc in await query("master_data", [], limit=2000):
        doc_id = doc.get("id") or ""
        prefix = f"{collection}_"
        if not doc_id.startswith(prefix):
            continue
        code = doc.get("code") or doc_id[len(prefix):]
        merged[code] = {
            **doc,
            "code": code,
            "active": doc.get("active", True),
            "source": "firestore",
        }
    return sorted(merged.values(), key=lambda e: str(e.get("code")))


@router.get("/master/{collection}")
async def get_master_collection(
    collection: str,
    includeInactive: bool = Query(False, description="also return soft-deleted entries"),
    user: dict = Depends(current_admin_user),
):
    """Merged master list: Firestore overrides first, static reference data as
    the fallback layer. `source` marks which layer served each row."""
    _require_master_collection(collection)
    rows = await _merged_master(collection)
    if not includeInactive:
        rows = [r for r in rows if r.get("active", True)]
    return {"data": rows, "total": len(rows), "collection": collection}


class MasterEntryIn(BaseModel):
    code: str = Field(..., min_length=1, max_length=60)
    name: str = Field(..., min_length=1, max_length=200)
    active: Optional[bool] = None
    extra: Optional[dict] = Field(default=None, description="additional fields stored verbatim on the entry")


def _master_entry_doc(collection: str, code: str, name: str, active: bool | None, extra: dict | None, admin: dict) -> dict:
    return {
        "id": _master_doc_id(collection, code),
        "collection": collection,
        "code": code,
        "name": name,
        "active": True if active is None else active,
        **(extra or {}),
        "updatedBy": admin.get("id") or admin.get("uid"),
        "updatedAt": _now(),
    }


@router.post("/master/{collection}", status_code=201)
async def upsert_master_entry(
    collection: str,
    body: MasterEntryIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Create or override one master-data entry (`master_data/{collection}_{code}`)."""
    _require_master_collection(collection)
    code = body.code.strip()
    doc_id = _master_doc_id(collection, code)
    existing = await get_doc("master_data", doc_id)
    doc = _master_entry_doc(collection, code, body.name.strip(), body.active, body.extra, ctx["admin"])
    await set_doc("master_data", doc_id, doc)
    await log_admin_action(
        ctx["admin"], "master-data", "master.upsert", doc_id,
        existing, doc, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "created": existing is None, "entry": doc}


class MasterEntryUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    active: Optional[bool] = None
    extra: Optional[dict] = Field(default=None, description="additional fields merged verbatim into the entry")


@router.put("/master/{collection}/{code}")
async def update_master_entry(
    collection: str,
    code: str,
    body: MasterEntryUpdateIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Partial update of one Firestore master-data entry. Static rows have no
    doc yet — the update materialises an override carrying the static name."""
    _require_master_collection(collection)
    doc_id = _master_doc_id(collection, code)
    doc = await get_doc("master_data", doc_id)
    if doc is None:
        static_row = next((e for e in await _static_master_rows(collection) if e["code"] == code), None)
        if static_row is None:
            _error(404, "MASTER_ENTRY_NOT_FOUND", "master entry not found")
        doc = _master_entry_doc(collection, code, static_row["name"], None, static_row, ctx["admin"])
    previous = dict(doc)
    if body.name is not None:
        doc["name"] = body.name.strip()
    if body.active is not None:
        doc["active"] = body.active
    if body.extra:
        doc.update(body.extra)
    doc["updatedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    doc["updatedAt"] = _now()
    await set_doc("master_data", doc_id, doc)
    await log_admin_action(
        ctx["admin"], "master-data", "master.update", doc_id,
        previous, doc, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "entry": doc}


@router.delete("/master/{collection}/{code}")
async def soft_delete_master_entry(
    collection: str,
    code: str,
    ctx: dict = Depends(admin_mutation_context),
):
    """Soft delete: flips the Firestore override (or a materialised one) to
    active=false so the row drops out of the merged list without touching
    static data."""
    _require_master_collection(collection)
    doc_id = _master_doc_id(collection, code)
    doc = await get_doc("master_data", doc_id)
    if doc is None:
        static_row = next((e for e in await _static_master_rows(collection) if e["code"] == code), None)
        if static_row is None:
            _error(404, "MASTER_ENTRY_NOT_FOUND", "master entry not found")
        doc = _master_entry_doc(collection, code, static_row["name"], False, static_row, ctx["admin"])
    else:
        doc["active"] = False
        doc["updatedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
        doc["updatedAt"] = _now()
    await set_doc("master_data", doc_id, doc)
    await log_admin_action(
        ctx["admin"], "master-data", "master.soft-delete", doc_id,
        {"active": True}, {"active": False}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "code": code, "active": False}


class MasterImportIn(BaseModel):
    rows: list[dict] = Field(default_factory=list)


@router.post("/master/{collection}/import")
async def import_master_entries(
    collection: str,
    body: MasterImportIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Bulk upsert (max 500 rows). Each row needs code + name; bad rows are
    collected as errors without aborting the batch."""
    _require_master_collection(collection)
    if len(body.rows) > MASTER_IMPORT_MAX_ROWS:
        _error(
            422,
            "VALIDATION_ERROR",
            f"at most {MASTER_IMPORT_MAX_ROWS} rows per import",
            {"rows": f"max {MASTER_IMPORT_MAX_ROWS}"},
        )
    created = updated = 0
    errors = []
    for index, row in enumerate(body.rows):
        code = str(row.get("code") or "").strip()
        name = str(row.get("name") or "").strip()
        if not code or not name:
            errors.append({"index": index, "code": code, "error": "code and name are required"})
            continue
        doc_id = _master_doc_id(collection, code)
        existing = await get_doc("master_data", doc_id)
        extra = {k: v for k, v in row.items() if k not in ("code", "name", "active")}
        doc = _master_entry_doc(collection, code, name, row.get("active"), extra or None, ctx["admin"])
        await set_doc("master_data", doc_id, doc)
        if existing is None:
            created += 1
        else:
            updated += 1
    await log_admin_action(
        ctx["admin"], "master-data", "master.import", collection,
        None, {"created": created, "updated": updated, "errors": len(errors)},
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "created": created, "updated": updated, "errors": errors}
