import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Leaf, MapPin, Search, ShoppingBasket, Sprout, Star, Store } from 'lucide-react';
import { apiErrorMessage, customer, search } from '../../lib/api';
import { useCartStore } from '../../stores/cartStore';
import { formatDate, formatPaisa } from '../../lib/utils';

interface ProduceLot {
  id: string;
  crop: string;
  grade: string;
  quantityQuintals: number;
  pricePaisa: number;
  distanceKm: number | null;
  harvestDate: string;
  freshnessDays: number | null;
  organic: boolean;
  category?: string;
  farmerId: string;
  farmerName: string;
  farmerRating: number | null;
  photoUrl?: string;
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'vegetable', label: 'Vegetables' },
  { key: 'fruit', label: 'Fruits' },
  { key: 'grain', label: 'Grains' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'a2_ghee', label: 'A2 Ghee' },
];

const SORT_OPTIONS = [
  { key: 'distance', label: 'Distance' },
  { key: 'price', label: 'Price ↑' },
  { key: 'freshness', label: 'Freshness' },
  { key: 'grade', label: 'Grade' },
];

const PAGE_SIZE = 12;

function asLot(doc: unknown): ProduceLot {
  const d = (doc ?? {}) as Partial<ProduceLot>;
  return {
    id: String(d.id ?? ''),
    crop: d.crop ?? '',
    grade: d.grade ?? '',
    quantityQuintals: Number(d.quantityQuintals ?? 0),
    pricePaisa: Number(d.pricePaisa ?? 0),
    distanceKm: d.distanceKm ?? null,
    harvestDate: d.harvestDate ?? '',
    freshnessDays: d.freshnessDays ?? null,
    organic: !!d.organic,
    category: d.category,
    farmerId: d.farmerId ?? '',
    farmerName: d.farmerName ?? '',
    farmerRating: d.farmerRating ?? null,
    photoUrl: d.photoUrl,
  };
}

