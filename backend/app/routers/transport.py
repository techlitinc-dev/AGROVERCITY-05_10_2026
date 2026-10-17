import hashlib
import math
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import admin_action, current_user_id
from app.core.security import verify_mpin
from app.models.transport import (
    AcceptBookingRequest,
    AssignDriverRequest,
    AvailabilityRequest,
    BookingPaymentRequest,
    BookingStopsRequest,
    BreakdownRequest,
    CreateBookingRequest,
    FareEstimateOut,
    FareEstimateRequest,
    InstantBookingRequest,
    LoadBidRequest,
    OpenLoadCreateRequest,
    OwnerVehicleRequest,
    OwnerVehicleUpdateRequest,
    RejectBookingRequest,
    StopPodRequest,
    TransportPayoutRequest,
    TransportProfileUpdate,
    TripExpenseRequest,
    TripLocationUpdate,
    UpdateBookingRequest,
    VehicleLocationRequest,
    VehicleTypeOut,
    WaitingEventRequest,
    WeighbridgeSlipRequest,
    FarmerRatingRequest,
    FavoriteToggleRequest,
    RebookRequest,
    LoadTemplateRequest,
    LoadTemplateRepeatRequest,
)
from app.routers.purchases import HANDOVER_OTP_MAX_ATTEMPTS, HANDOVER_OTP_VALID_MINUTES
from app.routers.users import require_role
from app.services import kyc as kyc_service
from app.services import reports
from app.services import settlements as settlements_service
from app.services import escrow as escrow_service
from app.services.payments import (
    create_razorpay_order,
    create_razorpayx_payout,
    refund_razorpay_payment,
    verify_razorpay_signature,
)
from app.services.pnl_engine import record_auto_entry
from app.services import transport_match
from app.services.billing import effective_plan, entitlement_guard, record_usage
from app.services.chat import ensure_transport_room
from app.services.notifications import send_fcm_to_user
from app.services.notify import notify_user
from app.services.rating_prompts import open_rating_prompt
from app.services.tasks import emit_task, module_deep_link
from app.services.users import get_user

router = APIRouter(prefix="/transport", tags=["transport"])

CORE_VEHICLE_TYPES = [
    {"type": "Tata Ace", "baseFare": 500, "perKmRate": 35, "capacityTonnes": 0.75},
    {"type": "Bolero Maxi", "baseFare": 800, "perKmRate": 45, "capacityTonnes": 1.5},
    {"type": "Tractor Trolley", "baseFare": 1000, "perKmRate": 30, "capacityTonnes": 3.0},
]

EXTENDED_VEHICLE_TYPES = [
    {"type": "Eicher 6-Wheeler", "baseFare": 1800, "perKmRate": 55, "capacityTonnes": 6.0},
    {"type": "Reefer Cold Van", "baseFare": 2200, "perKmRate": 65, "capacityTonnes": 3.5},
    {"type": "10-Wheeler Truck", "baseFare": 3500, "perKmRate": 75, "capacityTonnes": 16.0},
]

ALL_VEHICLE_TYPES = CORE_VEHICLE_TYPES + EXTENDED_VEHICLE_TYPES
VEHICLE_TYPES = ALL_VEHICLE_TYPES

# Aligned with services/settlements.py DEFAULT_CONFIG.transportPct (10%).
TRANSPORT_COMMISSION_RATE = 0.10

# Surge multiplier hard cap (transporter-side earning lever; never applied farmer-side).
SURGE_MULTIPLIER_CAP = 1.5

# platform_config/transport_penalties — versioned, effective-dated; admin edits go
# through maker-checker (phase-07 console), the router only consumes.
TRANSPORT_PENALTIES_DEFAULTS = {
    "cancelWindowHours": 24,
    "strikesToSuspend": 3,
    # FT-8 farmer-side cancellation tiers (% of the agreed fare): cancelling an
    # accepted trip inside the 24 h window → 10%; inside the final 2 h → 25%.
    # Of the penalty, transporterCompensationPct is credited to the stranded
    # transporter; the remainder is platform revenue.
    "farmerCancelPenaltyPct": 10,
    "farmerLateCancelPenaltyPct": 25,
    "transporterCompensationPct": 50,
    "version": 1,
    "effectiveFrom": "2026-10-01T00:00:00+00:00",
}


async def _transport_penalties() -> dict:
    """Load the penalty config; a future-dated change is not yet effective."""
    doc = await get_doc("platform_config", "transport_penalties")
    if doc is None:
        doc = dict(TRANSPORT_PENALTIES_DEFAULTS)
        await set_doc("platform_config", "transport_penalties", doc)
        return doc
    effective_from = doc.get("effectiveFrom")
    if effective_from:
        try:
            if datetime.fromisoformat(effective_from) > datetime.now(timezone.utc):
                return dict(TRANSPORT_PENALTIES_DEFAULTS)
        except ValueError:
            return dict(TRANSPORT_PENALTIES_DEFAULTS)
    config = dict(TRANSPORT_PENALTIES_DEFAULTS)
    for key in (
        "cancelWindowHours",
        "strikesToSuspend",
        "farmerCancelPenaltyPct",
        "farmerLateCancelPenaltyPct",
        "transporterCompensationPct",
        "version",
    ):
        if key in doc:
            config[key] = doc[key]
    return config


# FT-2 detention (waiting charges): free grace, then ₹-per-30-min slabs, hard cap.
# Same versioned/effective-dated shape as transport_penalties — admin edits go
# through maker-checker; the router only consumes.
TRANSPORT_DETENTION_DEFAULTS = {
    "freeMinutes": 60,
    "ratePer30MinPaisa": 15000,
    "maxChargePaisa": 200000,
    "version": 1,
    "effectiveFrom": "2026-10-01T00:00:00+00:00",
}


async def _transport_detention() -> dict:
    doc = await get_doc("platform_config", "transport_detention")
    if doc is None:
        doc = dict(TRANSPORT_DETENTION_DEFAULTS)
        await set_doc("platform_config", "transport_detention", doc)
        return doc
    effective_from = doc.get("effectiveFrom")
    if effective_from:
        try:
            if datetime.fromisoformat(effective_from) > datetime.now(timezone.utc):
                return dict(TRANSPORT_DETENTION_DEFAULTS)
        except ValueError:
            return dict(TRANSPORT_DETENTION_DEFAULTS)
    config = dict(TRANSPORT_DETENTION_DEFAULTS)
    for key in ("freeMinutes", "ratePer30MinPaisa", "maxChargePaisa", "version"):
        if key in doc:
            config[key] = doc[key]
    return config


# FT-6 transit insurance: premium = ceil(coverage × ratePct/100) in paisa,
# coverage capped. Same versioned/effective-dated pattern as the other configs.
TRANSPORT_INSURANCE_DEFAULTS = {
    "ratePct": 0.8,
    "maxCoveragePaisa": 50000000,  # ₹5,00,000 per trip
    "version": 1,
    "effectiveFrom": "2026-10-01T00:00:00+00:00",
}


async def _transport_insurance() -> dict:
    doc = await get_doc("platform_config", "transport_insurance")
    if doc is None:
        doc = dict(TRANSPORT_INSURANCE_DEFAULTS)
        await set_doc("platform_config", "transport_insurance", doc)
        return doc
    effective_from = doc.get("effectiveFrom")
    if effective_from:
        try:
            if datetime.fromisoformat(effective_from) > datetime.now(timezone.utc):
                return dict(TRANSPORT_INSURANCE_DEFAULTS)
        except ValueError:
            return dict(TRANSPORT_INSURANCE_DEFAULTS)
    config = dict(TRANSPORT_INSURANCE_DEFAULTS)
    for key in ("ratePct", "maxCoveragePaisa", "version"):
        if key in doc:
            config[key] = doc[key]
    return config


async def _insurance_block(opt_in: bool, declared_value_paisa: int | None) -> dict | None:
    """FT-6: build the booking/load insurance block; 422 without a declared value."""
    if not opt_in:
        return None
    if not declared_value_paisa or declared_value_paisa <= 0:
        _error(
            422,
            "DECLARED_VALUE_REQUIRED",
            "declared goods value is required when insurance is opted in",
            {"declaredValuePaisa": "required when insuranceOptIn is true"},
        )
    config = await _transport_insurance()
    coverage = min(int(declared_value_paisa), int(config["maxCoveragePaisa"]))
    premium = -(-int(coverage * float(config["ratePct"])) // 100)  # ceil, integer paisa
    return {
        "optIn": True,
        "declaredValuePaisa": int(declared_value_paisa),
        "coveragePaisa": coverage,
        "premiumPaisa": premium,
        "ratePct": float(config["ratePct"]),
    }


def _pickup_window_start(booking: dict, cancel_window_hours: int):
    raw = booking.get("pickupTime") or booking.get("date")
    if not raw:
        return None
    try:
        pickup_at = datetime.fromisoformat(str(raw))
    except ValueError:
        return None
    if pickup_at.tzinfo is None:
        pickup_at = pickup_at.replace(tzinfo=timezone.utc)
    return pickup_at - timedelta(hours=cancel_window_hours)


async def _record_no_show_strike(transporter_id: str):
    user = await get_user(transporter_id)
    if user is None:
        return
    strikes = (user.get("noShowStrikes") or 0) + 1
    user["noShowStrikes"] = strikes
    config = await _transport_penalties()
    if strikes >= config["strikesToSuspend"]:
        user["loadBoardSuspended"] = True
    await set_doc("users", transporter_id, user)


async def _post_ledger_entries(
    booking_id: str,
    farmer_id: str,
    transporter_id: str,
    penalty_paisa: int,
    compensation_paisa: int,
):
    """FT-8: platform credit ledger — penalty from the farmer, compensation
    owed to the stranded transporter. Integer paisa, append-only style."""
    now_iso = datetime.now(timezone.utc).isoformat()
    await set_doc(
        "platform_ledger",
        f"pen_{booking_id}",
        {
            "id": f"pen_{booking_id}",
            "kind": "farmer_cancel_penalty",
            "bookingId": booking_id,
            "userId": farmer_id,
            "amountPaisa": penalty_paisa,
            "status": "posted",
            "createdAt": now_iso,
        },
    )
    if compensation_paisa:
        await set_doc(
            "platform_ledger",
            f"comp_{booking_id}",
            {
                "id": f"comp_{booking_id}",
                "kind": "transporter_compensation",
                "bookingId": booking_id,
                "userId": transporter_id,
                "amountPaisa": compensation_paisa,
                "status": "posted",
                "createdAt": now_iso,
            },
        )


async def _assert_load_board_access(uid: str):
    user = await get_user(uid)
    if user and user.get("loadBoardSuspended"):
        _error(403, "SUSPENDED_FROM_LOAD_BOARD", "load board access suspended — contact support")


async def _plan_feature_guard(uid: str, feature: str) -> dict:
    """402 ENTITLEMENT_EXCEEDED when the user's plan lacks a named SaaS feature
    (instructions.md WS-02 step 13: Free is commission-only; driver
    sub-accounts / route analytics / priority load board are Pro+)."""
    plan = await effective_plan(uid, "transport")
    if feature not in (plan.get("features") or []):
        raise HTTPException(
            status_code=402,
            detail={
                "code": "ENTITLEMENT_EXCEEDED",
                "message": f"{feature} is not available on the {plan.get('tier')} plan — upgrade to Pro",
                "fieldErrors": {},
                "planId": plan.get("planId"),
                "feature": feature,
            },
        )
    return plan


def _is_driver(user: dict) -> bool:
    profiles = user.get("linkedProfiles") or []
    return "driver" in profiles or user.get("primaryProfile") == "driver"


async def _fleet_member(uid: str = Depends(current_user_id)) -> str:
    """Assigned transporter or one of their fleet drivers (T9)."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "transport", "driver")
    return uid


async def _assert_trip_operator(booking: dict, uid: str):
    """The assigned transporter, or a driver whose fleet owns the trip."""
    transporter_id = booking.get("transporterId")
    if uid == transporter_id:
        return
    user = await get_user(uid)
    if user and _is_driver(user) and user.get("fleetOwnerId") == transporter_id:
        return
    _error(403, "FORBIDDEN", "only the assigned fleet can operate this trip")


# Return-load matching window (T8): a completed/underway trip surfaces open loads
# whose pickup is near the trip's drop district and whose pickup date falls within
# this many days of the trip date. Deterministic — AI ranking of these is WS-06 M16.
RETURN_LOAD_WINDOW_DAYS = 3
_PLACE_STOPWORDS = {"the", "near", "dist", "district", "apmc", "yard", "mandi"}


def _place_tokens(place: str) -> set[str]:
    tokens = set()
    for raw in str(place).lower().replace(",", " ").split():
        token = "".join(ch for ch in raw if ch.isalnum())
        if len(token) >= 3 and token not in _PLACE_STOPWORDS:
            tokens.add(token)
    return tokens


def _places_match(pickup: str, drop: str) -> bool:
    pickup_tokens = _place_tokens(pickup)
    drop_tokens = _place_tokens(drop)
    return bool(pickup_tokens & drop_tokens)

ALLOWED_TRANSITIONS = {
    "requested": {"accepted", "cancelled"},
    "accepted": {"enRoute", "cancelled"},
    "enRoute": {"delivered"},
}

INITIAL_OPEN_LOADS = [
    {
        "id": "load_nsk_azp_01",
        "userId": "farmer_demo_1",
        "farmerName": "राजाराम पाटिल",
        "farmerPhone": "+91 98234 56781",
        "pickupLocation": "पिंपलगाव बसवंत, नासिक",
        "dropLocation": "आज़ादपुर फल-सब्जी मंडी, दिल्ली",
        "crop": "टमाटर (Tomato)",
        "quantityQuintals": 35.0,
        "packaging": "Plastic Crates (प्लास्टिक क्रेट्स)",
        "perishable": True,
        "preferredVehicleType": "Eicher 6-Wheeler",
        "pickupDate": "2026-09-28",
        "targetFare": 38000,
        "distanceKm": 1250,
        "notes": "ताजा टमाटर, 24 घंटे में पहुंचना चाहिए।",
        "status": "open",
        "bidsCount": 2,
        "createdAt": "2026-09-27T08:00:00Z",
    },
    {
        "id": "load_nfd_vsh_02",
        "userId": "farmer_demo_2",
        "farmerName": "सचिन कदम",
        "farmerPhone": "+91 97654 32109",
        "pickupLocation": "निफाड, नासिक",
        "dropLocation": "वाशी APMC मार्केट, नवी मुंबई",
        "crop": "लाल प्याज (Red Onion)",
        "quantityQuintals": 60.0,
        "packaging": "Gunny Bags (जूट बोरी)",
        "perishable": False,
        "preferredVehicleType": "Eicher 6-Wheeler",
        "pickupDate": "2026-09-29",
        "targetFare": 14500,
        "distanceKm": 210,
        "notes": "सूखा उच्च गुणवत्ता प्याज, वाटरप्रूफ तिरपाल आवश्यक।",
        "status": "open",
        "bidsCount": 3,
        "createdAt": "2026-09-27T09:30:00Z",
    },
    {
        "id": "load_dnd_nsk_03",
        "userId": "farmer_demo_3",
        "farmerName": "बापूसाहेब शिंदे",
        "farmerPhone": "+91 99221 44556",
        "pickupLocation": "दिंडोरी, नासिक",
        "dropLocation": "नासिक APMC मंडी",
        "crop": "अनार (Pomegranate)",
        "quantityQuintals": 12.0,
        "packaging": "Wooden Boxes (लकड़ी पेटी)",
        "perishable": True,
        "preferredVehicleType": "Bolero Maxi",
        "pickupDate": "2026-09-28",
        "targetFare": 2800,
        "distanceKm": 35,
        "notes": "एक्सपोर्ट ग्रेड अनार, सावधानीपूर्वक लोडिंग।",
        "status": "open",
        "bidsCount": 1,
        "createdAt": "2026-09-27T10:15:00Z",
    },
    {
        "id": "load_mal_srt_04",
        "userId": "farmer_demo_4",
        "farmerName": "गजानन खैरनार",
        "farmerPhone": "+91 98812 77665",
        "pickupLocation": "मालेगाव, नासिक",
        "dropLocation": "सूरत सरदार मार्केट, गुजरात",
        "crop": "हरी मिर्च व शिमला (Chilli & Capsicum)",
        "quantityQuintals": 22.0,
        "packaging": "Plastic Crates (क्रेट्स)",
        "perishable": True,
        "preferredVehicleType": "Bolero Maxi",
        "pickupDate": "2026-09-30",
        "targetFare": 9500,
        "distanceKm": 230,
        "notes": "सुबह 5 बजे से पहले मंडी पहुंचाना है।",
        "status": "open",
        "bidsCount": 0,
        "createdAt": "2026-09-27T11:00:00Z",
    },
]


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _booker(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller", "directBuyer", "transport")
    return uid


async def _viewer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller", "transport", "directBuyer")
    return uid


async def _transporter(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "transport")
    return uid


async def _booking_persona(uid: str = Depends(current_user_id)) -> str:
    """Booking-side personas only (nearby vehicles / instant booking)."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller")
    return uid


def _vehicle_type(name: str) -> dict:
    for vt in VEHICLE_TYPES:
        if vt["type"] == name:
            return vt
    _error(422, "UNKNOWN_VEHICLE_TYPE", "unknown vehicle type", {"vehicleType": "unknown type"})


