import math
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import admin_user, current_user_id
from app.core.security import verify_mpin
from app.models.land import (
    AcceptContactIn,
    LandListingIn,
    LandListingOut,
    LandListingUpdate,
    LandRequirementIn,
    LandRequirementRespondIn,
    LeaseIn,
    LeaseOut,
    LeaseRequestIn,
    LeaseRequestOut,
    LeaseUpdate,
    LeaseOutcomeIn,
    PlotIn,
    PlotOut,
    PlotUpdate,
    RejectRequestIn,
    RentPaymentIn,
    RentPaymentOut,
    CounterRequestIn,
    MilestoneUpdateIn,
    LeaseEsignIn,
    EscrowFundIn,
    MilestoneReleaseIn,
)
from app.routers.users import require_role
from app.services import billing, idempotency, land_ai, reports
from app.services.ai.privacy import build_land_listing_quality_state
from app.services.chat import ensure_direct_room
from app.services.land_crm import convert_lead, find_lease_for_caller, promote_waitlist, upsert_lead
from app.services.notify import notify_user
from app.services.payments import create_razorpay_order, verify_razorpay_signature
from app.services.pnl_engine import record_auto_entry
from app.services.rating_prompts import open_rating_prompt
from app.services.tasks import DEEP_LINKS, emit_task
from app.services.users import get_user
from app.services.verification import is_identity_verified, verification_map

router = APIRouter(prefix="/land", tags=["land"])

# Direct-connect terms (spec §11) — versioned like the other flows.
LEASE_TERMS_VERSION = "land-dc-1.0"


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _owner(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "farmLandlord")
    return uid


async def _landlord(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmLandlord")
    return uid


async def _farmer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return uid


RETENTION_YEARS = 7

RENT_LATE_FEE_DAYS = 15
RENT_DISPUTE_OFFER_DAYS = 30
RENT_LATE_FEE_RATE = 0.02


class LandDisputeIn(BaseModel):
    category: str = Field(..., min_length=2)
    note: str | None = None


def _retain_until() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=365 * RETENTION_YEARS)).isoformat()


async def _audit(uid: str, action: str, payload: dict) -> None:
    now = datetime.now(timezone.utc)
    await set_doc(
        "audit_logs",
        f"aud_{action.lower()}_{uid}_{now.strftime('%Y%m%d%H%M%S%f')}",
        {"action": action, "adminId": uid, "at": now.isoformat(), **payload},
    )


async def _landlord_plan(uid: str) -> dict:
    return await billing.effective_plan(uid, "farmLandlord")


async def _require_pro(uid: str, feature: str) -> None:
    plan = await _landlord_plan(uid)
    if plan.get("tier") == "free":
        _error(
            402,
            "UPGRADE_REQUIRED",
            f"{feature} is available on the Pro plan (₹299/mo)",
            {feature: "upgrade required"},
        )


async def _enforce_plot_limit(uid: str) -> None:
    plan = await _landlord_plan(uid)
    limit = (plan.get("limits") or {}).get("plots")
    if limit is None:
        return
    plots = await list_subdocs(f"users/{uid}/land_plots")
    if len(plots) >= int(limit):
        _error(
            402,
            "ENTITLEMENT_EXCEEDED",
            "your plan's plot limit is reached — upgrade to add more",
            {"plots": f"limit {limit} reached"},
        )


async def _enforce_active_lease_limit(uid: str) -> None:
    plan = await _landlord_plan(uid)
    limit = (plan.get("limits") or {}).get("activeLeases")
    if limit is None:
        return
    active = [l for l in await _leases(uid) if l.get("status") == "active"]
    if len(active) >= int(limit):
        _error(
            402,
            "ENTITLEMENT_EXCEEDED",
            "your plan's active-lease limit is reached — upgrade to add more",
            {"activeLeases": f"limit {limit} reached"},
        )


async def list_subdocs(path: str) -> list[dict]:
    return await query(path, [], limit=1000)


def _envelope(items: list[dict]) -> dict:
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


async def _leases(uid: str) -> list[dict]:
    return await list_subdocs(f"users/{uid}/land_leases")


async def _require_plot(uid: str, plot_id: str) -> dict:
    plot = await get_doc(f"users/{uid}/land_plots", plot_id)
    if plot is None:
        _error(404, "PLOT_NOT_FOUND", "plot not found")
    return plot


async def _require_lease(uid: str, lease_id: str) -> dict:
    lease = await get_doc(f"users/{uid}/land_leases", lease_id)
    if lease is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    return lease


async def _on_lease_ended(uid: str, lease: dict) -> None:
    """Lease reached a terminal state: reopen the marketplace listing, hand
    first refusal to the waitlist and open the landlord→farmer rating prompt
    (the farmer→landlord prompt was opened at accept time)."""
    listing_id = lease.get("listingId")
    if listing_id:
        listing = await get_doc("land_listings", listing_id)
        if listing is not None and listing.get("status") == "leased":
            listing["status"] = "open"
            await set_doc("land_listings", listing_id, listing)
        await promote_waitlist(listing_id)
    tenant = lease.get("tenantFarmerId")
    if tenant:
        await open_rating_prompt(uid, tenant, lease["id"], "land_lease")


async def _set_plot_status(uid: str, plot_id: str, status: str):
    plot = await get_doc(f"users/{uid}/land_plots", plot_id)
    if plot is not None:
        plot["status"] = status
        await set_doc(f"users/{uid}/land_plots", plot_id, plot)


@router.get("/plots")
async def list_plots(uid: str = Depends(_owner)):
    return _envelope(await list_subdocs(f"users/{uid}/land_plots"))


@router.post("/plots", status_code=201, response_model=PlotOut)
async def create_plot(body: PlotIn, uid: str = Depends(_owner)):
    await _enforce_plot_limit(uid)
    plot = PlotOut(id=uuid.uuid4().hex, status="vacant", **body.model_dump())
    await set_doc(f"users/{uid}/land_plots", plot.id, plot.model_dump())
    return plot


@router.put("/plots/{plot_id}", response_model=PlotOut)
async def update_plot(plot_id: str, body: PlotUpdate, uid: str = Depends(_owner)):
    plot = await _require_plot(uid, plot_id)
    plot.update(body.model_dump(exclude_unset=True))
    await set_doc(f"users/{uid}/land_plots", plot_id, plot)
    return PlotOut(**plot)


@router.delete("/plots/{plot_id}", status_code=204)
async def delete_plot(plot_id: str, uid: str = Depends(_owner)):
    await _require_plot(uid, plot_id)
    active = [
        l for l in await _leases(uid)
        if l.get("plotId") == plot_id and l.get("status") == "active"
    ]
    if active:
        _error(409, "PLOT_HAS_ACTIVE_LEASE", "plot has an active lease")
    await delete_doc(f"users/{uid}/land_plots", plot_id)


@router.get("/leases")
async def list_leases(status: str | None = None, uid: str = Depends(_owner)):
    leases = await _leases(uid)
    if status is not None:
        leases = [l for l in leases if l.get("status") == status]
    return _envelope(leases)


@router.post("/leases", status_code=201, response_model=LeaseOut)
async def create_lease(body: LeaseIn, uid: str = Depends(_owner)):
    await _enforce_active_lease_limit(uid)
    await _require_plot(uid, body.plotId)
    if body.endDate <= body.startDate:
        _error(
            422,
            "INVALID_DATE_RANGE",
            "endDate must be after startDate",
            {"endDate": "must be after startDate"},
        )
    lease = LeaseOut(
        id=uuid.uuid4().hex, status="active", verified=False, **body.model_dump()
    )
    lease_doc = {**lease.model_dump(), "retainUntil": _retain_until()}
    await set_doc(f"users/{uid}/land_leases", lease.id, lease_doc)
    await _set_plot_status(uid, body.plotId, "leased")
    return lease


@router.put("/leases/{lease_id}", response_model=LeaseOut)
async def update_lease(lease_id: str, body: LeaseUpdate, uid: str = Depends(_owner)):
    lease = await _require_lease(uid, lease_id)
    updates = body.model_dump(exclude_unset=True)
    lease.update(updates)
    await set_doc(f"users/{uid}/land_leases", lease_id, lease)
    if updates.get("status") in ("ended", "terminated"):
        await _set_plot_status(uid, lease["plotId"], "vacant")
        await _on_lease_ended(uid, lease)
    return LeaseOut(**lease)


@router.delete("/leases/{lease_id}", status_code=204)
async def delete_lease(lease_id: str, uid: str = Depends(_owner)):
    lease = await _require_lease(uid, lease_id)
    await delete_doc(f"users/{uid}/land_leases", lease_id)
    if lease.get("status") == "active":
        await _set_plot_status(uid, lease["plotId"], "vacant")