export const ProduceBrowseView: React.FC = () => {
  const [lots, setLots] = useState<ProduceLot[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState('all');
  const [organicOnly, setOrganicOnly] = useState(false);
  const [cropInput, setCropInput] = useState('');
  const [cropQuery, setCropQuery] = useState('');
  const [sort, setSort] = useState('distance');

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestSeq = useRef(0);
  const navigate = useNavigate();
  const addProduceLine = useCartStore((s) => s.addProduceLine);
  const produceCartCount = useCartStore((s) => s.produceLines.length);
  const [addedLots, setAddedLots] = useState<Set<string>>(new Set());

  const handleAddToProduceCart = (lot: ProduceLot) => {
    if (addedLots.has(lot.id)) {
      navigate('/mall/cart');
      return;
    }
    addProduceLine(
      {
        lotId: lot.id,
        farmerId: lot.farmerId,
        farmerName: lot.farmerName,
        crop: lot.crop,
        grade: lot.grade,
        qtyQuintals: Math.min(1, lot.quantityQuintals),
        availableQuintals: lot.quantityQuintals,
        pricePaisa: lot.pricePaisa,
        logisticsMode: 'customer_pickup',
        harvestDate: lot.harvestDate,
      },
      Math.min(1, lot.quantityQuintals)
    );
    setAddedLots((prev) => new Set(prev).add(lot.id));
  };

  // Debounce the crop search input.
  useEffect(() => {
    const t = window.setTimeout(() => setCropQuery(cropInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [cropInput]);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      const seq = ++requestSeq.current;
      try {
        const params: Record<string, unknown> = { page: targetPage, pageSize: PAGE_SIZE, sort };
        if (category !== 'all') params.category = category;
        if (organicOnly) params.organic = true;
        if (cropQuery) params.crop = cropQuery;
        const paged = await customer.produce(params);
        if (seq !== requestSeq.current) return; // stale response — filters changed mid-flight
        const incoming = (paged.data ?? []).map(asLot);
        setLots((prev) => (append ? [...prev, ...incoming] : incoming));
        setTotal(paged.total ?? incoming.length);
        setPage(paged.page ?? targetPage);
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, organicOnly, cropQuery, sort]
  );

  useEffect(() => {
    void load(1, false);
    setSaved(false);
  }, [load]);

  const nearby = useMemo(
    () =>
      [...lots]
        .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER))
        .slice(0, 5),
    [lots]
  );

  const handleSaveSearch = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const parts = [category !== 'all' ? CATEGORIES.find((c) => c.key === category)?.label : null, organicOnly ? 'Organic' : null, cropQuery ? `"${cropQuery}"` : null]
        .filter(Boolean)
        .join(' · ');
      await search.save({
        queryText: parts ? `Farm-fresh produce — ${parts}` : 'Farm-fresh produce',
        crop: cropQuery || null,
        alertsEnabled: true,
      });
      setSaved(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-8 bg-slate-100 rounded w-64 animate-pulse" />
        <div className="h-12 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-4 space-y-3 animate-pulse">
              <div className="h-36 bg-slate-100 rounded-2xl" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sprout className="w-7 h-7 text-emerald-600" />
            Browse Farm-Fresh Produce
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Harvest-fresh lots straight from farmers — filter by category, organic certification and crop
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveSearch()}
          disabled={saving}
          className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 text-slate-600 hover:text-emerald-700 font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto disabled:opacity-50"
        >
          {saved ? <BookmarkCheck className="w-4 h-4 text-emerald-600" /> : <Bookmark className="w-4 h-4" />}
          <span>{saved ? 'Search saved' : 'Save this search'}</span>
        </button>
        {produceCartCount > 0 && (
          <Link
            to="/mall/cart"
            className="px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto"
          >
            <ShoppingBasket className="w-4 h-4" />
            Produce cart ({produceCartCount})
          </Link>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all ${
                category === c.key
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOrganicOnly((v) => !v)}
            className={`ml-auto px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
              organicOnly
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Leaf className="w-3.5 h-3.5" />
            <span>Organic only</span>
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={cropInput}
              onChange={(e) => setCropInput(e.target.value)}
              placeholder="Search a crop — spinach, mango, wheat…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                Sort: {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</div>
      )}

      {lots.length === 0 && !error ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-400 flex items-center justify-center mx-auto">
            <Sprout className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-base text-slate-800">No lots match these filters</h3>
          <p className="text-xs text-slate-500">Try a different crop, category or clear the organic filter.</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-slate-400 font-semibold">{lots.length} lots shown</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {lots.map((lot) => (
              <div
                key={lot.id}
                className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col"
              >
                {lot.photoUrl ? (
                  <div className="h-36 w-full bg-slate-100 overflow-hidden">
                    <img src={lot.photoUrl} alt={lot.crop} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-36 w-full bg-gradient-to-br from-emerald-50 to-lime-50 flex items-center justify-center">
                    <Sprout className="w-10 h-10 text-emerald-300" />
                  </div>
                )}
                <div className="p-4 space-y-2 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 leading-tight">{lot.crop}</h4>
                      {lot.grade && <p className="text-[11px] text-slate-400">{lot.grade}</p>}
                    </div>
                    {lot.organic && (
                      <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold flex items-center gap-1 shrink-0">
                        <Leaf className="w-3 h-3" />
                        Organic
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    {lot.harvestDate && (
                      <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500">
                        Harvested {formatDate(lot.harvestDate)}
                      </span>
                    )}
                    {lot.freshnessDays !== null && (
                      <span className="px-2 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-700">
                        {lot.freshnessDays === 0 ? 'Harvested today' : `${lot.freshnessDays}d fresh`}
                      </span>
                    )}
                    {lot.distanceKm !== null && (
                      <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {lot.distanceKm} km
                      </span>
                    )}
                  </div>
                  <div className="pt-1">
                    <span className="text-lg font-black text-slate-900">{formatPaisa(lot.pricePaisa)}</span>
                    <span className="text-[11px] text-slate-400 font-semibold"> / quintal</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 font-semibold truncate">
                      {lot.farmerName || 'Farmer'}
                      {lot.farmerRating !== null && (
                        <span className="inline-flex items-center gap-0.5 ml-1.5 text-amber-600">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {lot.farmerRating.toFixed(1)}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        to={`/mall/seller/${lot.farmerId}`}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 text-slate-600 text-[10px] font-extrabold flex items-center gap-1 transition-colors"
                      >
                        <Store className="w-3 h-3" />
                        Shop
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleAddToProduceCart(lot)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors ${
                          addedLots.has(lot.id)
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <ShoppingBasket className="w-3 h-3" />
                        {addedLots.has(lot.id) ? 'In cart ✓' : 'Add to produce cart'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {lots.length < total && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => void load(page + 1, true)}
                disabled={loadingMore}
                className="px-5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Map-style nearby strip */}
      {nearby.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Nearby snapshot
          </h3>
          <p className="text-[11px] text-slate-400 -mt-1">Closest lots by distance — tap a pin to open the farmer shop</p>
          <ul className="divide-y divide-slate-100">
            {nearby.map((lot) => (
              <li key={`near-${lot.id}`} className="py-2.5 flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-extrabold text-slate-800 truncate">{lot.crop}</p>
                  <p className="text-[11px] text-slate-400 truncate">{lot.farmerName || 'Farmer'}</p>
                </div>
                <span className="text-[11px] font-bold text-slate-500 shrink-0">
                  {lot.distanceKm !== null ? `${lot.distanceKm} km` : 'Distance on request'}
                </span>
                <Link
                  to={`/mall/seller/${lot.farmerId}`}
                  className="text-[10px] font-extrabold text-emerald-700 hover:text-emerald-800 shrink-0"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
