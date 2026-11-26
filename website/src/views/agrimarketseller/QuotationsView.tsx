import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Search, X } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';

interface QuotationItem {
  title?: string;
  unitPricePaisa?: number;
  quantity?: number;
}

interface Quotation {
  id: string;
  number?: string;
  status: string;
  totalPaisa?: number;
  subtotalPaisa?: number;
  discountPaisa?: number;
  taxesPaisa?: number;
  validUntil?: string;
  items?: QuotationItem[];
  delivery?: { mode?: string; chargePaisa?: number };
  buyerUid?: string;
  buyerName?: string;
  enquiryId?: string;
  createdAt?: string;
}

function fmtDateTime(iso?: string): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '';
}

function rupees(paisa?: number): string {
  return `₹${((paisa ?? 0) / 100).toLocaleString('en-IN')}`;
}

export const QuotationsView: React.FC = () => {
  const [items, setItems] = useState<Quotation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    unitPrice: '',
    quantity: '1',
    discount: '0',
    taxes: '0',
    validUntil: '',
    buyerUid: '',
  });
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async () => {
    try {
      setItems((await agriMarketSeller.quotations()) as unknown as Quotation[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const needle = q.trim().toLowerCase();
  const filtered = items.filter((qt) => {
    if (needle) {
      const hay = [
        qt.id,
        qt.number,
        qt.buyerName,
        qt.buyerUid,
        ...(qt.items ?? []).map((i) => i.title),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    const day = (qt.createdAt ?? '').slice(0, 10);
    if (fromDate && day < fromDate) return false;
    if (toDate && day > toDate) return false;
    return true;
  });

  const clearFilters = () => {
    setQ('');
    setFromDate('');
    setToDate('');
  };

  const create = async () => {
    if (!form.title || !form.unitPrice || !form.validUntil) return;
    setBusy(true);
    setError(null);
    try {
      await agriMarketSeller.createQuotation({
        buyerUid: form.buyerUid || undefined,
        items: [
          {
            title: form.title,
            unitPricePaisa: Math.round(Number(form.unitPrice) * 100),
            quantity: Number(form.quantity) || 1,
          },
        ],
        discountPaisa: Math.round(Number(form.discount || 0) * 100),
        taxesPaisa: Math.round(Number(form.taxes || 0) * 100),
        delivery: {},
        validUntil: form.validUntil,
      });
      setNotice('Quotation created.');
      setShowForm(false);
      setForm({ title: '', unitPrice: '', quantity: '1', discount: '0', taxes: '0', validUntil: '', buyerUid: '' });
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

  return (
    <div className="space-y-4">
      {error && <p className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</p>}
      {notice && <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800">{notice}</p>}

      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> New quotation
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs p-5 space-y-3">
          <p className="text-xs font-black text-slate-900">New quotation</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="block col-span-2">
              <span className="text-[11px] font-bold text-slate-500">Item</span>
              <input className={field} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">Unit price (₹)</span>
              <input className={field} type="number" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">Quantity</span>
              <input className={field} type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">Discount (₹)</span>
              <input className={field} type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">Taxes (₹)</span>
              <input className={field} type="number" value={form.taxes} onChange={(e) => setForm((f) => ({ ...f, taxes: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">Valid until</span>
              <input className={field} type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
            </label>
            <label className="block col-span-2">
              <span className="text-[11px] font-bold text-slate-500">Buyer user ID (optional)</span>
              <input className={field} value={form.buyerUid} onChange={(e) => setForm((f) => ({ ...f, buyerUid: e.target.value }))} />
            </label>
          </div>
          <button
            onClick={() => void create()}
            disabled={busy || !form.title || !form.unitPrice || !form.validUntil}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create quotation'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold text-slate-500">Search (number / ID / buyer / item)</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={`${field} pl-8`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="QS-202611-0001, Ramesh, Vermicompost"
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
            Showing {filtered.length} of {items.length} quotations
          </p>
          {(q || fromDate || toDate) && (
            <button onClick={clearFilters} className="text-[11px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1">
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((qt) => (
          <div key={qt.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" /> {qt.number}
              </p>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  qt.status === 'sent'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : qt.status === 'accepted'
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {qt.status}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              #{qt.id.replace(/^qt_/, '').toUpperCase()}
              {qt.createdAt ? ` · ${fmtDateTime(qt.createdAt)}` : ''}
              {qt.buyerName ? ` · buyer ${qt.buyerName}` : qt.buyerUid ? ` · buyer ${qt.buyerUid}` : ''}
              {qt.enquiryId ? ` · from enquiry ${qt.enquiryId}` : ''}
            </p>
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
              {(qt.items ?? []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 last:border-b-0 text-[11px]"
                >
                  <span className="font-bold text-slate-800">{item.title}</span>
                  <span className="text-slate-600">
                    {item.quantity ?? 0} × {rupees(item.unitPricePaisa)} ={' '}
                    {rupees((item.unitPricePaisa ?? 0) * (item.quantity ?? 0))}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-700">
              Subtotal {rupees(qt.subtotalPaisa)} · Discount {rupees(qt.discountPaisa)} · Taxes {rupees(qt.taxesPaisa)} ·{' '}
              <span className="font-bold text-slate-900">Total {rupees(qt.totalPaisa)}</span>
            </p>
            <p className="text-[10px] text-slate-400">
              {qt.delivery?.mode ? `Delivery: ${qt.delivery.mode.replace(/_/g, ' ')} · ` : ''}
              valid till {qt.validUntil}
            </p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">
            {items.length === 0 ? 'No quotations yet.' : 'No quotations match the current search/filters.'}
          </p>
        )}
      </div>
    </div>
  );
};