@router.post("/leases/{lease_id}/payments", status_code=201, response_model=RentPaymentOut)
async def add_payment(lease_id: str, body: RentPaymentIn, uid: str = Depends(_owner)):
    """Record a (possibly partial) rent payment; integer paisa ledger.

    The month's ledger doc tracks amountPaidPaisa vs amountDuePaisa and stays
    payable until fully paid (phase-02 WS-01 step 3, rule 3)."""
    lease = await _require_lease(uid, lease_id)
    amount_paisa = int(round(float(body.amountRupees) * 100))
    if amount_paisa <= 0:
        _error(422, "VALIDATION_ERROR", "amount must be greater than 0", {"amountRupees": "must be > 0"})
    due_paisa = int(round(float(lease.get("monthlyRentRupees", 0) or 0) * 100))
    ledger_collection = f"users/{uid}/land_leases/{lease_id}/rent_ledger"
    ledger = await get_doc(ledger_collection, body.month) or {
        "month": body.month,
        "amountDuePaisa": due_paisa,
        "amountPaidPaisa": 0,
        "status": "due",
    }
    if int(ledger.get("amountPaidPaisa", 0)) >= int(ledger.get("amountDuePaisa", due_paisa)):
        _error(409, "DUPLICATE_PAYMENT_MONTH", "payment already recorded for this month")
    payment = RentPaymentOut(id=uuid.uuid4().hex, leaseId=lease_id, **body.model_dump())
    payment_doc = {
        **payment.model_dump(),
        "amountPaidPaisa": amount_paisa,
        "retainUntil": _retain_until(),
    }
    await set_doc(f"users/{uid}/land_leases/{lease_id}/payments", payment.id, payment_doc)
    paid = int(ledger.get("amountPaidPaisa", 0)) + amount_paisa
    ledger.update(
        amountPaidPaisa=paid,
        status="paid" if paid >= int(ledger.get("amountDuePaisa", due_paisa)) else "partial",
        updatedAt=datetime.now(timezone.utc).isoformat(),
        retainUntil=_retain_until(),
    )
    await set_doc(ledger_collection, body.month, ledger)
    await _audit(
        uid,
        "RENT_PAYMENT_RECORDED",
        {
            "leaseId": lease_id,
            "month": body.month,
            "amountPaidPaisa": amount_paisa,
            "balancePaisa": max(0, int(ledger.get("amountDuePaisa", due_paisa)) - paid),
        },
    )
    await record_auto_entry(
        uid, "income", amount_paisa, "lease_payment", "lease_payment", payment.id
    )
    return payment


@router.get("/leases/{lease_id}/payments")
async def list_payments(lease_id: str, uid: str = Depends(_owner)):
    lease = await _require_lease(uid, lease_id)
    payments = await list_subdocs(f"users/{uid}/land_leases/{lease_id}/payments")
    payments.sort(key=lambda p: p.get("month", ""), reverse=True)
    total = sum(p.get("amountRupees", 0) for p in payments)
    ledgers = await list_subdocs(f"users/{uid}/land_leases/{lease_id}/rent_ledger")
    paid_months = {p.get("month") for p in payments}
    for ledger in ledgers:
        due_paisa = int(ledger.get("amountDuePaisa", 0))
        paid_paisa = int(ledger.get("amountPaidPaisa", 0))
        if due_paisa and paid_paisa >= due_paisa:
            paid_months.add(ledger.get("month"))
        else:
            paid_months.discard(ledger.get("month"))
    year, month = int(lease["startDate"][:4]), int(lease["startDate"][5:7])
    current = date.today().strftime("%Y-%m")
    pending = []
    while True:
        ym = f"{year:04d}-{month:02d}"
        if ym > current:
            break
        if ym not in paid_months:
            pending.append(ym)
        month += 1
        if month > 12:
            month = 1
            year += 1
    return {
        **_envelope(payments),
        "totalCollectedRupees": total,
        "pendingMonths": pending,
    }


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    return date(year, month % 12 + 1, min(d.day, 28))


async def _require_listing(listing_id: str) -> dict:
    listing = await get_doc("land_listings", listing_id)
    if listing is None:
        _error(404, "LISTING_NOT_FOUND", "listing not found")
    return listing


async def _require_request(request_id: str) -> dict:
    request = await get_doc("lease_requests", request_id)
    if request is None:
        _error(404, "LISTING_NOT_FOUND", "lease request not found")
    return request


def _contact_of(user: dict) -> dict:
    phone = user.get("phone") or ""
    whatsapp = user.get("whatsapp") or phone
    digits = "".join(ch for ch in str(phone) if ch.isdigit()) or None
    wa_digits = "".join(ch for ch in str(whatsapp) if ch.isdigit()) or None
    return {
        "name": (user.get("name") or "").strip().split(" ")[0],
        "fullName": user.get("name") or "",
        "village": user.get("village", ""),
        "district": user.get("district", ""),
        "phone": phone,
        "phoneDigits": digits,
        "whatsappDigits": wa_digits,
        "verified": True,
    }


def _public_listing(listing: dict, verified_by_landlord: dict[str, bool]) -> dict:
    """Public projection (spec §7/§19): badges in, private data out. The full
    survey/Gat number and private land documents never appear publicly."""
    row = dict(listing)
    row.pop("landDocuments", None)
    survey = row.get("surveyNumber")
    if survey:
        row["surveyNumber"] = f"…{str(survey)[-4:]}"
    row["landlordVerified"] = verified_by_landlord.get(listing.get("landlordId") or "", False)
    # Land Documents Verified means an actual completed document review only.
    row["landVerified"] = listing.get("landDocumentsStatus") == "verified"
    return row


@router.post("/listings", status_code=201, response_model=LandListingOut)
async def create_listing(body: LandListingIn, uid: str = Depends(_landlord)):
    # Activation requires verified identity KYC (spec §5). Land-document
    # verification is a SEPARATE review — never implied by identity KYC.
    landlord = await get_user(uid)
    if not await is_identity_verified(landlord):
        _error(403, "KYC_REQUIRED", "complete identity verification (KYC) to list farmland")
    if body.minDurationMonths and body.maxDurationMonths and body.minDurationMonths > body.maxDurationMonths:
        _error(422, "VALIDATION_ERROR", "minDurationMonths cannot exceed maxDurationMonths")
    plot = None
    if body.plotId is not None:
        plot = await _require_plot(uid, body.plotId)
    user = await get_user(uid)

    quality_assessment = None
    try:
        village = body.village or (plot.get("village") if plot else "")
        village_stats = None
        if village:
            matching = await query("land_listings", [("village", "==", village), ("status", "==", "leased")], limit=20)
            if len(matching) >= 3:
                rents = [float(l.get("expectedRentRupees", 0)) / max(0.1, float(l.get("areaAcres", 1))) for l in matching]
                village_stats = {
                    "sampleCount": len(matching),
                    "bandMin": min(rents) * 0.9,
                    "bandMax": max(rents) * 1.1,
                }
        state = build_land_listing_quality_state(
            listing=body.model_dump(),
            plot=plot,
            village_lease_stats=village_stats,
            landlord_id=uid,
        )
        quality_assessment = await land_ai.assess_listing_quality(state, uid)
    except Exception:
        quality_assessment = None

    listing = LandListingOut(
        id=uuid.uuid4().hex,
        landlordId=uid,
        landlordName=user.get("name", ""),
        status="open",
        createdAt=datetime.now(timezone.utc).isoformat(),
        qualityAssessment=quality_assessment,
        landlordVerified=await is_identity_verified(user),
        landVerified=False,
        **body.model_dump(),
    )
    # Submitting documents with the listing enters the review queue — the
    # badge still requires an actual review.
    if listing.landDocuments and listing.landDocumentsStatus == "none":
        listing.landDocumentsStatus = "pending"
    await set_doc("land_listings", listing.id, listing.model_dump())
    return listing


@router.get("/listings")
async def browse_listings(
    near: str | None = None,
    acres: float | None = None,
    district: str | None = None,
    taluka: str | None = None,
    irrigated: bool | None = None,
    maxRent: float | None = None,
    availableFrom: str | None = None,
    sort: str = "latest",
    uid: str = Depends(_owner),
):
    """Public farmland discovery (spec §7) — badges in, private fields out,
    batched verification summaries (no N+1)."""
    listings = [l for l in await query("land_listings", [], limit=1000) if l.get("status") == "open"]
    # Annotate with the caller's existing interest (if any) so the UI can mark
    # "Interest sent" instead of offering a duplicate request that would 409.
    mine = await query("lease_requests", [("farmerId", "==", uid)], limit=500)
    my_status_by_listing = {
        r["listingId"]: r.get("status", "")
        for r in mine
        if r.get("listingId") and r.get("status") in ("pending", "contacted", "countered")
    }
    if acres is not None:
        listings = [l for l in listings if l.get("areaAcres", 0) >= acres]
    if district:
        d = district.strip().lower()
        listings = [l for l in listings if d in str(l.get("district") or "").lower()]
    if taluka:
        t = taluka.strip().lower()
        listings = [l for l in listings if t in str(l.get("taluka") or "").lower()]
    if irrigated is not None:
        listings = [l for l in listings if l.get("irrigated") is irrigated]
    if maxRent is not None:
        listings = [l for l in listings if float(l.get("expectedRentRupees") or 0) <= maxRent]
    if availableFrom:
        listings = [
            l for l in listings
            if not l.get("availableFrom") or str(l.get("availableFrom")) <= availableFrom
        ]
    if near is not None:
        try:
            lat, lng = (float(p) for p in near.split(","))
        except ValueError:
            _error(422, "INVALID_NEAR", "near must be '<lat>,<lng>'", {"near": "invalid coordinates"})
        listings = [
            l for l in listings
            if _haversine_km(lat, lng, l.get("lat", 0), l.get("lng", 0)) <= 25
        ]
    if sort == "rentAsc":
        listings.sort(key=lambda l: float(l.get("expectedRentRupees") or 0))
    elif sort == "rentDesc":
        listings.sort(key=lambda l: float(l.get("expectedRentRupees") or 0), reverse=True)
    elif sort == "area":
        listings.sort(key=lambda l: float(l.get("areaAcres") or 0), reverse=True)
    elif sort == "available":
        listings.sort(key=lambda l: str(l.get("availableFrom") or "9999"))
    else:
        listings.sort(key=lambda l: l.get("createdAt", ""), reverse=True)
    verified = await verification_map([l.get("landlordId") or "" for l in listings])
    out = []
    for l in listings:
        row = _public_listing(l, verified)
        mine_status = my_status_by_listing.get(l["id"])
        if mine_status:
            row["myRequestStatus"] = mine_status
        out.append(row)
    return _envelope(out)


