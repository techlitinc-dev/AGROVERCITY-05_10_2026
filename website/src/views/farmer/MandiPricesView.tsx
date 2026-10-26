import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Truck,
  Calculator,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Star,
  RefreshCw,
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
import { useSearchParams, Link } from 'react-router-dom';
import { mandi, advisory, priceAlerts, apiErrorMessage } from '../../lib/api';
import {
  addMandiFavorite,
  getMandiFavorites,
  removeMandiFavorite,
  type MandiFavorite,
} from '../../lib/api/follows';
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

interface LiveRow {
  commodity: string;
  group: string;
  modalPrice: number;
  oneDayAgoPrice: number | null;
  twoDayAgoPrice: number | null;
  arrivalMt: number | null;
  msp: number | null;
  reportedDate: string;
  trend: string;
  changePercent: number | null;
  aboveMsp: boolean | null;
}

/** Agmarknet live feed — scraped daily modal prices / arrivals / MSP. */
const AgmarknetLiveSection: React.FC<{ onNotice: (msg: string) => void }> = ({ onNotice }) => {
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [commodities, setCommodities] = useState<{ id: number; name: string; groupId?: number }[]>([]);
  const [groupId, setGroupId] = useState<number | 'all'>('all');
  const [commodityId, setCommodityId] = useState<number | null>(null);
  const [commodityQuery, setCommodityQuery] = useState('');
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [reportedDate, setReportedDate] = useState<string | null>(null);
  const [movers, setMovers] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    mandi
      .liveFilters()
      .then((f: any) => {
        if (!active) return;
        setGroups(asArray(f?.groups) as { id: number; name: string }[]);
        setCommodities(asArray(f?.commodities) as { id: number; name: string; groupId?: number }[]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (commodityId) params.commodityId = commodityId;
      else if (groupId !== 'all') params.groupId = groupId;
      const res: any = await mandi.live(params);
      const list = Array.isArray(res) ? res : asArray(res?.data);
      setRows(list as unknown as LiveRow[]);
      setReportedDate(res?.reportedDate ?? null);
    } catch (e) {
      setError(apiErrorMessage(e) || 'Live Agmarknet prices are unavailable right now.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, commodityId]);

  const loadMovers = useCallback(async () => {
    try {
      setMovers(await mandi.movers(groupId !== 'all' ? { groupId } : undefined));
    } catch {
      setMovers(null);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadMovers();
  }, [loadMovers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res: any = await mandi.liveRefresh();
      if (res?.throttled) {
        onNotice(`Agmarknet data already refreshed at ${res?.refreshedAt?.slice(11, 16) || '—'} — showing cached snapshot.`);
      } else {
        onNotice(
          `Agmarknet synced: ${res?.commodities ?? 0} commodities · ${res?.historyPoints ?? 0} history points · reported ${res?.reportedDate ?? '—'}.`,
        );
      }
      await Promise.all([load(), loadMovers()]);
    } catch (e) {
      setError(apiErrorMessage(e) || 'Refresh failed. Please try again shortly.');
    } finally {
      setRefreshing(false);
    }
  };

  const commodityOptions = useMemo(() => {
    const q = commodityQuery.trim().toLowerCase();
    const inGroup = commodities.filter((c) => groupId === 'all' || c.groupId === groupId);
    const pool = q ? inGroup.filter((c) => c.name.toLowerCase().includes(q)) : inGroup;
    return pool.slice(0, 60);
  }, [commodities, groupId, commodityQuery]);

  const trendIcon = (r: LiveRow) =>
    r.trend === 'up' ? (
      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
        <ArrowUpRight className="w-3.5 h-3.5" /> {r.changePercent !== null ? `${r.changePercent.toFixed(1)}%` : '—'}
      </span>
    ) : r.trend === 'down' ? (
      <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
        <ArrowDownRight className="w-3.5 h-3.5" /> {r.changePercent !== null ? `${r.changePercent.toFixed(1)}%` : '—'}
      </span>
    ) : (
      <span className="text-slate-400 font-bold">flat</span>
    );

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </span>
          <div>
            <h2 className="font-extrabold text-sm text-slate-900">Agmarknet Live Feed</h2>
            <p className="text-[11px] text-slate-500">
              Daily modal prices straight from agmarknet.gov.in
              {reportedDate ? ` · reported ${reportedDate}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={commodityId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setCommodityId(v ? Number(v) : null);
                setCommodityQuery('');
              }}
              className="pl-7 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[220px]"
            >
              <option value="">All commodities{groupId !== 'all' ? ' in group' : ''}</option>
              {(commodityQuery
                ? commodityOptions
                : commodities.filter((c) => groupId === 'all' || c.groupId === groupId).slice(0, 200)
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <input
            value={commodityQuery}
            onChange={(e) => {
              setCommodityQuery(e.target.value);
              setCommodityId(null);
            }}
            placeholder="Filter commodity…"
            className="w-36 px-3 py-2 text-xs rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Group chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => {
            setGroupId('all');
            setCommodityId(null);
          }}
          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
            groupId === 'all'
              ? 'bg-slate-900 border-slate-900 text-white'
              : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
          }`}
        >
          Featured
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => {
              setGroupId(g.id);
              setCommodityId(null);
            }}
            className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
              groupId === g.id
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Live table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <th className="px-3 py-2.5 font-extrabold">Commodity</th>
              <th className="px-3 py-2.5 font-extrabold text-right">Modal ₹/qtl</th>
              <th className="px-3 py-2.5 font-extrabold text-right">1-Day Δ</th>
              <th className="px-3 py-2.5 font-extrabold text-right hidden sm:table-cell">Arrival (MT)</th>
              <th className="px-3 py-2.5 font-extrabold text-right hidden md:table-cell">MSP ₹/qtl</th>
              <th className="px-3 py-2.5 font-extrabold text-right">vs MSP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400 font-bold animate-pulse">
                  Fetching live Agmarknet prices…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400 font-bold">
                  No prices reported for this selection yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.commodity} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-slate-800">{r.commodity}</div>
                    <div className="text-[10px] text-slate-400">{r.group}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-black text-slate-900 tabular-nums">
                    ₹{r.modalPrice.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{trendIcon(r)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums hidden sm:table-cell">
                    {r.arrivalMt !== null ? r.arrivalMt.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums hidden md:table-cell">
                    {r.msp !== null ? `₹${r.msp.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {r.msp === null ? (
                      <span className="text-slate-300">—</span>
                    ) : r.aboveMsp === false ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                        BELOW MSP
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ABOVE MSP
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Analytics strip */}
      {movers && (asArray(movers?.gainers).length > 0 || asArray(movers?.losers).length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 mb-1.5">
              Top Gainers (1-day)
            </div>
            <div className="space-y-1">
              {asArray(movers?.gainers)
                .slice(0, 3)
                .map((g: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-800 truncate">{asStr(g?.commodity, '—')}</span>
                    <span className="font-black text-emerald-700 tabular-nums">
                      +{asNum(g?.changePercent).toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 mb-1.5">
              Top Losers (1-day)
            </div>
            <div className="space-y-1">
              {asArray(movers?.losers)
                .slice(0, 3)
                .map((g: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-800 truncate">{asStr(g?.commodity, '—')}</span>
                    <span className="font-black text-rose-700 tabular-nums">{asNum(g?.changePercent).toFixed(1)}%</span>
                  </div>
                ))}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 mb-1.5">
              MSP Watch
            </div>
            <div className="text-[11px] text-amber-900 font-semibold leading-relaxed">
              {asNum(movers?.mspBelowCount)} of {asNum(movers?.mspTotalCount)} MSP-tracked crops traded below
              support price on {asStr(movers?.reportedDate, 'the latest report day')}.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MandiPricesView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [prices, setPrices] = useState<MandiPrice[]>([]);
  const [mandis, setMandis] = useState<unknown[]>([]);
  const [alerts, setAlerts] = useState<unknown[]>([]);
  const [chartCommodity, setChartCommodity] = useState('Soybean');
  const [chartMandi, setChartMandi] = useState('');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [compareRows, setCompareRows] = useState<unknown[]>([]);
  const [arbitrageQty, setArbitrageQty] = useState<number>(30);
  const [saturation, setSaturation] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<string>('All');

  // Saved markets (SR 11)
  const [favorites, setFavorites] = useState<MandiFavorite[]>([]);
  const [myMarketsOnly, setMyMarketsOnly] = useState(false);
  const [pickMandi, setPickMandi] = useState('');

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
    getMandiFavorites()
      .then((f) => active && setFavorites(f))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Load history + forecast + compare for the selected commodity
  useEffect(() => {
    if (!chartCommodity) return;
    let active = true;
    setChartLoading(true);
    // The backend defaults `mandi` to the caller's district when omitted;
    // send the explicit selection when the farmer has picked one.
    const historyParams: Record<string, unknown> = { crop: chartCommodity };
    const forecastParams: Record<string, unknown> = { crop: chartCommodity };
    if (chartMandi) {
      historyParams.mandi = chartMandi;
      forecastParams.mandi = chartMandi;
    }
    Promise.all([
      mandi.history(historyParams),
      mandi.forecast(forecastParams),
      mandi.compare({ crop: chartCommodity, commodity: chartCommodity, quantityQuintals: arbitrageQty }),
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
        const list = asArray((cmp as any)?.data ?? cmpRec.data ?? cmpRec.mandis ?? cmpRec.rows ?? cmpRec.comparison ?? cmp);
        setCompareRows(list);
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
  }, [chartCommodity, chartMandi, arbitrageQty]);

  const favoriteNames = useMemo(
    () => new Set(favorites.map((f) => f.name.trim().toLowerCase())),
    [favorites]
  );
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.mandiId)), [favorites]);

  const filteredPrices = prices.filter((p) => {
    const matchesCrop = selectedCrop === 'All' || p.commodity.toLowerCase().includes(selectedCrop.toLowerCase());
    const matchesMarket = !myMarketsOnly || favoriteNames.has(p.mandi.trim().toLowerCase());
    const matchesSearch =
      p.commodity.toLowerCase().includes(search.toLowerCase()) ||
      p.mandi.toLowerCase().includes(search.toLowerCase()) ||
      p.district.toLowerCase().includes(search.toLowerCase());
    return matchesCrop && matchesMarket && matchesSearch;
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
      // district/lat/lng fall back to the farmer's profile server-side.
      const res = await advisory.saturation({ crop: chartCommodity });
      setSaturation(asRecord(res));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  // Saved markets (SR 11) — optimistic local updates, revert on failure.
  const handleAddFavorite = async () => {
    if (!pickMandi) return;
    const rec = asRecord(mandis.find((m) => asStr(asRecord(m).id) === pickMandi));
    const name = asStr(rec.name, 'Mandi');
    const optimistic: MandiFavorite = {
      mandiId: pickMandi,
      name,
      district: asStr(rec.district),
      state: asStr(rec.state),
      since: new Date().toISOString(),
    };
    setFavorites((prev) => [...prev, optimistic]);
    try {
      await addMandiFavorite(pickMandi);
      setNotice(`${name} pinned to your saved markets.`);
      setPickMandi('');
    } catch (e) {
      setFavorites((prev) => prev.filter((f) => f.mandiId !== pickMandi));
      setError(apiErrorMessage(e));
    }
  };

  const handleRemoveFavorite = async (fav: MandiFavorite) => {
    setFavorites((prev) => prev.filter((f) => f.mandiId !== fav.mandiId));
    try {
      await removeMandiFavorite(fav.mandiId);
      setNotice(`${fav.name} removed from saved markets.`);
    } catch (e) {
      setFavorites((prev) => [...prev, fav]);
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

      {/* Agmarknet live feed — scraped daily modal prices + analytics */}
      <AgmarknetLiveSection onNotice={(msg) => setNotice(msg)} />

      {/* Saved markets (SR 11) — compact strip since this view has no markets-list UI */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              Saved Markets ({favorites.length})
            </h3>
            <p className="text-[11px] text-slate-400">
              Pin the APMC yards you trade at most, then filter live rates with the “My Markets” chip below.
            </p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <select
              value={pickMandi}
              onChange={(e) => setPickMandi(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-600 max-w-56"
            >
              <option value="">Add a market…</option>
              {mandis
                .map((m) => asRecord(m))
                .filter((m) => asStr(m.id) && !favoriteIds.has(asStr(m.id)))
                .map((m) => (
                  <option key={asStr(m.id)} value={asStr(m.id)}>
                    {asStr(m.name, 'Mandi')}{asStr(m.district) ? ` — ${asStr(m.district)}` : ''}
                  </option>
                ))}
            </select>
            <button
              onClick={handleAddFavorite}
              disabled={!pickMandi}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 transition-colors"
            >
              <Star className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>
        {favorites.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">
            No saved markets yet — pick a market above to pin it here.
          </p>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {favorites.map((f) => (
              <span
                key={f.mandiId}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold whitespace-nowrap"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                {f.name}
                {f.district ? <span className="text-amber-600/70 font-normal">• {f.district}</span> : null}
                <button
                  onClick={() => handleRemoveFavorite(f)}
                  className="p-1 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors"
                  title={`Remove ${f.name} from saved markets`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-500" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

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
              <select
                value={chartMandi}
                onChange={(e) => setChartMandi(e.target.value)}
                title="Mandi (defaults to your district)"
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-600 max-w-52"
              >
                <option value="">Mandi: my district</option>
                {mandis.map((m) => {
                  const rec = asRecord(m);
                  const id = asStr(rec.id);
                  const label = `${asStr(rec.name, 'Mandi')}${asStr(rec.district) ? ` — ${asStr(rec.district)}` : ''}`;
                  return id ? <option key={id} value={asStr(rec.name, id)}>{label}</option> : null;
                })}
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
            <div className="space-y-1.5">
              {saturation && asStr(saturation.riskLevel) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                      saturation.riskLevel === 'red'
                        ? 'bg-rose-100 text-rose-800'
                        : saturation.riskLevel === 'yellow'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {asStr(saturation.riskLevel)} risk
                  </span>
                  {asNum(saturation.predictedPrice, 0) > 0 && (
                    <span className="text-[11px] font-bold text-emerald-900">
                      Expected {formatCurrency(asNum(saturation.predictedPrice, 0))}/q
                      {asStr(saturation.predictedDate) ? ` by ${asStr(saturation.predictedDate)}` : ''}
                    </span>
                  )}
                </div>
              )}
              <p className="leading-relaxed">
                {saturation
                  ? asStr(
                      saturation.advice ?? saturation.recommendation ?? saturation.message,
                      asNum(saturation.sowingCount, -1) >= 0
                        ? `${asNum(saturation.sowingCount)} farmers in your district sowed ${chartCommodity}.` +
                          (asArray(saturation.alternativeCrops).length > 0
                            ? ` Alternatives: ${asArray(saturation.alternativeCrops)
                                .map((a) => asStr(asRecord(a).crop, ''))
                                .filter(Boolean)
                                .join(', ')}.`
                            : '')
                        : JSON.stringify(saturation)
                    )
                  : 'Run the AI saturation check to decide whether to sell at the gate or hold for a better window.'}
              </p>
            </div>
          </div>
        </div>

        {/* Mandi Arbitrage & Net In-Hand Profit Engine */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                <Calculator className="w-3 h-3 text-emerald-600" />
                <span>Mandi Arbitrage & Net Profit Engine • Gat 312 Pimpalgaon</span>
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 mt-1">
                {chartCommodity} — In-Hand Profit Comparison Across APMC Yards
              </h4>
              <p className="text-[11px] text-slate-500">
                Calculates actual bank payout after deducting diesel, freight haulage, and APMC hamali charges.
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 pl-2">Lot:</span>
              {[15, 30, 50, 100].map((q) => (
                <button
                  key={q}
                  onClick={() => setArbitrageQty(q)}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                    arbitrageQty === q
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {q} Qtl
                </button>
              ))}
            </div>
          </div>

          {compareRows.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {compareRows.slice(0, 4).map((row, i) => {
                const r = asRecord(row);
                const modal = asNum(r.modalPrice ?? r.price ?? r.modal, 0);
                const transport = asNum(r.transportCost ?? r.transportFare ?? r.transport_fare_paisa, 0);
                const grossSale = modal * arbitrageQty;
                const netProfit = asNum(r.netProfit ?? (grossSale - transport), grossSale - transport);
                const isBest = i === 0;

                return (
                  <div
                    key={i}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isBest
                        ? 'bg-gradient-to-b from-emerald-50/80 to-white border-emerald-400 shadow-md ring-1 ring-emerald-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="font-extrabold text-xs text-slate-900 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>{asStr(r.mandiName ?? r.mandi ?? r.name, 'Mandi APMC')}</span>
                          </h5>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {asStr(r.commodity ?? chartCommodity, chartCommodity)}
                          </span>
                        </div>
                        {isBest && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white flex-shrink-0">
                            ★ Max Profit
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 py-2 border-y border-slate-100 text-[11px]">
                        <div className="flex justify-between text-slate-600">
                          <span>Mandi Rate:</span>
                          <span className="font-bold text-slate-900">{formatCurrency(modal)} /q</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Gross Value ({arbitrageQty} Qtl):</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(grossSale)}</span>
                        </div>
                        <div className="flex justify-between text-rose-700">
                          <span>Transport & Haulage:</span>
                          <span className="font-semibold">- {formatCurrency(transport)}</span>
                        </div>
                      </div>

                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Net In-Hand Profit / निव्वळ नफा:
                        </span>
                        <div className="text-xl font-black text-emerald-800">
                          {formatCurrency(netProfit)}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-1.5">
                      <Link
                        to="/farmer/transport"
                        className="flex-1 py-2 px-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] text-center transition-colors flex items-center justify-center gap-1"
                      >
                        <Truck className="w-3 h-3" /> Book Transport
                      </Link>
                      <Link
                        to="/farmer/lots"
                        className="py-2 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[10px] text-center transition-colors"
                        title="List lot at this price"
                      >
                        Sell Lot
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-400 font-semibold">
              Loading real-time mandi arbitrage candidates...
            </div>
          )}
        </div>
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
          <button
            onClick={() => setMyMarketsOnly((v) => !v)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-2xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              myMarketsOnly
                ? 'bg-amber-500 text-white font-bold shadow-xs'
                : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
            }`}
            title="Show only rates from your saved markets"
          >
            <Star className={`w-3.5 h-3.5 ${myMarketsOnly ? 'fill-white' : 'text-amber-500'}`} />
            My Markets{favorites.length > 0 ? ` (${favorites.length})` : ''}
          </button>
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
