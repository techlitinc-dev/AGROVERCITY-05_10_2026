import React, { useState } from 'react';
import { Landmark, ShieldCheck, Check, X, FileSpreadsheet, Users, DollarSign, Clock } from 'lucide-react';
import { MOCK_LOANS } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { LoanApplication } from '../../types';

export const BankManagerDeskView: React.FC = () => {
  const [loans, setLoans] = useState<LoanApplication[]>(MOCK_LOANS);

  const handleApprove = (id: string) => {
    setLoans((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'approved' } : l))
    );
  };

  const handleDisburse = (id: string) => {
    setLoans((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'disbursed' } : l))
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Landmark className="w-7 h-7 text-emerald-600" />
          Bank Manager & Credit Underwriting Console
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Kisan Credit Card (KCC) appraisal, 7/12 land revenue cross-checks, credit scoring, and direct DBT account disbursals
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Underwriting Queue"
          value={`${loans.length} Applications`}
          subtitle="KCC and Farm Drone loans"
          icon={Clock}
          colorScheme="blue"
        />
        <StatCard
          title="Total Sanctioned"
          value={formatCurrency(40000)}
          subtitle="4.0% p.a. interest subvention"
          icon={DollarSign}
          colorScheme="green"
        />
        <StatCard
          title="Avg Applicant CIBIL"
          value="745"
          subtitle="Low default risk profile"
          icon={ShieldCheck}
          colorScheme="amber"
        />
      </div>

      {/* Loan Queue Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Farmer Loan Underwriting Applications</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Farmer & Loan Type</th>
                <th className="py-3 px-4">Amount Requested</th>
                <th className="py-3 px-4">7/12 Collateral</th>
                <th className="py-3 px-4">Credit Score</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-6 font-bold text-slate-900">
                    {loan.farmerName}
                    <span className="text-[11px] text-slate-400 block font-normal">{loan.loanType}</span>
                  </td>
                  <td className="py-3.5 px-4 font-black text-slate-900">{formatCurrency(loan.amountRequested)}</td>
                  <td className="py-3.5 px-4 font-mono text-emerald-800 font-bold">{loan.landRecordId}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {loan.creditScore} (Good)
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={loan.status} />
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    {loan.status === 'under_review' && (
                      <button
                        onClick={() => handleApprove(loan.id)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        Approve
                      </button>
                    )}
                    {loan.status === 'approved' && (
                      <button
                        onClick={() => handleDisburse(loan.id)}
                        className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        Disburse DBT
                      </button>
                    )}
                    {loan.status === 'disbursed' && (
                      <span className="text-xs font-bold text-emerald-700">✓ Funds Disbursed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
