import asyncio
from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.core.config import settings
from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.data.cold_storage_seed import seed_cold_storage
from app.models.cold_storage import (
    BookingReviewIn,
    ColdStorageApplyIn,
    ColdStorageBookIn,
    ColdStorageProviderStats,
    CreateChamberIn,
    CreateFacilityIn,
    GateInwardIn,
    GateReleaseIn,
    ReleaseRequestIn,
    WarehouseReceipt,
)
from app.routers.users import require_role
from app.services import storage
from app.services.ai import gateway
from app.services.billing import check_entitlement
from app.services.fcm import send_fcm_to_user
from app.services.grading_model import get_grading_adapter
from app.services.grading_model.gemini import GRADING_MODULE
from app.services.tasks import emit_task
from app.services.users import get_user

router = APIRouter(prefix="/post-harvest", tags=["post-harvest"])

MAX_GRADE_IMAGES = 3
GRADING_HUMAN_THRESHOLD = 0.7
PROVIDER_ROLES = {"coldStorageProvider", "admin"}
FARMER_ROLES = {"farmer", "farmLandlord", "seller", "transport", "transporter", "coldStorageProvider", "admin"}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _require_user(*roles: str):
    async def dep(uid: str = Depends(current_user_id)) -> dict:
        user = await get_user(uid)
        if user is None:
            _error(404, "NOT_FOUND", "user not found")
        require_role(user, *roles)
        return user

    return dep


def _require_storage_provider():
    async def dep(uid: str = Depends(current_user_id)) -> dict:
        user = await get_user(uid)
        if user is None:
            _error(404, "NOT_FOUND", "user not found")
        active = user.get("activeProfile")
        profiles = set(user.get("linkedProfiles") or [])
        if active in PROVIDER_ROLES or bool(profiles & PROVIDER_ROLES):
            return user
        _error(403, "FORBIDDEN_COLD_STORAGE", "केवल कोल्ड स्टोरेज/गोदाम संचालक ही यह कार्रवाई कर सकते हैं")

    return dep


# ==============================================================================
# Tiers — cold-storage provider console (WS-05 task 5.15)
# ==============================================================================
# Pro = ₹1,999/mo per facility; Free = one facility, read-only (all console
# WRITE endpoints return the 402 ENTITLEMENT_EXCEEDED envelope). Farmer booking
# and receipt endpoints carry NO entitlement check. Per-booking platform fee is
# ledgered on release (integer paisa).
CONSOLE_WRITE_FEATURE = "providerConsoleWrites"
COLD_STORAGE_BOOKING_FEE_PAISA = 5000  # ₹50 per released booking

_COLD_STORAGE_PLAN_ROWS = [
    {
        "planId": "coldStorageProvider_free",
        "persona": "coldStorageProvider",
        "tier": "free",
        "priceMonthlyPaisa": 0,
        "limits": {CONSOLE_WRITE_FEATURE: 0},
        "commission": "per-booking platform fee",
        "features": [],
    },
    {
        "planId": "coldStorageProvider_pro",
        "persona": "coldStorageProvider",
        "tier": "pro",
        "priceMonthlyPaisa": 199900,
        "limits": {CONSOLE_WRITE_FEATURE: 999, "facilities": 50},
        "commission": "per-booking platform fee",
        "features": ["multiFacility", "chamberManagement", "utilizationAnalytics"],
    },
]


async def _ensure_cold_storage_plans() -> None:
    """Idempotently register the cold-storage provider plans (Free/Pro)."""
    for row in _COLD_STORAGE_PLAN_ROWS:
        if await get_doc("plans", row["planId"]) is None:
            await set_doc("plans", row["planId"], dict(row))


async def _require_console_write(uid: str = Depends(current_user_id)) -> dict:
    """Pro-tier gate for console writes; Free providers get 402 + upgrade payload.

    NOTE (report): the billing.py plan rows this needs are owned by services/
    billing.py, which WS-05 must not edit. `_ensure_cold_storage_plans` seeds the
    two rows so `check_entitlement` can enforce the wall now; once billing.py
    carries `coldStorageProvider_free`/`_pro` this can become
    `require_entitlement("coldStorageProvider", CONSOLE_WRITE_FEATURE)`.
    """
    await _ensure_cold_storage_plans()
    return await check_entitlement(uid, "coldStorageProvider", CONSOLE_WRITE_FEATURE)


class GateInwardPhotoIn(GateInwardIn):
    """Gate inward body + an optional photo (data-URL string; JSON handler)."""

    photo: str | None = None


def _shape_facility(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "ownerUid": doc.get("ownerUid"),
        "distanceKm": doc.get("distanceKm", 0.0),
        "tempRange": doc.get("tempRange", "2-8°C"),
        "availableMT": round(doc["availableMT"] - doc.get("bookedQuintals", 0) / 10, 1),
        "ratePerQuintalMonth": doc["ratePerQuintalMonth"],
        "facilityType": doc.get("facilityType", "cold_storage"),
        "managerName": doc.get("managerName"),
        "contactPhone": doc.get("contactPhone"),
        "address": doc.get("address"),
        "district": doc.get("district", "Nashik"),
        "state": doc.get("state", "Maharashtra"),
        "wdraRegistered": doc.get("wdraRegistered", True),
        "wdraRegNo": doc.get("wdraRegNo"),
        "supportedCrops": doc.get("supportedCrops", ["Onion", "Potato", "Apple", "Grapes", "Wheat", "Paddy"]),
        "chambers": doc.get("chambers", []),
        "totalCapacityMT": doc.get("totalCapacityMT", doc.get("availableMT", 50.0)),
        "bookedQuintals": doc.get("bookedQuintals", 0),
    }


