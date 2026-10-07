import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.gamification import (
    Badge,
    CoinLeaderboardResponse,
    CoinLeaderboardRow,
    DailyStreak,
    GamificationStats,
    GamificationStatusResponse,
    LedgerPage,
    LevelInfo,
    RedeemRequest,
    RedeemResponse,
    RewardDetail,
    RewardItem,
)
from app.services.coins import (
    InsufficientCoins,
    coin_tiers,
    coins_earned_total,
    get_ledger_page,
    redemption_cap_coins,
    spend_coins,
)
from app.services.notifications import send_fcm_to_user
from app.services.users import get_user

router = APIRouter(prefix="/gamification", tags=["gamification"])

REWARDS_CATALOG = [
    {
        "type": "voucher",
        "title": "खाद वाउचर",
        "coinsCost": 300,
        "icon": "🎟️",
        "description": "खाद खरीद पर विशेष छूट वाउचर",
    },
    {
        "type": "soil_test",
        "title": "मिट्टी जांच",
        "coinsCost": 500,
        "icon": "🧪",
        "description": "मिट्टी स्वास्थ्य जांच बुकिंग",
    },
    {
        "type": "expert_call",
        "title": "विशेषज्ञ कॉल",
        "coinsCost": 800,
        "icon": "📞",
        "description": "कृषि विशेषज्ञ से एक सत्र सलाह कॉल",
    },
    {
        "type": "workshop",
        "title": "कार्यशाला छूट",
        "coinsCost": 1000,
        "icon": "🎓",
        "description": "आगामी कृषि कार्यशाला में प्रवेश छूट",
    },
]


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _level_info(coins: int, tiers: list[dict]) -> LevelInfo:
    current = tiers[0]
    for tier in tiers:
        if coins >= tier["minCoins"]:
            current = tier
    idx = tiers.index(current)
    if idx == len(tiers) - 1:
        return LevelInfo(
            tier=current["tier"],
            title=current["title"],
            minCoins=current["minCoins"],
            nextTier=None,
            coinsToNextTier=0,
            progressPct=100.0,
        )
    nxt = tiers[idx + 1]
    span = nxt["minCoins"] - current["minCoins"]
    return LevelInfo(
        tier=current["tier"],
        title=current["title"],
        minCoins=current["minCoins"],
        nextTier=nxt["tier"],
        coinsToNextTier=max(0, nxt["minCoins"] - coins),
        progressPct=round((coins - current["minCoins"]) / span * 100, 1) if span else 0.0,
    )


def _streaks(dates: set) -> tuple[int, int]:
    if not dates:
        return 0, 0
    longest = run = 1
    prev = None
    for d in sorted(dates):
        if prev is not None:
            run = run + 1 if (d - prev).days == 1 else 1
            longest = max(longest, run)
        prev = d
    today = datetime.now(timezone.utc).date()
    anchor = today if today in dates else today - timedelta(days=1)
    current = 0
    if anchor in dates:
        current = 1
        d = anchor
        while (d - timedelta(days=1)) in dates:
            current += 1
            d -= timedelta(days=1)
    return current, longest


async def _referral_count(uid: str) -> tuple[int, str | None]:
    profile = await get_doc("referrals", uid)
    if profile:
        return profile.get("joinedCount", 0), None
    attributions = await query("referral_attributions", [("referrerUid", "==", uid)], limit=1000)
    earliest = min((a.get("createdAt", "") for a in attributions), default="") or None
    return len(attributions), earliest


