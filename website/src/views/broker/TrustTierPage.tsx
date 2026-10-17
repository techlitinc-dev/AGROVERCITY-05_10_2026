import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  ArrowLeft,
  RefreshCcw,
  Award,
  Clock,
  Star,
  Scale,
  Landmark,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { broker, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  LoadingBlock,
  num,
  paisaToRupees,
  rec,
  str,
  type Rec,
} from './shared';

/**
 * Broker trust & standing: KYC verification clock (48–72h SLA with
 * auto-escalation on breach), Proven Broker tier progress (deal volume +
 * two-sided ratings), commission track record and weekly settlements.
 */
export const TrustTierPage: React.FC = () => {
  const [trust, setTrust] = useState<Rec>({});
  const [commissions, setCommissions] = useState<Rec[]>([]);
  const [settlements, setSettlements] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c, s] = await Promise.all([
        broker.trustTier().catch(() => ({})),
        broker.commissions().catch(() => [] as unknown[]),
        broker.settlements().catch(() => [] as unknown[]),
      ]);
      setTrust(rec(t));
      setCommissions((c as unknown[]).map(rec));
      setSettlements((s as unknown[]).map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = commissions.find((c) => num(c.totalEarnedPaisa) > 0 || c.totals) ?? null;
  const earned = num(totals?.totalEarnedPaisa ?? totals?.earnedPaisa);
  const pending = num(totals?.pendingPayoutPaisa ?? totals?.pendingPaisa);
  const paid = num(totals?.paidPaisa);
  const proven = num(trust.proven) === 1 || str(trust.tier) === 'proven' || trust.proven === true;
  const caseStatus = str(trust.caseStatus, 'not submitted');
  const slaHours = num(trust.slaHours, 72);
  const slaBreached = num(trust.slaBreached) === 1 || trust.slaBreached === true;
  const requiredVolume = num(trust.requiredCompletedDeals, 10);
  const completedDeals = num(trust.completedDeals);
  const rating = num(trust.rating ?? trust.avgRating, 5);
  const volumeProgress = requiredVolume > 0 ? Math.min(100, Math.round((completedDeals / requiredVolume) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <Link to="/broker" className={ghostBtnCls}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
            Trust & Standing
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Your verification clock, Proven Broker tier, and the money track record behind your name
          </p>
        </div>
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Trust Tier"
              value={proven ? 'Proven Broker' : 'Standard Broker'}
              subtitle={proven ? 'Volume + rating threshold met — buyers see the badge' : 'Complete more rated deals to unlock the Proven badge'}
              icon={Award}
              colorScheme={proven ? 'green' : 'amber'}
            />
            <StatCard
              title="KYC Case"
              value={caseStatus === 'not submitted' ? 'Not Submitted' : caseStatus.replace(/_/g, ' ')}
              subtitle={slaBreached ? 'SLA breached — auto-escalated to admin' : `Review SLA ${slaHours}h from submission`}
              icon={Clock}
              colorScheme={slaBreached ? 'amber' : 'blue'}
            />
            <StatCard
              title="Rating"
              value={`${rating.toFixed(1)} ★`}
              subtitle="Two-sided deal ratings — farmers rate you back after completion"
              icon={Star}
              colorScheme="purple"
            />
          </div>

          {slaBreached && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Your KYC review crossed the {slaHours}-hour SLA and was auto-escalated. Support has been notified.
            </div>
          )}

          {/* tier progress */}
          <div className={`${cardCls} p-5 space-y-3`}>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Proven Broker Progress
            </h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>Completed deals: {completedDeals}{requiredVolume > 0 ? ` / ${requiredVolume}` : ''}</span>
                <span>{volumeProgress}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${proven ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${volumeProgress}%` }} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              The Proven tier flips on a combination of completed deal volume and your two-sided rating average
              (spec B1/B3). Rating both parties after every completed deal counts toward your standing.
            </p>
            {arr(trust.requirements).length > 0 && (
              <ul className="space-y-1">
                {arr(trust.requirements).map((r, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-slate-400" /> {str(r)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* money track record */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Commission Earned"
              value={earned > 0 ? formatCurrency(paisaToRupees(earned)) : formatCurrency(num(trust.totalEarnedRupees))}
              subtitle="Across completed deals"
              icon={Landmark}
              colorScheme="green"
            />
            <StatCard
              title="Pending Payout"
              value={pending > 0 ? formatCurrency(paisaToRupees(pending)) : '—'}
              subtitle="Live deals not yet settled"
              icon={Clock}
              colorScheme="amber"
            />
            <StatCard
              title="Paid Out"
              value={paid > 0 ? formatCurrency(paisaToRupees(paid)) : '—'}
              subtitle="Settled to your verified bank account"
              icon={Scale}
              colorScheme="blue"
            />
          </div>

          {/* settlements */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Weekly Settlements ({settlements.length})</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sunday cron aggregates completed deals — RazorpayX payout to your penny-drop-verified account
              </p>
            </div>
            {settlements.length === 0 ? (
              <EmptyState label="No settlements yet — they appear every Sunday after your first completed deal" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-3 px-5">Period</th>
                      <th className="py-3 px-3">Gross</th>
                      <th className="py-3 px-3">Commission</th>
                      <th className="py-3 px-3">Net</th>
                      <th className="py-3 px-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {settlements.map((s) => (
                      <tr key={str(s.id ?? `${s.periodStart}-${s.periodEnd}`)} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5 font-bold text-slate-900">
                          {str(s.periodStart) ? formatDate(str(s.periodStart)) : '—'}
                          <span className="text-[10px] text-slate-400 block font-normal">
                            to {str(s.periodEnd) ? formatDate(str(s.periodEnd)) : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{formatCurrency(num(s.grossRupees))}</td>
                        <td className="py-3 px-3 font-bold text-emerald-700">+{formatCurrency(num(s.commissionRupees))}</td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{formatCurrency(num(s.netRupees))}</td>
                        <td className="py-3 px-5 text-right">
                          <StatusBadge status={str(s.status, 'pending')} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