# ==============================================================================
# Chamber capacity reservation (atomic — F11)
# ==============================================================================
# The read-check-write below is serialized per facility so two concurrent
# bookings can never oversell a chamber. In production this maps to a Firestore
# transaction; the in-process lock is the equivalent guard for the async worker.
_capacity_locks: dict[str, asyncio.Lock] = {}


def _capacity_lock(facility_id: str) -> asyncio.Lock:
    lock = _capacity_locks.get(facility_id)
    if lock is None:
        lock = asyncio.Lock()
        _capacity_locks[facility_id] = lock
    return lock


async def _reserve_capacity(facility_id: str, quantity_quintals: float) -> dict:
    """Atomically reserve `quantity_quintals` against the facility's free space.

    404 when the facility is unknown, 409 when capacity is insufficient. Returns
    the updated facility doc (bookedQuintals already incremented).
    """
    async with _capacity_lock(facility_id):
        facility = await get_doc("cold_storage", facility_id)
        if facility is None:
            _error(404, "STORAGE_NOT_FOUND", "कोल्ड स्टोरेज नहीं मिला")
        available_quintals = facility["availableMT"] * 10 - facility.get("bookedQuintals", 0)
        if quantity_quintals > available_quintals:
            _error(409, "INSUFFICIENT_CAPACITY", "इतनी क्षमता उपलब्ध नहीं")
        facility["bookedQuintals"] = facility.get("bookedQuintals", 0) + quantity_quintals
        await set_doc("cold_storage", facility_id, facility)
        return facility


# ==============================================================================
# Farmer & Public Endpoints
# ==============================================================================


@router.get("/cold-storage")
async def list_cold_storage(
    lat: float | None = None,
    lng: float | None = None,
    user: dict = Depends(_require_user("farmer", "transport", "seller", "coldStorageProvider")),
):
    await seed_cold_storage()
    facilities = await query("cold_storage", [], limit=100)
    items = [_shape_facility(f) for f in facilities]
    items.sort(key=lambda i: i["distanceKm"])
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.get("/cold-storage/{facility_id}")
async def get_cold_storage_detail(
    facility_id: str,
    user: dict = Depends(_require_user("farmer", "transport", "seller", "coldStorageProvider")),
):
    await seed_cold_storage()
    facility = await get_doc("cold_storage", facility_id)
    if facility is None:
        _error(404, "STORAGE_NOT_FOUND", "कोल्ड स्टोरेज नहीं मिला")
    return _shape_facility(facility)


@router.post("/cold-storage/{facility_id}/book", status_code=201)
async def book_cold_storage(
    facility_id: str,
    body: ColdStorageBookIn,
    user: dict = Depends(_require_user("farmer")),
):
    if date.fromisoformat(body.fromDate) < date.today():
        _error(422, "PAST_DATE", "आरंभ तिथि भूतकाल में नहीं हो सकती")
    await seed_cold_storage()
    facility = await _reserve_capacity(facility_id, body.quantityQuintals)

    rate = facility.get("ratePerQuintalMonth", 12.0)
    now_iso = datetime.now(timezone.utc).isoformat()
    booking = {
        "id": uuid4().hex,
        "facilityId": facility_id,
        "facilityName": facility["name"],
        "farmerUid": user["id"],
        "farmerName": user.get("name") or user.get("vernacularName") or "किसान",
        "farmerPhone": user.get("phone") or "",
        "cropName": "General Produce",
        "quantityQuintals": body.quantityQuintals,
        "fromDate": body.fromDate,
        "months": body.months,
        "packagingType": "Jute Bags",
        "bagsCount": int(body.quantityQuintals * 2),
        "ratePerQuintalMonth": rate,
        "estimatedMonthlyRent": round(body.quantityQuintals * rate, 2),
        "totalEstimatedRent": round(body.quantityQuintals * body.months * rate, 2),
        "status": "booked",
        "bookedAt": now_iso,
        "timeline": [
            {
                "status": "booked",
                "title": "आरक्षण दर्ज (Booking Requested)",
                "description": f"{body.quantityQuintals} क्विंटल क्षमता आरक्षित की गई",
                "timestamp": now_iso,
            }
        ],
    }
    # Write to both top-level collection and user subcollection
    await set_doc("cold_storage_bookings", booking["id"], booking)
    await set_doc(f"users/{user['id']}/cold_storage_bookings", booking["id"], booking)
    return booking


