"""Equipment rental hub (extension-2026-10-12) — full-fledged equipment
renting management.

Owner surface (/equipment-rental): verification documents (DigiLocker/PAN/RC/
insurance), verified-badge flow, blacklist + report-user + fraud/duplicate
signals, demand heatmap + ranking explanation + recommendations, reminders,
booking monitoring, settlement tracking, commission visibility and platform
policy config.

Shared surface (/equipment): farmer demand-posting, booking contracts with
e-sign (MPIN) + real PDF + version history, advance/balance/refund payments,
invoices, and the dispute process (evidence upload, case timeline, SLA).

All payloads are computed from real collections (users, kyc_cases, equipment,
equipment_slots, equipment_bookings, equipment_demand_posts,
equipment_contracts, equipment_disputes, user_reports, equipment_blacklists,
settlements, platform_config, notifications) — no synthetic fallback data.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.security import verify_mpin
from app.routers.users import require_role
from app.services import storage
from app.services.notify import notify_user
from app.services.sms import send_sms
from app.services.users import get_user

owner_router = APIRouter(prefix="/equipment-rental", tags=["equipment-rental"])
router = APIRouter(prefix="/equipment", tags=["equipment-rental-shared"])

CANCEL_NOTICE_HOURS = 2
EQUIPMENT_VERIFICATION_DOCS = (
    "pan",
    "digilocker_pan",
    "equipment_rc",
    "equipment_insurance",
    "operator_licence",
)
BADGE_REQUIRED = ("equipment_rc", "equipment_insurance")
DISPUTE_SLA_HOURS = 72
POLICY_DEFAULTS = {
    "cancellationNoticeHours": CANCEL_NOTICE_HOURS,
    "surge": {"enabled": False, "peakMultiplier": 1.25, "peakHours": "06-10,17-20"},
    "moderation": {"chatScan": True, "reportReviewHours": 24},
    "dataRetentionDays": 365,
}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _owner(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "equipmentRental")
    return user, uid


async def _farmer(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "farmLandlord", "seller")
    return user, uid


async def _booking_participant(booking_id: str, uid: str) -> tuple[dict, dict]:
    booking = await get_doc("equipment_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    equipment = await get_doc("equipment", booking["equipmentId"])
    if equipment is None:
        _error(404, "EQUIPMENT_NOT_FOUND", "equipment not found")
    if uid not in (booking.get("userId"), equipment.get("ownerId")) and not (await get_user(uid) or {}).get("isAdmin"):
        _error(403, "BOOKING_FORBIDDEN", "not a booking party")
    return booking, equipment


# ---------------------------------------------------------------------------
# 1. Verification: DigiLocker / PAN / equipment documents + verified badge
# ---------------------------------------------------------------------------


class VerificationDocIn(BaseModel):
    docType: str
    fileUrl: str = Field(min_length=1)
    referenceNo: str = ""
    expiresAt: str = ""


@owner_router.post("/verification/documents", status_code=201)
async def submit_verification_document(body: VerificationDocIn, ctx: tuple = Depends(_owner)):
    """Upload an owner verification document — PAN (manual or via DigiLocker),
    equipment RC, insurance or operator licence. Stored on the real KYC case as
    pending; admin verification flips the doc status."""
    from app.services import kyc as kyc_service

    user, uid = ctx
    if body.docType not in EQUIPMENT_VERIFICATION_DOCS:
        _error(
            422,
            "INVALID_DOCUMENT_MATRIX",
            f"docType must be one of {', '.join(EQUIPMENT_VERIFICATION_DOCS)}",
            {"docType": "unsupported document type"},
        )
    case_id = kyc_service.case_id_for(uid, "equipmentRental")
    case = await kyc_service.get_case(case_id)
    entry = {
        "docId": f"{case_id}:{body.docType}",
        "type": body.docType,
        "storagePath": body.fileUrl,
        "status": "pending",
        "reason": None,
        "referenceNo": body.referenceNo,
        "expiresAt": body.expiresAt or None,
        "updatedAt": _now(),
    }
    if case is None:
        case = {
            "caseId": case_id,
            "userId": uid,
            "persona": "equipmentRental",
            "docs": [entry],
            "status": "pending",
            "submittedAt": _now(),
            "reviewedBy": None,
            "reviewedAt": None,
        }
    else:
        docs = case.setdefault("docs", [])
        existing = next((d for d in docs if d.get("type") == body.docType), None)
        if existing is not None:
            existing.update(entry)
        else:
            docs.append(entry)
        case["status"] = kyc_service._recompute_case_status(case)
    await set_doc("kyc_cases", case_id, case)
    return {"case": case, "document": entry}


def _badge_state(case: dict | None) -> dict:
    docs = (case or {}).get("docs") or []
    by_type: dict[str, str] = {}
    for doc in docs:
        by_type[doc.get("type")] = doc.get("status", "pending")
    identity_ok = by_type.get("pan") == "verified" or by_type.get("digilocker_pan") == "verified"
    verified = (
        all(by_type.get(t) == "verified" for t in BADGE_REQUIRED) and identity_ok
    )
    verified_at = None
    if verified:
        stamps = [
            d.get("reviewedAt")
            for d in docs
            if d.get("type") in (*BADGE_REQUIRED, "pan", "digilocker_pan") and d.get("reviewedAt")
        ]
        verified_at = max(stamps) if stamps else None
    return {
        "verified": verified,
        "verifiedAt": verified_at,
        "docStatuses": {
            t: by_type.get(t, "missing")
            for t in ("pan", "digilocker_pan", *BADGE_REQUIRED)
        },
    }


@owner_router.get("/verification/status")
async def verification_status(ctx: tuple = Depends(_owner)):
    """My verification state: case status, per-document status and the
    verified-badge eligibility (RC + insurance + PAN/DigiLocker all verified)."""
    from app.services import kyc as kyc_service

    user, uid = ctx
    case = await kyc_service.get_case(kyc_service.case_id_for(uid, "equipmentRental"))
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    return {
        "caseStatus": (case or {}).get("status", "not_submitted"),
        "submittedAt": (case or {}).get("submittedAt"),
        "badge": _badge_state(case),
        "machines": {
            "total": len(machines),
            "docVerified": sum(1 for m in machines if m.get("docStatus") == "verified"),
        },
    }


@owner_router.get("/badge")
async def verified_badge(ctx: tuple = Depends(_owner)):
    """The owner verified badge as shown to farmers, plus the machines it
    covers and the trust tier computed from real signals."""
    from app.services.kyc import cases_for_user
    from app.services.trust import refresh_trust_tier

    user, uid = ctx
    cases = [c for c in await cases_for_user(uid) if c.get("persona") == "equipmentRental"]
    case = cases[0] if cases else None
    badge = _badge_state(case)
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    verified_machines = [m["id"] for m in machines if m.get("docStatus") == "verified"]
    return {
        **badge,
        "ownerId": uid,
        "trustTier": await refresh_trust_tier(uid) if badge["verified"] else None,
        "verifiedMachineIds": verified_machines,
    }


# ---------------------------------------------------------------------------
# 2. Trust & safety: blacklist, report-user, fraud + duplicate detection
# ---------------------------------------------------------------------------


@owner_router.post("/blacklist", status_code=201)
async def blacklist_user(body: dict, ctx: tuple = Depends(_owner)):
    user, uid = ctx
    target = str(body.get("userId") or "")
    reason = str(body.get("reason") or "")
    if not target:
        _error(422, "VALIDATION_ERROR", "userId is required", {"userId": "required"})
    if target == uid:
        _error(400, "SELF_BLACKLIST", "cannot blacklist yourself")
    if await get_user(target) is None:
        _error(404, "USER_NOT_FOUND", "user not found")
    doc_id = f"{uid}_{target}"
    doc = {
        "id": doc_id,
        "ownerId": uid,
        "userId": target,
        "reason": reason,
        "createdAt": _now(),
    }
    await set_doc("equipment_blacklists", doc_id, doc)
    return doc


@owner_router.get("/blacklist")
async def list_blacklist(ctx: tuple = Depends(_owner)):
    user, uid = ctx
    docs = await query("equipment_blacklists", [("ownerId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@owner_router.delete("/blacklist/{user_id}", status_code=204)
async def unblacklist_user(user_id: str, ctx: tuple = Depends(_owner)):
    user, uid = ctx
    await delete_doc("equipment_blacklists", f"{uid}_{user_id}")


class ReportUserIn(BaseModel):
    targetUserId: str = Field(min_length=1)
    bookingId: str = ""
    reason: str = Field(min_length=3)
    details: str = ""


@owner_router.post("/reports", status_code=201)
async def report_user(body: ReportUserIn, ctx: tuple = Depends(_owner)):
    """Report a user (farmer) — moderation reviews within the policy SLA."""
    user, uid = ctx
    if await get_user(body.targetUserId) is None:
        _error(404, "USER_NOT_FOUND", "user not found")
    doc = {
        "id": f"rep_{uuid.uuid4().hex[:12]}",
        "reporterId": uid,
        "targetUserId": body.targetUserId,
        "bookingId": body.bookingId,
        "module": "equipment",
        "reason": body.reason,
        "details": body.details,
        "status": "open",
        "createdAt": _now(),
    }
    await set_doc("user_reports", doc["id"], doc)
    return doc


@owner_router.get("/reports")
async def my_reports(ctx: tuple = Depends(_owner)):
    user, uid = ctx
    docs = await query("user_reports", [("reporterId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@owner_router.get("/risk/farmers")
async def farmer_risk_signals(ctx: tuple = Depends(_owner)):
    """Fraud + duplicate-account signals for every farmer who booked my
    machines: brand-new accounts, repeated cancellations, open reports against
    them, and shared phone numbers (duplicate accounts)."""
    user, uid = ctx
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    machine_ids = {m["id"] for m in machines}
    bookings = [b for b in await query("equipment_bookings", [], limit=1000) if b.get("equipmentId") in machine_ids]
    farmer_ids = {b.get("userId") for b in bookings if b.get("userId")}
    users = {u["id"]: u for u in await query("users", [], limit=2000)}
    reports = await query("user_reports", [], limit=1000)
    rows = []
    for fid in farmer_ids:
        farmer = users.get(fid) or {}
        signals = []
        created = (farmer.get("createdAt") or "")[:10]
        if created:
            age_days = (datetime.now(timezone.utc).date() - datetime.fromisoformat(created).date()).days
            if age_days < 30:
                signals.append({"kind": "new_account", "detail": f"account {age_days}d old"})
        cancelled = sum(1 for b in bookings if b.get("userId") == fid and b.get("status") == "cancelled")
        if cancelled >= 2:
            signals.append({"kind": "repeat_cancellations", "detail": f"{cancelled} cancelled bookings"})
        flagged = [r for r in reports if r.get("targetUserId") == fid and r.get("status") == "open"]
        if flagged:
            signals.append({"kind": "open_reports", "detail": f"{len(flagged)} open report(s)"})
        phone = (farmer.get("phone") or "")[-10:]
        if phone:
            shared = [
                u["id"] for u in users.values()
                if u["id"] != fid and (u.get("phone") or "")[-10:] == phone
            ]
            if shared:
                signals.append({"kind": "duplicate_account", "detail": f"same phone as {', '.join(shared)}"})
        level = "high" if any(s["kind"] in ("open_reports", "duplicate_account") for s in signals) else (
            "medium" if signals else "low"
        )
        rows.append(
            {
                "farmerId": fid,
                "farmerName": farmer.get("name", ""),
                "riskLevel": level,
                "signals": signals,
            }
        )
    rows.sort(key=lambda r: {"high": 0, "medium": 1, "low": 2}[r["riskLevel"]])
    return {"data": rows, "total": len(rows)}


# ---------------------------------------------------------------------------
# 3. Discovery: demand heatmap, ranking explanation, recommendations,
#    farmer demand-posting
# ---------------------------------------------------------------------------


@owner_router.get("/demand-heatmap")
async def demand_heatmap(ctx: tuple = Depends(_owner)):
    """Where farmer demand concentrates: live demand posts plus bookings from
    the last 30 days, grouped by machine type."""
    user, uid = ctx
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    posts = await query("equipment_demand_posts", [], limit=1000)
    bookings = await query("equipment_bookings", [], limit=2000)
    equipment = {e["id"]: e for e in await query("equipment", [], limit=1000)}
    heat: dict[str, dict] = {}
    for p in posts:
        if (p.get("dateTo") or "9999") < cutoff:
            continue
        bucket = heat.setdefault(
            p.get("machineType", ""), {"machineType": p.get("machineType", ""), "demandPosts": 0, "acres": 0.0, "bookings30d": 0})
        bucket["demandPosts"] += 1
        bucket["acres"] += float(p.get("acres") or 0)
    for b in bookings:
        if (b.get("date") or "") < cutoff:
            continue
        machine_type = (equipment.get(b.get("equipmentId")) or {}).get("type", "")
        bucket = heat.setdefault(machine_type, {"machineType": machine_type, "demandPosts": 0, "acres": 0.0, "bookings30d": 0})
        bucket["bookings30d"] += 1
    return {"data": sorted(heat.values(), key=lambda h: h["demandPosts"] + h["bookings30d"], reverse=True)}


@owner_router.get("/ranking/explain")
async def ranking_explain(ctx: tuple = Depends(_owner)):
    """How the browse ranking treats my machines: the real factors (plan
    priority, verified docs, rating, distance) per machine."""
    from app.services.billing import effective_plan
    from app.routers.ratings import provider_rating_fields

    user, uid = ctx
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    plan = await effective_plan(uid, "equipmentRental")
    priority = 0 if "priorityListing" in (plan.get("features") or []) else 1
    data = []
    for m in machines:
        ratings = await provider_rating_fields(m["id"])
        data.append(
            {
                "equipmentId": m["id"],
                "name": m.get("name", ""),
                "factors": {
                    "planPriority": priority,
                    "docStatus": m.get("docStatus", "pending"),
                    "ratingAvg": ratings["ratingAvg"],
                    "ratingCount": ratings["ratingCount"],
                    "distanceKm": m.get("distanceKm", 0),
                },
            }
        )
    data.sort(key=lambda d: (d["factors"]["planPriority"], d["factors"]["docStatus"] != "verified"))
    return {
        "plan": {"planId": plan.get("planId"), "tier": plan.get("tier")},
        "rules": "browse sorts Pro/Enterprise owners first (planPriority 0), "
        "then verified docs, rating and distance",
        "data": data,
    }


@owner_router.get("/recommendations")
async def owner_recommendations(ctx: tuple = Depends(_owner)):
    """Actionable recommendations from real signals: demand-gap types (farmers
    asking for machines I do not list) and quiet machines with live demand."""
    user, uid = ctx
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    my_types = {m.get("type") for m in machines if m.get("active", True)}
    heat = (await demand_heatmap(ctx))["data"]
    gaps = [h for h in heat if h["machineType"] and h["machineType"] not in my_types and h["demandPosts"] > 0]
    my_ids = {m["id"] for m in machines}
    month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    bookings = await query("equipment_bookings", [], limit=2000)
    quiet = []
    for m in machines:
        recent = [b for b in bookings if b.get("equipmentId") == m["id"] and (b.get("date") or "") >= month_ago]
        if not recent:
            demand = next((h for h in heat if h["machineType"] == m.get("type")), None)
            quiet.append(
                {
                    "equipmentId": m["id"],
                    "name": m.get("name", ""),
                    "type": m.get("type", ""),
                    "recommendation": "no bookings in 30 days",
                    "liveDemandForType": demand["demandPosts"] if demand else 0,
                }
            )
    return {
        "demandGaps": [
            {
                "machineType": g["machineType"],
                "demandPosts": g["demandPosts"],
                "acres": g["acres"],
                "recommendation": f"farmers are asking for {g['machineType']} — list one to capture this demand",
            }
            for g in gaps
        ],
        "quietMachines": quiet,
    }


class DemandPostIn(BaseModel):
    machineType: str = Field(min_length=2)
    acres: float = Field(default=0, ge=0)
    dateFrom: str
    dateTo: str
    village: str = ""
    budgetPerHourRupees: float = Field(default=0, ge=0)
    notes: str = ""


@router.post("/demand-posts", status_code=201)
async def create_demand_post(body: DemandPostIn, ctx: tuple = Depends(_farmer)):
    """Farmer demand-posting: what machine the farm needs, when, and the
    budget — surfaces to equipment owners as live demand."""
    user, uid = ctx
    try:
        start = datetime.strptime(body.dateFrom, "%Y-%m-%d").date()
        end = datetime.strptime(body.dateTo, "%Y-%m-%d").date()
    except ValueError:
        _error(422, "VALIDATION_ERROR", "dateFrom/dateTo must be YYYY-MM-DD")
    if end < start:
        _error(422, "INVALID_DATE_RANGE", "dateTo must be on or after dateFrom")
    doc = {
        **body.model_dump(),
        "id": f"eqd_{uuid.uuid4().hex[:12]}",
        "userId": uid,
        "userName": user.get("name", ""),
        "status": "open",
        "createdAt": _now(),
    }
    await set_doc("equipment_demand_posts", doc["id"], doc)
    return doc


@router.get("/demand-posts")
async def browse_demand_posts(
    machineType: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    docs = await query("equipment_demand_posts", [("status", "==", "open")], limit=1000)
    if machineType:
        docs = [d for d in docs if d.get("machineType", "").lower() == machineType.lower()]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


@router.delete("/demand-posts/{post_id}", status_code=204)
async def delete_demand_post(post_id: str, uid: str = Depends(current_user_id)):
    post = await get_doc("equipment_demand_posts", post_id)
    if post is None or post.get("userId") != uid:
        _error(404, "DEMAND_POST_NOT_FOUND", "demand post not found")
    await delete_doc("equipment_demand_posts", post_id)


# ---------------------------------------------------------------------------
# 4. Contracts: generate, version history, MPIN e-sign, real PDF
# ---------------------------------------------------------------------------


def _contract_scope(booking: dict, equipment: dict, slot: dict | None) -> dict:
    return {
        "equipmentId": equipment["id"],
        "equipmentName": equipment.get("name", ""),
        "machineType": equipment.get("type", ""),
        "date": booking.get("date", ""),
        "slotName": booking.get("slotName", ""),
        "duration": (slot or {}).get("duration", ""),
        "farmerId": booking.get("userId"),
        "farmerName": booking.get("farmerName", ""),
        "ownerId": equipment.get("ownerId"),
    }


def _contract_terms(equipment: dict) -> list[str]:
    return [
        "Machine delivered in working order with operator where agreed",
        "Fuel borne by the party agreed at booking time",
        "Damage beyond normal wear billed per the damage-claim process",
        f"Cancellation allowed up to {CANCEL_NOTICE_HOURS}h before the slot",
    ]


@router.post("/bookings/{booking_id}/contract", status_code=201)
async def generate_contract(booking_id: str, ctx: tuple = Depends(_owner)):
    """Generate (or regenerate, bumping the version) the booking contract with
    scope details — equipment, slot, rate and terms. Owner only."""
    user, uid = ctx
    booking, equipment = await _booking_participant(booking_id, uid)
    if equipment.get("ownerId") != uid:
        _error(403, "NOT_EQUIPMENT_OWNER", "only the owner generates the contract")
    if booking.get("status") in ("cancelled", "rejected"):
        _error(409, "BOOKING_NOT_CONTRACTABLE", f"cannot contract a {booking.get('status')} booking")
    slot = await get_doc("equipment_slots", booking.get("slotId") or "") or {}
    doc = await get_doc("equipment_contracts", booking_id) or {
        "bookingId": booking_id,
        "status": "generated",
        "currentVersion": 0,
        "versions": [],
        "esign": None,
        "pdf": None,
    }
    doc["currentVersion"] += 1
    doc["versions"].append(
        {
            "version": doc["currentVersion"],
            "generatedAt": _now(),
            "generatedBy": uid,
            "scope": _contract_scope(booking, equipment, slot),
            "rateRupees": booking.get("priceRupees", 0),
            "currency": "INR",
            "terms": _contract_terms(equipment),
        }
    )
    if doc["status"] == "signed":
        doc["status"] = "generated"  # regeneration voids the old signature
        doc["esign"] = None
    await set_doc("equipment_contracts", booking_id, doc)
    return doc


@router.get("/bookings/{booking_id}/contract")
async def get_contract(booking_id: str, uid: str = Depends(current_user_id)):
    """The booking contract — latest version plus the full version history.
    Both booking parties."""
    await _booking_participant(booking_id, uid)
    doc = await get_doc("equipment_contracts", booking_id)
    if doc is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not generated yet")
    return doc


class EsignIn(BaseModel):
    mpin: str = Field(min_length=4, max_length=4)
    consentTimestamp: str


@router.post("/bookings/{booking_id}/contract/esign")
async def esign_contract(booking_id: str, body: EsignIn, uid: str = Depends(current_user_id)):
    """MPIN e-sign of the current contract version. The signature is recorded
    with the consent timestamp; regenerating the contract voids it."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    await _booking_participant(booking_id, uid)
    doc = await get_doc("equipment_contracts", booking_id)
    if doc is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not generated yet")
    if not user.get("mpinHash"):
        _error(409, "MPIN_NOT_SET", "set an MPIN before e-signing")
    if not verify_mpin(body.mpin, user["mpinHash"]):
        _error(403, "INVALID_MPIN", "MPIN verification failed")
    doc["status"] = "signed"
    doc["esign"] = {
        "partyId": uid,
        "partyName": user.get("name", ""),
        "method": "mpin",
        "consentTimestamp": body.consentTimestamp,
        "signedAt": _now(),
        "version": doc["currentVersion"],
    }
    await set_doc("equipment_contracts", booking_id, doc)
    other = None
    booking = await get_doc("equipment_bookings", booking_id) or {}
    equipment = await get_doc("equipment", booking.get("equipmentId") or "") or {}
    other = booking.get("userId") if uid == equipment.get("ownerId") else equipment.get("ownerId")
    if other:
        await notify_user(
            other,
            type="equipment_contract",
            title="Contract signed / अनुबंध पर हस्ताक्षर",
            body=f"Booking {booking_id} contract v{doc['currentVersion']} e-signed",
            deepLink=f"/dashboard/p/equipment/bookings/{booking_id}",
        )
    return doc


