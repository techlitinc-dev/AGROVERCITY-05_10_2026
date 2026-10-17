import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  TrendingUp,
  Sparkles,
  AlertCircle,
  Package,
  Milk,
  ShoppingCart,
} from 'lucide-react';
import { apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency, formatDate } from '../../lib/utils';
import { dairyExtras } from './managerApi';
import { asRec, nameOf, numOf, recArr, strOf, todayStr, monthStr } from './helpers';

type Tab = 'daily' | 'pl' | 'analytics' | 'forecast';

export const DairyReportsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('daily');
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(monthStr());

  const [daily, setDaily] = useState<Record<string, unknown> | null>(null);
  const [pl, setPl] = useState<Record<string, unknown> | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // forecast form
  const [forecastForm, setForecastForm] = useState({
    product: 'Cow Milk',
    horizonDays: 7,
    festivalDays: 0,
    currentStockUnits: 0,
    historyText: '',
  });
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [forecasting, setForecasting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (tab === 'daily') setDaily(asRec(await dairyExtras.dailyReport(date)));
        if (tab === 'pl') setPl(asRec(await dairyExtras.plReport(month)));
        if (tab === 'analytics') {
          const a = asRec(await dairyExtras.dairyAnalytics(month));
          setAnalytics(a);
          // prefill forecast history from the month's daily liters
          const dailySeries = recArr(asRec(a.collections).daily);
          if (dailySeries.length && !forecastForm.historyText) {
            setForecastForm((f) => ({
              ...f,
              historyText: dailySeries.map((d) => String(numOf(d.liters))).join(', '),
              currentStockUnits: f.currentStockUnits || numOf(asRec(a.sales).liters),
            }));
          }
        }
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, date, month]);

  const runForecast = async (e: React.FormEvent) => {
    e.preventDefault();
    setForecasting(true);
    setError(null);
    try {
      const historyUnits = forecastForm.historyText
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => Number.isFinite(n) && n >= 0);
      const res = asRec(
        await dairyExtras.forecastDemand({
          product: forecastForm.product,
          category: 'dairy',
          historyUnits: historyUnits.length ? historyUnits : [10],
          horizonDays: Number(forecastForm.horizonDays),
          festivalDays: Number(forecastForm.festivalDays),
          currentStockUnits: Number(forecastForm.currentStockUnits),
        }),
      );
      setForecast(res);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setForecasting(false);
    }
  };

  const collections = asRec(daily?.collections);
  const sales = asRec(daily?.sales);
  const closingStock = recArr(daily?.closingStock);
  const colStats = asRec(analytics?.collections);
  const salesStats = asRec(analytics?.sales);
  const dues = asRec(analytics?.dues);
  const prevMonth = asRec(analytics?.previousMonth);
  const prevCols = asRec(prevMonth.collections);
  const topMembers = recArr(colStats.topMembers);
  const byShift = asRec(colStats.byShift);
  const bySpecies = asRec(colStats.bySpecies);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-emerald-600" />
            Dairy Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daily closing report, monthly profit & loss, procurement analytics and AI demand forecast
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {(tab === 'daily' || tab === 'analytics') && tab === 'daily' && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
            />
          )}
          {(tab === 'pl' || tab === 'analytics') && (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
            />
          )}
          <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'daily', label: 'Daily Report' },
                { id: 'pl', label: 'Monthly P&L' },
                { id: 'analytics', label: 'Analytics' },
                { id: 'forecast', label: 'Demand Forecast' },
              ] as { id: Tab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading report…</p>
      ) : (
        <>
          {tab === 'daily' && daily && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                  title="Collections"
                  value={`${numOf(collections.count)}`}
                  subtitle={`${numOf(collections.liters).toFixed(1)} L procured`}
                  icon={Milk}
                  colorScheme="blue"
                />
                <StatCard
                  title="Procurement Payout"
                  value={formatCurrency(numOf(collections.amount))}
                  subtitle={`for ${formatDate(strOf(daily.date))}`}
                  icon={TrendingUp}
                  colorScheme="green"
                />
                <StatCard
                  title="Sale Orders"
                  value={`${numOf(sales.orders)}`}
                  subtitle={`${numOf(sales.liters).toFixed(1)} L sold`}
                  icon={ShoppingCart}
                  colorScheme="purple"
                />
                <StatCard
                  title="Sales Amount"
                  value={formatCurrency(numOf(sales.amount))}
                  icon={BarChart3}
                  colorScheme="amber"
                />
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-emerald-600" /> Closing Stock — {formatDate(strOf(daily.date))}
                </h3>
                {closingStock.length === 0 ? (
                  <p className="text-xs text-slate-400">No stock items on record.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {closingStock.map((s) => (
                      <div key={strOf(s.id)} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-700">{nameOf(s)}</p>
                        <p className="text-sm font-black text-slate-900">
                          {numOf(s.stockQty)} <span className="text-xs font-semibold text-slate-500">{strOf(s.unit)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'pl' && pl && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                  title="Procurement Cost"
                  value={formatCurrency(numOf(pl.procurementCost))}
                  subtitle={`${numOf(pl.collectionsCount)} collections`}
                  icon={Milk}
                  colorScheme="blue"
                />
                <StatCard
                  title="Sales Income"
                  value={formatCurrency(numOf(pl.salesIncome))}
                  subtitle={`${numOf(pl.ordersCount)} orders`}
                  icon={ShoppingCart}
                  colorScheme="purple"
                />
                <StatCard
                  title="Gross Profit"
                  value={formatCurrency(numOf(pl.grossProfit))}
                  icon={TrendingUp}
                  colorScheme={numOf(pl.grossProfit) >= 0 ? 'green' : 'amber'}
                />
                <StatCard
                  title="Margin"
                  value={`${
                    numOf(pl.salesIncome) > 0
                      ? Math.round((numOf(pl.grossProfit) / numOf(pl.salesIncome)) * 100)
                      : 0
                  }%`}
                  subtitle={`month ${strOf(pl.month)}`}
                  icon={BarChart3}
                  colorScheme="amber"
                />
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
                <h3 className="font-bold text-sm text-slate-900">P&L — {strOf(pl.month)}</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Milk procurement (member payouts)</span>
                    <span className="font-bold text-slate-800">{formatCurrency(numOf(pl.procurementCost))}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Sales income (delivered/billed/paid orders)</span>
                    <span className="font-bold text-slate-800">{formatCurrency(numOf(pl.salesIncome))}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="font-black text-slate-900">Gross profit</span>
                    <span
                      className={`font-black ${numOf(pl.grossProfit) >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}
                    >
                      {formatCurrency(numOf(pl.grossProfit))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'analytics' && analytics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                  title="Month Collections"
                  value={`${numOf(colStats.liters).toLocaleString('en-IN')} L`}
                  subtitle={`${numOf(colStats.count)} entries • FAT ${numOf(colStats.avgFat).toFixed(1)}%`}
                  icon={Milk}
                  colorScheme="blue"
                />
                <StatCard
                  title="Month Sales"
                  value={formatCurrency(numOf(salesStats.amount))}
                  subtitle={`${numOf(salesStats.orders)} orders • ${numOf(salesStats.liters).toFixed(0)} L`}
                  icon={ShoppingCart}
                  colorScheme="purple"
                />
                <StatCard
                  title="Pending Dues"
                  value={formatCurrency(numOf(dues.pendingNet))}
                  subtitle={`${numOf(dues.pendingEntries)} unpaid batch entries`}
                  icon={CalendarDays}
                  colorScheme="amber"
                />
                <StatCard
                  title="vs Last Month"
                  value={`${numOf(prevCols.liters).toFixed(0)} L`}
                  subtitle={`${formatCurrency(numOf(prevCols.amount))} previous collections`}
                  icon={TrendingUp}
                  colorScheme="green"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
                  <h4 className="font-bold text-sm text-slate-900 mb-3">Shift split</h4>
                  {Object.keys(byShift).length === 0 ? (
                    <p className="text-xs text-slate-400">No data.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(byShift).map(([shift, v]) => {
                        const r = asRec(v);
                        return (
                          <div key={shift} className="flex justify-between text-xs border-b border-slate-50 pb-2">
                            <span className="capitalize font-bold text-slate-700">{shift}</span>
                            <span className="text-slate-600">
                              {numOf(r.liters).toFixed(1)} L • {numOf(r.count)} entries
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
                  <h4 className="font-bold text-sm text-slate-900 mb-3">Species split</h4>
                  {Object.keys(bySpecies).length === 0 ? (
                    <p className="text-xs text-slate-400">No data.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(bySpecies).map(([sp, v]) => {
                        const r = asRec(v);
                        return (
                          <div key={sp} className="flex justify-between text-xs border-b border-slate-50 pb-2">
                            <span className="capitalize font-bold text-slate-700">{sp}</span>
                            <span className="text-slate-600">
                              {numOf(r.liters).toFixed(1)} L • {formatCurrency(numOf(r.amount))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
                  <h4 className="font-bold text-sm text-slate-900 mb-3">Top members (liters)</h4>
                  {topMembers.length === 0 ? (
                    <p className="text-xs text-slate-400">No data.</p>
                  ) : (
                    <div className="space-y-2">
                      {topMembers.slice(0, 6).map((m) => (
                        <div key={strOf(m.memberId)} className="flex justify-between text-xs border-b border-slate-50 pb-2">
                          <span className="font-bold text-slate-700 truncate max-w-[60%]">{nameOf(m)}</span>
                          <span className="text-slate-600">{numOf(m.liters).toFixed(1)} L</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'forecast' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <form onSubmit={runForecast} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" /> AI Demand Forecast
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Product *</label>
                    <input
                      type="text"
                      value={forecastForm.product}
                      onChange={(e) => setForecastForm({ ...forecastForm, product: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Horizon (days)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={forecastForm.horizonDays}
                      onChange={(e) => setForecastForm({ ...forecastForm, horizonDays: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Festival days in horizon</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={forecastForm.festivalDays}
                      onChange={(e) => setForecastForm({ ...forecastForm, festivalDays: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Current stock (L)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={forecastForm.currentStockUnits}
                      onChange={(e) => setForecastForm({ ...forecastForm, currentStockUnits: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Daily history (liters, comma separated) *
                  </label>
                  <textarea
                    value={forecastForm.historyText}
                    onChange={(e) => setForecastForm({ ...forecastForm, historyText: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                    placeholder="e.g. 120, 132, 118, 140, 150"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Auto-filled from the analytics daily liters when available — edit freely.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={forecasting}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
                >
                  {forecasting ? 'Forecasting…' : 'Run Forecast'}
                </button>
              </form>

              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <h3 className="font-bold text-sm text-slate-900">Forecast result</h3>
                {!forecast ? (
                  <p className="text-xs text-slate-400">
                    Run a forecast to see expected demand with a low/expected/high band and a stock-up hint.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {(['lowUnits', 'expectedUnits', 'highUnits'] as const).map((k, i) => (
                        <div key={k} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] uppercase font-bold text-slate-400">{['Low', 'Expected', 'High'][i]}</p>
                          <p className="text-lg font-black text-slate-900">{numOf(forecast[k]).toFixed(1)}</p>
                          <p className="text-[10px] text-slate-400">units / {numOf(forecast.horizonDays)} days</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                      <span className="text-xs font-bold text-slate-600">Recommendation</span>
                      <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black capitalize">
                        {strOf(forecast.recommendation, 'hold')}
                      </span>
                    </div>
                    {numOf(forecast.trendPct) !== 0 && (
                      <p className="text-xs text-slate-600">
                        Trend: <span className="font-black">{numOf(forecast.trendPct).toFixed(1)}%</span> vs history
                      </p>
                    )}
                    {strOf(forecast.explanation) && (
                      <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-50 pt-3">
                        {strOf(forecast.explanation)}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      AI estimate — advisory only, confidence {strOf(forecast.confidence) || '—'} ({strOf(forecast.source) || 'rule'}).
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DairyReportsPage;