@router.post("/cold-storage/{facility_id}/apply", status_code=201)
async def apply_cold_storage(
    facility_id: str,
    body: ColdStorageApplyIn,
    user: dict = Depends(_require_user("farmer", "seller", "farmLandlord")),
):
    if date.fromisoformat(body.fromDate) < date.today():
        _error(422, "PAST_DATE", "आरंभ तिथि भूतकाल में नहीं हो सकती")
    await seed_cold_storage()
    facility = await _reserve_capacity(facility_id, body.quantityQuintals)

    rate = facility.get("ratePerQuintalMonth", 12.0)
    now_iso = datetime.now(timezone.utc).isoformat()
    booking = {
        "id": uuid4().hex,
        "facilityId": facility_id,
        "facilityName": facility["name"],
        "farmerUid": user["id"],
        "farmerName": user.get("name") or user.get("vernacularName") or "किसान",
        "farmerPhone": user.get("phone") or "",
        "cropName": body.cropName,
        "variety": body.variety,
        "quantityQuintals": body.quantityQuintals,
        "fromDate": body.fromDate,
        "months": body.months,
        "packagingType": body.packagingType,
        "bagsCount": body.bagsCount or int(body.quantityQuintals * 2),
        "notes": body.notes,
        "estimatedValueRupees": body.estimatedValueRupees,
        "requestedChamberType": body.requestedChamberType,
        "ratePerQuintalMonth": rate,
        "estimatedMonthlyRent": round(body.quantityQuintals * rate, 2),
        "totalEstimatedRent": round(body.quantityQuintals * body.months * rate, 2),
        "status": "pending",
        "bookedAt": now_iso,
        "timeline": [
            {
                "status": "pending",
                "title": "भंडारण आवेदन प्रस्तुत (Application Submitted)",
                "description": f"{body.quantityQuintals} क्विंटल {body.cropName} के लिए आवेदन भेजा गया।",
                "timestamp": now_iso,
            }
        ],
    }
    await set_doc("cold_storage_bookings", booking["id"], booking)
    await set_doc(f"users/{user['id']}/cold_storage_bookings", booking["id"], booking)
    return booking


