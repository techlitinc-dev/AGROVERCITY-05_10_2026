import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Coins, Repeat, ShoppingBag, Target, TrendingUp } from 'lucide-react';
import { analytics, gamification } from '../../lib/api';import { StatCard } from '../../components/common/StatCard';
import { formatCurrency } from '../../lib/utils';
import { asRecord, num, str } from './mallMappers';

interface CategorySpend {
  category?: string;
  amount?: number;
}

interface MonthlySpend {
  month?: string;
  spend?: number;
  tonnage?: number;
}

interface CustomerAnalytics {
  totalSpendRupees?: number;
  totalTonnageMT?: number;
  totalVolumeQuintals?: number;
  activeOrdersCount?: number;
  standingDemandsCount?: number;
  openQuotesCount?: number;
  fulfillmentSlaPercent?: number;
  categorySpend?: CategorySpend[];
  monthlySpendTrend?: MonthlySpend[];
}

interface GamificationStatus {
  agriCoins?: number;
  level?: {
    tier?: string;
    title?: string;
    nextTier?: string;
    coinsToNextTier?: number;
    progressPct?: number;
  };
  dailyStreak?: {
    current?: number;
    longest?: number;
  };
  stats?: {
    coinsEarnedTotal?: number;
    referrals?: number;
    redeems?: number;
  };
  badges?: Array<{ id?: string; title?: string; earned?: boolean }>;
}

export const CustomerWalletView: React.FC = () => {
  const [customerAnalytics, setCustomerAnalytics] = useState<CustomerAnalytics | null>(null);
  const [gamificationStatus, setGamificationStatus] = useState<GamificationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [a, g] = await Promise.all([
        analytics.customer().catch(() => null),
        gamification.status().catch(() => null),
      ]);
      if (!mounted) return;
      setCustomerAnalytics((a as CustomerAnalytics | null) ?? null);
      setGamificationStatus(asRecord(g) as unknown as GamificationStatus | null);
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-100 rounded w-64 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const monthly = customerAnalytics?.monthlySpendTrend ?? [];
  const maxMonthly = Math.max(1, ...monthly.map((m) => num(m.spend)));
  const categories = [...(customerAnalytics?.categorySpend ?? [])].sort((a, b) => num(b.amount) - num(a.amount));
  const maxCategory = Math.max(1, ...categories.map((c) => num(c.amount)));
  const earnedBadges = (gamificationStatus?.badges ?? []).filter((b) => b.earned);
  const level = gamificationStatus?.level;
  const streak = gamificationStatus?.dailyStreak;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Coins className="w-7 h-7 text-amber-500" />
          Wallet & Rewards
        </h1>
        <p className="text-xs text-slate-500 mt-1">Your purchase analytics, Kisan Coins, and loyalty progress</p>
      </div>

      {!customerAnalytics && !gamificationStatus && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl text-xs text-slate-500">
          Analytics and gamification are unavailable right now — try again shortly.
        </div>
      )}

      {/* Spend stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Spend"
          value={customerAnalytics ? formatCurrency(num(customerAnalytics.totalSpendRupees)) : '—'}
          subtitle="Confirmed & delivered orders"
          icon={ShoppingBag}
          colorScheme="green"
        />
        <StatCard
          title="Active Orders"
          value={customerAnalytics ? num(customerAnalytics.activeOrdersCount) : '—'}
          subtitle={`${num(customerAnalytics?.standingDemandsCount)} standing demands · ${num(customerAnalytics?.openQuotesCount)} open quotes`}
          icon={Repeat}
          colorScheme="blue"
        />
        <StatCard
          title="Volume Purchased"
          value={customerAnalytics ? `${num(customerAnalytics.totalVolumeQuintals, 0)} q` : '—'}
          subtitle={`${num(customerAnalytics?.totalTonnageMT)} MT total tonnage`}
          icon={TrendingUp}
          colorScheme="purple"
        />
        <StatCard
          title="Fulfillment SLA"
          value={customerAnalytics ? `${num(customerAnalytics.fulfillmentSlaPercent)}%` : '—'}
          subtitle="Orders delivered on time"
          icon={Target}
          colorScheme="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly spend */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Monthly Spend</h3>
          {monthly.length === 0 ? (
            <p className="text-xs text-slate-400">No purchase history yet — your monthly trend will appear here.</p>
          ) : (
            <div className="space-y-2">
              {monthly.slice(-6).map((m) => {
                const pct = Math.round((num(m.spend) / maxMonthly) * 100);
                return (
                  <div key={m.month}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-bold text-slate-600">{m.month}</span>
                      <span className="font-black text-emerald-700">{formatCurrency(num(m.spend))}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(4, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top categories */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Spend by Category</h3>
          {categories.length === 0 ? (
            <p className="text-xs text-slate-400">Category breakdown appears after your first orders.</p>
          ) : (
            <div className="space-y-2">
              {categories.slice(0, 6).map((c) => {
                const pct = Math.round((num(c.amount) / maxCategory) * 100);
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-bold text-slate-600 capitalize">{c.category}</span>
                      <span className="font-black text-indigo-700">{formatCurrency(num(c.amount))}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.max(4, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Gamification */}
      {gamificationStatus && (
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-6 text-white shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center">
                <Coins className="w-7 h-7" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-100">Kisan Coins balance</p>
                <p className="text-3xl font-black">{num(gamificationStatus.agriCoins)}</p>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-white/10 rounded-2xl p-3">
                <p className="text-lg font-black">{level?.tier ? str(level.tier).toUpperCase() : '—'}</p>
                <p className="text-[10px] font-bold text-amber-100 uppercase">{str(level?.title, 'Tier')}</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-3">
                <p className="text-lg font-black">{num(streak?.current)}</p>
                <p className="text-[10px] font-bold text-amber-100 uppercase">Day streak</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-3">
                <p className="text-lg font-black">{earnedBadges.length}</p>
                <p className="text-[10px] font-bold text-amber-100 uppercase">Badges</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-3">
                <p className="text-lg font-black">{num(gamificationStatus.stats?.coinsEarnedTotal)}</p>
                <p className="text-[10px] font-bold text-amber-100 uppercase">Coins earned</p>
              </div>
            </div>
          </div>

          {(num(level?.coinsToNextTier) > 0 || num(level?.progressPct) > 0) && (
            <div className="mt-4">
              <div className="flex justify-between text-[11px] font-bold text-amber-100 mb-1">
                <span>Progress to {str(level?.nextTier, 'next tier')}</span>
                <span>{Math.round(num(level?.progressPct))}%</span>
              </div>
              <div className="h-2 bg-amber-700/60 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, num(level?.progressPct))}%` }} />
              </div>
            </div>
          )}

          {earnedBadges.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {earnedBadges.slice(0, 6).map((badge) => (
                <span key={badge.id} className="px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-[10px] font-bold flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  {str(badge.title, badge.id ?? 'Badge')}
                </span>
              ))}
            </div>
          )}

          <p className="text-[11px] text-amber-100 mt-4">
            Redeem coins for discounts on inputs and deliveries from the Kisan Coins page.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          to="/customer/orders"
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
        >
          View Order History
        </Link>
        <Link
          to="/mall"
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
};