@router.get("/listings/mine")
async def my_listings(uid: str = Depends(_landlord)):
    listings = await query("land_listings", [("landlordId", "==", uid)], limit=1000)
    verified = await verification_map([l.get("landlordId") or "" for l in listings])
    out = []
    for l in listings:
        row = _public_listing(l, verified)
        # The owner legitimately sees their own document state and full survey.
        row["landDocuments"] = l.get("landDocuments") or []
        row["surveyNumber"] = l.get("surveyNumber")
        out.append(row)
    return _envelope(out)


@router.put("/listings/{listing_id}", response_model=LandListingOut)
async def update_listing(listing_id: str, body: LandListingUpdate, uid: str = Depends(_landlord)):
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "listing belongs to another landlord")
    updates = body.model_dump(exclude_unset=True)
    min_dur = updates.get("minDurationMonths", listing.get("minDurationMonths"))
    max_dur = updates.get("maxDurationMonths", listing.get("maxDurationMonths"))
    if min_dur and max_dur and int(min_dur) > int(max_dur):
        _error(422, "VALIDATION_ERROR", "minDurationMonths cannot exceed maxDurationMonths")
    listing.update(updates)

    try:
        plot = await get_doc(f"users/{uid}/land_plots", listing.get("plotId")) if listing.get("plotId") else None
        state = build_land_listing_quality_state(
            listing=listing,
            plot=plot,
            landlord_id=uid,
        )
        assessment = await land_ai.assess_listing_quality(state, uid)
        if assessment:
            listing["qualityAssessment"] = assessment
    except Exception:
        pass

    await set_doc("land_listings", listing_id, listing)
    return LandListingOut(**listing)


@router.delete("/listings/{listing_id}", status_code=204)
async def delete_listing(listing_id: str, uid: str = Depends(_landlord)):
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "listing belongs to another landlord")
    if listing.get("status") == "leased":
        _error(409, "LISTING_HAS_ACTIVE_LEASE", "listing is leased")
    await delete_doc("land_listings", listing_id)


class LandDocumentsIn(BaseModel):
    urls: list[str] = Field(min_length=1)


@router.post("/listings/{listing_id}/documents", status_code=201)
async def submit_land_documents(listing_id: str, body: LandDocumentsIn, uid: str = Depends(_landlord)):
    """Private land-document submission (spec §4/§6). Sets the review state to
    PENDING — uploading alone never earns the Land Documents Verified badge."""
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "listing belongs to another landlord")
    listing["landDocuments"] = list(body.urls)
    listing["landDocumentsStatus"] = "pending"
    await set_doc("land_listings", listing_id, listing)
    return {"landDocumentsStatus": "pending", "count": len(body.urls)}


class VerifyLandDocumentsIn(BaseModel):
    approved: bool
    reason: str = ""


@router.post("/listings/{listing_id}/verify-documents")
async def verify_land_documents(
    listing_id: str,
    body: VerifyLandDocumentsIn,
    admin: dict = Depends(admin_user),
):
    """Verification-personnel only (spec §6/§19): the single path that may
    mark land documents verified. Identity KYC or an upload alone never does."""
    listing = await _require_listing(listing_id)
    if body.approved:
        listing["landDocumentsStatus"] = "verified"
        listing["landDocumentsVerifiedAt"] = datetime.now(timezone.utc).isoformat()
        listing["landDocumentsVerifiedBy"] = admin["uid"]
    else:
        listing["landDocumentsStatus"] = "rejected"
        listing["landDocumentsRejectionReason"] = body.reason or None
    await set_doc("land_listings", listing_id, listing)
    return {"landDocumentsStatus": listing["landDocumentsStatus"]}


class LandIssueReportIn(BaseModel):
    targetUserId: str
    requestId: str = ""
    category: str = "other"  # falseListing | ownershipConcern | conduct | paymentDispute | landCondition | other
    details: str = ""


@router.post("/reports", status_code=201)
async def report_land_issue(body: LandIssueReportIn, uid: str = Depends(_owner)):
    """Issue reporting for either participant (spec §15) — moderation reviews;
    it never freezes payments, decides ownership, or determines liability."""
    if body.category not in (
        "falseListing", "ownershipConcern", "conduct", "paymentDispute", "landCondition", "other",
    ):
        _error(422, "VALIDATION_ERROR", "unknown report category", {"category": "unsupported"})
    target = await get_user(body.targetUserId)
    if target is None:
        _error(404, "USER_NOT_FOUND", "user not found")
    if body.requestId:
        request = await get_doc("lease_requests", body.requestId) or {}
        if uid not in (request.get("farmerId"), request.get("landlordId")):
            _error(403, "FORBIDDEN", "only the request participants can report on this connection")
    doc = {
        "id": f"rep_{uuid.uuid4().hex[:12]}",
        "reporterId": uid,
        "targetUserId": body.targetUserId,
        "requestId": body.requestId,
        "module": "land",
        "category": body.category,
        "reason": body.category,
        "details": body.details,
        "status": "open",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("user_reports", doc["id"], doc)
    return doc


@router.post("/lease-requests", status_code=201, response_model=LeaseRequestOut)
async def create_lease_request(body: LeaseRequestIn, uid: str = Depends(_farmer)):
    listing = await _require_listing(body.listingId)
    if listing.get("status") != "open":
        _error(409, "LISTING_NOT_OPEN", "listing is not open for interest requests")
    # Direct-connect verification (spec §8) — terms acknowledged here, KYC
    # verified for BOTH parties before any contact is shared.
    if not body.termsAccepted:
        _error(422, "TERMS_REQUIRED", "accept the direct-connect terms to send interest")
    farmer = await get_user(uid)
    if not await is_identity_verified(farmer):
        _error(403, "KYC_REQUIRED", "complete identity verification (KYC) to send interest")
    landlord = await get_user(listing["landlordId"]) or {}
    if not await is_identity_verified(landlord):
        _error(403, "COUNTERPARTY_UNVERIFIED", "the landlord has not completed identity verification")
    if listing.get("landlordId") == uid:
        _error(403, "OWN_LISTING", "cannot send interest on your own listing")
    if body.proposedStartDate:
        try:
            date.fromisoformat(body.proposedStartDate)
        except ValueError:
            _error(422, "VALIDATION_ERROR", "proposedStartDate must be YYYY-MM-DD", {"proposedStartDate": "invalid date"})
    # No duplicate ACTIVE request (requested or contacted) for the same pair.
    existing = await query("lease_requests", [("listingId", "==", body.listingId)], limit=1000)
    if any(
        r.get("farmerId") == uid and r.get("status") in ("pending", "contacted")
        for r in existing
    ):
        _error(409, "DUPLICATE_LEASE_REQUEST", "request already sent for this listing")
    now = datetime.now(timezone.utc).isoformat()
    expected_rent = float(listing.get("expectedRentRupees") or 0.0)
    proposed_rent = float(getattr(body, "offeredRentRupees", None) or getattr(body, "proposedRentRupees", None) or expected_rent)
    ratio = min(1.0, proposed_rent / expected_rent) if expected_rent > 0 else 1.0
    dur = int(body.durationMonths or 12)
    dur_score = 1.0 if 6 <= dur <= 36 else 0.8
    compat_score = round(ratio * 0.7 + dur_score * 0.3, 2)

    request = LeaseRequestOut(
        id=uuid.uuid4().hex,
        farmerId=uid,
        farmerName=farmer.get("name", ""),
        farmerPhone=farmer.get("phone", ""),
        landlordId=listing["landlordId"],
        status="pending",
        createdAt=now,
        compatibilityScore=compat_score,
        farmerVerified=True,
        landlordVerified=await is_identity_verified(landlord),
        # Farmer terms acknowledgement (spec §11).
        farmerTermsVersion=LEASE_TERMS_VERSION,
        farmerTermsAcceptedAt=now,
        **body.model_dump(),
    )
    await set_doc("lease_requests", request.id, request.model_dump())
    await upsert_lead(
        listing["landlordId"], listing["id"], uid, farmer.get("name", ""), "application"
    )
    await emit_task(
        listing["landlordId"],
        persona="farmLandlord",
        module="land",
        kind="lease_request",
        title_en="New lease request",
        title_hi="नया पट्टा अनुरोध",
        subtitle=f"{request.farmerName} · {request.durationMonths} months · ₹{body.offeredRentRupees or listing['expectedRentRupees']}/mo",
        priority="today",
        deep_link=DEEP_LINKS["land"],
        source_id=request.id,
    )
    await notify_user(
        listing["landlordId"],
        type="land_interest_request",
        title="New interest request / नवीन रस",
        body=f"{request.farmerName} is interested in your {listing.get('village', '')} land ({request.durationMonths} months).",
        deepLink="/landlord/requests",
    )
    return request


@router.get("/lease-requests")
async def list_lease_requests(status: str | None = None, uid: str = Depends(_landlord)):
    requests = await query("lease_requests", [("landlordId", "==", uid)], limit=1000)
    if status is not None:
        requests = [r for r in requests if r.get("status") == status]
    verified = await verification_map([r.get("farmerId") or "" for r in requests])
    listings = {l["id"]: l for l in await query("land_listings", [], limit=1000)}
    out = []
    for r in requests:
        if r.get("compatibilityScore") is None:
            listing = listings.get(r.get("listingId", "")) or {}
            expected_rent = float(listing.get("expectedRentRupees") or 0.0)
            proposed_rent = float(r.get("offeredRentRupees") or r.get("proposedRentRupees") or expected_rent)
            ratio = min(1.0, proposed_rent / expected_rent) if expected_rent > 0 else 1.0
            dur = int(r.get("durationMonths") or 12)
            dur_score = 1.0 if 6 <= dur <= 36 else 0.8
            r["compatibilityScore"] = round(ratio * 0.7 + dur_score * 0.3, 2)
        listing = listings.get(r.get("listingId", "")) or {}
        r["listingVillage"] = listing.get("village", "")
        r["listingAreaAcres"] = listing.get("areaAcres")
        r["farmerVerified"] = verified.get(r.get("farmerId") or "", False)
        # The farmer's phone/contact stays hidden until the contact unlock.
        if not r.get("contactRevealedAt"):
            r.pop("farmerContact", None)
            r.pop("landlordContact", None)
            r["farmerPhone"] = ""
        out.append(r)
    return _envelope(out)


@router.post("/lease-requests/{request_id}/accept")
async def accept_lease_request(request_id: str, uid: str = Depends(_landlord)):
    request = await _require_request(request_id)
    if request.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "request belongs to another landlord")
    if request.get("status") != "pending":
        _error(409, "REQUEST_ALREADY_RESOLVED", "request already resolved")
    await _enforce_active_lease_limit(uid)
    listing = await _require_listing(request["listingId"])
    farmer = await get_doc("users", request["farmerId"]) or {}
    start = date.today()
    lease = LeaseOut(
        id=uuid.uuid4().hex,
        plotId=listing.get("plotId") or "",
        tenantName=farmer.get("name", request.get("farmerName", "")),
        tenantPhone=farmer.get("phone", request.get("farmerPhone", "")),
        monthlyRentRupees=listing["expectedRentRupees"],
        startDate=start.isoformat(),
        endDate=_add_months(start, request["durationMonths"]).isoformat(),
        status="active",
        verified=False,
        listingId=listing["id"],
        tenantFarmerId=request["farmerId"],
    )
    await set_doc(
        f"users/{uid}/land_leases", lease.id, {**lease.model_dump(), "retainUntil": _retain_until()}
    )
    # WS-03: tenant rates the landlord once the lease is active.
    await open_rating_prompt(request.get("farmerId"), uid, lease.id, "land_lease")
    await convert_lead(uid, listing["id"], request["farmerId"])
    if lease.plotId:
        await _set_plot_status(uid, lease.plotId, "leased")
    await emit_task(
        uid,
        persona="farmLandlord",
        module="land",
        kind="esign_pending",
        title_en="Lease e-sign pending",
        title_hi="पट्टा ई-साइन बाकी",
        subtitle=f"{lease.tenantName} · ₹{lease.monthlyRentRupees}/mo from {lease.startDate}",
        priority="today",
        deep_link=DEEP_LINKS["land"],
        source_id=lease.id,
    )
    listing["status"] = "leased"
    await set_doc("land_listings", listing["id"], listing)
    request["status"] = "accepted"
    await set_doc("lease_requests", request_id, request)
    others = await query("lease_requests", [("listingId", "==", listing["id"])], limit=1000)
    for other in others:
        if other["id"] != request_id and other.get("status") == "pending":
            other["status"] = "rejected"
            other["reason"] = "Listed plot leased to another farmer"
            await set_doc("lease_requests", other["id"], other)
    return {"leaseId": lease.id}


