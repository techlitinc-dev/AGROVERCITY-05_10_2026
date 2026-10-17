import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet, RefreshCw } from 'lucide-react';
import { loans, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  str,
  num,
  arr,
  toPaisa,
  fromPaisa,
  loanId,
  type LoanRow,
  type RepaymentRow,
  type Row,
} from './loanTypes';

const MODES = ['upi', 'nach', 'cash', 'other'];

/** Repayment collection desk — per-loan EMI/principal entry + running ledger. */
export const RepaymentLedgerView: React.FC = () => {
  const [candidates, setCandidates] = useState<LoanRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loan, setLoan] = useState<LoanRow | null>(null);
  const [rows, setRows] = useState<RepaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('upi');
  const [emiIndex, setEmiIndex] = useState('');
  const [note, setNote] = useState('');

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await loans.queue({ status: 'disbursed', pageSize: 100 })) as unknown as Row;
      const data = arr(res?.data ?? res) as LoanRow[];
      setCandidates(data);
      if (data.length > 0 && !selectedId) setSelectedId(loanId(data[0]));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLedger = useCallback(async (id: string) => {
    if (!id) return;
    setError(null);
    try {
      const [l, r] = await Promise.all([
        loans.get(id) as Promise<unknown>,
        loans.repayments(id) as Promise<unknown>,
      ]);
      setLoan(l as LoanRow);
      setRows(arr(r) as RepaymentRow[]);
    } catch (e) {
      setError(apiErrorMessage(e));
      setLoan(null);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadLedger(selectedId);
  }, [selectedId, loadLedger]);

  const summary = useMemo(() => {
    const paidPaisa = rows.reduce((sum, r) => sum + num(r.amountPaise), 0);
    const principalPaisa = toPaisa(num(loan?.sanctionedAmount ?? loan?.amount));
    const outstanding = Math.max(0, principalPaisa - paidPaisa);
    return {
      paidPaisa,
      principalPaisa,
      outstanding,
      progress: principalPaisa > 0 ? Math.min(100, Math.round((paidPaisa / principalPaisa) * 100)) : 0,
    };
  }, [rows, loan]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await loans.addRepayment(selectedId, {
        amountPaise: toPaisa(Number(amount)),
        mode,
        emiIndex: emiIndex ? Number(emiIndex) : undefined,
        note: note || undefined,
      });
      setNotice(`Repayment of ${formatCurrency(Number(amount))} recorded via ${mode.toUpperCase()}.`);
      setAmount('');
      setEmiIndex('');
      setNote('');
      await loadLedger(selectedId);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <Link to="/bank" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to desk
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Wallet className="w-7 h-7 text-emerald-600" />
          Repayment Collection Ledger
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Record EMI / principal collections against disbursed loans and track the running paid balance
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Disbursed Loan</label>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 min-w-72 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            {candidates.length === 0 && <option value="">{loading ? 'Loading…' : 'No disbursed loans'}</option>}
            {candidates.map((c) => (
              <option key={loanId(c)} value={loanId(c)}>
                {str(c.applicationNumber, loanId(c))} — {str(c.farmerName, 'Farmer')} · {formatCurrency(num(c.sanctionedAmount ?? c.amount))}
              </option>
            ))}
          </select>
          <button onClick={loadCandidates} className="p-2 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100" title="Refresh loans">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {loan && (
            <Link to={`/bank/applications/${selectedId}`} className="text-xs font-bold text-emerald-700 hover:underline">
              Open underwriting file →
            </Link>
          )}
        </div>
      </div>

      {loan && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Principal</span>
              <div className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(fromPaisa(summary.principalPaisa))}</div>
              <p className="mt-1 text-xs text-slate-500">
                {str(loan.applicationNumber, selectedId)} · {num(loan.tenureMonths)}m @ {num(loan.interestRate, 7)}%
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Collected</span>
              <div className="text-2xl font-bold text-emerald-700 mt-2">{formatCurrency(fromPaisa(summary.paidPaisa))}</div>
              <p className="mt-1 text-xs text-slate-500">{rows.length} entries · {num(loan.emisPaid)} EMIs marked</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding</span>
              <div className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(fromPaisa(summary.outstanding))}</div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${summary.progress}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 h-fit">
              <h3 className="font-bold text-sm text-slate-900">Record Collection</h3>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Amount ₹
                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" required
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Mode
                <select value={mode} onChange={(e) => setMode(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
                  {MODES.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                EMI Installment # (optional)
                <input value={emiIndex} onChange={(e) => setEmiIndex(e.target.value)} type="number" min="1"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Note
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <button type="submit" disabled={busy}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
                {busy ? 'Recording…' : 'Record Repayment'}
              </button>
              <p className="text-[10px] text-slate-400">
                Duplicate EMI numbers are rejected by the server (409) to keep the ledger idempotent.
              </p>
            </form>

            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900">Ledger — {str(loan.farmerName)}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-3 px-4">Paid At</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Mode</th>
                      <th className="py-3 px-4">EMI #</th>
                      <th className="py-3 px-4">Cumulative</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={str(r.repaymentId)} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-semibold text-slate-800">{formatDate(str(r.paidAt ?? r.recordedAt))}</td>
                        <td className="py-3 px-4 font-black text-slate-900">{formatCurrency(fromPaisa(num(r.amountPaise)))}</td>
                        <td className="py-3 px-4 uppercase font-bold text-slate-500">{str(r.mode, '—')}</td>
                        <td className="py-3 px-4">{r.emiIndex ? num(r.emiIndex) : '—'}</td>
                        <td className="py-3 px-4 font-semibold text-emerald-700">{formatCurrency(fromPaisa(num(r.runningPaidPaisa)))}</td>
                        <td className="py-3 px-4">
                          {r.defaultRisk ? <StatusBadge status={str(r.defaultRisk)} /> : <StatusBadge status="recorded" />}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                          No repayments recorded for this loan yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
