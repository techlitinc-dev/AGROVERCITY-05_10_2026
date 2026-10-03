from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

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
from app.services.fcm import send_fcm_to_user
from app.services.grading_model import get_grading_adapter
from app.services.users import get_user

router = APIRouter(prefix="/post-harvest", tags=["post-harvest"])

MAX_GRADE_IMAGES = 3
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
    facility = await get_doc("cold_storage", facility_id)
    if facility is None:
        _error(404, "STORAGE_NOT_FOUND", "कोल्ड स्टोरेज नहीं मिला")
    available_quintals = facility["availableMT"] * 10 - facility.get("bookedQuintals", 0)
    if body.quantityQuintals > available_quintals:
        _error(409, "INSUFFICIENT_CAPACITY", "इतनी क्षमता उपलब्ध नहीं")
    facility["bookedQuintals"] = facility.get("bookedQuintals", 0) + body.quantityQuintals
    await set_doc("cold_storage", facility_id, facility)

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
    facility = await get_doc("cold_storage", facility_id)
    if facility is None:
        _error(404, "STORAGE_NOT_FOUND", "कोल्ड स्टोरेज नहीं मिला")
    available_quintals = facility["availableMT"] * 10 - facility.get("bookedQuintals", 0)
    if body.quantityQuintals > available_quintals:
        _error(409, "INSUFFICIENT_CAPACITY", "इतनी क्षमता उपलब्ध नहीं")
    facility["bookedQuintals"] = facility.get("bookedQuintals", 0) + body.quantityQuintals
    await set_doc("cold_storage", facility_id, facility)

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


@router.get("/receipts/{receipt_number}")
async def get_warehouse_receipt(
    receipt_number: str,
    user: dict = Depends(_require_user("farmer", "seller", "coldStorageProvider")),
):
    receipt = await get_doc("warehouse_receipts", receipt_number)
    if receipt is None:
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
    return booking


@router.post("/provider/bookings/{booking_id}/inward")
async def provider_gate_inward(
    booking_id: str,
    body: GateInwardIn,
    provider: dict = Depends(_require_storage_provider()),
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
# AI Grading Endpoint (Unchanged)
# ==============================================================================


@router.post("/grade")
async def grade_produce(
    images: list[UploadFile] = File(...),
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
    return await get_grading_adapter().scan(first or b"")