@router.post("/lease-requests/{request_id}/reject")
async def reject_lease_request(request_id: str, body: RejectRequestIn, uid: str = Depends(_landlord)):
    request = await _require_request(request_id)
    if request.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "request belongs to another landlord")
    if request.get("status") != "pending":
        _error(409, "REQUEST_ALREADY_RESOLVED", "request already resolved")
    request["status"] = "rejected"
    request["reason"] = body.reason
    await set_doc("lease_requests", request_id, request)
    # Declining changes only THIS request — unrelated requests and the
    # listing availability are untouched (spec §9).
    await notify_user(
        request.get("farmerId"),
        type="land_request_declined",
        title="Interest request declined / विनंती नाकारली",
        body=f"Your interest request was declined." + (f" Reason: {body.reason}" if body.reason else ""),
        deepLink="/farmer/land",
    )
    return {"status": "rejected"}


@router.get("/leases/{lease_id}/agreement-pdf")
async def lease_agreement_pdf(lease_id: str, uid: str = Depends(_owner)):
    lease = await get_doc(f"users/{uid}/land_leases", lease_id)
    landlord_id = uid
    if lease is None:
        caller = await get_user(uid)
        for other in await query("users", [], limit=1000):
            lease = await get_doc(f"users/{other['id']}/land_leases", lease_id)
            if lease is not None:
                landlord_id = other["id"]
                break
        if lease is None or lease.get("tenantPhone") != caller.get("phone"):
            _error(404, "LEASE_NOT_FOUND", "lease not found")
    # PDF generation is a Pro-plan feature, gated on the lease owner's plan.
    await _require_pro(landlord_id, "agreement PDFs")
    landlord = await get_doc("users", landlord_id) or {}
    tenant = {"name": lease.get("tenantName", ""), "phone": lease.get("tenantPhone", "")}
    if lease.get("plotId"):
        plot = await get_doc(f"users/{landlord_id}/land_plots", lease["plotId"])
        if plot is not None:
            lease = {**lease, "plotName": plot.get("name"), "gatNumber": plot.get("gatNumber")}
    path = reports.build_lease_agreement_pdf(lease, landlord, tenant)
    url = reports.upload_to_storage(path, f"agreements/{uid}/{lease_id}.pdf")
    acceptances = await list_subdocs(f"users/{landlord_id}/land_leases/{lease_id}/acceptances")
    acceptances.sort(key=lambda a: a.get("acceptedAt", ""))
    return {"agreementUrl": url, "acceptances": acceptances}


@router.get("/analytics")
async def get_landlord_analytics(uid: str = Depends(_landlord)):
    await _require_pro(uid, "land analytics")
    plots = await list_subdocs(f"users/{uid}/land_plots")
    leases = await _leases(uid)
    listings = await query("land_listings", [("landlordId", "==", uid)], limit=1000)
    requests = await query("lease_requests", [("landlordId", "==", uid)], limit=1000)

    total_plot_acres = sum(p.get("areaAcres", 0) for p in plots)
    total_listing_acres = sum(l.get("areaAcres", 0) for l in listings if not l.get("plotId"))
    total_acreage = round(total_plot_acres + total_listing_acres, 1)

    active_leases = [l for l in leases if l.get("status") == "active"]
    active_tenants = len(active_leases)
    leased_plots_count = len({l.get("plotId") for l in active_leases if l.get("plotId")})
    occupancy_rate = round((leased_plots_count / max(1, len(plots))) * 100, 1) if plots else 0.0

    monthly_rent_income = sum(float(l.get("monthlyRentRupees", 0)) for l in active_leases)

    # Collect payments across all leases
    total_collected = 0.0
    for l in leases:
        payments = await list_subdocs(f"users/{uid}/land_leases/{l['id']}/payments")
        total_collected += sum(p.get("amountRupees", 0) for p in payments)

    pending_requests = [r for r in requests if r.get("status") in ("pending", "countered")]

    soil_counts: dict[str, int] = {}
    for p in plots:
        st = p.get("soilType") or "Medium Black"
        soil_counts[st] = soil_counts.get(st, 0) + 1

    return {
        "totalAcreage": total_acreage,
        "totalPlots": len(plots),
        "activeTenants": active_tenants,
        "occupancyRatePercent": occupancy_rate,
        "monthlyRentIncomeRupees": round(monthly_rent_income, 2),
        "totalRentCollectedRupees": round(total_collected, 2),
        "pendingRequestsCount": len(pending_requests),
        "totalListings": len(listings),
        "soilBreakdown": [{"soilType": k, "count": v} for k, v in soil_counts.items()],
        "demandTrend": [
            {"month": "May", "demandScore": 68, "avgAcreRate": 18500},
            {"month": "Jun", "demandScore": 92, "avgAcreRate": 22000},
            {"month": "Jul", "demandScore": 85, "avgAcreRate": 21000},
            {"month": "Aug", "demandScore": 74, "avgAcreRate": 19500},
            {"month": "Sep", "demandScore": 79, "avgAcreRate": 20000},
            {"month": "Oct", "demandScore": 88, "avgAcreRate": 21500},
        ],
    }


