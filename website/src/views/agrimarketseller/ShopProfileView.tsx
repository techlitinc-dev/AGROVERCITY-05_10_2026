import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Store, Truck } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';
import { bankAccountError, ifscError, nameError } from '../../lib/validation';
import { useAuthStore } from '../../stores/authStore';
import { asRecords, pickStr } from '../shared/records';

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
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState<ShopForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<Record<string, unknown>[] | null>(null);

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

  const loadShops = useCallback(() => {
    agriMarketSeller
      .shops()
      .then((items) => setShops(asRecords(items)))
      .catch(() => setShops([])); // directory failure never blocks the form
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const set = (key: keyof ShopForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    if (
      nameError(form.shopName, true, 'Shop name') ||
      ifscError(form.bankIfsc) ||
      bankAccountError(form.bankAccountNumber)
    )
      return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await agriMarketSeller.saveShop({
        ...form,
        documentIds: form.documentIds.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setNotice('Shop profile saved.');
      loadShops();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
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
              {form.shopName.trim() !== '' && nameError(form.shopName, true, 'Shop name') && (
                <span className="block mt-1 text-[11px] font-bold text-rose-600">{nameError(form.shopName, true, 'Shop name')}</span>
              )}
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">Bank name</span>
              <input className={field} value={form.bankName} onChange={set('bankName')} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500">IFSC</span>
              <input className={field} value={form.bankIfsc} onChange={set('bankIfsc')} placeholder="SBIN0001234" />
              {ifscError(form.bankIfsc) && (
                <span className="block mt-1 text-[11px] font-bold text-rose-600">{ifscError(form.bankIfsc)}</span>
              )}
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[11px] font-bold text-slate-500">Bank account number</span>
              <input className={field} value={form.bankAccountNumber} onChange={set('bankAccountNumber')} />
              {bankAccountError(form.bankAccountNumber) && (
                <span className="block mt-1 text-[11px] font-bold text-rose-600">{bankAccountError(form.bankAccountNumber)}</span>
              )}
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
          disabled={
            saving ||
            loading ||
            !!nameError(form.shopName, true, 'Shop name') ||
            !!ifscError(form.bankIfsc) ||
            !!bankAccountError(form.bankAccountNumber)
          }
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Shop Profile'}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
          <Store className="w-4 h-4 text-emerald-600" />
          Added seller profiles{shops !== null ? ` (${shops.length})` : ''}
        </p>
        {shops === null ? (
          <p className="text-xs text-slate-400 animate-pulse">Loading…</p>
        ) : shops.length === 0 ? (
          <p className="text-xs text-slate-400">No seller profiles added yet.</p>
        ) : (
          <div className="space-y-2">
            {shops.map((shop) => {
              const mine = !!user && pickStr(shop, 'ownerUid') === user.id;
              return (
                <div
                  key={pickStr(shop, 'ownerUid')}
                  className={`rounded-2xl border p-4 space-y-1.5 ${
                    mine ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-xs text-slate-900 truncate">{pickStr(shop, 'shopName')}</p>
                    {mine && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                        Your shop
                      </span>
                    )}
                  </div>
                  {pickStr(shop, 'sellerName') && (
                    <p className="text-[11px] text-slate-500">{pickStr(shop, 'sellerName')}</p>
                  )}
                  {pickStr(shop, 'deliveryArea') && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      Delivers in {pickStr(shop, 'deliveryArea')}
                    </p>
                  )}
                  {pickStr(shop, 'pickupAddress') && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {pickStr(shop, 'pickupAddress')}
                    </p>
                  )}
                  {pickStr(shop, 'createdAt') && (
                    <p className="text-[10px] text-slate-400">Added {pickStr(shop, 'createdAt').slice(0, 10)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
