import React, { useEffect, useState } from 'react';
import {
  Milk,
  Receipt,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { dairy, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency, formatDate } from '../../lib/utils';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

type Tab = 'slips' | 'payments' | 'analytics';

const STATUS_STYLES: Record<string, string> = {
  recorded: 'bg-sky-50 text-sky-700 border-sky-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const statusBadge = (status: string) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
      STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
    }`}
  >
    {status || 'recorded'}
  </span>
);

export const FarmerDairyView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('slips');
  const [slips, setSlips] = useState<unknown[]>([]);
  const [payments, setPayments] = useState<unknown[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [memberCode, setMemberCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, a] = await Promise.all([
        dairy.farmerSlips().catch(() => []),
        dairy.farmerPayments().catch(() => []),
        dairy.farmerAnalytics().catch(() => null),
      ]);
      setSlips(s);
      setPayments(p);
      if (a) {
        const rec = asRecord(a);
        setAnalytics(rec);
        setMemberCode(asStr(asRecord(rec.member).memberCode));
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = asRecord(analytics?.totals);
  const monthly = asArray(analytics?.monthly).map((m) => asRecord(m));
  const analyticsMember = asRecord(analytics?.member);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'slips', label: `Milk Slips (${slips.length})`, icon: Receipt },
    { key: 'payments', label: `Payments (${payments.length})`, icon: Milk },
    { key: 'analytics', label: '6-Month Analytics', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Milk className="w-7 h-7 text-emerald-600" />
            My Milk & Payments <span className="text-sm font-bold text-slate-500">/ माझे दूध व पैसे</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Milk collection slips, payment status and supply analytics from your dairy collection centre
            {memberCode ? ` • Member ${memberCode}` : ''}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Milk Supplied"
          value={`${asNum(totals.liters).toLocaleString('en-IN')} L`}
          subtitle={analyticsMember.name ? `Member: ${asStr(analyticsMember.name)}` : 'All recorded collections'}
          icon={Milk}
          colorScheme="green"
        />
        <StatCard
          title="Milk Value"
          value={formatCurrency(asNum(totals.amount))}
          subtitle="Gross amount at collection centre rates"
          icon={Receipt}
          colorScheme="blue"
        />
        <StatCard
          title="Paid to Bank"
          value={formatCurrency(asNum(totals.paid))}
          subtitle="Credited via DBT / batch payout"
          icon={CheckCircle2}
          colorScheme="amber"
        />
        <StatCard
          title="Pending Dues"
          value={formatCurrency(asNum(totals.pending))}
          subtitle={asNum(totals.pending) > 0 ? 'Follow up with the collection centre' : 'Nothing pending'}
          icon={Clock}
          colorScheme="amber"
        />
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl self-start w-fit max-w-full overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize flex items-center gap-1.5 whitespace-nowrap ${
              tab === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading your dairy ledger…
        </div>
      ) : tab === 'slips' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 sm:px-6">Date / Shift</th>
                  <th className="py-3 px-4">Slip No.</th>
                  <th className="py-3 px-4">Milk Type</th>
                  <th className="py-3 px-4 text-right">Liters</th>
                  <th className="py-3 px-4 text-right">FAT / SNF</th>
                  <th className="py-3 px-4 text-right">Rate</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs font-semibold text-slate-400">
                      No milk slips yet — they appear once your collection centre records a collection.
                    </td>
                  </tr>
                ) : (
                  slips.map((raw, i) => {
                    const s = asRecord(raw);
                    const adulteration = asRecord(s.adulteration);
                    const flagged = adulteration.anomaly === true;
                    return (
                      <tr key={asStr(s.id, String(i))} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 sm:px-6">
                          <span className="font-bold text-slate-900 block">{formatDate(asStr(s.date))}</span>
                          <span className="text-[10px] text-slate-400 capitalize">{asStr(s.shift, 'morning')} shift</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{asStr(s.slipNumber, '—')}</td>
                        <td className="py-3 px-4 capitalize">{asStr(s.milkType, 'cow')}</td>
                        <td className="py-3 px-4 text-right font-bold">{asNum(s.liters).toFixed(1)} L</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {asNum(s.fatPercent).toFixed(1)}% / {asNum(s.snfPercent).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right">₹{asNum(s.ratePerLiter).toFixed(2)}/L</td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                          {formatCurrency(asNum(s.totalAmount))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {flagged ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" /> Verify FAT/SNF
                            </span>
                          ) : (
                            statusBadge(asStr(s.status, 'recorded'))
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'payments' ? (
        <div className="space-y-3">
          {payments.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              No payment entries yet — payments appear after the centre generates a batch.
            </div>
          ) : (
            payments.map((raw, i) => {
              const p = asRecord(raw);
              const status = asStr(p.status, 'pending');
              return (
                <div
                  key={asStr(p.id, String(i))}
                  className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">
                        {formatCurrency(asNum(p.netAmount))}
                        <span className="text-[10px] font-semibold text-slate-400 ml-1.5">net payout</span>
                      </h4>
                      {statusBadge(status)}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {asNum(p.liters).toFixed(1)} L • gross {formatCurrency(asNum(p.amount))}
                      {asNum(p.deduction) > 0 ? ` • deduction ${formatCurrency(asNum(p.deduction))}` : ''}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {asStr(p.payoutRef) ? `Ref ${asStr(p.payoutRef)} • ` : ''}
                      {formatDate(asStr(p.paidAt ?? p.createdAt))}
                    </p>
                  </div>
                  {status === 'paid' ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" /> Credited to bank
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
                      <Clock className="w-4 h-4" /> Awaiting centre payout
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Month-wise Supply</h3>
              <span className="text-[10px] text-slate-400 font-semibold">Liters • Amount • Paid</span>
            </div>
            {monthly.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">No collections recorded in the last 6 months.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {monthly.map((m, i) => {
                  const liters = asNum(m.liters);
                  const maxLiters = Math.max(...monthly.map((mm) => asNum(mm.liters)), 1);
                  return (
                    <div key={asStr(m.month, String(i))} className="px-5 py-3 flex items-center gap-4">
                      <span className="text-[11px] font-bold text-slate-500 w-16 flex-shrink-0">{asStr(m.month)}</span>
                      <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.max((liters / maxLiters) * 100, liters > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 w-20 text-right flex-shrink-0">
                        {liters.toFixed(1)} L
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 w-24 text-right hidden sm:block">
                        {formatCurrency(asNum(m.amount))}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-700 w-24 text-right hidden md:block">
                        {formatCurrency(asNum(m.paid))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {asNum(totals.pending) > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p>
                <strong>{formatCurrency(asNum(totals.pending))}</strong> is pending with the collection centre. If a
                payment batch is marked paid but your bank account is not credited within 2 working days, raise it with
                the centre manager.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
