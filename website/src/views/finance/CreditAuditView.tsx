import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSearch, RefreshCw, ShieldCheck } from 'lucide-react';
import { loans, admin, apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import {
  str,
  num,
  arr,
  loanId,
  type LoanRow,
  type AuditRow,
  type Row,
} from './loanTypes';

const actionTone = (action: string): string => {
  if (/APPROVE|DISBURSE|SETTLED/i.test(action)) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (/REJECT/i.test(action)) return 'text-rose-700 bg-rose-50 border-rose-200';
  if (/REVIEW|INFO/i.test(action)) return 'text-sky-700 bg-sky-50 border-sky-200';
  return 'text-slate-600 bg-slate-50 border-slate-200';
};

/** Credit audit trail — per-application loan audit logs + platform credit-score distribution. */
export const CreditAuditView: React.FC = () => {
  const [candidates, setCandidates] = useState<LoanRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [scores, setScores] = useState<Row | null>(null);
  const [scoresError, setScoresError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await loans.queue({ pageSize: 100 })) as unknown as Row;
      const data = arr(res?.data ?? res) as LoanRow[];
      setCandidates(data);
      if (data.length > 0) setSelectedId((prev) => prev || loanId(data[0]));
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const loadLogs = useCallback(async (id: string, p: number) => {
    if (!id) return;
    setLogsError(null);
    try {
      const res = (await loans.auditLogs({ applicationId: id, page: p, pageSize })) as unknown;
      const envelope = res as Row;
      setLogs(arr(envelope?.data ?? res) as AuditRow[]);
      setTotal(num(envelope?.total, arr(envelope?.data ?? res).length));
    } catch (e) {
      setLogsError(apiErrorMessage(e));
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    loadLogs(selectedId, page);
  }, [selectedId, page, loadLogs]);

  useEffect(() => {
    (async () => {
      try {
        setScores((await admin.finance.creditScores()) as unknown as Row);
        setScoresError(null);
      } catch (e) {
        setScores(null);
        setScoresError(apiErrorMessage(e));
      }
    })();
  }, []);

  const selected = candidates.find((c) => loanId(c) === selectedId);
  const distribution = (scores?.tierDistribution ?? {}) as Row;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <Link to="/bank" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to desk
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <FileSearch className="w-7 h-7 text-emerald-600" />
          Credit Audit Trail
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Every lending decision, disbursement and repayment is audit-logged; platform credit-score distribution below
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Platform Credit Scores
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {scoresError && (
              <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {scoresError} — this console needs finance_admin/compliance access.
              </p>
            )}
            {scores ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="text-[9px] font-bold uppercase text-slate-400">Users Scored</span>
                    <div className="text-xl font-black text-slate-900">{num(scores.totalScored)}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <span className="text-[9px] font-bold uppercase text-emerald-600">Average Score</span>
                    <div className="text-xl font-black text-emerald-800">{num(scores.averageScore)}</div>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tier Distribution</span>
                  <div className="mt-2 space-y-1.5">
                    {['excellent', 'good', 'fair', 'poor'].map((tier) => {
                      const count = num(distribution[tier]);
                      const max = Math.max(1, num(scores.totalScored));
                      return (
                        <div key={tier} className="flex items-center gap-2">
                          <span className="w-16 text-[10px] font-bold uppercase text-slate-500 capitalize">{tier}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${tier === 'excellent' ? 'bg-emerald-500' : tier === 'good' ? 'bg-sky-500' : tier === 'fair' ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, (count / max) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-700 w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              !scoresError && <p className="text-xs text-slate-400">Loading credit-score distribution…</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-bold text-sm text-slate-900">Loan Decision Audit Logs</h3>
            <div className="flex items-center gap-2">
              <select
                value={selectedId}
                onChange={(e) => {
                  setPage(1);
                  setSelectedId(e.target.value);
                }}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                {loading && <option value="">Loading…</option>}
                {candidates.map((c) => (
                  <option key={loanId(c)} value={loanId(c)}>
                    {str(c.applicationNumber, loanId(c))} — {str(c.farmerName, 'Farmer')}
                  </option>
                ))}
              </select>
              <button onClick={() => loadLogs(selectedId, page)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100" title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          {selected && (
            <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 text-[11px] text-slate-500">
              {str(selected.applicationNumber, selectedId)} · {str(selected.farmerName)} ·{' '}
              <Link to={`/bank/applications/${selectedId}`} className="font-bold text-emerald-700 hover:underline">
                open file →
              </Link>
            </div>
          )}
          {logsError && (
            <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">
              {logsError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-4">When</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Reason / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log, i) => {
                  const action = str(log.action, 'EVENT');
                  return (
                    <tr key={str(log.id) || String(i)} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {formatDate(str(log.at ?? log.timestamp))}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{str(log.actor, 'system')}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${actionTone(action)}`}>
                          {action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-72 truncate">
                        {str(log.reason ?? log.dbtRef ?? log.decision, '—')}
                      </td>
                    </tr>
                  );
                })}
                {logs.length === 0 && !logsError && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 font-semibold">
                      No audit entries for this application yet.
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
    </div>
  );
};
