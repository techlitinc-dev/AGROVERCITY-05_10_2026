from pydantic import BaseModel, Field


class RedeemRequest(BaseModel):
    rewardType: str = Field(..., description="voucher | soil_test | expert_call | workshop")
    coins: int = Field(..., ge=10, le=1000)
    targetId: str | None = None


class LevelInfo(BaseModel):
    tier: str
    title: str
    minCoins: int
    nextTier: str | None = None
    coinsToNextTier: int
    progressPct: float


class DailyStreak(BaseModel):
    current: int
    longest: int


class GamificationStats(BaseModel):
    coinsEarnedTotal: int
    diaryEntries: int
    referrals: int
    redeems: int


class Badge(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    earned: bool
    earnedAt: str | None = None
    progress: int
    target: int


class RewardItem(BaseModel):
    type: str
    title: str
    coinsCost: int
    icon: str
    available: bool = True


class RewardDetail(RewardItem):
    description: str = ""


class GamificationStatusResponse(BaseModel):
    userId: str
    agriCoins: int
    level: LevelInfo
    dailyStreak: DailyStreak
    stats: GamificationStats
    badges: list[Badge]
    availableRewards: list[RewardItem]


class LedgerEntry(BaseModel):
    id: str
    amount: int
    reason: str
    refId: str | None = None
    balanceAfter: int
    at: str


class LedgerPage(BaseModel):
    data: list[LedgerEntry]
    page: int
    pageSize: int
    total: int


class RedeemResponse(BaseModel):
    voucherCode: str
    coins: int
    balance: int
    reward: RewardDetail
    redeemedAt: str


class CoinLeaderboardRow(BaseModel):
    rank: int
    userId: str
    name: str
    village: str = ""
    coinsEarned: int
    isMe: bool = False


class CoinLeaderboardResponse(BaseModel):
    data: list[CoinLeaderboardRow]
    myRank: dict | None = None
    period: str
