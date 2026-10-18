import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Landmark,
  Search,
  Clock,
  DollarSign,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  ClipboardList,
  AlertTriangle,
  Wallet,
  FileSearch,
} from 'lucide-react';
import { loans, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { num, str, loanId, type LoanRow, type Row } from './loanTypes';

interface QueueResponse {
  data?: unknown;
  page?: number;
  pageSize?: number;
  total?: number;
  nextCursor?: string | null;
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'New' },
  { value: 'underReview', label: 'Under Review' },
  { value: 'infoRequested', label: 'Info Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'rejected', label: 'Rejected' },
];

export const BankManagerDeskView: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Row | null>(null);
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pageSize = 20;

  const loadStats = useCallback(async () => {
    try {
      setStats((await loans.stats()) as Row);
    } catch {
      setStats(null); // stats are decorative — queue still renders
    }
  }, []);

  const loadQueue = useCallback(async (p: number, st: string, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page: p, pageSize };
      if (st) params.status = st;
      if (q) params.q = q;
      const res = (await loans.queue(params)) as unknown;
      const envelope = res as QueueResponse;
      const data = Array.isArray(envelope?.data) ? (envelope.data as LoanRow[]) : (res as LoanRow[]);
      setRows(data);
      setTotal(num(envelope?.total, data.length));
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

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleReview = async (loan: LoanRow) => {
    const id = loanId(loan);
    setBusyId(id);
    setNotice(null);
    setError(null);
    try {
      await loans.review(id);
      setNotice(`Application ${str(loan.applicationNumber, id)} moved to under review.`);
      await Promise.all([loadQueue(page, status, search), loadStats()]);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const statsData = useMemo(() => {
    const portfolio = (stats?.portfolioTotals ?? {}) as Row;
    const sla = (stats?.queueDepthBySla ?? {}) as Row;
    const week = (stats?.disbursalsThisWeek ?? {}) as Row;
    return {
      pendingReview: num(stats?.pendingReview),
      totalApplications: num(stats?.totalApplications),
      slaBreach: num(sla.breach),
      sanctioned: num(portfolio.sanctionedPaisa) / 100,
      disbursedWeek: num(week.amountPaisa) / 100,
      disbursedWeekCount: num(week.count),
      collectionRate: num(stats?.emiCollectionRate),
      atRisk: num(stats?.atRiskAccounts),
      approvalsToday: num(stats?.approvalsToday),
    };
  }, [stats]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Landmark className="w-7 h-7 text-emerald-600" />
            Bank Manager & Credit Underwriting Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            KCC appraisal, 7/12 land revenue cross-checks, credit scoring, DBT disbursals and EMI collection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/bank/repayments"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs"
          >
            <Wallet className="w-4 h-4 text-emerald-600" /> Repayment Ledger
          </Link>
          <Link
            to="/bank/audit"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs"
          >
            <FileSearch className="w-4 h-4 text-emerald-600" /> Credit Audit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Review"
          value={stats ? `${statsData.pendingReview}` : '—'}
          subtitle={`${statsData.slaBreach} past SLA · ${statsData.approvalsToday} approved today`}
          icon={Clock}
          colorScheme="blue"
        />
        <StatCard
          title="Sanctioned Portfolio"
          value={stats ? formatCurrency(statsData.sanctioned) : '—'}
          subtitle={`${statsData.totalApplications} total applications`}
          icon={DollarSign}
          colorScheme="green"
        />
        <StatCard
          title="Disbursals This Week"
          value={stats ? formatCurrency(statsData.disbursedWeek) : '—'}
          subtitle={`${statsData.disbursedWeekCount} DBT transfers`}
          icon={ShieldCheck}
          colorScheme="purple"
        />
        <StatCard
          title="EMI Collection Rate"
          value={stats ? `${statsData.collectionRate}%` : '—'}
          subtitle={`${statsData.atRisk} accounts on NPA watch`}
          icon={AlertTriangle}
          colorScheme="amber"
        />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">
          {notice}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-emerald-600" />
            Loan Underwriting Queue
            <span className="text-[10px] font-bold text-slate-400">({total})</span>
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Farmer, phone, application no."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
              >
                Search
              </button>
            </form>
            <button
              onClick={() => loadQueue(page, status, search)}
              className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100"
              title="Refresh"
            >
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
                <th className="py-3 px-6">Farmer & Application</th>
                <th className="py-3 px-4">Amount / Tenure</th>
                <th className="py-3 px-4">District</th>
                <th className="py-3 px-4">Credit Score</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((loan) => {
                const id = loanId(loan);
                const ai = (loan.ai ?? null) as Row | null;
                return (
                  <tr key={id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {str(loan.farmerName, 'Unknown farmer')}
                      <span className="text-[10px] text-slate-400 block font-mono font-normal">
                        {str(loan.applicationNumber, id)}
                        {loan.farmerPhone ? ` · ${str(loan.farmerPhone)}` : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-black text-slate-900">{formatCurrency(num(loan.amount))}</span>
                      <span className="text-[11px] text-slate-500 block">{num(loan.tenureMonths)} months · {str(loan.purpose, '—')}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">{str(loan.district, '—')}</td>
                    <td className="py-3.5 px-4">
                      {loan.farmerCreditScore ? (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {num(loan.farmerCreditScore)}
                          {loan.farmerCreditTier ? ` · ${str(loan.farmerCreditTier)}` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {ai?.riskBand ? (
                        <span className="block text-[10px] font-bold text-amber-600 mt-0.5">AI band: {str(ai.riskBand)}</span>
                      ) : null}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={str(loan.status, 'submitted')} />
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      {loan.status === 'submitted' && (
                        <button
                          onClick={() => handleReview(loan)}
                          disabled={busyId === id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs mr-2"
                        >
                          {busyId === id ? 'Starting…' : 'Start Review'}
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/bank/applications/${id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        Open <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 font-semibold">
                    No loan applications match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
