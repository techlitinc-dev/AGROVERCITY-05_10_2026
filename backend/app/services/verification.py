"""Identity-verification badge for the direct-connect marketplace.

"Verified" means identity verified only — it never implies payment, quality,
delivery, or trustworthiness guarantees. A user counts as identity-verified
when any of the unified KYC paths has approved them:

- ``users.kycStatus == "verified"`` (set by the registration/feature-gate KYC
  session flow), or
- the legacy ``users.vyapariVerified`` flag, or
- any approved case in ``kyc_cases`` (per-persona document review).
"""
from app.core.db import get_doc, query

VERIFIED_CASE_STATUSES = ("verified", "approved", "VERIFIED")


async def is_identity_verified(user: dict | None) -> bool:
    if not user:
        return False
    if user.get("kycStatus") == "verified" or user.get("vyapariVerified"):
        return True
    uid = user.get("id") or ""
    if not uid:
        return False
    cases = await query("kyc_cases", [("userId", "==", uid)], limit=20)
    return any(c.get("status") in VERIFIED_CASE_STATUSES for c in cases)


async def verification_badge(user: dict | None) -> dict:
    """Public badge shape — safe to embed in marketplace cards."""
    verified = await is_identity_verified(user)
    return {"verified": verified, "label": "Verified" if verified else "Unverified"}


async def verification_map(uids: list[str]) -> dict[str, bool]:
    """Batched identity-verification lookup for list endpoints — one kyc_cases
    scan instead of one query per user (spec §17: avoid N+1)."""
    users_by_id: dict[str, dict] = {}
    for uid in dict.fromkeys(uids):
        user = await get_doc("users", uid)
        if user:
            users_by_id[uid] = user
    cases = await query("kyc_cases", [], limit=2000)

    def _verified(uid: str) -> bool:
        user = users_by_id.get(uid) or {}
        if user.get("kycStatus") == "verified" or user.get("vyapariVerified"):
            return True
        return any(
            c.get("userId") == uid and c.get("status") in VERIFIED_CASE_STATUSES for c in cases
        )

    return {uid: _verified(uid) for uid in users_by_id}
