import React, { useCallback, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller, post } from '../../lib/api';

interface ProductRow {
  id: string;
  title?: string;
  category?: string;
  mrp?: number;
  discountedPrice?: number;
  stock?: number;
  status?: string;
  variants?: unknown[];
  units?: string;
  specifications?: Record<string, string>;
  minOrderQty?: number | null;
  maxOrderQty?: number | null;
  slabs?: unknown[];
  lowStockThreshold?: number;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

export const ProductsView: React.FC = () => {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState({ units: '', minOrderQty: '', maxOrderQty: '', lowStockThreshold: '', specs: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await agriMarketSeller.products()) as unknown as ProductRow[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (p: ProductRow) => {
    setEditing(p);
    setForm({
      units: str(p.units),
      minOrderQty: p.minOrderQty != null ? String(p.minOrderQty) : '',
      maxOrderQty: p.maxOrderQty != null ? String(p.maxOrderQty) : '',
      lowStockThreshold: p.lowStockThreshold != null ? String(p.lowStockThreshold) : '',
      specs: p.specifications ? JSON.stringify(p.specifications) : '',
    });
    setNotice(null);
  };

  const savePricing = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      let specs: Record<string, string> = {};
      if (form.specs.trim()) specs = JSON.parse(form.specs);
      await agriMarketSeller.savePricing(editing.id, {
        units: form.units,
        minOrderQty: form.minOrderQty ? Number(form.minOrderQty) : null,
        maxOrderQty: form.maxOrderQty ? Number(form.maxOrderQty) : null,
        lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : null,
        specifications: specs,
        variants: editing.variants ?? [],
        slabs: editing.slabs ?? [],
      });
      setNotice(`Pricing saved for ${editing.title}.`);
      setEditing(null);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const quickCreate = async () => {
    const title = window.prompt('Product title?');
    if (!title) return;
    setError(null);
    try {
      await post<unknown>('/my-products', {
        title,
        category: 'General',
        mrp: 0,
        discountedPrice: 0,
        stock: 0,
      });
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

  return (
    <div className="space-y-4">
      {error && <p className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</p>}
      {notice && <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800">{notice}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500">
          {items.length} product(s) — variants, units, specs, MOQ and slabs edit per product.
        </p>
        <button
          onClick={() => void quickCreate()}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
        >
          + Add Product
        </button>
      </div>

      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">{p.title}</p>
              <p className="text-[11px] text-slate-500">
                ₹{p.discountedPrice ?? 0} · stock {p.stock ?? 0} · {p.category}
                {p.units ? ` · ${p.units}` : ''}
                {p.minOrderQty ? ` · MOQ ${p.minOrderQty}` : ''}
                {p.lowStockThreshold != null ? ` · low≤${p.lowStockThreshold}` : ''}
              </p>
            </div>
            <button
              onClick={() => openEditor(p)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 hover:border-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Pricing &amp; units
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No products yet.</p>}
      </div>

      {editing && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs p-5 space-y-3">
          <p className="text-xs font-black text-slate-900">Pricing — {editing.title}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">Units</span>
              <input className={field} value={form.units} onChange={(e) => setForm((f) => ({ ...f, units: e.target.value }))} placeholder="bag / kg / litre" />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">Min order qty</span>
              <input className={field} type="number" value={form.minOrderQty} onChange={(e) => setForm((f) => ({ ...f, minOrderQty: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">Max order qty</span>
              <input className={field} type="number" value={form.maxOrderQty} onChange={(e) => setForm((f) => ({ ...f, maxOrderQty: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">Low-stock alert at</span>
              <input className={field} type="number" value={form.lowStockThreshold} onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))} />
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Specifications (JSON, e.g. {"{\"npk\":\"2-1-1\"}"})</span>
            <input className={field} value={form.specs} onChange={(e) => setForm((f) => ({ ...f, specs: e.target.value }))} />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => void savePricing()}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
