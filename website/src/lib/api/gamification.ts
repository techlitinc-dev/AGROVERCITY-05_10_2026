import { api } from './client';

/**
 * Krishi Ratna / gamification wrappers — mirrors
 * `backend/app/routers/gamification.py` one-to-one.
 *
 * Backend quirks (verified against backend/app/routers/gamification.py):
 * - Every route requires an authenticated user; no role gate.
 * - `/gamification/redeem` costs exactly the reward's `coinsCost` from the
 *   catalog; passing any other amount answers 400 `VALIDATION_ERROR`.
 * - X11 abuse guards live server-side (`platform_config/coins`): the 200
 *   coins/day earn cap and the ≤50%-of-order redemption cap. When redeeming
 *   against an order, send `orderValuePaisa` so the server can enforce the
 *   ceiling (422 `REDEMPTION_CAP_EXCEEDED`).
 * - `Coins are never redeemable for cash` — regulatory label required in the
 *   store UI (`coinsNoCashRedemption`).
 * - Errors use the standard envelope `{ error: { code, message, fieldErrors } }`
 *   surfaced by `client.ts` as `ApiError`.
 */

export interface LevelInfo {
  tier: string;
  title: string;
  minCoins: number;
  nextTier: string | null;
  coinsToNextTier: number;
  progressPct: number;
}

export interface DailyStreak {
  current: number;
  longest: number;
}

export interface GamificationStats {
  coinsEarnedTotal: number;
  diaryEntries: number;
  referrals: number;
  redeems: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
  progress: number;
  target: number;
}

export interface RewardItem {
  type: string;
  title: string;
  coinsCost: number;
  icon: string;
  available: boolean;
  description?: string;
}

export interface GamificationStatus {
  userId: string;
  agriCoins: number;
  level: LevelInfo;
  dailyStreak: DailyStreak;
  stats: GamificationStats;
  badges: Badge[];
  availableRewards: RewardItem[];
}

export async function gamificationStatus(): Promise<GamificationStatus> {
  const { data } = await api.get<GamificationStatus>('/gamification/status');
  return data;
}

export interface LedgerEntry {
  id: string;
  amount: number;
  reason: string;
  refId: string | null;
  balanceAfter: number;
  at: string;
}

/** Legacy page envelope (page/pageSize/total — NOT the cursor shape). */
export interface LedgerPage {
  data: LedgerEntry[];
  page: number;
  pageSize: number;
  total: number;
}

export async function coinLedger(page = 1, pageSize = 20): Promise<LedgerPage> {
  const { data } = await api.get<LedgerPage>('/gamification/ledger', {
    params: { page, pageSize },
  });
  return data;
}

export async function rewardsCatalog(): Promise<{ data: RewardItem[] }> {
  const { data } = await api.get<{ data: RewardItem[] }>('/gamification/rewards');
  return data;
}

export interface RedeemInput {
  rewardType: string;
  coins: number;
  /** Order value in integer paisa — enables the ≤50% X11 ceiling. */
  orderValuePaisa?: number;
  targetId?: string;
}

export interface RedeemResult {
  voucherCode: string;
  coins: number;
  balance: number;
  reward: RewardItem;
  redeemedAt: string;
}

/** `Idempotency-Key` is added automatically by `client.ts` on writes. */
export async function redeemReward(input: RedeemInput): Promise<RedeemResult> {
  const { data } = await api.post<RedeemResult>('/gamification/redeem', input);
  return data;
}

export interface CoinLeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  village: string;
  coinsEarned: number;
  isMe: boolean;
}

export interface CoinLeaderboard {
  data: CoinLeaderboardRow[];
  myRank: { rank: number; coinsEarned: number } | null;
  period: string;
}

/** `period` is `all` | `month`; anything else answers 400. */
export async function coinLeaderboard(period: 'all' | 'month' = 'all'): Promise<CoinLeaderboard> {
  const { data } = await api.get<CoinLeaderboard>('/gamification/leaderboard', {
    params: { period },
  });
  return data;
}
