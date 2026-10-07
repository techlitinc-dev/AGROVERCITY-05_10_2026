import uuid
from datetime import datetime, timezone

from app.core.db import get_doc, query, set_doc
from app.services.coins import award_coins

# joinedCount -> milestone bonus coins
MILESTONES: list[tuple[int, int]] = [(1, 50), (5, 150), (10, 500)]
INVITE_REWARD_COINS = 100
JOIN_REWARD_COINS = 100


class AlreadyInvited(Exception):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _audit_referral_credit(
    referrer_uid: str, referred_uid: str, units: int, kind: str
) -> None:
    """Rule 3: every referral credit writes an audit_logs row (integer units)."""
    audit_id = f"aud_ref_{uuid.uuid4().hex[:12]}"
    await set_doc(
        "audit_logs",
        audit_id,
        {
            "id": audit_id,
            "action": "REFERRAL_CREDIT",
            "kind": kind,
            "referrerUid": referrer_uid,
            "referredUid": referred_uid,
            "units": int(units),
            "at": _now(),
        },
    )


def _default_milestones() -> list[dict]:
    return [{"count": count, "rewardCoins": reward, "achieved": False} for count, reward in MILESTONES]


async def get_or_create_referral_profile(uid: str, user: dict | None = None) -> dict:
    profile = await get_doc("referrals", uid)
    if profile is None:
        if user is None:
            user = await get_doc("users", uid) or {}
        now = _now()
        profile = {
            "userId": uid,
            "referralCode": user.get("referralCode") or f"ref_{uid[:8]}",
            "invitedCount": 0,
            "joinedCount": 0,
            "totalEarnedCoins": 0,
            "milestones": _default_milestones(),
            "createdAt": now,
            "updatedAt": now,
        }
        await set_doc("referrals", uid, profile)
        return profile
    dirty = False
    for key, default in (("invitedCount", 0), ("joinedCount", 0), ("totalEarnedCoins", 0)):
        if key not in profile:
            profile[key] = default
            dirty = True
    if "milestones" not in profile or len(profile["milestones"]) != len(MILESTONES):
        profile["milestones"] = _default_milestones()
        dirty = True
    if dirty:
        profile["updatedAt"] = _now()
        await set_doc("referrals", uid, profile)
    return profile


async def record_invite(uid: str, name: str, phone: str) -> tuple[dict, int]:
    existing = await get_doc(f"referrals/{uid}/invited", phone)
    if existing is not None:
        raise AlreadyInvited(f"phone {phone} already invited by {uid}")
    profile = await get_or_create_referral_profile(uid)
    now = _now()
    invited_doc = {
        "name": name,
        "phone": phone,
        "status": "invited",
        "invitedAt": now,
    }
    await set_doc(f"referrals/{uid}/invited", phone, invited_doc)
    profile["invitedCount"] = profile.get("invitedCount", 0) + 1
    profile["totalEarnedCoins"] = profile.get("totalEarnedCoins", 0) + INVITE_REWARD_COINS
    profile["updatedAt"] = now
    await set_doc("referrals", uid, profile)
    new_balance = await award_coins(uid, INVITE_REWARD_COINS, "referral", phone)
    return invited_doc, new_balance


