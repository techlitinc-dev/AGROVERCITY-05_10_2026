import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChipSelect from '../../components/ChipSelect';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { inr } from '../../lib/api/trade';
import { myBookings } from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

type TripFilter = 'all' | 'open' | 'done';

interface TripRow {
  id: string;
  vehicleType: string;
  pickup: string;
  drop: string;
  date: string;
  fare: number;
  status: string;
  kind: string;
  lastLocation?: { waypointLabel?: string; updatedAt?: string } | null;
}

const fmtPingTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' });

const DONE_STATUSES = ['delivered', 'cancelled'];

/**
 * My Trips (farmer, plan §4.2) — transport bookings from /users/me/bookings
 * (viewer-gated; the transporter list lives in the job inbox). Filter between
 * all / open / completed, tap through to the trip command center.
 */
export default function MyTripsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('farmer');

  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<TripFilter>('all');

  const load = useCallback(() => {
    setFailed(false);
    myBookings()
      .then((res) => setTrips(res.transport ?? []))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const filterLabel = (f: TripFilter): string =>
    f === 'all' ? t('trFilterAll') : f === 'open' ? t('trFilterOpen') : t('trFilterDone');

  const shown = (trips ?? []).filter((trip) => {
    if (filter === 'open') return !DONE_STATUSES.includes(trip.status);
    if (filter === 'done') return DONE_STATUSES.includes(trip.status);
    return true;
  });

  return (
    <ToolShell toolId="myBookings">
      <div className="trade-filter-row">
        <ChipSelect
          options={(['all', 'open', 'done'] as const).map(filterLabel)}
          selected={[filterLabel(filter)]}
          onToggle={(label) => {
            const found = (['all', 'open', 'done'] as const).find((f) => filterLabel(f) === label);
            if (found) setFilter(found);
          }}
          single
        />
      </div>

      {trips === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {trips !== null && shown.length === 0 ? (
        <EmptyState
          icon="🛣️"
          titleKey="trEmptyTrips"
          bodyKey="trEmptyTripsBody"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => navigate('/dashboard/p/loadBoard/new')}
            >
              ＋ {t('trPostLoad')}
            </button>
          }
        />
      ) : null}

      <div className="trade-list">
        {shown.map((trip) => (
          <div
            key={trip.id}
            className="trade-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/dashboard/p/transport/trips/${trip.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/dashboard/p/transport/trips/${trip.id}`);
            }}
          >
            <div className="trade-card-row">
              <span className="trade-card-title">{trip.vehicleType}</span>
              <StatusPill status={trip.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {trip.pickup} → {trip.drop}
              </span>
              <span className="trade-card-amount">{inr(trip.fare)}</span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('trPickupDate')}: {fmtDate(trip.date)}
              </span>
            </div>
            {trip.status === 'enRoute' && trip.lastLocation ? (
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {t('trEnRoutePing', {
                    label: trip.lastLocation.waypointLabel || t('trLastPingFallback'),
                    time: trip.lastLocation.updatedAt
                      ? fmtPingTime(trip.lastLocation.updatedAt)
                      : '',
                  })}
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