@router.post("/lease-requests/{request_id}/counter")
async def counter_lease_request(
    request_id: str,
    body: CounterRequestIn,
    uid: str = Depends(_landlord),
):
    request = await _require_request(request_id)
    if request.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "request belongs to another landlord")
    if request.get("status") not in ("pending", "countered"):
        _error(409, "REQUEST_NOT_NEGOTIABLE", "only pending or countered requests can be countered")

    rounds = request.get("negotiationRounds", 1)
    if rounds >= 5:
        _error(422, "MAX_ROUNDS_REACHED", "Maximum 5 negotiation rounds allowed")

    request["counterRentRupees"] = body.counterRentRupees
    request["landlordNotes"] = body.note
    if body.durationMonths:
        request["durationMonths"] = body.durationMonths
    request["negotiationRounds"] = rounds + 1
    request["status"] = "countered"
    request["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("lease_requests", request_id, request)
    return request


@router.get("/lease-requests/mine")
async def my_sent_lease_requests(uid: str = Depends(_farmer)):
    requests = await query("lease_requests", [("farmerId", "==", uid)], limit=500)
    requests.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    verified = await verification_map([r.get("landlordId") or "" for r in requests])
    landlords: dict[str, dict] = {}
    for lid in {r.get("landlordId") or "" for r in requests}:
        if lid:
            landlords[lid] = await get_user(lid) or {}
    listings = {l["id"]: l for l in await query("land_listings", [], limit=1000)}
    out = []
    for r in requests:
        listing = listings.get(r.get("listingId", "")) or {}
        r["listingVillage"] = listing.get("village", "")
        r["listingDistrict"] = listing.get("district", "")
        r["listingAreaAcres"] = listing.get("areaAcres")
        r["listingStatus"] = listing.get("status")
        r["landlordVerified"] = verified.get(r.get("landlordId") or "", False)
        r["landlordName"] = (landlords.get(r.get("landlordId") or "") or {}).get("name", "")
        r["landVerified"] = listing.get("landDocumentsStatus") == "verified"
        if not r.get("contactRevealedAt"):
            r.pop("farmerContact", None)
            r.pop("landlordContact", None)
        out.append(r)
    return {"data": out, "total": len(out)}


# ---------------------------------------------------------------------------
# Land requirements — the farmer-posted "I need land" board. A farmer creates
# a requirement; landlords browse it and respond with a message. Direct-connect
# throughout: terms + KYC gate the writes, contacts are shared only via chat.
# ---------------------------------------------------------------------------


@router.post("/requirements", status_code=201)
async def create_land_requirement(body: LandRequirementIn, uid: str = Depends(_farmer)):
    """Farmer posts the land they need — landlords discover it via
    GET /land/requirements/browse and respond directly."""
    if not body.termsAccepted:
        _error(422, "TERMS_REQUIRED", "accept the direct-connect terms to post a land request")
    farmer = await get_user(uid)
    if not await is_identity_verified(farmer):
        _error(403, "KYC_REQUIRED", "complete identity verification (KYC) to post a land request")
    if body.neededFrom:
        try:
            date.fromisoformat(body.neededFrom)
        except ValueError:
            _error(422, "VALIDATION_ERROR", "neededFrom must be YYYY-MM-DD", {"neededFrom": "invalid date"})
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": f"lrq_{uuid.uuid4().hex[:12]}",
        "farmerId": uid,
        "farmerName": farmer.get("name", ""),
        "farmerVerified": True,
        "status": "open",
        "responses": [],
        "createdAt": now,
        **body.model_dump(exclude={"termsAccepted"}),
    }
    await set_doc("land_requirements", doc["id"], doc)
    return doc


