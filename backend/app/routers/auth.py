from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from firebase_admin import auth as firebase_auth
from pydantic import ValidationError

from app.core.config import settings
from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.ratelimit import hit
from app.core.security import hash_mpin, validate_mpin_format, verify_mpin
from app.models.auth import (
    AuthResponse,
    FirebaseVerifyRequest,
    MpinResetRequest,
    MpinSetRequest,
    MpinVerifyRequest,
    PhoneMpinLoginRequest,
    QuickLoginRequest,
    RefreshRequest,
    TokenPair,
)
from app.models.role_profiles import ROLE_PROFILE_MODELS
from app.models.user import RegisterRequest, VALID_PROFILES
from app.services.tokens import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    decode_token,
    is_refresh_live,
    revoke_refresh_family,
    revoke_refresh_jti,
    store_refresh_jti,
)
from app.services.users import upsert_user_from_firebase

router = APIRouter(prefix="/auth", tags=["auth"])


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def _verify_firebase_token(id_token: str) -> dict:
    if settings.env == "dev" and (id_token.startswith("dev-") or id_token.startswith("demo-")):
        return {"uid": id_token, "phone_number": "+919876543210"}
    try:
        return firebase_auth.verify_id_token(id_token)
    except firebase_auth.InvalidIdTokenError:
        _error(401, "INVALID_FIREBASE_TOKEN", "firebase ID token is invalid or expired")


def _normalize_phone(phone: str) -> str:
    if phone and not phone.startswith("+"):
        return "+91" + phone
    return phone


def _public_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k != "mpinHash"}


async def _issue_session(uid: str, user_agent: str | None) -> dict:
    pair = {"accessToken": create_access_token(uid), "refreshToken": create_refresh_token(uid)}
    _, jti = decode_refresh_token(pair["refreshToken"])
    await store_refresh_jti(jti, uid)
    try:
        from app.core.cache import get_redis
        from app.core.config import settings
        now = datetime.now(timezone.utc).isoformat()
        await (await get_redis()).hset(
            f"auth:session:{jti}",
            mapping={"userId": uid, "device": user_agent or "unknown", "createdAt": now, "lastUsedAt": now},
        )
        await (await get_redis()).expire(f"auth:session:{jti}", settings.jwt_refresh_ttl_days * 86400)
    except Exception:
        pass  # Redis optional in dev; sessions list degrades to empty
    return pair


@router.post("/login", response_model=AuthResponse, response_model_exclude_none=True)
async def login_with_phone_mpin(
    request: Request,
    body: PhoneMpinLoginRequest,
    user_agent: str | None = Header(None),
):
    await hit("login", f"{request.client.host if request.client else 'unknown'}:{_normalize_phone(body.phone)}", 10, 600)
    phone = _normalize_phone(body.phone)
    validate_mpin_format(body.mpin)
    # A phone can have multiple user docs (demo seeding, quick-login phone
    # fallbacks). Verify the MPIN against every candidate and log into the
    # one that matches, so a stale duplicate doc never shadow-blocks login.
    users = await query("users", [("phone", "==", phone)])
    if not users:
        _error(404, "USER_NOT_FOUND", "no account found for this phone number")
    user = next(
        (
            u
            for u in users
            if u.get("mpinHash") is not None
            and (
                verify_mpin(body.mpin, u["mpinHash"])
                or (
                    settings.env == "dev"
                    and body.mpin == "1234"
                    and (
                        u["id"].startswith("dev-")
                        or u["id"].startswith("omni-")
                        or u.get("isDemo", False)
                    )
                )
            )
        ),
        None,
    )
    if user is None:
        if all(u.get("mpinHash") is None for u in users):
            _error(409, "MPIN_NOT_SET", "MPIN is not set for this account")
        _error(401, "WRONG_MPIN", "incorrect MPIN")
    uid = user["id"]
    try:
        # WS-01 (task 1.25): a login within 72h of a churn touch records the
        # re-engagement outcome. Never blocks login.
        from app.services.churn import record_return

        await record_return(uid)
    except Exception:  # noqa: BLE001 — outcome hook must never fail a login
        pass
    pair = await _issue_session(uid, user_agent)
    return AuthResponse(
        accessToken=pair["accessToken"],
        refreshToken=pair["refreshToken"],
        isNewUser=False,
        user=_public_user(user),
    )


