import uuid
from datetime import datetime, timezone

from app.core.db import get_doc, set_doc

_DEFAULTS = {"dataSharing": False, "location": False, "marketing": False}


class ConsentRequiredError(Exception):
    pass


async def get_consents(uid: str) -> dict:
    doc = await get_doc(f"users/{uid}/consents", "current")
    if doc is None:
        return dict(_DEFAULTS)
    return {key: bool(doc.get(key, False)) for key in _DEFAULTS}


async def put_consents(uid: str, consents: dict) -> dict:
    current = await get_consents(uid)
    now = datetime.now(timezone.utc).isoformat()
    for flag, new_value in consents.items():
        if current.get(flag) != new_value:
            await set_doc(
                "consent_log",
                uuid.uuid4().hex,
                {
                    "userId": uid,
                    "flag": flag,
                    "newValue": new_value,
                    "at": now,
                    "source": "app",
                },
            )
    updated = {**consents, "updatedAt": now}
    await set_doc(f"users/{uid}/consents", "current", updated)
    return updated


async def require_data_sharing(uid: str) -> None:
    consents = await get_consents(uid)
    if not consents.get("dataSharing", False):
        raise ConsentRequiredError("डेटा साझाकरण की सहमति आवश्यक है")
