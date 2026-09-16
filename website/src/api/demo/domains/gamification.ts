// features.md §5.15 / endpoints.md §19 — gamification demo handlers.
import { register } from '../registry';
import { demoError, id, nowIso, paginate, requireAuth } from '../util';
import { getDb, saveDb } from '../db';
import type { CoinLedgerEntry, GamificationStatus, RedeemRes, Reward } from '@/api/types';

// day-13 Task A3 — level thresholds [0, 500, 1500, 3000, 6000]
const LEVEL_THRESHOLDS = [0, 500, 1500, 3000, 6000];

register('GET', '/gamification/status', ({ headers }) => {
  const { uid } = requireAuth(headers);
  const user = getDb().users[uid];
  const next = LEVEL_THRESHOLDS.find((t) => t > user.agriCoins);
  const body: GamificationStatus = {
    krishiRatnaLevel: user.krishiRatnaLevel,
    krishiRatnaTitle: user.krishiRatnaTitle,
    agriCoins: user.agriCoins,
    streakDays: user.streakDays,
    xpToNextLevel: next ? next - user.agriCoins : 0,
  };
  return { status: 200, body };
});

register('GET', '/gamification/rewards', ({ headers }) => {
  requireAuth(headers);
  const body: Reward[] = getDb().rewards;
  return { status: 200, body };
});

register('POST', '/gamification/redeem', ({ headers, body }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const user = db.users[uid];
  const { rewardId } = (body ?? {}) as { rewardId?: string };
  const reward = db.rewards.find((r) => r.id === rewardId);
  if (!reward) throw demoError(404, 'REWARD_NOT_FOUND', 'रिवॉर्ड सापडला नाही.');
  if (user.agriCoins < reward.coinCost) {
    throw demoError(409, 'INSUFFICIENT_COINS', 'पर्याप्त कॉइन नहीं');
  }
  user.agriCoins -= reward.coinCost;
  const entry: CoinLedgerEntry = {
    id: id('cl'),
    delta: -reward.coinCost,
    reason: 'redeem',
    balanceAfter: user.agriCoins,
    at: nowIso(),
  };
  db.coinLedger.unshift(entry);
  saveDb();
  const res: RedeemRes = { newBalance: user.agriCoins };
  if (reward.type === 'voucher') {
    res.couponCode = `KC-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }
  return { status: 200, body: res };
});

register('GET', '/gamification/ledger', ({ headers, query }) => {
  requireAuth(headers);
  const list = [...getDb().coinLedger].sort((a, b) => b.at.localeCompare(a.at));
  return { status: 200, body: paginate(list, query) };
});
