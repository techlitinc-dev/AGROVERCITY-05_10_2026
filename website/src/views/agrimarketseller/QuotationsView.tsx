import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
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
  delivery?: { mode?: string };
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

      <div className="space-y-2">
        {items.map((q) => (
          <div key={q.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" /> {q.number}
              </p>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  q.status === 'sent'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : q.status === 'accepted'
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {q.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {(q.items ?? []).map((i) => `${i.title} × ${i.quantity} @ ₹${((i.unitPricePaisa ?? 0) / 100).toFixed(0)}`).join(', ')}
            </p>
            <p className="text-[11px] text-slate-700 mt-1">
              Subtotal ₹{((q.subtotalPaisa ?? 0) / 100).toFixed(0)} · Discount ₹{((q.discountPaisa ?? 0) / 100).toFixed(0)} · Taxes ₹
              {((q.taxesPaisa ?? 0) / 100).toFixed(0)} ·{' '}
              <span className="font-bold text-slate-900">Total ₹{((q.totalPaisa ?? 0) / 100).toFixed(0)}</span> · valid till {q.validUntil}
            </p>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No quotations yet.</p>}
      </div>
    </div>
  );
};