@router.post("/firebase-verify", response_model=AuthResponse, response_model_exclude_none=True)
async def firebase_verify(body: FirebaseVerifyRequest, user_agent: str | None = Header(None)):
    decoded = _verify_firebase_token(body.idToken)
    uid = decoded["uid"]
    phone = decoded.get("phone_number", "")
    if phone and not phone.startswith("+"):
        phone = "+91" + phone
    user, is_new = await upsert_user_from_firebase(uid, phone)
    try:
        from app.services.churn import record_return

        await record_return(uid)
    except Exception:  # noqa: BLE001 — outcome hook must never fail a login
        pass
    pair = await _issue_session(uid, user_agent)
    return AuthResponse(
        accessToken=pair["accessToken"],
        refreshToken=pair["refreshToken"],
        isNewUser=is_new,
        user=_public_user(user),
    )


@router.post("/register", response_model=AuthResponse, response_model_exclude_none=True)
async def register(body: RegisterRequest, user_agent: str | None = Header(None)):
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
    if body.profiles and any(p not in VALID_PROFILES for p in body.profiles):
        _error(422, "INVALID_PROFILE_TYPE", "profiles must be valid profile types")
    if body.profiles and body.primaryProfile not in body.profiles:
        _error(422, "INVALID_PROFILE_TYPE", "primaryProfile must be one of profiles")
    if body.roleProfiles and not body.profiles:
        _error(422, "INVALID_ROLE_PROFILE", "roleProfiles requires at least one profile")
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
    primary = body.primaryProfile or (body.profiles[0] if body.profiles else "")
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
            "primaryProfile": primary,
            "activeProfile": primary,
            "mpinHash": hash_mpin(body.mpin),
            "language": body.preferredLanguage or body.language or "en",
            "preferredLanguage": body.preferredLanguage or body.language or "en",
            "email": body.email,
            "dateOfBirth": body.dateOfBirth,
            "gender": body.gender,
        }
    )
    for field in ("pincode", "addressLine", "alternatePhone"):
        value = getattr(body, field)
        if value:
            user[field] = value
    await set_doc("users", uid, user)
    now = datetime.now(timezone.utc).isoformat()
    for ptype, variant in variants.items():
        await set_doc(f"users/{uid}/role_profiles", ptype, {**variant.model_dump(), "createdAt": now})
    if referrer is not None:
        user["referralCodeUsed"] = body.referralCode
        await set_doc("users", uid, user)
        # Attribution ONLY — no coins move at registration. The referrer is
        # credited after the invitee's FIRST completed transaction
        # (services.referrals.credit_referral_on_first_transaction), per the
        # X11 anti-fraud rule in robust.md §7.16.
        existing_attribution = await get_doc("referral_attributions", uid)
        await set_doc(
            "referral_attributions",
            uid,
            {
                "referrerUid": referrer["id"],
                "referredUid": uid,
                "code": body.referralCode,
                "status": "joined",
                "credited": bool(existing_attribution and existing_attribution.get("credited")),
                "referredPhone": phone,
                "createdAt": now,
            },
        )
    pair = await _issue_session(uid, user_agent)
    return AuthResponse(
        accessToken=pair["accessToken"],
        refreshToken=pair["refreshToken"],
        isNewUser=False,
        user=_public_user(user),
        referral={"applied": referrer is not None},
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest):
    user_id, jti = decode_refresh_token(body.refreshToken)
    if not await is_refresh_live(jti):
        await revoke_refresh_family(user_id)
        _error(401, "REFRESH_REPLAYED", "refresh token reuse detected — all sessions revoked")
    await revoke_refresh_jti(jti)
    new_refresh = create_refresh_token(user_id)
    _, new_jti = decode_refresh_token(new_refresh)
    await store_refresh_jti(new_jti, user_id)
    return TokenPair(accessToken=create_access_token(user_id), refreshToken=new_refresh)


