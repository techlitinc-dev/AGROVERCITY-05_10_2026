import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin, RefreshCw, X } from 'lucide-react';
import { transport, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { TransportBooking } from '../../types';
import { fmtDate } from './utils';

type TabId = 'all' | 'ongoing' | 'upcoming' | 'previous' | 'cancelled';

const TABS: { id: TabId; label: string; statuses: string[] }[] = [
  { id: 'all', label: 'All', statuses: [] },
  {
    id: 'ongoing',
    label: 'Ongoing',
    statuses: ['accepted', 'arrivedPickup', 'loading', 'enRoute', 'reachedDestination', 'unloading'],
  },
  { id: 'upcoming', label: 'Upcoming', statuses: ['requested', 'pending'] },
  { id: 'previous', label: 'Previous', statuses: ['delivered', 'completed'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];

/** /transporter/bookings — full booking history split into lifecycle tabs. */
export const TransporterBookingsView: React.FC = () => {
  const [tab, setTab] = useState<TabId>('all');
  const [bookings, setBookings] = useState<TransportBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // One fetch, client-side tab filtering (backend ?status= takes a single status).
      const b = await transport.bookings({ pageSize: 200 });
      setBookings(b);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const def = TABS.find((t) => t.id === tab) ?? TABS[0];
    if (def.statuses.length === 0) return bookings;
    return bookings.filter((b) => def.statuses.includes(b.status));
  }, [bookings, tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <MapPin className="w-7 h-7 text-emerald-600" />
            My Bookings
          </h1>
          <p className="text-xs text-slate-500 mt-1">Every trip — ongoing, scheduled, completed, and cancelled</p>
        </div>
        <button onClick={load} className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 self-start sm:self-auto" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.id !== 'all' && (
              <span className="ml-1.5 text-[10px] text-slate-400">
                {bookings.filter((b) => t.statuses.includes(b.status)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 && !loading ? (
        <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700">No {tab === 'all' ? '' : tab} bookings</p>
          <p className="text-xs text-slate-500">
            {tab === 'upcoming'
              ? 'New direct requests land in the Job Inbox.'
              : tab === 'ongoing'
                ? 'Accept jobs from the inbox or win bids on the load board.'
                : 'Bookings move here as trips progress.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((b) => {
            const crop = b.commodity || b.cargoCrop || 'Cargo';
            const pickup = b.pickup || b.pickupAddress || '—';
            const drop = b.drop || b.dropAddress || '—';
            const fare = b.fare ?? b.estimatedFare ?? 0;
            const weight = b.weightQuintals ?? b.cargoWeightQuintal ?? 0;
            return (
              <div key={b.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                    {crop} {weight > 0 ? `(${formatWeight(weight)})` : ''}
                    <StatusBadge status={b.status} />
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600" /> {pickup} → {drop}
                  </p>
                  <p className="text-xs text-slate-400">
                    {fmtDate(b.date ?? b.pickupTime)} • Fare {formatCurrency(fare)}
                    {b.vehicleNo ? ` • ${b.vehicleNo}` : ''} • <span className="font-mono">{b.id}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <Link
                    to={`/transporter/trips/${b.id}`}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1"
                  >
                    Open Trip <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
