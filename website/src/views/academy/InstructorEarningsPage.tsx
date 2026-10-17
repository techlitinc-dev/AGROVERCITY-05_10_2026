import React, { useEffect, useState } from 'react';
import { IndianRupee, Percent, Landmark, AlertCircle, CheckCircle2, RefreshCw, Clock } from 'lucide-react';
import { teachers, apiClient, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

const rupees = (paisa: unknown): number => numOf(paisa) / 100;

/**
 * Instructor earnings — gross − commission = net (integer paisa from
 * teachers.earnings), per-booking payment history with payout status, the
 * config-driven commission structure, and settlement rows.
 */
export const InstructorEarningsPage: React.FC = () => {
  const [earnings, setEarnings] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [historyTotals, setHistoryTotals] = useState<Record<string, unknown>>({});
  const [commission, setCommission] = useState<Record<string, unknown> | null>(null);
  const [settlements, setSettlements] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, h, c, s] = await Promise.all([
        teachers.earnings(),
        // readList unwraps {data} and drops the totals fields — read the raw envelope instead
        apiClient.get('/teachers/payments/history').then((res) => res.data as Record<string, unknown>),
        teachers.commissionStructure().catch(() => null),
        teachers.settlements().catch(() => [] as unknown[]),
      ]);
      setEarnings(asRec(e));
      setHistory(recArr(h?.data));
      setHistoryTotals({
        feesCollectedRupees: h?.feesCollectedRupees,
        adminCommissionRupees: h?.adminCommissionRupees,
        netEarningsRupees: h?.netEarningsRupees,
        nextPayoutDate: h?.nextPayoutDate,
        onHold: h?.onHold,
      });
      setCommission(c ? asRec(c) : null);
      setSettlements(recArr(s));
    } catch (e2) {
      setError(apiErrorMessage(e2));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const onHold = Boolean(earnings?.onHold ?? historyTotals.onHold);
  const byCourse = recArr(earnings?.byCourse);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <IndianRupee className="w-7 h-7 text-emerald-600" />
            Earnings & Commission
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gross fees minus platform commission — paid out every Monday once your bank is verified
          </p>
        </div>
        <button
          onClick={reload}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading earnings…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              title="Gross Fees"
              value={formatCurrency(rupees(earnings?.grossPaisa))}
              subtitle="All paid enrollments"
              icon={IndianRupee}
              colorScheme="blue"
            />
            <StatCard
              title="Platform Commission"
              value={`− ${formatCurrency(rupees(earnings?.commissionPaisa))}`}
              subtitle={`${numOf(earnings?.commissionPct)}% from instructor side`}
              icon={Percent}
              colorScheme="amber"
            />
            <StatCard
              title="Net Earnings"
              value={formatCurrency(rupees(earnings?.netPaisa))}
              subtitle={onHold ? 'On hold — verify bank account' : 'Scheduled for payout'}
              icon={Landmark}
              colorScheme="green"
            />
            <StatCard
              title="Next Payout"
              value={earnings?.nextPayoutDate ? formatDate(strOf(earnings.nextPayoutDate)) : '—'}
              subtitle="Monday settlement run"
              icon={Clock}
              colorScheme="purple"
            />
          </div>

          {onHold && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Payouts are on hold until a bank account passes the ₹1 penny-drop verification (Bank Accounts page).
            </div>
          )}

          {commission && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
              <h3 className="font-bold text-sm text-slate-900 mb-3">Commission Structure</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Course GMV %', value: `${numOf(commission.commissionPercent)}%` },
                  { label: 'Band', value: `${numOf(recArr(commission.bandPercent)[0], 15)}–${numOf(recArr(commission.bandPercent)[1], 20)}%` },
                  { label: 'Charged From', value: strOf(commission.chargedFrom, 'instructor') || 'instructor' },
                  { label: 'Config Source', value: strOf(commission.configSource, 'platform_config') },
                ].map((f) => (
                  <div key={f.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">{f.label}</p>
                    <p className="text-sm font-black text-slate-900 capitalize">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {byCourse.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900">Per-Course Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-3 px-5">Course</th>
                      <th className="py-3 px-3">Gross</th>
                      <th className="py-3 px-3">Commission</th>
                      <th className="py-3 px-3 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {byCourse.map((c) => (
                      <tr key={strOf(c.courseId) || strOf(c.courseTitle)} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5 font-bold text-slate-900">{strOf(c.courseTitle) || 'Course'}</td>
                        <td className="py-3 px-3 text-slate-700">{formatCurrency(rupees(c.grossPaisa))}</td>
                        <td className="py-3 px-3 text-amber-700 font-bold">{formatCurrency(rupees(c.commissionPaisa))}</td>
                        <td className="py-3 px-3 text-right font-black text-emerald-800">{formatCurrency(rupees(c.netPaisa))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment history */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Payment History ({history.length})</h3>
              {historyTotals.feesCollectedRupees !== undefined && (
                <span className="text-[11px] font-bold text-slate-500">
                  Collected {formatCurrency(numOf(historyTotals.feesCollectedRupees))} • Net{' '}
                  {formatCurrency(numOf(historyTotals.netEarningsRupees))}
                </span>
              )}
            </div>
            {history.length === 0 ? (
              <p className="p-6 text-xs text-slate-400">No paid bookings yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-3 px-5">Student</th>
                      <th className="py-3 px-3">Course</th>
                      <th className="py-3 px-3">Paid At</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Commission</th>
                      <th className="py-3 px-3">Net</th>
                      <th className="py-3 px-3">Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.slice(0, 30).map((p) => (
                      <tr key={strOf(p.purchaseId)} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5 font-bold text-slate-900">{nameOf(p, strOf(p.studentName, 'Student'))}</td>
                        <td className="py-3 px-3 text-slate-600 max-w-40 truncate">{strOf(p.courseTitle)}</td>
                        <td className="py-3 px-3 text-slate-600">{formatDateTime(strOf(p.paidAt))}</td>
                        <td className="py-3 px-3 font-bold text-slate-800">{formatCurrency(numOf(p.amountRupees))}</td>
                        <td className="py-3 px-3 text-amber-700">
                          {numOf(p.commissionPercent)}% ({formatCurrency(numOf(p.commissionRupees))})
                        </td>
                        <td className="py-3 px-3 font-black text-emerald-800">{formatCurrency(numOf(p.netRupees))}</td>
                        <td className="py-3 px-3">
                          <StatusBadge status={strOf(p.payoutStatus, 'scheduled')} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Settlements */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Settlements ({settlements.length})</h3>
            </div>
            {settlements.length === 0 ? (
              <p className="p-6 text-xs text-slate-400">
                No settlement rows yet — the Monday cron (jobs/settlements/run → payouts) accrues and releases them.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-3 px-5">Settlement</th>
                      <th className="py-3 px-3">Period</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {settlements.map((s) => (
                      <tr key={strOf(s.id)} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5 font-mono font-bold text-slate-800">{strOf(s.id)}</td>
                        <td className="py-3 px-3 text-slate-600">
                          {formatDate(strOf(s.periodFrom ?? s.fromDate))} → {formatDate(strOf(s.periodTo ?? s.toDate))}
                        </td>
                        <td className="py-3 px-3 font-black text-emerald-800">
                          {formatCurrency(numOf(s.amountRupees ?? s.netRupees))}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={strOf(s.status, 'scheduled')} />
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

export default InstructorEarningsPage;
