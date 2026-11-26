import React, { useCallback, useEffect, useState } from 'react';
import { BadgePercent, Pencil, Tag } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller, put } from '../../lib/api';

interface Coupon {
  id: string;
  code: string;
  discountPaisa?: number;
  percentOff?: number;
  validUntil?: string;
  usedCount?: number;
  active?: boolean;
}

interface ProductOffer {
  id: string;
  title?: string;
  category?: string;
  mrp?: number;
  discountedPrice?: number;
  stock?: number;
  status?: string;
  units?: string;
}

function hasOffer(p: ProductOffer): boolean {
  return (p.discountedPrice ?? 0) > 0 && (p.discountedPrice ?? 0) < (p.mrp ?? 0);
}

function pctOff(p: ProductOffer): number {
  const mrp = p.mrp ?? 0;
  if (mrp <= 0) return 0;
  return Math.round((1 - (p.discountedPrice ?? 0) / mrp) * 1000) / 10;
}

export const CouponsView: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', percentOff: '10', validUntil: '' });
  const [busy, setBusy] = useState(false);
  const [editFor, setEditFor] = useState<ProductOffer | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editPct, setEditPct] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCoupons((await agriMarketSeller.coupons()) as unknown as Coupon[]);
      setProducts((await agriMarketSeller.products()) as unknown as ProductOffer[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!form.code || !form.validUntil) return;
    setBusy(true);
    setError(null);
    try {
      await agriMarketSeller.createCoupon({
        code: form.code,
        percentOff: Number(form.percentOff) || 0,
        validUntil: form.validUntil,
      });
      setNotice('Coupon created.');
      setForm({ code: '', percentOff: '10', validUntil: '' });
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openOfferEditor = (p: ProductOffer) => {
    setEditFor(p);
    if (hasOffer(p)) {
      setEditPrice(String(p.discountedPrice));
      setEditPct(String(pctOff(p)));
    } else {
      setEditPrice('');
      setEditPct('');
    }
    setNotice(null);
  };

  const onPriceChange = (value: string) => {
    setEditPrice(value);
    const mrp = editFor?.mrp ?? 0;
    const price = Number(value);
    if (value !== '' && mrp > 0 && Number.isFinite(price)) {
      setEditPct(String(Math.max(0, Math.round((1 - price / mrp) * 1000) / 10)));
    } else {
      setEditPct('');
    }
  };

  const onPctChange = (value: string) => {
    setEditPct(value);
    const mrp = editFor?.mrp ?? 0;
    const pct = Number(value);
    if (value !== '' && mrp > 0 && Number.isFinite(pct)) {
      setEditPrice(String(Math.round(mrp * (1 - pct / 100))));
    } else {
      setEditPrice('');
    }
  };

  const priceNum = Number(editPrice);
  const pctNum = Number(editPct);
  const editInvalid =
    !editFor ||
    editPrice === '' ||
    !Number.isFinite(priceNum) ||
    priceNum < 1 ||
    priceNum > (editFor.mrp ?? 0) ||
    (editPct !== '' && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum >= 100));

  const saveOffer = async () => {
    if (!editFor || editInvalid) return;
    setEditBusy(true);
    setError(null);
    try {
      await put<unknown>(`/my-products/${editFor.id}`, { discountedPrice: Math.round(priceNum) });
      setNotice(`Offer saved for ${editFor.title}.`);
      setEditFor(null);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setEditBusy(false);
    }
  };

  const removeOffer = async (p: ProductOffer) => {
    setEditBusy(true);
    setError(null);
    try {
      await put<unknown>(`/my-products/${p.id}`, { discountedPrice: Math.round(p.mrp ?? 0) });
      setNotice(`Offer removed for ${p.title}.`);
      setEditFor(null);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setEditBusy(false);
    }
  };

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

  return (
    <div className="space-y-4">
      {error && <p className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</p>}
      {notice && <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800">{notice}</p>}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-black text-slate-900 mb-3 flex items-center gap-1.5">
          <BadgePercent className="w-4 h-4 text-emerald-600" /> Coupon codes
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <input className={field} placeholder="CODE" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          <input className={field} type="number" placeholder="% off" value={form.percentOff} onChange={(e) => setForm((f) => ({ ...f, percentOff: e.target.value }))} />
          <input className={field} type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
        </div>
        <button
          onClick={() => void create()}
          disabled={busy || !form.code || !form.validUntil}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
        >
          Create coupon
        </button>

        <div className="mt-4 space-y-1.5">
          {coupons.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800">
                {c.code}
                <span className="ml-2 font-semibold text-slate-400">
                  {c.percentOff ? `${c.percentOff}% off` : `₹${((c.discountPaisa ?? 0) / 100).toFixed(0)} off`} · valid till {c.validUntil}
                </span>
              </span>
              <span className={c.active ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                {c.usedCount ?? 0} uses {c.active ? '· active' : '· inactive'}
              </span>
            </div>
          ))}
          {coupons.length === 0 && <p className="text-[11px] text-slate-400">No coupons yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-black text-slate-900 mb-3 flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-emerald-600" /> Product offers — set offer price or % off
        </p>
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 truncate">{p.title}</p>
                  <p className="text-[10px] text-slate-400">
                    MRP ₹{p.mrp ?? 0} · stock {p.stock ?? 0}
                    {p.units ? ` ${p.units}` : ''}
                    {p.status ? ` · ${p.status}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasOffer(p) ? (
                    <span className="text-[11px] text-right">
                      <span className="line-through text-slate-400">₹{p.mrp}</span>{' '}
                      <span className="font-bold text-emerald-700">₹{p.discountedPrice}</span>
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700">
                        {pctOff(p)}% off
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        buyer saves ₹{((p.mrp ?? 0) - (p.discountedPrice ?? 0)).toLocaleString('en-IN')}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">No offer</span>
                  )}
                  <button
                    onClick={() => openOfferEditor(p)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-600 hover:border-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" /> {hasOffer(p) ? 'Edit offer' : 'Set offer'}
                  </button>
                </div>
              </div>

              {editFor?.id === p.id && (
                <div className="border-t border-slate-100 pt-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] font-bold text-slate-500">Offer price (₹)</span>
                      <input
                        className={field}
                        type="number"
                        min={1}
                        max={p.mrp}
                        value={editPrice}
                        onChange={(e) => onPriceChange(e.target.value)}
                        placeholder={`below ₹${p.mrp ?? 0}`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold text-slate-500">Discount (%)</span>
                      <input
                        className={field}
                        type="number"
                        min={0}
                        max={99}
                        value={editPct}
                        onChange={(e) => onPctChange(e.target.value)}
                        placeholder="e.g. 10"
                      />
                    </label>
                  </div>
                  {editPrice !== '' && priceNum > (p.mrp ?? 0) && (
                    <p className="text-[11px] font-bold text-rose-600">Offer price must not exceed MRP ₹{p.mrp}.</p>
                  )}
                  {editPrice !== '' && priceNum >= 1 && priceNum <= (p.mrp ?? 0) && (
                    <p className="text-[11px] text-slate-500">
                      Buyer pays ₹{Math.round(priceNum)} — saves ₹{((p.mrp ?? 0) - Math.round(priceNum)).toLocaleString('en-IN')} ({pctOff({ ...p, discountedPrice: priceNum })}% off).
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => void saveOffer()}
                      disabled={editBusy || editInvalid}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {editBusy ? 'Saving…' : 'Save offer'}
                    </button>
                    {hasOffer(p) && (
                      <button
                        onClick={() => void removeOffer(p)}
                        disabled={editBusy}
                        className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold disabled:opacity-50"
                      >
                        Remove offer
                      </button>
                    )}
                    <button
                      onClick={() => setEditFor(null)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {products.length === 0 && (
            <p className="text-[11px] text-slate-400">No products yet — add one in My Products to create offers.</p>
          )}
        </div>
      </div>
    </div>
  );
};
