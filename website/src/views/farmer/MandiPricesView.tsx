import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  Landmark,
  LineChart as LineChartIcon,
  MapPin,
  PackagePlus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Truck,
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
import { Link, useSearchParams } from 'react-router-dom';
import { apiErrorMessage, mandi, priceAlerts } from '../../lib/api';
import {
  addCommodityWatchlist,
  getCommodityWatchlist,
  removeCommodityWatchlist,
  type CommodityWatchItem,
} from '../../lib/api/follows';
import { useAuthStore } from '../../stores/authStore';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import type { MandiLivePrice } from '../../types';

const num = (n: number) => n.toLocaleString('en-IN');
const slugOf = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';

const SORTS = [
  { id: 'modal-desc', label: 'Highest modal price' },
  { id: 'modal-asc', label: 'Lowest modal price' },
  { id: 'commodity', label: 'Commodity A–Z' },
  { id: 'mandi', label: 'Mandi A–Z' },
] as const;
type SortId = (typeof SORTS)[number]['id'];

interface BoardMeta {
  district: string;
  reportedDate: string | null;
  fetchedAt: string;
  source: string;
  stale: boolean;
  total: number;
}

type Tab = 'prices' | 'alerts';

/**
 * Latest Mandi Prices — one consolidated government-data board.
 *
 * Data: government open data (data.gov.in records via the platform backend) —
 * latest REPORTED daily prices, not a real-time stream. The feed carries no
 * MSP, arrivals, previous-day change or forecasts, so none are shown here.
 */
