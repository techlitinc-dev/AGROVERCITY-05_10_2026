from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth
from pydantic import ValidationError

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.security import hash_mpin, validate_mpin_format, verify_mpin
from app.models.auth import (
    AuthResponse,
    FirebaseVerifyRequest,
    MpinResetRequest,
    MpinSetRequest,
    MpinVerifyRequest,
    RefreshRequest,
    TokenPair,
)
from app.models.role_profiles import ROLE_PROFILE_MODELS
from app.models.user import RegisterRequest, VALID_PROFILES
from app.services.tokens import create_access_token, create_refresh_token, decode_token
from app.services.users import upsert_user_from_firebase

router = APIRouter(prefix="/auth", tags=["auth"])


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def _verify_firebase_token(id_token: str) -> dict:
    try:
        return firebase_auth.verify_id_token(id_token)
    except firebase_auth.InvalidIdTokenError:
        _error(401, "INVALID_FIREBASE_TOKEN", "firebase ID token is invalid or expired")


def _normalize_phone(phone: str) -> str:
    if phone and not phone.startswith("+"):
        return "+91" + phone
    return phone


@router.post("/firebase-verify", response_model=AuthResponse, response_model_exclude_none=True)
async def firebase_verify(body: FirebaseVerifyRequest):
    decoded = _verify_firebase_token(body.idToken)
    uid = decoded["uid"]
    phone = decoded.get("phone_number", "")
    if phone and not phone.startswith("+"):
        phone = "+91" + phone
    user, is_new = await upsert_user_from_firebase(uid, phone)
    return AuthResponse(
        accessToken=create_access_token(uid),
        refreshToken=create_refresh_token(uid),
        isNewUser=is_new,
        user=user,
    )


@router.post("/register", response_model=AuthResponse, response_model_exclude_none=True)
async def register(body: RegisterRequest):
    decoded = _verify_firebase_token(body.idToken)
    uid = decoded["uid"]
    token_phone = _normalize_phone(decoded.get("phone_number", ""))
    phone = _normalize_phone(body.phone)
    if phone != token_phone:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "phone does not match the verified number",
                "fieldErrors": {"phone": "must match the Firebase-verified phone"},
            },
        )
    validate_mpin_format(body.mpin)
    if not body.profiles or any(p not in VALID_PROFILES for p in body.profiles):
        _error(422, "INVALID_PROFILE_TYPE", "profiles must be non-empty and valid profile types")
    if body.primaryProfile not in body.profiles:
        _error(422, "INVALID_PROFILE_TYPE", "primaryProfile must be one of profiles")
    variants = {}
    for ptype, raw in (body.roleProfiles or {}).items():
        model = ROLE_PROFILE_MODELS.get(ptype)
        if model is None or ptype not in body.profiles:
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
    referrer = None
    if body.referralCode:
        matches = await query("users", [("referralCode", "==", body.referralCode)])
        referrer = matches[0] if matches else None
        if referrer is None or referrer.get("id") == uid:
            _error(400, "INVALID_REFERRAL_CODE", "referral code is invalid")
    user, _ = await upsert_user_from_firebase(uid, phone)
    user.update(
        {
            "name": body.name,
            "phone": phone,
            "state": body.state,
            "district": body.district,
            "tehsil": body.tehsil,
            "village": body.village,
            "landAreaAcres": body.landAreaAcres,
            "soilType": body.soilType,
            "irrigationType": body.irrigationType,
            "activeCrops": body.crops,
            "linkedProfiles": body.profiles,
            "primaryProfile": body.primaryProfile,
            "activeProfile": body.primaryProfile,
            "mpinHash": hash_mpin(body.mpin),
        }
    )
    await set_doc("users", uid, user)
    now = datetime.now(timezone.utc).isoformat()
    for ptype, variant in variants.items():
        await set_doc(f"users/{uid}/role_profiles", ptype, {**variant.model_dump(), "createdAt": now})
    if referrer is not None:
        # coins are awarded Day 13 — only attribution is recorded today.
        await set_doc(
            "referral_attributions",
            uid,
            {
                "referrerUid": referrer["id"],
                "referredUid": uid,
                "code": body.referralCode,
                "status": "pending",
                "createdAt": now,
            },
        )
    return AuthResponse(
        accessToken=create_access_token(uid),
        refreshToken=create_refresh_token(uid),
        isNewUser=False,
        user=user,
        referral={"applied": referrer is not None},
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest):
    user_id = decode_token(body.refreshToken, "refresh")
    return TokenPair(
        accessToken=create_access_token(user_id),
        refreshToken=create_refresh_token(user_id),
    )


@router.post("/mpin/set")
async def mpin_set(body: MpinSetRequest, uid: str = Depends(current_user_id)):
    validate_mpin_format(body.mpin)
    user = await get_doc("users", uid) or {"id": uid}
    user["mpinHash"] = hash_mpin(body.mpin)
    await set_doc("users", uid, user)
    return {"ok": True}


@router.post("/mpin/verify")
async def mpin_verify(body: MpinVerifyRequest, uid: str = Depends(current_user_id)):
    user = await get_doc("users", uid)
    if user is None or user.get("mpinHash") is None:
        _error(409, "MPIN_NOT_SET", "MPIN is not set for this account")
    if not verify_mpin(body.mpin, user["mpinHash"]):
        _error(401, "WRONG_MPIN", "incorrect MPIN")
    return {"ok": True}


@router.post("/mpin/reset")
async def mpin_reset(body: MpinResetRequest):
    decoded = _verify_firebase_token(body.idToken)
    uid = decoded["uid"]
    validate_mpin_format(body.newMpin)
    user = await get_doc("users", uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    user["mpinHash"] = hash_mpin(body.newMpin)
    await set_doc("users", uid, user)
    return {"ok": True}
