import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Inbox,
  RotateCcw,
  Share2,
  SlidersHorizontal,
} from 'lucide-react';
import { apiErrorMessage } from '../../lib/api';
import { apiClient } from '../../lib/api/client';
import { download } from '../../lib/api/http';
import { payments } from '../../lib/api/payments';
import type { Transaction, TransactionParams, TransactionsResponse } from '../../lib/api/payments';
import { StatusBadge } from '../../components/common/StatusBadge';
import { cn, formatCurrency, formatDateTime } from '../../lib/utils';

const PAGE_SIZE = 20;
const REFUNDABLE_STATUSES = ['captured', 'success', 'paid'];

type DirectionFilter = 'all' | 'received' | 'sent';

interface AppliedFilters {
  direction: DirectionFilter;
  status: string;
  type: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: AppliedFilters = { direction: 'all', status: '', type: '', from: '', to: '' };

const DIRECTION_TABS: { key: DirectionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'received', label: 'Received' },
  { key: 'sent', label: 'Sent' },
];

export const TransactionsPage: React.FC = () => {
  const [draft, setDraft] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const load = useCallback(async (filters: AppliedFilters, targetPage: number) => {
    setLoading(true);
    try {
      const direction = filters.direction;
      const params: TransactionParams = { page: targetPage, pageSize: PAGE_SIZE };
      if (direction !== 'all') params.direction = direction;
      if (filters.status) params.status = filters.status;
      if (filters.type.trim()) params.type = filters.type.trim();
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      const data = await payments.getTransactions(params);
      setResult(data);
    } catch (err) {
      flash('err', apiErrorMessage(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(applied, page);
  }, [applied, page, load]);

  const applyFilters = () => {
    setPage(1);
    setApplied({ ...draft });
  };

  const resetFilters = () => {
    setDraft({ ...EMPTY_FILTERS });
    setApplied({ ...EMPTY_FILTERS });
    setPage(1);
  };

  const setDirection = (direction: DirectionFilter) => {
    const next = { ...draft, direction };
    setDraft(next);
    setApplied(next);
    setPage(1);
  };

  const requestRefund = async (tx: Transaction) => {
    const label = tx.counterparty?.name || tx.purpose || 'this payment';
    if (busyId) return;
    if (!window.confirm(`Request a refund of ${formatCurrency(tx.amount)} paid to ${label}?`)) return;
    setBusyId(tx.id);
    try {
      await payments.requestRefund(tx.id);
      flash('ok', `Refund requested for ${formatCurrency(tx.amount)}. We will review it shortly.`);
      await load(applied, page);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  /** GET /payments/{id}/receipt.pdf — authenticated blob fetch, then save-as. */
  const downloadReceipt = async (tx: Transaction) => {
    if (busyId) return;
    setBusyId(tx.id);
    try {
      const blob = await download(`/payments/${tx.id}/receipt.pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${tx.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const receiptUrl = (tx: Transaction) =>
    `${apiClient.defaults.baseURL ?? ''}/payments/${tx.id}/receipt.pdf`;

  /** Share a text summary — navigator.share when available, clipboard otherwise. */
  const shareTx = async (tx: Transaction) => {
    const text = [
      `Agrovercity payment — ${formatDateTime(tx.createdAt) || '—'}`,
      `Amount: ${formatCurrency(tx.amount)} (${tx.direction})`,
      `Purpose: ${tx.purpose || tx.type || 'payment'}`,
      `Receipt: ${receiptUrl(tx)}`,
    ].join('\n');
    const title = `Payment ${tx.id}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard?.writeText(text);
      flash('ok', 'Payment summary copied to clipboard.');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    }
  };

  const transactions = result?.data ?? [];
  const totals = result?.totals ?? {
    // Fallback when the backend omits totals: compute from the fetched page.
    totalReceived: transactions.filter((t) => t.direction === 'received').reduce((s, t) => s + t.amount, 0),
    totalSent: transactions.filter((t) => t.direction === 'sent').reduce((s, t) => s + t.amount, 0),
    refundsPending: transactions.filter((t) => t.refundStatus === 'requested').length,
  };
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  const canRefund = (tx: Transaction) =>
    tx.direction === 'sent' &&
    REFUNDABLE_STATUSES.includes(tx.status.toLowerCase()) &&
    !tx.refundStatus;

  // Receipt PDFs exist only on the canonical `payments` rail; ledger rows
  // folded in from payouts have no receipt to download.
  const canReceipt = (tx: Transaction) => (tx.source ?? 'payments') === 'payments';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ArrowLeftRight className="w-7 h-7 text-emerald-600" />
          Payments & Transactions
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Every payment you have sent or received across orders, rentals, dairy and payouts
        </p>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total received</p>
            <p className="text-lg font-black text-slate-900">{formatCurrency(totals.totalReceived)}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total sent</p>
            <p className="text-lg font-black text-slate-900">{formatCurrency(totals.totalSent)}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Refunds pending</p>
            <p className="text-lg font-black text-slate-900">{totals.refundsPending}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          {DIRECTION_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDirection(tab.key)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-bold border transition-colors',
                applied.direction === tab.key
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
              )}
            >
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={resetFilters}
            className="px-4 py-1.5 rounded-full text-xs font-bold border border-slate-200 text-slate-500 hover:border-slate-400 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={applyFilters}
            className="px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            Apply
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-[11px] font-semibold text-slate-500 space-y-1">
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="">All statuses</option>
              {['paid', 'captured', 'success', 'pending', 'created', 'processing', 'processed', 'refunded', 'failed'].map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-slate-500 space-y-1">
            <span>Type</span>
            <input
              type="text"
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              placeholder="e.g. produce, rental, payout"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="text-[11px] font-semibold text-slate-500 space-y-1">
            <span>From date</span>
            <input
              type="date"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="text-[11px] font-semibold text-slate-500 space-y-1">
            <span>To date</span>
            <input
              type="date"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
        </div>
      </div>

      {/* Ledger */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-slate-400" /> Transactions
            {result && <span className="text-[11px] font-semibold text-slate-400">({result.total})</span>}
          </h3>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 py-8 text-center">Loading transactions…</p>
        ) : transactions.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2 text-center">
            <Inbox className="w-8 h-8 text-slate-300" />
            <p className="text-xs text-slate-400">
              No transactions found. Adjust the filters or reset to see everything.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => {
              const received = tx.direction === 'received';
              return (
                <div
                  key={`${tx.source ?? 'payments'}:${tx.id}`}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 flex flex-wrap items-center gap-2">
                      {tx.counterparty?.name || (received ? 'Received payment' : 'Platform payment')}
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          received
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        )}
                      >
                        {received ? (
                          <ArrowDownLeft className="w-3 h-3 mr-0.5" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        )}
                        {received ? 'Received' : 'Sent'}
                      </span>
                      <StatusBadge status={tx.status} />
                      {tx.refundStatus === 'requested' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
                          Refund requested
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 capitalize">
                      {tx.purpose || tx.type}
                      {tx.counterparty?.persona ? ` · ${tx.counterparty.persona}` : ''} ·{' '}
                      {formatDateTime(tx.createdAt) || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-auto">
                    <span
                      className={cn(
                        'font-black text-sm',
                        received ? 'text-emerald-700' : 'text-rose-700'
                      )}
                    >
                      {received ? '+' : '−'}
                      {formatCurrency(tx.amount)}
                    </span>
                    {tx.invoiceUrl && (
                      <a
                        href={tx.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800"
                      >
                        <FileText className="w-3.5 h-3.5" /> Invoice
                      </a>
                    )}
                    {canReceipt(tx) && (
                      <button
                        onClick={() => void downloadReceipt(tx)}
                        disabled={busyId === tx.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {busyId === tx.id ? 'Downloading…' : 'Receipt'}
                      </button>
                    )}
                    <button
                      onClick={() => void shareTx(tx)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                    {canRefund(tx) && (
                      <button
                        onClick={() => void requestRefund(tx)}
                        disabled={busyId === tx.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {busyId === tx.id ? 'Requesting…' : 'Request refund'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {result && result.total > result.pageSize && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 font-semibold">
              Page {result.page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:border-slate-400 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:border-slate-400 disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsPage;
