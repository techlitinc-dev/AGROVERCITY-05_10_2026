export interface GamificationStatus {
  krishiRatnaLevel: number;
  krishiRatnaTitle: string;
  agriCoins: number;
  streakDays: number;
  xpToNextLevel: number;
}

export interface Reward {
  id: string;
  title: string;
  coinCost: number;
  type: 'voucher' | 'service' | 'discount';
}

export interface CoinLedgerEntry {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  at: string;
}

export interface RedeemRes {
  newBalance: number;
  couponCode?: string;
}

export interface ReferralUser {
  id: string;
  farmerName: string;
  village: string;
  phone: string;
  joinDate: string;
  status: 'Joined' | 'Verified' | 'Active';
  rewardCoins: number;
}

export interface ReferralMilestone {
  count: number;
  reward: string;
  achieved: boolean;
}

export interface ReferralData {
  referralCode: string;
  milestones: ReferralMilestone[];
  referred: ReferralUser[];
}

export interface ReferralValidateRes {
  valid: boolean;
  name?: string;
  village?: string;
}
