from pydantic import BaseModel, Field


class ReferralMilestone(BaseModel):
    count: int
    rewardCoins: int
    achieved: bool = False


class ReferralStats(BaseModel):
    invited: int = 0
    joined: int = 0
    totalEarnedCoins: int = 0


class ReferredUser(BaseModel):
    name: str
    phone: str | None = None
    status: str = "invited"
    invitedAt: str | None = None
    joinedAt: str | None = None
    rewardCoins: int = 0


class InvitedFarmer(BaseModel):
    name: str
    phone: str
    status: str = "invited"
    invitedAt: str | None = None


class LeaderboardEntry(BaseModel):
    rank: int
    userId: str
    name: str
    village: str = ""
    referralCount: int
    isMe: bool = False


class MyRank(BaseModel):
    rank: int
    referralCount: int


class ReferralsResponse(BaseModel):
    referralCode: str
    shareLink: str
    shareMessage: str
    stats: ReferralStats
    milestones: list[ReferralMilestone]
    referred: list[ReferredUser]
    leaderboard: list[LeaderboardEntry]
    myRank: MyRank | None = None


class InviteRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    phone: str


class InviteResponse(BaseModel):
    invite: InvitedFarmer
    referralCode: str
    shareLink: str
    shareMessage: str
    agriCoinsEarned: int
    stats: ReferralStats
    milestones: list[ReferralMilestone]
