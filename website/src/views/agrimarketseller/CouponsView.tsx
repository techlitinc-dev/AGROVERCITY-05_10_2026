import React, { useCallback, useEffect, useState } from 'react';
import { BadgePercent, Tag } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';

interface Coupon {
  id: string;
  code: string;
  discountPaisa?: number;
  percentOff?: number;
  validUntil?: string;
  usedCount?: number;
  active?: boolean;
}

interface Offer {
  productId: string;
  title: string;
  mrpPaisa: number;
  pricePaisa: number;
  stock?: number;
}

export const CouponsView: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', percentOff: '10', validUntil: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCoupons((await agriMarketSeller.coupons()) as unknown as Coupon[]);
      setOffers((await agriMarketSeller.offers()) as unknown as Offer[]);
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
          <Tag className="w-4 h-4 text-emerald-600" /> Active offers (price below MRP)
        </p>
        <div className="space-y-1.5">
          {offers.map((o) => (
            <div key={o.productId} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800">{o.title}</span>
              <span className="text-slate-500">
                <span className="line-through">₹{(o.mrpPaisa / 100).toFixed(0)}</span>{' '}
                <span className="font-bold text-emerald-700">₹{(o.pricePaisa / 100).toFixed(0)}</span>
              </span>
            </div>
          ))}
          {offers.length === 0 && <p className="text-[11px] text-slate-400">No discounted products right now.</p>}
        </div>
      </div>
    </div>
  );
};
