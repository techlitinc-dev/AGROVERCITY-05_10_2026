import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, RefreshCcw, Users, FileText, Percent, Download } from 'lucide-react';
import { directBuyer, purchases, apiClient, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  LoadingBlock,
  num,
  rec,
  str,
  type Rec,
} from './shared';

/** Buyer analytics: procurement spend, supplier roster, monthly statements, commission structure. */
export const BuyerAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<Rec>({});
  const [statements, setStatements] = useState<Rec[]>([]);
  const [commission, setCommission] = useState<Rec>({});
  const [purchaseList, setPurchaseList] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, s, c, p] = await Promise.all([
        directBuyer.analytics().catch(() => ({})),
        directBuyer.statements().catch(() => ({})),
        directBuyer.commissionStructure().catch(() => ({})),
        purchases.mine({ role: 'buyer' }).catch(() => [] as unknown[]),
      ]);
      const st = rec(s);
      setData(rec(a));
      setStatements(arr(st.purchases ?? st.lines ?? st.statements).map(rec));
      setCommission(rec(c));
      setPurchaseList((p as unknown[]).map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const monthly = arr(data.monthly ?? data.monthlySpend).map(rec);
  const maxMonthly = Math.max(1, ...monthly.map((m) => num(m.spend ?? m.amount)));
  const topCrops = arr(data.cropBreakdown ?? data.topCrops).map(rec);
  const topSuppliers = arr(data.topSuppliers).map(rec);
  const vsMandi = arr(data.priceVsMandi ?? data.savingsVsMandi).map(rec);
  const grossSpend = num(data.totalSpend, statements.reduce((s, x) => s + num(x.finalAmount), 0));
  const totalVolume = monthly.reduce((s, m) => s + num(m.volume), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-emerald-600" />
            Buyer Analytics & Statements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Spend analytics, supplier performance, commission structure and monthly statements
          </p>
        </div>
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <ErrorBanner message={error} />
      {loading && <LoadingBlock />}

      {!loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Gross Spend', value: formatCurrency(grossSpend), tone: 'text-emerald-800' },
              { label: 'Volume Procured', value: `${totalVolume.toFixed(1)} q`, tone: 'text-sky-700' },
              { label: 'Suppliers', value: String(topSuppliers.length), tone: 'text-slate-900' },
              { label: 'Purchases', value: String(purchaseList.length), tone: 'text-amber-700' },
            ].map((k) => (
              <div key={k.label} className={`${cardCls} p-5`}>
                <span className="text-[10px] uppercase font-bold text-slate-400">{k.label}</span>
                <p className={`text-xl font-black mt-1 ${k.tone}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <div className={`${cardCls} p-6 space-y-4`}>
                <h3 className="font-bold text-sm text-slate-900">Monthly Spend & Volume</h3>
                {monthly.length === 0 ? (
                  <EmptyState label="No procurement history yet" />
                ) : (
                  <div className="flex items-end gap-1.5 h-40">
                    {monthly.map((m) => (
                      <div key={str(m.month)} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div
                          className="w-full bg-sky-500 hover:bg-sky-600 rounded-t-lg transition-all"
                          style={{ height: `${Math.max(3, (num(m.spend ?? m.amount) / maxMonthly) * 100)}%` }}
                          title={`${str(m.month)}: ${formatCurrency(num(m.spend ?? m.amount))} · ${num(m.volume).toFixed(1)}q`}
                        />
                        <span className="text-[9px] text-slate-400 font-bold truncate w-full text-center">{str(m.month).slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`${cardCls} p-5 space-y-3`}>
                  <h3 className="font-bold text-sm text-slate-900">Crop Breakdown</h3>
                  {topCrops.length === 0 ? (
                    <EmptyState label="No crop purchases yet" />
                  ) : (
                    topCrops.slice(0, 6).map((c) => (
                      <div key={str(c.crop)} className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800">{str(c.crop)}</span>
                        <span className="font-black text-emerald-800">{formatCurrency(num(c.spend))}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className={`${cardCls} p-5 space-y-3`}>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-amber-600" /> vs Mandi Modal
                  </h3>
                  {vsMandi.length === 0 ? (
                    <EmptyState label="No comparison data yet" />
                  ) : (
                    vsMandi.slice(0, 6).map((v, i) => (
                      <div key={i} className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800">{str(v.crop ?? v.commodity)}</span>
                        <span className={`font-black ${num(v.diffPct) <= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {num(v.diffPct) <= 0 ? '' : '+'}{num(v.diffPct).toFixed(1)}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* statements */}
              <div className={`${cardCls} p-5 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-600" /> Statement Lines ({statements.length})
                  </h3>
                </div>
                {statements.length === 0 ? (
                  <EmptyState label="No statement lines yet" />
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {statements.slice(0, 20).map((s) => (
                      <div key={str(s.purchaseId ?? s.id)} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl text-xs">
                        <div>
                          <p className="font-bold text-slate-800">
                            {str(s.commodity)} · {num(s.quantity)} q @ {formatCurrency(num(s.rate))}/q
                          </p>
                          <p className="text-[10px] text-slate-400">{formatDate(str(s.createdAt))}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-emerald-800">{formatCurrency(num(s.finalAmount))}</span>
                          <StatusBadge status={str(s.status)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className={`${cardCls} p-5 space-y-3`}>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" /> Top Suppliers
                </h3>
                {topSuppliers.length === 0 ? (
                  <EmptyState label="No supplier history yet" />
                ) : (
                  topSuppliers.map((s) => (
                    <div key={str(s.farmerId)} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{str(s.farmerName, 'Farmer')}</p>
                        <p className="text-[10px] text-slate-400">{num(s.purchases)} purchase(s)</p>
                      </div>
                      <span className="font-black text-emerald-800">{formatCurrency(num(s.spend))}</span>
                    </div>
                  ))
                )}
              </div>

              <div className={`${cardCls} p-5 space-y-3`}>
                <h3 className="font-bold text-sm text-slate-900">Commission Structure</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-50 rounded-2xl text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 block">Platform Commission</span>
                    <span className="text-lg font-black text-emerald-900">{num(commission.pct ?? commission.commissionPct, 2)}%</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Charged To</span>
                    <span className="text-lg font-black text-slate-900">{str(commission.chargedTo ?? commission.side, 'Buyer')}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  {str(commission.note ?? commission.description, 'Commission is charged to the buyer side, never deducted from the farmer payout.')}
                </p>
                <button
                  onClick={() => {
                    setError(null);
                    apiClient
                      .get('/direct-buyer/statements', { params: { format: 'pdf' }, responseType: 'blob' })
                      .then((res) => {
                        const url = URL.createObjectURL(res.data as Blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'buyer-statement.pdf';
                        a.click();
                        URL.revokeObjectURL(url);
                      })
                      .catch((err) => setError(apiErrorMessage(err)));
                  }}
                  className={`${ghostBtnCls} w-full flex items-center justify-center gap-1.5`}
                >
                  <Download className="w-3.5 h-3.5" /> Download Statement PDF
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