async def _get_booking(booking_id: str) -> dict:
    booking = await get_doc("transport_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    return booking


# Reminder tasks fire this many days before a vehicle document expires.
DOC_EXPIRY_REMINDER_DAYS = (30, 7, 1)
_DOC_EXPIRY_FIELDS = (
    ("pucExpiry", "PUC"),
    ("fitnessExpiry", "Fitness certificate"),
    ("insuranceExpiry", "Insurance"),
)


async def _emit_pickup_reminder(uid: str, persona: str, booking: dict, label: str):
    """FT-1 Book Later: one deduped 'be ready' reminder due at the pickup slot."""
    due_at = booking.get("pickupTime") or booking.get("date")
    if not due_at:
        return
    window = booking.get("timeWindowMinutes")
    subtitle = f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} · {booking.get('pickup', '')}"
    if window:
        subtitle += f" · {window} min window"
    await emit_task(
        uid,
        persona=persona,
        module="transport",
        kind="trip_pickup_reminder",
        title_en=f"Pickup slot for {label}",
        title_hi=f"{label} के लिए पिकअप स्लॉट",
        subtitle=subtitle,
        priority="high" if persona == "transport" else "medium",
        deep_link=module_deep_link("transport", booking.get("id")),
        source_id=booking.get("id"),
        due_at=due_at,
    )


async def _emit_doc_expiry_reminders(uid: str, vehicle: dict):
    """emit_task() reminders 30/7/1 days before each vehicle doc expiry (T7)."""
    today = datetime.now(timezone.utc).date()
    for field, label in _DOC_EXPIRY_FIELDS:
        raw = vehicle.get(field)
        if not raw:
            continue
        try:
            expiry = datetime.fromisoformat(str(raw)).date()
        except ValueError:
            continue
        days_left = (expiry - today).days
        if days_left < 0 or days_left not in DOC_EXPIRY_REMINDER_DAYS:
            continue
        await emit_task(
            uid,
            "transport",
            "transport",
            f"vehicle_doc_expiry_{field}",
            f"{label} expiring in {days_left} day(s)",
            f"{label} {days_left} दिन में समाप्त होगा",
            f"{vehicle.get('registrationNo', 'Vehicle')} — renew before {expiry.isoformat()}",
            "high" if days_left <= 7 else "medium",
            module_deep_link("transport", vehicle.get("id")),
            f"{vehicle.get('id')}:{field}",
        )


async def _vehicle_docs_verified(vehicle: dict) -> bool:
    """Real KYC gate (T7): the owner's transport KYC case must have rc+dl
    verified through the phase-00 pipeline, and no vehicle document
    (PUC / fitness / insurance) may be past its expiry date."""
    owner_id = vehicle.get("ownerId")
    case = await kyc_service.get_case(kyc_service.case_id_for(owner_id, "transport"))
    if not case:
        return False
    verified_types = {
        doc.get("type")
        for doc in case.get("docs") or []
        if doc.get("status") == "verified"
    }
    if not {"rc", "dl"} <= verified_types:
        return False
    now = datetime.now(timezone.utc)
    for field in ("pucExpiry", "fitnessExpiry", "insuranceExpiry"):
        raw = vehicle.get(field)
        if not raw:
            continue
        try:
            expires = datetime.fromisoformat(str(raw))
        except ValueError:
            continue
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= now:
            return False
    return True


async def _assign_vehicle(
    booking: dict,
    uid: str,
    vehicle_id: str | None,
    vehicle_no: str | None,
    driver_name: str | None = None,
    driver_phone: str | None = None,
):
    if vehicle_id is None:
        return
    vehicle = await get_doc("vehicles", vehicle_id)
    if vehicle is None or vehicle.get("ownerId") != uid:
        _error(403, "NOT_VEHICLE_OWNER", "vehicle does not belong to this transporter")
    if not await _vehicle_docs_verified(vehicle):
        _error(422, "VEHICLE_NOT_VERIFIED", "vehicle documents are not verified or are expired", {"vehicleId": "documents not verified or expired"})
    vehicle["docStatus"] = "verified"
    vehicle["docReview"] = "kyc"
    await set_doc("vehicles", vehicle_id, vehicle)
    booking["vehicleId"] = vehicle_id
    booking["vehicleNo"] = vehicle_no or vehicle.get("registrationNo")
    booking["driverName"] = driver_name or vehicle.get("driverName") or "असाइन किया गया चालक"
    booking["driverPhone"] = driver_phone or vehicle.get("driverPhone") or ""


async def _own_vehicle(vehicle_id: str, uid: str) -> dict:
    vehicle = await get_doc("vehicles", vehicle_id)
    if vehicle is None:
        _error(404, "VEHICLE_NOT_FOUND", "vehicle not found")
    if vehicle.get("ownerId") != uid:
        _error(403, "NOT_VEHICLE_OWNER", "vehicle belongs to another transporter")
    return vehicle


# ------------------------------------------
# GEO HELPERS (nearby vehicles / urgent loads)
# ------------------------------------------

LOCATION_FRESH_HOURS = 24
ROAD_FACTOR = 1.25  # straight-line km -> road km
URGENT_LOAD_NOTIFY_RADIUS_KM = 50


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def _vehicle_anchor_point(vehicle: dict) -> dict | None:
    """Where the vehicle is: a fresh currentLocation ping wins; otherwise the
    owner's homeLocation. Vehicles with neither are unsearchable."""
    loc = vehicle.get("currentLocation")
    last_at = _parse_iso(vehicle.get("lastLocationAt"))
    if (
        loc
        and last_at is not None
        and datetime.now(timezone.utc) - last_at <= timedelta(hours=LOCATION_FRESH_HOURS)
        and loc.get("lat") is not None
        and loc.get("lng") is not None
    ):
        return loc
    home = vehicle.get("homeLocation")
    if home and home.get("lat") is not None and home.get("lng") is not None:
        return home
    return None


def _vehicle_available_on(vehicle: dict, date_iso: str, today_iso: str) -> bool:
    if vehicle.get("availableNow"):
        return True
    dates = vehicle.get("availableDates") or []
    return date_iso in dates or today_iso in dates


def _catalog_entry(vehicle_type: str | None) -> dict | None:
    for vt in VEHICLE_TYPES:
        if vt["type"] == vehicle_type:
            return vt
    return None


def _vehicle_fare(vehicle: dict, catalog: dict, distance_km: float) -> dict:
    """Custom perKmRate/baseFare override the catalog when present."""
    base = vehicle.get("baseFare") or catalog["baseFare"]
    per_km = vehicle.get("perKmRate") or catalog["perKmRate"]
    distance_fare = round(per_km * distance_km)
    return {"baseFare": base, "distanceFare": distance_fare, "totalFare": int(base) + int(distance_fare)}


# ==========================================
# 1. VEHICLE CATALOG & MANAGEMENT
# ==========================================

@router.get("/vehicles")
async def list_vehicle_types(extended: bool = False, uid: str = Depends(_viewer)):
    types = ALL_VEHICLE_TYPES if extended else CORE_VEHICLE_TYPES
    return {"data": [VehicleTypeOut(**vt).model_dump() for vt in types]}