@router.get("/status", response_model=GamificationStatusResponse)
async def get_gamification_status(uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    coins = user.get("agriCoins", 0)
    tiers = await coin_tiers()

    ledger = await query(f"users/{uid}/coin_ledger", [], limit=1000)
    dates = {datetime.fromisoformat(e["at"]).date() for e in ledger if e.get("at")}
    streak_current, streak_longest = _streaks(dates)

    diary_entries = await query(f"users/{uid}/diary_entries", [], limit=1000)
    diary_dates = sorted(e.get("date", "") for e in diary_entries if e.get("date"))
    referrals, first_referral_at = await _referral_count(uid)
    redeems = await query(f"users/{uid}/redeemed_rewards", [], limit=1000)
    earned_total = await coins_earned_total(uid)
    today_iso = datetime.now(timezone.utc).date().isoformat()

    badges = [
        Badge(
            id="first_entry",
            title="पहला कदम",
            description="पहली डायरी एंट्री लिखें",
            icon="🌱",
            earned=len(diary_entries) >= 1,
            earnedAt=diary_dates[0] if diary_dates else None,
            progress=min(len(diary_entries), 1),
            target=1,
        ),
        Badge(
            id="diary_regular",
            title="नियमित लेखक",
            description="30 डायरी एंट्री पूरी करें",
            icon="📔",
            earned=len(diary_entries) >= 30,
            progress=min(len(diary_entries), 30),
            target=30,
        ),
        Badge(
            id="sharer",
            title="संपर्क जोड़",
            description="पहला रेफरल जोड़ें",
            icon="🤝",
            earned=referrals >= 1,
            earnedAt=first_referral_at,
            progress=min(referrals, 1),
            target=1,
        ),
        Badge(
            id="referral_star",
            title="रेफरल सितारा",
            description="10 रेफरल जोड़ें",
            icon="⭐",
            earned=referrals >= 10,
            progress=min(referrals, 10),
            target=10,
        ),
        Badge(
            id="coin_collector",
            title="सिक्का संग्राहक",
            description="500 AgriCoins कमाएं",
            icon="🪙",
            earned=earned_total >= 500,
            progress=min(earned_total, 500),
            target=500,
        ),
        Badge(
            id="big_earner",
            title="बड़े कमाऊ",
            description="2000 AgriCoins कमाएं",
            icon="🏆",
            earned=earned_total >= 2000,
            progress=min(earned_total, 2000),
            target=2000,
        ),
        Badge(
            id="redeemer",
            title="इनाम भुनाने वाला",
            description="पहला इनाम भुनाएं",
            icon="🎁",
            earned=len(redeems) >= 1,
            progress=min(len(redeems), 1),
            target=1,
        ),
        Badge(
            id="consistent",
            title="लगातार मेहनत",
            description="7 दिन की स्ट्रीक बनाएं",
            icon="🔥",
            earned=streak_current >= 7,
            earnedAt=today_iso if streak_current >= 7 else None,
            progress=min(streak_current, 7),
            target=7,
        ),
    ]

    return GamificationStatusResponse(
        userId=uid,
        agriCoins=coins,
        level=_level_info(coins, tiers),
        dailyStreak=DailyStreak(current=streak_current, longest=streak_longest),
        stats=GamificationStats(
            coinsEarnedTotal=earned_total,
            diaryEntries=len(diary_entries),
            referrals=referrals,
            redeems=len(redeems),
        ),
        badges=badges,
        availableRewards=[
            RewardItem(**item, available=coins >= item["coinsCost"]) for item in REWARDS_CATALOG
        ],
    )


@router.get("/ledger", response_model=LedgerPage)
async def get_coin_ledger(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    uid: str = Depends(current_user_id),
):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    entries, total = await get_ledger_page(uid, page=page, pageSize=pageSize)
    return LedgerPage(data=entries, page=page, pageSize=pageSize, total=total)


@router.get("/rewards")
async def get_rewards_catalog(uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    coins = user.get("agriCoins", 0)
    return {
        "data": [
            RewardDetail(**item, available=coins >= item["coinsCost"]).model_dump()
            for item in REWARDS_CATALOG
        ]
    }


@router.post("/redeem", response_model=RedeemResponse)
async def redeem_coins(body: RedeemRequest, uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    item = next((r for r in REWARDS_CATALOG if r["type"] == body.rewardType), None)
    if item is None:
        _error(
            400,
            "VALIDATION_ERROR",
            "unknown reward type",
            {"rewardType": "must be one of voucher | soil_test | expert_call | workshop"},
        )
    if body.coins != item["coinsCost"]:
        _error(
            400,
            "VALIDATION_ERROR",
            f"{body.rewardType} costs exactly {item['coinsCost']} coins",
            {"coins": f"must be {item['coinsCost']}"},
        )
    # X11: when the redemption is applied against an order, coins may never
    # exceed the configured share of the order value (platform_config/coins).
    if body.orderValuePaisa is not None:
        cap = await redemption_cap_coins(body.orderValuePaisa)
        if body.coins > cap:
            _error(
                422,
                "REDEMPTION_CAP_EXCEEDED",
                "coins may not exceed the allowed share of the order value",
                {"coins": f"must be 1..{cap}"},
            )
    reward_id = f"rw_{uuid.uuid4().hex[:12]}"
    try:
        balance = await spend_coins(uid, body.coins, "redeem", reward_id)
    except InsufficientCoins:
        _error(
            400,
            "INSUFFICIENT_COINS",
            f"अपर्याप्त एग्री-कॉइन्स (वर्तमान: {user.get('agriCoins', 0)}, आवश्यक: {body.coins})",
        )
    now = datetime.now(timezone.utc).isoformat()
    voucher_code = f"AGRI-{body.rewardType.upper()[:4]}-{datetime.now(timezone.utc).strftime('%d%H%M')}"
    await set_doc(
        f"users/{uid}/redeemed_rewards",
        reward_id,
        {
            "id": reward_id,
            "rewardType": body.rewardType,
            "title": item["title"],
            "coins": body.coins,
            "voucherCode": voucher_code,
            "createdAt": now,
        },
    )
    await send_fcm_to_user(
        uid,
        "इनाम भुनाया गया",
        f"{item['title']} — वाउचर कोड: {voucher_code}",
        {"type": "reward_redeemed", "rewardType": body.rewardType, "voucherCode": voucher_code},
    )
    return RedeemResponse(
        voucherCode=voucher_code,
        coins=body.coins,
        balance=balance,
        reward=RewardDetail(**item),
        redeemedAt=now,
    )


@router.get("/leaderboard", response_model=CoinLeaderboardResponse)
async def get_coin_leaderboard(
    period: str = Query("all"),
    uid: str = Depends(current_user_id),
):
    if period not in ("all", "month"):
        _error(
            400,
            "VALIDATION_ERROR",
            "invalid period",
            {"period": "must be all | month"},
        )
    entries = await query("gamification_ledger", [], limit=1000)
    if period == "month":
        first_of_month = datetime.now(timezone.utc).date().replace(day=1).isoformat()
        entries = [e for e in entries if (e.get("at") or "") >= first_of_month]
    totals: dict[str, int] = {}
    for entry in entries:
        amount = entry.get("amount", 0)
        if amount > 0 and entry.get("userId"):
            totals[entry["userId"]] = totals.get(entry["userId"], 0) + amount
    ranked = sorted(totals.items(), key=lambda kv: (-kv[1], kv[0]))
    my_rank = None
    for rank, (earner_uid, coins_earned) in enumerate(ranked, 1):
        if earner_uid == uid:
            my_rank = {"rank": rank, "coinsEarned": coins_earned}
            break
    rows = []
    for rank, (earner_uid, coins_earned) in enumerate(ranked[:10], 1):
        earner = (await get_user(earner_uid)) or {}
        rows.append(
            CoinLeaderboardRow(
                rank=rank,
                userId=earner_uid,
                name=earner.get("name") or "Kisan",
                village=earner.get("village") or "",
                coinsEarned=coins_earned,
                isMe=earner_uid == uid,
            )
        )
    return CoinLeaderboardResponse(data=rows, myRank=my_rank, period=period)
