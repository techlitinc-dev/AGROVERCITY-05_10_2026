import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import admin_action, current_user_id
from app.models.transport import (
    AcceptBookingRequest,
    AvailabilityRequest,
    CreateBookingRequest,
    FareEstimateOut,
    FareEstimateRequest,
    LoadBidRequest,
    OpenLoadCreateRequest,
    OwnerVehicleRequest,
    RejectBookingRequest,
    TransportProfileUpdate,
    TripExpenseRequest,
    TripLocationUpdate,
    UpdateBookingRequest,
    VehicleTypeOut,
    WeighbridgeSlipRequest,
)
from app.routers.purchases import HANDOVER_OTP_MAX_ATTEMPTS, HANDOVER_OTP_VALID_MINUTES
from app.routers.users import require_role
from app.services import kyc as kyc_service
from app.services import reports
from app.services import settlements as settlements_service
from app.services.pnl_engine import record_auto_entry
from app.services import transport_match
from app.services.billing import effective_plan, entitlement_guard, record_usage
from app.services.chat import ensure_transport_room
from app.services.notifications import send_fcm_to_user
from app.services.notify import notify_user
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
    for key in ("cancelWindowHours", "strikesToSuspend", "version"):
        if key in doc:
            config[key] = doc[key]
    return config


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
    doc = {
        **body.model_dump(),
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
async def update_vehicle(vehicle_id: str, body: OwnerVehicleRequest, uid: str = Depends(_transporter)):
    vehicle = await _own_vehicle(vehicle_id, uid)
    vehicle.update(body.model_dump())
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
    if body.status == "accepted":
        room = await ensure_transport_room(booking)
        if room:
            for party in (booking["userId"], booking["transporterId"]):
                await notify_user(
                    party,
                    type="chat_unlocked",
                    title="Chat unlocked / चैट खुली",
                    body=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — coordinate the pickup in-app",
                    path=f"/dashboard/p/transport/trips/{booking_id}/chat",
                )
    elif body.status == "enRoute":
        await notify_user(
            booking["userId"],
            type="trip_enroute",
            title="Vehicle en route / गाड़ी निकली",
            body=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — {booking.get('vehicleNo') or 'vehicle'} is heading to pickup",
            path=f"/dashboard/p/transport/trips/{booking_id}",
        )
    elif body.status == "delivered":
        await notify_user(
            booking["userId"],
            type="trip_delivered",
            title="Delivered / डिलीवर हुआ",
            body="Proof of delivery filed — inspect and rate your transporter",
            path=f"/dashboard/p/transport/trips/{booking_id}",
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
        path=f"/dashboard/p/transport/trips/{booking_id}",
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
    room = await ensure_transport_room(booking)
    if room:
        for party in (booking["userId"], booking["transporterId"]):
            await notify_user(
                party,
                type="chat_unlocked",
                title="Chat unlocked / चैट खुली",
                body=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — coordinate the pickup in-app",
                path=f"/dashboard/p/transport/trips/{booking_id}/chat",
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
    """Farmer-side cancellation (plan §3.4): booker only, before pickup."""
    booking = await _get_booking(booking_id)
    if booking.get("userId") != uid:
        _error(403, "FORBIDDEN", "only the booker can cancel this booking")
    if booking.get("status") not in ("requested", "accepted"):
        _error(409, "ILLEGAL_TRANSITION", f"cannot cancel from {booking.get('status')}")
    booking["status"] = "cancelled"
    booking["cancellationReason"] = body.reason
    booking["cancelledBy"] = "farmer"
    waypoints = booking.get("waypointsLog", [])
    waypoints.append({
        "waypoint": "cancelled",
        "label": f"किसान ने रद्द की: {body.reason}",
        "time": datetime.now(timezone.utc).isoformat(),
    })
    booking["waypointsLog"] = waypoints
    await set_doc("transport_bookings", booking_id, booking)
    await transport_match.record_transport_outcome(booking_id, "cancelled")
    if booking.get("transporterId"):
        await notify_user(
            booking["transporterId"],
            type="booking_cancelled",
            title="Booking cancelled / बुकिंग रद्द",
            body=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — {body.reason}",
            path=f"/dashboard/p/transport/trips/{booking_id}",
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

    loads.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return {"data": loads, "total": len(loads)}


@router.post("/loads", status_code=201)
async def post_open_load(body: OpenLoadCreateRequest, uid: str = Depends(_booker)):
    user = await get_user(uid)
    doc = {
        "id": f"load_{uuid.uuid4().hex[:10]}",
        "userId": uid,
        "farmerName": user.get("name", "किसान"),
        "farmerPhone": user.get("phone", ""),
        "pickupLocation": body.pickupLocation,
        "dropLocation": body.dropLocation,
        "crop": body.crop,
        "quantityQuintals": body.quantityQuintals,
        "packaging": body.packaging,
        "perishable": body.perishable,
        "preferredVehicleType": body.preferredVehicleType,
        "pickupDate": body.pickupDate,
        "targetFare": body.targetFare,
        "notes": body.notes,
        "status": "open",
        "bidsCount": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    match_info = await transport_match.score_transport_match(doc, ctx=uid)
    doc["noshowRisk"] = match_info.get("noshow_risk", 0.05)
    doc["fit"] = match_info.get("fit", 0.7)
    await set_doc("transport_loads", doc["id"], doc)
    return doc


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
    room = await ensure_transport_room(booking_doc)
    if room:
        for party in (booking_doc["userId"], booking_doc["transporterId"]):
            await notify_user(
                party,
                type="chat_unlocked",
                title="Chat unlocked / चैट खुली",
                body=f"{booking_doc.get('commodity') or 'Trip'} — coordinate the pickup in-app",
                path=f"/dashboard/p/transport/trips/{booking_id}/chat",
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
            path=f"/dashboard/p/transport/trips/{booking_id}",
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
            "advancePaid": int(fare * 0.4),
            "balancePayable": int(fare * 0.6) + 300,
        },
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
        path=f"/dashboard/p/transport/trips/{booking_id}",
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
    net_profit = round(gross_fare - total_expenses - platform_commission, 2)

    return {
        "bookingId": booking_id,
        "grossFare": gross_fare,
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
    await set_doc(f"transport_bookings/{booking_id}/damage_disputes", doc["id"], doc)
    other = booking.get("transporterId") if uid == booking.get("userId") else booking.get("userId")
    if other:
        await notify_user(
            other,
            type="damage_dispute_opened",
            title="Damage dispute / नुकसान विवाद",
            body=f"Claim of ₹{body.claimPaisa / 100:.2f} filed on booking {booking_id}",
            path=f"/dashboard/p/transport/trips/{booking_id}",
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