async def record_join(
    referrer_uid: str,
    referred_uid: str,
    code: str,
    referred_phone: str | None = None,
    referred_name: str | None = None,
) -> dict:
    user = await get_doc("users", referrer_uid) or {}
    profile = await get_or_create_referral_profile(referrer_uid, user)
    now = _now()
    profile["joinedCount"] = profile.get("joinedCount", 0) + 1

    invited_flipped = False
    if referred_phone:
        invited = await get_doc(f"referrals/{referrer_uid}/invited", referred_phone)
        if invited is not None and invited.get("status") != "joined":
            invited["status"] = "joined"
            invited["joinedAt"] = now
            invited["referredUid"] = referred_uid
            await set_doc(f"referrals/{referrer_uid}/invited", referred_phone, invited)
            invited_flipped = True

    await award_coins(referrer_uid, JOIN_REWARD_COINS, "referral", referred_uid)
    await _audit_referral_credit(referrer_uid, referred_uid, JOIN_REWARD_COINS, "join")
    earned = JOIN_REWARD_COINS
    new_milestones: list[dict] = []
    for milestone in profile.get("milestones", _default_milestones()):
        if not milestone.get("achieved") and profile["joinedCount"] >= milestone["count"]:
            milestone["achieved"] = True
            bonus = milestone["rewardCoins"]
            await award_coins(referrer_uid, bonus, "referral_milestone", f"milestone_{milestone['count']}")
            await _audit_referral_credit(
                referrer_uid, referred_uid, bonus, f"milestone_{milestone['count']}"
            )
            new_milestones.append({"count": milestone["count"], "rewardCoins": bonus})
            earned += bonus

    profile["totalEarnedCoins"] = profile.get("totalEarnedCoins", 0) + earned
    profile["updatedAt"] = now
    await set_doc("referrals", referrer_uid, profile)
    return {
        "joinedCount": profile["joinedCount"],
        "coinsEarned": earned,
        "invitedFlipped": invited_flipped,
        "newMilestones": new_milestones,
        "referredName": referred_name,
    }


async def credit_referral_on_first_transaction(referred_uid: str) -> dict | None:
    """Anti-fraud (X11 / §7.16): credit the referrer ONLY once the invitee
    completes their first transaction — never at registration.

    Registration stores a `referral_attributions/{referred_uid}` doc (no coins).
    The transaction-completion hook calls this; it is idempotent on the
    attribution's `credited` flag, so replaying the same transaction never
    double-credits. Returns the `record_join` result on the first credit, else
    `None`.
    """
    attribution = await get_doc("referral_attributions", referred_uid)
    if attribution is None or attribution.get("credited"):
        return None
    referrer_uid = attribution.get("referrerUid")
    if not referrer_uid:
        return None
    result = await record_join(
        referrer_uid,
        referred_uid,
        attribution.get("code", ""),
        referred_phone=attribution.get("referredPhone"),
    )
    attribution["credited"] = True
    attribution["creditedAt"] = _now()
    attribution["status"] = "credited"
    await set_doc("referral_attributions", referred_uid, attribution)
    # Notify the referrer now that the reward is real.
    from app.services.notifications import send_fcm_to_user

    await send_fcm_to_user(
        referrer_uid,
        "नया रेफरल जुड़ा",
        f"+{JOIN_REWARD_COINS} AgriCoins आपके खाते में जुड़े",
        {"type": "referral_joined", "referredUid": referred_uid},
    )
    for milestone in result["newMilestones"]:
        await send_fcm_to_user(
            referrer_uid,
            "रेफरल माइलस्टोन पूरा",
            f"{milestone['count']} रेफरल पूरे — +{milestone['rewardCoins']} AgriCoins मिले",
            {
                "type": "referral_milestone",
                "milestoneCount": milestone["count"],
                "rewardCoins": milestone["rewardCoins"],
            },
        )
    return result


async def referral_leaderboard(uid: str, limit: int = 10) -> tuple[list[dict], dict | None]:
    attributions = await query("referral_attributions", [], limit=1000)
    counts: dict[str, int] = {}
    for attribution in attributions:
        referrer = attribution.get("referrerUid")
        if referrer:
            counts[referrer] = counts.get(referrer, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    my_rank = None
    for rank, (referrer_uid, count) in enumerate(ranked, 1):
        if referrer_uid == uid:
            my_rank = {"rank": rank, "referralCount": count}
            break
    rows = []
    for rank, (referrer_uid, count) in enumerate(ranked[:limit], 1):
        user = (await get_doc("users", referrer_uid)) or {}
        rows.append(
            {
                "rank": rank,
                "userId": referrer_uid,
                "name": user.get("name") or "Kisan",
                "village": user.get("village") or "",
                "referralCount": count,
                "isMe": referrer_uid == uid,
            }
        )
    return rows, my_rank
