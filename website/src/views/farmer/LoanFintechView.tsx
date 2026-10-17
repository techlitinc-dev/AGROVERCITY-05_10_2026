import React, { useState } from 'react';
import { Landmark, ShieldCheck, Check, Clock, AlertCircle, Plus, FileSpreadsheet } from 'lucide-react';
import { MOCK_LOANS } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { LoanApplication } from '../../types';

export const LoanFintechView: React.FC = () => {
  const [loans, setLoans] = useState<LoanApplication[]>(MOCK_LOANS);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [amount, setAmount] = useState(40000);
  const [tenure, setTenure] = useState(12);
  const [loanType, setLoanType] = useState<LoanApplication['loanType']>('Kisan Credit Card (KCC)');

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const newLoan: LoanApplication = {
      id: 'ln_' + Date.now().toString().slice(-4),
      farmerId: 'usr_farmer_ramesh',
      farmerName: 'Ramesh Patil',
      loanType,
      amountRequested: amount,
      tenureMonths: tenure,
      landRecordId: '712_MH_NSK_312',
      creditScore: 745,
      status: 'under_review',
      appliedDate: new Date().toISOString().split('T')[0],
    };
    setLoans([newLoan, ...loans]);
    setApplyModalOpen(false);
  };

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

      {/* Credit Appraisal Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xl border border-emerald-200">
            745
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Agri Credit Score: Excellent</h3>
            <p className="text-xs text-slate-500">
              Pre-approved credit limit up to <strong>₹1,80,000</strong> @ 4% p.a. subvention rate
            </p>
          </div>
        </div>
        <div className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto">
          Linked to Gat No. 312 (1.82 Ha)
        </div>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {loans.map((loan) => (
          <div
            key={loan.id}
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-base text-slate-900">{loan.loanType}</h4>
                <p className="text-xs text-slate-400">Application #{loan.id} • Applied on {loan.appliedDate}</p>
              </div>
              <StatusBadge status={loan.status} />
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
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Interest Rate</span>
                <span className="text-sm font-bold text-slate-800">4.0% p.a. (Govt DBT Subvention)</span>
              </div>
            </div>
          </div>
        ))}
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
              onChange={(e) => setLoanType(e.target.value as any)}
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

          <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-900 border border-emerald-200">
            <span className="font-bold block">Auto-Attached Collateral:</span>
            <span>7/12 Record Gat 312 (1.82 Ha), Pimpalgaon Baswant</span>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
          >
            Submit Loan Application
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
