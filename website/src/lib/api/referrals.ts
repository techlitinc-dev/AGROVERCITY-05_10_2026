import { api } from './client';

/**
 * Refer & Earn wrappers — mirrors `backend/app/routers/referrals.py` one-to-one.
 *
 * Backend quirks (verified against backend/app/routers/referrals.py):
 * - Every route requires an authenticated user; no role gate.
 * - Phone numbers must be E.164 (`+919876543210`) — anything else answers 400
 *   `VALIDATION_ERROR`; a duplicate phone answers 409 `ALREADY_INVITED`.
 * - X11 anti-fraud: registering with a code stores attribution but moves NO
 *   coins. The referrer is credited only after the invitee's FIRST completed
 *   transaction (`services/referrals.credit_referral_on_first_transaction`).
 * - `shareMessage` / `shareLink` arrive already localized from the backend —
 *   render them verbatim in the WhatsApp deep-link.
 * - Errors use the standard envelope surfaced by `client.ts` as `ApiError`.
 */

export interface ReferralMilestone {
  count: number;
  rewardCoins: number;
  achieved: boolean;
}

export interface ReferralStats {
  invited: number;
  joined: number;
  totalEarnedCoins: number;
}

export interface ReferredUser {
  name: string;
  phone: string | null;
  status: string;
  invitedAt: string | null;
  joinedAt: string | null;
  rewardCoins: number;
}

export interface ReferralLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  village: string;
  referralCount: number;
  isMe: boolean;
}

export interface ReferralHub {
  referralCode: string;
  shareLink: string;
  shareMessage: string;
  stats: ReferralStats;
  milestones: ReferralMilestone[];
  referred: ReferredUser[];
  leaderboard: ReferralLeaderboardEntry[];
  myRank: { rank: number; referralCount: number } | null;
}

export async function referralHub(): Promise<ReferralHub> {
  const { data } = await api.get<ReferralHub>('/referrals');
  return data;
}

export interface InviteInput {
  name: string;
  phone: string;
}

export interface InviteResult {
  invite: {
    name: string;
    phone: string;
    status: string;
    invitedAt: string | null;
  };
  referralCode: string;
  shareLink: string;
  shareMessage: string;
  agriCoinsEarned: number;
  stats: ReferralStats;
  milestones: ReferralMilestone[];
}

/** `Idempotency-Key` is added automatically by `client.ts` on writes. */
export async function inviteFarmer(input: InviteInput): Promise<InviteResult> {
  const { data } = await api.post<InviteResult>('/referrals/invite', input);
  return data;
}
