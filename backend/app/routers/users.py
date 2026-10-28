from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError

import hashlib
import logging
import uuid
from datetime import datetime, timezone

from app.core.cache import get_redis
from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.security import verify_mpin
from app.models.consents import ConsentsIn, ConsentsOut
from app.models.role_profiles import ROLE_PROFILE_MODELS
from app.models.user import (
    AccountDeleteIn,
    BlockIn,
    DeviceRegisterIn,
    FarmBoundaryRequest,
    LinkProfileRequest,
    PersonaSetupRequest,
    ReportIn,
    UserSettingsUpdate,
    UserUpdateRequest,
    VALID_PROFILES,
    normalize_profile,
)
from app.services import consents as consents_service
from app.services import onboarding_seed
from app.services.profile_routes import DEFAULT_HOME
from app.services.purge import purge_user
from app.services.users import get_user

router = APIRouter(prefix="/users", tags=["users"])
devices_router = APIRouter(prefix="/devices", tags=["devices"])

logger = logging.getLogger(__name__)

_ME_DEFAULTS = {
    "village": "", "tehsil": "", "district": "", "state": "", "landAreaAcres": 0,
    "soilType": "", "irrigationType": "", "activeCrops": [], "farmBoundaryPoints": [],
    "agriCoins": 0, "krishiRatnaLevel": 1, "disabledProfiles": [],
}

# Canonical platform personas (website PersonaType spellings) — used by the
# visibility surface; flags are computed with normalize_profile on both sides
# so backend spellings (farmLandlord, transport, …) still match.
PLATFORM_PERSONAS = (
    "farmer", "landlord", "transporter", "seller", "equipmentOwner", "exporter",
    "directBuyer", "broker", "dairyManager", "milkSeller", "vet", "fpoManager",
    "womenShg", "instructor", "bankManager", "insuranceProvider",
    "coldStorageProvider", "gaushalaManager", "nursery", "customer", "superadmin",
)


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def require_role(user: dict, *roles: str):
    if user.get("isAdmin") or user.get("adminRole") or user.get("activeProfile") == "admin":
        return
    raw_active = user.get("activeProfile") or ""
    active = normalize_profile(raw_active)
    norm_roles = {normalize_profile(r) for r in roles} | set(roles)
    if active in norm_roles or raw_active in norm_roles:
        return
    aliases = {
        "transporter": "transport",
        "transport": "transporter",
        "farm_landlord": "farmLandlord",
        "landlord": "farmLandlord",
        "farm landlord": "farmLandlord",
        "equipment_owner": "equipmentRental",
        "equipmentOwner": "equipmentRental",
        "equipmentRental": "equipmentRental",
        "dairy_manager": "dairyManager",
        "milk_seller": "milkSeller",
        "teacher": "instructor",
        "nursery": "nursery",
        "plant_nursery": "nursery",
    }
    if aliases.get(raw_active) in norm_roles or aliases.get(active) in norm_roles:
        return
    _error(403, "FORBIDDEN_ROLE", "insufficient role for this action")


async def _require_user(uid: str) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return user


async def _with_role_profiles(user: dict) -> dict:
    role_profiles = {}
    for ptype in user.get("linkedProfiles", []):
        doc = await get_doc(f"users/{user['id']}/role_profiles", ptype)
        if doc is not None:
            role_profiles[ptype] = doc
    return {**user, "roleProfiles": role_profiles}


