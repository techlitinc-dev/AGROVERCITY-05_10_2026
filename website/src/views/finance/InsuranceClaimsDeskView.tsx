import React, { useState } from 'react';
import { ShieldAlert, Users, Check, X, Camera, DollarSign, Clock } from 'lucide-react';
import { MOCK_INSURANCE_CLAIMS } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { CropInsuranceClaim } from '../../types';

export const InsuranceClaimsDeskView: React.FC = () => {
  const [claims, setClaims] = useState<CropInsuranceClaim[]>(MOCK_INSURANCE_CLAIMS);

  const handleAssignSurveyor = (id: string) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'surveyor_assigned' } : c))
    );
  };

  const handleApproveDbt = (id: string) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'settled' } : c))
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-emerald-600" />
          PMFBY Crop Insurance & Claims Settlement Desk
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review 72-hour crop damage intimations, assign village loss surveyors, and trigger Direct Benefit Transfer (DBT)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Intimated Claims"
          value={`${claims.length} Claims`}
          subtitle="Excess rainfall & hail damage"
          icon={Clock}
          colorScheme="blue"
        />
        <StatCard
          title="Total Approved DBT"
          value={formatCurrency(32000)}
          subtitle="Direct compensation sanctioned"
          icon={DollarSign}
          colorScheme="green"
        />
        <StatCard
          title="Field Surveyors"
          value="14 Active"
          subtitle="GPS camera verification"
          icon={Users}
          colorScheme="amber"
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">PMFBY Claim Verification Queue</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Claim ID & Farmer</th>
                <th className="py-3 px-4">Crop & Calamity</th>
                <th className="py-3 px-4">Incident Date</th>
                <th className="py-3 px-4">Damage % & Loss</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-6 font-bold text-slate-900">
                    {claim.farmerName}
                    <span className="text-[10px] text-slate-400 block font-mono">#{claim.id}</span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-700">
                    {claim.crop}
                    <span className="text-[11px] text-rose-600 block">{claim.calamityType}</span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-600">{formatDate(claim.calamityDate)}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-rose-700">{claim.damagePercentage}%</span>
                    <span className="text-[11px] text-emerald-800 font-black block">
                      {formatCurrency(claim.estimatedLossAmount)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={claim.status} />
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    {claim.status === 'intimated' && (
                      <button
                        onClick={() => handleAssignSurveyor(claim.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        Assign Surveyor
                      </button>
                    )}
                    {claim.status === 'dbt_approved' && (
                      <button
                        onClick={() => handleApproveDbt(claim.id)}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        Release DBT Funds
                      </button>
                    )}
                    {claim.status === 'settled' && (
                      <span className="text-xs font-bold text-emerald-700">✓ Settled to Bank</span>
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
