"""Land marketplace ops (extension-2026-10-11) — landlord CRM, lease lifecycle
and profit management built on top of the core `land` module.

Personas: farmer (tenant) and farmLandlord. Everything here reads/writes the
same Firestore collections as `land.py` and integrates the shared engines:
tasks (emit_task), P&L (record_auto_entry), coins (spend_coins), rating
prompts and chat moderation.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Response

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.land import (
    AvailabilityIn,
    BoostIn,
    HandoverIn,
    HarvestDeclarationIn,
    LandReviewIn,
    LeadNoteIn,
    LeadStatusIn,
    LeaseRenewIn,
    LeaseRenewRespondIn,
    LeaseTerminateIn,
    ListingPhotoIn,
    PlotExpenseIn,
)
from app.routers.land import (
    _add_months,
    _audit,
    _envelope,
    _error,
    _farmer,
    _landlord,
    _owner,
    _require_listing,
    _require_plot,
)
from app.services import billing
from app.services.chat_moderation import scan as moderation_scan
from app.services.coins import InsufficientCoins, spend_coins
from app.services.land_crm import (
    COLLECTION_HANDOVERS,
    COLLECTION_HARVEST_DECLS,
    COLLECTION_LEADS,
    COLLECTION_RENEWALS,
    COLLECTION_REVIEWS,
    COLLECTION_SAVES,
    COLLECTION_TERMINATIONS,
    COLLECTION_WAITLIST,
    LEAD_STATUSES,
    find_lease_for_caller,
    months_elapsed_unpaid,
    promote_waitlist,
    upsert_lead,
    waitlist_next,
)
from app.services.pnl_engine import record_auto_entry
from app.services.rating_prompts import open_rating_prompt
from app.services.tasks import DEEP_LINKS, emit_task
from app.services.users import get_user

router = APIRouter(prefix="/land", tags=["land"])

BOOST_COST_COINS = 200
MAX_LISTING_PHOTOS = 10
FREE_BOOSTS_PER_LISTING = 1

LAND_REVIEW_ASPECTS = ("soilQuality", "waterAvailability", "landlordResponsiveness", "valueForMoney")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_day(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        _error(422, "VALIDATION_ERROR", f"{field} must be an ISO date", {field: "invalid date"})


async def _rent_standing(landlord_id: str, lease: dict, today: date) -> dict:
    """Month-by-month rent standing plus outstanding amount for one lease."""
    rows = months_elapsed_unpaid(lease, today)
    ledgers = await query(
        f"users/{landlord_id}/land_leases/{lease['id']}/rent_ledger", [], limit=300
    )
    paid_by_month = {l.get("month"): int(l.get("amountPaidPaisa", 0) or 0) for l in ledgers}
    months_due: list[str] = []
    outstanding = 0
    for row in rows:
        paid = paid_by_month.get(row["month"], 0)
        row["paidPaisa"] = paid
        if row["duePaisa"] > 0 and paid >= row["duePaisa"]:
            row["status"] = "paid"
        elif paid > 0:
            row["status"] = "partial"
            months_due.append(row["month"])
            outstanding += row["duePaisa"] - paid
        else:
            row["status"] = "due"
            months_due.append(row["month"])
            outstanding += row["duePaisa"]
    return {"months": rows, "monthsDue": months_due, "outstandingPaisa": outstanding}


async def _review_aggregate(listing_id: str) -> dict:
    reviews = await query(COLLECTION_REVIEWS, [("listingId", "==", listing_id)], limit=500)
    if not reviews:
        return {"count": 0, "avgStars": None, "aspectAvgs": {}}
    aspect_sums: dict[str, list[int]] = {}
    for review in reviews:
        for aspect, value in (review.get("aspects") or {}).items():
            aspect_sums.setdefault(aspect, []).append(int(value))
    return {
        "count": len(reviews),
        "avgStars": round(sum(r["stars"] for r in reviews) / len(reviews), 1),
        "aspectAvgs": {
            aspect: round(sum(values) / len(values), 1)
            for aspect, values in aspect_sums.items()
        },
    }


async def _my_leads(uid: str) -> list[dict]:
    return await query(COLLECTION_LEADS, [("landlordId", "==", uid)], limit=1000)


def _lead_or_404(lead) -> dict:
    if lead is None:
        _error(404, "LEAD_NOT_FOUND", "lead not found")
    return lead


# ---------------------------------------------------------------------------
# Listing enrichment
# ---------------------------------------------------------------------------


@router.get("/listings/{listing_id}")
async def listing_detail(listing_id: str, uid: str = Depends(_owner)):
    """Full listing card: photos, availability windows, funnel counters,
    landlord rating and review aggregate (extension-2026-10-11)."""
    listing = await _require_listing(listing_id)
    saves = len(await query(COLLECTION_SAVES, [("listingId", "==", listing_id)], limit=1000))
    requests = await query("lease_requests", [("listingId", "==", listing_id)], limit=1000)
    landlord_rating = await get_doc("provider_ratings", listing.get("landlordId", ""))
    return {
        **listing,
        "photos": listing.get("photos") or [],
        "availability": listing.get("availability") or [],
        "savesCount": saves,
        "requestsCount": len(requests),
        "acceptsCount": len([r for r in requests if r.get("status") == "accepted"]),
        "landlordRating": landlord_rating or None,
        "reviewAggregate": await _review_aggregate(listing_id),
    }


@router.post("/listings/{listing_id}/photos", status_code=201)
async def add_listing_photo(
    listing_id: str, body: ListingPhotoIn, uid: str = Depends(_landlord)
):
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "listing belongs to another landlord")
    photos = listing.setdefault("photos", [])
    if len(photos) >= MAX_LISTING_PHOTOS:
        _error(409, "PHOTO_LIMIT_REACHED", f"a listing can hold at most {MAX_LISTING_PHOTOS} photos")
    photo = {
        "id": f"ph_{uuid.uuid4().hex[:12]}",
        "url": body.url,
        "caption": body.caption,
        "uploadedAt": _now(),
    }
    photos.append(photo)
    await set_doc("land_listings", listing_id, listing)
    return photo


@router.delete("/listings/{listing_id}/photos/{photo_id}", status_code=204)
async def delete_listing_photo(listing_id: str, photo_id: str, uid: str = Depends(_landlord)):
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "listing belongs to another landlord")
    photos = listing.get("photos") or []
    remaining = [p for p in photos if p.get("id") != photo_id]
    if len(remaining) == len(photos):
        _error(404, "PHOTO_NOT_FOUND", "photo not found on this listing")
    listing["photos"] = remaining
    await set_doc("land_listings", listing_id, listing)


@router.put("/listings/{listing_id}/availability")
async def set_listing_availability(
    listing_id: str, body: AvailabilityIn, uid: str = Depends(_landlord)
):
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "listing belongs to another landlord")
    windows = [w.model_dump() for w in body.windows]
    for window in windows:
        if window["toDate"] < window["fromDate"]:
            _error(
                422,
                "INVALID_DATE_RANGE",
                "availability window toDate must be on or after fromDate",
                {"windows": "toDate must be >= fromDate"},
            )
    listing["availability"] = windows
    await set_doc("land_listings", listing_id, listing)
    return {"listingId": listing_id, "availability": windows}


@router.post("/listings/{listing_id}/view", status_code=201)
async def record_listing_view(listing_id: str, uid: str = Depends(_farmer)):
    """Farmer view event: bumps the counter and lands in the landlord lead inbox."""
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") == uid:
        _error(403, "OWN_LISTING", "landlords cannot view-track their own listing")
    listing["viewsCount"] = int(listing.get("viewsCount", 0) or 0) + 1
    await set_doc("land_listings", listing_id, listing)
    user = await get_user(uid) or {}
    await upsert_lead(listing["landlordId"], listing_id, uid, user.get("name", ""), "view")
    return {"listingId": listing_id, "viewsCount": listing["viewsCount"]}


@router.get("/price-suggestion")
async def price_suggestion(
    village: str,
    areaAcres: float = 1.0,
    uid: str = Depends(_owner),
):
    """Rent band per acre for a village computed from real leased listings."""
    if len(village.strip()) < 2:
        _error(422, "VALIDATION_ERROR", "village must be at least 2 characters", {"village": "too short"})
    if areaAcres <= 0:
        _error(422, "VALIDATION_ERROR", "areaAcres must be > 0", {"areaAcres": "must be > 0"})
    sample = await query(
        "land_listings", [("village", "==", village.strip()), ("status", "==", "leased")], limit=50
    )
    rents_per_acre = [
        float(l.get("expectedRentRupees", 0)) / max(0.1, float(l.get("areaAcres", 1)))
        for l in sample
        if l.get("expectedRentRupees") and l.get("areaAcres")
    ]
    if len(rents_per_acre) < 3:
        return {
            "village": village.strip(),
            "areaAcres": areaAcres,
            "sampleCount": len(rents_per_acre),
            "bandMinRupeesPerAcre": None,
            "bandMaxRupeesPerAcre": None,
            "suggestedRentRupees": None,
            "note": "not enough leased-listing data for this village yet",
        }
    rents_per_acre.sort()
    median = rents_per_acre[len(rents_per_acre) // 2]
    return {
        "village": village.strip(),
        "areaAcres": areaAcres,
        "sampleCount": len(rents_per_acre),
        "bandMinRupeesPerAcre": round(min(rents_per_acre) * 0.9, 2),
        "bandMaxRupeesPerAcre": round(max(rents_per_acre) * 1.1, 2),
        "suggestedRentRupees": round(median * areaAcres, 2),
    }


@router.post("/listings/{listing_id}/boost")
async def boost_listing(listing_id: str, body: BoostIn, uid: str = Depends(_landlord)):
    """Spend AgriCoins to pin a listing to the top of search for N days.

    Free plan: one boost per listing lifetime. Pro: unlimited boosts.
    """
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "listing belongs to another landlord")
    if listing.get("status") != "open":
        _error(409, "LISTING_NOT_OPEN", "only open listings can be boosted")
    boost_count = int(listing.get("boostCount", 0) or 0)
    plan = await billing.effective_plan(uid, "farmLandlord")
    if plan.get("tier") == "free" and boost_count >= FREE_BOOSTS_PER_LISTING:
        _error(
            402,
            "UPGRADE_REQUIRED",
            "free plan allows one boost per listing — upgrade to Pro for unlimited boosts",
            {"boost": "upgrade required"},
        )
    try:
        balance = await spend_coins(uid, BOOST_COST_COINS, "listing_boost", listing_id)
    except InsufficientCoins:
        _error(
            402,
            "INSUFFICIENT_COINS",
            f"boosting costs {BOOST_COST_COINS} AgriCoins — earn more via diary, referrals and tasks",
            {"agriCoins": f"need {BOOST_COST_COINS}"},
        )
    boosted_until = (datetime.now(timezone.utc) + timedelta(days=body.days)).isoformat()
    listing["boostedUntil"] = boosted_until
    listing["boostCount"] = boost_count + 1
    await set_doc("land_listings", listing_id, listing)
    await _audit(uid, "LISTING_BOOSTED", {"listingId": listing_id, "days": body.days})
    return {
        "listingId": listing_id,
        "boostedUntil": boosted_until,
        "boostCount": listing["boostCount"],
        "coinsBalance": balance,
        "days": body.days,
    }


# ---------------------------------------------------------------------------
# Farmer: saved listings & waitlist
# ---------------------------------------------------------------------------


@router.post("/listings/{listing_id}/save", status_code=201)
async def save_listing(listing_id: str, uid: str = Depends(_farmer)):
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") == uid:
        _error(403, "OWN_LISTING", "cannot save your own listing")
    save_id = f"{uid}_{listing_id}"
    existing = await get_doc(COLLECTION_SAVES, save_id)
    if existing is not None:
        return {"saved": True, "listingId": listing_id, "savedAt": existing.get("createdAt")}
    await set_doc(
        COLLECTION_SAVES,
        save_id,
        {"id": save_id, "farmerId": uid, "listingId": listing_id, "createdAt": _now()},
    )
    user = await get_user(uid) or {}
    await upsert_lead(listing["landlordId"], listing_id, uid, user.get("name", ""), "save")
    return {"saved": True, "listingId": listing_id, "savedAt": _now()}


@router.delete("/listings/{listing_id}/save", status_code=204)
async def unsave_listing(listing_id: str, uid: str = Depends(_farmer)):
    await delete_doc(COLLECTION_SAVES, f"{uid}_{listing_id}")


@router.get("/saved-listings")
async def saved_listings(uid: str = Depends(_farmer)):
    saves = await query(COLLECTION_SAVES, [("farmerId", "==", uid)], limit=500)
    saves.sort(key=lambda s: s.get("createdAt", ""), reverse=True)
    data = []
    for save in saves:
        listing = await get_doc("land_listings", save["listingId"])
        if listing is None:
            continue
        data.append({**listing, "savedAt": save.get("createdAt")})
    return {"data": data, "total": len(data)}


@router.post("/listings/{listing_id}/waitlist", status_code=201)
async def join_waitlist(listing_id: str, uid: str = Depends(_farmer)):
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") == uid:
        _error(403, "OWN_LISTING", "cannot join the waitlist of your own listing")
    existing = [
        w
        for w in await query(
            COLLECTION_WAITLIST,
            [("listingId", "==", listing_id), ("farmerId", "==", uid)],
            limit=10,
        )
        if w.get("status") in ("waiting", "offered")
    ]
    if existing:
        _error(409, "ALREADY_WAITLISTED", "you are already on the waitlist for this listing")
    position = len(
        [
            w
            for w in await query(
                COLLECTION_WAITLIST,
                [("listingId", "==", listing_id), ("status", "==", "waiting")],
                limit=500,
            )
        ]
    ) + 1
    user = await get_user(uid) or {}
    entry = {
        "id": f"wl_{uuid.uuid4().hex[:12]}",
        "listingId": listing_id,
        "landlordId": listing["landlordId"],
        "farmerId": uid,
        "farmerName": user.get("name", ""),
        "status": "waiting",
        "position": position,
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await set_doc(COLLECTION_WAITLIST, entry["id"], entry)
    await upsert_lead(listing["landlordId"], listing_id, uid, user.get("name", ""), "waitlist")
    return entry


@router.delete("/listings/{listing_id}/waitlist", status_code=204)
async def leave_waitlist(listing_id: str, uid: str = Depends(_farmer)):
    entries = [
        w
        for w in await query(
            COLLECTION_WAITLIST,
            [("listingId", "==", listing_id), ("farmerId", "==", uid)],
            limit=10,
        )
        if w.get("status") in ("waiting", "offered")
    ]
    if not entries:
        _error(404, "WAITLIST_NOT_FOUND", "no active waitlist entry for this listing")
    for entry in entries:
        entry["status"] = "cancelled"
        entry["updatedAt"] = _now()
        await set_doc(COLLECTION_WAITLIST, entry["id"], entry)


@router.get("/waitlist/mine")
async def my_waitlist(uid: str = Depends(_farmer)):
    entries = [
        w
        for w in await query(COLLECTION_WAITLIST, [("farmerId", "==", uid)], limit=500)
        if w.get("status") != "cancelled"
    ]
    entries.sort(key=lambda w: w.get("createdAt", ""), reverse=True)
    data = []
    for entry in entries:
        listing = await get_doc("land_listings", entry["listingId"]) or {}
        data.append(
            {
                **entry,
                "listing": {
                    "id": listing.get("id"),
                    "village": listing.get("village"),
                    "district": listing.get("district"),
                    "areaAcres": listing.get("areaAcres"),
                    "expectedRentRupees": listing.get("expectedRentRupees"),
                    "status": listing.get("status"),
                },
            }
        )
    return {"data": data, "total": len(data)}


# ---------------------------------------------------------------------------
# Landlord: lead inbox (CRM)
# ---------------------------------------------------------------------------


@router.get("/leads")
async def list_leads(
    status: str | None = None,
    type: str | None = None,
    listingId: str | None = None,
    uid: str = Depends(_landlord),
):
    leads = await _my_leads(uid)
    if listingId is not None:
        leads = [l for l in leads if l.get("listingId") == listingId]
    by_status = {s: 0 for s in LEAD_STATUSES}
    for lead in leads:
        by_status[lead.get("status", "new")] = by_status.get(lead.get("status", "new"), 0) + 1
    if type is not None:
        leads = [l for l in leads if l.get("type") == type]
    if status is not None:
        leads = [l for l in leads if l.get("status") == status]
    leads.sort(key=lambda l: l.get("updatedAt", ""), reverse=True)
    return {**_envelope(leads), "byStatus": by_status}


async def _require_own_lead(lead_id: str, uid: str) -> dict:
    lead = await get_doc(COLLECTION_LEADS, lead_id)
    if lead is None or lead.get("landlordId") != uid:
        _error(404, "LEAD_NOT_FOUND", "lead not found")
    return lead


@router.post("/leads/{lead_id}/status")
async def update_lead_status(lead_id: str, body: LeadStatusIn, uid: str = Depends(_landlord)):
    lead = await _require_own_lead(lead_id, uid)
    lead["status"] = body.status
    if body.status == "converted":
        lead["convertedAt"] = _now()
    lead["updatedAt"] = _now()
    await set_doc(COLLECTION_LEADS, lead_id, lead)
    return lead


@router.post("/leads/{lead_id}/notes", status_code=201)
async def add_lead_note(lead_id: str, body: LeadNoteIn, uid: str = Depends(_landlord)):
    lead = await _require_own_lead(lead_id, uid)
    note = {"note": body.note, "at": _now()}
    lead.setdefault("notes", []).append(note)
    lead["updatedAt"] = _now()
    await set_doc(COLLECTION_LEADS, lead_id, lead)
    return note


@router.delete("/leads/{lead_id}", status_code=204)
async def delete_lead(lead_id: str, uid: str = Depends(_landlord)):
    lead = await _require_own_lead(lead_id, uid)
    await delete_doc(COLLECTION_LEADS, lead["id"])


# ---------------------------------------------------------------------------
# Farmer: tenancies & rent dues
# ---------------------------------------------------------------------------


async def _tenant_leases(uid: str) -> list[tuple[str, dict]]:
    caller = await get_user(uid) or {}
    phone = caller.get("phone", "")
    found: list[tuple[str, dict]] = []
    for other in await query("users", [], limit=1000):
        if other.get("id") == uid:
            continue
        for lease in await query(f"users/{other['id']}/land_leases", [], limit=500):
            if lease.get("tenantFarmerId") == uid:
                found.append((other["id"], lease))
            elif phone and lease.get("tenantPhone") == phone:
                found.append((other["id"], lease))
    return found


@router.get("/tenancies")
async def my_tenancies(uid: str = Depends(_farmer)):
    """Land the farmer rents: lease, plot, landlord and rent standing."""
    today = date.today()
    data = []
    for landlord_id, lease in await _tenant_leases(uid):
        landlord = await get_doc("users", landlord_id) or {}
        plot = await get_doc(f"users/{landlord_id}/land_plots", lease.get("plotId", "")) or {}
        standing = await _rent_standing(landlord_id, lease, today)
        data.append(
            {
                "leaseId": lease["id"],
                "listingId": lease.get("listingId"),
                "plotId": lease.get("plotId"),
                "plotName": plot.get("name"),
                "village": plot.get("village") or lease.get("village"),
                "landlordId": landlord_id,
                "landlordName": landlord.get("name", ""),
                "monthlyRentRupees": lease.get("monthlyRentRupees"),
                "rentModel": lease.get("rentModel", "fixed"),
                "startDate": lease.get("startDate"),
                "endDate": lease.get("endDate"),
                "status": lease.get("status"),
                "monthsDue": standing["monthsDue"],
                "outstandingPaisa": standing["outstandingPaisa"],
            }
        )
    data.sort(key=lambda t: t.get("startDate") or "", reverse=True)
    return {"data": data, "total": len(data)}


@router.get("/rent/dues")
async def my_rent_dues(uid: str = Depends(_farmer)):
    """Consolidated rent dues across everything the farmer rents."""
    today = date.today()
    current_month = today.strftime("%Y-%m")
    data = []
    total_outstanding = 0
    for landlord_id, lease in await _tenant_leases(uid):
        standing = await _rent_standing(landlord_id, lease, today)
        months_due = standing["monthsDue"]
        if any(m < current_month for m in months_due):
            status = "overdue"
        elif months_due:
            status = "due"
        else:
            status = "paid_up"
        plot = await get_doc(f"users/{landlord_id}/land_plots", lease.get("plotId", "")) or {}
        landlord = await get_doc("users", landlord_id) or {}
        total_outstanding += standing["outstandingPaisa"]
        data.append(
            {
                "leaseId": lease["id"],
                "plotName": plot.get("name"),
                "landlordName": landlord.get("name", ""),
                "monthlyRentRupees": lease.get("monthlyRentRupees"),
                "monthsDue": months_due,
                "outstandingPaisa": standing["outstandingPaisa"],
                "status": status,
            }
        )
    return {"data": data, "total": len(data), "totalOutstandingPaisa": total_outstanding}


# ---------------------------------------------------------------------------
# Lease lifecycle: renewals, termination, handover
# ---------------------------------------------------------------------------


@router.post("/leases/{lease_id}/renew", status_code=201)
async def propose_renewal(lease_id: str, body: LeaseRenewIn, uid: str = Depends(_landlord)):
    lease = await get_doc(f"users/{uid}/land_leases", lease_id)
    if lease is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    if lease.get("status") != "active":
        _error(409, "LEASE_NOT_ACTIVE", "only active leases can be renewed")
    renewal = {
        "id": f"ren_{uuid.uuid4().hex[:12]}",
        "leaseId": lease_id,
        "listingId": lease.get("listingId"),
        "landlordId": uid,
        "farmerId": lease.get("tenantFarmerId"),
        "extensionMonths": body.extensionMonths,
        "newRentRupees": body.newRentRupees,
        "currentRentRupees": lease.get("monthlyRentRupees"),
        "currentEndDate": lease.get("endDate"),
        "note": body.note,
        "status": "proposed",
        "createdAt": _now(),
    }
    await set_doc(COLLECTION_RENEWALS, renewal["id"], renewal)
    tenant = lease.get("tenantFarmerId")
    if tenant:
        await emit_task(
            tenant,
            persona="farmer",
            module="land",
            kind="lease_renewal",
            title_en="Lease renewal offer",
            title_hi="पट्टा नवीनीकरण प्रस्ताव",
            subtitle=f"{body.extensionMonths} more months"
            + (f" at ₹{body.newRentRupees}/mo" if body.newRentRupees else ""),
            priority="today",
            deep_link=DEEP_LINKS["land"],
            source_id=renewal["id"],
        )
    return renewal


@router.get("/leases/{lease_id}/renewals")
async def lease_renewals(lease_id: str, uid: str = Depends(_owner)):
    if await find_lease_for_caller(uid, lease_id) is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    renewals = await query(COLLECTION_RENEWALS, [("leaseId", "==", lease_id)], limit=100)
    renewals.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return {"data": renewals, "total": len(renewals)}


@router.post("/lease-renewals/{renewal_id}/respond")
async def respond_renewal(renewal_id: str, body: LeaseRenewRespondIn, uid: str = Depends(_farmer)):
    renewal = await get_doc(COLLECTION_RENEWALS, renewal_id)
    if renewal is None or renewal.get("farmerId") != uid:
        _error(404, "RENEWAL_NOT_FOUND", "renewal not found")
    if renewal.get("status") != "proposed":
        _error(409, "RENEWAL_RESOLVED", "renewal already responded to")
    renewal["respondedAt"] = _now()
    renewal["responseReason"] = body.reason
    if body.action == "decline":
        renewal["status"] = "declined"
        await set_doc(COLLECTION_RENEWALS, renewal_id, renewal)
        return renewal
    lease = await get_doc(f"users/{renewal['landlordId']}/land_leases", renewal["leaseId"])
    if lease is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    base_end = _parse_day(lease.get("endDate", ""), "endDate")
    if base_end < date.today():
        base_end = date.today()
    lease["endDate"] = _add_months(base_end, renewal["extensionMonths"]).isoformat()
    if renewal.get("newRentRupees"):
        lease["monthlyRentRupees"] = renewal["newRentRupees"]
    await set_doc(f"users/{renewal['landlordId']}/land_leases", renewal["leaseId"], lease)
    renewal["status"] = "accepted"
    await set_doc(COLLECTION_RENEWALS, renewal_id, renewal)
    await _audit(
        renewal["landlordId"],
        "LEASE_RENEWED",
        {"leaseId": renewal["leaseId"], "renewalId": renewal_id, "by": "tenant_accept"},
    )
    await emit_task(
        renewal["landlordId"],
        persona="farmLandlord",
        module="land",
        kind="lease_renewal_accepted",
        title_en="Lease renewal accepted",
        title_hi="पट्टा नवीनीकरण स्वीकृत",
        subtitle=f"extended {renewal['extensionMonths']} months to {lease['endDate']}",
        priority="today",
        deep_link=DEEP_LINKS["land"],
        source_id=renewal["leaseId"],
    )
    return renewal


@router.post("/leases/{lease_id}/terminate", status_code=201)
async def terminate_lease(lease_id: str, body: LeaseTerminateIn, uid: str = Depends(_owner)):
    resolved = await find_lease_for_caller(uid, lease_id)
    if resolved is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    landlord_id, lease = resolved
    if lease.get("status") != "active":
        _error(409, "LEASE_NOT_ACTIVE", "only active leases can be terminated")
    terminated_by = "landlord" if uid == landlord_id else "tenant"
    termination_day = _parse_day(body.terminationDate, "terminationDate") if body.terminationDate else date.today()
    end_day = _parse_day(lease.get("endDate", ""), "endDate")
    monthly_rent = float(lease.get("monthlyRentRupees", 0) or 0)
    penalty = 0.0
    penalty_direction = "none"
    if termination_day < end_day:
        if terminated_by == "landlord":
            # landlord breaking early compensates the tenant one month of rent
            penalty = round(monthly_rent, 2)
            penalty_direction = "landlord_pays_tenant"
        else:
            # tenant leaving early forfeits half a month
            penalty = round(monthly_rent * 0.5, 2)
            penalty_direction = "tenant_forfeits"

    lease["status"] = "terminated"
    lease["terminatedAt"] = _now()
    lease["terminatedBy"] = terminated_by
    lease["terminationReason"] = body.reason
    lease["terminationDate"] = termination_day.isoformat()
    lease["terminationPenaltyRupees"] = penalty
    lease["terminationPenaltyDirection"] = penalty_direction
    await set_doc(f"users/{landlord_id}/land_leases", lease_id, lease)

    plot = await get_doc(f"users/{landlord_id}/land_plots", lease.get("plotId", ""))
    if plot is not None:
        plot["status"] = "vacant"
        await set_doc(f"users/{landlord_id}/land_plots", lease["plotId"], plot)

    record = {
        "id": f"trm_{uuid.uuid4().hex[:12]}",
        "leaseId": lease_id,
        "landlordId": landlord_id,
        "farmerId": lease.get("tenantFarmerId"),
        "terminatedBy": terminated_by,
        "reason": body.reason,
        "terminationDate": termination_day.isoformat(),
        "penaltyRupees": penalty,
        "penaltyDirection": penalty_direction,
        "createdAt": _now(),
    }
    await set_doc(COLLECTION_TERMINATIONS, record["id"], record)

    listing_id = lease.get("listingId")
    if listing_id:
        listing = await get_doc("land_listings", listing_id)
        if listing is not None and listing.get("status") == "leased":
            listing["status"] = "open"
            await set_doc("land_listings", listing_id, listing)
        nxt = await waitlist_next(listing_id)
        if nxt is not None:
            await promote_waitlist(listing_id)

    tenant = lease.get("tenantFarmerId")
    # whoever did NOT terminate gets to rate the one who did
    if terminated_by == "landlord":
        rater, ratee = tenant, landlord_id
    else:
        rater, ratee = landlord_id, tenant
    if rater and ratee:
        await open_rating_prompt(rater, ratee, lease_id, "land_lease")
    notify_uid = tenant if (terminated_by == "landlord" and tenant) else landlord_id
    await emit_task(
        notify_uid,
        persona="farmer" if terminated_by == "landlord" else "farmLandlord",
        module="land",
        kind="lease_terminated",
        title_en="Lease terminated",
        title_hi="पट्टा समाप्त",
        subtitle=f"{terminated_by} ended the lease: {body.reason}",
        priority="urgent",
        deep_link=DEEP_LINKS["land"],
        source_id=lease_id,
    )
    await _audit(
        landlord_id,
        "LEASE_TERMINATED",
        {
            "leaseId": lease_id,
            "terminatedBy": terminated_by,
            "penaltyRupees": penalty,
            "penaltyDirection": penalty_direction,
        },
    )
    return record


@router.post("/leases/{lease_id}/handover", status_code=201)
async def record_handover(lease_id: str, body: HandoverIn, uid: str = Depends(_owner)):
    resolved = await find_lease_for_caller(uid, lease_id)
    if resolved is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    landlord_id, lease = resolved
    role = "landlord" if uid == landlord_id else "tenant"
    doc = {
        "id": f"ho_{uuid.uuid4().hex[:12]}",
        "leaseId": lease_id,
        "type": body.type,
        "checklist": [item.model_dump() for item in body.checklist],
        "notes": body.notes,
        "photos": body.photos,
        "createdBy": uid,
        "createdByRole": role,
        "createdAt": _now(),
    }
    await set_doc(COLLECTION_HANDOVERS, doc["id"], doc)
    counterparty = lease.get("tenantFarmerId") if role == "landlord" else landlord_id
    if counterparty:
        await emit_task(
            counterparty,
            persona="farmer" if role == "landlord" else "farmLandlord",
            module="land",
            kind="handover_recorded",
            title_en="Handover inspection recorded",
            title_hi="हस्तांतरण निरीक्षण दर्ज",
            subtitle=f"{body.type.replace('_', ' ')} checklist saved for your lease",
            priority="today",
            deep_link=DEEP_LINKS["land"],
            source_id=lease_id,
        )
    return doc


@router.get("/leases/{lease_id}/handover")
async def lease_handovers(lease_id: str, uid: str = Depends(_owner)):
    if await find_lease_for_caller(uid, lease_id) is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    docs = await query(COLLECTION_HANDOVERS, [("leaseId", "==", lease_id)], limit=100)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


# ---------------------------------------------------------------------------
# Profit management: plot expenses, crop-share settlements, dashboard
# ---------------------------------------------------------------------------


@router.post("/plots/{plot_id}/expenses", status_code=201)
async def add_plot_expense(plot_id: str, body: PlotExpenseIn, uid: str = Depends(_landlord)):
    plot = await _require_plot(uid, plot_id)
    expense = {
        "id": f"exp_{uuid.uuid4().hex[:12]}",
        "plotId": plot_id,
        "plotName": plot.get("name"),
        "category": body.category,
        "amountRupees": round(body.amountRupees, 2),
        "note": body.note,
        "expenseDate": body.expenseDate or date.today().isoformat(),
        "createdAt": _now(),
    }
    await set_doc(f"users/{uid}/plot_expenses", expense["id"], expense)
    await record_auto_entry(
        uid,
        "expense",
        int(round(body.amountRupees * 100)),
        "plot_maintenance",
        "plot_expense",
        expense["id"],
    )
    return expense


@router.get("/plots/{plot_id}/expenses")
async def list_plot_expenses(plot_id: str, uid: str = Depends(_landlord)):
    await _require_plot(uid, plot_id)
    expenses = [
        e
        for e in await query(f"users/{uid}/plot_expenses", [], limit=1000)
        if e.get("plotId") == plot_id
    ]
    expenses.sort(key=lambda e: e.get("expenseDate", ""), reverse=True)
    by_category: dict[str, float] = {}
    for expense in expenses:
        by_category[expense["category"]] = round(
            by_category.get(expense["category"], 0) + float(expense.get("amountRupees", 0)), 2
        )
    return {
        **_envelope(expenses),
        "summary": {
            "totalRupees": round(sum(float(e.get("amountRupees", 0)) for e in expenses), 2),
            "byCategory": by_category,
        },
    }


@router.post("/leases/{lease_id}/harvest-declarations", status_code=201)
async def declare_harvest(
    lease_id: str, body: HarvestDeclarationIn, uid: str = Depends(_farmer)
):
    resolved = await find_lease_for_caller(uid, lease_id)
    if resolved is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    landlord_id, lease = resolved
    if uid == landlord_id:
        _error(403, "FORBIDDEN_ROLE", "only the tenant farmer declares a harvest")
    if lease.get("status") != "active":
        _error(409, "LEASE_NOT_ACTIVE", "harvest can only be declared on an active lease")
    rent_model = lease.get("rentModel", "fixed")
    if rent_model not in ("cropShare", "hybrid"):
        _error(
            422,
            "NOT_CROPSHARE_LEASE",
            "harvest declarations apply to cropShare or hybrid leases only",
            {"rentModel": "cropShare | hybrid required"},
        )
    share_percent = int(lease.get("cropSharePercent") or 50)
    total_sale = round(body.yieldQuintals * body.saleRatePerQuintal, 2)
    landlord_share = round(total_sale * share_percent / 100, 2)
    decl = {
        "id": f"hd_{uuid.uuid4().hex[:12]}",
        "leaseId": lease_id,
        "landlordId": landlord_id,
        "farmerId": uid,
        "crop": body.crop,
        "season": body.season,
        "areaAcres": body.areaAcres,
        "yieldQuintals": body.yieldQuintals,
        "saleRatePerQuintal": body.saleRatePerQuintal,
        "totalSaleRupees": total_sale,
        "cropSharePercent": share_percent,
        "landlordShareRupees": landlord_share,
        "farmerShareRupees": round(total_sale - landlord_share, 2),
        "status": "declared",
        "declaredAt": _now(),
    }
    await set_doc(COLLECTION_HARVEST_DECLS, decl["id"], decl)
    await emit_task(
        landlord_id,
        persona="farmLandlord",
        module="land",
        kind="harvest_declared",
        title_en="Harvest declared on your land",
        title_hi="आपकी ज़मीन पर फसल घोषित",
        subtitle=f"{body.crop}: {body.yieldQuintals} q @ ₹{body.saleRatePerQuintal}/q — your share ₹{landlord_share}",
        priority="today",
        deep_link=DEEP_LINKS["land"],
        source_id=decl["id"],
    )
    return decl


@router.get("/leases/{lease_id}/harvest-declarations")
async def list_harvest_declarations(lease_id: str, uid: str = Depends(_owner)):
    if await find_lease_for_caller(uid, lease_id) is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    decls = await query(COLLECTION_HARVEST_DECLS, [("leaseId", "==", lease_id)], limit=100)
    decls.sort(key=lambda d: d.get("declaredAt", ""), reverse=True)
    return {"data": decls, "total": len(decls)}


@router.post("/leases/{lease_id}/harvest-declarations/{decl_id}/settle")
async def settle_harvest_declaration(
    lease_id: str, decl_id: str, uid: str = Depends(_landlord)
):
    lease = await get_doc(f"users/{uid}/land_leases", lease_id)
    if lease is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    decl = await get_doc(COLLECTION_HARVEST_DECLS, decl_id)
    if decl is None or decl.get("leaseId") != lease_id:
        _error(404, "DECLARATION_NOT_FOUND", "harvest declaration not found")
    if decl.get("status") == "settled":
        _error(409, "ALREADY_SETTLED", "declaration already settled")
    decl["status"] = "settled"
    decl["settledAt"] = _now()
    decl["settledBy"] = uid
    await set_doc(COLLECTION_HARVEST_DECLS, decl_id, decl)
    # both sides land in their P&L: landlord gets the share, the farmer books
    # the remainder as crop sale income.
    await record_auto_entry(
        uid,
        "income",
        int(round(decl["landlordShareRupees"] * 100)),
        "crop_share",
        "harvest_declaration",
        decl_id,
    )
    if decl.get("farmerId"):
        await record_auto_entry(
            decl["farmerId"],
            "income",
            int(round(decl["farmerShareRupees"] * 100)),
            "crop_sale",
            "harvest_declaration",
            decl_id,
        )
        await emit_task(
            decl["farmerId"],
            persona="farmer",
            module="land",
            kind="harvest_settled",
            title_en="Crop share settled",
            title_hi="फसल हिस्सा निपटाया गया",
            subtitle=f"{decl['crop']}: your share ₹{decl['farmerShareRupees']}",
            priority="today",
            deep_link=DEEP_LINKS["land"],
            source_id=decl_id,
        )
    await _audit(
        uid,
        "HARVEST_SETTLED",
        {"leaseId": lease_id, "declarationId": decl_id, "landlordShareRupees": decl["landlordShareRupees"]},
    )
    return decl


async def _profit_numbers(uid: str) -> dict:
    leases = await query(f"users/{uid}/land_leases", [], limit=1000)
    payments_total = 0.0
    by_lease: dict[str, dict] = {}
    months: dict[str, dict] = {}
    today = date.today()
    for delta in range(-11, 1):
        slot = today.month - 1 + delta
        key = f"{today.year + slot // 12:04d}-{slot % 12 + 1:02d}"
        months[key] = {"month": key, "rentRupees": 0.0, "shareRupees": 0.0, "expenseRupees": 0.0}

    outstanding_paisa = 0
    for lease in leases:
        entry = by_lease.setdefault(
            lease["id"],
            {
                "leaseId": lease["id"],
                "tenantName": lease.get("tenantName"),
                "status": lease.get("status"),
                "rentCollectedRupees": 0.0,
                "cropShareRupees": 0.0,
                "outstandingPaisa": 0,
            },
        )
        for payment in await query(f"users/{uid}/land_leases/{lease['id']}/payments", [], limit=300):
            amount = float(payment.get("amountRupees", 0) or 0)
            payments_total += amount
            entry["rentCollectedRupees"] += amount
            month_key = str(payment.get("month", ""))[:7]
            if month_key in months:
                months[month_key]["rentRupees"] += amount
        if lease.get("status") == "active":
            standing = await _rent_standing(uid, lease, today)
            outstanding_paisa += standing["outstandingPaisa"]
            entry["outstandingPaisa"] = standing["outstandingPaisa"]

    settled = await query(
        COLLECTION_HARVEST_DECLS, [("landlordId", "==", uid), ("status", "==", "settled")], limit=500
    )
    share_total = 0.0
    for decl in settled:
        share = float(decl.get("landlordShareRupees", 0) or 0)
        share_total += share
        if decl.get("leaseId") in by_lease:
            by_lease[decl["leaseId"]]["cropShareRupees"] += share
        month_key = str(decl.get("settledAt", ""))[:7]
        if month_key in months:
            months[month_key]["shareRupees"] += share

    expenses = await query(f"users/{uid}/plot_expenses", [], limit=1000)
    expense_total = 0.0
    for expense in expenses:
        amount = float(expense.get("amountRupees", 0) or 0)
        expense_total += amount
        month_key = str(expense.get("expenseDate", ""))[:7]
        if month_key in months:
            months[month_key]["expenseRupees"] += amount

    for row in months.values():
        row["rentRupees"] = round(row["rentRupees"], 2)
        row["shareRupees"] = round(row["shareRupees"], 2)
        row["expenseRupees"] = round(row["expenseRupees"], 2)
        row["netRupees"] = round(row["rentRupees"] + row["shareRupees"] - row["expenseRupees"], 2)
    for entry in by_lease.values():
        entry["rentCollectedRupees"] = round(entry["rentCollectedRupees"], 2)
        entry["cropShareRupees"] = round(entry["cropShareRupees"], 2)
        entry["netRupees"] = round(entry["rentCollectedRupees"] + entry["cropShareRupees"], 2)

    return {
        "income": {
            "rentCollectedRupees": round(payments_total, 2),
            "cropShareRupees": round(share_total, 2),
            "totalRupees": round(payments_total + share_total, 2),
        },
        "expensesRupees": round(expense_total, 2),
        "netProfitRupees": round(payments_total + share_total - expense_total, 2),
        "outstandingDuesPaisa": outstanding_paisa,
        "byLease": sorted(by_lease.values(), key=lambda e: e["netRupees"], reverse=True),
        "byMonth": sorted(months.values(), key=lambda m: m["month"]),
    }


@router.get("/profit-dashboard")
async def profit_dashboard(uid: str = Depends(_landlord)):
    """Landlord profit view: rent + crop-share income, plot expenses, dues."""
    numbers = await _profit_numbers(uid)
    return {"landlordId": uid, "generatedAt": _now(), **numbers}


@router.get("/profit-dashboard/export")
async def profit_dashboard_export(format: str = "csv", uid: str = Depends(_landlord)):
    if format != "csv":
        _error(422, "VALIDATION_ERROR", "format must be csv", {"format": "csv"})
    numbers = await _profit_numbers(uid)

    def _num(value: float) -> str:
        return f"{value:g}"

    lines = ["month,rentRupees,cropShareRupees,expenseRupees,netRupees"]
    for row in numbers["byMonth"]:
        lines.append(
            f"{row['month']},{_num(row['rentRupees'])},{_num(row['shareRupees'])},"
            f"{_num(row['expenseRupees'])},{_num(row['netRupees'])}"
        )
    lines.append(
        f"TOTAL,{_num(numbers['income']['rentCollectedRupees'])},"
        f"{_num(numbers['income']['cropShareRupees'])},"
        f"{_num(numbers['expensesRupees'])},{_num(numbers['netProfitRupees'])}"
    )
    return Response(
        content="\n".join(lines) + "\n",
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="land-profit-dashboard.csv"'},
    )


# ---------------------------------------------------------------------------
# Two-sided land reviews
# ---------------------------------------------------------------------------


@router.post("/listings/{listing_id}/reviews", status_code=201)
async def review_listing(
    listing_id: str, body: LandReviewIn, uid: str = Depends(_farmer)
):
    listing = await _require_listing(listing_id)
    accepted = await query(
        "lease_requests",
        [("listingId", "==", listing_id), ("farmerId", "==", uid), ("status", "==", "accepted")],
        limit=1,
    )
    if not accepted:
        _error(
            409,
            "REVIEW_NOT_ALLOWED",
            "only a farmer with an accepted lease on this land can review it",
        )
    existing = await query(
        COLLECTION_REVIEWS, [("listingId", "==", listing_id), ("farmerId", "==", uid)], limit=1
    )
    if existing:
        _error(409, "ALREADY_REVIEWED", "you have already reviewed this land")
    aspects: dict[str, int] = {}
    for aspect, value in (body.aspects or {}).items():
        if aspect not in LAND_REVIEW_ASPECTS or not (1 <= int(value) <= 5):
            _error(
                422,
                "VALIDATION_ERROR",
                f"aspects must be one of {LAND_REVIEW_ASPECTS} with values 1-5",
                {"aspects": f"{aspect} invalid"},
            )
        aspects[aspect] = int(value)
    if body.comment:
        scan_result = moderation_scan(body.comment)
        if scan_result["violation"]:
            _error(422, "REVIEW_TEXT_BLOCKED", "review text contains a blocked pattern")
    review = {
        "id": f"lr_{uuid.uuid4().hex[:12]}",
        "listingId": listing_id,
        "landlordId": listing.get("landlordId"),
        "farmerId": uid,
        "stars": body.stars,
        "aspects": aspects,
        "comment": body.comment,
        "createdAt": _now(),
    }
    await set_doc(COLLECTION_REVIEWS, review["id"], review)
    return review


@router.get("/listings/{listing_id}/reviews")
async def listing_reviews(listing_id: str, uid: str = Depends(_owner)):
    await _require_listing(listing_id)
    reviews = await query(COLLECTION_REVIEWS, [("listingId", "==", listing_id)], limit=500)
    reviews.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    for review in reviews:
        farmer = await get_doc("users", review.get("farmerId", "")) or {}
        review["farmerName"] = farmer.get("name", "")
    return {**_envelope(reviews), "aggregate": await _review_aggregate(listing_id)}
