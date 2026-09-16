from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, set_doc
from app.core.deps import current_user_id
from app.models.user import (
    FarmBoundaryRequest,
    LinkProfileRequest,
    UserUpdateRequest,
    VALID_PROFILES,
)
from app.services.profile_routes import DEFAULT_HOME
from app.services.users import get_user

router = APIRouter(prefix="/users", tags=["users"])


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def require_role(user: dict, *roles: str):
    if user["activeProfile"] not in roles:
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
    return await _with_role_profiles(user)


@router.put("/me")
async def put_me(body: UserUpdateRequest, uid: str = Depends(current_user_id)):
    user = await _require_user(uid)
    for field, value in body.model_dump(exclude_none=True).items():
        user[field] = value
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
