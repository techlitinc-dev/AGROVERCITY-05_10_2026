import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Search,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Check,
  Trash2,
  Sparkles,
  LineChart as LineChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useSearchParams } from 'react-router-dom';
import { mandi, advisory, priceAlerts, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import type { MandiPrice } from '../../types';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

interface ChartPoint {
  day: string;
  price: number;
}

export const MandiPricesView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [prices, setPrices] = useState<MandiPrice[]>([]);
  const [mandis, setMandis] = useState<unknown[]>([]);
  const [alerts, setAlerts] = useState<unknown[]>([]);
  const [chartCommodity, setChartCommodity] = useState('Soybean');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [compareRows, setCompareRows] = useState<unknown[]>([]);
  const [saturation, setSaturation] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<string>('All');

  // Alert modal state
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertCrop, setAlertCrop] = useState('Soybean');
  const [targetPrice, setTargetPrice] = useState(4850);
  const [savingAlert, setSavingAlert] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get('commodity');
    if (fromQuery) {
      setChartCommodity(fromQuery);
      setAlertCrop(fromQuery);
      setSelectedCrop(fromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([mandi.prices(), mandi.list(), priceAlerts.list()])
      .then(([p, m, a]) => {
        if (!active) return;
        setPrices(p);
        setMandis(m);
        setAlerts(a);
        if (p.length > 0 && !searchParams.get('commodity')) {
          const first = p[0].commodity;
          setChartCommodity(first);
          setAlertCrop(first);
        }
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Load history + forecast + compare for the selected commodity
  useEffect(() => {
    if (!chartCommodity) return;
    let active = true;
    setChartLoading(true);
    Promise.all([
      mandi.history({ commodity: chartCommodity }),
      mandi.forecast({ commodity: chartCommodity }),
      mandi.compare({ commodity: chartCommodity }),
    ])
      .then(([history, fc, cmp]) => {
        if (!active) return;
        const points: ChartPoint[] = asArray(history)
          .map((h) => {
            const r = asRecord(h);
            return {
              day: asStr(r.date ?? r.priceDate ?? r.day, ''),
              price: asNum(r.modalPrice ?? r.price ?? r.modal, 0),
            };
          })
          .filter((p) => p.price > 0);
        setChartData(points);
        setForecast(asRecord(fc));
        const cmpRec = asRecord(cmp);
        setCompareRows(asArray(cmpRec.mandis ?? cmpRec.rows ?? cmpRec.comparison ?? cmp));
      })
      .catch(() => {
        if (!active) return;
        setChartData([]);
        setForecast(null);
        setCompareRows([]);
      })
      .finally(() => active && setChartLoading(false));
    return () => {
      active = false;
    };
  }, [chartCommodity]);

  const filteredPrices = prices.filter((p) => {
    const matchesCrop = selectedCrop === 'All' || p.commodity.toLowerCase().includes(selectedCrop.toLowerCase());
    const matchesSearch =
      p.commodity.toLowerCase().includes(search.toLowerCase()) ||
      p.mandi.toLowerCase().includes(search.toLowerCase()) ||
      p.district.toLowerCase().includes(search.toLowerCase());
    return matchesCrop && matchesSearch;
  });

  const chartPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;

  const handleSaveAlert = async () => {
    setSavingAlert(true);
    setError(null);
    try {
      await priceAlerts.create({ commodity: alertCrop, targetPrice });
      const list = await priceAlerts.list();
      setAlerts(list);
      setNotice(`Price alert active for ${alertCrop} at ${formatCurrency(targetPrice)}/q.`);
      setAlertModalOpen(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSavingAlert(false);
    }
  };

  const handleDeleteAlert = async (id: unknown) => {
    if (typeof id !== 'string') return;
    try {
      await priceAlerts.remove(id);
      setAlerts((prev) => prev.filter((a) => asStr(asRecord(a).id) !== id));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const handleSaturation = async () => {
    setSaturation(null);
    try {
      const res = await advisory.saturation({ commodity: chartCommodity });
      setSaturation(asRecord(res));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const crops = useMemo(() => {
    const set = new Set<string>();
    prices.forEach((p) => p.commodity && set.add(p.commodity));
    return ['All', ...Array.from(set).slice(0, 8)];
  }, [prices]);

  const forecastAdvice = asStr(forecast?.advice ?? forecast?.recommendation);
  const forecastPrice = asNum(forecast?.forecastPrice ?? forecast?.expectedPrice ?? forecast?.price, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            Live Mandi Prices & Price Discovery
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time APMC arrivals, modal rates, and MSP intelligence across Maharashtra & Central India
          </p>
        </div>

        <button
          onClick={() => setAlertModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Bell className="w-4 h-4" />
          <span>Set Price Alert</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Historical Trend Chart Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={chartCommodity}
                onChange={(e) => setChartCommodity(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-600"
              >
                {crops.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <h3 className="font-bold text-sm text-slate-900">Modal Price Movement (APMC Trend)</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Modal price (₹/quintal) history & 7-day forecast
              {mandis.length > 0 ? ` • ${mandis.length} mandis tracked` : ''}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-700">
              {chartPrice > 0 ? formatCurrency(chartPrice) : '—'}
            </span>
            <span className="text-xs text-slate-500"> / quintal</span>
            {forecastPrice > 0 && (
              <p className="text-[10px] text-slate-400">
                Forecast: <span className="font-bold text-slate-600">{formatCurrency(forecastPrice)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="h-64 w-full">
          {chartLoading ? (
            <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400 animate-pulse">
              Loading price history…
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="mandiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  formatter={(val: number) => [`₹${val}/quintal`, 'Modal Rate']}
                  contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Area type="monotone" dataKey="price" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#mandiGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <LineChartIcon className="w-8 h-8" />
              <span className="text-xs font-semibold">No history available for {chartCommodity} yet.</span>
            </div>
          )}
        </div>

        {/* Forecast + Saturation advisory strip */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
          <div className="flex-1 p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-950 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>7-Day Price Forecast — {chartCommodity}</span>
            </div>
            <p className="leading-relaxed">
              {forecastAdvice ||
                (forecastPrice > 0
                  ? `Expected modal price ${formatCurrency(forecastPrice)}/q.`
                  : 'Forecast will appear here once enough APMC arrivals are recorded.')}
            </p>
          </div>
          <div className="flex-1 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Sell Now or Wait? (Market Saturation)</span>
              </div>
              <button
                onClick={handleSaturation}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-xs"
              >
                Analyze
              </button>
            </div>
            <p className="leading-relaxed">
              {saturation
                ? asStr(
                    saturation.advice ?? saturation.recommendation ?? saturation.message,
                    JSON.stringify(saturation)
                  )
                : 'Run the AI saturation check to decide whether to sell at the gate or hold for a better window.'}
            </p>
          </div>
        </div>

        {/* Mandi comparison for the selected commodity */}
        {compareRows.length > 0 && (
          <div className="pt-2">
            <h4 className="font-bold text-xs text-slate-900 mb-2">
              {chartCommodity} — Mandi-wise Comparison (Top Yards)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {compareRows.slice(0, 6).map((row, i) => {
                const r = asRecord(row);
                const modal = asNum(r.modalPrice ?? r.price ?? r.modal, 0);
                const trend = asNum(r.trendPercentage ?? r.trend ?? r.changePercent, 0);
                return (
                  <div key={i} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        {asStr(r.mandi ?? r.name ?? r.mandiName, 'Mandi')}
                      </p>
                      <p className="text-[10px] text-slate-400">{asStr(r.district, '')}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-slate-900">{modal > 0 ? formatCurrency(modal) : '—'}</span>
                      {trend !== 0 && (
                        <span className={`block text-[10px] font-bold ${trend >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {trend >= 0 ? '+' : ''}{trend}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search commodity, mandi yard, or district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {crops.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCrop(c)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-2xl whitespace-nowrap transition-colors ${
                selectedCrop === c
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Live Mandi Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 sm:px-6">Commodity & Variety</th>
                <th className="py-3.5 px-4">Mandi Yard</th>
                <th className="py-3.5 px-4">Min / Max Rate</th>
                <th className="py-3.5 px-4 text-right">Modal Price</th>
                <th className="py-3.5 px-4 text-right">Govt MSP</th>
                <th className="py-3.5 px-4 text-right">Today's Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
                    Loading live mandi rates…
                  </td>
                </tr>
              ) : filteredPrices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs font-semibold text-slate-400">
                    No rates found for this filter.
                  </td>
                </tr>
              ) : (
                filteredPrices.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setChartCommodity(row.commodity)}
                    className={`hover:bg-slate-50/60 transition-colors cursor-pointer ${chartCommodity === row.commodity ? 'bg-emerald-50/40' : ''}`}
                  >
                    <td className="py-4 px-4 sm:px-6">
                      <span className="font-bold text-slate-900 block">{row.commodity}</span>
                      <span className="text-[11px] text-slate-400">{row.variety}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {row.mandi}
                      </span>
                      <span className="text-[10px] text-slate-400">{row.district}, {row.state}</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-600">
                      {formatCurrency(row.minPrice)} – {formatCurrency(row.maxPrice)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-extrabold text-sm text-slate-900 block">
                        {formatCurrency(row.modalPrice)}
                      </span>
                      <span className="text-[10px] text-slate-400">per quintal</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      {row.msp && row.msp > 0 ? (
                        <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {formatCurrency(row.msp)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span
                        className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                          row.trendPercentage >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {row.trendPercentage >= 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                        )}
                        {Math.abs(row.trendPercentage)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active price alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <h3 className="font-bold text-sm text-slate-900">My Active Price Alerts ({alerts.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map((a, i) => {
              const r = asRecord(a);
              const id = r.id;
              return (
                <div key={typeof id === 'string' ? id : i} className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-600" />
                    <div>
                      <p className="font-bold text-slate-900">{asStr(r.commodity ?? r.crop, 'Crop')}</p>
                      <p className="text-[10px] text-amber-800 font-semibold">
                        Target {formatCurrency(asNum(r.targetPrice ?? r.price, 0))}/q
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAlert(id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete alert"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Price Alert Modal Sheet */}
      <ModalSheet
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        title="Create Mandi Price Alert"
        description="Receive instant WhatsApp & SMS notifications when mandi rates cross your target"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Crop</label>
            <select
              value={alertCrop}
              onChange={(e) => setAlertCrop(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              {crops.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              {crops.filter((c) => c !== 'All').length === 0 && (
                <>
                  <option value="Soybean">Soybean (Yellow)</option>
                  <option value="Wheat">Wheat (Lokwan)</option>
                  <option value="Onion">Onion (Red Garva)</option>
                  <option value="Cotton">Cotton (Medium Staple)</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Price (₹ per Quintal)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(Number(e.target.value))}
                className="w-full pl-7 pr-4 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Current modal rate is {chartPrice > 0 ? formatCurrency(chartPrice) : '—'}/q.
            </p>
          </div>

          <button
            onClick={handleSaveAlert}
            disabled={savingAlert}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            {savingAlert ? (
              <>Saving…</>
            ) : (
              <>
                <Check className="w-4 h-4" /> Save & Activate Price Alert
              </>
            )}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