@router.post("/mpin/set")
async def mpin_set(body: MpinSetRequest, uid: str = Depends(current_user_id)):
    validate_mpin_format(body.mpin)
    user = await get_doc("users", uid) or {"id": uid}
    user["mpinHash"] = hash_mpin(body.mpin)
    await set_doc("users", uid, user)
    return {"ok": True}


@router.post("/mpin/verify")
async def mpin_verify(
    body: MpinVerifyRequest,
    authorization: str | None = Header(None),
):
    uid = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization[len("Bearer "):]
        try:
            uid = decode_token(raw_token, "access")
        except HTTPException:
            try:
                uid = decode_token(raw_token, "refresh")
            except HTTPException:
                pass
    if uid is None and body.refreshToken:
        try:
            uid = decode_token(body.refreshToken, "refresh")
        except HTTPException:
            pass

    if uid is None:
        _error(401, "MISSING_TOKEN", "missing or malformed Authorization header")

    user = await get_doc("users", uid)
    if user is None or user.get("mpinHash") is None:
        _error(409, "MPIN_NOT_SET", "MPIN is not set for this account")
    if not verify_mpin(body.mpin, user["mpinHash"]):
        if settings.env == "dev" and body.mpin == "1234" and (
            uid.startswith("dev-") or uid.startswith("omni-") or user.get("isDemo", False)
        ):
            return {"ok": True}
        _error(401, "WRONG_MPIN", "incorrect MPIN")
    return {"ok": True}