@router.get("/bookings/{booking_id}/contract/pdf")
async def contract_pdf(booking_id: str, uid: str = Depends(current_user_id)):
    """Download the contract PDF (generated on demand with the platform
    header, scope, rate, terms and the version history)."""
    from io import BytesIO

    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    await _booking_participant(booking_id, uid)
    doc = await get_doc("equipment_contracts", booking_id)
    if doc is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not generated yet")
    latest = doc["versions"][-1]
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 60
    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, y, "AGROVERCITY — Equipment Rental Contract")
    y -= 28
    c.setFont("Helvetica", 10)
    for line in (
        f"Contract: {booking_id} · Version: {doc['currentVersion']} · Status: {doc['status']}",
        f"Equipment: {latest['scope']['equipmentName']} ({latest['scope']['machineType']})",
        f"Slot: {latest['scope']['date']} · {latest['scope']['slotName']} ({latest['scope']['duration']})",
        f"Farmer: {latest['scope']['farmerName']} · Owner ID: {latest['scope']['ownerId']}",
        f"Rate: Rs {latest['rateRupees']:.2f} ({latest['currency']})",
        "",
        "Terms:",
        *[f"  {i+1}. {t}" for i, t in enumerate(latest["terms"])],
        "",
        f"E-sign: {doc['esign'] or 'not signed'}",
        f"Generated at: {_now()}",
    ):
        c.drawString(60, y, line)
        y -= 16
        if y < 60:
            c.showPage()
            c.setFont("Helvetica", 10)
            y = height - 60
    c.save()
    buffer.seek(0)
    blob_path, _ = storage.upload_user_file(
        uid, buffer.read(), f"contract_{booking_id}_v{doc['currentVersion']}.pdf",
        "application/pdf", prefix="equipment_contracts",
    )
    url = storage.signed_download_url(blob_path)
    doc["pdf"] = {"blobPath": blob_path, "url": url, "generatedAt": _now()}
    await set_doc("equipment_contracts", booking_id, doc)
    return {"bookingId": booking_id, "version": doc["currentVersion"], "pdfUrl": url, "blobPath": blob_path}