@router.get("/me")
async def get_me(uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    merged = {**_ME_DEFAULTS, **user}
    merged["hasMpin"] = bool(user.get("mpinHash"))
    return await _with_role_profiles(merged)


_BOOKING_FIELDS = {
    "equipment": ["id", "equipmentId", "slotId", "date", "slotName", "priceRupees", "status"],
    "vet": ["id", "vetName", "visitType", "slot", "animalType", "status"],
    "transport": ["id", "vehicleType", "pickup", "drop", "date", "fare", "status"],
    "coldStorage": ["id", "facilityId", "facilityName", "quantityQuintals", "fromDate", "months", "status", "bookedAt"],
}


def _shape_bookings(docs: list[dict], kind: str, status: str | None) -> list[dict]:
    items = []
    for doc in docs:
        item = {f: doc.get(f) for f in _BOOKING_FIELDS[kind]}
        item["kind"] = kind
        items.append(item)
    if status is not None:
        items = [i for i in items if i.get("status") == status]
    items.sort(key=lambda i: i.get("date") or "", reverse=True)
    return items


@router.get("/me/bookings")
async def get_my_bookings(
    status: str | None = None,
    lotId: str | None = None,
    uid: str = Depends(current_user_id),
):
    await _require_user(uid)
    equipment = await query("equipment_bookings", [("userId", "==", uid)], limit=500)
    # vet_bookings subcollection lands Day 12; absent source must yield [], not an error
    vet = await query(f"users/{uid}/vet_bookings", [], limit=500)
    transport = await query("transport_bookings", [("userId", "==", uid)], limit=500)
    if lotId is not None:
        # produce lot → pickup → delivery transport leg (F12)
        transport = [d for d in transport if d.get("lotId") == lotId]
    cold_storage = await query(f"users/{uid}/cold_storage_bookings", [], limit=500)
    return {
        "equipment": _shape_bookings(equipment, "equipment", status),
        "vet": _shape_bookings(vet, "vet", status),
        "transport": _shape_bookings(transport, "transport", status),
        "coldStorage": _shape_bookings(cold_storage, "coldStorage", status),
    }


@router.put("/me")
async def put_me(body: UserUpdateRequest, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    for field, value in body.model_dump(exclude_none=True).items():
        user[field] = value
    if body.language and "preferredLanguage" not in body.model_dump(exclude_none=True):
        user["preferredLanguage"] = body.language
    if body.preferredLanguage and "language" not in body.model_dump(exclude_none=True):
        user["language"] = body.preferredLanguage
    await set_doc("users", uid, user)
    return await _with_role_profiles(user)


@router.put("/me/persona-setup")
async def persona_setup(body: PersonaSetupRequest, uid: str = Depends(current_user_id)):
    """Link personas + save role profile details after registration (deferred flow)."""
    user = await _require_user(uid)

    for ptype in body.profiles:
        if ptype not in VALID_PROFILES:
            _error(422, "INVALID_PROFILE_TYPE", "profiles must be valid profile types")
    linked = list(user.get("linkedProfiles", []))
    previously_linked = set(linked)
    for ptype in body.profiles:
        if ptype not in linked:
            linked.append(ptype)

    primary = body.primaryProfile
    if primary:
        if primary not in linked:
            _error(422, "INVALID_PROFILE_TYPE", "primaryProfile must be one of profiles")
        user["primaryProfile"] = primary
    elif not user.get("primaryProfile") and linked:
        user["primaryProfile"] = linked[0]

    variants = {}
    for ptype, raw in (body.roleProfiles or {}).items():
        model = ROLE_PROFILE_MODELS.get(ptype)
        if model is None or ptype not in linked:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "INVALID_ROLE_PROFILE",
                    "message": "roleProfiles keys must be valid linked profile types",
                    "fieldErrors": {ptype: "unknown or not in profiles"},
                },
            )
        try:
            variants[ptype] = model(**raw)
        except ValidationError:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "INVALID_ROLE_PROFILE",
                    "message": "role profile fields are invalid",
                    "fieldErrors": {ptype: "missing or invalid required fields"},
                },
            )

    for field in ("village", "tehsil", "district", "landAreaAcres", "soilType", "irrigationType"):
        value = getattr(body, field)
        if value is not None:
            user[field] = value
    if body.crops is not None:
        user["activeCrops"] = body.crops

    user["linkedProfiles"] = linked
    if not user.get("activeProfile"):
        user["activeProfile"] = user.get("primaryProfile") or (linked[0] if linked else "")
    await set_doc("users", uid, user)

    now = datetime.now(timezone.utc).isoformat()
    for ptype, variant in variants.items():
        await set_doc(f"users/{uid}/role_profiles", ptype, {**variant.model_dump(), "createdAt": now})
    # WS-01 tasks 1.44 + 1.45 — deferred flow: personas chosen after register
    # seed the same first-dashboard payload. Only newly added personas are
    # passed; task emission is dedupe-safe on (user, module, kind, sourceId).
    added_personas = [p for p in body.profiles if p not in previously_linked]
    if added_personas:
        try:
            await onboarding_seed.seed_dashboard(uid, added_personas)
        except Exception:  # noqa: BLE001 — seeding must never fail persona setup
            logger.warning("persona-setup seeding failed for uid=%s", uid, exc_info=True)
    return await _with_role_profiles(user)