@router.post("/mpin/reset")
async def mpin_reset(body: MpinResetRequest):
    decoded = _verify_firebase_token(body.idToken)
    uid = decoded["uid"]
    await hit("otp", decoded.get("phone_number") or decoded["uid"], 5, 600)
    validate_mpin_format(body.newMpin)
    user = await get_doc("users", uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    user["mpinHash"] = hash_mpin(body.newMpin)
    await set_doc("users", uid, user)
    return {"ok": True}


@router.post("/quick-login", response_model=AuthResponse, response_model_exclude_none=True)
async def quick_login(body: QuickLoginRequest, user_agent: str | None = Header(None)):
    if settings.env != "dev":
        _error(403, "DISABLED_IN_PROD", "quick-login is only available in dev")
    if not body.mpin:
        _error(422, "MPIN_REQUIRED", "an explicit MPIN is required")
    now_iso = datetime.now(timezone.utc).isoformat()
    
    PERSONA_DEFAULTS = {
        "omni": {
            "id": "omni-user-777",
            "name": "Balaram Kisan (Universal Agro-Entrepreneur)",
            "vernacularName": "बलराम किसान",
            "phone": "+919876543210",
            "village": "चांदवड़",
            "district": "Nashik",
            "state": "Maharashtra",
            "landAreaAcres": 12.5,
            "soilType": "काली मिट्टी (Black Cotton)",
            "irrigationType": "Drip & Sprinkler",
            "activeCrops": ["Tomato (टमाटर)", "Wheat (गेहूं)", "Onion (प्याज)", "Cotton (कपास)"],
            "linkedProfiles": ["farmer", "farmLandlord", "transport", "seller", "equipmentRental", "broker", "instructor", "dairyManager", "bankManager", "insuranceProvider", "coldStorageProvider"],
            "primaryProfile": "farmer",
            "activeProfile": "farmer",
            "language": "en",
            "preferredLanguage": "en",
            "agriCoins": 2450,
            "krishiRatnaLevel": 5,
            "krishiRatnaTitle": "Krishi Shiromani",
            "streakDays": 24,
        },
        "farmer": {
            "id": "dev-user-1",
            "name": "Ram Singh (किसान)",
            "vernacularName": "राम सिंह",
            "phone": "+919999999999",
            "village": "Rampur",
            "district": "Nashik",
            "state": "Maharashtra",
            "landAreaAcres": 5.5,
            "soilType": "काली मिट्टी",
            "irrigationType": "Drip",
            "activeCrops": ["Tomato (टमाटर)", "Wheat (गेहूं)"],
            "linkedProfiles": ["farmer"],
            "primaryProfile": "farmer",
            "activeProfile": "farmer",
            "agriCoins": 1250,
            "krishiRatnaLevel": 4,
            "krishiRatnaTitle": "Krishi Daksh",
            "streakDays": 12,
        },
        "farmLandlord": {
            "id": "yCnTcSMcMeQRp5tKu8Zb5u3etV23",
            "name": "Suresh Patel (भू-स्वामी)",
            "vernacularName": "सुरेश पटेल",
            "phone": "+919999999999",
            "village": "Nashik Rural",
            "district": "Nashik",
            "state": "Maharashtra",
            "landAreaAcres": 45.0,
            "linkedProfiles": ["farmLandlord", "farmer"],
            "primaryProfile": "farmLandlord",
            "activeProfile": "farmLandlord",
            "agriCoins": 1600,
            "krishiRatnaLevel": 4,
            "krishiRatnaTitle": "Krishi Daksh",
            "streakDays": 15,
        },
        "transport": {
            "id": "dev-user-3",
            "name": "Rajesh Kumar (परिवहन)",
            "vernacularName": "राजेश कुमार",
            "phone": "+917777777777",
            "village": "Nashik APMC Hub",
            "district": "Nashik",
            "state": "Maharashtra",
            "landAreaAcres": 0,
            "linkedProfiles": ["transport"],
            "primaryProfile": "transport",
            "activeProfile": "transport",
            "agriCoins": 950,
            "krishiRatnaLevel": 3,
            "krishiRatnaTitle": "Krishi Mitra",
            "streakDays": 8,
        },
        "seller": {
            "id": "dev-user-2",
            "name": "Amit Agarwal (मंडी व्यापारी)",
            "vernacularName": "अमित अग्रवाल",
            "phone": "+918888888888",
            "village": "Pimpalgaon Baswant",
            "district": "Nashik",
            "state": "Maharashtra",
            "landAreaAcres": 0,
            "linkedProfiles": ["seller"],
            "primaryProfile": "seller",
            "activeProfile": "seller",
            "agriCoins": 1800,
            "krishiRatnaLevel": 4,
            "krishiRatnaTitle": "Krishi Daksh",
            "streakDays": 19,
        },
        "directBuyer": {
            "id": "dev-user-8",
            "name": "Shree Foods Pvt Ltd",
            "vernacularName": "श्री फूड्स",
            "phone": "+919222222222",
            "village": "MIDC Ambad, Nashik",
            "district": "Nashik",
            "state": "Maharashtra",
            "landAreaAcres": 0,
            "companyName": "Shree Foods Pvt Ltd",
            "buyerType": "processor",
            "gstin": "27AAKCS1234F1Z5",
            "licenseNo": "FSSAI/10012043001234",
            "linkedProfiles": ["directBuyer"],
            "primaryProfile": "directBuyer",
            "activeProfile": "directBuyer",
            "agriCoins": 1300,
            "krishiRatnaLevel": 4,
            "krishiRatnaTitle": "Krishi Daksh",
            "streakDays": 11,
        },
        "equipmentRental": {
            "id": "dev-user-4",
            "name": "Harpreet Singh (कृषि यंत्र स्वामी)",
            "vernacularName": "हरप्रीत सिंह",
            "phone": "+916666666666",
            "village": "Ozar",
            "district": "Nashik",
            "state": "Maharashtra",
            "landAreaAcres": 15.0,
            "linkedProfiles": ["equipmentRental", "farmer"],
            "primaryProfile": "equipmentRental",
            "activeProfile": "equipmentRental",
            "agriCoins": 1400,
            "krishiRatnaLevel": 4,
            "krishiRatnaTitle": "Krishi Daksh",
            "streakDays": 10,
        },
        "broker": {
            "id": "dev-user-6",
            "name": "Vikram Deshmukh (मंडी दलाल)",
            "vernacularName": "विक्रम देशमुख",
            "phone": "+919876500006",
            "village": "Nashik Mandi Yard",
            "district": "Nashik",
            "state": "Maharashtra",
            "landAreaAcres": 0,
            "linkedProfiles": ["broker"],
            "primaryProfile": "broker",
            "activeProfile": "broker",
            "agriCoins": 1100,
            "krishiRatnaLevel": 3,
            "krishiRatnaTitle": "Krishi Mitra",
            "streakDays": 9,
        },
        "bankManager": {
            "id": "dev-user-7",
            "name": "Anita Sharma (बैंक मैनेजर)",
            "vernacularName": "अनीता शर्मा",
            "phone": "+919555555555",
            "village": "Nashik",
            "district": "Nashik",
            "state": "Maharashtra",
            "landAreaAcres": 0,
            "linkedProfiles": ["bankManager"],
            "primaryProfile": "bankManager",
            "activeProfile": "bankManager",
            "agriCoins": 0,
            "krishiRatnaLevel": 1,
            "krishiRatnaTitle": "Krishi Mitra",
            "streakDays": 0,
        },
        "insuranceProvider": {
            "id": "dev-user-insurance-1",
            "name": "Dr. Rajesh Varma (बीमा प्रदाता)",
            "vernacularName": "डॉ. राजेश वर्मा",
            "phone": "+919444444444",
            "village": "AIC Regional Hub, Nashik",
            "district": "Nashik",
            "state": "Maharashtra",
            "companyName": "AIC of India (कृषि बीमा कंपनी)",
            "licenseNumber": "IRDAI/NL/AGRI/2026/089",
            "landAreaAcres": 0,
            "linkedProfiles": ["insuranceProvider"],
            "primaryProfile": "insuranceProvider",
            "activeProfile": "insuranceProvider",
            "agriCoins": 0,
            "krishiRatnaLevel": 1,
            "krishiRatnaTitle": "Krishi Mitra",
            "streakDays": 0,
        },
        "coldStorageProvider": {
            "id": "dev-user-coldstorage-1",
            "name": "Vikram Shinde (कोल्ड स्टोरेज संचालक)",
            "vernacularName": "विक्रम शिंदे",
            "phone": "+919333333333",
            "village": "Pimpalgaon Baswant, Niphad",
            "district": "Nashik",
            "state": "Maharashtra",
            "companyName": "Sahyadri Cold Chain & Agri Logistics",
            "licenseNumber": "WDRA/MH/NSK/2026/044",
            "facilityId": "cs-1",
            "landAreaAcres": 0,
            "linkedProfiles": ["coldStorageProvider"],
            "primaryProfile": "coldStorageProvider",
            "activeProfile": "coldStorageProvider",
            "agriCoins": 0,
            "krishiRatnaLevel": 1,
            "krishiRatnaTitle": "Krishi Mitra",
            "streakDays": 0,
        },
    }

    if body.persona and body.persona in PERSONA_DEFAULTS:
        pdata = dict(PERSONA_DEFAULTS[body.persona])
        uid = pdata["id"]
        existing = await get_doc("users", uid)
        if existing is None:
            pdata["mpinHash"] = hash_mpin(body.mpin)
            pdata["createdAt"] = now_iso
            await set_doc("users", uid, pdata)
            user = pdata
        else:
            if existing.get("mpinHash") is None:
                existing["mpinHash"] = hash_mpin(body.mpin)
                await set_doc("users", uid, existing)
            user = existing
        pair = await _issue_session(uid, user_agent)
        return AuthResponse(
            accessToken=pair["accessToken"],
            refreshToken=pair["refreshToken"],
            isNewUser=False,
            user=_public_user(user),
        )

    phone = _normalize_phone(body.phone or "")
    if not phone:
        pdata = dict(PERSONA_DEFAULTS["omni"])
        uid = pdata["id"]
        user = (await get_doc("users", uid)) or pdata
        if user.get("mpinHash") is None:
            user["mpinHash"] = hash_mpin(body.mpin)
            await set_doc("users", uid, user)
        pair = await _issue_session(uid, user_agent)
        return AuthResponse(
            accessToken=pair["accessToken"],
            refreshToken=pair["refreshToken"],
            isNewUser=False,
            user=_public_user(user),
        )

    users = await query("users", [("phone", "==", phone)])
    if users:
        user = users[0]
        uid = user["id"]
        if user.get("mpinHash") is None:
            user["mpinHash"] = hash_mpin(body.mpin)
            await set_doc("users", uid, user)
    else:
        uid = f"user_{phone.replace('+', '')[-10:]}"
        user = {
            "id": uid,
            "name": f"Kisan ({phone[-4:]})",
            "vernacularName": f"किसान ({phone[-4:]})",
            "phone": phone,
            "village": "Nashik",
            "district": "Nashik",
            "state": "Maharashtra",
            "landAreaAcres": 5.0,
            "soilType": "काली मिट्टी",
            "irrigationType": "Drip",
            "activeCrops": ["Tomato (टमाटर)", "Wheat (गेहूं)"],
            "linkedProfiles": ["farmer", "farmLandlord", "transport", "seller", "equipmentRental", "broker", "instructor", "dairyManager"],
            "primaryProfile": "farmer",
            "activeProfile": "farmer",
            "language": "en",
            "preferredLanguage": "en",
            "agriCoins": 500,
            "krishiRatnaLevel": 2,
            "krishiRatnaTitle": "Krishi Pragati",
            "streakDays": 5,
            "mpinHash": hash_mpin(body.mpin),
            "createdAt": now_iso,
        }
        await set_doc("users", uid, user)

    pair = await _issue_session(uid, user_agent)
    return AuthResponse(
        accessToken=pair["accessToken"],
        refreshToken=pair["refreshToken"],
        isNewUser=False,
        user=_public_user(user),
    )


@router.get("/sessions")
async def list_sessions(uid: str = Depends(current_user_id)):
    from app.core.cache import get_redis
    try:
        r = await get_redis()
        jtis = await r.smembers(f"auth:refresh_family:{uid}")
        sessions = []
        for jti in sorted(jtis):
            meta = await r.hgetall(f"auth:session:{jti}")
            if meta:
                sessions.append({"id": jti, **meta})
        return {"sessions": sessions}
    except Exception:
        return {"sessions": []}


@router.delete("/sessions/{jti}")
async def revoke_session(jti: str, uid: str = Depends(current_user_id)):
    from app.core.cache import get_redis
    try:
        r = await get_redis()
        if not await r.sismember(f"auth:refresh_family:{uid}", jti):
            _error(404, "SESSION_NOT_FOUND", "no such session for this user")
    except HTTPException:
        raise
    except Exception:
        _error(404, "SESSION_NOT_FOUND", "no such session for this user")
    await revoke_refresh_jti(jti)
    return {"ok": True}


@router.post("/logout")
async def logout(body: RefreshRequest):
    user_id, jti = decode_refresh_token(body.refreshToken)
    await revoke_refresh_jti(jti)
    return {"ok": True}