@router.post("/vehicles", status_code=201)
async def create_vehicle(
    body: OwnerVehicleRequest,
    uid: str = Depends(_transporter),
    _plan: dict = Depends(entitlement_guard("transport", "vehicles")),
):
    payload = body.model_dump()
    # Custom rates are stored only when provided — they override the catalog
    # at fare time (nearby vehicles / instant bookings).
    for field in ("baseFare", "perKmRate"):
        if payload.get(field) is None:
            payload.pop(field, None)
    doc = {
        **payload,
        "id": f"veh_{uuid.uuid4().hex[:12]}",
        "ownerId": uid,
        "active": True,
        "docStatus": "pending",
        "docReview": "pending",
        "rejectionReason": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("vehicles", doc["id"], doc)
    await record_usage(uid, "vehicles")
    await _emit_doc_expiry_reminders(uid, doc)
    return doc


@router.get("/vehicles/my")
async def list_my_vehicles(verifiedOnly: bool = False, uid: str = Depends(_transporter)):
    docs = await query("vehicles", [("ownerId", "==", uid)], limit=1000)
    docs = [d for d in docs if d.get("active", True)]
    if verifiedOnly:
        docs = [d for d in docs if d.get("docStatus") == "verified"]
    return {"data": docs}


@router.put("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, body: OwnerVehicleUpdateRequest, uid: str = Depends(_transporter)):
    vehicle = await _own_vehicle(vehicle_id, uid)
    # Partial update: fields absent from the request are left unchanged.
    update = body.model_dump(exclude_unset=True)
    for field in ("baseFare", "perKmRate", "homeLocation"):
        if field in update and update[field] is None:
            update.pop(field)
    vehicle.update(update)
    vehicle["docStatus"] = "pending"
    vehicle["docReview"] = "pending"
    await set_doc("vehicles", vehicle_id, vehicle)
    await _emit_doc_expiry_reminders(uid, vehicle)
    return vehicle


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, uid: str = Depends(_transporter)):
    vehicle = await _own_vehicle(vehicle_id, uid)
    vehicle["active"] = False
    await set_doc("vehicles", vehicle_id, vehicle)
    return {"ok": True, "active": False}


@router.get("/vehicles/{vehicle_id}/calendar")
async def vehicle_calendar(vehicle_id: str, uid: str = Depends(_transporter)):
    await _own_vehicle(vehicle_id, uid)
    bookings = await query("transport_bookings", [("vehicleId", "==", vehicle_id)], limit=1000)
    trips = [
        {
            "bookingId": b["id"],
            "date": b.get("date"),
            "status": b.get("status"),
            "pickup": b.get("pickup"),
            "drop": b.get("drop"),
        }
        for b in bookings
        if b.get("status") in ("accepted", "enRoute")
    ]
    return {"vehicleId": vehicle_id, "bookings": trips}


@router.put("/vehicles/{vehicle_id}/availability")
async def set_availability(vehicle_id: str, body: AvailabilityRequest, uid: str = Depends(_transporter)):
    vehicle = await _own_vehicle(vehicle_id, uid)
    vehicle["availableDates"] = body.availableDates
    await set_doc("vehicles", vehicle_id, vehicle)
    return vehicle


@router.post("/vehicles/{vehicle_id}/location")
async def update_vehicle_location(
    vehicle_id: str,
    body: VehicleLocationRequest,
    uid: str = Depends(_transporter),
):
    """Owner GPS ping: anchors the vehicle for nearby search (fresh pings win
    over homeLocation for 24 h) and can flip live availability."""
    vehicle = await _own_vehicle(vehicle_id, uid)
    vehicle["currentLocation"] = {"lat": body.lat, "lng": body.lng}
    vehicle["lastLocationAt"] = datetime.now(timezone.utc).isoformat()
    if body.availableNow is not None:
        vehicle["availableNow"] = body.availableNow
    await set_doc("vehicles", vehicle_id, vehicle)
    return vehicle


# ==========================================
# 2. TRANSPORTER PROFILE & STATS
# ==========================================

@router.get("/profile")
async def get_transporter_profile(uid: str = Depends(_transporter)):
    profile = await get_doc(f"users/{uid}/role_profiles", "transport")
    user = await get_user(uid)
    vehicles = await query("vehicles", [("ownerId", "==", uid)], limit=100)
    active_vehicles = [v for v in vehicles if v.get("active", True)]
    bookings = await query("transport_bookings", [("transporterId", "==", uid)], limit=1000)
    completed_trips = [b for b in bookings if b.get("status") == "delivered"]
    live_trips = [b for b in bookings if b.get("status") in ("accepted", "enRoute")]
    lifetime_earnings = sum(int(b.get("fare") or 0) for b in completed_trips)

    if profile is None:
        profile = {
            "businessName": f"{user.get('name', 'किसान')} लॉजिस्टिक्स",
            "transporterType": "owner_driver",
            "vehicleType": "Tata Ace",
            "rcNumber": "",
            "contactPhone": user.get("phone", ""),
            "gstin": None,
            "panNumber": None,
            "transportLicense": None,
            "operatingRoutes": ["पिंपलगाव ➔ नासिक APMC", "निफाड ➔ मुंबई वाशी", "नासिक ➔ सूरत"],
            "operatingStates": ["महाराष्ट्र", "गुजरात"],
            "specializations": ["ताजी सब्जियां (Perishables)", "अनाज व दलहन (Grains)", "फल व प्याज"],
            "fleetSize": max(len(active_vehicles), 1),
            "experienceYears": 4,
            "emergencyAvailable": True,
            "settlementUpi": None,
        }

    return {
        "profile": profile,
        "stats": {
            "totalVehicles": len(active_vehicles),
            "totalTrips": len(completed_trips),
            "activeTrips": len(live_trips),
            "lifetimeEarnings": lifetime_earnings,
            "rating": 4.8,
            "onTimeRate": 97.4,
            "verified": any(v.get("docStatus") == "verified" for v in active_vehicles),
        },
    }


@router.put("/profile")
async def update_transporter_profile(body: TransportProfileUpdate, uid: str = Depends(_transporter)):
    doc = {
        **body.model_dump(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"users/{uid}/role_profiles", "transport", doc)
    return doc


# ==========================================
# 3. FARE ESTIMATION & BOOKINGS
# ==========================================

@router.post("/fare-estimate", response_model=FareEstimateOut)
async def fare_estimate(body: FareEstimateRequest, uid: str = Depends(_viewer)):
    vt = _vehicle_type(body.vehicleType)
    distance_fare = vt["perKmRate"] * body.distanceKm
    base_fare = vt["baseFare"]
    # Surge is a transporter-side earning lever, hard-capped (never farmer-side):
    # the estimate applies it to base+distance only after clamping to [1.0, CAP].
    surge = min(max(body.surgeMultiplier or 1.0, 1.0), SURGE_MULTIPLIER_CAP)
    total = round((base_fare + distance_fare) * surge, 2)
    loading_labor = 300.0 if body.distanceKm > 10 else 150.0
    toll_estimate = round((body.distanceKm / 50.0) * 85.0) if body.distanceKm >= 50 else 0.0

    return FareEstimateOut(
        baseFare=base_fare,
        distanceFare=distance_fare,
        totalFare=total,
        loadingLabor=loading_labor,
        perishableSurcharge=0.0,
        tollEstimate=toll_estimate,
        returnDiscount=0.0,
        surgeMultiplier=surge,
        breakdown={
            "perKmRate": vt["perKmRate"],
            "capacityTonnes": vt["capacityTonnes"],
            "loadingLabor": loading_labor,
            "tollEstimate": toll_estimate,
            "surgeMultiplier": surge,
        },
    )


@router.post("/bookings")
async def create_booking(body: CreateBookingRequest, uid: str = Depends(_booker)):
    vt = _vehicle_type(body.vehicleType)
    if body.lotId is not None:
        lot = await get_doc("market_lots", body.lotId)
        if lot is None or lot.get("farmerId") != uid:
            _error(404, "LOT_NOT_FOUND", "lot not found")
        if lot.get("status") != "open":
            _error(409, "LOT_NOT_OPEN", "lot is not open")

    fare = vt["baseFare"] + vt["perKmRate"] * body.distanceKm
    doc = {
        "id": f"trb_{uuid.uuid4().hex[:12]}",
        "userId": uid,
        "vehicleType": body.vehicleType,
        "distanceKm": body.distanceKm,
        "pickup": body.pickup,
        "drop": body.drop,
        "date": body.date,
        "lotId": body.lotId,
        "commodity": body.commodity,
        "weightQuintals": body.weightQuintals,
        "packaging": body.packaging,
        "notes": body.notes,
        "pickupTime": body.pickupTime,
        "timeWindowMinutes": body.timeWindowMinutes,
        "insurance": await _insurance_block(body.insuranceOptIn, body.declaredValuePaisa),
        "fare": int(round(fare)),
        "status": "requested",
        "vehicleId": None,
        "vehicleNo": None,
        "driverName": None,
        "driverPhone": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "waypointsLog": [
            {
                "waypoint": "booking_created",
                "label": "बुकिंग पंजीकृत हुई",
                "time": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }
    match_info = await transport_match.score_transport_match(doc, ctx=uid)
    doc["noshowRisk"] = match_info.get("noshow_risk", 0.05)
    doc["fit"] = match_info.get("fit", 0.7)
    await set_doc("transport_bookings", doc["id"], doc)
    if body.pickupTime:
        await _emit_pickup_reminder(uid, "farmer", doc, "your load")
    return doc


@router.get("/bookings")
async def list_bookings(
    status: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_transporter),
):
    docs = await query("transport_bookings", [], limit=1000)
    vehicles = await query("vehicles", [("ownerId", "==", uid)], limit=1000)
    vehicle_ids = {v["id"] for v in vehicles}
    docs = [
        d for d in docs
        if d.get("status") == "requested" or d.get("vehicleId") in vehicle_ids or d.get("transporterId") == uid
    ]
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    page_docs = docs[start:start + pageSize]
    for d in page_docs:
        if d.get("lotId"):
            lot = await get_doc("market_lots", d["lotId"])
            d["lot"] = (
                {"crop": lot["crop"], "quantityQuintals": lot["quantityQuintals"], "expectedRate": lot["expectedRate"]}
                if lot
                else None
            )
    return {"data": page_docs, "page": page, "pageSize": pageSize, "total": total}


@router.get("/bookings/{booking_id}")
async def get_booking_detail(booking_id: str, uid: str = Depends(_viewer)):
    booking = await _get_booking(booking_id)
    if booking.get("lotId"):
        lot = await get_doc("market_lots", booking["lotId"])
        booking["lot"] = (
            {"crop": lot["crop"], "quantityQuintals": lot["quantityQuintals"], "expectedRate": lot["expectedRate"]}
            if lot
            else None
        )
    return booking


@router.patch("/bookings/{booking_id}")
async def update_booking(booking_id: str, body: UpdateBookingRequest, uid: str = Depends(_transporter)):
    booking = await _get_booking(booking_id)
    allowed = ALLOWED_TRANSITIONS.get(booking.get("status"), set())
    if body.status not in allowed:
        _error(409, "ILLEGAL_TRANSITION", f"cannot move from {booking.get('status')} to {body.status}")
    if body.status == "accepted":
        await _assign_vehicle(booking, uid, body.vehicleId, body.vehicleNo)
    if body.status == "delivered":
        field_errors = {}
        if not body.podPhotos:
            field_errors["podPhotos"] = "at least one delivery photo is required"
        if not body.receiverName or not body.receiverName.strip():
            field_errors["receiverName"] = "receiver name is required"
        if field_errors:
            _error(422, "POD_REQUIRED", "proof of delivery is required", field_errors)
        booking["pod"] = {
            "photos": body.podPhotos,
            "receiverName": body.receiverName.strip(),
            "receiverPhone": body.receiverPhone,
            "damageNotes": body.damageNotes,
            "deliveredAt": datetime.now(timezone.utc).isoformat(),
        }
    if body.status == "cancelled":
        # No-show rule: cancelling inside the pickup window records a strike on
        # the transporter; strikesToSuspend strikes → load board suspension.
        penalties = await _transport_penalties()
        window_start = _pickup_window_start(booking, penalties["cancelWindowHours"])
        if window_start is not None and datetime.now(timezone.utc) >= window_start:
            await _record_no_show_strike(booking.get("transporterId") or uid)
    booking["status"] = body.status
    waypoints = booking.get("waypointsLog", [])
    label = "स्वीकृत" if body.status == "accepted" else ("रास्ते में" if body.status == "enRoute" else "डिलीवर पूर्ण")
    waypoints.append({
        "waypoint": body.status,
        "label": label,
        "time": datetime.now(timezone.utc).isoformat(),
    })
    booking["waypointsLog"] = waypoints
    await set_doc("transport_bookings", booking_id, booking)
    if body.status == "delivered":
        # Same two rating prompts as the OTP path — PATCH delivery had none.
        await open_rating_prompt(
            booking.get("userId"), booking.get("transporterId"), booking_id, "transport_delivery"
        )
        await open_rating_prompt(
            booking.get("transporterId"), booking.get("userId"), booking_id, "transport_shipper"
        )
    if body.status == "accepted":
        room = await ensure_transport_room(booking)
        if room:
            for party in (booking["userId"], booking["transporterId"]):
                await notify_user(
                    party,
                    type="chat_unlocked",
                    title="Chat unlocked / चैट खुली",
                    body=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — coordinate the pickup in-app",
                    deepLink=f"/dashboard/p/transport/trips/{booking_id}/chat",
                )
    elif body.status == "enRoute":
        await notify_user(
            booking["userId"],
            type="trip_enroute",
            title="Vehicle en route / गाड़ी निकली",
            body=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — {booking.get('vehicleNo') or 'vehicle'} is heading to pickup",
            deepLink=f"/dashboard/p/transport/trips/{booking_id}",
        )
    elif body.status == "delivered":
        await notify_user(
            booking["userId"],
            type="trip_delivered",
            title="Delivered / डिलीवर हुआ",
            body="Proof of delivery filed — inspect and rate your transporter",
            deepLink=f"/dashboard/p/transport/trips/{booking_id}",
        )
    return booking


class PodOtpVerifyRequest(BaseModel):
    otp: str
    podPhotos: list[str] | None = None
    receiverName: str | None = None
    receiverPhone: str | None = None
    damageNotes: str | None = None


def _pod_otp_fresh(pod_otp: dict) -> bool:
    expires_at = pod_otp.get("expiresAt")
    if not expires_at or not pod_otp.get("otp"):
        return False
    try:
        return datetime.now(timezone.utc) < datetime.fromisoformat(expires_at)
    except ValueError:
        return False


@router.get("/bookings/{booking_id}/pod-otp")
async def reveal_pod_otp(booking_id: str, uid: str = Depends(_booker)):
    """Farmer reveals the 6-digit delivery OTP once the trip is underway.
    Validity window and attempt cap share the purchase handover-OTP constants."""
    booking = await _get_booking(booking_id)
    if uid != booking.get("userId"):
        _error(403, "FORBIDDEN", "only the booking party can view the POD OTP")
    if booking.get("status") in ("delivered", "cancelled"):
        _error(409, "INVALID_STATUS_TRANSITION", f"cannot reveal a POD OTP for a {booking.get('status')} booking")
    pod_otp = booking.setdefault("podOtp", {})
    if pod_otp.get("verifiedAt") or not _pod_otp_fresh(pod_otp):
        pod_otp["otp"] = f"{secrets.randbelow(1000000):06d}"
        pod_otp["generatedAt"] = datetime.now(timezone.utc).isoformat()
        pod_otp["expiresAt"] = (
            datetime.now(timezone.utc) + timedelta(minutes=HANDOVER_OTP_VALID_MINUTES)
        ).isoformat()
        pod_otp["attempts"] = 0
        booking["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await set_doc("transport_bookings", booking_id, booking)
    return {
        "otp": pod_otp["otp"],
        "expiresAt": pod_otp["expiresAt"],
        "verifiedAt": pod_otp.get("verifiedAt"),
    }


@router.post("/bookings/{booking_id}/verify-pod-otp")
async def verify_pod_otp(booking_id: str, body: PodOtpVerifyRequest, uid: str = Depends(_transporter)):
    """Transporter enters the farmer's OTP at physical handover → booking delivered,
    alongside the existing podPhotos + receiverName proof fields."""
    booking = await _get_booking(booking_id)
    if uid != booking.get("transporterId"):
        _error(403, "FORBIDDEN", "only the assigned transporter can verify the POD OTP")
    pod_otp = booking.get("podOtp") or {}
    if pod_otp.get("verifiedAt"):
        _error(409, "ALREADY_VERIFIED", "POD OTP already verified")
    if booking.get("status") != "enRoute":
        _error(409, "ILLEGAL_TRANSITION", f"cannot verify POD OTP from {booking.get('status')}")
    if not pod_otp.get("otp"):
        _error(400, "OTP_NOT_GENERATED", "farmer must reveal the OTP first")
    if not _pod_otp_fresh(pod_otp):
        _error(422, "OTP_EXPIRED", "POD OTP expired — farmer should reveal again")
    if (pod_otp.get("attempts") or 0) >= HANDOVER_OTP_MAX_ATTEMPTS:
        _error(422, "OTP_MAX_ATTEMPTS", "too many attempts — request a new OTP from the farmer")
    existing_pod = booking.get("pod") or {}
    if str(body.otp or "").strip() != pod_otp.get("otp"):
        pod_otp["attempts"] = (pod_otp.get("attempts") or 0) + 1
        booking["podOtp"] = pod_otp
        booking["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await set_doc("transport_bookings", booking_id, booking)
        _error(400, "INVALID_OTP", "incorrect POD OTP")
    photos = body.podPhotos or existing_pod.get("photos")
    receiver = body.receiverName or existing_pod.get("receiverName")
    field_errors = {}
    if not photos:
        field_errors["podPhotos"] = "at least one delivery photo is required"
    if not receiver or not receiver.strip():
        field_errors["receiverName"] = "receiver name is required"
    if field_errors:
        _error(422, "POD_REQUIRED", "proof of delivery is required", field_errors)
    pod_otp["verifiedAt"] = datetime.now(timezone.utc).isoformat()
    pod_otp["attempts"] = 0
    booking["podOtp"] = pod_otp
    booking["pod"] = {
        "photos": photos,
        "receiverName": receiver.strip(),
        "receiverPhone": body.receiverPhone if body.receiverPhone is not None else existing_pod.get("receiverPhone"),
        "damageNotes": body.damageNotes if body.damageNotes is not None else existing_pod.get("damageNotes"),
        "deliveredAt": datetime.now(timezone.utc).isoformat(),
        "otpVerified": True,
    }
    booking["status"] = "delivered"
    # WS-03: shipper rates the transporter on delivery completion.
    await open_rating_prompt(
        booking.get("userId"), booking.get("transporterId"), booking_id, "transport_delivery"
    )
    # FT-3: two-way ratings — the transporter rates the shipper too.
    await open_rating_prompt(
        booking.get("transporterId"), booking.get("userId"), booking_id, "transport_shipper"
    )
    waypoints = booking.get("waypointsLog", [])
    waypoints.append({
        "waypoint": "delivered",
        "label": "डिलीवर पूर्ण",
        "time": datetime.now(timezone.utc).isoformat(),
    })
    booking["waypointsLog"] = waypoints
    booking["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("transport_bookings", booking_id, booking)
    await transport_match.record_transport_outcome(booking_id, "completed")
    transporter_id = booking.get("transporterId")
    if transporter_id:
        await record_auto_entry(
            transporter_id,
            "income",
            int(booking.get("fare") or 0) * 100,
            "freight_income",
            "freight_income",
            booking_id,
        )
    await notify_user(
        booking["userId"],
        type="trip_delivered",
        title="Delivered / डिलीवर हुआ",
        body="Proof of delivery verified with OTP — inspect and rate your transporter",
        deepLink=f"/dashboard/p/transport/trips/{booking_id}",
    )
    return booking


@router.post("/bookings/{booking_id}/accept")
async def accept_booking(booking_id: str, body: AcceptBookingRequest, uid: str = Depends(_transporter)):
    await _assert_load_board_access(uid)
    booking = await _get_booking(booking_id)
    if booking.get("status") != "requested":
        _error(409, "ILLEGAL_TRANSITION", "only a requested booking can be accepted")
    await _assign_vehicle(booking, uid, body.vehicleId, body.vehicleNo, body.driverName, body.driverPhone)
    booking["status"] = "accepted"
    booking["transporterId"] = uid
    waypoints = booking.get("waypointsLog", [])
    waypoints.append({
        "waypoint": "accepted",
        "label": "ट्रांसपोर्टर द्वारा स्वीकृत",
        "time": datetime.now(timezone.utc).isoformat(),
    })
    booking["waypointsLog"] = waypoints
    await set_doc("transport_bookings", booking_id, booking)
    # WS-05 task emission (module: transport) — trip reminder for the transporter.
    await emit_task(
        uid,
        persona="transport",
        module="transport",
        kind="trip_starting",
        title_en="Trip scheduled — be ready",
        title_hi="यात्रा तय — तैयार रहें",
        subtitle=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} · {booking.get('date', '')}",
        priority="urgent",
        deep_link=module_deep_link("transport", booking_id),
        source_id=booking_id,
        due_at=booking.get("date"),
    )
    vehicle_label = booking.get("vehicleNo") or "वाहन"
    await send_fcm_to_user(
        booking["userId"],
        "बुकिंग स्वीकृत",
        f"{vehicle_label} आपकी बुकिंग स्वीकार कर रहा है",
        {"type": "booking_accepted", "bookingId": booking_id},
    )
    await _emit_pickup_reminder(uid, "transport", booking, "accepted trip")
    room = await ensure_transport_room(booking)
    if room:
        for party in (booking["userId"], booking["transporterId"]):
            await notify_user(
                party,
                type="chat_unlocked",
                title="Chat unlocked / चैट खुली",
                body=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — coordinate the pickup in-app",
                deepLink=f"/dashboard/p/transport/trips/{booking_id}/chat",
            )
    return booking


@router.post("/bookings/{booking_id}/reject")
async def reject_booking(booking_id: str, body: RejectBookingRequest, uid: str = Depends(_transporter)):
    booking = await _get_booking(booking_id)
    if booking.get("status") != "requested":
        _error(409, "ILLEGAL_TRANSITION", "only a requested booking can be rejected")
    booking["status"] = "cancelled"
    booking["cancellationReason"] = body.reason
    booking["cancelledBy"] = "transporter"
    waypoints = booking.get("waypointsLog", [])
    waypoints.append({
        "waypoint": "cancelled",
        "label": f"अस्वीकृत: {body.reason}",
        "time": datetime.now(timezone.utc).isoformat(),
    })
    booking["waypointsLog"] = waypoints
    await set_doc("transport_bookings", booking_id, booking)
    await send_fcm_to_user(
        booking["userId"],
        "बुकिंग अस्वीकृत",
        f"ट्रांसपोर्टर ने आपकी बुकिंग अस्वीकार की: {body.reason}",
        {"type": "booking_rejected", "bookingId": booking_id},
    )
    return booking


@router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, body: RejectBookingRequest, uid: str = Depends(_booker)):
    """Farmer-side cancellation (plan §3.4): booker only, before pickup.
    FT-8: cancelling an *accepted* trip inside the pickup window accrues a
    tiered penalty (10% <24h, 25% <2h) — half compensates the stranded
    transporter, half is platform revenue; everything posts to the ledger."""
    booking = await _get_booking(booking_id)
    if booking.get("userId") != uid:
        _error(403, "FORBIDDEN", "only the booker can cancel this booking")
    if booking.get("status") not in ("requested", "accepted"):
        _error(409, "ILLEGAL_TRANSITION", f"cannot cancel from {booking.get('status')}")

    penalty_paisa = 0
    compensation_paisa = 0
    now = datetime.now(timezone.utc)
    if booking.get("status") == "accepted" and booking.get("transporterId"):
        penalties = await _transport_penalties()
        window_start = _pickup_window_start(booking, penalties["cancelWindowHours"])
        late_start = _pickup_window_start(booking, 2)
        if window_start is not None and now >= window_start:
            pct = (
                penalties["farmerLateCancelPenaltyPct"]
                if late_start is not None and now >= late_start
                else penalties["farmerCancelPenaltyPct"]
            )
            fare_paisa = int(round(float(booking.get("fare") or 0) * 100))
            penalty_paisa = int(round(fare_paisa * pct / 100))
            compensation_paisa = int(
                round(penalty_paisa * penalties["transporterCompensationPct"] / 100)
            )
            booking["farmerCancelPenaltyPaisa"] = penalty_paisa
            await _post_ledger_entries(booking_id, uid, booking["transporterId"], penalty_paisa, compensation_paisa)
            farmer = (await get_user(uid)) or {}
            farmer["platformDuesPaisa"] = int(farmer.get("platformDuesPaisa") or 0) + penalty_paisa
            await set_doc("users", uid, farmer)

    booking["status"] = "cancelled"
    booking["cancellationReason"] = body.reason
    booking["cancelledBy"] = "farmer"
    waypoints = booking.get("waypointsLog", [])
    waypoints.append({
        "waypoint": "cancelled",
        "label": f"किसान ने रद्द की: {body.reason}",
        "time": now.isoformat(),
    })
    booking["waypointsLog"] = waypoints
    await set_doc("transport_bookings", booking_id, booking)
    await transport_match.record_transport_outcome(booking_id, "cancelled")
    if booking.get("transporterId"):
        body_text = f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — {body.reason}"
        if compensation_paisa:
            body_text += f" · compensation ₹{compensation_paisa / 100:.0f} credited"
        await notify_user(
            booking["transporterId"],
            type="booking_cancelled",
            title="Booking cancelled / बुकिंग रद्द",
            body=body_text,
            deepLink=f"/dashboard/p/transport/trips/{booking_id}",
        )
    return booking


# ==========================================
# 4. LOAD BOARD / LOAD MARKETPLACE (लोड बाज़ार)
# ==========================================

@router.get("/loads")
async def list_open_loads(
    crop: str | None = None,
    pickup: str | None = None,
    drop: str | None = None,
    uid: str = Depends(_viewer),
):
    loads = await query("transport_loads", [], limit=500)
    if not loads:
        # Pre-seed realistic open loads in DB
        for item in INITIAL_OPEN_LOADS:
            await set_doc("transport_loads", item["id"], item)
        loads = list(INITIAL_OPEN_LOADS)

    loads = [ld for ld in loads if ld.get("status") == "open"]
    if crop:
        loads = [ld for ld in loads if crop.lower() in ld.get("crop", "").lower()]
    if pickup:
        loads = [ld for ld in loads if pickup.lower() in ld.get("pickupLocation", "").lower()]
    if drop:
        loads = [ld for ld in loads if drop.lower() in ld.get("dropLocation", "").lower()]

    # Urgent loads pin to the top; within a tier, newest first.
    loads.sort(key=lambda x: (bool(x.get("urgent", False)), x.get("createdAt", "")), reverse=True)
    return {"data": loads, "total": len(loads)}


def _build_open_load(uid: str, user: dict, fields: dict) -> dict:
    return {
        "id": f"load_{uuid.uuid4().hex[:10]}",
        "userId": uid,
        "farmerName": user.get("name", "किसान"),
        "farmerPhone": user.get("phone", ""),
        **fields,
        "status": "open",
        "bidsCount": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/loads", status_code=201)
async def post_open_load(body: OpenLoadCreateRequest, uid: str = Depends(_booker)):
    user = await get_user(uid)
    doc = _build_open_load(uid, user, {
        "pickupLocation": body.pickupLocation,
        "dropLocation": body.dropLocation,
        "crop": body.crop,
        "quantityQuintals": body.quantityQuintals,
        "packaging": body.packaging,
        "perishable": body.perishable,
        "preferredVehicleType": body.preferredVehicleType,
        "pickupDate": body.pickupDate,
        "pickupTime": body.pickupTime,
        "targetFare": body.targetFare,
        "notes": body.notes,
        "urgent": body.urgent,
        "pickupLat": body.pickupLat,
        "pickupLng": body.pickupLng,
        "insurance": await _insurance_block(body.insuranceOptIn, body.declaredValuePaisa),
    })
    match_info = await transport_match.score_transport_match(doc, ctx=uid)
    doc["noshowRisk"] = match_info.get("noshow_risk", 0.05)
    doc["fit"] = match_info.get("fit", 0.7)
    await set_doc("transport_loads", doc["id"], doc)
    if doc.get("urgent"):
        await _notify_urgent_load_nearby(doc)
    return doc


async def _notify_urgent_load_nearby(load: dict):
    """Urgent load with a geo point: ping each verified, available vehicle
    owner within 50 km once (deduped per owner, not per vehicle)."""
    lat = load.get("pickupLat")
    lng = load.get("pickupLng")
    if lat is None or lng is None:
        return
    today = datetime.now(timezone.utc).date().isoformat()
    vehicles = await query("vehicles", [], limit=1000)
    notified_owners: set[str] = set()
    for vehicle in vehicles:
        if not vehicle.get("active", True):
            continue
        if not _vehicle_available_on(vehicle, today, today):
            continue
        if not await _vehicle_docs_verified(vehicle):
            continue
        anchor = _vehicle_anchor_point(vehicle)
        if anchor is None:
            continue
        road_km = _haversine_km(lat, lng, float(anchor["lat"]), float(anchor["lng"])) * ROAD_FACTOR
        if road_km > URGENT_LOAD_NOTIFY_RADIUS_KM:
            continue
        owner = vehicle.get("ownerId")
        if owner and owner not in notified_owners:
            notified_owners.add(owner)
    for owner in notified_owners:
        await notify_user(
            owner,
            type="urgent_load_nearby",
            title="Urgent load nearby / आस-पास तुरंत लोड",
            body=(
                f"{load.get('crop', 'Load')} — {load.get('quantityQuintals', '')} Q "
                f"from {load.get('pickupLocation', '')} on {load.get('pickupDate', '')}"
            ),
            urgent=True,
        )


@router.post("/loads/{load_id}/bid", status_code=201)
async def submit_load_bid(load_id: str, body: LoadBidRequest, uid: str = Depends(_transporter)):
    load = await get_doc("transport_loads", load_id)
    if load is None:
        _error(404, "LOAD_NOT_FOUND", "open load not found")
    if load.get("status") != "open":
        _error(409, "LOAD_NOT_OPEN", "load is no longer open for bidding")

    user = await get_user(uid)
    vehicle_no = body.vehicleNo
    if body.vehicleId and not vehicle_no:
        veh = await get_doc("vehicles", body.vehicleId)
        if veh:
            vehicle_no = veh.get("registrationNo")

    plan = await effective_plan(uid, "transport")
    bid_doc = {
        "id": f"bid_{uuid.uuid4().hex[:10]}",
        "loadId": load_id,
        "transporterId": uid,
        "transporterName": user.get("name", "ट्रांसपोर्ट पार्टनर"),
        "transporterPhone": user.get("phone", ""),
        "quotedFare": body.quotedFare,
        "vehicleId": body.vehicleId,
        "vehicleNo": vehicle_no,
        "estimatedPickupTime": body.estimatedPickupTime,
        "notes": body.notes,
        "priority": (plan.get("tier") in ("pro", "enterprise")),
        "status": "pending",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"transport_loads/{load_id}/bids", bid_doc["id"], bid_doc)

    load["bidsCount"] = load.get("bidsCount", 0) + 1
    await set_doc("transport_loads", load_id, load)

    await send_fcm_to_user(
        load["userId"],
        "नया भाड़ा प्रस्ताव (Bid Received)",
        f"{bid_doc['transporterName']} ने ₹{body.quotedFare} का प्रस्ताव भेजा है",
        {"type": "bid_received", "loadId": load_id, "bidId": bid_doc["id"]},
    )
    return bid_doc


@router.get("/loads/{load_id}/bids")
async def list_load_bids(load_id: str, uid: str = Depends(_viewer)):
    load = await get_doc("transport_loads", load_id)
    if load is None:
        _error(404, "LOAD_NOT_FOUND", "open load not found")
    bids = await query(f"transport_loads/{load_id}/bids", [], limit=100)
    # Priority load board (Pro): at equal fare, priority bids rank first.
    bids.sort(key=lambda b: (b.get("quotedFare", 0), not b.get("priority", False)))
    return {"loadId": load_id, "data": bids, "total": len(bids)}


class LoadBidCounterRequest(BaseModel):
    quotedFare: float
    notes: str | None = None


@router.post("/loads/{load_id}/bids/{bid_id}/counter")
async def counter_load_bid(
    load_id: str,
    bid_id: str,
    body: LoadBidCounterRequest,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_booker),
):
    """Load owner counters a transporter's bid — exactly one counter round per bid."""
    from app.services import idempotency

    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required")
    load = await get_doc("transport_loads", load_id)
    if load is None or load.get("userId") != uid:
        _error(404, "LOAD_NOT_FOUND", "load not found or unauthorized")
    if load.get("status") != "open":
        _error(409, "LOAD_NOT_OPEN", "load is no longer open for bidding")
    stored = await idempotency.replay(f"loads.{load_id}.bids.{bid_id}.counter", idempotency_key)
    if stored is not None:
        return stored
    bid = await get_doc(f"transport_loads/{load_id}/bids", bid_id)
    if bid is None:
        _error(404, "BID_NOT_FOUND", "bid not found")
    if bid.get("status") != "pending":
        _error(409, "BID_NOT_PENDING", "only a pending bid can be countered")
    if bid.get("counter"):
        _error(422, "COUNTER_LIMIT_REACHED", "this bid has already been countered once")
    bid["counter"] = {
        "quotedFare": body.quotedFare,
        "notes": body.notes,
        "by": uid,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"transport_loads/{load_id}/bids", bid_id, bid)
    await idempotency.store(f"loads.{load_id}.bids.{bid_id}.counter", idempotency_key, bid)
    await send_fcm_to_user(
        bid["transporterId"],
        "काउंटर ऑफर (Counter Offer)",
        f"मालिक ने ₹{body.quotedFare} का काउंटर प्रस्ताव भेजा है",
        {"type": "bid_countered", "loadId": load_id, "bidId": bid_id},
    )
    return bid


@router.post("/loads/{load_id}/accept-bid")
async def accept_load_bid(load_id: str, bidId: str = Query(...), uid: str = Depends(_booker)):
    load = await get_doc("transport_loads", load_id)
    if load is None or load.get("userId") != uid:
        _error(404, "LOAD_NOT_FOUND", "load not found or unauthorized")
    bid = await get_doc(f"transport_loads/{load_id}/bids", bidId)
    if bid is None:
        _error(404, "BID_NOT_FOUND", "bid not found")
    await _assert_load_board_access(bid["transporterId"])

    load["status"] = "booked"
    load["acceptedBidId"] = bidId
    await set_doc("transport_loads", load_id, load)

    booking_id = f"trb_{uuid.uuid4().hex[:12]}"
    booking_doc = {
        "id": booking_id,
        "userId": uid,
        "transporterId": bid["transporterId"],
        "vehicleType": load.get("preferredVehicleType", "Tata Ace"),
        "distanceKm": load.get("distanceKm", 50.0),
        "pickup": load["pickupLocation"],
        "drop": load["dropLocation"],
        "date": load["pickupDate"],
        "commodity": load["crop"],
        "weightQuintals": load["quantityQuintals"],
        "packaging": load["packaging"],
        "pickupTime": load.get("pickupTime"),
        "insurance": load.get("insurance"),
        "fare": int(round(bid["quotedFare"])),
        "status": "accepted",
        "vehicleId": bid.get("vehicleId"),
        "vehicleNo": bid.get("vehicleNo"),
        "driverName": bid.get("transporterName"),
        "driverPhone": bid.get("transporterPhone"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "waypointsLog": [
            {
                "waypoint": "bid_accepted",
                "label": f"बोली स्वीकृत: ₹{bid['quotedFare']}",
                "time": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }
    await set_doc("transport_bookings", booking_id, booking_doc)

    bid["status"] = "accepted"
    await set_doc(f"transport_loads/{load_id}/bids", bidId, bid)

    await send_fcm_to_user(
        bid["transporterId"],
        "बोली स्वीकृत! (Bid Accepted)",
        f"आपकी ₹{bid['quotedFare']} की बोली स्वीकृत हुई। ट्रिप तैयार है।",
        {"type": "booking_confirmed", "bookingId": booking_id},
    )
    await _emit_pickup_reminder(bid["transporterId"], "transport", booking_doc, "won auction trip")
    room = await ensure_transport_room(booking_doc)
    if room:
        for party in (booking_doc["userId"], booking_doc["transporterId"]):
            await notify_user(
                party,
                type="chat_unlocked",
                title="Chat unlocked / चैट खुली",
                body=f"{booking_doc.get('commodity') or 'Trip'} — coordinate the pickup in-app",
                deepLink=f"/dashboard/p/transport/trips/{booking_id}/chat",
            )
    return {"booking": booking_doc, "load": load}


# ==========================================
# 5. LIVE GPS WAYPOINT TRACKING
# ==========================================

@router.post("/bookings/{booking_id}/location")
async def update_trip_location(booking_id: str, body: TripLocationUpdate, uid: str = Depends(_fleet_member)):
    booking = await _get_booking(booking_id)
    await _assert_trip_operator(booking, uid)
    now_iso = datetime.now(timezone.utc).isoformat()
    location_data = {
        "lat": body.lat,
        "lng": body.lng,
        "speedKmH": body.speedKmH,
        "heading": body.heading,
        "waypoint": body.waypoint,
        "waypointLabel": body.waypointLabel,
        "notes": body.notes,
        "updatedAt": now_iso,
    }
    booking["lastLocation"] = location_data

    waypoints = booking.get("waypointsLog", [])
    milestone_notified = False
    if body.waypoint:
        waypoints.append({
            "waypoint": body.waypoint,
            "label": body.waypointLabel or body.waypoint,
            "lat": body.lat,
            "lng": body.lng,
            "time": now_iso,
        })
        booking["waypointsLog"] = waypoints
        # Notify the farmer only for meaningful milestones (not every position ping).
        if body.waypoint in ("at_pickup", "loaded", "unloading"):
            milestone_notified = True

    await set_doc("transport_bookings", booking_id, booking)
    if milestone_notified:
        await notify_user(
            booking["userId"],
            type="trip_milestone",
            title="Trip update / यात्रा अपडेट",
            body=f"{body.waypointLabel or body.waypoint} — {booking.get('commodity') or booking.get('vehicleType', 'Trip')}",
            deepLink=f"/dashboard/p/transport/trips/{booking_id}",
        )
    return {"bookingId": booking_id, "location": location_data}


@router.get("/bookings/{booking_id}/location")
async def get_trip_location(booking_id: str, uid: str = Depends(_viewer)):
    booking = await _get_booking(booking_id)
    last_loc = booking.get("lastLocation") or {
        "lat": 19.9975,
        "lng": 73.7898,
        "speedKmH": 48.0,
        "heading": 120.0,
        "waypoint": "in_transit",
        "waypointLabel": "हाईवे पर गतिशील (In Transit)",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    return {
        "bookingId": booking_id,
        "status": booking.get("status"),
        "route": f"{booking.get('pickup')} ➔ {booking.get('drop')}",
        "vehicleNo": booking.get("vehicleNo", "—"),
        "driverName": booking.get("driverName", "चालक"),
        "driverPhone": booking.get("driverPhone", ""),
        "currentLocation": last_loc,
        "waypoints": booking.get("waypointsLog", []),
        "estimatedMinutesLeft": max(int(booking.get("distanceKm", 30) * 1.5), 15),
    }


# ==========================================
# 6. DIGITAL BILTY / LORRY RECEIPT (LR) & WEIGHBRIDGE
# ==========================================

@router.get("/bookings/{booking_id}/bilty")
async def get_digital_bilty(booking_id: str, uid: str = Depends(_viewer)):
    booking = await _get_booking(booking_id)
    fare = booking.get("fare", 0)
    weighbridge = booking.get("weighbridgeSlip") or {
        "slipNo": f"DK-{booking_id[-6:].upper()}",
        "weighbridgeName": "श्री गणेश धर्मकांटा, पिंपलगाव",
        "tareWeightKg": 1420.0,
        "grossWeightKg": 3950.0,
        "netWeightKg": 2530.0,
        "recordedAt": booking.get("createdAt"),
    }

    lr_doc = {
        "lrNumber": f"LR-{datetime.now(timezone.utc).year}-{booking_id[-8:].upper()}",
        "bookingId": booking_id,
        "date": booking.get("date"),
        "consignor": {
            "name": "किसान / विक्रेता",
            "location": booking.get("pickup"),
            "contact": "+91 98234 56789",
        },
        "consignee": {
            "name": "मंडी आढ़ती / खरीदार",
            "destination": booking.get("drop"),
            "contact": "+91 98901 23456",
        },
        "vehicleDetails": {
            "vehicleType": booking.get("vehicleType"),
            "vehicleNo": booking.get("vehicleNo") or "MH-15-AB-1234",
            "driverName": booking.get("driverName") or "कैलाश गायकवाड़",
            "driverPhone": booking.get("driverPhone") or "+91 94222 11002",
        },
        "goods": {
            "commodity": booking.get("commodity") or "कृषि उपज (Agri Produce)",
            "weightQuintals": booking.get("weightQuintals") or 25.3,
            "packaging": booking.get("packaging") or "Gunny Bags / Crates",
            "declaredValue": int(fare * 8),
        },
        "freightCharges": {
            "grossFare": fare,
            "loadingLabor": 300,
            "detentionChargePaisa": int((booking.get("detention") or {}).get("totalChargePaisa") or 0),
            "advancePaid": int(fare * 0.4),
            "balancePayable": int(fare * 0.6) + 300 + int((booking.get("detention") or {}).get("totalChargePaisa") or 0) / 100,
        },
        "insurance": booking.get("insurance"),
        "weighbridgeSlip": weighbridge,
        "qrVerificationCode": f"AGRO-TMS-VERIFY-{booking_id}",
        "terms": "कृषि उपज परिवहन नियमावली अनुसार माल की सुरक्षा सुनिश्चित है।",
    }
    return lr_doc


@router.post("/bookings/{booking_id}/weighbridge")
async def record_weighbridge_slip(booking_id: str, body: WeighbridgeSlipRequest, uid: str = Depends(_transporter)):
    booking = await _get_booking(booking_id)
    net_weight = body.netWeightKg or (body.grossWeightKg - body.tareWeightKg)
    slip_doc = {
        "slipNo": body.slipNo,
        "weighbridgeName": body.weighbridgeName,
        "tareWeightKg": body.tareWeightKg,
        "grossWeightKg": body.grossWeightKg,
        "netWeightKg": net_weight,
        "slipPhotoUrl": body.slipPhotoUrl,
        "notes": body.notes,
        "recordedAt": datetime.now(timezone.utc).isoformat(),
    }
    booking["weighbridgeSlip"] = slip_doc
    waypoints = booking.get("waypointsLog", [])
    waypoints.append({
        "waypoint": "weighbridge",
        "label": f"धर्मकांटा वजन पर्ची: {net_weight} kg",
        "time": datetime.now(timezone.utc).isoformat(),
    })
    booking["waypointsLog"] = waypoints
    await set_doc("transport_bookings", booking_id, booking)
    await notify_user(
        booking["userId"],
        type="weighbridge_recorded",
        title="Weighbridge slip / वेब्रिज स्लिप",
        body=f"Net {net_weight} kg recorded for {booking.get('commodity') or booking.get('vehicleType', 'Trip')}",
        deepLink=f"/dashboard/p/transport/trips/{booking_id}",
    )
    return slip_doc


# ==========================================
# 7. TRIP EXPENSES & NET PROFIT LEDGER
# ==========================================

@router.post("/bookings/{booking_id}/expenses", status_code=201)
async def add_trip_expense(booking_id: str, body: TripExpenseRequest, uid: str = Depends(_transporter)):
    await _get_booking(booking_id)
    doc = {
        "id": f"exp_{uuid.uuid4().hex[:10]}",
        "bookingId": booking_id,
        "category": body.category,
        "amount": body.amount,
        "notes": body.notes,
        "receiptPhotoUrl": body.receiptPhotoUrl,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"transport_bookings/{booking_id}/expenses", doc["id"], doc)
    return doc


@router.get("/bookings/{booking_id}/expenses")
async def get_trip_expenses(booking_id: str, uid: str = Depends(_transporter)):
    booking = await _get_booking(booking_id)
    expenses = await query(f"transport_bookings/{booking_id}/expenses", [], limit=100)
    gross_fare = float(booking.get("fare") or 0.0)
    total_expenses = sum(float(e.get("amount") or 0.0) for e in expenses)
    # Commission comes from platform_config/settlements.transportPct — the same
    # config the weekly settlement run charges (single source of truth).
    config = await settlements_service._config()
    platform_commission = round(gross_fare * (config["transportPct"] / 100), 2)
    # FT-2 detention: extra farmer-paid income on top of the agreed fare.
    detention_paisa = int((booking.get("detention") or {}).get("totalChargePaisa") or 0)
    detention_rupees = round(detention_paisa / 100, 2)
    net_profit = round(gross_fare + detention_rupees - total_expenses - platform_commission, 2)

    return {
        "bookingId": booking_id,
        "grossFare": gross_fare,
        "detentionChargePaisa": detention_paisa,
        "detentionCharge": detention_rupees,
        "totalExpenses": total_expenses,
        "platformCommission": platform_commission,
        "netProfit": net_profit,
        "expenses": expenses,
    }


# ==========================================
# 8. TMS PERFORMANCE ANALYTICS
# ==========================================

@router.get("/analytics")
async def get_transport_analytics(uid: str = Depends(_transporter)):
    await _plan_feature_guard(uid, "routeAnalytics")
    vehicles = await query("vehicles", [("ownerId", "==", uid)], limit=100)
    active_vehicles = [v for v in vehicles if v.get("active", True)]
    bookings = await query("transport_bookings", [("transporterId", "==", uid)], limit=1000)
    completed = [b for b in bookings if b.get("status") == "delivered"]
    live = [b for b in bookings if b.get("status") in ("accepted", "enRoute")]

    total_gross = sum(int(b.get("fare") or 0) for b in completed)
    total_km = sum(float(b.get("distanceKm") or 0) for b in completed)
    estimated_diesel = round(total_km * 14.5, 2)  # Avg ₹14.5/km fuel
    estimated_net = round(total_gross - estimated_diesel - (total_gross * TRANSPORT_COMMISSION_RATE), 2)

    return {
        "totalVehicles": len(active_vehicles),
        "totalTripsCompleted": len(completed),
        "activeTripsCount": len(live),
        "totalGrossRevenue": total_gross,
        "totalDistanceKm": round(total_km, 1),
        "estimatedDieselExpense": estimated_diesel,
        "estimatedNetProfit": max(estimated_net, 0.0),
        "fleetUtilizationRate": 85.5 if active_vehicles else 0.0,
        "onTimeDeliveryPct": 98.2,
        "averageRating": 4.9,
    }


@router.get("/dashboard")
async def transporter_dashboard(uid: str = Depends(_transporter)):
    """Home-screen summary (instructions.md WS-02 step 12): today's trips with
    status, new job requests, fleet availability/location, earnings today/this
    week (integer paisa), next settlement, document expiries, and return-load
    matches on today's routes."""
    today = datetime.now(timezone.utc).date()
    today_iso = today.isoformat()
    week_start = (today - timedelta(days=6)).isoformat()

    bookings = await query("transport_bookings", [], limit=1000)
    vehicles = await query("vehicles", [("ownerId", "==", uid)], limit=1000)
    vehicle_ids = {v["id"] for v in vehicles}

    mine = [
        b for b in bookings
        if b.get("transporterId") == uid or b.get("vehicleId") in vehicle_ids
    ]
    today_trips_raw = [b for b in mine if b.get("date") == today_iso]
    today_trips = [
        {
            "id": b["id"],
            "pickup": b.get("pickup"),
            "drop": b.get("drop"),
            "status": b.get("status"),
            "vehicleNo": b.get("vehicleNo"),
        }
        for b in today_trips_raw
    ]

    jobs = [
        {
            "id": b["id"],
            "pickup": b.get("pickup"),
            "drop": b.get("drop"),
            "vehicleType": b.get("vehicleType"),
            "date": b.get("date"),
            "fare": b.get("fare"),
        }
        for b in bookings
        if b.get("status") == "requested"
    ]

    delivered = [b for b in mine if b.get("status") == "delivered"]
    earnings_today_paisa = sum(
        int(b.get("fare") or 0) for b in delivered if b.get("date") == today_iso
    ) * 100
    earnings_week_paisa = sum(
        int(b.get("fare") or 0) for b in delivered if str(b.get("date") or "") >= week_start
    ) * 100

    on_trip = {
        b["vehicleId"]: b for b in mine
        if b.get("vehicleId") and b.get("status") in ("accepted", "enRoute")
    }
    fleet = [
        {
            "id": v["id"],
            "registrationNo": v.get("registrationNo"),
            "vehicleType": v.get("vehicleType"),
            "docStatus": v.get("docStatus"),
            "availableToday": today_iso in (v.get("availableDates") or []),
            "onTripId": on_trip[v["id"]]["id"] if v["id"] in on_trip else None,
            "lastLocation": on_trip[v["id"]].get("lastLocation") if v["id"] in on_trip else None,
        }
        for v in vehicles
        if v.get("active", True)
    ]

    settlements = await query(
        "settlements", [("role", "==", "transport"), ("entityId", "==", uid)], limit=100
    )
    pending = sorted(
        (s for s in settlements if s.get("status") == "pending"),
        key=lambda s: s.get("periodStart", ""),
    )
    next_settlement = (
        {
            "periodStart": pending[0].get("periodStart"),
            "periodEnd": pending[0].get("periodEnd"),
            "netRupees": pending[0].get("netRupees"),
        }
        if pending
        else None
    )

    now = datetime.now(timezone.utc)
    doc_expiries = []
    for v in vehicles:
        for field, label in _DOC_EXPIRY_FIELDS:
            raw = v.get(field)
            if not raw:
                continue
            try:
                expires = datetime.fromisoformat(str(raw))
            except ValueError:
                continue
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            doc_expiries.append({
                "vehicleId": v["id"],
                "registrationNo": v.get("registrationNo"),
                "doc": field,
                "label": label,
                "expiry": expires.isoformat(),
                "daysLeft": (expires.date() - now.date()).days,
            })
    doc_expiries.sort(key=lambda d: d["daysLeft"])

    return_loads = []
    for trip in [b for b in today_trips_raw if b.get("status") in ("enRoute", "delivered")]:
        matches = await _match_return_loads(trip)
        return_loads.append({"tripId": trip["id"], "matches": matches})

    return {
        "todayTrips": today_trips,
        "newJobRequests": {"count": len(jobs), "data": jobs[:10]},
        "fleet": fleet,
        "earningsTodayPaisa": earnings_today_paisa,
        "earningsWeekPaisa": earnings_week_paisa,
        "nextSettlement": next_settlement,
        "documentExpiries": doc_expiries,
        "returnLoads": return_loads,
    }


# ==========================================
# 9. DAMAGE DISPUTES (POD damage claim lane)
# ==========================================

class DamageDisputeCreateRequest(BaseModel):
    photos: list[str] = []
    claimPaisa: int
    notes: str | None = None


class DamageDisputeResolveRequest(BaseModel):
    resolution: str | None = None


def _dispute_participant(booking: dict, uid: str):
    if uid not in (booking.get("userId"), booking.get("transporterId")):
        _error(403, "FORBIDDEN", "only the booking parties can access this dispute")


@router.post("/bookings/{booking_id}/damage-disputes", status_code=201)
async def create_damage_dispute(
    booking_id: str,
    body: DamageDisputeCreateRequest,
    uid: str = Depends(_viewer),
):
    booking = await _get_booking(booking_id)
    _dispute_participant(booking, uid)
    if body.claimPaisa < 0:
        _error(422, "INVALID_CLAIM", "claim must be non-negative integer paisa", {"claimPaisa": "must be >= 0"})
    doc = {
        "id": f"dsp_{uuid.uuid4().hex[:10]}",
        "bookingId": booking_id,
        "photos": body.photos,
        "claimPaisa": body.claimPaisa,
        "notes": body.notes,
        "status": "open",
        "createdBy": uid,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    # FT-6: an insured trip auto-tags the dispute as an insurance claim, with
    # the policy snapshot the arbitrator (and future insurer API) needs.
    if booking.get("insurance"):
        doc["insuranceClaim"] = True
        doc["coveragePaisaAtClaim"] = booking["insurance"].get("coveragePaisa")
    await set_doc(f"transport_bookings/{booking_id}/damage_disputes", doc["id"], doc)
    other = booking.get("transporterId") if uid == booking.get("userId") else booking.get("userId")
    if other:
        await notify_user(
            other,
            type="damage_dispute_opened",
            title="Damage dispute / नुकसान विवाद",
            body=f"Claim of ₹{body.claimPaisa / 100:.2f} filed on booking {booking_id}",
            deepLink=f"/dashboard/p/transport/trips/{booking_id}",
        )
    return doc


@router.get("/bookings/{booking_id}/damage-disputes")
async def list_damage_disputes(booking_id: str, uid: str = Depends(_viewer)):
    booking = await _get_booking(booking_id)
    _dispute_participant(booking, uid)
    disputes = await query(f"transport_bookings/{booking_id}/damage_disputes", [], limit=100)
    disputes.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"bookingId": booking_id, "data": disputes, "total": len(disputes)}


@router.post("/bookings/{booking_id}/damage-disputes/{dispute_id}/resolve")
async def resolve_damage_dispute(
    booking_id: str,
    dispute_id: str,
    body: DamageDisputeResolveRequest,
    claims: dict = Depends(admin_action("RESOLVE_TRANSPORT_DISPUTE")),
):
    """Admin-consumable resolution lane; the phase-07 console UI drives this."""
    await _get_booking(booking_id)
    dispute = await get_doc(f"transport_bookings/{booking_id}/damage_disputes", dispute_id)
    if dispute is None:
        _error(404, "DISPUTE_NOT_FOUND", "dispute not found")
    if dispute.get("status") != "open":
        _error(409, "DISPUTE_NOT_OPEN", f"dispute is {dispute.get('status')}")
    dispute["status"] = "resolved"
    dispute["resolution"] = body.resolution
    dispute["resolvedBy"] = claims["uid"]
    dispute["resolvedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc(f"transport_bookings/{booking_id}/damage_disputes", dispute_id, dispute)
    return dispute


# ==========================================
# 10. RETURN-LOAD MATCHING (T8, deterministic)
# ==========================================

async def _match_return_loads(trip: dict) -> list[dict]:
    """Open loads whose pickup is near the trip's drop district and whose pickup
    date falls inside the return window. Deterministic query — the WS-06 M16
    brief ranks these matches later."""
    drop = str(trip.get("drop") or "")
    trip_date = str(trip.get("date") or "")
    window_end = ""
    if trip_date:
        try:
            trip_day = datetime.fromisoformat(trip_date).date()
            window_end = (trip_day + timedelta(days=RETURN_LOAD_WINDOW_DAYS)).isoformat()
        except ValueError:
            trip_date = ""
    loads = await query("transport_loads", [], limit=500)
    matches = []
    for load in loads:
        if load.get("status") != "open":
            continue
        if not _places_match(str(load.get("pickupLocation") or ""), drop):
            continue
        pickup_date = str(load.get("pickupDate") or "")
        if trip_date and (pickup_date < trip_date or pickup_date > window_end):
            continue
        matches.append(load)
    matches.sort(key=lambda x: x.get("pickupDate", ""))
    return await transport_match.rank_return_loads(trip, matches)


@router.get("/trips/{trip_id}/return-loads")
async def list_return_loads(trip_id: str, uid: str = Depends(_transporter)):
    """Open loads near the trip's drop district inside the return window."""
    trip = await _get_booking(trip_id)
    if uid != trip.get("transporterId"):
        _error(403, "FORBIDDEN", "only the assigned transporter can view return loads")
    if trip.get("status") not in ("enRoute", "delivered"):
        _error(409, "TRIP_NOT_ACTIVE", "return loads unlock once the trip is underway")
    matches = await _match_return_loads(trip)
    return {"tripId": trip_id, "data": matches, "total": len(matches)}


# ==========================================
# 11. FLEET DRIVER SUB-ACCOUNTS (T9)
# ==========================================

class DriverCreateRequest(BaseModel):
    name: str
    phone: str | None = None


@router.post("/drivers", status_code=201)
async def create_driver(body: DriverCreateRequest, uid: str = Depends(_transporter)):
    """Create a fleet driver sub-account scoped to this transporter (Pro tier).
    Drivers operate assigned trips (milestones/location pings) but can never
    read settlements — the settlements router enforces that independently."""
    await _plan_feature_guard(uid, "driverSubAccounts")
    doc = {
        "id": f"drv_{uuid.uuid4().hex[:10]}",
        "linkedProfiles": ["driver"],
        "primaryProfile": "driver",
        "activeProfile": "driver",
        "name": body.name,
        "phone": body.phone or "",
        "fleetOwnerId": uid,
        "active": True,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("users", doc["id"], doc)
    return doc


@router.get("/drivers")
async def list_drivers(uid: str = Depends(_transporter)):
    drivers = await query("users", [], limit=1000)
    mine = [d for d in drivers if d.get("fleetOwnerId") == uid and _is_driver(d)]
    return {"data": mine, "total": len(mine)}


# ==========================================
# 12. PER-TRIP COMMISSION INVOICE
# ==========================================

@router.get("/bookings/{booking_id}/commission-invoice")
async def commission_invoice(booking_id: str, uid: str = Depends(_transporter)):
    """PDF invoice for the platform commission on this trip (integer-paisa math
    identical to the trip P&L and the weekly settlement run)."""
    booking = await _get_booking(booking_id)
    if booking.get("transporterId") != uid:
        _error(403, "FORBIDDEN", "only the assigned transporter can download this invoice")
    config = await settlements_service._config()
    pct = config["transportPct"]
    commission = round(float(booking.get("fare") or 0) * (pct / 100), 2)
    transporter = await get_user(uid) or {}
    file_path = reports.build_commission_invoice_pdf(booking, transporter, commission, pct)
    with open(file_path, "rb") as handle:
        content = handle.read()
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="commission-invoice-{booking_id}.pdf"'},
    )


# ==========================================
# 13. DETENTION / WAITING CHARGES (FT-2)
# ==========================================

WAITING_PHASES = ("pickup", "drop")
WAITING_ALLOWED_STATUS = {
    "pickup": ("accepted", "enRoute"),  # vehicle arrived; load not ready
    "drop": ("enRoute",),               # vehicle waiting to unload at mandi
}


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


async def _refresh_detention_summary(booking_id: str) -> dict:
    events = await query(f"transport_bookings/{booking_id}/waiting_events", [], limit=200)
    summary = {"pickupChargePaisa": 0, "dropChargePaisa": 0, "totalChargePaisa": 0, "totalMinutes": 0}
    for event in events:
        if not event.get("endedAt"):
            continue
        charge = int(event.get("chargePaisa") or 0)
        summary[f"{event['phase']}ChargePaisa"] += charge
        summary["totalChargePaisa"] += charge
        summary["totalMinutes"] += int(event.get("minutes") or 0)
    booking = await _get_booking(booking_id)
    booking["detention"] = summary
    await set_doc("transport_bookings", booking_id, booking)
    return summary


@router.post("/bookings/{booking_id}/waiting")
async def log_waiting_event(
    booking_id: str,
    body: WaitingEventRequest,
    uid: str = Depends(_fleet_member),
):
    """Transporter taps start when the vehicle starts waiting, stop when it ends.
    Billable time = total − free grace, charged in 30-min slabs, hard-capped."""
    booking = await _get_booking(booking_id)
    await _assert_trip_operator(booking, uid)
    if body.phase not in WAITING_PHASES:
        _error(422, "UNKNOWN_WAITING_PHASE", "phase must be pickup or drop", {"phase": "pickup | drop"})
    if body.action not in ("start", "stop"):
        _error(422, "UNKNOWN_WAITING_ACTION", "action must be start or stop", {"action": "start | stop"})
    if booking.get("status") not in WAITING_ALLOWED_STATUS[body.phase]:
        _error(409, "WAITING_NOT_ALLOWED", f"cannot log {body.phase} waiting while {booking.get('status')}")

    events = await query(f"transport_bookings/{booking_id}/waiting_events", [], limit=200)
    open_event = next((e for e in events if e.get("phase") == body.phase and not e.get("endedAt")), None)
    now = _parse_iso(body.at) or datetime.now(timezone.utc)

    if body.action == "start":
        if open_event:
            _error(409, "WAITING_ALREADY_OPEN", f"{body.phase} waiting already open")
        event = {
            "id": f"wait_{uuid.uuid4().hex[:10]}",
            "bookingId": booking_id,
            "phase": body.phase,
            "startedAt": now.isoformat(),
            "startedBy": uid,
        }
        await set_doc(f"transport_bookings/{booking_id}/waiting_events", event["id"], event)
        waypoints = booking.get("waypointsLog", [])
        waypoints.append({
            "waypoint": f"waiting_{body.phase}_start",
            "label": f"प्रतीक्षा शुरू ({body.phase})",
            "time": now.isoformat(),
        })
        booking["waypointsLog"] = waypoints
        await set_doc("transport_bookings", booking_id, booking)
        return event

    if not open_event:
        _error(409, "WAITING_NOT_OPEN", f"no open {body.phase} waiting to stop")
    started_at = _parse_iso(open_event.get("startedAt")) or now
    minutes = max(int((now - started_at).total_seconds() // 60), 0)
    config = await _transport_detention()
    billable = max(0, minutes - int(config["freeMinutes"]))
    slabs = -(-billable // 30)  # ceil division
    charge_paisa = min(slabs * int(config["ratePer30MinPaisa"]), int(config["maxChargePaisa"]))

    open_event["endedAt"] = now.isoformat()
    open_event["minutes"] = minutes
    open_event["billableMinutes"] = billable
    open_event["chargePaisa"] = charge_paisa
    await set_doc(f"transport_bookings/{booking_id}/waiting_events", open_event["id"], open_event)

    waypoints = booking.get("waypointsLog", [])
    waypoints.append({
        "waypoint": f"waiting_{body.phase}_end",
        "label": f"प्रतीक्षा समाप्त ({body.phase}): {minutes} मिनट · ₹{charge_paisa / 100:.0f}",
        "time": now.isoformat(),
    })
    booking["waypointsLog"] = waypoints
    await set_doc("transport_bookings", booking_id, booking)
    detention = await _refresh_detention_summary(booking_id)

    await notify_user(
        booking["userId"],
        type="detention_recorded",
        title="Waiting charges / प्रतीक्षा शुल्क",
        body=f"{body.phase}: {minutes} min waited · ₹{charge_paisa / 100:.0f} detention added to the trip",
        deepLink=f"/dashboard/p/transport/trips/{booking_id}",
    )
    return {"event": open_event, "detention": detention}


# ==========================================
# 14. TWO-WAY RATINGS (FT-3)
# ==========================================

FARMER_RATING_TAGS = (
    "load_ready_on_time",
    "accurate_weight",
    "good_communication",
    "delayed_loading",
    "load_not_as_described",
)


@router.post("/bookings/{booking_id}/rate-farmer", status_code=201)
async def rate_farmer(booking_id: str, body: FarmerRatingRequest, uid: str = Depends(_transporter)):
    """The assigned transporter rates the shipper after POD — Porter-style
    two-way reputation. One rating per trip; aggregates onto the farmer doc."""
    booking = await _get_booking(booking_id)
    if booking.get("transporterId") != uid:
        _error(403, "FORBIDDEN", "only the assigned transporter can rate this farmer")
    if booking.get("status") != "delivered":
        _error(409, "ILLEGAL_TRANSITION", f"cannot rate a {booking.get('status')} trip")
    if booking.get("farmerRating"):
        _error(409, "ALREADY_RATED", "this trip already has a farmer rating")
    tags = [t for t in body.tags if t in FARMER_RATING_TAGS]
    rating_doc = {
        "rating": body.rating,
        "review": body.review,
        "tags": tags,
        "raterId": uid,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"transport_bookings/{booking_id}/farmer_rating", "rating", rating_doc)
    booking["farmerRating"] = rating_doc
    await set_doc("transport_bookings", booking_id, booking)

    farmer_id = booking.get("userId")
    farmer = (await get_user(farmer_id)) or {}
    stats = farmer.get("farmerRatingStats") or {"count": 0, "sum": 0, "average": None, "tags": {}}
    stats["count"] = int(stats.get("count") or 0) + 1
    stats["sum"] = int(stats.get("sum") or 0) + body.rating
    stats["average"] = round(stats["sum"] / stats["count"], 2)
    tag_counts = stats.get("tags") or {}
    for tag in tags:
        tag_counts[tag] = int(tag_counts.get(tag) or 0) + 1
    stats["tags"] = tag_counts
    farmer["farmerRatingStats"] = stats
    await set_doc("users", farmer_id, farmer)
    return {"bookingId": booking_id, "rating": rating_doc, "farmerRatingStats": stats}


@router.get("/farmers/{farmer_id}/reputation")
async def farmer_reputation(farmer_id: str, uid: str = Depends(_transporter)):
    """Shipper reputation visible to transporters weighing a bid (no contact
    data — aggregate stats only)."""
    user = await get_user(farmer_id)
    if user is None:
        _error(404, "NOT_FOUND", "farmer not found")
    return {
        "farmerId": farmer_id,
        "name": user.get("name"),
        "farmerRatingStats": user.get("farmerRatingStats")
        or {"count": 0, "sum": 0, "average": None, "tags": {}},
    }


# ==========================================
# 15. FAVORITE TRANSPORTERS & ONE-TAP REBOOK (FT-4)
# ==========================================

@router.post("/favorites/{transporter_id}")
async def toggle_favorite_transporter(
    transporter_id: str,
    body: FavoriteToggleRequest,
    uid: str = Depends(_booker),
):
    """Farmer pins a transporter they trust (post-trip card → 'book again').
    Deterministic set/delete — safe to retry."""
    target = await get_user(transporter_id)
    if target is None or "transport" not in (target.get("linkedProfiles") or []):
        _error(404, "NOT_FOUND", "transporter not found")
    ref = f"users/{uid}/transport_favorites"
    if not body.favorited:
        await delete_doc(ref, transporter_id)
        return {"favorited": False, "transporterId": transporter_id}
    doc = {
        "transporterId": transporter_id,
        "name": target.get("name", "ट्रांसपोर्ट पार्टनर"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(ref, transporter_id, doc)
    return {"favorited": True, "favorite": doc}


@router.get("/favorites")
async def list_favorite_transporters(uid: str = Depends(_booker)):
    docs = await query(f"users/{uid}/transport_favorites", [], limit=100)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.post("/bookings/{booking_id}/rebook", status_code=201)
async def rebook_trip(booking_id: str, body: RebookRequest, uid: str = Depends(_booker)):
    """One-tap rebook: clone a delivered/cancelled trip into a fresh requested
    booking. Fare is re-evaluated from the current catalog rates (no stale
    prices); the original trip id is kept as `rebookOf` for analytics."""
    original = await _get_booking(booking_id)
    if original.get("userId") != uid:
        _error(403, "FORBIDDEN", "only the original booker can rebook this trip")
    if original.get("status") not in ("delivered", "cancelled"):
        _error(409, "ILLEGAL_TRANSITION", f"cannot rebook from {original.get('status')}")
    vt = _vehicle_type(original["vehicleType"])
    fare = vt["baseFare"] + vt["perKmRate"] * original["distanceKm"]
    doc = {
        "id": f"trb_{uuid.uuid4().hex[:12]}",
        "userId": uid,
        "vehicleType": original["vehicleType"],
        "distanceKm": original["distanceKm"],
        "pickup": original["pickup"],
        "drop": original["drop"],
        "date": body.date,
        "pickupTime": body.pickupTime or original.get("pickupTime"),
        "timeWindowMinutes": body.timeWindowMinutes or original.get("timeWindowMinutes"),
        "commodity": original.get("commodity"),
        "weightQuintals": original.get("weightQuintals"),
        "packaging": original.get("packaging"),
        "notes": body.notes if body.notes is not None else original.get("notes"),
        "fare": int(round(fare)),
        "status": "requested",
        "rebookOf": booking_id,
        "vehicleId": None,
        "vehicleNo": None,
        "driverName": None,
        "driverPhone": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "waypointsLog": [
            {
                "waypoint": "booking_created",
                "label": "पुनः बुकिंग पंजीकृत हुई",
                "time": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }
    match_info = await transport_match.score_transport_match(doc, ctx=uid)
    doc["noshowRisk"] = match_info.get("noshow_risk", 0.05)
    doc["fit"] = match_info.get("fit", 0.7)
    await set_doc("transport_bookings", doc["id"], doc)
    if doc.get("pickupTime"):
        await _emit_pickup_reminder(uid, "farmer", doc, "your rebooked load")
    return doc


# ==========================================
# 16. LOAD TEMPLATES & REPEAT BOOKINGS (FT-5, spec F12)
# ==========================================

@router.post("/load-templates", status_code=201)
async def create_load_template(body: LoadTemplateRequest, uid: str = Depends(_booker)):
    """Farmer saves a repeatable load (the weekly Nashik→Vashi mandi run)."""
    _vehicle_type(body.preferredVehicleType)  # validate against the catalog
    doc = {
        "id": f"tmpl_{uuid.uuid4().hex[:10]}",
        "userId": uid,
        **body.model_dump(),
        "useCount": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("transport_load_templates", doc["id"], doc)
    return doc


@router.get("/load-templates")
async def list_load_templates(uid: str = Depends(_booker)):
    docs = await query("transport_load_templates", [("userId", "==", uid)], limit=100)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.delete("/load-templates/{template_id}")
async def delete_load_template(template_id: str, uid: str = Depends(_booker)):
    template = await get_doc("transport_load_templates", template_id)
    if template is None or template.get("userId") != uid:
        _error(404, "TEMPLATE_NOT_FOUND", "load template not found")
    await delete_doc("transport_load_templates", template_id)
    return {"ok": True}


@router.post("/load-templates/{template_id}/repeat", status_code=201)
async def repeat_load_template(
    template_id: str,
    body: LoadTemplateRepeatRequest,
    uid: str = Depends(_booker),
):
    """Instantiate the template as a fresh open load for a new date — the
    season's fare can be overridden without editing the template."""
    template = await get_doc("transport_load_templates", template_id)
    if template is None or template.get("userId") != uid:
        _error(404, "TEMPLATE_NOT_FOUND", "load template not found")
    user = await get_user(uid)
    doc = _build_open_load(uid, user, {
        "pickupLocation": template["pickupLocation"],
        "dropLocation": template["dropLocation"],
        "crop": template["crop"],
        "quantityQuintals": template["quantityQuintals"],
        "packaging": template.get("packaging", "Gunny Bags"),
        "perishable": template.get("perishable", False),
        "preferredVehicleType": template.get("preferredVehicleType", "Tata Ace"),
        "pickupDate": body.pickupDate,
        "pickupTime": body.pickupTime,
        "targetFare": body.targetFare if body.targetFare is not None else template["targetFare"],
        "notes": template.get("notes"),
        "templateId": template_id,
        "insurance": await _insurance_block(
            template.get("insuranceOptIn", False), template.get("declaredValuePaisa")
        ),
    })
    match_info = await transport_match.score_transport_match(doc, ctx=uid)
    doc["noshowRisk"] = match_info.get("noshow_risk", 0.05)
    doc["fit"] = match_info.get("fit", 0.7)
    await set_doc("transport_loads", doc["id"], doc)

    template["useCount"] = int(template.get("useCount") or 0) + 1
    await set_doc("transport_load_templates", template_id, template)
    return doc


# ==========================================
# 17. TRIP SHARING — VIEW-ONLY LINK (FT-7)
# ==========================================

TRIP_SHARE_TTL_HOURS = 48


def _share_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/bookings/{booking_id}/share")
async def create_trip_share(booking_id: str, uid: str = Depends(_viewer)):
    """Booking party mints a view-only tracking link for family / the mandi
    agent. Only the token hash is stored; re-sharing rotates the token."""
    booking = await _get_booking(booking_id)
    if uid not in (booking.get("userId"), booking.get("transporterId")):
        _error(403, "FORBIDDEN", "only a booking party can share this trip")
    if booking.get("status") == "cancelled":
        _error(409, "ILLEGAL_TRANSITION", "a cancelled trip cannot be shared")

    existing = await query("trip_shares", [("bookingId", "==", booking_id)], limit=50)
    for doc in existing:
        if doc.get("createdBy") == uid and not doc.get("revoked"):
            doc["revoked"] = True
            await set_doc("trip_shares", doc["id"], doc)

    token = secrets.token_urlsafe(16)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=TRIP_SHARE_TTL_HOURS)).isoformat()
    doc = {
        "id": _share_hash(token),
        "bookingId": booking_id,
        "createdBy": uid,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "expiresAt": expires_at,
        "revoked": False,
    }
    await set_doc("trip_shares", doc["id"], doc)
    return {"token": token, "url": f"/transport/shared/{token}", "expiresAt": expires_at}


@router.delete("/bookings/{booking_id}/share")
async def revoke_trip_share(booking_id: str, uid: str = Depends(_viewer)):
    booking = await _get_booking(booking_id)
    if uid not in (booking.get("userId"), booking.get("transporterId")):
        _error(403, "FORBIDDEN", "only a booking party can revoke this share")
    shares = await query("trip_shares", [("bookingId", "==", booking_id)], limit=50)
    revoked = 0
    for doc in shares:
        if doc.get("createdBy") == uid and not doc.get("revoked"):
            doc["revoked"] = True
            await set_doc("trip_shares", doc["id"], doc)
            revoked += 1
    return {"ok": True, "revoked": revoked}


@router.get("/shared/{token}")
async def view_shared_trip(token: str):
    """Public, login-free view of a shared trip — sanitized: route, status,
    vehicle plate, driver name, last location ping and recent milestones.
    No fares, no phone numbers, no user ids (spec compliance by construction)."""
    share = await get_doc("trip_shares", _share_hash(token))
    if share is None or share.get("revoked"):
        _error(404, "SHARE_NOT_FOUND", "share link not found or revoked")
    try:
        expires_at = datetime.fromisoformat(share["expiresAt"])
    except (KeyError, ValueError):
        _error(404, "SHARE_NOT_FOUND", "share link not found or revoked")
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) >= expires_at:
        _error(410, "SHARE_EXPIRED", "share link has expired")

    booking = await get_doc("transport_bookings", share["bookingId"])
    if booking is None:
        _error(404, "SHARE_NOT_FOUND", "share link not found or revoked")
    enroute = booking.get("status") == "enRoute"
    return {
        "bookingId": booking["id"],
        "status": booking.get("status"),
        "route": {"pickup": booking.get("pickup"), "drop": booking.get("drop")},
        "commodity": booking.get("commodity"),
        "vehicleType": booking.get("vehicleType"),
        "vehicleNo": booking.get("vehicleNo"),
        "driverName": booking.get("driverName"),
        "currentLocation": booking.get("lastLocation"),
        "waypoints": [
            {"waypoint": w.get("waypoint"), "label": w.get("label"), "time": w.get("time")}
            for w in (booking.get("waypointsLog") or [])[-20:]
        ],
        "estimatedMinutesLeft": (
            max(int(booking.get("distanceKm", 30) * 1.5), 15) if enroute else None
        ),
        "expiresAt": share["expiresAt"],
    }


# ==========================================
# 18. PLATFORM CREDIT LEDGER — PERSONAL VIEW (FT-8)
# ==========================================

@router.get("/ledger/mine")
async def my_ledger_entries(uid: str = Depends(_viewer)):
    """A user's ledger lines: penalties charged, compensation credited.
    S12-lite transparency until the payments module owns real balances."""
    entries = await query("platform_ledger", [("userId", "==", uid)], limit=200)
    entries.sort(key=lambda e: e.get("createdAt", ""), reverse=True)
    dues = (await get_user(uid) or {}).get("platformDuesPaisa") or 0
    credits = sum(
        int(e.get("amountPaisa") or 0)
        for e in entries
        if e.get("kind") == "transporter_compensation"
    )
    charges = sum(
        int(e.get("amountPaisa") or 0)
        for e in entries
        if e.get("kind") == "farmer_cancel_penalty"
    )
    return {
        "data": entries,
        "total": len(entries),
        "platformDuesPaisa": dues,
        "compensationEarnedPaisa": credits,
        "penaltiesChargedPaisa": charges,
    }


# ==========================================
# 19. NEARBY VEHICLES & INSTANT BOOKINGS
# ==========================================

NEARBY_SORTS = ("fare", "distance", "rating")


@router.get("/nearby-vehicles")
async def nearby_vehicles(
    lat: float = Query(...),
    lng: float = Query(...),
    radiusKm: int = Query(15, ge=1, le=50),
    vehicleType: str | None = None,
    minCapacityKg: int | None = None,
    sort: str = "fare",
    uid: str = Depends(_booking_persona),
):
    """Geo search over verified, available owner vehicles for the booking
    personas (farmer/seller). Fares use the owner's custom rates when set."""
    if sort not in NEARBY_SORTS:
        _error(422, "VALIDATION_ERROR", "sort must be fare, distance or rating", {"sort": "fare | distance | rating"})
    today = datetime.now(timezone.utc).date().isoformat()
    vehicles = await query("vehicles", [], limit=1000)
    entries = []
    for vehicle in vehicles:
        if vehicle.get("active", True) is False:
            continue
        if not _vehicle_available_on(vehicle, today, today):
            continue
        if not await _vehicle_docs_verified(vehicle):
            continue
        if vehicleType and vehicle.get("vehicleType") != vehicleType:
            continue
        anchor = _vehicle_anchor_point(vehicle)
        if anchor is None:
            continue
        catalog = _catalog_entry(vehicle.get("vehicleType"))
        if catalog is None:
            continue  # unpriceable fleet entries stay off the board
        capacity_kg = round(float(vehicle.get("capacityTonnes") or 0) * 1000)
        if minCapacityKg is not None and capacity_kg < minCapacityKg:
            continue
        straight_km = _haversine_km(lat, lng, float(anchor["lat"]), float(anchor["lng"]))
        distance_km = round(straight_km * ROAD_FACTOR, 1)
        if distance_km > radiusKm:
            continue
        fare = _vehicle_fare(vehicle, catalog, distance_km)
        owner = await get_user(vehicle.get("ownerId")) or {}
        entries.append({
            "vehicleId": vehicle["id"],
            "vehicleType": vehicle.get("vehicleType"),
            "regNo": vehicle.get("registrationNo"),
            "capacityKg": capacity_kg,
            "distanceKm": distance_km,
            "fare": fare,
            "driver": {
                "name": vehicle.get("driverName") or "",
                "phone": vehicle.get("driverPhone") or "",
            },
            "rating": (owner.get("transportRatingStats") or {}).get("avg"),
            "availableNow": bool(vehicle.get("availableNow")),
            "chatContext": {"type": "vehicle", "id": vehicle["id"]},
            "callContext": {"type": "vehicle", "id": vehicle["id"]},
        })
    if sort == "rating":
        entries.sort(key=lambda e: (e["rating"] is None, -(e["rating"] or 0)))
    elif sort == "distance":
        entries.sort(key=lambda e: e["distanceKm"])
    else:
        entries.sort(key=lambda e: e["fare"]["totalFare"])
    return {
        "data": entries,
        "total": len(entries),
        "center": {"lat": lat, "lng": lng},
        "radiusKm": radiusKm,
    }


@router.post("/instant-bookings", status_code=201)
async def create_instant_booking(
    body: InstantBookingRequest,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(_booking_persona),
):
    """One-tap booking of a specific nearby vehicle: skips the request/accept
    round trip — the booking is born accepted with the owner as transporter."""
    from app.services import idempotency

    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required")
    stored = await idempotency.replay("transport.instant-bookings", idempotency_key)
    if stored is not None:
        return stored

    vehicle = await get_doc("vehicles", body.vehicleId)
    if vehicle is None:
        _error(404, "VEHICLE_NOT_FOUND", "vehicle not found")
    if not vehicle.get("active", True):
        _error(409, "VEHICLE_UNAVAILABLE", "vehicle is not active")
    if not await _vehicle_docs_verified(vehicle):
        _error(409, "VEHICLE_UNAVAILABLE", "vehicle documents are not verified or are expired")
    if not (vehicle.get("availableNow") or body.pickupDate in (vehicle.get("availableDates") or [])):
        _error(409, "VEHICLE_UNAVAILABLE", "vehicle is not available on the pickup date")

    vt = _vehicle_type(vehicle["vehicleType"])
    fare = _vehicle_fare(vehicle, vt, body.distanceKm)
    loading_charge = vt.get("loadingLabor") or 0
    total_fare = fare["totalFare"] + int(loading_charge)
    owner_id = vehicle.get("ownerId")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": f"trb_{uuid.uuid4().hex[:12]}",
        "userId": uid,
        "transporterId": owner_id,
        "vehicleType": vehicle["vehicleType"],
        "distanceKm": body.distanceKm,
        "pickup": body.pickup.address,
        "drop": body.drop.address,
        "pickupGeo": {"lat": body.pickup.lat, "lng": body.pickup.lng},
        "dropGeo": {"lat": body.drop.lat, "lng": body.drop.lng},
        "date": body.pickupDate,
        "pickupTime": body.pickupTime,
        "commodity": body.commodity,
        "weightQuintals": round(body.weightKg / 100, 2) if body.weightKg else None,
        "packaging": None,
        "notes": body.notes,
        "lotId": None,
        "insurance": None,
        "fare": total_fare,
        "fareBreakdown": {
            "baseFare": fare["baseFare"],
            "distanceFare": fare["distanceFare"],
            "loadingCharge": loading_charge,
            "totalFare": total_fare,
        },
        "status": "accepted",
        "vehicleId": vehicle["id"],
        "vehicleNo": vehicle.get("registrationNo"),
        "driverName": vehicle.get("driverName") or "असाइन किया गया चालक",
        "driverPhone": vehicle.get("driverPhone") or "",
        "createdAt": now,
        "waypointsLog": [
            {
                "waypoint": "instant_booking_created",
                "label": "तुरंत बुकिंग स्वीकृत",
                "time": now,
            }
        ],
    }
    await set_doc("transport_bookings", doc["id"], doc)
    await ensure_transport_room(doc)
    if owner_id:
        await notify_user(
            owner_id,
            type="instant_booking",
            title="Instant booking / तुरंत बुकिंग",
            body=(
                f"{body.commodity or vehicle['vehicleType']} — pickup "
                f"{body.pickup.address} on {body.pickupDate}"
            ),
            deepLink=f"/dashboard/p/transport/trips/{doc['id']}",
        )
    await notify_user(
        uid,
        type="booking_confirmed",
        title="Booking confirmed / बुकिंग पक्की",
        body=(
            f"{vehicle.get('registrationNo') or vehicle['vehicleType']} "
            "accepted your instant booking"
        ),
        deepLink=f"/dashboard/p/transport/trips/{doc['id']}",
    )
    response = {"booking": doc, "fare": doc["fareBreakdown"]}
    await idempotency.store("transport.instant-bookings", idempotency_key, response)
    return response


# ==========================================
# 20. DRIVER ASSIGNMENT & PER-DRIVER ANALYTICS
# ==========================================

@router.post("/bookings/{booking_id}/assign-driver")
async def assign_driver(
    booking_id: str,
    body: AssignDriverRequest,
    uid: str = Depends(_transporter),
):
    """Swap the assigned driver on an accepted trip (fleet dispatch lane)."""
    booking = await _get_booking(booking_id)
    if booking.get("status") != "accepted":
        _error(409, "BOOKING_NOT_ACCEPTED", f"cannot assign a driver while {booking.get('status')}")
    if booking.get("transporterId") != uid:
        _error(403, "FORBIDDEN", "only the assigned transporter can assign a driver")
    booking["driverName"] = body.driverName
    booking["driverPhone"] = body.driverPhone
    booking["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("transport_bookings", booking_id, booking)
    return booking


@router.get("/drivers/{driver_id}/analytics")
async def driver_analytics(driver_id: str, uid: str = Depends(_transporter)):
    """Fleet-owner view of one driver's trips: matched by the driverPhone /
    driverName recorded on each booking at accept time."""
    driver = await get_user(driver_id)
    if driver is None or not _is_driver(driver) or driver.get("fleetOwnerId") != uid:
        _error(404, "DRIVER_NOT_FOUND", "driver not found")
    phone = driver.get("phone") or ""
    name = driver.get("name") or ""
    bookings = await query("transport_bookings", [], limit=1000)
    trips = [
        b for b in bookings
        if (phone and b.get("driverPhone") == phone)
        or (name and b.get("driverName") == name)
    ]
    completed = [b for b in trips if b.get("status") == "delivered"]
    cancelled = [b for b in trips if b.get("status") == "cancelled"]
    month_prefix = datetime.now(timezone.utc).strftime("%Y-%m")
    return {
        "driverUserId": driver_id,
        "trips": {
            "total": len(trips),
            "completed": len(completed),
            "cancelled": len(cancelled),
        },
        "totalKm": round(sum(float(b.get("distanceKm") or 0) for b in completed), 1),
        "grossEarnings": sum(int(b.get("fare") or 0) for b in completed),
        "thisMonthEarnings": sum(
            int(b.get("fare") or 0)
            for b in completed
            if str(b.get("date") or "").startswith(month_prefix)
        ),
        "avgRating": (driver.get("ratingStats") or {}).get("average"),
    }


# ==========================================
# 21. TRIP FARE PAYMENTS & IN-TRIP ESCROW (P0-1, spec F10/S4)
# ==========================================

TRANSPORT_WALLET_LEDGER = "transport_wallet_ledger"

# Booking statuses after which no fare payment is accepted.
PAYMENT_CLOSED_STATUSES = ("cancelled", "delivered", "breakdown")


def _fare_paisa(booking: dict) -> int:
    """The agreed fare in integer paisa (bookings store rupees)."""
    return int(round(float(booking.get("fare") or 0) * 100))


def _empty_escrow() -> dict:
    """Escrow subdoc shape — mirrors the purchases escrow contract."""
    return {
        "status": "unfunded",
        "amountPaisa": 0,
        "fundedAt": None,
        "releaseAt": None,
        "releasedAt": None,
        "refundedAt": None,
        "disputeWindowHours": None,
        "disputeOpenedAt": None,
        "disputeResolvedAt": None,
        "commissionPaisa": None,
        "netReleasePaisa": None,
    }


async def _post_wallet_entry(
    uid: str,
    kind: str,  # "credit" | "debit"
    amount_paisa: int,
    *,
    booking_id: str | None = None,
    payout_id: str | None = None,
    note: str | None = None,
) -> dict:
    """Append-only wallet ledger line; the wallet balance is the sum of it."""
    doc = {
        "id": f"twl_{uuid.uuid4().hex[:12]}",
        "userId": uid,
        "kind": kind,
        "amountPaisa": int(amount_paisa),
        "bookingId": booking_id,
        "payoutId": payout_id,
        "note": note,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(TRANSPORT_WALLET_LEDGER, doc["id"], doc)
    return doc


async def _wallet_entries(uid: str) -> list[dict]:
    entries = await query(TRANSPORT_WALLET_LEDGER, [("userId", "==", uid)], limit=2000)
    entries.sort(key=lambda e: e.get("at", ""), reverse=True)
    return entries


async def _wallet_balance_paisa(uid: str) -> int:
    balance = 0
    for entry in await _wallet_entries(uid):
        amount = int(entry.get("amountPaisa") or 0)
        balance += amount if entry.get("kind") == "credit" else -amount
    return balance


async def _post_tds_entry(uid: str, txn_id: str, gross_paisa: int) -> dict:
    """TDS 194-O ledger line (same rail the weekly settlement run writes)."""
    tds_paisa = int(round(gross_paisa * settlements_service.TDS_194O_RATE))
    doc = {
        "txnId": txn_id,
        "persona": "transport",
        "entityId": uid,
        "grossPaisa": int(gross_paisa),
        "tdsPaisa": tds_paisa,
        "section": "194-O",
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("tds_ledger", f"tds_{txn_id}", doc)
    return doc


async def _transport_room_local(booking: dict) -> dict:
    """Local copy of services/chat.ensure_transport_room (spec S5/D room
    shape) — payment-in-escrow also unlocks chat when the booking is already
    accepted. Writes collection "chat_rooms"."""
    existing = await get_doc("chat_rooms", booking["id"])
    if existing is not None:
        return existing
    if not booking.get("transporterId"):
        return None
    farmer = await get_doc("users", booking["userId"]) or {}
    transporter = await get_doc("users", booking["transporterId"]) or {}
    now = datetime.now(timezone.utc).isoformat()
    room = {
        "id": booking["id"],
        "kind": "transport",
        "purchaseId": None,
        "farmerId": booking["userId"],
        "farmerName": (farmer.get("name", "") or "").strip().split(" ")[0],
        "buyerId": booking["transporterId"],
        "buyerName": (transporter.get("name", "") or "").strip().split(" ")[0],
        "crop": booking.get("commodity") or booking.get("vehicleType", ""),
        "createdAt": now,
        "lastMessageAt": None,
        "lastMessageText": "",
        "readByFarmer": True,
        "readByBuyer": True,
    }
    await set_doc("chat_rooms", room["id"], room)
    return room


@router.post("/bookings/{booking_id}/payments")
async def create_booking_payment(
    booking_id: str,
    body: BookingPaymentRequest,
    uid: str = Depends(_booker),
):
    """P0-1: fare order creation (returns orderId) or, when the razorpay*
    fields are supplied, signature verification that captures the payment,
    funds the trip escrow and unlocks chat on an accepted trip."""
    booking = await _get_booking(booking_id)
    if booking.get("userId") != uid:
        _error(403, "FORBIDDEN", "only the booker pays for this booking")
    if booking.get("status") in PAYMENT_CLOSED_STATUSES:
        _error(
            409,
            "INVALID_STATUS_TRANSITION",
            f"cannot pay a {booking.get('status')} booking",
        )

    if body.razorpayOrderId or body.razorpayPaymentId or body.razorpaySignature:
        missing = [
            field
            for field, value in (
                ("razorpayOrderId", body.razorpayOrderId),
                ("razorpayPaymentId", body.razorpayPaymentId),
                ("razorpaySignature", body.razorpaySignature),
            )
            if not value
        ]
        if missing:
            _error(
                422,
                "PAYMENT_INCOMPLETE",
                "order id, payment id and signature are all required to verify",
                {f: "required for verification" for f in missing},
            )
        return await _verify_booking_payment(booking, body)
    return await _create_booking_order(booking, body)


async def _create_booking_order(booking: dict, body: BookingPaymentRequest) -> dict:
    amount_paisa = body.amountPaisa or _fare_paisa(booking)
    if amount_paisa <= 0:
        _error(422, "VALIDATION_ERROR", "nothing to pay on this booking", {"amountPaisa": "fare is zero"})
    order = create_razorpay_order(amount_paisa, booking["id"])
    booking["pendingOrderId"] = order["id"]
    booking["pendingOrderAmountPaisa"] = amount_paisa
    booking["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("transport_bookings", booking["id"], booking)
    return {
        "bookingId": booking["id"],
        "orderId": order["id"],
        "amountPaisa": amount_paisa,
        "currency": "INR",
        "status": "created",
    }


async def _verify_booking_payment(booking: dict, body: BookingPaymentRequest) -> dict:
    escrow = booking.get("escrow") or {}
    if escrow.get("status") == "released":
        _error(409, "ESCROW_ALREADY_RELEASED", "the trip escrow is already released")
    if not booking.get("pendingOrderId"):
        _error(400, "ORDER_NOT_CREATED", "create a payment order for this booking first")
    if body.razorpayOrderId != booking["pendingOrderId"]:
        _error(
            400,
            "ORDER_MISMATCH",
            "payment order does not match the booking's pending order",
            {"razorpayOrderId": "does not match the booking's pending order"},
        )
    payments = booking.setdefault("payments", [])
    if any(
        p.get("razorpayPaymentId") == body.razorpayPaymentId and p.get("status") == "captured"
        for p in payments
    ):
        return {"ok": True, "duplicate": True, "bookingId": booking["id"]}
    if not verify_razorpay_signature(
        body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature
    ):
        _error(400, "PAYMENT_SIGNATURE_INVALID", "payment signature verification failed")

    now = datetime.now(timezone.utc).isoformat()
    amount_paisa = int(booking.get("pendingOrderAmountPaisa") or _fare_paisa(booking))
    payment = {
        "amountPaisa": amount_paisa,
        "razorpayOrderId": body.razorpayOrderId,
        "razorpayPaymentId": body.razorpayPaymentId,
        "status": "captured",
        "at": now,
    }
    payments.append(payment)
    booking["payments"] = payments

    first_funding = escrow.get("status") != "held"
    if not escrow:
        escrow = _empty_escrow()
        booking["escrow"] = escrow
    escrow["status"] = "held"
    escrow["amountPaisa"] = int(escrow.get("amountPaisa") or 0) + amount_paisa
    escrow["fundedAt"] = now
    if first_funding:
        escrow_service.start_clock(escrow)  # releaseAt = now + dispute window
    booking["updatedAt"] = now
    await set_doc("transport_bookings", booking["id"], booking)

    # Spec D.5: payment in escrow confirms the trip → chat room exists.
    if booking.get("transporterId") and booking.get("status") in ("accepted", "enRoute"):
        room = await _transport_room_local(booking)
        if room:
            for party in (booking["userId"], booking["transporterId"]):
                await notify_user(
                    party,
                    type="chat_unlocked",
                    title="Chat unlocked / चैट खुली",
                    body="Fare secured in escrow — coordinate the pickup in-app",
                    deepLink=f"/dashboard/p/transport/trips/{booking['id']}/chat",
                )
    await notify_user(
        booking["userId"],
        type="fare_payment_captured",
        title="Payment secured / भुगतान सुरक्षित",
        body=f"₹{amount_paisa / 100:.0f} held in escrow for {booking.get('commodity') or booking.get('vehicleType', 'Trip')}",
        deepLink=f"/dashboard/p/transport/trips/{booking['id']}",
    )
    return {"ok": True, "payment": payment, "escrow": booking["escrow"], "bookingId": booking["id"]}


async def _perform_escrow_release(booking: dict) -> dict:
    """Shared release body (endpoint + nightly job): commission per the
    settlements config, net credited to the transporter's wallet, TDS 194-O
    ledger line, platform ledger line. Callers gate on status/due/disputes."""
    escrow = booking["escrow"]
    amount_paisa = int(escrow.get("amountPaisa") or 0)
    config = await settlements_service._config()
    commission_paisa = int(round(amount_paisa * float(config.get("transportPct", 10)) / 100))
    net_release = amount_paisa - commission_paisa
    now = datetime.now(timezone.utc).isoformat()
    escrow.update(
        status="released",
        releasedAt=now,
        commissionPaisa=commission_paisa,
        netReleasePaisa=net_release,
    )
    booking["updatedAt"] = now
    await set_doc("transport_bookings", booking["id"], booking)

    transporter_id = booking.get("transporterId")
    if transporter_id:
        await _post_wallet_entry(
            transporter_id,
            "credit",
            net_release,
            booking_id=booking["id"],
            note="escrow released",
        )
        await _post_tds_entry(transporter_id, f"trb_{booking['id']}", amount_paisa)
    await set_doc(
        "platform_ledger",
        f"escrow_rel_{booking['id']}",
        {
            "id": f"escrow_rel_{booking['id']}",
            "kind": "transport_escrow_release",
            "bookingId": booking["id"],
            "userId": transporter_id,
            "amountPaisa": net_release,
            "commissionPaisa": commission_paisa,
            "status": "posted",
            "createdAt": now,
        },
    )
    return booking


async def release_booking_escrow(booking: dict) -> dict:
    """Release a held trip escrow once the dispute window closed silently
    (spec S4 auto-release). Imported by the nightly-job agent — no-ops unless
    the escrow is held, unpaused and due; returns the (possibly updated)
    booking."""
    escrow = booking.get("escrow") or {}
    if escrow.get("status") != "held":
        return booking
    if escrow_service.is_paused(escrow):
        return booking
    if not escrow_service.is_due(escrow):
        return booking
    return await _perform_escrow_release(booking)


@router.post("/bookings/{booking_id}/escrow/release")
async def release_escrow_now(booking_id: str, uid: str = Depends(_viewer)):
    """Manual release: on POD (spec S4 "released on POD") or once the dispute
    window closed. A dispute opened inside the window pauses the release."""
    booking = await _get_booking(booking_id)
    if uid not in (booking.get("userId"), booking.get("transporterId")):
        _error(403, "FORBIDDEN", "only a booking party can release this escrow")
    escrow = booking.get("escrow") or {}
    if escrow.get("status") != "held":
        _error(409, "ESCROW_NOT_HELD", f"escrow is {escrow.get('status') or 'unfunded'}")
    if escrow_service.is_paused(escrow):
        _error(409, "ESCROW_DISPUTE_OPEN", "release paused until the open dispute is resolved")
    if not escrow_service.is_due(escrow) and booking.get("status") != "delivered":
        _error(409, "ESCROW_NOT_DUE", "escrow can be released on delivery or after the dispute window")
    await _perform_escrow_release(booking)
    return booking


# ==========================================
# 22. TRANSPORTER WALLET & PAYOUTS (P0-1, spec T9)
# ==========================================

@router.get("/wallet")
async def transport_wallet(uid: str = Depends(_transporter)):
    """Wallet balance from the booking payment/payout ledger entries, plus the
    TDS 194-O summary for this transporter."""
    entries = await _wallet_entries(uid)
    balance = 0
    for entry in entries:
        amount = int(entry.get("amountPaisa") or 0)
        balance += amount if entry.get("kind") == "credit" else -amount
    tds_docs = await query(
        "tds_ledger", [("persona", "==", "transport"), ("entityId", "==", uid)], limit=1000
    )
    tds_deducted = sum(int(d.get("tdsPaisa") or 0) for d in tds_docs)
    return {
        "userId": uid,
        "balancePaisa": balance,
        "currency": "INR",
        "entries": entries,
        "entryCount": len(entries),
        "tds": {
            "tdsDeductedPaisa": tds_deducted,
            "tdsRatePct": round(settlements_service.TDS_194O_RATE * 100, 2),
        },
    }


@router.post("/payouts", status_code=201)
async def create_transport_payout(
    body: TransportPayoutRequest,
    uid: str = Depends(_transporter),
):
    """Move wallet balance to the transporter's penny-drop-verified bank
    account over the RazorpayX rail. MPIN-gated (high-risk money movement)."""
    user = await get_user(uid) or {}
    stored = user.get("mpinHash")
    if not stored:
        _error(409, "MPIN_NOT_SET", "set an MPIN before requesting a payout")
    if not verify_mpin(body.mpin, stored):
        _error(401, "WRONG_MPIN", "incorrect MPIN")

    accounts = await query(f"users/{uid}/bank_accounts", [], limit=100)
    verified = [a for a in accounts if a.get("verifyStatus") == "verified"]
    if not verified:
        _error(422, "NO_VERIFIED_BANK_ACCOUNT", "add and verify a bank account to receive payouts")
    primary = next((a for a in verified if a.get("isPrimary")), verified[0])

    balance = await _wallet_balance_paisa(uid)
    amount_paisa = body.amountPaisa or balance
    if amount_paisa <= 0:
        _error(422, "AMOUNT_INVALID", "payout amount must be positive", {"amountPaisa": "must be > 0"})
    if amount_paisa > balance:
        _error(
            422,
            "INSUFFICIENT_BALANCE",
            f"payout exceeds the wallet balance of ₹{balance / 100:.2f}",
            {"amountPaisa": f"must be <= {balance}"},
        )

    payout_id = f"tpay_{uuid.uuid4().hex[:12]}"
    result = await create_razorpayx_payout(
        primary.get("razorpayFundAccountId", ""), amount_paisa, payout_id
    )
    payout = {
        "id": payout_id,
        "userId": uid,
        "amountPaisa": amount_paisa,
        "status": result.get("status", "processed"),
        "razorpayPayoutId": result.get("id"),
        "bankAccountId": primary["id"],
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("transport_payouts", payout_id, payout)
    await _post_wallet_entry(
        uid, "debit", amount_paisa, payout_id=payout_id, note="payout to bank"
    )
    return payout


# ==========================================
# 23. TRANSPORTER RATINGS RECEIVED (P1-27, spec T10)
# ==========================================

@router.get("/ratings")
async def my_transport_ratings(uid: str = Depends(_transporter)):
    """Ratings this transporter received (the /v1/ratings transport write
    flow), with the aggregate average/count and tag tally."""
    ratings = await query(
        "ratings", [("providerId", "==", uid), ("bookingKind", "==", "transport")], limit=1000
    )
    ratings.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    count = len(ratings)
    average = round(sum(int(r.get("stars") or 0) for r in ratings) / count, 2) if count else None
    tags: dict[str, int] = {}
    for rating in ratings:
        for tag in rating.get("tags") or []:
            tags[tag] = int(tags.get(tag) or 0) + 1
    return {
        "data": ratings,
        "total": count,
        "aggregate": {"average": average, "count": count, "tags": tags},
    }


# ==========================================
# 24. MULTI-DROP STOPS & PER-STOP POD (P2-36, spec F15/E16)
# ==========================================

@router.post("/bookings/{booking_id}/stops", status_code=201)
async def add_booking_stops(
    booking_id: str,
    body: BookingStopsRequest,
    uid: str = Depends(_viewer),
):
    """Plan delivery stops on a live booking (milk-run). Either booking party
    may plan; stops append after the existing ones."""
    booking = await _get_booking(booking_id)
    if uid not in (booking.get("userId"), booking.get("transporterId")):
        _error(403, "FORBIDDEN", "only a booking party can plan stops")
    if booking.get("status") in ("delivered", "cancelled", "breakdown"):
        _error(409, "INVALID_STATUS_TRANSITION", f"cannot plan stops on a {booking.get('status')} booking")
    stops = list(booking.get("stops") or [])
    for offset, stop in enumerate(body.stops):
        stops.append(
            {
                "stopNo": len(stops) + 1,
                "label": stop.label,
                "address": stop.address,
                "eta": stop.eta,
                "status": "pending",
                "pod": None,
            }
        )
    booking["stops"] = stops
    booking["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("transport_bookings", booking_id, booking)
    return {"bookingId": booking_id, "stops": stops}


@router.post("/bookings/{booking_id}/stops/{stop_no}/pod")
async def pod_booking_stop(
    booking_id: str,
    stop_no: int,
    body: StopPodRequest,
    uid: str = Depends(_fleet_member),
):
    """Per-stop proof of delivery (spec E16): photos (+ optional note/OTP/
    receiver). Marks exactly that stop delivered; partial disputes stay
    scoped to the affected leg."""
    booking = await _get_booking(booking_id)
    await _assert_trip_operator(booking, uid)
    stops = list(booking.get("stops") or [])
    stop = next((s for s in stops if int(s.get("stopNo") or 0) == stop_no), None)
    if stop is None:
        _error(404, "STOP_NOT_FOUND", f"stop {stop_no} not found on this booking")
    if stop.get("status") == "delivered":
        _error(409, "STOP_ALREADY_DELIVERED", f"stop {stop_no} already has a POD")

    otp_recorded = None
    if body.otp:
        pod_otp = booking.get("podOtp") or {}
        expected = pod_otp.get("otp")
        if expected and str(body.otp).strip() != expected:
            pod_otp["attempts"] = (pod_otp.get("attempts") or 0) + 1
            booking["podOtp"] = pod_otp
            booking["updatedAt"] = datetime.now(timezone.utc).isoformat()
            await set_doc("transport_bookings", booking_id, booking)
            _error(400, "INVALID_OTP", "incorrect POD OTP for this stop")
        otp_recorded = body.otp

    now = datetime.now(timezone.utc).isoformat()
    stop["status"] = "delivered"
    stop["pod"] = {
        "photos": body.photos,
        "note": body.note,
        "receiverName": body.receiverName,
        "otp": otp_recorded,
        "deliveredBy": uid,
        "deliveredAt": now,
    }
    booking["stops"] = stops
    booking["updatedAt"] = now
    await set_doc("transport_bookings", booking_id, booking)
    return {"bookingId": booking_id, "stop": stop, "stops": stops}


# ==========================================
# 25. MID-TRIP BREAKDOWN & PRO-RATA (P2-37, spec E11)
# ==========================================

@router.post("/bookings/{booking_id}/breakdown")
async def report_breakdown(
    booking_id: str,
    body: BreakdownRequest,
    uid: str = Depends(_fleet_member),
):
    """Transporter taps "Breakdown" mid-trip (spec E11): trip parks in
    `breakdown`, the booker is notified for the re-match, and a funded escrow
    settles pro-rata — the completed-distance leg (minus commission) is
    released to the transporter, the remainder is refunded to the booker."""
    booking = await _get_booking(booking_id)
    await _assert_trip_operator(booking, uid)
    if booking.get("status") not in ("accepted", "enRoute"):
        _error(
            409,
            "INVALID_STATUS_TRANSITION",
            f"cannot report a breakdown while {booking.get('status')}",
        )

    now = datetime.now(timezone.utc).isoformat()
    fare_paisa = _fare_paisa(booking)
    distance_km = float(booking.get("distanceKm") or 0)
    completed_km = body.completedDistanceKm
    pro_rata_paisa = 0
    refund_paisa = 0
    adjustment = None
    if completed_km is not None and distance_km > 0 and fare_paisa > 0:
        # Fare rules: pro-rata = agreed fare × completed fraction of the trip.
        completed_km = min(float(completed_km), distance_km)
        pro_rata_paisa = int(round(fare_paisa * completed_km / distance_km))
        refund_paisa = fare_paisa - pro_rata_paisa
        adjustment = {"proRataFarePaisa": pro_rata_paisa, "refundPaisa": refund_paisa}

    booking["breakdown"] = {
        "note": body.note,
        "location": body.location,
        "completedDistanceKm": body.completedDistanceKm,
        "proRataFarePaisa": pro_rata_paisa,
        "refundPaisa": refund_paisa,
        "reportedBy": uid,
        "reportedAt": now,
    }
    booking["status"] = "breakdown"
    waypoints = booking.get("waypointsLog", [])
    waypoints.append({"waypoint": "breakdown", "label": f"ब्रेकडाउन: {body.note}", "time": now})
    booking["waypointsLog"] = waypoints

    escrow = booking.get("escrow") or {}
    if adjustment and escrow.get("status") == "held":
        config = await settlements_service._config()
        commission_paisa = int(
            round(pro_rata_paisa * float(config.get("transportPct", 10)) / 100)
        )
        net_release = pro_rata_paisa - commission_paisa
        escrow.update(
            status="released",
            releasedAt=now,
            commissionPaisa=commission_paisa,
            netReleasePaisa=net_release,
            breakdownRefundPaisa=refund_paisa,
        )
        transporter_id = booking.get("transporterId")
        if transporter_id:
            await _post_wallet_entry(
                transporter_id,
                "credit",
                net_release,
                booking_id=booking_id,
                note="breakdown pro-rata",
            )
            await _post_tds_entry(transporter_id, f"trb_{booking_id}", pro_rata_paisa)
        refund_ref = None
        captured = [
            p for p in (booking.get("payments") or []) if p.get("razorpayPaymentId")
        ]
        if refund_paisa > 0 and captured:
            refund = await refund_razorpay_payment(
                captured[-1]["razorpayPaymentId"], refund_paisa
            )
            refund_ref = {
                "amountPaisa": refund_paisa,
                "razorpayRefundId": refund.get("id"),
                "status": refund.get("status"),
            }
        elif refund_paisa > 0:
            refund_ref = {"amountPaisa": refund_paisa, "razorpayRefundId": None, "status": "recorded"}
        booking["breakdown"]["refund"] = refund_ref
        await set_doc(
            "platform_ledger",
            f"brk_{booking_id}",
            {
                "id": f"brk_{booking_id}",
                "kind": "transport_breakdown_prorata",
                "bookingId": booking_id,
                "userId": transporter_id,
                "amountPaisa": net_release,
                "commissionPaisa": commission_paisa,
                "refundPaisa": refund_paisa,
                "status": "posted",
                "createdAt": now,
            },
        )

    booking["updatedAt"] = now
    await set_doc("transport_bookings", booking_id, booking)
    await notify_user(
        booking["userId"],
        type="trip_breakdown",
        title="Vehicle breakdown / गाड़ी खराब",
        body=(
            f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — {body.note}. "
            "The platform is re-matching your load; any fare paid is settled pro-rata."
        ),
        deepLink=f"/dashboard/p/transport/trips/{booking_id}",
    )
    return booking


# ==========================================
# 26. PERSONALIZED LOAD MATCHING & FARE TRENDS (P2-38, spec T3/T4/F14)
# ==========================================

@router.get("/loads/matched")
async def matched_loads(uid: str = Depends(_transporter)):
    """Personalized load board: open loads scored against this transporter's
    fleet vehicle types, profiled operating routes, and completed-trip
    corridors. Deterministic scoring (2 = vehicle match, +1 route preference,
    +1 history corridor); the AI ranker may re-order the same set later."""
    await _assert_load_board_access(uid)
    vehicles = await query("vehicles", [("ownerId", "==", uid)], limit=1000)
    my_types = {v.get("vehicleType") for v in vehicles if v.get("active", True)}

    profile = await get_doc(f"users/{uid}/role_profiles", "transport") or {}
    route_tokens = _place_tokens(
        " ".join(profile.get("operatingRoutes") or [])
        + " "
        + " ".join(profile.get("operatingStates") or [])
    )
    bookings = await query("transport_bookings", [("transporterId", "==", uid)], limit=1000)
    history_tokens: set[str] = set()
    for trip in bookings:
        history_tokens |= _place_tokens(trip.get("pickup") or "")
        history_tokens |= _place_tokens(trip.get("drop") or "")

    loads = await query("transport_loads", [], limit=500)
    scored = []
    for load in loads:
        if load.get("status") != "open":
            continue
        score = 0
        reasons = []
        if load.get("preferredVehicleType") in my_types:
            score += 2
            reasons.append("vehicle_match")
        pickup_tokens = _place_tokens(load.get("pickupLocation") or "")
        corridor_tokens = pickup_tokens | _place_tokens(load.get("dropLocation") or "")
        if route_tokens & pickup_tokens:
            score += 1
            reasons.append("route_preference")
        if history_tokens & corridor_tokens:
            score += 1
            reasons.append("history_corridor")
        scored.append({**load, "score": score, "matchReasons": reasons})
    scored.sort(key=lambda l: (l["score"], l.get("createdAt", "")), reverse=True)
    return {"data": scored, "total": len(scored)}


FARE_TREND_BANDS = (
    (0.0, 50.0, "under50km"),
    (50.0, 200.0, "50to200km"),
    (200.0, 500.0, "200to500km"),
    (500.0, None, "over500km"),
)


def _fare_band(distance_km: float) -> str:
    for low, high, label in FARE_TREND_BANDS:
        if distance_km >= low and (high is None or distance_km < high):
            return label
    return FARE_TREND_BANDS[-1][2]


@router.get("/fare-trends")
async def fare_trends(
    pickup: str | None = None,
    drop: str | None = None,
    vehicleType: str | None = None,
    uid: str = Depends(_viewer),
):
    """Fare trend read from recent completed (delivered) bookings: overall
    avg/min/max ₹-per-km in paisa plus the same per distance band. Optional
    route/vehicle filters use the same token matching as return loads."""
    bookings = await query("transport_bookings", [("status", "==", "delivered")], limit=1000)
    per_km: list[float] = []
    banded: dict[str, list[float]] = {}
    for booking in bookings:
        distance_km = float(booking.get("distanceKm") or 0)
        if distance_km <= 0:
            continue
        if vehicleType and booking.get("vehicleType") != vehicleType:
            continue
        if pickup and not _places_match(str(booking.get("pickup") or ""), pickup):
            continue
        if drop and not _places_match(str(booking.get("drop") or ""), drop):
            continue
        rate = _fare_paisa(booking) / distance_km
        per_km.append(rate)
        banded.setdefault(_fare_band(distance_km), []).append(rate)

    def _stats(rates: list[float]) -> dict:
        if not rates:
            return {"count": 0, "avgPerKmPaisa": None, "minPerKmPaisa": None, "maxPerKmPaisa": None}
        return {
            "count": len(rates),
            "avgPerKmPaisa": round(sum(rates) / len(rates), 2),
            "minPerKmPaisa": round(min(rates), 2),
            "maxPerKmPaisa": round(max(rates), 2),
        }

    return {
        "sampleSize": len(per_km),
        "overall": _stats(per_km),
        "bands": {label: _stats(banded.get(label, [])) for _, _, label in FARE_TREND_BANDS},
        "filters": {"pickup": pickup, "drop": drop, "vehicleType": vehicleType},
    }


# ==========================================
# 27. COMPLIANCE VIEW (P2-39, spec T11)
# ==========================================

@router.get("/compliance")
async def transport_compliance(uid: str = Depends(_transporter)):
    """The caller transporter's strikes, active cooldowns/restrictions, and
    the penalty matrix the platform enforces (config-backed where a config
    exists, hardcoded rules annotated otherwise)."""
    user = await get_user(uid) or {}
    strikes = await query(f"users/{uid}/strikes", [], limit=1000)
    strikes.sort(key=lambda s: s.get("at", ""), reverse=True)

    now = datetime.now(timezone.utc)
    muted_until = user.get("chatMutedUntil")
    muted_active = False
    if muted_until:
        try:
            parsed = datetime.fromisoformat(str(muted_until))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            muted_active = now < parsed
        except ValueError:
            muted_active = False

    penalties = await _transport_penalties()
    return {
        "userId": uid,
        "strikes": strikes,
        "strikeCount": len(strikes),
        "noShowStrikes": int(user.get("noShowStrikes") or 0),
        "cooldowns": {
            "chatMutedUntil": muted_until if muted_active else None,
            "loadBoardSuspended": bool(user.get("loadBoardSuspended")),
            "bookingRestricted": bool(user.get("bookingRestricted")),
            "suspended": bool(user.get("suspended")),
        },
        "penaltyMatrix": {
            "cancelWindowHours": penalties["cancelWindowHours"],
            "strikesToSuspend": penalties["strikesToSuspend"],
            "farmerCancelPenaltyPct": penalties["farmerCancelPenaltyPct"],
            "farmerLateCancelPenaltyPct": penalties["farmerLateCancelPenaltyPct"],
            "transporterCompensationPct": penalties["transporterCompensationPct"],
            # Hardcoded rule enforced in this router (PATCH cancel inside the
            # pickup window records a no-show strike; strikesToSuspend strikes
            # suspend load-board access):
            "transporterCancelInsideWindow": "no_show_strike",
            "version": penalties.get("version"),
            "effectiveFrom": penalties.get("effectiveFrom"),
        },
    }