# ---------------------------------------------------------------------------
# 5. Payments: advance/balance, refunds, invoice, settlement tracking
# ---------------------------------------------------------------------------


class BookingPaymentIn(BaseModel):
    amountRupees: float = Field(gt=0)
    kind: str = "advance"  # advance | balance
    method: str = ""
    reference: str = ""


@router.post("/bookings/{booking_id}/payments", status_code=201)
async def record_booking_payment(booking_id: str, body: BookingPaymentIn, uid: str = Depends(current_user_id)):
    """In-app payment against a booking — advance or balance (split payments
    accumulate). Records the payer and notifies the owner on every payment."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    booking, equipment = await _booking_participant(booking_id, uid)
    if booking.get("status") in ("cancelled", "rejected"):
        _error(409, "BOOKING_SETTLED", f"cannot pay a {booking.get('status')} booking")
    if body.kind not in ("advance", "balance"):
        _error(422, "VALIDATION_ERROR", "kind must be advance or balance", {"kind": "advance|balance"})
    paid = sum(p.get("amountRupees", 0) for p in booking.get("payments") or [])
    if paid + body.amountRupees > float(booking.get("priceRupees", 0)) + 0.001:
        _error(409, "PAYMENT_EXCEEDS_DUE", f"amount exceeds pending balance of {round(booking.get('priceRupees', 0) - paid, 2)}")
    payment = {
        "id": f"eqp_{uuid.uuid4().hex[:10]}",
        "kind": body.kind,
        "amountRupees": body.amountRupees,
        "method": body.method,
        "reference": body.reference,
        "by": uid,
        "at": _now(),
    }
    booking.setdefault("payments", []).append(payment)
    if body.kind == "advance":
        booking["advancePaidRupees"] = round(paid + body.amountRupees, 2)
    await set_doc("equipment_bookings", booking_id, booking)
    owner_id = equipment.get("ownerId")
    if owner_id and owner_id != uid:
        await notify_user(
            owner_id,
            type="equipment_payment",
            title=f"{body.kind.title()} received / भुगतान मिला",
            body=f"₹{body.amountRupees} for {equipment.get('name', '')} ({booking.get('date', '')})",
            deepLink=f"/dashboard/p/equipment/bookings/{booking_id}",
        )
    return {"payment": payment, "paidRupees": round(paid + body.amountRupees, 2), "dueRupees": round(booking.get("priceRupees", 0) - paid - body.amountRupees, 2)}


@router.post("/bookings/{booking_id}/refund", status_code=201)
async def refund_booking_payment(booking_id: str, body: dict, ctx: tuple = Depends(_owner)):
    """Owner-issued refund (part or full) with reason — recorded on the booking
    and visible on the invoice."""
    user, uid = ctx
    booking, equipment = await _booking_participant(booking_id, uid)
    if equipment.get("ownerId") != uid:
        _error(403, "NOT_EQUIPMENT_OWNER", "only the owner issues refunds")
    amount = float(body.get("amountRupees") or 0)
    if amount <= 0:
        _error(422, "VALIDATION_ERROR", "amountRupees must be positive", {"amountRupees": "must be > 0"})
    paid = sum(p.get("amountRupees", 0) for p in booking.get("payments") or [])
    refunded = sum(r.get("amountRupees", 0) for r in booking.get("refunds") or [])
    if amount > paid - refunded + 0.001:
        _error(409, "REFUND_EXCEEDS_PAID", f"only ₹{round(paid - refunded, 2)} refundable")
    entry = {
        "id": f"eqr_{uuid.uuid4().hex[:10]}",
        "amountRupees": amount,
        "reason": str(body.get("reason") or ""),
        "by": uid,
        "at": _now(),
    }
    booking.setdefault("refunds", []).append(entry)
    await set_doc("equipment_bookings", booking_id, booking)
    await notify_user(
        booking.get("userId"),
        type="equipment_refund",
        title="Refund issued / रिफंड जारी",
        body=f"₹{amount} refunded for {equipment.get('name', '')}: {entry['reason'] or 'no reason'}",
        deepLink=f"/dashboard/p/equipment/bookings/{booking_id}",
    )
    return {"refund": entry, "refundedRupees": round(refunded + amount, 2)}


@router.get("/bookings/{booking_id}/invoice")
async def booking_invoice(booking_id: str, uid: str = Depends(current_user_id)):
    """Booking invoice: rental line, payments, refunds, the platform commission
    and the owner net — all from the real booking + config."""
    from app.services import settlements as settlements_service

    await _booking_participant(booking_id, uid)
    booking = await get_doc("equipment_bookings", booking_id)
    config = await settlements_service._config()
    pct = float(config.get("equipmentRentalPct", 12))
    rental = float(booking.get("priceRupees", 0))
    paid = sum(p.get("amountRupees", 0) for p in booking.get("payments") or [])
    refunded = sum(r.get("amountRupees", 0) for r in booking.get("refunds") or [])
    commission = round(rental * pct / 100, 2)
    return {
        "invoiceNo": f"EQI-{booking_id[-8:].upper()}-{datetime.now(timezone.utc).strftime('%y%m')}",
        "bookingId": booking_id,
        "issuedAt": _now(),
        "status": booking.get("status", ""),
        "lines": [
            {"type": "rental", "description": f"Equipment rental {booking.get('date', '')} {booking.get('slotName', '')}", "amountRupees": rental},
            {"type": "payments", "description": f"{len(booking.get('payments') or [])} payment(s) received", "amountRupees": round(paid, 2)},
            {"type": "refunds", "description": f"{len(booking.get('refunds') or [])} refund(s)", "amountRupees": -round(refunded, 2)},
        ],
        "commissionPercent": pct,
        "commissionRupees": commission,
        "netOwnerRupees": round(rental - commission, 2),
        "dueFromFarmerRupees": round(rental - paid, 2),
        "currency": "INR",
    }


# ---------------------------------------------------------------------------
# 6-7. Disputes: open, evidence, case tracking with SLA
# ---------------------------------------------------------------------------


class DisputeOpenIn(BaseModel):
    category: str = Field(min_length=3)
    description: str = Field(min_length=5)
    claimRupees: float = Field(default=0, ge=0)


def _dispute_timeline(dispute: dict) -> dict:
    created = dispute.get("createdAt", "")
    try:
        due = datetime.fromisoformat(created) + timedelta(hours=dispute.get("slaHours", DISPUTE_SLA_HOURS))
        hours_left = round((due - datetime.now(timezone.utc)).total_seconds() / 3600, 1)
    except ValueError:
        due, hours_left = None, None
    status = dispute.get("status", "open")
    breach = status == "open" and hours_left is not None and hours_left < 0
    return {
        "disputeId": dispute["id"],
        "bookingId": dispute.get("bookingId"),
        "equipmentId": dispute.get("equipmentId"),
        "openedBy": dispute.get("openedBy"),
        "againstId": dispute.get("againstId"),
        "category": dispute.get("category"),
        "description": dispute.get("description"),
        "claimRupees": dispute.get("claimRupees", 0),
        "status": status,
        "slaHours": dispute.get("slaHours", DISPUTE_SLA_HOURS),
        "dueAt": due.isoformat() if due else None,
        "hoursLeft": hours_left,
        "slaBreached": breach,
        "evidence": dispute.get("evidence") or [],
        "events": dispute.get("events") or [],
        "resolution": dispute.get("resolution"),
        "createdAt": created,
    }


@router.post("/bookings/{booking_id}/disputes", status_code=201)
async def open_dispute(booking_id: str, body: DisputeOpenIn, uid: str = Depends(current_user_id)):
    """Open an equipment dispute (either party): category, description and an
    optional claim. The case carries a 72h review SLA from real time."""
    booking, equipment = await _booking_participant(booking_id, uid)
    if booking.get("status") in ("cancelled", "rejected"):
        _error(409, "BOOKING_NOT_DISPUTABLE", f"cannot dispute a {booking.get('status')} booking")
    existing = await query("equipment_disputes", [("bookingId", "==", booking_id), ("status", "==", "open")], limit=1)
    if existing:
        _error(409, "DISPUTE_ALREADY_OPEN", "an open dispute already exists for this booking")
    other = booking.get("userId") if uid == equipment.get("ownerId") else equipment.get("ownerId")
    dispute_id = f"eqs_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": dispute_id,
        "bookingId": booking_id,
        "equipmentId": equipment["id"],
        "openedBy": uid,
        "againstId": other,
        "category": body.category,
        "description": body.description,
        "claimRupees": body.claimRupees,
        "status": "open",
        "slaHours": DISPUTE_SLA_HOURS,
        "evidence": [],
        "events": [{"at": _now(), "event": "opened", "by": uid}],
        "resolution": None,
        "createdAt": _now(),
    }
    await set_doc("equipment_disputes", dispute_id, doc)
    if other:
        await notify_user(
            other,
            type="equipment_dispute",
            title="Equipment dispute opened / विवाद खुला",
            body=f"{body.category} on {equipment.get('name', '')} — respond within {DISPUTE_SLA_HOURS}h",
            deepLink=f"/dashboard/p/equipment/disputes/{dispute_id}",
        )
    return _dispute_timeline(doc)


@router.get("/disputes/{dispute_id}")
async def get_dispute(dispute_id: str, uid: str = Depends(current_user_id)):
    """Case tracking: full timeline, evidence and live SLA (dueAt, hoursLeft,
    breached). Either party or admin."""
    dispute = await get_doc("equipment_disputes", dispute_id)
    if dispute is None:
        _error(404, "DISPUTE_NOT_FOUND", "dispute not found")
    user = await get_user(uid) or {}
    if uid not in (dispute.get("openedBy"), dispute.get("againstId")) and not user.get("isAdmin"):
        _error(403, "DISPUTE_FORBIDDEN", "not a dispute party")
    return _dispute_timeline(dispute)


@router.get("/disputes")
async def my_disputes(uid: str = Depends(current_user_id)):
    opened = await query("equipment_disputes", [("openedBy", "==", uid)], limit=500)
    against = await query("equipment_disputes", [("againstId", "==", uid)], limit=500)
    seen = {d["id"] for d in opened}
    docs = opened + [d for d in against if d["id"] not in seen]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": [_dispute_timeline(d) for d in docs], "total": len(docs)}


class EvidenceIn(BaseModel):
    photoUrls: list[str] = []
    note: str = ""


@router.post("/disputes/{dispute_id}/evidence", status_code=201)
async def add_dispute_evidence(dispute_id: str, body: EvidenceIn, uid: str = Depends(current_user_id)):
    """Append evidence (photos + note) to an open dispute — either party."""
    dispute = await get_doc("equipment_disputes", dispute_id)
    if dispute is None:
        _error(404, "DISPUTE_NOT_FOUND", "dispute not found")
    if uid not in (dispute.get("openedBy"), dispute.get("againstId")):
        _error(403, "DISPUTE_FORBIDDEN", "not a dispute party")
    if dispute.get("status") != "open":
        _error(409, "DISPUTE_CLOSED", f"dispute is {dispute.get('status')}")
    entry = {
        "id": f"evi_{uuid.uuid4().hex[:10]}",
        "photoUrls": body.photoUrls,
        "note": body.note,
        "by": uid,
        "at": _now(),
    }
    dispute.setdefault("evidence", []).append(entry)
    dispute.setdefault("events", []).append({"at": _now(), "event": "evidence_added", "by": uid})
    await set_doc("equipment_disputes", dispute_id, dispute)
    return {"evidence": entry, "total": len(dispute["evidence"])}


# ---------------------------------------------------------------------------
# 8-9. Owner monitoring, settlements, commission, policies
# ---------------------------------------------------------------------------


@owner_router.get("/monitoring/bookings")
async def monitoring_bookings(
    status: str | None = None,
    machine_id: str | None = None,
    ctx: tuple = Depends(_owner),
):
    """Every booking across my machines — status, farmer, slot, amount, and
    payment progress — for live booking monitoring."""
    user, uid = ctx
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    by_id = {m["id"]: m for m in machines}
    bookings = await query("equipment_bookings", [], limit=2000)
    rows = []
    for b in bookings:
        if b.get("equipmentId") not in by_id:
            continue
        if status and b.get("status") != status:
            continue
        if machine_id and b.get("equipmentId") != machine_id:
            continue
        paid = sum(p.get("amountRupees", 0) for p in b.get("payments") or [])
        rows.append(
            {
                "bookingId": b["id"],
                "equipmentId": b.get("equipmentId"),
                "equipmentName": by_id[b["equipmentId"]].get("name", ""),
                "farmerId": b.get("userId"),
                "farmerName": b.get("farmerName", ""),
                "date": b.get("date"),
                "slotName": b.get("slotName"),
                "priceRupees": b.get("priceRupees", 0),
                "paidRupees": round(paid, 2),
                "status": b.get("status", ""),
                "createdAt": b.get("createdAt", ""),
            }
        )
    rows.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    by_status: dict[str, int] = {}
    for r in rows:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    return {"data": rows, "total": len(rows), "byStatus": by_status}


@owner_router.get("/settlements")
async def settlement_tracking(ctx: tuple = Depends(_owner)):
    """Settlement tracking: weekly settlement lines with gross → commission →
    net, payout status/holds, plus the current in-progress week preview from
    real completed bookings."""
    from app.services import settlements as settlements_service

    user, uid = ctx
    settlements = await query(
        "settlements", [("role", "==", "equipmentRental"), ("entityId", "==", uid)], limit=200
    )
    settlements.sort(key=lambda s: s.get("periodStart", ""), reverse=True)
    week_dates = set()
    today = datetime.now(timezone.utc).date()
    monday = today - timedelta(days=today.weekday())
    for i in range(7):
        week_dates.add((monday + timedelta(days=i)).isoformat())
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    machine_ids = {m["id"] for m in machines}
    bookings = [b for b in await query("equipment_bookings", [], limit=2000) if b.get("equipmentId") in machine_ids]
    config = await settlements_service._config()
    pct = float(config.get("equipmentRentalPct", 12))
    week_completed = [b for b in bookings if b.get("status") == "completed" and str(b.get("date", "")) in week_dates]
    week_gross = round(sum(float(b.get("priceRupees", 0)) for b in week_completed), 2)
    return {
        "data": settlements,
        "total": len(settlements),
        "currentWeek": {
            "periodStart": monday.isoformat(),
            "periodEnd": (monday + timedelta(days=6)).isoformat(),
            "completedBookings": len(week_completed),
            "grossRupees": week_gross,
            "commissionPercent": pct,
            "projectedNetRupees": round(week_gross * (100 - pct) / 100, 2),
        },
        "onHold": not await settlements_service._has_verified_bank_account(uid),
    }


@owner_router.get("/commission")
async def commission_view(ctx: tuple = Depends(_owner)):
    """Commission management visibility: the configured equipment commission
    and my historical commission paid per settlement period."""
    from app.services import settlements as settlements_service

    user, uid = ctx
    config = await settlements_service._config()
    pct = float(config.get("equipmentRentalPct", 12))
    settlements = await query(
        "settlements", [("role", "==", "equipmentRental"), ("entityId", "==", uid)], limit=200
    )
    settlements.sort(key=lambda s: s.get("periodStart", ""), reverse=True)
    return {
        "commissionPercent": pct,
        "configSource": "platform_config/settlements equipmentRentalPct",
        "history": [
            {
                "periodStart": s.get("periodStart"),
                "periodEnd": s.get("periodEnd"),
                "grossRupees": s.get("grossRupees", 0),
                "commissionRupees": s.get("commissionRupees", 0),
                "netRupees": s.get("netRupees", 0),
                "status": s.get("status"),
            }
            for s in settlements
        ],
    }


@owner_router.get("/policies")
async def platform_policies(ctx: tuple = Depends(_owner)):
    """Platform policy config for equipment rentals — commission, cancellation
    notice, surge, moderation and data retention (admin-editable via
    platform_config/equipment_policies; these are the real effective values)."""
    from app.services import settlements as settlements_service

    user, uid = ctx
    overrides = await get_doc("platform_config", "equipment_policies") or {}
    config = await settlements_service._config()
    policies = {**POLICY_DEFAULTS, **{k: v for k, v in overrides.items() if k in POLICY_DEFAULTS}}
    policies["commissionPercent"] = float(config.get("equipmentRentalPct", 12))
    return {"trade": "equipmentRental", "policies": policies}


@owner_router.get("/reminders")
async def equipment_reminders(ctx: tuple = Depends(_owner)):
    """Computed reminders: insurance/RC expirations (30/7/1-day windows),
    service due dates and pending booking approvals — the equipment-reminder
    surface behind the existing task emissions."""
    user, uid = ctx
    today = datetime.now(timezone.utc).date()
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    reminders = []
    for m in machines:
        for field, label in (("insuranceExpiry", "insurance_expiry"), ("rcExpiry", "rc_expiry")):
            raw = m.get(field)
            if not raw:
                continue
            try:
                days = (datetime.fromisoformat(str(raw)).date() - today).days
            except ValueError:
                continue
            if 0 <= days <= 30:
                reminders.append(
                    {
                        "kind": label,
                        "equipmentId": m["id"],
                        "equipmentName": m.get("name", ""),
                        "dueDate": str(raw)[:10],
                        "daysLeft": days,
                        "priority": "high" if days <= 7 else "medium",
                    }
                )
        schedule = m.get("serviceSchedule") or {}
        due = schedule.get("nextServiceDate")
        if due:
            try:
                days = (datetime.fromisoformat(str(due)).date() - today).days
            except ValueError:
                days = None
            if days is not None and days <= 14:
                reminders.append(
                    {
                        "kind": "service_due",
                        "equipmentId": m["id"],
                        "equipmentName": m.get("name", ""),
                        "dueDate": str(due)[:10],
                        "daysLeft": days,
                        "priority": "high" if days <= 3 else "medium",
                    }
                )
    machine_ids = {m["id"] for m in machines}
    pending = [
        b for b in await query("equipment_bookings", [("status", "==", "pending")], limit=1000)
        if b.get("equipmentId") in machine_ids
    ]
    for b in pending:
        reminders.append(
            {
                "kind": "booking_approval_needed",
                "bookingId": b["id"],
                "equipmentId": b.get("equipmentId"),
                "dueDate": b.get("date"),
                "daysLeft": 0,
                "priority": "urgent",
            }
        )
    reminders.sort(key=lambda r: (r["daysLeft"], r["priority"] != "urgent"))
    return {"data": reminders, "total": len(reminders)}