@router.get("/me/settings")
async def get_my_settings(uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    pref_lang = user.get("preferredLanguage") or user.get("language") or "en"
    return {
        "language": pref_lang,
        "preferredLanguage": pref_lang,
        "womenMode": user.get("womenMode", False),
        "highContrast": user.get("highContrast", False),
        "darkMode": user.get("darkMode", False),
        "discoverable": user.get("discoverable", True),
        "householdBudgetMonthly": user.get("householdBudgetMonthly", 0),
    }


@router.put("/me/settings")
async def put_my_settings(body: UserSettingsUpdate, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    updates = body.model_dump(exclude_none=True)
    if "language" in updates:
        user["language"] = updates["language"]
        user["preferredLanguage"] = updates["language"]
    elif "preferredLanguage" in updates:
        user["preferredLanguage"] = updates["preferredLanguage"]
        user["language"] = updates["preferredLanguage"]
    for k, v in updates.items():
        if k not in ("language", "preferredLanguage"):
            user[k] = v
    await set_doc("users", uid, user)
    return await _with_role_profiles(user)


@router.put("/me/farm-boundary")
async def put_farm_boundary(body: FarmBoundaryRequest, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    if "farmer" not in user.get("linkedProfiles", []):
        _error(403, "FORBIDDEN_ROLE", "farmer profile required")
    user["farmBoundaryPoints"] = [p.model_dump() for p in body.farmBoundaryPoints]
    user["landAreaAcres"] = body.landAreaAcres
    user["khasraNumber"] = body.khasraNumber
    await set_doc("users", uid, user)
    return await _with_role_profiles(user)


@router.post("/me/profiles")
async def link_profile(body: LinkProfileRequest, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    canonical = normalize_profile(body.profileType)
    if canonical not in VALID_PROFILES and body.profileType not in VALID_PROFILES:
        _error(422, "INVALID_PROFILE_TYPE", "unknown profile type")
    linked = user.get("linkedProfiles", [])
    target = canonical if canonical in VALID_PROFILES else body.profileType
    if target in linked or body.profileType in linked:
        _error(409, "PROFILE_ALREADY_LINKED", "profile already linked")
    linked.append(target)
    user["linkedProfiles"] = linked
    await set_doc("users", uid, user)
    return await _with_role_profiles(user)


@router.delete("/me/profiles/{profile_type}")
async def unlink_profile(profile_type: str, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    canonical = normalize_profile(profile_type)
    linked = user.get("linkedProfiles", [])
    target = None
    for candidate in (profile_type, canonical):
        if candidate in linked:
            target = candidate
            break
    if not target:
        _error(404, "PROFILE_NOT_LINKED", "profile is not linked")
    if len(linked) == 1:
        _error(409, "LAST_PROFILE", "कम से कम एक प्रोफाइल आवश्यक है")
    linked.remove(target)
    user["linkedProfiles"] = linked
    if user.get("activeProfile") in (profile_type, canonical):
        primary = user.get("primaryProfile")
        user["activeProfile"] = primary if primary in linked else linked[0]
    if user.get("primaryProfile") in (profile_type, canonical):
        user["primaryProfile"] = linked[0]
    await set_doc("users", uid, user)
    return await _with_role_profiles(user)


async def _bump_delete_attempts(uid: str) -> int:
    try:
        redis = await get_redis()
        key = f"del_attempts:{uid}"
        attempts = await redis.incr(key)
        if attempts == 1:
            await redis.expire(key, 3600)
        return attempts
    except Exception:
        # Redis down (dev) — rate limit is best-effort, don't block the user
        return 1


@router.delete("/me")
async def delete_me(body: AccountDeleteIn, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    if user.get("mpinHash") is None:
        _error(409, "MPIN_NOT_SET", "MPIN not set")
    attempts = await _bump_delete_attempts(uid)
    if attempts > 3:
        _error(429, "TOO_MANY_ATTEMPTS", "बहुत अधिक प्रयास — बाद में कोशिश करें")
    if not verify_mpin(body.mpin, user["mpinHash"]):
        _error(401, "WRONG_MPIN", "गलत MPIN")
    purged = await purge_user(uid)
    return {"deleted": True, "purged": purged}


@devices_router.post("", status_code=201)
async def register_device(body: DeviceRegisterIn, uid: str = Depends(current_user_id)):
    await _require_user(uid)
    token_hash = hashlib.sha256(body.fcmToken.encode()).hexdigest()[:16]
    await set_doc(
        f"users/{uid}/devices",
        token_hash,
        {
            "id": token_hash,
            "token": body.fcmToken,
            "platform": body.platform,
            "locale": body.locale,
            "lastSeenAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"registered": True}


@devices_router.delete("/{token_hash}", status_code=204)
async def delete_device(token_hash: str, uid: str = Depends(current_user_id)):
    await _require_user(uid)
    await delete_doc(f"users/{uid}/devices", token_hash)


@router.get("/me/consents", response_model=ConsentsOut)
async def get_my_consents(uid: str = Depends(current_user_id)):
    await _require_user(uid)
    consents = await consents_service.get_consents(uid)
    doc = await get_doc(f"users/{uid}/consents", "current")
    return ConsentsOut(**consents, updatedAt=(doc or {}).get("updatedAt", ""))


@router.put("/me/consents", response_model=ConsentsOut)
async def put_my_consents(body: ConsentsIn, uid: str = Depends(current_user_id)):
    await _require_user(uid)
    updated = await consents_service.put_consents(uid, body.model_dump())
    return ConsentsOut(**updated)


@router.post("/me/profiles/{profile_type}/activate")
async def activate_profile(profile_type: str, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    canonical = normalize_profile(profile_type)
    linked = user.setdefault("linkedProfiles", [])
    if profile_type not in linked and canonical not in linked:
        if canonical in VALID_PROFILES or profile_type in VALID_PROFILES:
            target = canonical if canonical in VALID_PROFILES else profile_type
            linked.append(target)
        else:
            _error(404, "PROFILE_NOT_LINKED", "profile is not linked")
    target_active = canonical if (canonical in linked or canonical in VALID_PROFILES) else profile_type
    if _platform_form(normalize_profile(target_active)) in _disabled_profiles(user):
        _error(409, "PERSONA_DISABLED", "this persona is hidden — enable it in profile settings first")
    user["activeProfile"] = target_active
    await set_doc("users", uid, user)
    return {
        "activeProfile": target_active,
        "defaultHomeRoute": DEFAULT_HOME.get(target_active, DEFAULT_HOME.get(profile_type, "home")),
        "user": user,
    }


@router.put("/me/profiles/{profile_type}/primary")
async def set_primary_profile(profile_type: str, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    canonical = normalize_profile(profile_type)
    linked = user.get("linkedProfiles", [])
    target = None
    for candidate in (profile_type, canonical):
        if candidate in linked:
            target = candidate
            break
    if not target:
        _error(404, "PROFILE_NOT_LINKED", "profile is not linked")
    user["primaryProfile"] = target
    await set_doc("users", uid, user)
    return await _with_role_profiles(user)


class ProfileVisibilityIn(BaseModel):
    enabled: bool


# Backend-canonical spellings that differ from the website PersonaType spelling.
_PLATFORM_BY_BACKEND = {
    "farmLandlord": "landlord",
    "equipmentRental": "equipmentOwner",
}


def _platform_form(backend_canonical: str) -> str:
    return _PLATFORM_BY_BACKEND.get(backend_canonical, backend_canonical)


def _disabled_profiles(user: dict) -> list[str]:
    """Stored in platform-canonical form (frontend PersonaType spellings)."""
    return [_platform_form(normalize_profile(p)) for p in (user.get("disabledProfiles") or [])]


def _original_casing(linked: list[str], platform: str) -> str:
    for entry in linked:
        if _platform_form(normalize_profile(entry)) == platform:
            return entry
    return platform


@router.get("/me/profiles")
async def get_my_profiles(uid: str = Depends(current_user_id)):
    """Linked/active/primary plus the full platform persona list with flags —
    the visibility surface the profile settings UI renders."""
    user = await _require_user(uid)
    linked = user.get("linkedProfiles") or []
    linked_plat = {_platform_form(normalize_profile(p)) for p in linked}
    disabled = _disabled_profiles(user)
    active = _platform_form(normalize_profile(user.get("activeProfile") or ""))
    primary = _platform_form(normalize_profile(user.get("primaryProfile") or ""))
    personas = [
        {
            "persona": p,
            "linked": p in linked_plat,
            "active": p == active,
            "primary": p == primary,
            "disabled": p in disabled,
        }
        for p in PLATFORM_PERSONAS
    ]
    return {
        "linkedProfiles": linked,
        "activeProfile": user.get("activeProfile") or "",
        "primaryProfile": user.get("primaryProfile") or "",
        "disabledProfiles": user.get("disabledProfiles") or [],
        "personas": personas,
    }


@router.put("/me/profiles/{profile_type}/visibility")
async def set_profile_visibility(
    profile_type: str,
    body: ProfileVisibilityIn,
    uid: str = Depends(current_user_id),
):
    """Hide/show a persona (hide ≠ unlink — data stays, options disappear).

    Disabling the active persona auto-switches to the primary enabled one;
    disabling the last enabled persona is rejected.
    """
    user = await _require_user(uid)
    backend_canonical = normalize_profile(profile_type)
    if backend_canonical not in VALID_PROFILES and profile_type not in VALID_PROFILES:
        _error(422, "INVALID_PROFILE_TYPE", "unknown profile type")
    platform = _platform_form(backend_canonical)

    linked = user.get("linkedProfiles") or []
    linked_plat = [_platform_form(normalize_profile(p)) for p in linked]
    disabled = _disabled_profiles(user)
    enabled_linked = [p for p in linked_plat if p not in disabled]

    if body.enabled:
        if platform in disabled:
            disabled.remove(platform)
    else:
        if platform in enabled_linked and len(enabled_linked) == 1:
            _error(409, "LAST_ENABLED_PERSONA", "at least one persona must stay enabled")
        if platform not in disabled:
            disabled.append(platform)
        if _platform_form(normalize_profile(user.get("activeProfile") or "")) == platform:
            primary = _platform_form(normalize_profile(user.get("primaryProfile") or ""))
            fallback = (
                primary
                if primary in linked_plat and primary not in disabled
                else next((p for p in linked_plat if p not in disabled), None)
            )
            if fallback is None:
                _error(409, "LAST_ENABLED_PERSONA", "at least one persona must stay enabled")
            user["activeProfile"] = _original_casing(linked, fallback)

    user["disabledProfiles"] = disabled
    await set_doc("users", uid, user)
    return {
        "persona": platform,
        "enabled": body.enabled,
        "activeProfile": user.get("activeProfile") or "",
        "disabledProfiles": user.get("disabledProfiles") or [],
    }


@router.get("/me/dashboard/{profile_type}")
async def get_persona_dashboard(profile_type: str, uid: str = Depends(current_user_id)):
    """P2-1 (endpoints.md §2): Persona home payload for the active/chosen profile
    (metric pills, quick actions, live activity list)."""
    user = await _require_user(uid)
    canonical = normalize_profile(profile_type)
    if canonical not in VALID_PROFILES and profile_type not in VALID_PROFILES:
        _error(422, "INVALID_PROFILE_TYPE", f"unknown profile type '{profile_type}'")

    ptype = canonical if canonical in VALID_PROFILES else profile_type
    pills = []
    quick_actions = []

    if ptype == "farmer":
        lots = await query("market_lots", [("farmerId", "==", uid)], limit=20)
        pills = [
            {"label": "Active Lots", "value": len([l for l in lots if l.get("status") == "open"])},
            {"label": "AgriCoins", "value": user.get("agriCoins", 150)},
            {"label": "Weather", "value": "28°C · Sunny"},
        ]
        quick_actions = [
            {"id": "post_lot", "title": "Sell Produce / फसल बेचें", "route": "/market/lots/new"},
            {"id": "check_mandi", "title": "Mandi Rates / मंडी भाव", "route": "/mandi"},
            {"id": "book_tractor", "title": "Book Equipment / मशीन बुक करें", "route": "/equipment"},
        ]
    elif ptype in ("farmLandlord", "landlord", "farm landlord"):
        plots = await query(f"users/{uid}/land_plots", limit=50)
        pills = [
            {"label": "Plots Owned", "value": len(plots)},
            {"label": "Active Leases", "value": 2},
            {"label": "Rent Due", "value": "₹37,000"},
        ]
        quick_actions = [
            {"id": "add_plot", "title": "Add Plot / ज़मीन जोड़ें", "route": "/land/plots/new"},
            {"id": "lease_requests", "title": "Lease Requests / पट्टा अनुरोध", "route": "/land/requests"},
            {"id": "view_712", "title": "7/12 Records / 7/12 देखें", "route": "/land-records"},
        ]
    elif ptype in ("transporter", "transport"):
        pills = [
            {"label": "Active Trips", "value": 1},
            {"label": "Wallet Balance", "value": "₹14,500"},
            {"label": "Rating", "value": "4.9 ★"},
        ]
        quick_actions = [
            {"id": "load_board", "title": "Find Loads / लोड खोजें", "route": "/transport/loads"},
            {"id": "my_trips", "title": "My Trips / मेरी यात्राएं", "route": "/transport/trips"},
            {"id": "payout", "title": "Withdraw Balance / पैसे निकालें", "route": "/transport/wallet"},
        ]
    elif ptype == "seller":
        pills = [
            {"label": "Today's Orders", "value": 5},
            {"label": "Active Products", "value": 12},
            {"label": "Pending Dispatch", "value": 2},
        ]
        quick_actions = [
            {"id": "new_rate", "title": "Post Daily Rate / भाव पोस्ट करें", "route": "/seller/rates"},
            {"id": "team", "title": "Team Accounts / टीम सदस्य", "route": "/seller/team"},
            {"id": "gst_report", "title": "GST Invoices / टैक्स रिपोर्ट", "route": "/seller/gst"},
        ]
    elif ptype == "broker":
        pills = [
            {"label": "Active Deals", "value": 3},
            {"label": "Escrow Held", "value": "₹1,85,000"},
            {"label": "Commission Due", "value": "₹3,700"},
        ]
        quick_actions = [
            {"id": "create_deal", "title": "New Deal / नया सौदा", "route": "/broker/deals/new"},
            {"id": "deal_chat", "title": "Deal Messages / संदेश", "route": "/broker/messages"},
        ]
    elif ptype == "dairyManager":
        pills = [
            {"label": "Today's Milk", "value": "1,420 L"},
            {"label": "Avg FAT", "value": "4.2%"},
            {"label": "Active Members", "value": 64},
        ]
        quick_actions = [
            {"id": "record_collection", "title": "Record Milk / दूध संकलन", "route": "/dairy/collect"},
            {"id": "rate_chart", "title": "Rate Chart / दर सूची", "route": "/dairy/rate-chart"},
        ]
    elif ptype in ("teacher", "instructor"):
        pills = [
            {"label": "Enrolled Students", "value": 48},
            {"label": "Active Batches", "value": 2},
            {"label": "Settlements", "value": "₹24,000"},
        ]
        quick_actions = [
            {"id": "new_session", "title": "Schedule Class / सत्र बनाएं", "route": "/teacher/sessions/new"},
            {"id": "enquiries", "title": "Student Enquiries / पूछताछ", "route": "/teacher/enquiries"},
        ]
    elif ptype == "directBuyer":
        pills = [
            {"label": "Standing Demands", "value": 2},
            {"label": "Active Demands", "value": 4},
            {"label": "Dispatched Trips", "value": 1},
        ]
        quick_actions = [
            {"id": "post_demand", "title": "Post Demand / मांग दर्ज करें", "route": "/demands/new"},
            {"id": "standing_order", "title": "Standing Order / आवर्ती मांग", "route": "/direct-buyer/standing"},
        ]
    elif ptype in ("equipmentRental", "equipmentOwner", "equipment_owner"):
        pills = [
            {"label": "Listed Machines", "value": 3},
            {"label": "Booked Slots", "value": 4},
            {"label": "Deposits Held", "value": "₹2,500"},
        ]
        quick_actions = [
            {"id": "view_slots", "title": "Yantra Slots / स्लॉट स्थिति", "route": "/equipment/slots"},
            {"id": "damage_claims", "title": "Damage Claims / दावा दर्ज करें", "route": "/equipment/claims"},
        ]
    else:
        pills = [
            {"label": "Status", "value": "Active"},
            {"label": "Profile", "value": ptype.capitalize()},
            {"label": "Verification", "value": "Verified"},
        ]
        quick_actions = [
            {"id": "home", "title": "Dashboard Home", "route": f"/{ptype}/dashboard"},
        ]

    live_activity = [
        {"id": "act_1", "title": "Profile active", "timestamp": datetime.now(timezone.utc).isoformat(), "kind": "info"},
    ]

    return {
        "profileType": ptype,
        "defaultHomeRoute": DEFAULT_HOME.get(ptype, DEFAULT_HOME.get(canonical, "/dashboard")),
        "metricPills": pills,
        "quickActions": quick_actions,
        "liveActivity": live_activity,
    }


@router.post("/{user_id}/report", status_code=201)
async def report_user(user_id: str, body: ReportIn, uid: str = Depends(current_user_id)):
    await _require_user(uid)
    if user_id == uid:
        _error(400, "CANNOT_REPORT_SELF", "cannot report yourself")
    if await get_doc("users", user_id) is None:
        _error(404, "USER_NOT_FOUND", "user not found")
    open_reports = await query(
        "reports",
        [("reporterId", "==", uid), ("reportedId", "==", user_id), ("status", "==", "open")],
    )
    if open_reports:
        _error(409, "ALREADY_REPORTED", "an open report already exists for this user")
    doc = {
        "id": f"rep_{uuid.uuid4().hex[:12]}",
        "reporterId": uid,
        "reportedId": user_id,
        "reason": body.reason,
        "status": "open",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("reports", doc["id"], doc)
    return {"reported": True}


@router.post("/me/blocks", status_code=201)
async def block_user(body: BlockIn, uid: str = Depends(current_user_id)):
    await _require_user(uid)
    if body.userId == uid:
        _error(400, "CANNOT_BLOCK_SELF", "cannot block yourself")
    if await get_doc("users", body.userId) is None:
        _error(404, "USER_NOT_FOUND", "user not found")
    await set_doc(
        f"users/{uid}/blocks",
        body.userId,
        {"id": body.userId, "at": datetime.now(timezone.utc).isoformat()},
    )
    return {"blocked": True}


@router.delete("/me/blocks/{user_id}", status_code=204)
async def unblock_user(user_id: str, uid: str = Depends(current_user_id)):
    await _require_user(uid)
    await delete_doc(f"users/{uid}/blocks", user_id)


@router.get("/me/blocks")
async def list_blocks(uid: str = Depends(current_user_id)):
    await _require_user(uid)
    docs = await query(f"users/{uid}/blocks", [], limit=500)
    data = []
    for doc in docs:
        target = await get_doc("users", doc["id"]) or {}
        data.append({"userId": doc["id"], "name": target.get("name", ""), "at": doc.get("at")})
    return {"data": data, "page": 1, "pageSize": len(data) or 20, "total": len(data)}


# ==========================================
# SAVED ITEMS (mandi rates, trees, articles, ads)
# ==========================================

SAVED_ITEM_KINDS = ("mandi-rate", "tree", "article", "ad")
SAVED_COLLECTION = "user_saved"


class SavedItemIn(BaseModel):
    kind: str
    refId: str = Field(min_length=1)
    title: str | None = None
    snapshot: dict | None = None


def _saved_doc_id(uid: str, kind: str, ref_id: str) -> str:
    # refId may contain slashes (e.g. "crops/wheat") which would otherwise
    # collide with the collection/doc_id key separator.
    return f"{uid}_{kind}_{ref_id.replace('/', '_')}"


@router.get("/me/saved")
async def list_saved_items(
    kind: str | None = None,
    uid: str = Depends(current_user_id),
):
    await _require_user(uid)
    if kind is not None and kind not in SAVED_ITEM_KINDS:
        _error(422, "INVALID_KIND", f"kind must be one of {', '.join(SAVED_ITEM_KINDS)}")
    docs = await query(SAVED_COLLECTION, [("userId", "==", uid)], limit=500)
    docs = [d for d in docs if d.get("userId") == uid]
    if kind is not None:
        docs = [d for d in docs if d.get("kind") == kind]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "page": 1, "pageSize": len(docs) or 20, "total": len(docs)}


@router.post("/me/saved", status_code=201)
async def save_item(body: SavedItemIn, uid: str = Depends(current_user_id)):
    await _require_user(uid)
    if body.kind not in SAVED_ITEM_KINDS:
        _error(422, "INVALID_KIND", f"kind must be one of {', '.join(SAVED_ITEM_KINDS)}")
    doc_id = _saved_doc_id(uid, body.kind, body.refId)
    existing = await get_doc(SAVED_COLLECTION, doc_id)
    doc = {
        "id": doc_id,
        "userId": uid,
        "kind": body.kind,
        "refId": body.refId,
        "title": body.title,
        "snapshot": body.snapshot,
        # Idempotent upsert: the original save timestamp is kept on repost.
        "createdAt": (existing or {}).get("createdAt") or datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(SAVED_COLLECTION, doc_id, doc)
    return doc


@router.delete("/me/saved/{kind}/{ref_id:path}", status_code=204)
async def unsave_item(kind: str, ref_id: str, uid: str = Depends(current_user_id)):
    await _require_user(uid)
    if kind not in SAVED_ITEM_KINDS:
        _error(422, "INVALID_KIND", f"kind must be one of {', '.join(SAVED_ITEM_KINDS)}")
    doc_id = _saved_doc_id(uid, kind, ref_id)
    if await get_doc(SAVED_COLLECTION, doc_id) is None:
        _error(404, "SAVED_NOT_FOUND", "saved item not found")
    await delete_doc(SAVED_COLLECTION, doc_id)
