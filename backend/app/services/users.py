from datetime import datetime, timezone

from app.core.db import get_doc, set_doc


async def get_user(uid: str) -> dict | None:
    user = await get_doc("users", uid)
    if user is not None:
        if "referralCode" not in user:
            user["referralCode"] = "ref_" + uid[:8]
            await set_doc("users", uid, user)
        if "preferredLanguage" not in user or "language" not in user:
            pref = user.get("preferredLanguage") or user.get("language") or "en"
            user["preferredLanguage"] = pref
            user["language"] = pref
            await set_doc("users", uid, user)
    return user


async def upsert_user_from_firebase(uid: str, phone: str) -> tuple[dict, bool]:
    user = await get_user(uid)
    if user is not None:
        return user, False
    user = {
        "id": uid,
        "phone": phone,
        "referralCode": "ref_" + uid[:8],
        "name": "",
        "vernacularName": "",
        "language": "en",
        "preferredLanguage": "en",
        "village": "",
        "tehsil": "",
        "district": "",
        "state": "",
        "landAreaAcres": 0,
        "soilType": "",
        "irrigationType": "",
        "kisanCreditScore": 0,
        "creditTier": "",
        "krishiRatnaLevel": 1,
        "krishiRatnaTitle": "Krishi Shishya",
        "streakDays": 0,
        "agriCoins": 0,
        "bankName": "",
        "kccLimit": 0,
        "activeCrops": [],
        "farmBoundaryPoints": [],
        "linkedProfiles": ["farmer"],
        "primaryProfile": "farmer",
        "activeProfile": "farmer",
        "mpinHash": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("users", uid, user)
    return user, True