export const MandiPricesView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const profileDistrict = (user?.district || '').trim();

  // ---- board data ----
  const [rows, setRows] = useState<MandiLivePrice[]>([]);
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- controls ----
  const [districtInput, setDistrictInput] = useState(profileDistrict);
  const [districtApplied, setDistrictApplied] = useState(profileDistrict);
  const [knownDistricts, setKnownDistricts] = useState<string[]>([]);
  const [commodityQuery, setCommodityQuery] = useState('');
  const [mandiFilter, setMandiFilter] = useState('');
  const [varietyFilter, setVarietyFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [watchOnly, setWatchOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortId>('modal-desc');
  const [tab, setTab] = useState<Tab>('prices');

  // ---- watchlist ----
  const [watchlist, setWatchlist] = useState<CommodityWatchItem[]>([]);
  const watchedSlugs = useMemo(() => new Set(watchlist.map((w) => w.slug)), [watchlist]);

  // ---- commodity detail ----
  const [detailCommodity, setDetailCommodity] = useState<string | null>(null);
  const [calcRecordId, setCalcRecordId] = useState('');
  const [qty, setQty] = useState(30);
  const [transportCost, setTransportCost] = useState<string>('');
  const [otherCost, setOtherCost] = useState<string>('');
  const [historyPoints, setHistoryPoints] = useState<{ day: string; price: number }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ---- alerts ----
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertCrop, setAlertCrop] = useState('');
  const [alertTarget, setAlertTarget] = useState('');
  const [alertMandi, setAlertMandi] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const liveParams = useCallback(
    () => ({
      ...(districtApplied.trim() ? { district: districtApplied.trim() } : {}),
      limit: 200,
    }),
    [districtApplied],
  );

  /* ---------- board load (keeps previously displayed valid data) ---------- */
  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (rows.length === 0) setInitialLoading(true);
      else if (!opts.silent) setRefreshing(true);
      try {
        const res = await mandi.live(liveParams());
        setRows(res.data);
        setMeta({
          district: res.district,
          reportedDate: res.reportedDate,
          fetchedAt: res.fetchedAt,
          source: res.source,
          stale: res.stale,
          total: res.total,
        });
        setLoadError(null);
      } catch (e) {
        setLoadError(apiErrorMessage(e) || 'Mandi prices are unavailable right now.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [liveParams, rows.length],
  );

  useEffect(() => {
    load();
    const t = window.setInterval(() => load({ silent: true }), 5 * 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  /* ---------- known districts for the selector datalist ---------- */
  useEffect(() => {
    let active = true;
    mandi
      .liveFilters()
      .then((f) => active && setKnownDistricts(f.districts ?? []))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /* ---------- watchlist ---------- */
  useEffect(() => {
    let active = true;
    getCommodityWatchlist()
      .then((items) => active && setWatchlist(items ?? []))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /* ---------- alerts list ---------- */
  const refreshAlerts = useCallback(() => {
    priceAlerts
      .list()
      .then((list) => setAlerts((Array.isArray(list) ? list : []) as Record<string, unknown>[]))
      .catch(() => undefined);
  }, []);

  useEffect(() => refreshAlerts(), [refreshAlerts]);

  /* ---------- deep link: /farmer/mandi?commodity=Onion ---------- */
  const pendingCommodity = searchParams.get('commodity');
  useEffect(() => {
    if (pendingCommodity && rows.length > 0 && !detailCommodity) {
      setDetailCommodity(pendingCommodity);
    }
  }, [pendingCommodity, rows.length, detailCommodity]);

  /* ---------- manual refresh (invalidates the gov-feed cache, no scraping) ---------- */
  const handleRefresh = async () => {
    setError(null);
    try {
      const res = await mandi.liveRefresh(liveParams());
      setRows(res.data);
      setMeta({
        district: res.district,
        reportedDate: res.reportedDate,
        fetchedAt: res.fetchedAt,
        source: res.source,
        stale: res.stale,
        total: res.total,
      });
      setLoadError(null);
      setNotice(
        res.stale
          ? 'Upstream refresh failed — showing the last available prices.'
          : 'Prices refreshed from the government feed.',
      );
    } catch (e) {
      setError(apiErrorMessage(e) || 'Refresh failed. Please try again shortly.');
    }
  };

  /* ---------- watchlist ops ---------- */
  const toggleWatch = async (commodity: string) => {
    const slug = slugOf(commodity);
    const watching = watchedSlugs.has(slug);
    const item: CommodityWatchItem = { commodity, slug, since: new Date().toISOString() };
    setWatchlist((prev) => (watching ? prev.filter((w) => w.slug !== slug) : [...prev, item]));
    try {
      if (watching) {
        await removeCommodityWatchlist(slug);
        setNotice(`${commodity} removed from watchlist.`);
      } else {
        await addCommodityWatchlist(commodity);
        setNotice(`${commodity} pinned to your watchlist.`);
      }
    } catch (e) {
      setWatchlist((prev) => (watching ? [...prev, item] : prev.filter((w) => w.slug !== slug)));
      setError(apiErrorMessage(e) || 'Watchlist update failed.');
    }
  };

  /* ---------- derived filter options ---------- */
  const distinct = (pick: (r: MandiLivePrice) => string) =>
    Array.from(new Set(rows.map(pick).filter(Boolean))).sort();

  const mandis = useMemo(() => distinct((r) => r.mandiName), [rows]);
  const varieties = useMemo(() => distinct((r) => r.variety), [rows]);
  const grades = useMemo(() => distinct((r) => r.grade), [rows]);
  const boardCommodities = useMemo(() => distinct((r) => r.commodity), [rows]);

  const hasActiveFilters = Boolean(
    commodityQuery.trim() || mandiFilter || varietyFilter || gradeFilter || watchOnly,
  );
  const clearFilters = () => {
    setCommodityQuery('');
    setMandiFilter('');
    setVarietyFilter('');
    setGradeFilter('');
    setWatchOnly(false);
  };

  const boardRows = useMemo(() => {
    const needle = commodityQuery.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (needle && !r.commodity.toLowerCase().includes(needle)) return false;
      if (mandiFilter && r.mandiName !== mandiFilter) return false;
      if (varietyFilter && r.variety !== varietyFilter) return false;
      if (gradeFilter && r.grade !== gradeFilter) return false;
      if (watchOnly && !watchedSlugs.has(slugOf(r.commodity))) return false;
      return true;
    });
    const sorted = [...list];
    switch (sortBy) {
      case 'modal-desc':
        sorted.sort((a, b) => b.modalPrice - a.modalPrice);
        break;
      case 'modal-asc':
        sorted.sort((a, b) => a.modalPrice - b.modalPrice);
        break;
      case 'commodity':
        sorted.sort((a, b) => a.commodity.localeCompare(b.commodity));
        break;
      case 'mandi':
        sorted.sort((a, b) => a.mandiName.localeCompare(b.mandiName));
        break;
    }
    return sorted;
  }, [rows, commodityQuery, mandiFilter, varietyFilter, gradeFilter, watchOnly, watchedSlugs, sortBy]);

  /* ---------- commodity detail ---------- */
  const detailRows = useMemo(() => {
    if (!detailCommodity) return [];
    return rows
      .filter((r) => r.commodity.toLowerCase() === detailCommodity.toLowerCase())
      .sort((a, b) => b.modalPrice - a.modalPrice);
  }, [rows, detailCommodity]);

  useEffect(() => {
    if (detailRows.length === 0) {
      setCalcRecordId('');
      return;
    }
    setCalcRecordId((prev) => (detailRows.some((r) => r.id === prev) ? prev : detailRows[0].id));
  }, [detailRows]);

  const calcRecord = detailRows.find((r) => r.id === calcRecordId) ?? detailRows[0] ?? null;

  /* Genuine stored history only — the chart appears solely when real records
     exist for this commodity + mandi; nothing is fabricated. */
  useEffect(() => {
    if (!detailCommodity || !calcRecord) {
      setHistoryPoints([]);
      return;
    }
    const mandiName = calcRecord.mandiName;
    let active = true;
    setHistoryLoading(true);
    mandi
      .history({ crop: detailCommodity, mandi: mandiName })
      .then((list) => {
        if (!active) return;
        const pts = (Array.isArray(list) ? list : [])
          .map((h) => {
            const r = h as Record<string, unknown>;
            return { day: String(r.date ?? r.priceDate ?? ''), price: Number(r.modalPrice ?? 0) };
          })
          .filter((p) => p.day && p.price > 0)
          .sort((a, b) => a.day.localeCompare(b.day));
        setHistoryPoints(pts);
      })
      .catch(() => {
        if (active) setHistoryPoints([]);
      })
      .finally(() => active && setHistoryLoading(false));
    return () => {
      active = false;
    };
  }, [detailCommodity, calcRecord]);

  /* ---------- sale-value calculator (estimates only) ---------- */
  const grossEstimate = calcRecord ? calcRecord.modalPrice * (Number(qty) || 0) : 0;
  const totalCosts = (Number(transportCost) || 0) + (Number(otherCost) || 0);
  const netEstimate = grossEstimate - totalCosts;

  /* ---------- alerts ---------- */
  const openAlertFor = (commodity: string, mandiName = '', currentModal?: number) => {
    setAlertCrop(commodity);
    setAlertMandi(mandiName);
    setAlertTarget(currentModal ? String(Math.round(currentModal)) : '');
    setAlertModalOpen(true);
  };

  const handleSaveAlert = async () => {
    const crop = alertCrop.trim();
    const target = Number(alertTarget);
    if (!crop || !target || target <= 0) {
      setError('Enter a crop and a target price above zero.');
      return;
    }
    setSavingAlert(true);
    setError(null);
    try {
      await priceAlerts.create({
        crop,
        targetPrice: target,
        above: true,
        district: meta?.district || profileDistrict || undefined,
        mandi: alertMandi || undefined,
      });
      refreshAlerts();
      setNotice(`Price alert active for ${crop} at ${formatCurrency(target)}/quintal.`);
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
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const applyDistrict = (e: React.FormEvent) => {
    e.preventDefault();
    setDistrictApplied(districtInput.trim());
  };

  const fetchedTime = meta ? meta.fetchedAt.slice(11, 16) : null;

  return (
    <div className="space-y-4">
      {/* ---------- header ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Landmark className="w-7 h-7 text-emerald-600" />
            Latest Mandi Prices <span className="text-slate-400 font-bold text-lg">/ मंडी भाव</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Latest reported mandi prices from government open data — daily figures, not a
            real-time stream.
          </p>
        </div>
        <button
          onClick={() => openAlertFor(detailCommodity || commodityQuery.trim())}
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

      {/* ---------- stale banner ---------- */}
      {meta?.stale && (
        <div
          role="status"
          className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-semibold text-amber-900 flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Showing last available prices. Upstream refresh failed. Price date{' '}
            {meta.reportedDate || '—'}, fetched {fetchedTime || '—'}.
          </span>
        </div>
      )}

      {/* ---------- meta strip ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Reported</div>
            <div className="text-xs font-extrabold text-slate-800 truncate">{meta?.reportedDate || '—'}</div>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-emerald-600">District</div>
            <div className="text-xs font-extrabold text-slate-800 truncate">{meta?.district || districtApplied || '—'}</div>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-sky-600">Source</div>
            <div className="text-xs font-extrabold text-slate-800 truncate">Government open data</div>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </span>
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Records</div>
              <div className="text-xs font-extrabold text-slate-800 truncate">
                {rows.length}
                {fetchedTime ? ` · ${fetchedTime}` : ''}
              </div>
            </div>
          </div>
          <button
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[10px] transition-colors shrink-0"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ---------- tabs ---------- */}
      <div className="flex gap-1.5 bg-slate-100 p-1 rounded-2xl w-full sm:w-fit">
        {(
          [
            { id: 'prices', label: 'Prices', vernacular: 'भाव', count: rows.length },
            { id: 'alerts', label: 'My Alerts', vernacular: 'अलर्ट', count: alerts.length },
          ] as { id: Tab; label: string; vernacular: string; count: number }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.vernacular}</span>
            {t.count > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black tabular-nums ${
                  tab === t.id ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {t.count > 99 ? '99+' : t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'prices' && (
        <>
          {/* ---------- controls ---------- */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs px-3.5 py-3 space-y-2.5">
            <form onSubmit={applyDistrict} className="flex flex-wrap items-center gap-2">
              <label htmlFor="mandi-district" className="text-[11px] font-bold text-slate-500">
                District
              </label>
              <input
                id="mandi-district"
                list="mandi-district-options"
                value={districtInput}
                onChange={(e) => setDistrictInput(e.target.value)}
                placeholder="Your district"
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-44"
              />
              <datalist id="mandi-district-options">
                {knownDistricts.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-[11px] font-bold transition-colors"
              >
                Apply
              </button>
              {districtApplied !== profileDistrict && profileDistrict && (
                <button
                  type="button"
                  onClick={() => {
                    setDistrictInput(profileDistrict);
                    setDistrictApplied(profileDistrict);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                >
                  My district ({profileDistrict})
                </button>
              )}
              <div className="relative ml-auto">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="mandi-commodity-search"
                  value={commodityQuery}
                  onChange={(e) => setCommodityQuery(e.target.value)}
                  placeholder="Search commodity… / पीक शोधा"
                  className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-56"
                />
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-1.5">
              <label htmlFor="mandi-filter" className="text-[11px] font-bold text-slate-500">
                Filters
              </label>
              <select
                id="mandi-filter"
                value={mandiFilter}
                onChange={(e) => setMandiFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-600 max-w-48"
              >
                <option value="">All mandis</option>
                {mandis.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <label htmlFor="mandi-variety" className="sr-only">Variety</label>
              <select
                id="mandi-variety"
                value={varietyFilter}
                onChange={(e) => setVarietyFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-600 max-w-40"
              >
                <option value="">All varieties</option>
                {varieties.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <label htmlFor="mandi-grade" className="sr-only">Grade</label>
              <select
                id="mandi-grade"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-600 max-w-36"
              >
                <option value="">All grades</option>
                {grades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <label htmlFor="mandi-sort" className="sr-only">Sort by</label>
              <select
                id="mandi-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortId)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-600"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={() => setWatchOnly((v) => !v)}
                className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-colors flex items-center gap-1 ${
                  watchOnly
                    ? 'bg-amber-400 border-amber-400 text-white'
                    : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
                }`}
                title="Show only your watchlist"
              >
                <Star className={`w-3 h-3 ${watchOnly ? 'fill-white' : ''}`} />
                Watchlist ({watchlist.length})
              </button>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 hover:border-rose-300 hover:text-rose-600 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* ---------- error without cache ---------- */}
          {!initialLoading && rows.length === 0 && loadError && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">{loadError}</p>
              <button
                onClick={() => void load()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* ---------- board ---------- */}
          {!(rows.length === 0 && loadError) && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-semibold">
                  {refreshing && rows.length > 0 ? 'Refreshing…' : 'Latest reported prices'} ·{' '}
                  {boardRows.length} record{boardRows.length === 1 ? '' : 's'}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold truncate">
                  ₹ per quintal · {meta?.source || 'Government open data'}
                </span>
              </div>

              {/* mobile cards */}
              <div className="lg:hidden divide-y divide-slate-100">
                {initialLoading ? (
                  <SkeletonRows />
                ) : boardRows.length === 0 ? (
                  <EmptyBoard hasFilters={hasActiveFilters} onClear={clearFilters} />
                ) : (
                  boardRows.map((r) => {
                    const watched = watchedSlugs.has(slugOf(r.commodity));
                    return (
                      <div
                        key={r.id}
                        onClick={() => setDetailCommodity(r.commodity)}
                        className="px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-800">{r.commodity}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-emerald-600" />
                              <span className="truncate">{r.mandiName}</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleWatch(r.commodity);
                            }}
                            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                              watched ? 'text-amber-500' : 'text-slate-300'
                            }`}
                            title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
                          >
                            <Star className={`w-4 h-4 ${watched ? 'fill-amber-500' : ''}`} />
                          </button>
                        </div>
                        <div className="flex items-end justify-between mt-1.5 gap-2">
                          <div>
                            <div className="text-lg font-black text-slate-900 tabular-nums">
                              ₹{num(r.modalPrice)}
                              <span className="text-[10px] font-semibold text-slate-400"> /qtl</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Range ₹{num(r.minPrice)}–₹{num(r.maxPrice)}
                            </div>
                          </div>
                          <div className="text-right text-[10px] text-slate-400 shrink-0">
                            {r.variety || r.grade ? (
                              <div>{[r.variety, r.grade].filter(Boolean).join(' · ')}</div>
                            ) : null}
                            <div>{r.priceDate}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* desktop table */}
              <div className="hidden lg:block max-h-[560px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="px-3 py-2 font-extrabold">Commodity</th>
                      <th className="px-3 py-2 font-extrabold">Variety · Grade</th>
                      <th className="px-3 py-2 font-extrabold">Mandi</th>
                      <th className="px-3 py-2 font-extrabold text-right">Modal ₹/qtl</th>
                      <th className="px-3 py-2 font-extrabold text-right">Min–Max ₹/qtl</th>
                      <th className="px-3 py-2 font-extrabold text-right">Date</th>
                      <th className="px-3 py-2 font-extrabold text-center">★</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {initialLoading ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-10 text-center text-slate-400 font-bold">
                          <SkeletonRows />
                        </td>
                      </tr>
                    ) : boardRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-10">
                          <EmptyBoard hasFilters={hasActiveFilters} onClear={clearFilters} />
                        </td>
                      </tr>
                    ) : (
                      boardRows.map((r) => {
                        const watched = watchedSlugs.has(slugOf(r.commodity));
                        return (
                          <tr
                            key={r.id}
                            onClick={() => setDetailCommodity(r.commodity)}
                            className={`cursor-pointer transition-colors hover:bg-slate-50/70 ${
                              detailCommodity === r.commodity ? 'bg-emerald-50/70' : ''
                            }`}
                          >
                            <td className="px-3 py-2 font-bold text-slate-800">{r.commodity}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {[r.variety, r.grade].filter(Boolean).join(' · ') || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{r.mandiName}</td>
                            <td className="px-3 py-2 text-right">
                              <span className="font-black text-slate-900 tabular-nums text-sm">
                                ₹{num(r.modalPrice)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                              ₹{num(r.minPrice)}–₹{num(r.maxPrice)}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500">{r.priceDate}</td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void toggleWatch(r.commodity);
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
            </div>
          )}
        </>
      )}

      {tab === 'alerts' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-500" />
                My Price Alerts <span className="text-slate-400 font-semibold">/ माझे अलर्ट</span> ({alerts.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Get notified when a reported mandi rate crosses your target.
              </p>
            </div>
            <button
              onClick={() => openAlertFor('')}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Bell className="w-3.5 h-3.5" /> New Alert
            </button>
          </div>
          {alerts.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No alerts yet — create one and we will watch the market for you.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {alerts.map((a, i) => {
                const id = a.id;
                const crop = String(a.crop ?? 'Crop');
                const target = Number(a.targetPrice ?? 0);
                const current = typeof a.currentModal === 'number' ? a.currentModal : null;
                const hit = current !== null && target > 0 && current >= target;
                return (
                  <div
                    key={typeof id === 'string' ? id : i}
                    className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900">{crop}</p>
                        {a.district ? (
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                            {String(a.district)}
                          </span>
                        ) : null}
                        {hit && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            HIT
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-amber-800 font-semibold mt-0.5">
                        Target {formatCurrency(target)}/q
                        {current !== null ? ` · reported ${formatCurrency(current)}/q` : ''}
                        {a.mandi ? ` · ${String(a.mandi)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleDeleteAlert(id)}
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
        </div>
      )}

      {/* ================= commodity detail ================= */}
      <ModalSheet
        isOpen={!!detailCommodity}
        onClose={() => setDetailCommodity(null)}
        title={detailCommodity ?? ''}
        description={
          meta
            ? `${meta.district} · reported ${meta.reportedDate || '—'} · ₹ per quintal`
            : 'Latest reported mandi prices'
        }
        maxWidth="2xl"
      >
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* comparison by modal price */}
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
              Compare mandis by reported modal price
            </h3>
            {detailRows.length === 0 ? (
              <p className="text-[11px] text-slate-400 font-semibold">
                No records for this commodity in the current board.
              </p>
            ) : (
              detailRows.map((r, i) => {
                const active = calcRecord?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setCalcRecordId(r.id)}
                    className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs transition-colors ${
                      active ? 'bg-emerald-50/70 border-emerald-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-black ${i === 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate">
                          {r.mandiName}
                          {i === 0 && (
                            <span className="ml-1.5 text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                              Highest reported modal price
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {[r.variety, r.grade].filter(Boolean).join(' · ') || 'Standard'} · reported{' '}
                          {r.priceDate}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-black tabular-nums ${active ? 'text-emerald-700' : 'text-slate-900'}`}>
                        ₹{num(r.modalPrice)}
                        <span className="text-[9px] font-semibold text-slate-400"> /qtl</span>
                      </div>
                      <div className="text-[9px] text-slate-400 tabular-nums">
                        ₹{num(r.minPrice)}–₹{num(r.maxPrice)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            <p className="text-[10px] text-slate-400">
              The highest modal price is not automatically the best mandi — travel time, commission and
              arrival quality also matter.
            </p>
          </div>

          {/* sale-value calculator (estimates only) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-emerald-600" />
              Sale-value calculator — estimates only
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label htmlFor="calc-qty" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  Quantity (quintals)
                </label>
                <input
                  id="calc-qty"
                  type="number"
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label htmlFor="calc-transport" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  Transport cost (₹, optional)
                </label>
                <input
                  id="calc-transport"
                  type="number"
                  min="0"
                  value={transportCost}
                  onChange={(e) => setTransportCost(e.target.value)}
                  placeholder="e.g. 1200"
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label htmlFor="calc-other" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  Other selling costs (₹, optional)
                </label>
                <input
                  id="calc-other"
                  type="number"
                  min="0"
                  value={otherCost}
                  onChange={(e) => setOtherCost(e.target.value)}
                  placeholder="e.g. 400"
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Estimated gross value
                </div>
                <div className="text-base font-black text-slate-900 tabular-nums">
                  {calcRecord ? formatCurrency(grossEstimate) : '—'}
                </div>
                <div className="text-[9px] text-slate-400">
                  {calcRecord ? `₹${num(calcRecord.modalPrice)}/qtl × ${qty || 0} qtl` : 'Pick a record above'}
                </div>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Estimated amount after entered costs
                </div>
                <div className="text-base font-black text-slate-900 tabular-nums">
                  {calcRecord ? formatCurrency(netEstimate) : '—'}
                </div>
                <div className="text-[9px] text-slate-400">minus the costs you entered</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              These are estimates based on the reported modal price — not a guaranteed selling price or
              final payment.
            </p>
          </div>

          {/* genuine history only */}
          <div className="h-44 w-full">
            {historyLoading ? (
              <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400 animate-pulse">
                Loading price history…
              </div>
            ) : historyPoints.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mandiGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `₹${v}`}
                  />
                  <Tooltip
                    formatter={(val: number) => [`₹${val}/quintal`, 'Reported modal']}
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Area type="monotone" dataKey="price" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#mandiGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <LineChartIcon className="w-8 h-8" />
                <span className="text-xs font-semibold">Not enough price history yet.</span>
              </div>
            )}
          </div>

          {/* actions */}
          <div className="flex flex-col sm:flex-row gap-1.5">
            <Link
              to={`/farmer/lots?create=1&crop=${encodeURIComponent(detailCommodity ?? '')}&variety=${encodeURIComponent(calcRecord?.variety ?? '')}&price=${calcRecord?.modalPrice ?? ''}`}
              className="flex-1 py-2.5 px-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] text-center transition-colors flex items-center justify-center gap-1.5"
            >
              <PackagePlus className="w-3.5 h-3.5" /> Create Produce Lot
            </Link>
            <Link
              to={`/farmer/transport?open=demand&crop=${encodeURIComponent(detailCommodity ?? '')}&destination=${encodeURIComponent(calcRecord?.mandiName ?? '')}`}
              className="flex-1 py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] text-center transition-colors flex items-center justify-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5" /> Find Transport
            </Link>
            <button
              onClick={() => openAlertFor(detailCommodity ?? '', calcRecord?.mandiName ?? '', calcRecord?.modalPrice)}
              className="flex-1 py-2.5 px-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] text-center transition-colors flex items-center justify-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" /> Set Price Alert
            </button>
          </div>
        </div>
      </ModalSheet>

      {/* ================= alert modal ================= */}
      <ModalSheet
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        title="Create Mandi Price Alert"
        description="Get notified when the reported mandi rate crosses your target"
        maxWidth="md"
      >
        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <label htmlFor="alert-crop" className="block text-xs font-bold text-slate-700 mb-1">
              Crop / commodity
            </label>
            <input
              id="alert-crop"
              list="alert-crop-options"
              value={alertCrop}
              onChange={(e) => setAlertCrop(e.target.value)}
              placeholder="e.g. Onion"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
            />
            <datalist id="alert-crop-options">
              {boardCommodities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="alert-target" className="block text-xs font-bold text-slate-700 mb-1">
              Target price (₹ per quintal)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
              <input
                id="alert-target"
                type="number"
                min="0"
                value={alertTarget}
                onChange={(e) => setAlertTarget(e.target.value)}
                className="w-full pl-7 pr-4 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </div>
            {alertMandi ? (
              <p className="text-[11px] text-slate-400 mt-1">
                District {meta?.district || districtApplied || profileDistrict || '—'} · mandi {alertMandi} are
                saved with this alert.
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                District {meta?.district || districtApplied || profileDistrict || '—'} is saved with this alert.
              </p>
            )}
          </div>

          <button
            onClick={() => void handleSaveAlert()}
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

const SkeletonRows: React.FC = () => (
  <div className="space-y-2 px-4 py-4" aria-hidden="true">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="animate-pulse flex items-center justify-between gap-3">
        <div className="h-3.5 bg-slate-200 rounded w-1/3" />
        <div className="h-3.5 bg-slate-100 rounded w-1/4" />
        <div className="h-3.5 bg-slate-100 rounded w-16" />
      </div>
    ))}
  </div>
);

const EmptyBoard: React.FC<{ hasFilters: boolean; onClear: () => void }> = ({ hasFilters, onClear }) => (
  <div className="px-4 py-10 text-center space-y-2">
    <p className="text-xs font-semibold text-slate-400">
      No reported prices found for this district/filter.
    </p>
    {hasFilters && (
      <button
        onClick={onClear}
        className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
      >
        Clear filters or change district
      </button>
    )}
  </div>
);

export default MandiPricesView;
