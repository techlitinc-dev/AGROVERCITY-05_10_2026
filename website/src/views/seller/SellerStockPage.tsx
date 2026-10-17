import React, { useCallback, useEffect, useState } from 'react';
import { Package, Plus, SlidersHorizontal, ShoppingBag, RefreshCcw, Trash2 } from 'lucide-react';
import { seller, purchases, apiClient, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import {
  arr,
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

/**
 * Seller stock room: by-crop position computed from /seller/stock entries,
 * manual stock entry, intake from a purchase, adjustments, and B2B resale
 * listings on the exchange.
 */
export const SellerStockPage: React.FC = () => {
  const [entries, setEntries] = useState<Rec[]>([]);
  const [listings, setListings] = useState<Rec[]>([]);
  const [purchasesMine, setPurchasesMine] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stock, rel, pur] = await Promise.all([
        seller.stock().catch(() => [] as unknown[]),
        seller.myResaleListings().catch(() => [] as unknown[]),
        purchases.mine({ role: 'buyer' }).catch(() => [] as unknown[]),
      ]);
      setEntries((stock as unknown[]).map(rec));
      setListings((rel as unknown[]).map(rec));
      setPurchasesMine((pur as unknown[]).map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, successMsg?: string) => {
      setActionError(null);
      setNotice(null);
      try {
        await fn();
        if (successMsg) setNotice(successMsg);
        await load();
      } catch (err) {
        setActionError(apiErrorMessage(err));
      }
    },
    [load]
  );

  // by-crop aggregation (mirrors backend summary)
  const byCrop = new Map<string, Rec>();
  let totalValue = 0;
  for (const e of entries) {
    const key = `${str(e.crop, 'Unknown')}·${str(e.grade, '-')}`;
    const row = byCrop.get(key) ?? {
      crop: str(e.crop, 'Unknown'),
      grade: str(e.grade, '-'),
      quantityQuintals: 0,
      availableQuintals: 0,
      value: 0,
    };
    const avail = num(e.availableQuintals);
    row.quantityQuintals = num(row.quantityQuintals) + num(e.quantityQuintals);
    row.availableQuintals = num(row.availableQuintals) + avail;
    row.value = num(row.value) + avail * num(e.ratePerQuintal);
    totalValue += avail * num(e.ratePerQuintal);
    byCrop.set(key, row);
  }
  const cropRows = [...byCrop.values()].sort((a, b) => num(b.availableQuintals) - num(a.availableQuintals));

  // --- modals ---
  const [addModal, setAddModal] = useState(false);
  const [sCrop, setSCrop] = useState('Soybean');
  const [sQty, setSQty] = useState(10);
  const [sRate, setSRate] = useState(4700);
  const [sGrade, setSGrade] = useState('A');
  const [sLocation, setSLocation] = useState('');

  const [adjustTarget, setAdjustTarget] = useState<Rec | null>(null);
  const [adjDelta, setAdjDelta] = useState(1);
  const [adjReason, setAdjReason] = useState('');

  const [intakeModal, setIntakeModal] = useState(false);
  const [intakePurchase, setIntakePurchase] = useState('');
  const [intakeRate, setIntakeRate] = useState(4700);

  const [listingModal, setListingModal] = useState(false);
  const [listingStock, setListingStock] = useState('');
  const [listingQty, setListingQty] = useState(5);
  const [listingRate, setListingRate] = useState(5000);

  const completedPurchases = purchasesMine.filter((p) => str(p.status) === 'completed');
  const activeEntries = entries.filter((e) => str(e.status, 'active') !== 'exhausted');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-emerald-600" />
            Stock Room & Resale Exchange
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track procured produce by crop, intake from purchases, adjust for shrinkage, list surplus for resale
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setAddModal(true)} className={primaryBtnCls}>
            <Plus className="w-4 h-4 inline mr-1" /> Add Stock
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
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Stock Lines', value: String(entries.length), tone: 'text-slate-900' },
              { label: 'Available (q)', value: cropRows.reduce((s, r) => s + num(r.availableQuintals), 0).toFixed(2), tone: 'text-sky-700' },
              { label: 'Stock Value', value: formatCurrency(Math.round(totalValue)), tone: 'text-emerald-800' },
              { label: 'Open Resale Listings', value: String(listings.filter((l) => str(l.status) === 'open').length), tone: 'text-amber-700' },
            ].map((k) => (
              <div key={k.label} className={`${cardCls} p-5`}>
                <span className="text-[10px] uppercase font-bold text-slate-400">{k.label}</span>
                <p className={`text-2xl font-black mt-1 ${k.tone}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* by-crop table */}
            <div className="lg:col-span-3 space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Position by Crop ({cropRows.length})</h3>
              {cropRows.length === 0 ? (
                <div className={cardCls}>
                  <EmptyState label="No stock recorded yet" />
                </div>
              ) : (
                <div className={`${cardCls} overflow-hidden`}>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                        <th className="py-3 px-5">Crop · Grade</th>
                        <th className="py-3 px-3">On Hand (q)</th>
                        <th className="py-3 px-3">Available (q)</th>
                        <th className="py-3 px-3">Avg Rate</th>
                        <th className="py-3 px-5 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cropRows.map((r) => (
                        <tr key={`${r.crop}-${r.grade}`} className="hover:bg-slate-50/60">
                          <td className="py-3 px-5 font-bold text-slate-900">
                            {str(r.crop)}
                            <span className="text-[10px] text-slate-400 block font-normal">Grade {str(r.grade, '-')}</span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700">{num(r.quantityQuintals).toFixed(2)}</td>
                          <td className="py-3 px-3 font-semibold text-sky-700">{num(r.availableQuintals).toFixed(2)}</td>
                          <td className="py-3 px-3 font-semibold text-slate-700">
                            {num(r.availableQuintals) > 0 ? formatCurrency(num(r.value) / num(r.availableQuintals)) : '—'}
                          </td>
                          <td className="py-3 px-5 text-right font-black text-emerald-800">{formatCurrency(num(r.value))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* stock lines with actions */}
              <h3 className="font-bold text-sm text-slate-900 pt-2">Stock Lines ({entries.length})</h3>
              {entries.length === 0 ? (
                <div className={cardCls}>
                  <EmptyState label="No stock lines" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {entries.map((e) => (
                    <div key={str(e.id)} className={`${cardCls} p-4 flex flex-wrap items-center justify-between gap-3`}>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {str(e.crop)} · {formatWeight(num(e.quantityQuintals))}
                          <span className="ml-2"><StatusBadge status={str(e.status, 'active')} /></span>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {str(e.id)} · available {num(e.availableQuintals).toFixed(2)} q @ {formatCurrency(num(e.ratePerQuintal))}/q
                          {e.storedAt ? ` · stored at ${str(e.storedAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setAdjustTarget(e); setAdjDelta(1); setAdjReason(''); }} className={ghostBtnCls}>
                          <SlidersHorizontal className="w-3.5 h-3.5 inline mr-1" /> Adjust
                        </button>
                        <button
                          onClick={() => {
                            setListingStock(str(e.id));
                            setListingQty(Math.max(1, Math.floor(num(e.availableQuintals))));
                            setListingRate(num(e.ratePerQuintal));
                            setListingModal(true);
                          }}
                          className={primaryBtnCls}
                        >
                          <ShoppingBag className="w-3.5 h-3.5 inline mr-1" /> Resale List
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* resale listings + intake */}
            <div className="lg:col-span-2 space-y-4">
              <div className={`${cardCls} p-5 space-y-3`}>
                <h3 className="font-bold text-sm text-slate-900">Intake from Purchase</h3>
                <p className="text-[11px] text-slate-400">
                  Move a completed produce purchase directly into stock (idempotent, requires purchase with a lot source).
                </p>
                {completedPurchases.length === 0 ? (
                  <EmptyState label="No completed purchases available for intake" />
                ) : (
                  <button onClick={() => setIntakeModal(true)} className={`${primaryBtnCls} w-full`}>
                    Select Purchase to Intake…
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900">My Resale Listings ({listings.length})</h3>
                {listings.length === 0 ? (
                  <div className={cardCls}>
                    <EmptyState label="No resale listings yet" />
                  </div>
                ) : (
                  listings.map((l) => (
                    <div key={str(l.id)} className={`${cardCls} p-4 space-y-2`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900">{str(l.crop)} · {formatWeight(num(l.quantityQuintals))}</p>
                        <StatusBadge status={str(l.status, 'open')} />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Listed @ {formatCurrency(num(l.askingRatePerQuintal, num(l.ratePerQuintal)))}/q · remaining {num(l.remainingQuintals).toFixed(2)} q
                      </p>
                      {str(l.status) !== 'sold' && (
                        <button onClick={() => void act(() => seller.removeResaleListing(str(l.id)), 'Listing removed')} className={ghostBtnCls}>
                          <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Delist
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add stock */}
      <ModalSheet isOpen={addModal} onClose={() => setAddModal(false)} title="Add Stock Manually" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              () => seller.addStock({ crop: sCrop, quantityQuintals: sQty, ratePerQuintal: sRate, grade: sGrade, location: sLocation || undefined }),
              'Stock added'
            );
            setAddModal(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Crop</label>
              <input className={inputCls} value={sCrop} onChange={(e) => setSCrop(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Grade</label>
              <select className={inputCls} value={sGrade} onChange={(e) => setSGrade(e.target.value)}>
                <option>A</option>
                <option>B</option>
                <option>C</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Quantity (q)</label>
              <input type="number" className={inputCls} value={sQty} onChange={(e) => setSQty(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Rate (₹/q)</label>
              <input type="number" className={inputCls} value={sRate} onChange={(e) => setSRate(Number(e.target.value))} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Storage Location</label>
            <input className={inputCls} value={sLocation} onChange={(e) => setSLocation(e.target.value)} />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Add Stock</button>
        </form>
      </ModalSheet>

      {/* Adjust */}
      <ModalSheet isOpen={Boolean(adjustTarget)} onClose={() => setAdjustTarget(null)} title="Adjust Stock" description={adjustTarget ? `${str(adjustTarget.crop)} — positive adds, negative removes (shrinkage/spoilage)` : undefined} maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!adjustTarget) return;
            void act(() => seller.adjustStock(str(adjustTarget.id), { deltaQuintals: adjDelta, reason: adjReason }), 'Stock adjusted');
            setAdjustTarget(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Delta (q)</label>
            <input type="number" step="0.001" className={inputCls} value={adjDelta} onChange={(e) => setAdjDelta(Number(e.target.value))} required />
          </div>
          <div>
            <label className={labelCls}>Reason</label>
            <input className={inputCls} value={adjReason} onChange={(e) => setAdjReason(e.target.value)} required />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Apply Adjustment</button>
        </form>
      </ModalSheet>

      {/* Intake from purchase (needs Idempotency-Key header — apiClient direct) */}
      <ModalSheet isOpen={intakeModal} onClose={() => setIntakeModal(false)} title="Intake from Purchase" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await apiClient.post(
                `/seller/stock/from-purchase/${intakePurchase}`,
                { ratePerQuintal: intakeRate },
                { headers: { 'Idempotency-Key': `web-intake-${Date.now()}` } }
              );
            }, 'Purchase intake added to stock');
            setIntakeModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Completed Purchase</label>
            <select className={inputCls} value={intakePurchase} onChange={(e) => setIntakePurchase(e.target.value)} required>
              <option value="">Select purchase…</option>
              {completedPurchases.map((p) => (
                <option key={str(p.id)} value={str(p.id)}>
                  {str(p.crop)} · {formatWeight(num(p.quantityQuintal))} · #{str(p.id)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Valuation Rate (₹/q)</label>
            <input type="number" className={inputCls} value={intakeRate} onChange={(e) => setIntakeRate(Number(e.target.value))} required />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Intake to Stock</button>
        </form>
      </ModalSheet>

      {/* Resale listing (needs Idempotency-Key header — apiClient direct) */}
      <ModalSheet isOpen={listingModal} onClose={() => setListingModal(false)} title="Create Resale Listing" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await apiClient.post(
                '/resale-listings',
                { stockId: listingStock, quantityQuintals: listingQty, askingRatePerQuintal: listingRate },
                { headers: { 'Idempotency-Key': `web-listing-${Date.now()}` } }
              );
            }, 'Resale listing published');
            setListingModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Stock Line</label>
            <select className={inputCls} value={listingStock} onChange={(e) => setListingStock(e.target.value)} required>
              <option value="">Select stock…</option>
              {activeEntries.map((en) => (
                <option key={str(en.id)} value={str(en.id)}>
                  {str(en.crop)} · avail {num(en.availableQuintals).toFixed(2)} q
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Quantity (q)</label>
              <input type="number" className={inputCls} value={listingQty} onChange={(e) => setListingQty(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Asking Rate (₹/q)</label>
              <input type="number" className={inputCls} value={listingRate} onChange={(e) => setListingRate(Number(e.target.value))} required />
            </div>
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Publish Listing</button>
        </form>
      </ModalSheet>
    </div>
  );
};