@router.get("/requirements/mine")
async def my_land_requirements(uid: str = Depends(_farmer)):
    docs = await query("land_requirements", [("farmerId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    # Join landlord names onto responses (public display only).
    for d in docs:
        for resp in d.get("responses") or []:
            landlord = await get_user(resp.get("landlordId", ""))
            resp["landlordName"] = (landlord or {}).get("name", "")
            resp["landlordVerified"] = await is_identity_verified(landlord)
    return {"data": docs, "total": len(docs)}


@router.delete("/requirements/{requirement_id}", status_code=204)
async def close_land_requirement(requirement_id: str, uid: str = Depends(_farmer)):
    doc = await get_doc("land_requirements", requirement_id)
    if doc is None or doc.get("farmerId") != uid:
        _error(404, "NOT_FOUND", "requirement not found")
    doc["status"] = "closed"
    doc["closedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("land_requirements", requirement_id, doc)
    return Response(status_code=204)


@router.get("/requirements/browse")
async def browse_land_requirements(
    district: str | None = None,
    state: str | None = None,
    minAcres: float | None = None,
    uid: str = Depends(_landlord),
):
    """Landlord discovery board — open farmer requirements with public
    farmer cards (first name + verification badge only)."""
    docs = await query("land_requirements", [("status", "==", "open")], limit=500)
    if district:
        needle = district.strip().lower()
        docs = [d for d in docs if needle in str(d.get("district") or "").lower()]
    if state:
        needle = state.strip().lower()
        docs = [d for d in docs if needle in str(d.get("state") or "").lower()]
    if minAcres is not None:
        docs = [d for d in docs if float(d.get("areaAcres") or 0) >= minAcres]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    farmers = {}
    for d in docs:
        fid = d.get("farmerId", "")
        if fid not in farmers:
            farmers[fid] = await get_user(fid)
        d["farmerName"] = ((farmers[fid] or {}).get("name") or "").strip().split(" ")[0]
        d["farmerVerified"] = await is_identity_verified(farmers[fid])
    return _envelope(docs)


@router.get("/requirements/responded")
async def my_requirement_responses(uid: str = Depends(_landlord)):
    """The landlord's side of the farmer-posted board — every requirement they
    responded to, with the farmer's public card and the chat room."""
    docs = await query("land_requirements", [], limit=1000)
    out = []
    for d in docs:
        mine = [r for r in d.get("responses") or [] if r.get("landlordId") == uid]
        if not mine:
            continue
        farmer = await get_user(d.get("farmerId", "")) or {}
        out.append(
            {
                **d,
                "myResponses": mine,
                "farmerName": ((farmer.get("name") or "").strip().split(" ")[0]) or "Farmer",
                "farmerVerified": await is_identity_verified(farmer),
            }
        )
    out.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": out, "total": len(out)}


@router.post("/requirements/{requirement_id}/respond", status_code=201)
async def respond_to_land_requirement(
    requirement_id: str,
    body: LandRequirementRespondIn,
    uid: str = Depends(_landlord),
):
    """Landlord responds to a farmer's land requirement — stored on the doc,
    the farmer is notified and can open a chat with the landlord."""
    doc = await get_doc("land_requirements", requirement_id)
    if doc is None:
        _error(404, "NOT_FOUND", "requirement not found")
    if doc.get("status") != "open":
        _error(409, "REQUIREMENT_CLOSED", "this land request is closed")
    if doc.get("farmerId") == uid:
        _error(403, "OWN_REQUIREMENT", "cannot respond to your own request")
    if not body.termsAccepted:
        _error(422, "TERMS_REQUIRED", "accept the direct-connect terms to respond")
    landlord = await get_user(uid)
    if not await is_identity_verified(landlord):
        _error(403, "KYC_REQUIRED", "complete identity verification (KYC) to respond")
    if any(r.get("landlordId") == uid for r in doc.get("responses") or []):
        _error(409, "ALREADY_RESPONDED", "you already responded to this request")
    now = datetime.now(timezone.utc).isoformat()
    response = {
        "id": f"resp_{uuid.uuid4().hex[:10]}",
        "landlordId": uid,
        "message": body.message.strip(),
        "createdAt": now,
    }
    doc.setdefault("responses", []).append(response)
    farmer = await get_user(doc["farmerId"]) or {}
    room = await ensure_direct_room(
        uid,
        landlord.get("name", ""),
        doc["farmerId"],
        farmer.get("name", ""),
        crop=f"{doc.get('areaAcres', '')} acres · {doc.get('district', '')}",
    )
    response["chatRoomId"] = room["id"]
    await set_doc("land_requirements", requirement_id, doc)
    await notify_user(
        doc["farmerId"],
        type="land_requirement_response",
        title="Landlord responded to your land request / जमीन मागणीस प्रतिसाद",
        body=f"{landlord.get('name', 'A landlord')} responded to your request for {doc.get('areaAcres', '')} acres in {doc.get('district', '')}.",
        deepLink="/farmer/land?tab=requests",
    )
    return {"response": response, "chatRoomId": response["chatRoomId"]}


@router.post("/lease-requests/{request_id}/accept-contact")
async def accept_contact_request(request_id: str, body: AcceptContactIn, uid: str = Depends(_landlord)):
    """Accept Contact Request — the communication unlock (spec §9/§10).

    Does NOT finalize a lease, mark land leased, transfer possession, or
    create any payment/legal obligation — the legacy /accept lease-finalizing
    endpoint remains for old clients, hidden from the new UX.
    """
    request = await _require_request(request_id)
    if request.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "request belongs to another landlord")
    if request.get("status") != "pending":
        _error(409, "REQUEST_ALREADY_RESOLVED", "request is not awaiting contact acceptance")
    listing = await _require_listing(request["listingId"])
    if listing.get("status") != "open":
        _error(409, "LISTING_NOT_OPEN", "listing is no longer open for contact")
    if not body.termsAccepted:
        _error(422, "TERMS_REQUIRED", "accept the direct-connect terms to share contact details")
    landlord = await get_user(uid)
    if not await is_identity_verified(landlord):
        _error(403, "KYC_REQUIRED", "complete identity verification (KYC) to accept contact requests")
    farmer = await get_user(request["farmerId"]) or {}
    if not await is_identity_verified(farmer):
        _error(403, "COUNTERPARTY_UNVERIFIED", "the farmer has not completed identity verification")
    if (landlord or {}).get("mpinHash"):
        if not body.mpin:
            _error(401, "WRONG_MPIN", "mpin is required to accept and share contact details")
        if not verify_mpin(body.mpin, landlord["mpinHash"]):
            _error(401, "WRONG_MPIN", "incorrect MPIN")

    now = datetime.now(timezone.utc).isoformat()
    room = await ensure_direct_room(
        uid,
        (landlord or {}).get("name", ""),
        request["farmerId"],
        (farmer or {}).get("name", ""),
        crop=f"{listing.get('village', '')} land",
    )
    request.update(
        {
            "status": "contacted",
            "contactRevealedAt": request.get("contactRevealedAt") or now,
            "chatRoomId": room["id"],
            "landlordTermsAccepted": True,
            "landlordTermsVersion": LEASE_TERMS_VERSION,
            "landlordTermsAcceptedAt": now,
            "landlordTermsAcceptedBy": uid,
            "mpinVerified": bool((landlord or {}).get("mpinHash")),
            "farmerContact": {**_contact_of(farmer or {}), "verified": True},
            "landlordContact": {**_contact_of(landlord or {}), "verified": True},
        }
    )
    await set_doc("lease_requests", request_id, request)
    await convert_lead(uid, listing["id"], request["farmerId"])

    await notify_user(
        request["farmerId"],
        type="land_contact_accepted",
        title="Contact request accepted / संपर्क स्वीकारला",
        body=f"{listing.get('village', '')} land — the landlord shared contact details. Inspect the land and negotiate directly.",
        deepLink="/farmer/land",
    )
    await notify_user(
        uid,
        type="land_contact_accepted",
        title="You accepted a contact request / संपर्क स्वीकारला",
        body=f"{request.get('farmerName', 'Farmer')} · {listing.get('village', '')} land — farmer contact unlocked.",
        deepLink="/landlord/connections",
    )
    return request


@router.post("/lease-requests/{request_id}/outcome")
async def record_lease_outcome(request_id: str, body: LeaseOutcomeIn, uid: str = Depends(_owner)):
    """User-reported lease outcome (spec §12) — restricted to the two parties.
    dealDone stores only optional user-reported details; nothing here is a
    payment record, legal proof, or platform-verified fact."""
    request = await _require_request(request_id)
    if uid not in (request.get("farmerId"), request.get("landlordId")):
        _error(404, "REQUEST_NOT_FOUND", "lease request not found")
    status_map = {
        "stillInContact": "contacted",
        "dealDone": "dealDone",
        "didNotHappen": "dismissed",
        "withdrawn": "withdrawn",
    }
    current = request.get("status")
    allowed_from = ("contacted", "dealDone", "dismissed")
    if current == "pending":
        # Before contact, only the farmer may withdraw their own interest.
        if body.outcome != "withdrawn":
            _error(409, "ILLEGAL_TRANSITION", "record outcomes after the contact request is accepted")
        if uid != request.get("farmerId"):
            _error(403, "FORBIDDEN", "only the farmer can withdraw a pending request")
    elif current not in allowed_from:
        _error(409, "ILLEGAL_TRANSITION", f"cannot record an outcome from status '{current}'")

    now = datetime.now(timezone.utc).isoformat()
    history = list(request.get("statusHistory") or [])
    history.append({"status": status_map[body.outcome], "at": now, "by": uid})
    request["status"] = status_map[body.outcome]
    request["statusHistory"] = history
    request["outcome"] = {
        "outcome": body.outcome,
        "reportedBy": uid,
        "reportedAt": now,
        "notes": body.notes or None,
        # User-reported optional details — never platform-verified.
        "finalStartDate": body.finalStartDate if body.outcome == "dealDone" else None,
        "finalEndDate": body.finalEndDate if body.outcome == "dealDone" else None,
        "finalRentRupees": body.finalRentRupees if body.outcome == "dealDone" else None,
        "finalRentUnit": body.finalRentUnit if body.outcome == "dealDone" else None,
    }
    await set_doc("lease_requests", request_id, request)

    other_id = request.get("landlordId") if uid == request.get("farmerId") else request.get("farmerId")
    label = {
        "stillInContact": "still in contact",
        "dealDone": "lease completed offline (user-reported)",
        "didNotHappen": "did not happen",
        "withdrawn": "withdrawn",
    }[body.outcome]
    await notify_user(
        other_id,
        type="land_outcome_updated",
        title="Lease outcome updated / परिणाम अद्यतनित",
        body=f"The {request.get('listingVillage', '')} land connection was marked: {label}.",
        deepLink="/farmer/land" if other_id == request.get("farmerId") else "/landlord/connections",
    )
    if body.outcome == "dealDone":
        await open_rating_prompt(uid, other_id, request_id, "land_lease")
    return request


@router.get("/leases/{lease_id}/milestones")
async def get_lease_milestones(lease_id: str, uid: str = Depends(_owner)):
    lease = await get_doc(f"users/{uid}/land_leases", lease_id)
    if lease is None:
        caller = await get_user(uid)
        for other in await query("users", [], limit=1000):
            lease = await get_doc(f"users/{other['id']}/land_leases", lease_id)
            if lease is not None:
                break
    if lease is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")

    milestones_doc = await get_doc(f"leases/{lease_id}/escrow", "milestones")
    if milestones_doc is None:
        annual_val = float(lease.get("monthlyRentRupees", 20000)) * 12
        milestones = [
            {
                "index": 0,
                "name": "Land Handover & Soil Verification",
                "percentage": 30,
                "amountRupees": round(annual_val * 0.30, 2),
                "status": "released",
                "targetWindow": "Day 1 (Handover)",
                "releaseDate": lease.get("startDate", ""),
                "notes": "Verified boundary markers and initial plot access.",
            },
            {
                "index": 1,
                "name": "Mid-Season Cultivation Inspection",
                "percentage": 40,
                "amountRupees": round(annual_val * 0.40, 2),
                "status": "pending",
                "targetWindow": "Mid-Crop Season (Day 90)",
                "releaseDate": None,
                "notes": "Escrow held pending crop health and water usage check.",
            },
            {
                "index": 2,
                "name": "Harvest & Plot Handover Reconciliation",
                "percentage": 30,
                "amountRupees": round(annual_val * 0.30, 2),
                "status": "pending",
                "targetWindow": "Post-Harvest / Lease End",
                "releaseDate": None,
                "notes": "Final release upon boundary clearance and handover confirmation.",
            },
        ]
        milestones_doc = {"leaseId": lease_id, "milestones": milestones}
        await set_doc(f"leases/{lease_id}/escrow", "milestones", milestones_doc)

    return milestones_doc


@router.post("/leases/{lease_id}/milestones")
async def update_lease_milestone(
    lease_id: str,
    body: MilestoneUpdateIn,
    uid: str = Depends(_owner),
):
    milestones_doc = await get_doc(f"leases/{lease_id}/escrow", "milestones")
    if milestones_doc is None:
        # initialize first
        await get_lease_milestones(lease_id=lease_id, uid=uid)
        milestones_doc = await get_doc(f"leases/{lease_id}/escrow", "milestones")

    ms_list = milestones_doc.get("milestones", [])
    if body.milestoneIndex < len(ms_list):
        ms_list[body.milestoneIndex]["status"] = body.status
        if body.status == "released":
            ms_list[body.milestoneIndex]["releaseDate"] = datetime.now(timezone.utc).isoformat()
        if body.notes:
            ms_list[body.milestoneIndex]["notes"] = body.notes
        milestones_doc["milestones"] = ms_list
        milestones_doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await set_doc(f"leases/{lease_id}/escrow", "milestones", milestones_doc)

    return milestones_doc


@router.get("/rent-payments/{payment_id}/receipt")
async def rent_payment_receipt(payment_id: str, uid: str = Depends(_owner)):
    """PDF receipt for one recorded rent payment (Pro plan)."""
    await _require_pro(uid, "rent receipts")
    lease = None
    payment = None
    for candidate in await _leases(uid):
        found = await get_doc(
            f"users/{uid}/land_leases/{candidate['id']}/payments", payment_id
        )
        if found is not None:
            lease, payment = candidate, found
            break
    if payment is None or lease is None:
        _error(404, "PAYMENT_NOT_FOUND", "rent payment not found")
    landlord = await get_doc("users", uid) or {}
    file_path = reports.build_rent_receipt_pdf(lease, payment, landlord)
    with open(file_path, "rb") as handle:
        content = handle.read()
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="rent-receipt-{payment_id}.pdf"'},
    )


@router.get("/leases/{lease_id}/ledger")
async def rent_ledger_export(
    lease_id: str,
    format: str = "csv",
    uid: str = Depends(_owner),
):
    """Rent ledger export (Pro plan): csv (default) or pdf."""
    await _require_pro(uid, "rent ledger export")
    lease = await _require_lease(uid, lease_id)
    payments = await list_subdocs(f"users/{uid}/land_leases/{lease_id}/payments")
    payments.sort(key=lambda p: p.get("month", ""))
    if format == "csv":
        lines = ["month,amountPaidPaisa,amountRupees,method,paidAt"]
        for payment in payments:
            paid_paisa = int(payment.get("amountPaidPaisa", 0) or 0)
            if not paid_paisa:
                paid_paisa = int(round(float(payment.get("amountRupees", 0) or 0) * 100))
            lines.append(
                f"{payment.get('month', '')},{paid_paisa},{payment.get('amountRupees', 0)},"
                f"{payment.get('method', '')},{payment.get('paidAt', '')}"
            )
        return Response(
            content="\n".join(lines) + "\n",
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="rent-ledger-{lease_id}.csv"'},
        )
    if format == "pdf":
        file_path = reports.build_rent_ledger_pdf(lease, payments)
        with open(file_path, "rb") as handle:
            content = handle.read()
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="rent-ledger-{lease_id}.pdf"'},
        )
    _error(422, "VALIDATION_ERROR", "format must be csv or pdf", {"format": "csv | pdf"})


@router.post("/leases/{lease_id}/disputes", status_code=201)
async def open_lease_dispute(
    lease_id: str,
    body: LandDisputeIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_owner),
):
    """Open a lease dispute record consumable by the phase-07 admin console."""
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "an Idempotency-Key header is required")
    stored = await idempotency.replay("land.dispute", idempotency_key)
    if stored is not None:
        return stored
    await _require_lease(uid, lease_id)
    dispute_id = f"dsp_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    await set_doc(
        "land_disputes",
        dispute_id,
        {
            "id": dispute_id,
            "leaseId": lease_id,
            "createdBy": uid,
            "category": body.category,
            "note": body.note,
            "status": "open",
            "createdAt": now,
        },
    )
    await _audit(uid, "LEASE_DISPUTE_OPENED", {"leaseId": lease_id, "disputeId": dispute_id})
    response = {"disputeId": dispute_id, "leaseId": lease_id, "status": "open"}
    await idempotency.store("land.dispute", idempotency_key, response)
    return response


