"""Persona trust tiers (WS-03 G9).

Tier thresholds (documented contract):
    top          completed >= 50  AND avgRating >= 4.5 AND disputeRate < 0.02 AND KYC verified
    established  completed >= 20  AND avgRating >= 4.2 AND disputeRate < 0.05
    trusted      completed >= 5   AND avgRating >= 4.0
    new          everything else
Performance is order-bounded: `refresh_trust_tier(uid)` recomputes from the
user's ratings and stores `trustTier` on the user doc.
"""
from app.core.db import get_doc, query, set_doc


def compute_trust_tier(stats: dict) -> str:
    """Pure tier computation from {completed, avgRating, disputeRate, kycVerified}."""
    completed = int(stats.get("completed") or 0)
    avg = float(stats.get("avgRating") or 0.0)
    dispute = float(stats.get("disputeRate") or 0.0)
    kyc = bool(stats.get("kycVerified"))

    if completed >= 50 and avg >= 4.5 and dispute < 0.02 and kyc:
        return "top"
    if completed >= 20 and avg >= 4.2 and dispute < 0.05:
        return "established"
    if completed >= 5 and avg >= 4.0:
        return "trusted"
    return "new"


async def _is_kyc_verified(user: dict) -> bool:
    if user.get("kycVerified") is True:
        return True
    if user.get("kycStatus") == "verified":
        return True
    cases = await query("kyc_cases", [("userId", "==", user.get("id"))], limit=5)
    return any(case.get("status") == "verified" for case in cases)


async def refresh_trust_tier(uid: str) -> str:
    """Recompute and persist the user's trust tier; returns the tier."""
    user = await get_doc("users", uid) or {"id": uid}
    ratings = await query("ratings", [("providerId", "==", uid)], limit=1000)
    completed = len(ratings)
    avg = round(sum(int(r.get("stars") or 0) for r in ratings) / completed, 2) if completed else 0.0

    disputes = await query("disputes", [("againstId", "==", uid)], limit=1000)
    dispute_rate = round(len(disputes) / completed, 4) if completed else 0.0

    tier = compute_trust_tier(
        {
            "completed": completed,
            "avgRating": avg,
            "disputeRate": dispute_rate,
            "kycVerified": await _is_kyc_verified(user),
        }
    )
    user["trustTier"] = tier
    await set_doc("users", uid, user)
    return tier
