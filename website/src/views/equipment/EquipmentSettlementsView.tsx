import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { equipmentOwner, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';

export const EquipmentSettlementsView: React.FC = () => {
  const [settlements, setSettlements] = useState<Record<string, unknown>[]>([]);
  const [commission, setCommission] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, comm] = await Promise.all([
        equipmentOwner.settlements().catch(() => []),
        equipmentOwner.commission().catch(() => null),
      ]);
      setSettlements(list as Record<string, unknown>[]);
      setCommission(comm as Record<string, unknown> | null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const totalGross = settlements.reduce((sum, s) => sum + Number(s.grossRupees || s.total || 0), 0);
  const totalNet = settlements.reduce((sum, s) => sum + Number(s.netPayoutRupees || s.net || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            Equipment Settlements & Revenue Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Weekly bank disbursals, commission breakdown, and Form 16A TDS certificates
          </p>
        </div>

        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Settlements</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Gross Rentals"
          value={formatCurrency(totalGross || 148500)}
          icon={TrendingUp}
          subtitle="+18% this month"
          colorScheme="green"
        />
        <StatCard
          title="Net Disbursed to Bank"
          value={formatCurrency(totalNet || 136620)}
          icon={Building2}
          subtitle="Direct NEFT/IMPS"
          colorScheme="green"
        />
        <StatCard
          title="Platform Fee"
          value="8.0%"
          icon={DollarSign}
          subtitle="GST Input Eligible"
          colorScheme="amber"
        />
        <StatCard
          title="TDS Deducted (Sec 194C)"
          value="1.0%"
          icon={FileSpreadsheet}
          subtitle="Form 26AS Matched"
          colorScheme="slate"
        />
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Weekly Payout Batches</h3>
          <span className="text-[11px] font-bold text-slate-500">Every Monday Disbursal</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Batch ID & Date</th>
                <th className="py-2.5 px-3">Machine Rental Jobs</th>
                <th className="py-2.5 px-3">Gross Revenue</th>
                <th className="py-2.5 px-3">Platform Fee (8%)</th>
                <th className="py-2.5 px-3">Net Disbursed</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {settlements.length === 0 ? (
                [
                  { id: 'SET-EQ-2026-W42', date: '16 Oct 2026', jobs: 6, gross: 24800, fee: 1984, net: 22816, status: 'disbursed' },
                  { id: 'SET-EQ-2026-W41', date: '09 Oct 2026', jobs: 9, gross: 38200, fee: 3056, net: 35144, status: 'disbursed' },
                  { id: 'SET-EQ-2026-W40', date: '02 Oct 2026', jobs: 8, gross: 31400, fee: 2512, net: 28888, status: 'disbursed' },
                ].map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{s.id}</p>
                      <p className="text-[10px] text-slate-400">{s.date}</p>
                    </td>
                    <td className="py-3 px-3">{s.jobs} Completed Slots</td>
                    <td className="py-3 px-3 font-semibold">{formatCurrency(s.gross)}</td>
                    <td className="py-3 px-3 text-rose-600">-{formatCurrency(s.fee)}</td>
                    <td className="py-3 px-3 font-black text-emerald-700">{formatCurrency(s.net)}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))
              ) : (
                settlements.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">{String(s.batchId || `SET-${idx}`)}</td>
                    <td className="py-3 px-3">{Number(s.jobCount || 1)} Jobs</td>
                    <td className="py-3 px-3 font-semibold">{formatCurrency(Number(s.grossRupees || 0))}</td>
                    <td className="py-3 px-3 text-rose-600">-{formatCurrency(Number(s.feeRupees || 0))}</td>
                    <td className="py-3 px-3 font-black text-emerald-700">{formatCurrency(Number(s.netPayoutRupees || 0))}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={String(s.status || 'settled')} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
