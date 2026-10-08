from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

import hashlib
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
)
from app.services import consents as consents_service
from app.services.profile_routes import DEFAULT_HOME
from app.services.purge import purge_user
from app.services.users import get_user

router = APIRouter(prefix="/users", tags=["users"])
devices_router = APIRouter(prefix="/devices", tags=["devices"])

_ME_DEFAULTS = {
    "village": "", "tehsil": "", "district": "", "state": "", "landAreaAcres": 0,
    "soilType": "", "irrigationType": "", "activeCrops": [], "farmBoundaryPoints": [],
    "agriCoins": 0, "krishiRatnaLevel": 1,
}


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def require_role(user: dict, *roles: str):
    active = user.get("activeProfile")
    if active in roles:
        return
    aliases = {
        "transporter": "transport",
        "transport": "transporter",
        "farm_landlord": "farmLandlord",
        "equipment_owner": "equipmentRental",
        "equipmentRental": "equipmentRental",
        "dairy_manager": "dairyManager",
        "teacher": "instructor",
    }
    if aliases.get(active) in roles:
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
    return await _with_role_profiles({**_ME_DEFAULTS, **user})


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
    if body.profileType not in VALID_PROFILES:
        _error(422, "INVALID_PROFILE_TYPE", "unknown profile type")
    linked = user.get("linkedProfiles", [])
    if body.profileType in linked:
        _error(409, "PROFILE_ALREADY_LINKED", "profile already linked")
    linked.append(body.profileType)
    user["linkedProfiles"] = linked
    await set_doc("users", uid, user)
    return await _with_role_profiles(user)


@router.delete("/me/profiles/{profile_type}")
async def unlink_profile(profile_type: str, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    linked = user.get("linkedProfiles", [])
    if profile_type not in linked:
        _error(404, "PROFILE_NOT_LINKED", "profile is not linked")
    if len(linked) == 1:
        _error(409, "LAST_PROFILE", "कम से कम एक प्रोफाइल आवश्यक है")
    linked.remove(profile_type)
    user["linkedProfiles"] = linked
    if user.get("activeProfile") == profile_type:
        primary = user.get("primaryProfile")
        user["activeProfile"] = primary if primary in linked else linked[0]
    if user.get("primaryProfile") == profile_type:
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
    if profile_type not in user.get("linkedProfiles", []):
        _error(404, "PROFILE_NOT_LINKED", "profile is not linked")
    user["activeProfile"] = profile_type
    await set_doc("users", uid, user)
    return {
        "activeProfile": profile_type,
        "defaultHomeRoute": DEFAULT_HOME[profile_type],
        "user": user,
    }


@router.put("/me/profiles/{profile_type}/primary")
async def set_primary_profile(profile_type: str, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    if profile_type not in user.get("linkedProfiles", []):
        _error(404, "PROFILE_NOT_LINKED", "profile is not linked")
    user["primaryProfile"] = profile_type
    await set_doc("users", uid, user)
    return await _with_role_profiles(user)


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
