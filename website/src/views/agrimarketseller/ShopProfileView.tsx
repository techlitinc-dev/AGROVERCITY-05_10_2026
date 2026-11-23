import React, { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';

interface ShopForm {
  shopName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  deliveryArea: string;
  pickupAddress: string;
  documentIds: string;
}

const EMPTY: ShopForm = {
  shopName: '',
  bankName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  deliveryArea: '',
  pickupAddress: '',
  documentIds: '',
};

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

export const ShopProfileView: React.FC = () => {
  const [form, setForm] = useState<ShopForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    agriMarketSeller
      .shop()
      .then((doc) => {
        if (!mounted) return;
        const d = (doc || {}) as Record<string, unknown>;
        setForm({
          shopName: str(d.shopName),
          bankName: str(d.bankName),
          bankAccountNumber: str(d.bankAccountNumber),
          bankIfsc: str(d.bankIfsc),
          deliveryArea: str(d.deliveryArea),
          pickupAddress: str(d.pickupAddress),
          documentIds: Array.isArray(d.documentIds) ? (d.documentIds as string[]).join(', ') : '',
        });
      })
      .catch((e) => mounted && setError(apiErrorMessage(e)))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const set = (key: keyof ShopForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await agriMarketSeller.saveShop({
        ...form,
        documentIds: form.documentIds.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setNotice('Shop profile saved.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4 text-emerald-600" />
        <h2 className="text-sm font-black text-slate-900">Seller Profile &amp; Shop</h2>
      </div>
      {error && <p className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</p>}
      {notice && <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800">{notice}</p>}
      {loading ? (
        <p className="text-xs text-slate-400 animate-pulse">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold text-slate-500">Shop name</span>
            <input className={field} value={form.shopName} onChange={set('shopName')} placeholder="Amit Agro Shop" />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Bank name</span>
            <input className={field} value={form.bankName} onChange={set('bankName')} />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">IFSC</span>
            <input className={field} value={form.bankIfsc} onChange={set('bankIfsc')} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold text-slate-500">Bank account number</span>
            <input className={field} value={form.bankAccountNumber} onChange={set('bankAccountNumber')} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold text-slate-500">Delivery area</span>
            <input className={field} value={form.deliveryArea} onChange={set('deliveryArea')} placeholder="Baramati, Pune district" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold text-slate-500">Pickup address</span>
            <textarea className={field} rows={2} value={form.pickupAddress} onChange={set('pickupAddress')} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold text-slate-500">Documents (comma-separated vault IDs)</span>
            <input className={field} value={form.documentIds} onChange={set('documentIds')} placeholder="doc_pan, doc_gst" />
          </label>
        </div>
      )}
      <button
        onClick={() => void save()}
        disabled={saving || loading}
        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Shop Profile'}
      </button>
    </div>
  );
};
