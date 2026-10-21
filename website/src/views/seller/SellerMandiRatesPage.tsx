import React, { useCallback, useEffect, useState } from 'react';
import { Landmark, Plus, RefreshCcw } from 'lucide-react';
import { seller, mandi, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { MandiPrice } from '../../types';
import {
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  num,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

/** Seller mandi rates: post today's vyapari rate (₹/kg) against the mandi modal band. */
export const SellerMandiRatesPage: React.FC = () => {
  const [rates, setRates] = useState<Rec[]>([]);
  const [prices, setPrices] = useState<MandiPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, p] = await Promise.all([
        seller.myRates().catch(() => [] as unknown[]),
        mandi.prices().catch(() => [] as MandiPrice[]),
      ]);
      setRates((r as unknown[]).map(rec));
      setPrices(p);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [postModal, setPostModal] = useState(false);
  const [crop, setCrop] = useState('Soybean');
  const [mandiName, setMandiName] = useState('');
  const [ratePerKg, setRatePerKg] = useState(47);

  const reference = prices.find((p) => p.commodity.toLowerCase().includes(crop.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Landmark className="w-7 h-7 text-emerald-600" />
            My Mandi Rates
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Post daily vyapari rates — validated against the APMC modal price band (±25%)
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setPostModal(true)} className={primaryBtnCls}>
            <Plus className="w-4 h-4 inline mr-1" /> Post Rate
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">{notice}</div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">My Posted Rates ({rates.length})</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Status: <strong className="text-slate-600">pending</strong> = in the moderation queue ·{' '}
                <strong className="text-slate-600">approved</strong> = live for buyers ·{' '}
                <strong className="text-slate-600">rejected</strong> = repost within the ±25% band
              </p>
            </div>
            {rates.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No rates posted yet" />
              </div>
            ) : (
              rates.map((r) => (
                <div key={str(r.id)} className={`${cardCls} p-4 flex items-center justify-between gap-3`}>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {str(r.crop)} @ ₹{num(r.ratePerKg)}/kg
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {str(r.mandiName, 'APMC')} · posted {str(r.createdAt).slice(0, 10)}
                    </p>
                  </div>
                  <StatusBadge status={str(r.status, 'pending')} />
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">APMC Modal Reference ({prices.length})</h3>
            {prices.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No mandi prices available" />
              </div>
            ) : (
              <div className={`${cardCls} overflow-hidden max-h-[520px] overflow-y-auto`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0">
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-3 px-5">Commodity · Mandi</th>
                      <th className="py-3 px-3">Min–Max</th>
                      <th className="py-3 px-3 text-right">Modal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prices.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5 font-bold text-slate-900">
                          {p.commodity}
                          <span className="text-[10px] text-slate-400 block font-normal">{p.mandi}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {formatCurrency(p.minPrice)}–{formatCurrency(p.maxPrice)}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-800">{formatCurrency(p.modalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ModalSheet isOpen={postModal} onClose={() => setPostModal(false)} title="Post Today's Rate" description="Rate is checked against the ±25% fair band around the APMC modal price" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActionError(null);
            setNotice(null);
            seller
              .postRate({ crop, mandiName, ratePerKg })
              .then(() => {
                setNotice('Rate submitted for review');
                setPostModal(false);
                return load();
              })
              .catch((err) => setActionError(apiErrorMessage(err)));
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Crop</label>
            <input className={inputCls} value={crop} onChange={(e) => setCrop(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Mandi</label>
            <input className={inputCls} value={mandiName} onChange={(e) => setMandiName(e.target.value)} placeholder="e.g. Nashik APMC" required />
          </div>
          <div>
            <label className={labelCls}>Rate (₹/kg)</label>
            <input type="number" step="0.01" className={`${inputCls} font-bold text-emerald-800`} value={ratePerKg} onChange={(e) => setRatePerKg(Number(e.target.value))} required />
            {reference && (
              <p className="text-[11px] text-slate-400 mt-1">
                Modal {formatCurrency(reference.modalPrice)}/q → allowed band ₹
                {((reference.modalPrice * 0.75) / 100).toFixed(2)}–{((reference.modalPrice * 1.25) / 100).toFixed(2)}/kg
              </p>
            )}
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Submit Rate</button>
        </form>
      </ModalSheet>
    </div>
  );
};
