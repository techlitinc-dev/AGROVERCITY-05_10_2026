import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquareQuote, ArrowRightLeft, Search, X } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';

interface Enquiry {
  id: string;
  productTitle?: string;
  quantity?: string;
  message?: string;
  fromName?: string;
  fromUid?: string;
  status: string;
  response?: string | null;
  createdAt?: string;
  convertedTo?: string;
  convertedId?: string;
}

function fmtDateTime(iso?: string): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '';
}

export const EnquiriesView: React.FC = () => {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [respondFor, setRespondFor] = useState<Enquiry | null>(null);
  const [response, setResponse] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async () => {
    try {
      setItems((await agriMarketSeller.enquiries()) as unknown as Enquiry[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const needle = q.trim().toLowerCase();
  const filtered = items.filter((e) => {
    if (needle) {
      const hay = [e.id, e.fromName, e.fromUid, e.productTitle].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    const day = (e.createdAt ?? '').slice(0, 10);
    if (fromDate && day < fromDate) return false;
    if (toDate && day > toDate) return false;
    return true;
  });

  const clearFilters = () => {
    setQ('');
    setFromDate('');
    setToDate('');
  };

  const respond = async () => {
    if (!respondFor || !response.trim()) return;
    setBusyId(respondFor.id);
    try {
      await agriMarketSeller.respondEnquiry(respondFor.id, response.trim());
      setNotice('Response sent.');
      setRespondFor(null);
      setResponse('');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const convert = async (enquiry: Enquiry, to: 'quotation' | 'order') => {
    setBusyId(enquiry.id);
    setError(null);
    try {
      await agriMarketSeller.convertEnquiry(enquiry.id, to);
      setNotice(`Enquiry converted to ${to}.`);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

  return (
    <div className="space-y-3">
      {error && <p className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</p>}
      {notice && <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800">{notice}</p>}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold text-slate-500">Search (ID / name / product)</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={`${field} pl-8`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="enq_…, Ramesh, Vermicompost"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">From date</span>
            <input className={field} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">To date</span>
            <input className={field} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Showing {filtered.length} of {items.length} enquiries
          </p>
          {(q || fromDate || toDate) && (
            <button onClick={clearFilters} className="text-[11px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1">
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {filtered.map((e) => (
        <div key={e.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <MessageSquareQuote className="w-4 h-4 text-emerald-600" />
              {e.productTitle}
              <span className="text-[10px] font-bold text-slate-400">{e.quantity}</span>
            </p>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                e.status === 'pending'
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : e.status === 'responded'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              {e.status}
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            #{e.id.replace(/^enq_/, '').toUpperCase()}
            {e.createdAt ? ` · ${fmtDateTime(e.createdAt)}` : ''}
            {e.fromName ? ` · from ${e.fromName}` : e.fromUid ? ` · from ${e.fromUid}` : ''}
          </p>
          <p className="text-[11px] text-slate-500">
            {e.fromName} — {e.message}
          </p>
          {e.response && <p className="text-[11px] text-emerald-800 bg-emerald-50 rounded-xl p-2">Your response: {e.response}</p>}
          {e.convertedTo && (
            <p className="text-[11px] text-slate-500">
              Converted to {e.convertedTo}
              {e.convertedId ? ` (${e.convertedId})` : ''}
            </p>
          )}
          {e.status !== 'converted' && (
            <div className="flex flex-wrap gap-2 pt-1">
              {e.status === 'pending' && (
                <button
                  onClick={() => setRespondFor(e)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold"
                >
                  Respond
                </button>
              )}
              <button
                onClick={() => void convert(e, 'quotation')}
                disabled={busyId === e.id}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1"
              >
                <ArrowRightLeft className="w-3 h-3" /> Convert to quotation
              </button>
              <button
                onClick={() => void convert(e, 'order')}
                disabled={busyId === e.id}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold"
              >
                Convert to order
              </button>
            </div>
          )}
        </div>
      ))}
      {filtered.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-6">
          {items.length === 0 ? 'No enquiries yet.' : 'No enquiries match the current search/filters.'}
        </p>
      )}

      {respondFor && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs p-5 space-y-3">
          <p className="text-xs font-black text-slate-900">Respond — {respondFor.productTitle}</p>
          <textarea
            rows={3}
            className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Your response to the farmer…"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void respond()}
              disabled={busyId === respondFor.id || !response.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
            >
              Send response
            </button>
            <button onClick={() => setRespondFor(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
