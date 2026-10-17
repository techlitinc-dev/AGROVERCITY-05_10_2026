import React, { useCallback, useEffect, useState } from 'react';
import { BrainCircuit, Bell, Plus, Trash2, RefreshCcw, TrendingUp, CloudSun } from 'lucide-react';
import { directBuyer, intelligence, priceAlerts, mandi, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { MandiPrice } from '../../types';
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

/** Buyer market intel: procurement analytics, AI intelligence, price alerts and mandi outlook. */
export const BuyerIntelPage: React.FC = () => {
  const [data, setData] = useState<Rec>({});
  const [intel, setIntel] = useState<Rec>({});
  const [alerts, setAlerts] = useState<Rec[]>([]);
  const [prices, setPrices] = useState<MandiPrice[]>([]);
  const [forecast, setForecast] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, i, al, p, f] = await Promise.all([
        directBuyer.analytics().catch(() => ({})),
        intelligence.feed().catch(() => ({})),
        priceAlerts.list().catch(() => [] as unknown[]),
        mandi.prices().catch(() => [] as MandiPrice[]),
        mandi.forecast().catch(() => ({})),
      ]);
      setData(rec(a));
      setIntel(rec(i));
      setAlerts((al as unknown[]).map(rec));
      setPrices(p);
      setForecast(rec(f));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [alertModal, setAlertModal] = useState(false);
  const [alertCrop, setAlertCrop] = useState('Soybean');
  const [alertPrice, setAlertPrice] = useState(4800);
  const [alertAbove, setAlertAbove] = useState(false);

  const monthly = arr(data.monthlySpend ?? data.monthlyPurchases).map(rec);
  const maxMonthly = Math.max(1, ...monthly.map((m) => num(m.amount ?? m.spend)));
  const topCrops = arr(data.topCrops).map(rec);
  const intelCards = arr(intel.cards ?? intel.items ?? intel.feed).map(rec);
  const forecastRows = arr(forecast.commodities ?? forecast.rows ?? forecast.items).map(rec);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BrainCircuit className="w-7 h-7 text-emerald-600" />
            Market Intelligence Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Procurement analytics, AI intelligence, mandi outlook and price alerts for sourcing decisions
          </p>
        </div>
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {loading && <LoadingBlock />}

      {!loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Procured (12M)', value: formatCurrency(num(data.totalSpend ?? data.totalPurchases)), tone: 'text-emerald-800' },
              { label: 'Active Farmers', value: String(num(data.farmersCount ?? data.activeFarmers)), tone: 'text-slate-900' },
              { label: 'Purchases', value: String(num(data.purchasesCount)), tone: 'text-sky-700' },
              { label: 'Avg Savings vs Mandi', value: formatCurrency(num(data.avgSavingsVsMandi)), tone: 'text-amber-700' },
            ].map((k) => (
              <div key={k.label} className={`${cardCls} p-5`}>
                <span className="text-[10px] uppercase font-bold text-slate-400">{k.label}</span>
                <p className={`text-xl font-black mt-1 ${k.tone}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              {/* monthly spend */}
              <div className={`${cardCls} p-6 space-y-4`}>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sky-600" /> Monthly Procurement Spend
                </h3>
                {monthly.length === 0 ? (
                  <EmptyState label="No procurement history yet" />
                ) : (
                  <div className="flex items-end gap-1.5 h-40">
                    {monthly.map((m) => (
                      <div key={str(m.month)} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div
                          className="w-full bg-sky-500 hover:bg-sky-600 rounded-t-lg transition-all"
                          style={{ height: `${Math.max(3, (num(m.amount ?? m.spend) / maxMonthly) * 100)}%` }}
                          title={`${str(m.month)}: ${formatCurrency(num(m.amount ?? m.spend))}`}
                        />
                        <span className="text-[9px] text-slate-400 font-bold truncate w-full text-center">{str(m.month).slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* top crops + forecast */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`${cardCls} p-5 space-y-3`}>
                  <h3 className="font-bold text-sm text-slate-900">Top Sourced Crops</h3>
                  {topCrops.length === 0 ? (
                    <EmptyState label="No crop data yet" />
                  ) : (
                    topCrops.map((c) => (
                      <div key={str(c.crop)} className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800">{str(c.crop)}</span>
                        <span className="font-black text-emerald-800">{formatCurrency(num(c.amount ?? c.spend))}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className={`${cardCls} p-5 space-y-3`}>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <CloudSun className="w-4 h-4 text-amber-600" /> Price Forecast
                  </h3>
                  {forecastRows.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      {str(forecast.summary, 'No forecast available for your sourcing crops yet.')}
                    </p>
                  ) : (
                    forecastRows.slice(0, 5).map((f, i) => (
                      <div key={i} className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800">{str(f.crop ?? f.commodity)}</span>
                        <span className="font-bold text-slate-700">
                          {formatCurrency(num(f.expectedPrice ?? f.price))}
                          <span className={`ml-1.5 ${num(f.changePct) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {num(f.changePct) >= 0 ? '▲' : '▼'} {Math.abs(num(f.changePct)).toFixed(1)}%
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* mandi board */}
              <div className={`${cardCls} overflow-hidden`}>
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-sm text-slate-900">Mandi Board ({prices.length})</h3>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0">
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                        <th className="py-2.5 px-4">Commodity · Mandi</th>
                        <th className="py-2.5 px-3">Modal</th>
                        <th className="py-2.5 px-3">Trend</th>
                        <th className="py-2.5 px-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {prices.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {p.commodity}
                            <span className="text-[10px] text-slate-400 block font-normal">{p.mandi}</span>
                          </td>
                          <td className="py-2.5 px-3 font-black text-emerald-800">{formatCurrency(p.modalPrice)}</td>
                          <td className={`py-2.5 px-3 font-bold ${p.trendPercentage >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {p.trendPercentage >= 0 ? '▲' : '▼'} {Math.abs(p.trendPercentage).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">{formatDate(p.priceDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {/* intelligence */}
              <div className={`${cardCls} p-5 space-y-3`}>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-purple-600" /> AI Sourcing Intelligence
                </h3>
                {intelCards.length === 0 ? (
                  <EmptyState label="No intelligence items right now" />
                ) : (
                  intelCards.map((c, i) => (
                    <div key={i} className="p-3 bg-purple-50 border border-purple-100 rounded-2xl text-xs text-purple-900 space-y-1">
                      <p className="font-bold">{str(c.title, 'Insight')}</p>
                      {c.body ? <p className="text-purple-700">{str(c.body)}</p> : null}
                    </div>
                  ))
                )}
              </div>

              {/* price alerts */}
              <div className={`${cardCls} p-5 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-600" /> Price Alerts ({alerts.length})
                  </h3>
                  <button onClick={() => setAlertModal(true)} className={primaryBtnCls}>
                    <Plus className="w-3.5 h-3.5 inline mr-1" /> New
                  </button>
                </div>
                {alerts.length === 0 ? (
                  <EmptyState label="No price alerts set" />
                ) : (
                  alerts.map((a) => (
                    <div key={str(a.id)} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                      <span className="font-semibold text-slate-800">
                        {str(a.crop)} {num(a.above, 1) ? 'above' : 'below'} ₹{num(a.targetPrice)}
                      </span>
                      <button
                        onClick={() => {
                          setActionError(null);
                          priceAlerts.remove(str(a.id)).then(() => load()).catch((err) => setActionError(apiErrorMessage(err)));
                        }}
                        className="text-rose-600 hover:text-rose-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <ModalSheet isOpen={alertModal} onClose={() => setAlertModal(false)} title="New Price Alert" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActionError(null);
            priceAlerts
              .create({ crop: alertCrop, targetPrice: alertPrice, above: alertAbove })
              .then(() => {
                setAlertModal(false);
                return load();
              })
              .catch((err) => setActionError(apiErrorMessage(err)));
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Crop</label>
            <input className={inputCls} value={alertCrop} onChange={(e) => setAlertCrop(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Target Price (₹/q)</label>
            <input type="number" className={inputCls} value={alertPrice} onChange={(e) => setAlertPrice(Number(e.target.value))} required />
          </div>
          <div>
            <label className={labelCls}>Trigger</label>
            <select className={inputCls} value={alertAbove ? 'above' : 'below'} onChange={(e) => setAlertAbove(e.target.value === 'above')}>
              <option value="below">Alert when price falls below target</option>
              <option value="above">Alert when price rises above target</option>
            </select>
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Create Alert</button>
        </form>
      </ModalSheet>
    </div>
  );
};
