import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
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
  Star,
  RefreshCw,
  X,
  CalendarDays,
  Activity,
  Store,
  IndianRupee,
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
  addCommodityWatchlist,
  getCommodityWatchlist,
  removeCommodityWatchlist,
  type MandiFavorite,
  type CommodityWatchItem,
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

const slugOf = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';

const num = (n: number) => n.toLocaleString('en-IN');
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
/** Local rows sometimes carry the change as a string ("-4.4%") or omit it — normalize. */
const trendPct = (v: unknown): number | null =>
  typeof v === 'number' && !Number.isNaN(v) ? v : null;

/* ============================== ticker ============================== */

const TickerTape: React.FC<{ rows: LiveRow[] }> = ({ rows }) => {
  if (rows.length === 0) return null;
  const strip = rows.map((r, i) => {
    const pct = r.changePercent;
    const up = (pct ?? 0) > 0.05;
    const down = (pct ?? 0) < -0.05;
    return (
      <span key={i} className="inline-flex items-center gap-1.5 px-4 border-r border-slate-700/60 whitespace-nowrap">
        <span className="font-bold text-slate-200 uppercase tracking-wide text-[11px]">{r.commodity}</span>
        <span className="text-slate-400 tabular-nums text-[11px]">₹{num(r.modalPrice)}</span>
        <span
          className={`inline-flex items-center gap-0.5 font-bold tabular-nums text-[11px] ${
            up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-slate-500'
          }`}
        >
          {up ? <ArrowUpRight className="w-3 h-3" /> : down ? <ArrowDownRight className="w-3 h-3" /> : null}
          {pct === null ? '—' : `${up ? '+' : ''}${pct.toFixed(2)}%`}
        </span>
      </span>
    );
  });
  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/60 py-2 select-none">
      <div className="agv-ticker inline-flex items-center">
        <div className="flex items-center">{strip}</div>
        <div className="flex items-center" aria-hidden="true">{strip}</div>
      </div>
      <span className="absolute left-0 top-0 bottom-0 px-2 flex items-center bg-slate-900 border-r border-slate-700/60 z-10">
        <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
      </span>
    </div>
  );
};

/* ============================== small pieces ============================== */

const Delta: React.FC<{ pct: number | null; className?: string }> = ({ pct, className = '' }) => {
  if (pct === null) return <span className={`text-slate-300 font-bold ${className}`}>—</span>;
  const up = pct > 0.05;
  const down = pct < -0.05;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${className} ${
        up ? 'text-emerald-600' : down ? 'text-rose-600' : 'text-slate-400'
      }`}
    >
      {up ? <ArrowUpRight className="w-3 h-3" /> : down ? <ArrowDownRight className="w-3 h-3" /> : null}
      {signed(pct)}%
    </span>
  );
};

const MspBadge: React.FC<{ row: Pick<LiveRow, 'msp' | 'aboveMsp'> }> = ({ row }) => {
  if (row.msp === null)
    return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 text-slate-400">MSP —</span>;
  return row.aboveMsp === false ? (
    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
      BELOW MSP
    </span>
  ) : (
    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
      ABOVE MSP
    </span>
  );
};

const SectionCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-3xl border border-slate-200/80 shadow-xs ${className}`}>{children}</div>
);

/* ============================== main view ============================== */

type Tab = 'board' | 'yards' | 'alerts';