@router.get("/summary")
async def landlord_summary(uid: str = Depends(_landlord)):
    """Landlord dashboard summary feeding the phase-01 grid."""
    plots = await list_subdocs(f"users/{uid}/land_plots")
    leases = await _leases(uid)
    listings = await query("land_listings", [("landlordId", "==", uid)], limit=1000)
    requests = await query("lease_requests", [("landlordId", "==", uid)], limit=1000)
    active_leases = [l for l in leases if l.get("status") == "active"]
    today = date.today()
    this_month = today.strftime("%Y-%m")
    horizon = (today + timedelta(days=30)).isoformat()
    rent_due_paisa = 0
    for lease in active_leases:
        due_paisa = int(round(float(lease.get("monthlyRentRupees", 0) or 0) * 100))
        ledger = await get_doc(
            f"users/{uid}/land_leases/{lease['id']}/rent_ledger", this_month
        )
        paid_paisa = int((ledger or {}).get("amountPaidPaisa", 0))
        rent_due_paisa += max(0, due_paisa - paid_paisa)
    return {
        "acresOwned": round(sum(p.get("areaAcres", 0) for p in plots), 2),
        "acresLeased": round(
            sum(p.get("areaAcres", 0) for p in plots if p.get("status") == "leased"), 2
        ),
        "activeLeases": len(active_leases),
        "rentDueThisMonthPaisa": rent_due_paisa,
        "pendingRequests": len([r for r in requests if r.get("status") in ("pending", "countered")]),
        "expiringLeases": len(
            [
                l
                for l in active_leases
                if l.get("endDate") and today.isoformat() <= l["endDate"] <= horizon
            ]
        ),
        "totalListings": len(listings),
        "plotOccupancy": [
            {"plotId": p.get("id"), "name": p.get("name", ""), "status": p.get("status", "vacant")}
            for p in plots
        ],
    }


# ---------------------------------------------------------------------------
# Lease e-sign, escrow funding & milestone release (spec L4/C8/F5, F6/C5)
# ---------------------------------------------------------------------------

LEASE_SIGNABLE_STATUSES = ("esign_pending", "pending", "active")

# Lease-escrow commission: read from platform_config/settlements
# ("landLeasePct"), falling back to the 2% rate family the settlements engine
# already uses for low-ticket marketplace roles (broker/seller).
LAND_LEASE_COMMISSION_PCT = 2


async def _lease_milestones_doc(lease_id: str, uid: str) -> dict:
    """Fetch the escrow milestones doc, seeding the 30/40/30 split on first
    read (same bookkeeping the GET /milestones endpoint maintains)."""
    milestones_doc = await get_doc(f"leases/{lease_id}/escrow", "milestones")
    if milestones_doc is None:
        await get_lease_milestones(lease_id=lease_id, uid=uid)
        milestones_doc = await get_doc(f"leases/{lease_id}/escrow", "milestones")
    return milestones_doc or {"leaseId": lease_id, "milestones": []}


@router.post("/leases/{lease_id}/esign")
async def esign_lease(lease_id: str, body: LeaseEsignIn, uid: str = Depends(_owner)):
    """MPIN-gated e-sign of the lease agreement (spec L4/C8/F5).

    Both the landlord and the tenant farmer sign; each signature is an
    immutable acceptance subdoc, the lease moves to `active`, an audit log is
    written and the counterparty is notified."""
    resolved = await find_lease_for_caller(uid, lease_id)
    if resolved is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    landlord_id, lease = resolved
    role = "landlord" if uid == landlord_id else "tenant"
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    if user.get("mpinHash") is None:
        _error(409, "MPIN_NOT_SET", "MPIN is not set for this account")
    if not verify_mpin(body.mpin, user["mpinHash"]):
        _error(401, "WRONG_MPIN", "incorrect MPIN")
    if lease.get("status") not in LEASE_SIGNABLE_STATUSES:
        _error(409, "LEASE_NOT_SIGNABLE", "lease can no longer be signed")
    acceptances_path = f"users/{landlord_id}/land_leases/{lease_id}/acceptances"
    if await get_doc(acceptances_path, uid) is not None:
        _error(409, "ALREADY_SIGNED", "you have already signed this lease")
    now = datetime.now(timezone.utc).isoformat()
    await set_doc(
        acceptances_path,
        uid,
        {
            "userId": uid,
            "role": role,
            "signatureData": body.signatureData,
            "consentTimestamp": body.consentTimestamp,
            "acceptedAt": now,
        },
    )
    lease["status"] = "active"
    lease["updatedAt"] = now
    await set_doc(f"users/{landlord_id}/land_leases", lease_id, lease)
    await _audit(
        uid,
        "LEASE_SIGNED",
        {
            "leaseId": lease_id,
            "landlordId": landlord_id,
            "role": role,
            "consentTimestamp": body.consentTimestamp,
        },
    )
    counterparty_id = landlord_id if role == "tenant" else lease.get("tenantFarmerId")
    if counterparty_id:
        await emit_task(
            counterparty_id,
            persona="farmLandlord" if role == "tenant" else "farmer",
            module="land",
            kind="lease_esign_signed",
            title_en="Lease agreement signed",
            title_hi="पट्टा अनुबंध हस्ताक्षरित",
            subtitle=f"{user.get('name', '')} ({role}) signed the lease agreement",
            priority="today",
            deep_link=DEEP_LINKS["land"],
            source_id=lease_id,
        )
    return {"ok": True, "leaseId": lease_id, "status": "active", "signedBy": uid, "role": role}


@router.post("/leases/{lease_id}/escrow/fund")
async def fund_lease_escrow(
    lease_id: str, body: EscrowFundIn, uid: str = Depends(_owner)
):
    """Tenant funds the lease escrow (spec F6/C5): Razorpay order + signature
    verification, then the lease carries an `escrow` subdoc with status `held`,
    `amountPaisa` equal to the rent-milestones total and a release clock."""
    from app.services import escrow as escrow_service

    resolved = await find_lease_for_caller(uid, lease_id)
    if resolved is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    landlord_id, lease = resolved
    if uid == landlord_id:
        _error(403, "FORBIDDEN_ROLE", "only the tenant farmer funds the escrow")
    if lease.get("status") != "active":
        _error(409, "LEASE_NOT_ACTIVE", "escrow can only be funded on an active lease")
    existing = lease.get("escrow") or {}
    if existing.get("status") == "held":
        _error(409, "ESCROW_ALREADY_FUNDED", "escrow is already funded for this lease")
    milestones_doc = await _lease_milestones_doc(lease_id, uid)
    total_rupees = sum(
        float(m.get("amountRupees", 0) or 0) for m in milestones_doc.get("milestones", [])
    )
    amount_paisa = int(round(total_rupees * 100))
    if amount_paisa <= 0:
        _error(422, "VALIDATION_ERROR", "lease has no escrow milestones to fund")
    order = create_razorpay_order(amount_paisa, f"lease-escrow-{lease_id}")
    if settings.razorpay_key_secret:
        if not (
            body.razorpayOrderId and body.razorpayPaymentId and body.razorpaySignature
        ):
            _error(
                400,
                "PAYMENT_SIGNATURE_INVALID",
                "razorpay payment details are required to fund the escrow",
            )
        if not verify_razorpay_signature(
            body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature
        ):
            _error(400, "PAYMENT_SIGNATURE_INVALID", "payment signature verification failed")
    now = datetime.now(timezone.utc).isoformat()
    escrow = {
        "status": "held",
        "amountPaisa": amount_paisa,
        "releasedPaisa": 0,
        "commissionPaisa": 0,
        "fundedBy": uid,
        "fundedAt": now,
        "razorpayOrderId": order.get("id"),
    }
    if body.razorpayPaymentId:
        escrow["razorpayPaymentId"] = body.razorpayPaymentId
    escrow_service.start_clock(escrow)
    lease["escrow"] = escrow
    await set_doc(f"users/{landlord_id}/land_leases", lease_id, lease)
    await _audit(
        uid,
        "LEASE_ESCROW_FUNDED",
        {"leaseId": lease_id, "amountPaisa": amount_paisa, "releaseAt": escrow["releaseAt"]},
    )
    await emit_task(
        landlord_id,
        persona="farmLandlord",
        module="land",
        kind="escrow_funded",
        title_en="Lease escrow funded",
        title_hi="पट्टा एस्क्रो भरा गया",
        subtitle=f"₹{amount_paisa / 100:.0f} held for {lease.get('tenantName', 'tenant')} · dispute window {escrow['disputeWindowHours']}h",
        priority="today",
        deep_link=DEEP_LINKS["land"],
        source_id=lease_id,
    )
    return {"leaseId": lease_id, "escrow": escrow, "razorpayOrderId": order.get("id")}


