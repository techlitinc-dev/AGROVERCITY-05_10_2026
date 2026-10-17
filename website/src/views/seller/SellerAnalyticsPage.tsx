import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Plus, Bell, Trash2, RefreshCcw, Brain, Users } from 'lucide-react';
import { analytics, intelligence, priceAlerts, seller, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
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

/** Seller analytics: storefront analytics, AI intelligence feed, price alerts, buyer directory. */
export const SellerAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<Rec>({});
  const [intel, setIntel] = useState<Rec>({});
  const [alerts, setAlerts] = useState<Rec[]>([]);
  const [directory, setDirectory] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, i, al, d] = await Promise.all([
        analytics.seller().catch(() => ({})),
        intelligence.feed().catch(() => ({})),
        priceAlerts.list().catch(() => [] as unknown[]),
        seller.buyerDirectory().catch(() => [] as unknown[]),
      ]);
      setData(rec(a));
      setIntel(rec(i));
      setAlerts((al as unknown[]).map(rec));
      setDirectory((d as unknown[]).map(rec));
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
  const [alertPrice, setAlertPrice] = useState(5000);
  const [alertAbove, setAlertAbove] = useState(false);

  const monthly = arr(data.monthlyRevenue).map(rec);
  const maxMonthly = Math.max(1, ...monthly.map((m) => num(m.amount)));
  const topProducts = arr(data.topProducts).map(rec);
  const categories = arr(data.categoryBreakdown).map(rec);
  const lowStock = arr(data.lowStock).map(rec);
  const intelCards = arr(intel.cards ?? intel.items ?? intel.feed).map(rec);
  const intelTips = arr(intel.tips ?? intel.insights).map(rec);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-emerald-600" />
            Seller Analytics & Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Storefront performance, AI-generated trade intelligence, mandi price alerts and buyer network
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
              { label: 'Revenue (12M)', value: formatCurrency(num(data.revenue)), tone: 'text-emerald-800' },
              { label: 'Orders', value: String(num(data.ordersCount)), tone: 'text-slate-900' },
              { label: 'Avg Order Value', value: formatCurrency(num(data.aov)), tone: 'text-sky-700' },
              { label: 'Return Rate', value: `${(num(data.returnRate) * 100).toFixed(1)}%`, tone: 'text-amber-700' },
            ].map((k) => (
              <div key={k.label} className={`${cardCls} p-5`}>
                <span className="text-[10px] uppercase font-bold text-slate-400">{k.label}</span>
                <p className={`text-xl font-black mt-1 ${k.tone}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              {/* monthly revenue bar chart (CSS bars) */}
              <div className={`${cardCls} p-6 space-y-4`}>
                <h3 className="font-bold text-sm text-slate-900">Monthly Revenue — Last 12 Months</h3>
                {monthly.length === 0 ? (
                  <EmptyState label="No revenue history yet" />
                ) : (
                  <div className="flex items-end gap-1.5 h-40">
                    {monthly.map((m) => (
                      <div key={str(m.month)} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div
                          className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-t-lg transition-all"
                          style={{ height: `${Math.max(3, (num(m.amount) / maxMonthly) * 100)}%` }}
                          title={`${str(m.month)}: ${formatCurrency(num(m.amount))}`}
                        />
                        <span className="text-[9px] text-slate-400 font-bold truncate w-full text-center">
                          {str(m.month).slice(5)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* top products + categories */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`${cardCls} p-5 space-y-3`}>
                  <h3 className="font-bold text-sm text-slate-900">Top Products</h3>
                  {topProducts.length === 0 ? (
                    <EmptyState label="No sales yet" />
                  ) : (
                    topProducts.map((p) => (
                      <div key={str(p.productId)} className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800 truncate">{str(p.title, 'Product')}</span>
                        <span className="font-black text-emerald-800">{formatCurrency(num(p.amount))}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className={`${cardCls} p-5 space-y-3`}>
                  <h3 className="font-bold text-sm text-slate-900">Category Breakdown</h3>
                  {categories.length === 0 ? (
                    <EmptyState label="No category data" />
                  ) : (
                    categories.map((c) => (
                      <div key={str(c.category)} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-700">{str(c.category)}</span>
                          <span className="font-bold text-slate-900">{formatCurrency(num(c.revenue))}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full"
                            style={{ width: `${(num(c.revenue) / Math.max(1, num(categories[0]?.revenue))) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {lowStock.length > 0 && (
                <div className={`${cardCls} p-5 space-y-2`}>
                  <h3 className="font-bold text-sm text-slate-900">Low Stock Alerts</h3>
                  {lowStock.map((p) => (
                    <p key={str(p.productId)} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      {str(p.title, 'Product')} — only {num(p.stock)} left
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-4">
              {/* intelligence */}
              <div className={`${cardCls} p-5 space-y-3`}>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" /> AI Trade Intelligence
                </h3>
                {intelCards.length === 0 && intelTips.length === 0 ? (
                  <EmptyState label="No intelligence items right now" />
                ) : (
                  <>
                    {intelCards.map((c, i) => (
                      <div key={i} className="p-3 bg-purple-50 border border-purple-100 rounded-2xl text-xs text-purple-900 space-y-1">
                        <p className="font-bold">{str(c.title, 'Insight')}</p>
                        {c.body ? <p className="text-purple-700">{str(c.body)}</p> : null}
                      </div>
                    ))}
                    {intelTips.map((t, i) => (
                      <p key={`tip-${i}`} className="text-xs text-slate-600 border-l-2 border-purple-300 pl-3">
                        {str(t.text ?? t, 'Tip')}
                      </p>
                    ))}
                  </>
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
                          priceAlerts
                            .remove(str(a.id))
                            .then(() => load())
                            .catch((err) => setActionError(apiErrorMessage(err)));
                        }}
                        className="text-rose-600 hover:text-rose-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* buyer directory */}
              <div className={`${cardCls} p-5 space-y-3`}>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600" /> Buyer Directory ({directory.length})
                </h3>
                {directory.length === 0 ? (
                  <EmptyState label="No buyers in your network yet" />
                ) : (
                  directory.slice(0, 8).map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-xl">
                      <div>
                        <p className="font-bold text-slate-800">{str(b.name || b.buyerName, 'Buyer')}</p>
                        <p className="text-[10px] text-slate-400">{str(b.companyName || b.district, '')}</p>
                      </div>
                      {b.totalPurchases != null && (
                        <span className="font-bold text-emerald-700">{formatCurrency(num(b.totalPurchases))}</span>
                      )}
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
