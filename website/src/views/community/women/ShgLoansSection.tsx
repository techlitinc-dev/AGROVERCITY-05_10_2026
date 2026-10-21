import React, { useEffect, useState } from 'react';
import {
  HandCoins,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Landmark,
} from 'lucide-react';
import { apiErrorMessage, women } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { cn, formatDate, formatDateTime, formatPaisa } from '../../../lib/utils';
import { asRecords, bool, num, pick, pickNum, pickStr } from '../../shared/records';

const MONTH_OPTIONS = Array.from({ length: 24 }, (_, i) => i + 1);

/**
 * SHG loan fund — members request micro-loans from the pooled corpus; the group
 * admin approves; borrowers repay against a fixed monthly schedule.
 */
export const ShgLoansSection: React.FC<{ group: Record<string, unknown> }> = ({ group }) => {
  const uid = useAuthStore((s) => s.user?.id);
  const isAdmin = bool(pick(group, 'isAdmin'));
  const loanFundPaisa = pickNum(group, 'loanFundPaisa', 'loanFund');
  const monthlyDepositPaisa = pickNum(group, 'monthlyDepositPaisa');

  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [months, setMonths] = useState('6');
  const [repayFor, setRepayFor] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = async () => {
    try {
      const rows = await women.loans();
      setItems(asRecords(rows));
    } catch (err) {
      setItems([]);
      setNotice({ kind: 'err', text: apiErrorMessage(err) });
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (kind: 'ok' | 'err', text: string) => setNotice({ kind, text });

  const requestLoan = async () => {
    const rupees = Number(amount);
    const monthCount = Number(months);
    if (!rupees || rupees <= 0 || busy) return;
    if (monthCount < 1 || monthCount > 24) {
      flash('err', 'Tenure must be between 1 and 24 months.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await women.requestLoan({
        amountPaisa: Math.round(rupees * 100),
        purpose: purpose.trim() || undefined,
        months: monthCount,
      });
      flash('ok', 'Loan request sent to the group admin for approval.');
      setShowForm(false);
      setAmount('');
      setPurpose('');
      setMonths('6');
      await load();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const act = async (loanId: string, action: 'approve' | 'cancel') => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      if (action === 'approve') {
        await women.approveLoan(loanId);
        flash('ok', 'Loan approved from the group loan fund.');
      } else {
        await women.cancelLoan(loanId);
        flash('ok', 'Loan request cancelled.');
      }
      await load();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const repay = async (loanId: string, remainingPaisa: number) => {
    const rupees = Number(repayAmount);
    if (!rupees || rupees <= 0 || busy) return;
    const paisa = Math.round(rupees * 100);
    if (paisa > remainingPaisa) {
      flash('err', `Repayment cannot exceed the remaining ${formatPaisa(remainingPaisa)}.`);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await women.repayLoan(loanId, { amountPaisa: paisa });
      flash('ok', `${formatPaisa(paisa)} repaid — thank you!`);
      setRepayFor(null);
      setRepayAmount('');
      await load();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const loans = items ?? [];
  const requested = loans.filter((l) => pickStr(l, 'status') === 'requested');
  const active = loans.filter((l) => pickStr(l, 'status') === 'approved');

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
          <HandCoins className="w-4 h-4 text-amber-600" /> SHG Loans
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500">
            Fund: <span className="text-amber-700">{formatPaisa(loanFundPaisa)}</span>
          </span>
          <button
            onClick={() => setShowForm((s) => !s)}
            className={cn(
              'px-3 py-1.5 text-[11px] font-bold rounded-xl transition-colors',
              showForm ? 'bg-slate-100 text-slate-700' : 'bg-amber-600 hover:bg-amber-700 text-white'
            )}
          >
            {showForm ? 'Close' : 'Request loan'}
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-2.5 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {showForm && (
        <div className="p-3 rounded-2xl border border-amber-100 bg-amber-50/50 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Amount (₹)</label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-amber-600"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Tenure (months)</label>
              <select
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-amber-600 bg-white"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Purpose</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Seeds, school fees, medicine…"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-amber-600"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void requestLoan()}
              disabled={busy || !(Number(amount) > 0)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
            >
              {busy ? 'Sending…' : 'Send request'}
            </button>
            <p className="text-[10px] text-slate-400">
              Monthly deposit is {formatPaisa(monthlyDepositPaisa) || '—'}; fund available:{' '}
              {formatPaisa(loanFundPaisa)}. Admin approves every request.
            </p>
          </div>
        </div>
      )}

      {items === null ? (
        <p className="text-xs text-slate-400">Loading loans…</p>
      ) : loans.length === 0 ? (
        <p className="text-xs text-slate-400">
          No loans yet — the fund grows with every monthly deposit, and members can then borrow
          interest-free for emergencies and small expenses.
        </p>
      ) : (
        <div className="space-y-2">
          {requested.length > 0 && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Awaiting approval ({requested.length})
            </p>
          )}
          {loans.map((l, i) => {
            const id = pickStr(l, 'id') || String(i);
            const status = pickStr(l, 'status') || 'requested';
            const amountPaisa = pickNum(l, 'amountPaisa');
            const repaidPaisa = pickNum(l, 'repaidPaisa');
            const remaining = Math.max(0, amountPaisa - repaidPaisa);
            const mine = !!uid && pickStr(l, 'borrowerUid') === uid;
            const schedule = asRecords(pick(l, 'schedule'));
            const audit = asRecords(pick(l, 'audit'));
            const open = expanded === id;
            return (
              <div key={id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-800">
                      {pickStr(l, 'borrowerName') || 'Member'}
                      {mine && <span className="ml-1 text-[10px] font-bold text-amber-700">(you)</span>}
                      <span className="text-slate-400 font-semibold"> · {formatPaisa(amountPaisa)}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {pickStr(l, 'purpose') || 'General purpose'} · {pickNum(l, 'months')} months · requested{' '}
                      {formatDate(pickStr(l, 'requestedAt')) || '—'}
                      {status === 'approved' && ` · repaid ${formatPaisa(repaidPaisa)}`}
                    </p>
                  </div>
                  <StatusBadge
                    status={status === 'repaid' ? 'paid' : status}
                  />
                </div>

                {status === 'approved' && (
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${amountPaisa > 0 ? Math.min(100, (repaidPaisa / amountPaisa) * 100) : 0}%` }}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {isAdmin && status === 'requested' && (
                    <>
                      <button
                        onClick={() => void act(id, 'approve')}
                        disabled={busy}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                      >
                        Approve from fund
                      </button>
                      <button
                        onClick={() => void act(id, 'cancel')}
                        disabled={busy}
                        className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl disabled:opacity-40"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {mine && status === 'requested' && (
                    <button
                      onClick={() => void act(id, 'cancel')}
                      disabled={busy}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl disabled:opacity-40"
                    >
                      Withdraw request
                    </button>
                  )}
                  {mine && status === 'approved' && remaining > 0 && (
                    <button
                      onClick={() => {
                        setRepayFor((cur) => (cur === id ? null : id));
                        setRepayAmount(String((remaining / 100).toFixed(remaining % 100 === 0 ? 0 : 2)));
                      }}
                      disabled={busy}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                    >
                      Repay
                    </button>
                  )}
                  {(schedule.length > 0 || audit.length > 0) && (
                    <button
                      onClick={() => setExpanded((cur) => (cur === id ? null : id))}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl flex items-center gap-1"
                    >
                      {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Schedule & history
                    </button>
                  )}
                </div>

                {repayFor === id && (
                  <div className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-32">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Repay (₹) — remaining {formatPaisa(remaining)}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={remaining / 100}
                        value={repayAmount}
                        onChange={(e) => setRepayAmount(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <button
                      onClick={() => void repay(id, remaining)}
                      disabled={busy || !(Number(repayAmount) > 0)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                    >
                      {busy ? 'Paying…' : 'Pay'}
                    </button>
                  </div>
                )}

                {open && (
                  <div className="space-y-2 pt-1">
                    {schedule.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-slate-400 uppercase text-[9px] tracking-wider">
                              <th className="py-1 pr-2">#</th>
                              <th className="py-1 pr-2">Due date</th>
                              <th className="py-1 pr-2">Amount</th>
                              <th className="py-1 pr-2">Status</th>
                              <th className="py-1">Paid on</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.map((s, j) => (
                              <tr key={num(pick(s, 'no'), j)} className="border-t border-slate-100">
                                <td className="py-1.5 pr-2 font-bold text-slate-700">{num(pick(s, 'no'), j + 1)}</td>
                                <td className="py-1.5 pr-2 text-slate-600">{formatDate(pickStr(s, 'dueDate')) || '—'}</td>
                                <td className="py-1.5 pr-2 font-semibold text-slate-800">{formatPaisa(pickNum(s, 'amountPaisa'))}</td>
                                <td className="py-1.5 pr-2">
                                  <StatusBadge status={pickStr(s, 'status') || 'pending'} className="text-[9px] px-1.5" />
                                </td>
                                <td className="py-1.5 text-slate-500">{formatDate(pickStr(s, 'paidOn')) || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {audit.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Landmark className="w-3 h-3" /> Audit trail
                        </p>
                        {audit.map((a, j) => (
                          <div key={j} className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
                            <span>
                              <span className="font-bold text-slate-700">{pickStr(a, 'action') || 'action'}</span>
                              {pickStr(a, 'byName') ? ` by ${pickStr(a, 'byName')}` : ''}
                              {pickNum(a, 'amountPaisa') > 0 ? ` · ${formatPaisa(pickNum(a, 'amountPaisa'))}` : ''}
                            </span>
                            <span>{formatDateTime(pickStr(a, 'at')) || '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {active.length > 0 && (
        <p className="text-[10px] text-slate-400">
          {active.length} active loan{active.length > 1 ? 's' : ''} · repay on time keeps the fund healthy for
          every member.
        </p>
      )}
    </div>
  );
};
