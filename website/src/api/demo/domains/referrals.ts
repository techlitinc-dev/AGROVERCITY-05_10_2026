// features.md §5.16 / endpoints.md §19 / overview-03 §D.1 — referrals demo handlers.
import { register } from '../registry';
import { demoError, id, nowIso, requireAuth, today } from '../util';
import { getDb, saveDb, type DemoUser } from '../db';
import type {
  CoinLedgerEntry,
  ReferralData,
  ReferralMilestone,
  ReferralUser,
  ReferralValidateRes,
} from '@/api/types';

const MILESTONES: Array<Pick<ReferralMilestone, 'count' | 'reward'>> = [
  { count: 1, reward: '+100 कॉइन्स' },
  { count: 5, reward: 'मोफत माती चाचणी' },
  { count: 10, reward: '₹500 उपकरण सूट' },
];

// day-13 Task A3: uppercase(name without spaces) + join year, e.g. RAMSINGH2026
function referralCodeFor(user: DemoUser): string {
  return `${user.name.replace(/[^a-zA-Z]/g, '').toUpperCase()}2026`;
}

register('GET', '/referrals', ({ headers }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const referred = db.referrals;
  const body: ReferralData = {
    referralCode: referralCodeFor(db.users[uid]),
    milestones: MILESTONES.map((m) => ({ ...m, achieved: referred.length >= m.count })),
    referred,
  };
  return { status: 200, body };
});

register('POST', '/referrals/invite', ({ headers, body }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const b = (body ?? {}) as { farmerName?: string; phone?: string };
  const farmerName = b.farmerName?.trim() ?? '';
  if (!farmerName) {
    throw demoError(422, 'VALIDATION_ERROR', 'शेतकऱ्याचे नाव आवश्यक आहे.', { farmerName: 'required' });
  }
  const digits = (b.phone ?? '').replace(/\D/g, '');
  const phone = (b.phone ?? '').startsWith('+') ? `+${digits}` : `+91${digits.slice(-10)}`;
  if (!/^\+91\d{10}$/.test(phone)) {
    throw demoError(422, 'VALIDATION_ERROR', 'वैध 10-अंकी मोबाइल नंबर द्या.', { phone: 'invalid' });
  }
  if (db.referrals.some((r) => r.phone === phone)) {
    throw demoError(409, 'ALREADY_INVITED', 'पहले से आमंत्रित');
  }
  const user = db.users[uid];
  const referral: ReferralUser = {
    id: id('ref'),
    farmerName,
    village: '',
    phone,
    joinDate: today(),
    status: 'Joined',
    rewardCoins: 100,
  };
  db.referrals.push(referral);
  user.agriCoins += 100;
  const entry: CoinLedgerEntry = {
    id: id('cl'),
    delta: 100,
    reason: 'referral',
    balanceAfter: user.agriCoins,
    at: nowIso(),
  };
  db.coinLedger.unshift(entry);
  saveDb();
  return { status: 201, body: { agriCoinsEarned: 100 } };
});

register('GET', '/referrals/validate', ({ query }) => {
  const code = (query.code ?? '').trim().toUpperCase();
  const db = getDb();
  for (const user of Object.values(db.users)) {
    if (referralCodeFor(user) === code) {
      const body: ReferralValidateRes = { valid: true, name: user.name, village: user.village };
      return { status: 200, body };
    }
  }
  return { status: 200, body: { valid: false } satisfies ReferralValidateRes };
});