export const MandiPricesView: React.FC = () => {
  const [searchParams] = useSearchParams();

  // ---- live board data ----
  const [liveRows, setLiveRows] = useState<LiveRow[]>([]);
  const [reportedDate, setReportedDate] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [boardSearch, setBoardSearch] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [watchOnly, setWatchOnly] = useState(false);
  const [moversOnly, setMoversOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'modal' | 'change'>('modal');
  const [flash, setFlash] = useState<Record<string, 'up' | 'down'>>({});
  const prevPrices = useRef<Map<string, number>>(new Map());

  // ---- watchlist ----
  const [watchlist, setWatchlist] = useState<CommodityWatchItem[]>([]);
  const watchedSlugs = useMemo(() => new Set(watchlist.map((w) => w.slug)), [watchlist]);

  // ---- selection / detail ----
  const [chartCommodity, setChartCommodity] = useState('Soybean');
  const [chartMandi, setChartMandi] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('board');

  // ---- chart / forecast / arbitrage ----
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [compareRows, setCompareRows] = useState<unknown[]>([]);
  const [arbitrageQty, setArbitrageQty] = useState<number>(30);
  const [saturation, setSaturation] = useState<Record<string, unknown> | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  // ---- local yards ----
  const [prices, setPrices] = useState<MandiPrice[]>([]);
  const [mandis, setMandis] = useState<unknown[]>([]);
  const [yardsLoading, setYardsLoading] = useState(true);
  const [yardSearch, setYardSearch] = useState('');
  const [yardCrop, setYardCrop] = useState<string>('All');
  const [favorites, setFavorites] = useState<MandiFavorite[]>([]);
  const [myMarketsOnly, setMyMarketsOnly] = useState(false);
  const [pickMandi, setPickMandi] = useState('');

  // ---- alerts ----
  const [alerts, setAlerts] = useState<unknown[]>([]);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertCrop, setAlertCrop] = useState('Soybean');
  const [targetPrice, setTargetPrice] = useState(4850);
  const [savingAlert, setSavingAlert] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ---------- initial wiring ---------- */
  useEffect(() => {
    const fromQuery = searchParams.get('commodity');
    if (fromQuery) {
      setChartCommodity(fromQuery);
      setAlertCrop(fromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    getCommodityWatchlist()
      .then((items) => active && setWatchlist(items ?? []))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /* ---------- live board load + 60 s polling ---------- */
  const loadLive = useCallback(async (silent = false) => {
    if (!silent) setLiveLoading(true);
    setLiveError(null);
    try {
      const res: any = await mandi.live();
      const list = (Array.isArray(res) ? res : asArray(res?.data)) as unknown as LiveRow[];
      const prev = prevPrices.current;
      const changes: Record<string, 'up' | 'down'> = {};
      const next = new Map<string, number>();
      for (const r of list) {
        next.set(r.commodity, r.modalPrice);
        const p = prev.get(r.commodity);
        if (p !== undefined && p !== r.modalPrice) {
          changes[r.commodity] = r.modalPrice > p ? 'up' : 'down';
        }
      }
      prevPrices.current = next;
      setLiveRows(list);
      setReportedDate(res?.reportedDate ?? null);
      setFetchedAt(res?.fetchedAt ?? new Date().toISOString());
      if (Object.keys(changes).length > 0) {
        setFlash(changes);
        window.setTimeout(() => setFlash({}), 1700);
      }
    } catch (e) {
      if (!silent) {
        setLiveError(apiErrorMessage(e) || 'Live prices are unavailable right now.');
        setLiveRows([]);
      }
    } finally {
      if (!silent) setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLive();
    const t = window.setInterval(() => loadLive(true), 60_000);
    return () => window.clearInterval(t);
  }, [loadLive]);

  const handleSync = async () => {
    setLiveError(null);
    try {
      const res: any = await mandi.liveRefresh();
      if (res?.throttled) {
        setNotice(`Agmarknet data already refreshed at ${res?.refreshedAt?.slice(11, 16) || '—'} — showing cached snapshot.`);
      } else {
        setNotice(
          `Agmarknet synced: ${res?.commodities ?? 0} commodities · ${res?.historyPoints ?? 0} history points · reported ${res?.reportedDate ?? '—'}.`,
        );
      }
      await loadLive(true);
    } catch (e) {
      setLiveError(apiErrorMessage(e) || 'Refresh failed. Please try again shortly.');
    }
  };

  /* ---------- local yards ---------- */
  useEffect(() => {
    let active = true;
    setYardsLoading(true);
    Promise.all([mandi.prices(), mandi.list(), priceAlerts.list()])
      .then(([p, m, a]) => {
        if (!active) return;
        setPrices(p);
        setMandis(m);
        setAlerts(a);
        if (p.length > 0 && !searchParams.get('commodity')) {
          setChartCommodity(p[0].commodity);
          setAlertCrop(p[0].commodity);
        }
      })
      .catch(() => undefined)
      .finally(() => active && setYardsLoading(false));
    getMandiFavorites()
      .then((f) => active && setFavorites(f))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /* ---------- chart / forecast / compare for the selection ---------- */
  useEffect(() => {
    if (!chartCommodity) return;
    let active = true;
    setChartLoading(true);
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
        const rawList = asArray((cmp as any)?.data ?? cmpRec.data ?? cmpRec.mandis ?? cmpRec.rows ?? cmpRec.comparison ?? cmp);
        const needle = chartCommodity.toLowerCase();
        const list = rawList.filter((row) => {
          const rc = asStr(asRecord(row).commodity, '');
          return !rc || rc.toLowerCase().includes(needle) || needle.includes(rc.toLowerCase());
        });
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

  /* ---------- selection helper ---------- */
  const selectCommodity = (name: string, fromLocalTable: boolean) => {
    setChartCommodity(name);
    setAlertCrop(name);
    setSaturation(null);
    const local = prices.some((p) => p.commodity.toLowerCase() === name.toLowerCase());
    setChartMandi(local || fromLocalTable ? '' : 'National (Agmarknet)');
    setDetailOpen(true);
  };

  /* ---------- watchlist ops ---------- */
  const toggleWatch = async (row: LiveRow) => {
    const slug = slugOf(row.commodity);
    const watching = watchedSlugs.has(slug);
    const item: CommodityWatchItem = {
      commodity: row.commodity,
      slug,
      group: row.group,
      since: new Date().toISOString(),
    };
    setWatchlist((prev) => (watching ? prev.filter((w) => w.slug !== slug) : [...prev, item]));
    try {
      if (watching) {
        await removeCommodityWatchlist(slug);
        setNotice(`${row.commodity} removed from watchlist.`);
      } else {
        await addCommodityWatchlist(row.commodity, row.group);
        setNotice(`${row.commodity} pinned to your watchlist.`);
      }
    } catch (e) {
      setWatchlist((prev) => (watching ? [...prev, item] : prev.filter((w) => w.slug !== slug)));
      setError(apiErrorMessage(e) || 'Watchlist update failed.');
    }
  };

  /* ---------- favorites ops ---------- */
  const favoriteNames = useMemo(
    () => new Set(favorites.map((f) => f.name.trim().toLowerCase())),
    [favorites],
  );
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.mandiId)), [favorites]);

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

  /* ---------- alerts ---------- */
  const refreshAlerts = async () => {
    try {
      setAlerts(await priceAlerts.list());
    } catch {
      /* keep previous */
    }
  };

  const handleSaveAlert = async () => {
    setSavingAlert(true);
    setError(null);
    try {
      await priceAlerts.create({ commodity: alertCrop, targetPrice });
      await refreshAlerts();
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

  /* ---------- saturation ---------- */
  const handleSaturation = async () => {
    setSaturation(null);
    try {
      const res = await advisory.saturation({ crop: chartCommodity });
      setSaturation(asRecord(res));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  /* ---------- derived board data ---------- */
  const groups = useMemo(() => {
    const set = new Set<string>();
    liveRows.forEach((r) => r.group && set.add(r.group));
    return Array.from(set).sort();
  }, [liveRows]);

  const byName = useMemo(() => new Map(liveRows.map((r) => [r.commodity, r])), [liveRows]);

  const boardRows = useMemo(() => {
    const needle = boardSearch.trim().toLowerCase();
    let list = liveRows.filter((r) => {
      if (watchOnly && !watchedSlugs.has(slugOf(r.commodity))) return false;
      if (group !== 'all' && r.group !== group) return false;
      if (moversOnly && !(r.changePercent !== null && Math.abs(r.changePercent) > 0.05)) return false;
      if (needle && !r.commodity.toLowerCase().includes(needle) && !r.group.toLowerCase().includes(needle))
        return false;
      return true;
    });
    list = [...list].sort((a, b) =>
      sortBy === 'change'
        ? (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity)
        : b.modalPrice - a.modalPrice,
    );
    return list;
  }, [liveRows, boardSearch, group, moversOnly, sortBy, watchOnly, watchedSlugs]);

  const gainers = useMemo(
    () =>
      liveRows
        .filter((r) => (r.changePercent ?? 0) > 0.05)
        .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
        .slice(0, 3),
    [liveRows],
  );
  const losers = useMemo(
    () =>
      liveRows
        .filter((r) => (r.changePercent ?? 0) < -0.05)
        .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
        .slice(0, 3),
    [liveRows],
  );
  const belowMspCount = useMemo(
    () => liveRows.filter((r) => r.msp !== null && r.aboveMsp === false).length,
    [liveRows],
  );
  const mspTracked = useMemo(() => liveRows.filter((r) => r.msp !== null).length, [liveRows]);

  const watchRows = watchlist.map((w) => ({ watch: w, row: byName.get(w.commodity) }));

  const yardCrops = useMemo(() => {
    const set = new Set<string>();
    prices.forEach((p) => p.commodity && set.add(p.commodity));
    const list = Array.from(set).slice(0, 8);
    if (chartCommodity && !list.includes(chartCommodity)) list.push(chartCommodity);
    return ['All', ...list];
  }, [prices, chartCommodity]);

  const filteredYardPrices = prices.filter((p) => {
    const matchesCrop = yardCrop === 'All' || p.commodity.toLowerCase().includes(yardCrop.toLowerCase());
    const matchesMarket = !myMarketsOnly || favoriteNames.has(p.mandi.trim().toLowerCase());
    const q = yardSearch.toLowerCase();
    const matchesSearch =
      !q ||
      p.commodity.toLowerCase().includes(q) ||
      p.mandi.toLowerCase().includes(q) ||
      p.district.toLowerCase().includes(q);
    return matchesCrop && matchesMarket && matchesSearch;
  });

  const chartPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;
  const liveSelected = byName.get(chartCommodity);
  const headlinePrice = liveSelected ? liveSelected.modalPrice : chartPrice;
  const forecastAdvice = asStr(forecast?.advice ?? forecast?.recommendation);
  const forecastPrice = asNum(forecast?.forecastPrice ?? forecast?.expectedPrice ?? forecast?.price, 0);

  const TABS: { id: Tab; label: string; vernacular: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'board', label: 'Live Board', vernacular: 'लाइव्ह भाव', icon: <Activity className="w-3.5 h-3.5" />, badge: liveRows.length },
    { id: 'yards', label: 'Local Yards', vernacular: 'जवळच्या मंड्या', icon: <Store className="w-3.5 h-3.5" />, badge: prices.length },
    { id: 'alerts', label: 'My Alerts', vernacular: 'माझे अलर्ट', icon: <Bell className="w-3.5 h-3.5" />, badge: alerts.length },
  ];

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes agvTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .agv-ticker { animation: agvTicker 90s linear infinite; }
        @keyframes agvFlashUp { 0% { background-color: rgba(16,185,129,.20); } 100% { background-color: transparent; } }
        @keyframes agvFlashDown { 0% { background-color: rgba(244,63,94,.16); } 100% { background-color: transparent; } }
        .agv-flash-up { animation: agvFlashUp 1.6s ease-out; }
        .agv-flash-down { animation: agvFlashDown 1.6s ease-out; }
      `}</style>

      {/* ---------- header ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            Mandi Rates <span className="text-slate-400 font-bold text-lg">/ मंडी भाव</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live commodity board, your watchlist and MSP tracking — data: Agmarknet
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

      {/* ---------- ticker ---------- */}
      <TickerTape rows={liveRows} />

      {/* ---------- market stats ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <SectionCard className="p-3 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Reported</div>
            <div className="text-xs font-extrabold text-slate-800 truncate">{reportedDate || '—'}</div>
          </div>
        </SectionCard>
        <SectionCard className="p-3 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Gainers</div>
            <div className="text-xs font-extrabold text-slate-800 truncate">
              {liveRows.filter((r) => (r.changePercent ?? 0) > 0.05).length} commodities
            </div>
          </div>
        </SectionCard>
        <SectionCard className="p-3 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-rose-600">Losers</div>
            <div className="text-xs font-extrabold text-slate-800 truncate">
              {liveRows.filter((r) => (r.changePercent ?? 0) < -0.05).length} commodities
            </div>
          </div>
        </SectionCard>
        <SectionCard className="p-3 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <IndianRupee className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-amber-600">Below MSP</div>
            <div className="text-xs font-extrabold text-slate-800 truncate">
              {belowMspCount} of {mspTracked}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ---------- tabs ---------- */}
      <div className="flex gap-1.5 bg-slate-100 p-1 rounded-2xl w-full sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.vernacular}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black tabular-nums ${
                  tab === t.id ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ================= TAB: live board ================= */}
      {tab === 'board' && (
        <SectionCard className="overflow-hidden">
          {/* toolbar */}
          <div className="px-3.5 py-2.5 border-b border-slate-100 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                Live
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                Agmarknet modal prices
                {fetchedAt ? ` · fetched ${fetchedAt.slice(11, 16)}` : ''} · auto-refresh 60s
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => setSortBy((s) => (s === 'modal' ? 'change' : 'modal'))}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                >
                  Sort: {sortBy === 'modal' ? 'Price' : 'Δ%'}
                </button>
                <button
                  onClick={() => setMoversOnly((v) => !v)}
                  className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${
                    moversOnly
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
                  }`}
                >
                  Movers
                </button>
                <button
                  onClick={handleSync}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Sync
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={boardSearch}
                  onChange={(e) => setBoardSearch(e.target.value)}
                  placeholder="Search commodity or group… / पीक शोधा"
                  className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-60"
                />
              </div>
              <button
                onClick={() => setWatchOnly((v) => !v)}
                className={`px-2 py-1 rounded-md border text-[10px] font-bold transition-colors flex items-center gap-1 ${
                  watchOnly
                    ? 'bg-amber-400 border-amber-400 text-white'
                    : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
                }`}
                title="Show only your watchlist"
              >
                <Star className={`w-3 h-3 ${watchOnly ? 'fill-white' : ''}`} />
                Watchlist ({watchlist.length})
              </button>
              <button
                onClick={() => setGroup('all')}
                className={`px-2 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                  group === 'all'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
                }`}
              >
                All
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  className={`px-2 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                    group === g
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {liveError && (
            <div className="m-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-semibold text-rose-800">
              {liveError}
            </div>
          )}

          {/* card grid on small screens, table on lg+ */}
          <div className="lg:hidden divide-y divide-slate-100">
            {liveLoading ? (
              <div className="px-4 py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
                Fetching live prices…
              </div>
            ) : boardRows.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs font-semibold text-slate-400">
                {watchOnly && watchlist.length === 0
                  ? 'Your watchlist is empty — tap the ★ on any commodity to pin it.'
                  : 'No prices match this filter.'}
              </div>
            ) : (
              boardRows.map((r) => {
                const active = chartCommodity === r.commodity;
                const fl = flash[r.commodity];
                const watched = watchedSlugs.has(slugOf(r.commodity));
                return (
                  <div
                    key={r.commodity}
                    onClick={() => selectCommodity(r.commodity, false)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      active ? 'bg-emerald-50/70' : ''
                    } ${fl === 'up' ? 'agv-flash-up' : fl === 'down' ? 'agv-flash-down' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className={`font-bold text-sm ${active ? 'text-emerald-800' : 'text-slate-800'}`}>
                          {r.commodity}
                        </div>
                        <div className="text-[10px] text-slate-400">{r.group}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleWatch(r);
                        }}
                        className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                          watched ? 'text-amber-500' : 'text-slate-300'
                        }`}
                        title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        <Star className={`w-4 h-4 ${watched ? 'fill-amber-500' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-end justify-between mt-1.5">
                      <div className="text-lg font-black text-slate-900 tabular-nums">₹{num(r.modalPrice)}</div>
                      <Delta pct={r.changePercent} className="text-xs" />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                      <span>Arrival {r.arrivalMt !== null ? `${num(r.arrivalMt)} MT` : '—'}</span>
                      <span>{r.msp !== null ? `MSP ₹${num(r.msp)}` : 'MSP —'}</span>
                      <MspBadge row={r} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden lg:block max-h-[560px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-3 py-2 font-extrabold">Commodity</th>
                  <th className="px-3 py-2 font-extrabold text-right">Modal ₹/qtl</th>
                  <th className="px-3 py-2 font-extrabold text-right">1-Day Δ</th>
                  <th className="px-3 py-2 font-extrabold text-right">Arrival (MT)</th>
                  <th className="px-3 py-2 font-extrabold text-right">MSP ₹/qtl</th>
                  <th className="px-3 py-2 font-extrabold text-right">vs MSP</th>
                  <th className="px-3 py-2 font-extrabold text-center">★</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liveLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-slate-400 font-bold animate-pulse">
                      Fetching live prices…
                    </td>
                  </tr>
                ) : boardRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-slate-400 font-bold">
                      {watchOnly && watchlist.length === 0
                        ? 'Your watchlist is empty — tap the ★ on any row to pin it.'
                        : 'No prices match this filter.'}
                    </td>
                  </tr>
                ) : (
                  boardRows.map((r) => {
                    const active = chartCommodity === r.commodity;
                    const fl = flash[r.commodity];
                    const watched = watchedSlugs.has(slugOf(r.commodity));
                    return (
                      <tr
                        key={r.commodity}
                        onClick={() => selectCommodity(r.commodity, false)}
                        className={`cursor-pointer transition-colors ${
                          active ? 'bg-emerald-50/70' : 'hover:bg-slate-50/70'
                        } ${fl === 'up' ? 'agv-flash-up' : fl === 'down' ? 'agv-flash-down' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <div className={`font-bold ${active ? 'text-emerald-800' : 'text-slate-800'}`}>{r.commodity}</div>
                          <div className="text-[10px] text-slate-400">{r.group}</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-col items-end leading-tight">
                            <span className="font-black text-slate-900 tabular-nums text-sm">₹{num(r.modalPrice)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Delta pct={r.changePercent} />
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                          {r.arrivalMt !== null ? num(r.arrivalMt) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                          {r.msp !== null ? `₹${num(r.msp)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <MspBadge row={r} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleWatch(r);
                            }}
                            className={`p-1 rounded-lg transition-colors ${
                              watched ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'
                            }`}
                            title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
                          >
                            <Star className={`w-3.5 h-3.5 ${watched ? 'fill-amber-500' : ''}`} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* gainers/losers strip (desktop footer of board) */}
          {(gainers.length > 0 || losers.length > 0) && (
            <div className="border-t border-slate-100 px-3.5 py-2.5 hidden lg:flex items-center gap-4 flex-wrap">
              {gainers.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-black uppercase text-emerald-600">Top Gainers</span>
                  {gainers.map((g) => (
                    <button
                      key={g.commodity}
                      onClick={() => selectCommodity(g.commodity, false)}
                      className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                    >
                      {g.commodity} +{g.changePercent?.toFixed(1)}%
                    </button>
                  ))}
                </div>
              )}
              {losers.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-black uppercase text-rose-600">Top Losers</span>
                  {losers.map((l) => (
                    <button
                      key={l.commodity}
                      onClick={() => selectCommodity(l.commodity, false)}
                      className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold hover:bg-rose-100 transition-colors"
                    >
                      {l.commodity} {l.changePercent?.toFixed(1)}%
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* ================= TAB: local yards ================= */}
      {tab === 'yards' && (
        <div className="space-y-3">
          {/* saved markets */}
          <SectionCard className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  Saved Markets <span className="text-slate-400 font-semibold">/ जतन केलेल्या मंड्या</span> ({favorites.length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Pin the APMC yards you trade at most, then filter with the “My Markets” chip.
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
              <p className="text-xs text-slate-400 text-center py-2">
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
          </SectionCard>

          {/* yards board */}
          <SectionCard className="overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-100 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={yardSearch}
                    onChange={(e) => setYardSearch(e.target.value)}
                    placeholder="Search yard or district… / मंडी शोधा"
                    className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-56"
                  />
                </div>
                <button
                  onClick={() => setMyMarketsOnly((v) => !v)}
                  className={`px-2 py-1 rounded-md border text-[10px] font-bold transition-colors flex items-center gap-1 ${
                    myMarketsOnly
                      ? 'bg-amber-400 border-amber-400 text-white'
                      : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
                  }`}
                >
                  <Star className={`w-3 h-3 ${myMarketsOnly ? 'fill-white' : ''}`} />
                  My Markets{favorites.length > 0 ? ` (${favorites.length})` : ''}
                </button>
                {yardCrops.map((c) => (
                  <button
                    key={c}
                    onClick={() => setYardCrop(c)}
                    className={`px-2 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                      yardCrop === c
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {yardsLoading ? (
                <div className="px-4 py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
                  Loading yard rates…
                </div>
              ) : filteredYardPrices.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs font-semibold text-slate-400">
                  No yard rates found for this filter.
                </div>
              ) : (
                filteredYardPrices.map((row) => {
                  const tp = trendPct(row.trendPercentage);
                  return (
                  <div
                    key={row.id}
                    onClick={() => selectCommodity(row.commodity, true)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      chartCommodity === row.commodity ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-800">{row.commodity}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-600" />
                          {row.mandi} · {row.district}
                        </div>
                      </div>
                      {tp !== null ? (
                        <span
                          className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                            tp >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {tp >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(tp)}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-bold shrink-0">—</span>
                      )}
                    </div>
                    <div className="flex items-end justify-between mt-1.5">
                      <div>
                        <div className="text-lg font-black text-slate-900 tabular-nums">
                          {formatCurrency(row.modalPrice)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatCurrency(row.minPrice)} – {formatCurrency(row.maxPrice)}
                        </div>
                      </div>
                      <div className="text-right">
                        {row.msp && row.msp > 0 ? (
                          <div className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            MSP {formatCurrency(row.msp)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-300">MSP —</div>
                        )}
                        <div className="text-[9px] text-slate-400 mt-0.5">per quintal</div>
                      </div>
                    </div>
                  </div>
                  );
                })
              )}            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Commodity & Variety</th>
                    <th className="py-3 px-4">Mandi Yard</th>
                    <th className="py-3 px-4">Min / Max Rate</th>
                    <th className="py-3 px-4 text-right">Modal Price</th>
                    <th className="py-3 px-4 text-right">Govt MSP</th>
                    <th className="py-3 px-4 text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yardsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
                        Loading yard rates…
                      </td>
                    </tr>
                  ) : filteredYardPrices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs font-semibold text-slate-400">
                        No yard rates found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredYardPrices.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => selectCommodity(row.commodity, true)}
                        className={`cursor-pointer transition-colors ${
                          chartCommodity === row.commodity ? 'bg-emerald-50/40' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{row.commodity}</span>
                          <span className="text-[11px] text-slate-400">{row.variety}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {row.mandi}
                          </span>
                          <span className="text-[10px] text-slate-400">{row.district}, {row.state}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {formatCurrency(row.minPrice)} – {formatCurrency(row.maxPrice)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-extrabold text-sm text-slate-900 block">
                            {formatCurrency(row.modalPrice)}
                          </span>
                          <span className="text-[10px] text-slate-400">per quintal</span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {row.msp && row.msp > 0 ? (
                            <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {formatCurrency(row.msp)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {(() => {
                            const tp = trendPct(row.trendPercentage);
                            if (tp === null) return <span className="text-slate-300">—</span>;
                            return (
                              <span
                                className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                                  tp >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {tp >= 0 ? (
                                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                                ) : (
                                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                                )}
                                {Math.abs(tp)}%
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ================= TAB: alerts ================= */}
      {tab === 'alerts' && (
        <SectionCard className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-500" />
                My Price Alerts <span className="text-slate-400 font-semibold">/ माझे अलर्ट</span> ({alerts.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Get notified the moment a mandi rate crosses your target.
              </p>
            </div>
            <button
              onClick={() => setAlertModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Bell className="w-3.5 h-3.5" /> New Alert
            </button>
          </div>
          {alerts.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No alerts yet — create one and we'll watch the market for you.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {alerts.map((a, i) => {
                const r = asRecord(a);
                const id = r.id;
                const crop = asStr(r.commodity ?? r.crop, 'Crop');
                const target = asNum(r.targetPrice ?? r.price, 0);
                const live = byName.get(crop);
                const current = live?.modalPrice;
                return (
                  <div
                    key={typeof id === 'string' ? id : i}
                    className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900">{crop}</p>
                        {current !== undefined && target > 0 && (
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                              current >= target ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {current >= target ? 'HIT' : `${(((current - target) / target) * 100).toFixed(1)}% away`}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-amber-800 font-semibold mt-0.5">
                        Target {formatCurrency(target)}/q
                        {current !== undefined ? ` · now ${formatCurrency(current)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAlert(id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                      title="Delete alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* ================= commodity detail sheet ================= */}
      <ModalSheet
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={chartCommodity}
        description={
          liveSelected
            ? `${liveSelected.group} · ₹${num(liveSelected.modalPrice)}/qtl · reported ${reportedDate || '—'}`
            : 'Price history, forecast and the best yards to sell at'
        }
        maxWidth="2xl"
      >
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* headline + mandi picker */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-slate-900 tabular-nums">
                {headlinePrice > 0 ? `₹${num(headlinePrice)}` : '—'}
              </span>
              <span className="text-xs text-slate-400 pb-1">/ quintal</span>
              {liveSelected && <Delta pct={liveSelected.changePercent} className="pb-1" />}
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={chartMandi}
                onChange={(e) => setChartMandi(e.target.value)}
                title="Mandi (defaults to your district)"
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-600 max-w-52"
              >
                <option value="">Mandi: my district</option>
                {chartMandi &&
                  !mandis.some((m) => asStr(asRecord(m).name) === chartMandi) && (
                    <option value={chartMandi}>{chartMandi}</option>
                  )}
                {mandis.map((m) => {
                  const rec = asRecord(m);
                  const id = asStr(rec.id);
                  const label = `${asStr(rec.name, 'Mandi')}${asStr(rec.district) ? ` — ${asStr(rec.district)}` : ''}`;
                  return id ? <option key={id} value={asStr(rec.name, id)}>{label}</option> : null;
                })}
              </select>
              <button
                onClick={() => {
                  setAlertCrop(chartCommodity);
                  setAlertModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Bell className="w-3.5 h-3.5" /> Alert
              </button>
            </div>
          </div>

          {/* chart */}
          <div className="h-52 w-full">
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

          {/* forecast + saturation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-950 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>7-Day Forecast</span>
              </div>
              <p className="leading-relaxed">
                {forecastAdvice ||
                  (forecastPrice > 0
                    ? `Expected modal price ${formatCurrency(forecastPrice)}/q.`
                    : 'Forecast appears once enough arrivals are recorded.')}
              </p>
            </div>
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Sell Now or Wait?</span>
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
                    : 'Run the AI saturation check to decide whether to sell at the gate or hold.'}
                </p>
              </div>
            </div>
          </div>

          {/* arbitrage */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                <Calculator className="w-4 h-4 text-emerald-600" />
                Best Yards to Sell — net in-hand after transport
              </div>
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                {[15, 30, 50, 100].map((q) => (
                  <button
                    key={q}
                    onClick={() => setArbitrageQty(q)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      arbitrageQty === q ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    {q} Q
                  </button>
                ))}
              </div>
            </div>
            {compareRows.length > 0 ? (
              <div className="space-y-1.5">
                {compareRows.slice(0, 3).map((row, i) => {
                  const r = asRecord(row);
                  const modal = asNum(r.modalPrice ?? r.price ?? r.modal, 0);
                  const transport = asNum(r.transportCost ?? r.transportFare ?? r.transport_fare_paisa, 0);
                  const grossSale = modal * arbitrageQty;
                  const netProfit = asNum(r.netProfit ?? (grossSale - transport), grossSale - transport);
                  const isBest = i === 0;
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs ${
                        isBest ? 'bg-emerald-50/70 border-emerald-300' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-black ${isBest ? 'text-emerald-700' : 'text-slate-400'}`}>#{i + 1}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 truncate">
                            {asStr(r.mandiName ?? r.mandi ?? r.name, 'Mandi APMC')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ₹{num(modal)}/q · transport -₹{num(transport)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-black tabular-nums ${isBest ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {formatCurrency(netProfit)}
                        </div>
                        <div className="text-[9px] text-slate-400">net / {arbitrageQty} q</div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-1.5 pt-1">
                  <Link
                    to="/farmer/transport"
                    className="flex-1 py-2 px-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] text-center transition-colors flex items-center justify-center gap-1"
                  >
                    <Truck className="w-3 h-3" /> Book Transport
                  </Link>
                  <Link
                    to="/farmer/lots"
                    className="flex-1 py-2 px-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[10px] text-center transition-colors"
                  >
                    Sell a Lot
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl text-center text-[11px] text-slate-400 font-semibold">
                No arbitrage candidates for {chartCommodity} yet — sync the live feed or pick another commodity.
              </div>
            )}
          </div>
        </div>
      </ModalSheet>

      {/* ================= alert modal ================= */}
      <ModalSheet
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        title="Create Mandi Price Alert"
        description="Receive instant WhatsApp & SMS notifications when mandi rates cross your target"
        maxWidth="md"
      >
        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Crop</label>
            <select
              value={alertCrop}
              onChange={(e) => setAlertCrop(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              {yardCrops.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              {liveSelected && !yardCrops.includes(liveSelected.commodity) && (
                <option value={liveSelected.commodity}>{liveSelected.commodity}</option>
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
              {liveSelected
                ? `${liveSelected.commodity} is at ₹${num(liveSelected.modalPrice)}/q now.`
                : headlinePrice > 0
                  ? `Current modal rate is ${formatCurrency(headlinePrice)}/q.`
                  : 'Current modal rate unavailable.'}
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
