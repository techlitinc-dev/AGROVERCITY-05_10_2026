import React, { useEffect, useState } from 'react';
import {
  Coins,
  Gift,
  Copy,
  Check,
  Users,
  Award,
  AlertCircle,
  CheckCircle2,
  Trophy,
  ScrollText,
  UserPlus,
  Share2,
} from 'lucide-react';
import { apiErrorMessage, gamification, referrals } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { StatCard } from '../../components/common/StatCard';
import { cn, formatDateTime, formatNumber } from '../../lib/utils';
import { asRecord, asRecords, pickNum, pickStr } from '../shared/records';

type Tab = 'overview' | 'rewards' | 'referrals' | 'leaderboard';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Wallet & Ledger' },
  { id: 'rewards', label: 'Rewards Store' },
  { id: 'referrals', label: 'Refer & Earn' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

export const KisanCoinsView: React.FC = () => {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [ledger, setLedger] = useState<Record<string, unknown>[]>([]);
  const [rewardList, setRewardList] = useState<Record<string, unknown>[]>([]);
  const [leaderboard, setLeaderboard] = useState<Record<string, unknown>[]>([]);
  const [referral, setReferral] = useState<Record<string, unknown>>({});
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [linkShared, setLinkShared] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [s, l, r, lb, ref] = await Promise.all([
        gamification.status().catch(() => ({})),
        gamification.ledger().catch(() => []),
        gamification.rewards().catch(() => []),
        gamification.leaderboard().catch(() => []),
        referrals.summary().catch(() => ({})),
      ]);
      if (!alive) return;
      setStatus(asRecord(s));
      setLedger(asRecords(l));
      setRewardList(asRecords(r));
      setLeaderboard(asRecords(lb));
      setReferral(asRecord(ref));
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const balance =
    pickNum(status, 'balance', 'coins', 'kisanCoins', 'totalCoins') || user?.kisanCoins || 0;
  const referralCode = pickStr(referral, 'code', 'referralCode', 'inviteCode') || '—';
  const referralCount =
    pickNum(referral, 'totalReferrals', 'referralCount', 'count', 'joined') || 0;
  const coinsEarned = pickNum(referral, 'coinsEarned', 'totalCoinsEarned', 'earned') || 0;

  const handleCopy = () => {
    if (referralCode === '—') return;
    navigator.clipboard.writeText(referralCode).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  // SR 17 — native share sheet when available, clipboard fallback with a flash.
  const handleShareInvite = async () => {
    const link = pickStr(referral, 'shareLink');
    const message = pickStr(referral, 'shareMessage') || `Join me on Agrovercity: ${link}`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'Agrovercity Refer & Earn', text: message, url: link });
        return;
      }
      await navigator.clipboard.writeText(link || message);
      setLinkShared(true);
      window.setTimeout(() => setLinkShared(false), 2000);
      flash('ok', 'Invite link copied — share it with fellow farmers!');
    } catch (err) {
      if ((err as Error | undefined)?.name === 'AbortError') return; // share sheet dismissed
      flash('err', apiErrorMessage(err));
    }
  };

  const handleRedeem = async (rewardId: string, title: string, cost: number) => {
    if (busyId) return;
    setBusyId(rewardId);
    try {
      await gamification.redeem(rewardId);
      flash('ok', `"${title}" redeemed for ${formatNumber(cost)} coins. It will appear in your vouchers.`);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleInvite = async () => {
    if (!invitePhone.trim() || busyId === 'invite') return;
    setBusyId('invite');
    try {
      await referrals.invite({ name: inviteName.trim() || undefined, phone: invitePhone.trim() });
      flash('ok', `Invite sent to +91 ${invitePhone.trim()} — you both earn 50 coins on registration!`);
      setInviteName('');
      setInvitePhone('');
      const ref = await referrals.summary().catch(() => ({}));
      setReferral(asRecord(ref));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Coins className="w-7 h-7 text-amber-500" />
          Kisan Coins Rewards Wallet & Referral Hub
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Earn Kisan Coins on every produce sale, transport trip, and neighbor referral. Redeem for farming subsidies.
        </p>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Current Balance"
          value={`${formatNumber(balance)} Coins`}
          subtitle={pickStr(status, 'tier', 'level') ? `Tier: ${pickStr(status, 'tier', 'level')}` : 'Redeemable across the platform'}
          icon={Coins}
          colorScheme="amber"
        />
        <StatCard
          title="Successful Referrals"
          value={`${referralCount} Farmers`}
          subtitle={coinsEarned > 0 ? `${formatNumber(coinsEarned)} coins earned from referrals` : '50 coins earned per active joining'}
          icon={Users}
          colorScheme="green"
        />
        <StatCard
          title="Farmer Reputation Badge"
          value={pickStr(status, 'badge', 'reputationBadge') || 'Kisan'}
          subtitle={pickStr(status, 'badgeSubtitle') || 'Earned via fulfillments & community trust'}
          icon={Award}
          colorScheme="purple"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'whitespace-nowrap px-4 py-2 rounded-2xl text-xs font-bold border transition-colors',
              tab === t.id
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW: ledger */}
      {tab === 'overview' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <ScrollText className="w-4 h-4 text-slate-400" /> Coin Ledger
          </h3>
          {ledger.length === 0 ? (
            <p className="text-xs text-slate-400">No coin movements yet — sell produce or refer a farmer to earn.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {ledger.slice(0, 20).map((e, i) => {
                const amount = pickNum(e, 'amount', 'coins', 'delta');
                const positive = amount >= 0;
                return (
                  <div key={pickStr(e, 'id') || i} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">
                        {pickStr(e, 'reason', 'description', 'narration', 'type') || 'Coin movement'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatDateTime(pickStr(e, 'createdAt', 'date', 'timestamp')) || '—'}
                      </p>
                    </div>
                    <span className={cn('font-black', positive ? 'text-emerald-700' : 'text-rose-600')}>
                      {positive ? '+' : ''}
                      {formatNumber(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REWARDS */}
      {tab === 'rewards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rewardList.length === 0 && (
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2">
              Rewards catalog is being restocked — check back soon.
            </p>
          )}
          {rewardList.map((r, i) => {
            const id = pickStr(r, 'id', 'rewardId') || String(i);
            const cost = pickNum(r, 'cost', 'coins', 'price');
            const title = pickStr(r, 'title', 'name') || 'Reward';
            return (
              <div
                key={id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4"
              >
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {pickStr(r, 'category', 'tag') || 'Reward'}
                  </span>
                  <h4 className="font-bold text-xs text-slate-900 mt-0.5">{title}</h4>
                  <span className="text-xs font-black text-amber-600 mt-1 block">
                    {formatNumber(cost)} Kisan Coins
                  </span>
                </div>
                <button
                  onClick={() => void handleRedeem(id, title, cost)}
                  disabled={busyId === id || balance < cost}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs whitespace-nowrap"
                >
                  <Gift className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  {busyId === id ? 'Redeeming…' : 'Redeem'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* REFERRALS */}
      {tab === 'referrals' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="font-extrabold text-lg">Invite Neighboring Farmers & Earn 50 Coins</h3>
              <p className="text-xs text-emerald-200 max-w-lg">
                Share your unique invite code. When they register their 7/12 land record, both of you receive 50 bonus Kisan Coins!
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 self-start sm:self-auto">
              <span className="font-mono font-black text-sm tracking-wider px-3">{referralCode}</span>
              <button
                onClick={handleCopy}
                disabled={referralCode === '—'}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => void handleShareInvite()}
                disabled={referralCode === '—'}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white font-bold text-xs rounded-xl border border-white/20 flex items-center gap-1.5 transition-colors"
                title="Share your invite link"
              >
                {linkShared ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{linkShared ? 'Copied' : 'Share invite link'}</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-emerald-600" /> Send an Invite
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Farmer name (optional)"
                className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
              <input
                type="tel"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
              <button
                onClick={() => void handleInvite()}
                disabled={invitePhone.length !== 10 || busyId === 'invite'}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                {busyId === 'invite' ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </div>

          {/* SR 17 — referred farmers (from GET /referrals `referred`) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" /> Referred Farmers
              </h3>
              <span className="text-[10px] font-bold text-slate-400">
                {asRecords(referral.referred).length} invited
              </span>
            </div>
            {asRecords(referral.referred).length === 0 ? (
              <p className="text-xs text-slate-400">
                No invites yet — share your code or send an invite to a neighboring farmer to start earning.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {asRecords(referral.referred).slice(0, 10).map((u, i) => {
                  const status = pickStr(u, 'status') || 'invited';
                  const joined = status === 'joined';
                  return (
                    <div key={pickStr(u, 'phone') || i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{pickStr(u, 'name') || 'Kisan'}</p>
                        <p className="text-[11px] text-slate-400">{pickStr(u, 'phone') || '—'}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span
                          className={cn(
                            'inline-block text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                            joined ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          )}
                        >
                          {joined ? 'Joined' : 'Invited'}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          {formatDateTime(pickStr(u, 'joinedAt', 'invitedAt')) || 'Awaiting signup'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEADERBOARD */}
      {tab === 'leaderboard' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" /> District Kisan Coins Leaderboard
          </h3>
          {leaderboard.length === 0 ? (
            <p className="text-xs text-slate-400">Leaderboard refreshes weekly.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaderboard.slice(0, 20).map((row, i) => {
                const name = pickStr(row, 'name', 'farmerName', 'userName') || `Farmer #${i + 1}`;
                const isMe = user && name === user.name;
                return (
                  <div
                    key={pickStr(row, 'id', 'userId', 'rank') || i}
                    className={cn('py-3 flex items-center justify-between gap-3 text-xs rounded-xl px-2', isMe && 'bg-amber-50')}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px]',
                          i === 0
                            ? 'bg-amber-400 text-amber-950'
                            : i === 1
                              ? 'bg-slate-300 text-slate-800'
                              : i === 2
                                ? 'bg-orange-300 text-orange-950'
                                : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {pickStr(row, 'rank') || i + 1}
                      </span>
                      <div>
                        <p className="font-bold text-slate-800">
                          {name}
                          {isMe && <span className="ml-1 text-[10px] text-amber-700 font-black">(YOU)</span>}
                        </p>
                        <p className="text-[11px] text-slate-400">{pickStr(row, 'village', 'district') || '—'}</p>
                      </div>
                    </div>
                    <span className="font-black text-amber-600">
                      {formatNumber(pickNum(row, 'coins', 'balance', 'score'))} coins
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
