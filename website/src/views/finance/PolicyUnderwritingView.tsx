import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileCheck,
  Check,
  X,
  Scale,
  RefreshCw,
  Search,
  FileText,
} from 'lucide-react';
import { insurance, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import { str, num, arr, type Row } from './loanTypes';

type PolicyRow = Row;

/** Policy underwriting desk — PMFBY applications queue, endorsement review and the published rate card. */
export const PolicyUnderwritingView: React.FC = () => {
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [rates, setRates] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending_approval');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [detail, setDetail] = useState<PolicyRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [underwriterNotes, setUnderwriterNotes] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [busy, setBusy] = useState(false);

  const pageSize = 20;

  const loadPolicies = useCallback(async (p: number, st: string, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page: p, pageSize };
      if (st && st !== 'all') params.status = st;
      if (q) params.q = q;
      const res = (await insurance.providerPolicies(params)) as unknown as Row;
      const data = arr(res?.data ?? res);
      setRows(data as PolicyRow[]);
      setTotal(num(res?.total, data.length));
    } catch (e) {
      setError(apiErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRates = useCallback(async () => {
    try {
      setRates(arr((await insurance.rates()) as unknown) as Row[]);
    } catch {
      setRates([]);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  useEffect(() => {
    loadPolicies(page, status, search);
  }, [loadPolicies, page, status, search]);

  const openDetail = async (id: string) => {
    setError(null);
    try {
      setDetail((await insurance.providerPolicy(id)) as PolicyRow);
      setReviewAction('approve');
      setRejectionReason('');
      setUnderwriterNotes('');
      setInsuranceCompany('');
      setDetailOpen(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const submitReview = async () => {
    if (!detail) return;
    const id = str(detail.id);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await insurance.reviewPolicy(id, {
        action: reviewAction,
        rejectionReason: reviewAction === 'reject' ? rejectionReason : undefined,
        underwriterNotes: underwriterNotes || undefined,
        insuranceCompany: reviewAction === 'approve' ? insuranceCompany || undefined : undefined,
      });
      setNotice(`Policy ${str(detail.policyNumber, id)} ${reviewAction === 'approve' ? 'endorsed — certificate issued' : 'rejected'}.`);
      setDetailOpen(false);
      await loadPolicies(page, status, search);
      loadRates();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = rows.filter((r) => str(r.status) === 'pending_approval').length;
  const sumInsured = rows.reduce((s, r) => s + num(r.sumInsured), 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const detailStatus = str(detail?.status);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <Link to="/insuranceProvider" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to claims desk
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <FileCheck className="w-7 h-7 text-emerald-600" />
          Crop Policy Underwriting
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Endorse PMFBY applications, issue e-certificates, and reference the actuarial rate card
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Visible Applications" value={String(total)} subtitle={`${pendingCount} pending on this page`} icon={FileText} colorScheme="blue" />
        <StatCard title="Sum Insured (page)" value={formatCurrency(sumInsured)} subtitle="Aggregated across listed policies" icon={FileCheck} colorScheme="green" />
        <StatCard title="Published Rates" value={String(rates.length)} subtitle="Crop × season actuarial cards" icon={Scale} colorScheme="amber" />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-sm text-slate-900">Policy Applications</h3>
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
                  placeholder="Farmer, policy no., crop, village"
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <button type="submit" className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl">
                Search
              </button>
            </form>
            <button onClick={() => loadPolicies(page, status, search)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3 flex items-center gap-1.5 flex-wrap">
          {[
            { value: 'pending_approval', label: 'Pending Approval' },
            { value: 'active', label: 'Active' },
            { value: 'rejected', label: 'Rejected' },
            { value: '', label: 'All' },
          ].map((f) => (
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
                <th className="py-3 px-6">Farmer & Policy</th>
                <th className="py-3 px-4">Crop / Season</th>
                <th className="py-3 px-4">Sum Insured</th>
                <th className="py-3 px-4">Premium (Farmer + Govt)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((policy) => {
                const id = str(policy.id);
                return (
                  <tr key={id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {str(policy.farmerName, 'Unknown farmer')}
                      <span className="text-[10px] text-slate-400 block font-mono font-normal">
                        {str(policy.policyNumber, id)} · {str(policy.schemeName, 'PMFBY')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {str(policy.cropName)}
                      <span className="text-[11px] text-slate-500 block">{str(policy.season)} {num(policy.year)} · {num(policy.landAreaAcres)} ac</span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900">{formatCurrency(num(policy.sumInsured))}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-700">{formatCurrency(num(policy.farmerPremium))}</span>
                      <span className="text-[11px] text-slate-500 block">+ {formatCurrency(num(policy.govtSubsidy))} govt</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={str(policy.status, 'pending_approval')} />
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button onClick={() => openDetail(id)}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs">
                        {str(policy.status) === 'pending_approval' ? 'Underwrite' : 'View'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 font-semibold">
                    No policy applications match this filter.
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

      {/* Policy detail + review drawer */}
      <ModalSheet isOpen={detailOpen} onClose={() => setDetailOpen(false)} title={`Policy ${str(detail?.policyNumber)}`} description={`${str(detail?.farmerName)} · ${str(detail?.cropName)} · ${str(detail?.season)}`} maxWidth="2xl">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={detailStatus} />
              {str(detail.riskCategory) && <StatusBadge status={str(detail.riskCategory)} />}
              {detail.certificateUrl ? (
                <a href={str(detail.certificateUrl)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-emerald-700 hover:underline">
                  Download e-certificate →
                </a>
              ) : null}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div><span className="text-slate-400 font-bold uppercase text-[9px]">Scheme</span><div className="font-semibold text-slate-800">{str(detail.schemeName, 'PMFBY')}</div></div>
              <div><span className="text-slate-400 font-bold uppercase text-[9px]">Coverage</span><div className="font-semibold text-slate-800">{formatDate(str(detail.coverageStartDate))} → {formatDate(str(detail.coverageEndDate))}</div></div>
              <div><span className="text-slate-400 font-bold uppercase text-[9px]">Area</span><div className="font-semibold text-slate-800">{num(detail.landAreaAcres)} acres · Khasra {str(detail.khasraNumber, '—')}</div></div>
              <div><span className="text-slate-400 font-bold uppercase text-[9px]">Sum Insured</span><div className="font-semibold text-slate-800">{formatCurrency(num(detail.sumInsured))}</div></div>
              <div><span className="text-slate-400 font-bold uppercase text-[9px]">Farmer Premium</span><div className="font-semibold text-slate-800">{formatCurrency(num(detail.farmerPremium))}</div></div>
              <div><span className="text-slate-400 font-bold uppercase text-[9px]">Govt Subsidy</span><div className="font-semibold text-slate-800">{formatCurrency(num(detail.govtSubsidy))}</div></div>
              <div><span className="text-slate-400 font-bold uppercase text-[9px]">Bank / KCC</span><div className="font-semibold text-slate-800">{str(detail.bankName, '—')} · {str(detail.kccAccountNo, '—')}</div></div>
              <div><span className="text-slate-400 font-bold uppercase text-[9px]">Village</span><div className="font-semibold text-slate-800">{str(detail.village, '—')}</div></div>
              <div><span className="text-slate-400 font-bold uppercase text-[9px]">Applied</span><div className="font-semibold text-slate-800">{formatDate(str(detail.appliedAt))}</div></div>
              {detail.riskScore !== undefined && (
                <div><span className="text-slate-400 font-bold uppercase text-[9px]">Risk Score</span><div className="font-semibold text-slate-800">{num(detail.riskScore)}/100</div></div>
              )}
              {detailStatus === 'rejected' && (
                <div className="col-span-2"><span className="text-slate-400 font-bold uppercase text-[9px]">Rejection Reason</span><div className="font-semibold text-rose-700">{str(detail.rejectionReason)}</div></div>
              )}
            </div>

            {detailStatus === 'pending_approval' && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setReviewAction('approve')}
                    className={`py-2 rounded-xl font-bold text-xs border ${reviewAction === 'approve' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                    <Check className="w-3.5 h-3.5 inline mr-1" /> Endorse (Approve)
                  </button>
                  <button onClick={() => setReviewAction('reject')}
                    className={`py-2 rounded-xl font-bold text-xs border ${reviewAction === 'reject' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                    <X className="w-3.5 h-3.5 inline mr-1" /> Reject
                  </button>
                </div>
                {reviewAction === 'approve' ? (
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Insurer (defaults to your company)
                    <input value={insuranceCompany} onChange={(e) => setInsuranceCompany(e.target.value)} placeholder="e.g. AIC of India"
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </label>
                ) : (
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Rejection Reason
                    <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2} required
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200" />
                  </label>
                )}
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  Underwriter Notes
                  <textarea value={underwriterNotes} onChange={(e) => setUnderwriterNotes(e.target.value)} rows={2}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </label>
                <button
                  onClick={submitReview}
                  disabled={busy || (reviewAction === 'reject' && !rejectionReason.trim())}
                  className={`w-full py-2.5 font-bold text-sm rounded-xl text-white disabled:opacity-60 ${reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                  {busy ? 'Saving…' : reviewAction === 'approve' ? 'Endorse Policy & Issue Certificate' : 'Reject Application'}
                </button>
              </div>
            )}
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
