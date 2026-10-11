"""Land CRM shared helpers (extension-2026-10-11).

Used by both the classic `land` router and the `land_ops` extension router so
lead capture, waitlist promotion and tenant-side lease lookup behave identically
no matter which entry point triggered them.
"""
from datetime import date, datetime, timezone

from app.core.db import get_doc, query, set_doc
from app.services.tasks import DEEP_LINKS, emit_task
from app.services.users import get_user

LEAD_TYPES = ("view", "save", "application", "waitlist")
LEAD_STATUSES = ("new", "contacted", "negotiating", "converted", "dropped")

COLLECTION_LEADS = "land_leads"
COLLECTION_WAITLIST = "land_waitlist"
COLLECTION_SAVES = "land_saves"
COLLECTION_TERMINATIONS = "lease_terminations"
COLLECTION_RENEWALS = "lease_renewals"
COLLECTION_HANDOVERS = "lease_handovers"
COLLECTION_HARVEST_DECLS = "harvest_declarations"
COLLECTION_REVIEWS = "land_reviews"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def upsert_lead(
    landlord_id: str,
    listing_id: str,
    farmer_id: str,
    farmer_name: str,
    lead_type: str,
) -> dict:
    """Idempotently record a farmer touch on a listing as a landlord lead.

    A re-touch resurrects a dropped lead back to `new` so it resurfaces in the
    inbox, but never disturbs an in-progress (contacted/negotiating/converted)
    pipeline stage.
    """
    existing = await query(
        COLLECTION_LEADS,
        [("listingId", "==", listing_id), ("farmerId", "==", farmer_id), ("type", "==", lead_type)],
        limit=1,
    )
    if existing:
        lead = existing[0]
        if lead.get("status") == "dropped":
            lead["status"] = "new"
        lead["updatedAt"] = _now()
        await set_doc(COLLECTION_LEADS, lead["id"], lead)
        return lead
    from uuid import uuid4

    lead_id = f"lead_{uuid4().hex[:12]}"
    lead = {
        "id": lead_id,
        "landlordId": landlord_id,
        "listingId": listing_id,
        "farmerId": farmer_id,
        "farmerName": farmer_name,
        "type": lead_type,
        "status": "new",
        "notes": [],
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await set_doc(COLLECTION_LEADS, lead_id, lead)
    return lead


async def convert_lead(landlord_id: str, listing_id: str, farmer_id: str) -> None:
    """Mark the farmer's application lead as converted when a lease is signed."""
    existing = await query(
        COLLECTION_LEADS,
        [("listingId", "==", listing_id), ("farmerId", "==", farmer_id), ("type", "==", "application")],
        limit=1,
    )
    if existing:
        lead = existing[0]
        lead["status"] = "converted"
        lead["updatedAt"] = _now()
        await set_doc(COLLECTION_LEADS, lead["id"], lead)


async def waitlist_next(listing_id: str) -> dict | None:
    waiting = [
        w
        for w in await query(
            COLLECTION_WAITLIST, [("listingId", "==", listing_id), ("status", "==", "waiting")], limit=500
        )
    ]
    if not waiting:
        return None
    waiting.sort(key=lambda w: (int(w.get("position") or 0), w.get("createdAt", "")))
    return waiting[0]


async def promote_waitlist(listing_id: str) -> dict | None:
    """Offer the next waiting farmer first right of refusal on a freed listing."""
    nxt = await waitlist_next(listing_id)
    if nxt is None:
        return None
    nxt["status"] = "offered"
    nxt["updatedAt"] = _now()
    await set_doc(COLLECTION_WAITLIST, nxt["id"], nxt)
    await emit_task(
        nxt["farmerId"],
        persona="farmer",
        module="land",
        kind="waitlist_offer",
        title_en="Your waitlisted land is available",
        title_hi="आपकी प्रतीक्षा सूची की ज़मीन उपलब्ध है",
        subtitle="A plot you waited for is free again — apply before it goes",
        priority="today",
        deep_link=DEEP_LINKS["land"],
        source_id=listing_id,
    )
    return nxt


async def find_lease_for_caller(caller_uid: str, lease_id: str) -> tuple[str, dict] | None:
    """Resolve a lease for the landlord who owns it or the farmer who rents it.

    Returns (landlord_uid, lease_doc) or None. Farmers are matched by
    tenantFarmerId (set at lease-request accept time) with a phone fallback so
    legacy phone-only leases stay reachable.
    """
    lease = await get_doc(f"users/{caller_uid}/land_leases", lease_id)
    if lease is not None:
        return caller_uid, lease
    caller = await get_user(caller_uid) or {}
    caller_phone = caller.get("phone", "")
    for other in await query("users", [], limit=1000):
        if other.get("id") == caller_uid:
            continue
        candidate = await get_doc(f"users/{other['id']}/land_leases", lease_id)
        if candidate is None:
            continue
        if candidate.get("tenantFarmerId") == caller_uid:
            return other["id"], candidate
        if caller_phone and candidate.get("tenantPhone") == caller_phone:
            return other["id"], candidate
    return None


def months_elapsed_unpaid(lease: dict, today: date) -> list[dict]:
    """Per-month rent standing from lease start through `today` (inclusive).

    Mirrors the pending-months logic of GET /land/leases/{id}/payments but
    returns amounts too: [{month, duePaisa, paidPaisa, status}] where status is
    paid | partial | due. Caller supplies the month ledger docs.
    """
    start = str(lease.get("startDate") or "")[:7]
    if len(start) != 7:
        return []
    year, month = int(start[:4]), int(start[5:7])
    current = today.strftime("%Y-%m")
    due_paisa = int(round(float(lease.get("monthlyRentRupees", 0) or 0) * 100))
    rows: list[dict] = []
    while True:
        ym = f"{year:04d}-{month:02d}"
        if ym > current:
            break
        rows.append({"month": ym, "duePaisa": due_paisa, "paidPaisa": 0, "status": "due"})
        month += 1
        if month > 12:
            month = 1
            year += 1
    return rows