@router.get("/bookings/{booking_id}")
async def get_booking_detail(
    booking_id: str,
    user: dict = Depends(_require_user("farmer", "transport", "seller", "coldStorageProvider")),
):
    booking = await get_doc("cold_storage_bookings", booking_id)
    if booking is None:
        booking = await get_doc(f"users/{user['id']}/cold_storage_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "बुकिंग नहीं मिली")
    return booking


@router.post("/bookings/{booking_id}/request-release")
async def request_booking_release(
    booking_id: str,
    body: ReleaseRequestIn,
    user: dict = Depends(_require_user("farmer", "seller")),
):
    booking = await get_doc("cold_storage_bookings", booking_id)
    if booking is None:
        booking = await get_doc(f"users/{user['id']}/cold_storage_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "बुकिंग नहीं मिली")

    current_qty = booking.get("inwardNetQuintals") or booking["quantityQuintals"]
    released_qty = booking.get("outwardReleasedQuintals", 0.0)
    available_to_release = current_qty - released_qty
    if body.requestedQuintals > available_to_release:
        _error(400, "EXCEEDS_STORED_QUANTITY", f"अधिकतम निकासी उपलब्ध: {available_to_release} क्विंटल")

    now_iso = datetime.now(timezone.utc).isoformat()
    booking["status"] = "release_requested"
    booking["releaseRequest"] = {
        "requestedQuintals": body.requestedQuintals,
        "pickupDate": body.pickupDate,
        "vehicleNumber": body.vehicleNumber,
        "notes": body.notes,
        "requestedAt": now_iso,
    }
    timeline = booking.get("timeline", [])
    timeline.append({
        "status": "release_requested",
        "title": "उपज निकासी अनुरोध (Release Requested)",
        "description": f"{body.requestedQuintals} क्विंटल उपज निकासी हेतु अनुरोध भेजा गया (तिथि: {body.pickupDate})",
        "timestamp": now_iso,
    })
    booking["timeline"] = timeline

    await set_doc("cold_storage_bookings", booking_id, booking)
    farmer_uid = booking.get("farmerUid") or user["id"]
    await set_doc(f"users/{farmer_uid}/cold_storage_bookings", booking_id, booking)
    return booking


@router.get("/receipts")
async def list_my_receipts(
    user: dict = Depends(_require_user("farmer", "seller", "coldStorageProvider")),
):
    """The caller's own warehouse receipts (e-NWR) — vault feed (WS-06 §7.14).

    Scoped to the farmer's own bookings subcollection; the depositor is the only
    reader here (the single-receipt endpoint additionally serves the provider).
    """
    bookings = await query(f"users/{user['id']}/cold_storage_bookings", [], limit=500)
    receipts = []
    for booking in bookings:
        number = booking.get("receiptNumber")
        if not number:
            continue
        receipt = await get_doc("warehouse_receipts", number)
        if receipt is not None:
            receipts.append(receipt)
    receipts.sort(key=lambda r: r.get("issueDate") or "", reverse=True)
    return {"data": receipts, "page": 1, "pageSize": 50, "total": len(receipts)}


@router.get("/receipts/{receipt_number}")
async def get_warehouse_receipt(
    receipt_number: str,
    user: dict = Depends(_require_user("farmer", "seller", "coldStorageProvider")),
):
    receipt = await get_doc("warehouse_receipts", receipt_number)
    if receipt is None:
        _error(404, "RECEIPT_NOT_FOUND", "गोदाम रसीद (e-NWR) नहीं मिली")
    # Owner-only: the depositor (booking.farmerUid) and the receipt's facility
    # provider (facility.ownerUid). Anyone else gets the same 404 so the
    # endpoint never leaks that a receipt number exists (WS-05 task 5.16).
    booking = await get_doc("cold_storage_bookings", receipt.get("bookingId") or "")
    facility = await get_doc("cold_storage", receipt.get("facilityId") or "")
    owner_uid = (booking or {}).get("farmerUid")
    provider_uid = (facility or {}).get("ownerUid")
    if user["id"] != owner_uid and user["id"] != provider_uid:
        _error(404, "RECEIPT_NOT_FOUND", "गोदाम रसीद (e-NWR) नहीं मिली")
    return receipt


# ==============================================================================
# Cold Storage & Godown Provider Workspace Endpoints
# ==============================================================================


@router.get("/provider/stats", response_model=ColdStorageProviderStats)
async def get_provider_stats(
    provider: dict = Depends(_require_storage_provider()),
):
    await seed_cold_storage()
    facilities = await query("cold_storage", [], limit=100)
    bookings = await query("cold_storage_bookings", [], limit=1000)

    total_cap = sum(f.get("availableMT", 0.0) for f in facilities)
    total_booked_q = sum(f.get("bookedQuintals", 0.0) for f in facilities)
    occupied_mt = round(total_booked_q / 10.0, 1)
    available_mt = round(max(0.0, total_cap - occupied_mt), 1)
    occupancy_pct = round((occupied_mt / total_cap * 100.0) if total_cap > 0 else 0.0, 1)

    pending_count = sum(1 for b in bookings if b.get("status") in {"pending", "booked"})
    active_inwarded = sum(1 for b in bookings if b.get("status") in {"inwarded", "release_requested", "partially_released"})
    unique_farmers = len({b.get("farmerUid") for b in bookings if b.get("farmerUid")})

    total_rent = sum(b.get("totalEstimatedRent", 0.0) for b in bookings if b.get("status") in {"approved", "inwarded", "released"})
    total_valuation = sum(b.get("valuationRupees", 0.0) or b.get("estimatedValueRupees", 0.0) or 0.0 for b in bookings if b.get("status") in {"inwarded", "release_requested"})

    return ColdStorageProviderStats(
        totalCapacityMT=total_cap,
        occupiedMT=occupied_mt,
        availableMT=available_mt,
        occupancyPercent=occupancy_pct,
        pendingBookingsCount=pending_count,
        activeStoredLotsCount=active_inwarded,
        totalFarmersCount=unique_farmers or 4,
        totalAccruedRent=round(total_rent, 2),
        totalValuationStored=round(total_valuation, 2),
    )


@router.get("/provider/bookings")
async def provider_list_bookings(
    status: str | None = Query(None),
    q: str | None = Query(None),
    facilityId: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    provider: dict = Depends(_require_storage_provider()),
):
    filters = []
    if status and status != "all":
        filters.append(("status", "==", status))
    if facilityId:
        filters.append(("facilityId", "==", facilityId))

    docs = await query("cold_storage_bookings", filters, limit=500)
    if q:
        q_lower = q.lower()
        docs = [
            d
            for d in docs
            if q_lower in str(d.get("farmerName", "")).lower()
            or q_lower in str(d.get("cropName", "")).lower()
            or q_lower in str(d.get("facilityName", "")).lower()
            or q_lower in str(d.get("receiptNumber", "")).lower()
        ]

    docs.sort(key=lambda d: d.get("bookedAt") or "", reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    end = start + pageSize
    return {"data": docs[start:end], "page": page, "pageSize": pageSize, "total": total}


@router.get("/provider/bookings/{booking_id}")
async def provider_get_booking(
    booking_id: str,
    provider: dict = Depends(_require_storage_provider()),
):
    booking = await get_doc("cold_storage_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "बुकिंग नहीं मिली")
    return booking


@router.post("/provider/bookings/{booking_id}/review")
async def provider_review_booking(
    booking_id: str,
    body: BookingReviewIn,
    provider: dict = Depends(_require_storage_provider()),
    _entitlement: dict = Depends(_require_console_write),
):
    booking = await get_doc("cold_storage_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "बुकिंग नहीं मिली")

    now_iso = datetime.now(timezone.utc).isoformat()
    farmer_uid = booking.get("farmerUid")
    facility_id = booking.get("facilityId")
    facility = await get_doc("cold_storage", facility_id)

    timeline = booking.get("timeline", [])

    if body.action == "approve":
        booking["status"] = "approved"
        booking["reviewedAt"] = now_iso
        booking["reviewedBy"] = provider["id"]
        booking["allocatedChamberId"] = body.allocatedChamberId or "ch-101"
        booking["allocatedChamberName"] = "Chamber A (Approved)"
        booking["providerNotes"] = body.notes or "आरक्षण स्वीकृत किया गया। कृपया निर्धारित तिथि पर उपज लाएं।"
        timeline.append({
            "status": "approved",
            "title": "आरक्षण स्वीकृत (Booking Confirmed)",
            "description": f"गोदाम संचालक द्वारा आरक्षण स्वीकृत। कक्ष: {booking['allocatedChamberName']}",
            "timestamp": now_iso,
        })
        if farmer_uid:
            try:
                await send_fcm_to_user(
                    farmer_uid,
                    "गोदाम आरक्षण स्वीकृत! 📦",
                    f"{booking.get('facilityName')} में {booking.get('quantityQuintals')} क्विंटल {booking.get('cropName')} का आरक्षण स्वीकृत हो गया है।",
                    {"channel": "coldStorage", "bookingId": booking_id},
                )
            except Exception:
                pass
    elif body.action == "reject":
        if not body.rejectionReason:
            _error(422, "REASON_REQUIRED", "अस्वीकृति का कारण आवश्यक है")
        booking["status"] = "rejected"
        booking["reviewedAt"] = now_iso
        booking["reviewedBy"] = provider["id"]
        booking["rejectionReason"] = body.rejectionReason
        booking["providerNotes"] = body.notes

        # Restore booked capacity back to facility
        if facility:
            facility["bookedQuintals"] = max(0, facility.get("bookedQuintals", 0) - booking.get("quantityQuintals", 0))
            await set_doc("cold_storage", facility_id, facility)

        timeline.append({
            "status": "rejected",
            "title": "आरक्षण अस्वीकृत (Booking Rejected)",
            "description": f"कारण: {body.rejectionReason}",
            "timestamp": now_iso,
        })
        if farmer_uid:
            try:
                await send_fcm_to_user(
                    farmer_uid,
                    "गोदाम आरक्षण अस्वीकृत",
                    f"{booking.get('facilityName')} में आरक्षण अस्वीकृत: {body.rejectionReason}",
                    {"channel": "coldStorage", "bookingId": booking_id},
                )
            except Exception:
                pass

    booking["timeline"] = timeline
    await set_doc("cold_storage_bookings", booking_id, booking)
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/cold_storage_bookings", booking_id, booking)

    # Rule 3/8: every provider decision writes audit_logs with actor + reason.
    audit_id = f"aud_coldstorage_review_{booking_id}_{now_iso}"
    await set_doc(
        "audit_logs",
        audit_id,
        {
            "id": audit_id,
            "actor": provider["id"],
            "action": "COLD_STORAGE_BOOKING_REVIEW",
            "bookingId": booking_id,
            "facilityId": facility_id,
            "decision": body.action,
            "reason": body.rejectionReason if body.action == "reject" else body.notes,
            "timestamp": now_iso,
        },
    )
    return booking


@router.post("/provider/bookings/{booking_id}/inward")
async def provider_gate_inward(
    booking_id: str,
    body: GateInwardPhotoIn,
    provider: dict = Depends(_require_storage_provider()),
    _entitlement: dict = Depends(_require_console_write),
):
    booking = await get_doc("cold_storage_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "बुकिंग नहीं मिली")

    facility_id = booking.get("facilityId", "cs-1")
    facility = await get_doc("cold_storage", facility_id) or {}

    now_iso = datetime.now(timezone.utc).isoformat()
    farmer_uid = booking.get("farmerUid")

    chamber_id = body.chamberId or booking.get("allocatedChamberId") or "ch-101"
    lot_number = body.lotNumber or f"LOT-{datetime.now().year}-{chamber_id[-3:].upper()}-{uuid4().hex[:4].upper()}"
    receipt_number = f"NWR-{datetime.now().year}-{facility_id.replace('-', '').upper()}-{uuid4().hex[:6].upper()}"

    valuation = body.valuationRupees or round(body.netQuintals * 2200.0, 2)

    booking["status"] = "inwarded"
    booking["chamberId"] = chamber_id
    booking["allocatedChamberName"] = f"Chamber {chamber_id[-3:].upper()}"
    booking["lotNumber"] = lot_number
    booking["inwardGrossWeightKg"] = body.grossWeightKg
    booking["inwardTareWeightKg"] = body.tareWeightKg
    booking["inwardNetQuintals"] = body.netQuintals
    booking["inwardBags"] = body.actualBags
    booking["inwardDate"] = now_iso
    booking["moisturePercent"] = body.moisturePercent
    booking["qcGrade"] = body.qcGrade
    booking["inwardPhoto"] = body.photo
    booking["receiptNumber"] = receipt_number
    booking["valuationRupees"] = valuation
    booking["outwardReleasedQuintals"] = 0.0
    booking["remainingQuintals"] = body.netQuintals

    timeline = booking.get("timeline", [])
    timeline.append({
        "status": "inwarded",
        "title": "गेट आवक व e-NWR रसीद जारी (Gate Inward & e-NWR Issued)",
        "description": f"{body.netQuintals} क्विंटल ({body.actualBags} बोरी) आवक दर्ज। ग्रेड: {body.qcGrade}, लॉट: {lot_number}, e-NWR: {receipt_number}",
        "timestamp": now_iso,
    })
    booking["timeline"] = timeline

    # Create official Electronic Negotiable Warehouse Receipt (e-NWR)
    receipt_doc = WarehouseReceipt(
        receiptNumber=receipt_number,
        bookingId=booking_id,
        facilityId=facility_id,
        facilityName=booking.get("facilityName", "Cold Storage"),
        wdraRegNo=facility.get("wdraRegNo", "WDRA/MH/2026/044"),
        depositorName=booking.get("farmerName", "किसान"),
        depositorPhone=booking.get("farmerPhone", ""),
        cropName=booking.get("cropName", "Produce"),
        variety=booking.get("variety"),
        netQuintals=body.netQuintals,
        bagsCount=body.actualBags,
        qcGrade=body.qcGrade,
        moisturePercent=body.moisturePercent,
        chamberName=booking["allocatedChamberName"],
        lotNumber=lot_number,
        valuationRupees=valuation,
        issueDate=now_iso,
        pledgeFinancingEligible=True,
        status="active",
    ).model_dump()
    await set_doc("warehouse_receipts", receipt_number, receipt_doc)

    await set_doc("cold_storage_bookings", booking_id, booking)
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/cold_storage_bookings", booking_id, booking)
        try:
            await send_fcm_to_user(
                farmer_uid,
                "गोदाम रसीद जारी (e-NWR)! 📜",
                f"लॉट {lot_number} के लिए e-NWR रसीद {receipt_number} जारी कर दी गई है। सुरक्षित भंडारण आरंभ।",
                {"channel": "coldStorage", "receiptNumber": receipt_number},
            )
        except Exception:
            pass

    return {
        "booking": booking,
        "receipt": receipt_doc,
    }


@router.post("/provider/bookings/{booking_id}/release")
async def provider_gate_release(
    booking_id: str,
    body: GateReleaseIn,
    provider: dict = Depends(_require_storage_provider()),
    _entitlement: dict = Depends(_require_console_write),
):
    booking = await get_doc("cold_storage_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "बुकिंग नहीं मिली")

    stored_net = booking.get("inwardNetQuintals") or booking.get("quantityQuintals", 0.0)
    current_released = booking.get("outwardReleasedQuintals", 0.0)
    new_released = current_released + body.releaseQuintals

    if new_released > stored_net:
        _error(400, "EXCEEDS_QUANTITY", f"निकासी मात्रा कुल जमा मात्रा ({stored_net} क्विंटल) से अधिक नहीं हो सकती")

    remaining = round(stored_net - new_released, 2)
    gate_pass_no = f"GP-{datetime.now().year}-{uuid4().hex[:6].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    booking["outwardReleasedQuintals"] = new_released
    booking["remainingQuintals"] = remaining
    booking["gatePassNumber"] = gate_pass_no
    booking["outwardDate"] = now_iso
    booking["rentPaid"] = booking.get("rentPaid", 0.0) + (body.amountPaid or 0.0)
    booking["paymentStatus"] = "paid" if remaining == 0.0 else "partially_paid"
    booking["status"] = "released" if remaining == 0.0 else "partially_released"

    timeline = booking.get("timeline", [])
    timeline.append({
        "status": booking["status"],
        "title": "गेट पास जारी व निकासी (Gate Pass & Release)",
        "description": f"{body.releaseQuintals} क्विंटल उपज निकाली गई। गेट पास: {gate_pass_no} (वाहन: {body.vehicleNumber or 'N/A'}). शेष साठा: {remaining} क्विंटल।",
        "timestamp": now_iso,
    })
    booking["timeline"] = timeline

    # Release booked capacity from facility
    facility_id = booking.get("facilityId")
    facility = await get_doc("cold_storage", facility_id)
    if facility:
        facility["bookedQuintals"] = max(0, facility.get("bookedQuintals", 0) - body.releaseQuintals)
        await set_doc("cold_storage", facility_id, facility)

    farmer_uid = booking.get("farmerUid")
    await set_doc("cold_storage_bookings", booking_id, booking)
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/cold_storage_bookings", booking_id, booking)
        try:
            await send_fcm_to_user(
                farmer_uid,
                "उपज निकासी गेट पास जारी 🚚",
                f"गेट पास {gate_pass_no} जारी हुआ। {body.releaseQuintals} क्विंटल उपज गोदाम से प्रस्थान कर रही है।",
                {"channel": "coldStorage", "gatePassNumber": gate_pass_no},
            )
        except Exception:
            pass

    # R2/R3: per-booking platform fee ledgered on release (integer paisa), plus
    # an audit_logs row with actor + reason (rule 3/8).
    fee_id = f"csfee_{booking_id}"
    existing_fee = await get_doc("platform_fees", fee_id)
    if existing_fee is None:
        await set_doc(
            "platform_fees",
            fee_id,
            {
                "id": fee_id,
                "kind": "coldStorageBookingFee",
                "role": "coldStorageProvider",
                "entityId": provider["id"],
                "facilityId": facility_id,
                "bookingId": booking_id,
                "gatePassNumber": gate_pass_no,
                "feePaisa": COLD_STORAGE_BOOKING_FEE_PAISA,
                "amountPaisa": COLD_STORAGE_BOOKING_FEE_PAISA,
                "status": "pending",
                "createdAt": now_iso,
            },
        )
    audit_id = f"aud_coldstorage_release_{booking_id}_{now_iso}"
    await set_doc(
        "audit_logs",
        audit_id,
        {
            "id": audit_id,
            "actor": provider["id"],
            "action": "COLD_STORAGE_BOOKING_RELEASE",
            "bookingId": booking_id,
            "facilityId": facility_id,
            "releaseQuintals": body.releaseQuintals,
            "remainingQuintals": remaining,
            "gatePassNumber": gate_pass_no,
            "feePaisa": COLD_STORAGE_BOOKING_FEE_PAISA,
            "reason": body.gatePassRemarks,
            "timestamp": now_iso,
        },
    )

    return {
        "booking": booking,
        "gatePassNumber": gate_pass_no,
        "releasedQuintals": body.releaseQuintals,
        "remainingQuintals": remaining,
    }


@router.get("/provider/facilities")
async def provider_get_facilities(
    mine_only: bool = False,
    provider: dict = Depends(_require_storage_provider()),
):
    await seed_cold_storage()
    all_facilities = await query("cold_storage", [], limit=100)
    provider_id = provider.get("id")
    assigned_facility_id = provider.get("facilityId", "cs-1")

    def _is_mine(f: dict) -> bool:
        return (
            f.get("ownerUid") == provider_id
            or f.get("id") == assigned_facility_id
            or (provider_id == "omni-user-777")
        )

    if mine_only:
        filtered = [f for f in all_facilities if _is_mine(f)]
        results = filtered or all_facilities
    else:
        results = sorted(all_facilities, key=lambda f: 0 if _is_mine(f) else 1)

    return {"data": [_shape_facility(f) for f in results]}


@router.post("/provider/facilities", status_code=201)
async def provider_create_facility(
    body: CreateFacilityIn,
    provider: dict = Depends(_require_storage_provider()),
    _entitlement: dict = Depends(_require_console_write),
):
    facility_id = f"cs-{uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    chambers_list = []
    if body.chambers:
        for ch in body.chambers:
            chambers_list.append({
                "id": f"ch-{uuid4().hex[:6]}",
                "name": ch.name,
                "chamberType": ch.chamberType,
                "capacityMT": ch.capacityMT,
                "currentOccupancyMT": 0.0,
                "tempRange": ch.tempRange,
                "status": ch.status,
            })
    else:
        if body.facilityType == "cold_storage":
            half_cap = round(body.capacityMT / 2, 1)
            chambers_list = [
                {
                    "id": f"ch-{uuid4().hex[:6]}",
                    "name": f"{body.name} - कक्ष A (शीत कक्ष)",
                    "chamberType": "cold_storage",
                    "capacityMT": half_cap,
                    "currentOccupancyMT": 0.0,
                    "tempRange": body.tempRange,
                    "status": "active",
                },
                {
                    "id": f"ch-{uuid4().hex[:6]}",
                    "name": f"{body.name} - कक्ष B (नियंत्रित वातावरण)",
                    "chamberType": "cold_storage",
                    "capacityMT": round(body.capacityMT - half_cap, 1),
                    "currentOccupancyMT": 0.0,
                    "tempRange": body.tempRange,
                    "status": "active",
                },
            ]
        else:
            chambers_list = [
                {
                    "id": f"ch-{uuid4().hex[:6]}",
                    "name": f"{body.name} - सेक्शन १ (मुख्य गोदाम)",
                    "chamberType": body.facilityType,
                    "capacityMT": body.capacityMT,
                    "currentOccupancyMT": 0.0,
                    "tempRange": body.tempRange if body.facilityType == "cold_storage" else "Ambient",
                    "status": "active",
                }
            ]

    total_chamber_cap = sum(c["capacityMT"] for c in chambers_list)
    effective_cap = max(body.capacityMT, total_chamber_cap)

    wdra_reg_no = body.wdraRegNo
    if body.wdraRegistered and not wdra_reg_no:
        dist_code = (body.district[:3] if body.district else "AGR").upper()
        state_code = (body.state[:2] if body.state else "IN").upper()
        wdra_reg_no = f"WDRA/{state_code}/{dist_code}/{datetime.now().year}/{uuid4().hex[:4].upper()}"

    doc = {
        "id": facility_id,
        "name": body.name,
        "ownerUid": provider.get("id"),
        "managerName": body.managerName or provider.get("name"),
        "contactPhone": body.contactPhone or provider.get("phone"),
        "address": body.address or f"{body.district}, {body.state}",
        "district": body.district,
        "state": body.state,
        "facilityType": body.facilityType,
        "distanceKm": body.distanceKm,
        "tempRange": body.tempRange,
        "availableMT": effective_cap,
        "totalCapacityMT": effective_cap,
        "bookedQuintals": 0.0,
        "ratePerQuintalMonth": body.ratePerQuintalMonth,
        "wdraRegistered": body.wdraRegistered,
        "wdraRegNo": wdra_reg_no,
        "supportedCrops": body.supportedCrops,
        "chambers": chambers_list,
        "createdAt": now_iso,
    }
    await set_doc("cold_storage", facility_id, doc)
    return _shape_facility(doc)


@router.post("/provider/facilities/{facility_id}/chambers", status_code=201)
async def provider_add_chamber(
    facility_id: str,
    body: CreateChamberIn,
    provider: dict = Depends(_require_storage_provider()),
    _entitlement: dict = Depends(_require_console_write),
):
    facility = await get_doc("cold_storage", facility_id)
    if facility is None:
        _error(404, "STORAGE_NOT_FOUND", "कोल्ड स्टोरेज/गोदाम नहीं मिला")

    chamber_id = f"ch-{uuid4().hex[:6]}"
    chamber = {
        "id": chamber_id,
        "name": body.name,
        "chamberType": body.chamberType,
        "capacityMT": body.capacityMT,
        "currentOccupancyMT": 0.0,
        "tempRange": body.tempRange,
        "status": body.status,
    }

    chambers = facility.get("chambers", [])
    chambers.append(chamber)
    facility["chambers"] = chambers

    facility["availableMT"] = round(facility.get("availableMT", 0.0) + body.capacityMT, 1)
    facility["totalCapacityMT"] = round(facility.get("totalCapacityMT", facility["availableMT"]) + body.capacityMT, 1)

    await set_doc("cold_storage", facility_id, facility)
    return {
        "chamber": chamber,
        "facility": _shape_facility(facility),
    }


@router.put("/provider/facilities/{facility_id}")
async def provider_update_facility(
    facility_id: str,
    data: dict,
    provider: dict = Depends(_require_storage_provider()),
    _entitlement: dict = Depends(_require_console_write),
):
    facility = await get_doc("cold_storage", facility_id)
    if facility is None:
        _error(404, "STORAGE_NOT_FOUND", "कोल्ड स्टोरेज नहीं मिला")

    for k in ["name", "availableMT", "totalCapacityMT", "ratePerQuintalMonth", "tempRange", "chambers", "supportedCrops"]:
        if k in data and data[k] is not None:
            facility[k] = data[k]

    await set_doc("cold_storage", facility_id, facility)
    return _shape_facility(facility)


# ==============================================================================
# AI Grading (M10, SDR + vision) — gateway-only vision + human-review gate
# ==============================================================================


def _price_band(recommended_paisa: int, mandi_modal_paisa: int | None) -> dict:
    """Recommended price band in integer paisa with an honest vs-mandi delta."""
    low = recommended_paisa - recommended_paisa * 10 // 100
    high = recommended_paisa + recommended_paisa * 10 // 100
    vs_mandi = None
    if mandi_modal_paisa:
        vs_mandi = round((recommended_paisa - mandi_modal_paisa) / mandi_modal_paisa * 100)
    return {
        "lowPaisa": low,
        "highPaisa": high,
        "recommendedPaisa": recommended_paisa,
        "mandiModalPaisa": mandi_modal_paisa,
        "vsMandiPct": vs_mandi,
    }


@router.post("/grade")
async def grade_produce(
    images: list[UploadFile] = File(...),
    crop: str | None = Form(None),
    quantityQuintals: float | None = Form(None),
    mandiModalPaisa: int | None = Form(None),
    user: dict = Depends(_require_user("farmer", "seller")),
):
    if len(images) > MAX_GRADE_IMAGES:
        _error(422, "TOO_MANY_IMAGES", "अधिकतम 3 फोटो स्वीकार्य हैं")
    first = None
    for image in images:
        data = await storage.validate_upload(image)
        storage.upload_user_file(
            user["id"], data, image.filename or "grade", image.content_type, prefix="grading"
        )
        if first is None:
            first = data

    # Vision grading runs ONLY through the gateway (rule 10); the deterministic
    # stub answers when the model is off/unavailable or its answer is invalid.
    assessment = await get_grading_adapter().scan(first or b"")
    confidence = float(assessment.get("confidence", 0.0))
    recommended_paisa = int(assessment.get("recommendedPrice", 0)) * 100

    # M10 gate: a low-confidence grade (or an explicit gate verdict) is routed to
    # the human-grader ops queue instead of being published as an AI grade.
    gate = await gateway.decide(
        {"confidence": confidence, "grade": assessment.get("grade")},
        "grading.gate.v1",
        module=GRADING_MODULE,
    )
    gate_answers = gate.answers or {}
    needs_human = confidence < GRADING_HUMAN_THRESHOLD or bool(gate_answers.get("needs_human"))

    scan_id = f"grade_{uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    await set_doc(
        "grading_scans",
        scan_id,
        {
            "scan_id": scan_id,
            "farmerId": user["id"],
            "crop": crop,
            "quantityQuintals": quantityQuintals,
            "assessment": assessment,
            "confidence": confidence,
            "needsHuman": needs_human,
            "createdAt": now_iso,
        },
    )

    demo = settings.ai_provider == "shim" or assessment.get("source") != "ai"
    result = {
        "grade": None if needs_human else assessment.get("grade"),
        "uniformityPercent": assessment.get("uniformityPercent"),
        "shelfLifeDays": assessment.get("shelfLifeDays"),
        "recommendedPrice": assessment.get("recommendedPrice"),
        "recommendedPricePaisa": recommended_paisa,
        "priceBandPaisa": _price_band(recommended_paisa, mandiModalPaisa),
        "confidence": confidence,
        "confidenceClass": gate_answers.get("confidence_class"),
        "source": assessment.get("source", "stub"),
        "decisionId": gate.decision_id,
        "automationLevel": "suggest",
        "demo": demo,
        "scanId": scan_id,
    }

    if needs_human:
        task_id = await emit_task(
            user_id=user["id"],
            persona="ops",
            module="post_harvest",
            kind="grading_human_review",
            title_en="Produce grading needs a human grader",
            title_hi="उपज ग्रेडिंग के लिए मानव ग्रेडर आवश्यक",
            subtitle=f"AI confidence {round(confidence * 100)}% — route to the ops grading queue",
            priority="today",
            deep_link="/dashboard/p/postHarvest",
            source_id=scan_id,
        )
        result.update({"needsHuman": True, "status": "pending_human", "taskId": task_id})
        return result

    result.update({"needsHuman": False, "status": "graded", "taskId": None})
    return result