@router.post("/leases/{lease_id}/milestones/{index}/release")
async def release_lease_milestone(
    lease_id: str,
    index: int,
    body: MilestoneReleaseIn,
    uid: str = Depends(_landlord),
):
    """Landlord releases one escrow milestone (spec F6/C5): the milestone is
    marked paid, the amount moves from held to released on the escrow subdoc,
    platform commission is deducted and a settlement ledger doc is written in
    the module's rent/settlement style. Milestones seeded `released` by the
    old status-only bookkeeping stay payable through this endpoint exactly
    once (the ledger doc is the idempotency key)."""
    from app.services import escrow as escrow_service
    from app.services import settlements as settlements_service

    lease = await _require_lease(uid, lease_id)
    escrow = lease.get("escrow") or {}
    if escrow.get("status") != "held":
        _error(409, "ESCROW_NOT_FUNDED", "escrow must be funded before releasing milestones")
    if escrow_service.is_paused(escrow):
        _error(409, "ESCROW_DISPUTED", "escrow release is paused by an open dispute")
    milestones_doc = await _lease_milestones_doc(lease_id, uid)
    ms_list = milestones_doc.get("milestones", [])
    if index < 0 or index >= len(ms_list):
        _error(404, "MILESTONE_NOT_FOUND", "milestone not found")
    milestone = ms_list[index]
    if milestone.get("status") == "disputed":
        _error(409, "MILESTONE_DISPUTED", "milestone is disputed")
    ledger_id = f"rel_{index}"
    ledger_path = f"users/{uid}/land_leases/{lease_id}/escrow_ledger"
    if await get_doc(ledger_path, ledger_id) is not None:
        _error(409, "MILESTONE_ALREADY_RELEASED", "milestone already released")
    amount_paisa = int(round(float(milestone.get("amountRupees", 0) or 0) * 100))
    config = await settlements_service._config()
    pct = float(config.get("landLeasePct", LAND_LEASE_COMMISSION_PCT))
    commission_paisa = int(round(amount_paisa * pct / 100))
    net_paisa = amount_paisa - commission_paisa
    now = datetime.now(timezone.utc).isoformat()
    milestone["status"] = "released"
    milestone["releaseDate"] = now
    if body.notes:
        milestone["notes"] = body.notes
    milestones_doc["milestones"] = ms_list
    milestones_doc["updatedAt"] = now
    await set_doc(f"leases/{lease_id}/escrow", "milestones", milestones_doc)
    released_paisa = int(escrow.get("releasedPaisa", 0) or 0) + amount_paisa
    escrow["releasedPaisa"] = released_paisa
    escrow["commissionPaisa"] = int(escrow.get("commissionPaisa", 0) or 0) + commission_paisa
    if released_paisa >= int(escrow.get("amountPaisa", 0) or 0):
        escrow["status"] = "released"
        escrow["releasedAt"] = now
    lease["escrow"] = escrow
    await set_doc(f"users/{uid}/land_leases", lease_id, lease)
    settlement_doc = {
        "id": ledger_id,
        "leaseId": lease_id,
        "landlordId": uid,
        "tenantFarmerId": lease.get("tenantFarmerId"),
        "tenantName": lease.get("tenantName", ""),
        "milestoneIndex": index,
        "milestoneName": milestone.get("name", ""),
        "grossPaisa": amount_paisa,
        "commissionPaisa": commission_paisa,
        "netPaisa": net_paisa,
        "grossRupees": round(amount_paisa / 100, 2),
        "commissionRupees": round(commission_paisa / 100, 2),
        "netRupees": round(net_paisa / 100, 2),
        "commissionPct": pct,
        "status": "released",
        "releasedBy": uid,
        "releasedAt": now,
        "retainUntil": _retain_until(),
    }
    await set_doc(
        f"users/{uid}/land_leases/{lease_id}/escrow_ledger", ledger_id, settlement_doc
    )
    await record_auto_entry(
        uid, "income", net_paisa, "lease_escrow_release", "lease_milestone_release", ledger_id
    )
    await _audit(
        uid,
        "LEASE_MILESTONE_RELEASED",
        {
            "leaseId": lease_id,
            "milestoneIndex": index,
            "grossPaisa": amount_paisa,
            "commissionPaisa": commission_paisa,
            "netPaisa": net_paisa,
        },
    )
    tenant_id = lease.get("tenantFarmerId")
    if tenant_id:
        await emit_task(
            tenant_id,
            persona="farmer",
            module="land",
            kind="milestone_released",
            title_en="Escrow milestone released",
            title_hi="एस्क्रो माइलस्टोन जारी",
            subtitle=f"{milestone.get('name', '')}: ₹{net_paisa / 100:.0f} paid to your landlord",
            priority="today",
            deep_link=DEEP_LINKS["land"],
            source_id=lease_id,
        )
    return {
        "leaseId": lease_id,
        "milestone": milestone,
        "escrow": escrow,
        "settlement": settlement_doc,
    }


@router.get("/settlements")
async def land_settlements(uid: str = Depends(_landlord)):
    """Landlord payout dashboard (spec L5): escrow releases from the lease
    escrow ledgers, the commission breakdown on top of them and the bank
    settlement history from the platform settlements ledger."""
    releases = []
    for lease in await _leases(uid):
        for doc in await list_subdocs(f"users/{uid}/land_leases/{lease['id']}/escrow_ledger"):
            row = dict(doc)
            row.setdefault("tenantName", lease.get("tenantName", ""))
            releases.append(row)
    releases.sort(key=lambda d: d.get("releasedAt", ""), reverse=True)
    gross_paisa = sum(int(d.get("grossPaisa", 0) or 0) for d in releases)
    commission_paisa = sum(int(d.get("commissionPaisa", 0) or 0) for d in releases)
    net_paisa = sum(int(d.get("netPaisa", 0) or 0) for d in releases)
    by_lease: dict[str, dict] = {}
    for row in releases:
        bucket = by_lease.setdefault(
            row.get("leaseId", ""),
            {
                "leaseId": row.get("leaseId", ""),
                "tenantName": row.get("tenantName", ""),
                "grossPaisa": 0,
                "commissionPaisa": 0,
                "netPaisa": 0,
                "releases": 0,
            },
        )
        bucket["grossPaisa"] += int(row.get("grossPaisa", 0) or 0)
        bucket["commissionPaisa"] += int(row.get("commissionPaisa", 0) or 0)
        bucket["netPaisa"] += int(row.get("netPaisa", 0) or 0)
        bucket["releases"] += 1
    bank = await query(
        "settlements", [("role", "==", "landLease"), ("entityId", "==", uid)], limit=200
    )
    bank.sort(key=lambda d: d.get("periodStart", ""), reverse=True)
    paid_paisa = sum(
        int(round(float(d.get("netRupees", 0) or 0) * 100)) for d in bank if d.get("status") == "paid"
    )
    return {
        "escrowReleases": releases,
        "commissionBreakdown": {
            "grossPaisa": gross_paisa,
            "commissionPaisa": commission_paisa,
            "netPaisa": net_paisa,
            "releaseCount": len(releases),
            "byLease": sorted(by_lease.values(), key=lambda b: b["netPaisa"], reverse=True),
        },
        "bankSettlements": {"data": bank, "total": len(bank)},
        "pendingSettlementPaisa": max(0, net_paisa - paid_paisa),
    }


# ---------------------------------------------------------------------------
# Post-confirmation landlord ↔ tenant chat (spec L6/C6/D)
# ---------------------------------------------------------------------------


def _first_name(name: str) -> str:
    return (name or "").strip().split(" ")[0]


async def _ensure_land_lease_room(landlord_id: str, lease: dict) -> dict:
    """Booking-gated room for a land lease — local copy of the room shape in
    app/services/chat.py::ensure_transport_room (kind: land_lease)."""
    room_id = f"land_lease_{lease['id']}"
    existing = await get_doc("chat_rooms", room_id)
    if existing is not None:
        return existing
    landlord = await get_doc("users", landlord_id) or {}
    tenant_id = lease.get("tenantFarmerId") or ""
    tenant = await get_doc("users", tenant_id) or {}
    now = datetime.now(timezone.utc).isoformat()
    room = {
        "id": room_id,
        "leaseId": lease["id"],
        "kind": "land_lease",
        "landlordId": landlord_id,
        "farmerId": tenant_id,
        "farmerName": _first_name(tenant.get("name") or lease.get("tenantName", "")),
        "buyerId": landlord_id,
        "buyerName": _first_name(landlord.get("name", "")),
        "crop": "",
        "createdAt": now,
        "lastMessageAt": None,
        "lastMessageText": "",
        "readByFarmer": True,
        "readByBuyer": True,
    }
    await set_doc("chat_rooms", room_id, room)
    return room


@router.post("/leases/{lease_id}/chat-room")
async def lease_chat_room(lease_id: str, uid: str = Depends(_owner)):
    """Lazy-create the landlord ↔ tenant chat room on a confirmed lease
    (spec L6/C6/D — chat stays locked until the lease is active)."""
    resolved = await find_lease_for_caller(uid, lease_id)
    if resolved is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    landlord_id, lease = resolved
    if lease.get("status") != "active":
        _error(409, "CHAT_LOCKED", "chat unlocks once the lease is confirmed")
    if not lease.get("tenantFarmerId"):
        _error(409, "CHAT_LOCKED", "chat requires a confirmed tenant on the lease")
    return await _ensure_land_lease_room(landlord_id, lease)
