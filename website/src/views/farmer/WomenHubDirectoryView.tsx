import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Handshake,
  MapPin,
  Search,
  Star,
} from 'lucide-react';
import { apiErrorMessage, womenHub } from '../../lib/api';
import { asRecords, pick, pickNum, pickStr, Rec } from '../shared/records';

/**
 * Discover Women Hub Businesses (womenhub 21nov.xlsx Part B Sr 1.0, NEW) —
 * browse & search businesses created by Women Hub members, filter by category
 * & distance. Cards show photo, name, category, rating, location.
 */
export const WomenHubDirectoryView: React.FC = () => {
  const [items, setItems] = useState<Rec[] | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const rows = await womenHub.discoverBusinesses({
        q: q.trim() || undefined,
        category: category.trim() || undefined,
        distanceKm: distanceKm ? Number(distanceKm) : undefined,
      });
      setItems(asRecords(rows));
    } catch (err) {
      setError(apiErrorMessage(err));
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, [q, category, distanceKm]);

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const input =
    'px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600';

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Handshake className="w-7 h-7 text-pink-600" />
          Women Hub Businesses
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Tiffin &amp; dabba services, tailoring, pickle-papad units, ghee, dairy and more —
          discover and order from businesses run by Women Hub members.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border p-3 text-xs flex items-start gap-2 bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder="Search businesses…"
            className={`${input} sm:col-span-2`}
          />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder="Category (tailoring, tiffin…)"
            className={input}
          />
          <div className="flex gap-2">
            <select
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              className={`${input} flex-1`}
            >
              <option value="">Any distance</option>
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
              <option value="50">Within 50 km</option>
            </select>
            <button
              onClick={() => void search()}
              disabled={busy}
              className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {items === null ? (
        <p className="text-xs text-slate-400">Loading businesses…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8 text-center">
          No Women Hub businesses match this search — try another category or a wider distance.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((b) => {
            const id = pickStr(b, 'id');
            return (
              <Link
                key={id}
                to={`/farmer/women-hub/businesses/${id}`}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 hover:border-pink-300 transition-colors"
              >
                {pickStr(b, 'photo') ? (
                  <img
                    src={pickStr(b, 'photo')}
                    alt={pickStr(b, 'name')}
                    className="w-full h-28 rounded-2xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-full h-28 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center">
                    <Handshake className="w-8 h-8 text-pink-300" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{pickStr(b, 'name')}</h3>
                  <p className="text-[11px] text-slate-500">{pickStr(b, 'category')}</p>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <b className="text-slate-700">{pickNum(b, 'ratingAvg').toFixed(1)}</b> (
                    {pickNum(b, 'ratingCount')})
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {pickStr(b, 'location') || '—'}
                  </span>
                </div>
                {pick(b, 'distanceKm') !== undefined && (
                  <p className="text-[10px] font-bold text-pink-600">{pickNum(b, 'distanceKm')} km away</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
