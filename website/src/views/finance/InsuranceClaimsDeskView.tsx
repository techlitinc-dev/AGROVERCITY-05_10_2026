import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  Clock,
  DollarSign,
  FileCheck,
  RefreshCw,
  ClipboardList,
  Percent,
  FileText,
  Users,
  Scale,
} from 'lucide-react';
import { insurance, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { str, num, arr, type Row } from './loanTypes';

export interface ClaimRow extends Row {
  id?: string;
  claimNumber?: string;
  farmerName?: string;
  farmerPhone?: string;
  cropName?: string;
  crop?: string;
  calamityType?: string;
  calamityDate?: string;
  dateOfDamage?: string;
  estimatedLossPercent?: number;
  damagePercentage?: number;
  requestedAmount?: number;
  estimatedLossAmount?: number;
  approvedAmount?: number;
  status?: string;
  submittedAt?: string;
  createdAt?: string;
  village?: string;
  appealCount?: number;
  fraudFlag?: boolean;
}

export const claimId = (c: ClaimRow): string => str(c.id ?? c.claimNumber);
export const claimCrop = (c: ClaimRow): string => str(c.cropName ?? c.crop);
export const claimLossPct = (c: ClaimRow): number => num(c.estimatedLossPercent ?? c.damagePercentage);
export const claimAmount = (c: ClaimRow): number => num(c.requestedAmount ?? c.estimatedLossAmount);

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'intimated', label: 'Intimated' },
  { value: 'surveyorAssigned', label: 'Surveyor Assigned' },
  { value: 'fieldAssessed', label: 'Field Assessed' },
  { value: 'dbtApproved', label: 'DBT Approved' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'rejected', label: 'Rejected' },
];

export const InsuranceClaimsDeskView: React.FC = () => {
  const [stats, setStats] = useState<Row | null>(null);
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 20;

  const loadStats = useCallback(async () => {
    try {
      setStats((await insurance.providerStats()) as Row);
    } catch {
      setStats(null);
    }
  }, []);

  const loadQueue = useCallback(async (p: number, st: string, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page: p, pageSize };
      if (st) params.status = st;
      if (q) params.q = q;
      const res = (await insurance.providerClaims(params)) as unknown as Row;
      setRows(arr(res?.data ?? res) as ClaimRow[]);
      setTotal(num(res?.total, arr(res?.data ?? res).length));
    } catch (e) {
      setError(apiErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadQueue(page, status, search);
  }, [loadQueue, page, status, search]);

  const statsData = useMemo(
    () => ({
      pendingClaims: num(stats?.pendingClaims),
      totalClaims: num(stats?.totalClaims),
      totalDisbursed: num(stats?.totalClaimDisbursed),
      approved: num(stats?.approvedClaims),
      disbursedCount: num(stats?.disbursedClaims),
      lossRatio: num(stats?.lossRatioPercent),
      avgCycle: num(stats?.avgCycleTimeHours),
      activePolicies: num(stats?.activePolicies),
    }),
    [stats]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-emerald-600" />
            PMFBY Crop Insurance & Claims Settlement Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review 72-hour crop damage intimations, assign village loss surveyors, and trigger Direct Benefit Transfer (DBT)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/insurance/policies"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs"
          >
            <FileCheck className="w-4 h-4 text-emerald-600" /> Policy Underwriting
          </Link>
          <Link
            to="/insurance/rates"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs"
          >
            <Scale className="w-4 h-4 text-emerald-600" /> Rate Card
          </Link>
          <Link
            to="/insurance/surveyors"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs"
          >
            <Users className="w-4 h-4 text-emerald-600" /> Surveyors
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Claims"
          value={stats ? `${statsData.pendingClaims}` : '—'}
          subtitle={`${statsData.totalClaims} total · ${statsData.activePolicies} active policies`}
          icon={Clock}
          colorScheme="blue"
        />
        <StatCard
          title="DBT Disbursed"
          value={stats ? formatCurrency(statsData.totalDisbursed) : '—'}
          subtitle={`${statsData.disbursedCount} claims paid`}
          icon={DollarSign}
          colorScheme="green"
        />
        <StatCard
          title="Loss Ratio"
          value={stats ? `${statsData.lossRatio}%` : '—'}
          subtitle={`${statsData.approved} awaiting disbursement`}
          icon={Percent}
          colorScheme="amber"
        />
        <StatCard
          title="Avg Settlement Cycle"
          value={stats ? `${statsData.avgCycle} hrs` : '—'}
          subtitle="Intimation → DBT credit"
          icon={FileText}
          colorScheme="purple"
        />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-emerald-600" />
            Claim Verification Queue
            <span className="text-[10px] font-bold text-slate-400">({total})</span>
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearch(searchInput.trim());
              }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Farmer, claim no., crop, village"
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <button type="submit" className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl">
                Search
              </button>
            </form>
            <button onClick={() => loadQueue(page, status, search)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3 flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setPage(1);
                setStatus(f.value);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                status === f.value
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Claim & Farmer</th>
                <th className="py-3 px-4">Crop & Calamity</th>
                <th className="py-3 px-4">Damage Date</th>
                <th className="py-3 px-4">Loss % / Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((claim) => {
                const id = claimId(claim);
                return (
                  <tr key={id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {str(claim.farmerName, 'Unknown farmer')}
                      <span className="text-[10px] text-slate-400 block font-mono font-normal">
                        {str(claim.claimNumber, id)}
                        {claim.farmerPhone ? ` · ${str(claim.farmerPhone)}` : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {claimCrop(claim)}
                      <span className="text-[11px] text-rose-600 block">{str(claim.calamityType, '—')}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {formatDate(str(claim.dateOfDamage ?? claim.calamityDate))}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-rose-700">{claimLossPct(claim)}%</span>
                      <span className="text-[11px] text-emerald-800 font-black block">{formatCurrency(claimAmount(claim))}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={str(claim.status, 'intimated')} />
                      {claim.fraudFlag && (
                        <span className="block text-[10px] font-bold text-rose-600 mt-0.5">AI fraud flag</span>
                      )}
                      {num(claim.appealCount) > 0 && (
                        <span className="block text-[10px] font-bold text-amber-600 mt-0.5">Appeal ×{num(claim.appealCount)}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <Link
                        to={`/insurance/claims/${encodeURIComponent(id)}`}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        Open Case <FileText className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 font-semibold">
                    No claims match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl">
                Previous
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
