import re

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query
from app.core.deps import current_user_id
from app.models.referral import (
    InviteRequest,
    InviteResponse,
    InvitedFarmer,
    LeaderboardEntry,
    MyRank,
    ReferralMilestone,
    ReferralsResponse,
    ReferralStats,
    ReferredUser,
)
from app.services import referrals as service
from app.services.users import get_user

router = APIRouter(prefix="/referrals", tags=["referrals"])

E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _share_link(code: str) -> str:
    return f"https://agrovercity.in/r/{code}"


def _share_message(code: str) -> str:
    return (
        f"Kisan Setu par judiye! Mera referral code {code} use karein "
        f"aur 100 AgriCoins ka bonus paayein: {_share_link(code)}"
    )


async def _profile_stats(profile: dict) -> ReferralStats:
    return ReferralStats(
        invited=profile.get("invitedCount", 0),
        joined=profile.get("joinedCount", 0),
        totalEarnedCoins=profile.get("totalEarnedCoins", 0),
    )


async def _build_referred_list(uid: str) -> list[ReferredUser]:
    invited_docs = await query(f"referrals/{uid}/invited", [], limit=1000)
    referred: list[ReferredUser] = [
        ReferredUser(
            name=doc.get("name") or "Kisan",
            phone=doc.get("phone"),
            status=doc.get("status", "invited"),
            invitedAt=doc.get("invitedAt"),
            joinedAt=doc.get("joinedAt"),
            rewardCoins=service.JOIN_REWARD_COINS if doc.get("status") == "joined" else 0,
        )
        for doc in invited_docs
    ]
    invited_referred_uids = {doc.get("referredUid") for doc in invited_docs if doc.get("referredUid")}

    attributions = await query("referral_attributions", [("referrerUid", "==", uid)], limit=1000)
    for attribution in attributions:
        referred_uid = attribution.get("referredUid")
        if referred_uid in invited_referred_uids:
            continue
        joined_at = attribution.get("createdAt")
        referred_user = (await get_doc("users", referred_uid)) or {}
        referred.append(
            ReferredUser(
                name=referred_user.get("name") or "Kisan",
                phone=attribution.get("referredPhone") or referred_user.get("phone"),
                status="joined",
                invitedAt=joined_at,
                joinedAt=joined_at,
                rewardCoins=service.JOIN_REWARD_COINS,
            )
        )

    # joined first, newest first within each group
    referred.sort(key=lambda r: r.joinedAt or r.invitedAt or "", reverse=True)
    referred.sort(key=lambda r: 0 if r.status == "joined" else 1)
    return referred


@router.get("", response_model=ReferralsResponse)
async def get_referrals(uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    profile = await service.get_or_create_referral_profile(uid, user)
    referred = await _build_referred_list(uid)
    leaderboard, my_rank = await service.referral_leaderboard(uid)
    code = user.get("referralCode") or profile.get("referralCode") or f"ref_{uid[:8]}"
    return ReferralsResponse(
        referralCode=code,
        shareLink=_share_link(code),
        shareMessage=_share_message(code),
        stats=await _profile_stats(profile),
        milestones=[ReferralMilestone(**m) for m in profile.get("milestones", [])],
        referred=referred,
        leaderboard=[LeaderboardEntry(**row) for row in leaderboard],
        myRank=MyRank(**my_rank) if my_rank else None,
    )


@router.post("/invite", status_code=201, response_model=InviteResponse)
async def invite_farmer(body: InviteRequest, uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    phone = body.phone.strip()
    if not E164_RE.match(phone):
        _error(
            400,
            "VALIDATION_ERROR",
            "invalid invite request",
            {"phone": "must be a valid E.164 phone number (e.g. +919876543210)"},
        )
    name = body.name.strip()
    try:
        invited, _ = await service.record_invite(uid, name, phone)
    except service.AlreadyInvited:
        _error(409, "ALREADY_INVITED", "इस फ़ोन नंबर को पहले से आमंत्रित किया जा चुका है")
    profile = await service.get_or_create_referral_profile(uid, user)
    code = user.get("referralCode") or profile.get("referralCode") or f"ref_{uid[:8]}"
    return InviteResponse(
        invite=InvitedFarmer(**invited),
        referralCode=code,
        shareLink=_share_link(code),
        shareMessage=_share_message(code),
        agriCoinsEarned=service.INVITE_REWARD_COINS,
        stats=await _profile_stats(profile),
        milestones=[ReferralMilestone(**m) for m in profile.get("milestones", [])],
    )
