import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, ShieldCheck, Check, Plus, ArrowRight, Calculator, Wallet } from 'lucide-react';
import { finance, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { LoanApplication } from '../../types';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export const LoanFintechView: React.FC = () => {
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [creditScore, setCreditScore] = useState<Record<string, unknown> | null>(null);
  const [kcc, setKcc] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [amount, setAmount] = useState(40000);
  const [tenure, setTenure] = useState(12);
  const [loanType, setLoanType] = useState<LoanApplication['loanType']>('Kisan Credit Card (KCC)');
  const [landRecordId, setLandRecordId] = useState('712_MH_NSK_312');

  // EMI calculator
  const [calcAmount, setCalcAmount] = useState(100000);
  const [calcTenure, setCalcTenure] = useState(12);
  const [calcRate, setCalcRate] = useState(4);
  const [calcResult, setCalcResult] = useState<Record<string, unknown> | null>(null);
  const [calcBusy, setCalcBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      finance.loans(),
      finance.creditScore().catch(() => null),
      finance.kcc().catch(() => null),
    ])
      .then(([l, cs, k]) => {
        if (!active) return;
        setLoans(l);
        if (cs) setCreditScore(asRecord(cs));
        if (k) setKcc(asRecord(k));
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const scoreValue = asNum(creditScore?.score ?? creditScore?.creditScore, 0);
  const preApprovedLimit = asNum(creditScore?.preApprovedLimit ?? creditScore?.limit, 0);
  const scoreLabel = asStr(creditScore?.label ?? creditScore?.rating, scoreValue >= 700 ? 'Excellent' : 'Building');

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplying(true);
    setError(null);
    try {
      const created = await finance.applyLoan({
        loanType,
        amountRequested: amount,
        tenureMonths: tenure,
        landRecordId,
      });
      setLoans((prev) => [created, ...prev]);
      setApplyModalOpen(false);
      setNotice(`Loan application #${created.id} submitted for digital underwriting.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setApplying(false);
    }
  };

  const runCalculator = async () => {
    setCalcBusy(true);
    setError(null);
    try {
      const res = await finance.loanCalculator({
        principal: calcAmount,
        amount: calcAmount,
        tenureMonths: calcTenure,
        interestRate: calcRate,
      });
      setCalcResult(asRecord(res));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setCalcBusy(false);
    }
  };

  const emi =
    calcResult !== null
      ? asNum(
          calcResult.emi ?? calcResult.emiRupees ?? calcResult.monthlyEmi ?? calcResult.monthlyPayment,
          0
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Landmark className="w-7 h-7 text-emerald-600" />
            KCC & Agri Loans (Fintech Desk)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Apply for concessional KCC crop loans and equipment credit linked to your verified 7/12 land records
          </p>
        </div>

        <button
          onClick={() => setApplyModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Loan</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Credit Appraisal Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xl border border-emerald-200">
            {scoreValue > 0 ? scoreValue : '—'}
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Agri Credit Score: {scoreValue > 0 ? scoreLabel : 'Pending first assessment'}
            </h3>
            <p className="text-xs text-slate-500">
              {preApprovedLimit > 0 ? (
                <>
                  Pre-approved credit limit up to <strong>{formatCurrency(preApprovedLimit)}</strong> @ 4% p.a. subvention rate
                </>
              ) : (
                'Complete your KYC and link a 7/12 record to unlock a pre-approved limit.'
              )}
            </p>
          </div>
        </div>
        {kcc && (
          <div className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span>
              KCC: {asStr(kcc.status, 'Active')} • Limit {formatCurrency(asNum(kcc.limit ?? kcc.sanctionedLimit, 0))}
            </span>
          </div>
        )}
      </div>

      {/* Loan EMI Calculator */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-sm text-slate-900">Loan EMI Calculator</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-600 mb-1">Amount (₹)</label>
            <input
              type="number"
              value={calcAmount}
              onChange={(e) => setCalcAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-600 mb-1">Tenure (months)</label>
            <input
              type="number"
              value={calcTenure}
              onChange={(e) => setCalcTenure(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-600 mb-1">Interest (% p.a.)</label>
            <input
              type="number"
              step="0.1"
              value={calcRate}
              onChange={(e) => setCalcRate(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runCalculator}
              disabled={calcBusy}
              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs disabled:opacity-60"
            >
              {calcBusy ? 'Calculating…' : 'Calculate'}
            </button>
          </div>
        </div>
        {calcResult && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Monthly EMI</span>
              <span className="font-black text-sm">{emi > 0 ? formatCurrency(emi) : '—'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Interest</span>
              <span className="font-black text-sm">
                {formatCurrency(asNum(calcResult.totalInterest ?? calcResult.interest, 0))}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Payable</span>
              <span className="font-black text-sm">
                {formatCurrency(asNum(calcResult.totalPayable ?? calcResult.totalAmount, 0))}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Rate</span>
              <span className="font-black text-sm">{asNum(calcResult.interestRate, calcRate)}% p.a.</span>
            </div>
          </div>
        )}
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900">My Loan Applications ({loans.length})</h3>
        {loading ? (
          <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading loan applications…
          </div>
        ) : loans.length === 0 ? (
          <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No loan applications yet. Apply for a KCC or crop loan to get started.
          </div>
        ) : (
          loans.map((loan) => (
            <div
              key={loan.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-base text-slate-900">{loan.loanType}</h4>
                  <p className="text-xs text-slate-400">Application #{loan.id} • Applied on {loan.appliedDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={loan.status} />
                  <Link
                    to={`/farmer/loans/${loan.id}`}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] flex items-center gap-1"
                  >
                    Details <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Amount</span>
                  <span className="text-lg font-black text-emerald-800">{formatCurrency(loan.amountRequested)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Tenure</span>
                  <span className="text-sm font-bold text-slate-800">{loan.tenureMonths} Months</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Credit Score</span>
                  <span className="text-sm font-bold text-slate-800">{loan.creditScore || scoreValue || '—'}</span>
                </div>
              </div>

              {loan.rejectionReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
                  Reason: {loan.rejectionReason}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Apply Loan Modal */}
      <ModalSheet
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        title="Apply for Concessional Agri Loan"
        description="Fast digital underwriting with zero physical paperwork"
        maxWidth="md"
      >
        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Loan Scheme</label>
            <select
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as LoanApplication['loanType'])}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="Kisan Credit Card (KCC)">Kisan Credit Card (KCC) @ 4%</option>
              <option value="Crop Loan">Short-Term Crop Production Loan</option>
              <option value="Farm Mechanization">Farm Mechanization & Drone Sprayer</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Required Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tenure (Months)</label>
              <select
                value={tenure}
                onChange={(e) => setTenure(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
                <option value={24}>24 Months</option>
                <option value={36}>36 Months</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Linked 7/12 Land Record ID</label>
            <input
              type="text"
              value={landRecordId}
              onChange={(e) => setLandRecordId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
              required
            />
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-900 border border-emerald-200 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            <span>Your 7/12 record and credit score are attached automatically for instant appraisal.</span>
          </div>

          <button
            type="submit"
            disabled={applying}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {applying ? 'Submitting…' : (
              <>
                <Check className="w-4 h-4" /> Submit Loan Application
              </>
            )}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
