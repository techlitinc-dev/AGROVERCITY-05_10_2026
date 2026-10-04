import { useCallback, useEffect, useRef, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import Timeline from '../../components/trade/Timeline';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import type { PurchaseEvent } from '../../lib/api/purchases';
import {
  myBookings,
  pingLocation,
  transportBookings,
  tripLocation,
  type TripLocation,
} from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import { ensureProfile } from '../../stores/dashboard';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

interface TripOption {
  id: string;
  pickup: string;
  drop: string;
  date: string;
  status: string;
}

const currentPosition = (): Promise<{ lat: number; lng: number }> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 0, lng: 0 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: 0, lng: 0 }),
      { timeout: 4000 }
    );
  });

/**
 * Live tracking (T7) — pick a trip and watch the manual location pings:
 * last ping, waypoint log as a timeline, and rough ETA. Transporters can also
 * share a one-tap ping from here (no continuous GPS — spec S16). Shared page:
 * trips come from the transporter job list, falling back to the farmer's
 * own bookings; the ping action self-heals FORBIDDEN_ROLE.
 */
export default function LiveTrackingPage() {
  const t = useT();

  const [trips, setTrips] = useState<TripOption[] | null>(null);
  const [mode, setMode] = useState<'transporter' | 'farmer' | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [track, setTrack] = useState<TripLocation | null>(null);
  const [trackFailed, setTrackFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const tripsRef = useRef(trips);
  tripsRef.current = trips;

  const loadTrips = useCallback(() => {
    setFailed(false);
    transportBookings()
      .then((res) => {
        setMode('transporter');
        setTrips(
          res.data.map((b) => ({
            id: b.id,
            pickup: b.pickup,
            drop: b.drop,
            date: b.date,
            status: b.status,
          }))
        );
      })
      .catch(() => {
        // Not (or not only) a transporter — fall back to the booker-side list.
        myBookings()
          .then((res) => {
            setMode('farmer');
            setTrips(
              (res.transport ?? []).map((b) => ({
                id: b.id,
                pickup: b.pickup,
                drop: b.drop,
                date: b.date,
                status: b.status,
              }))
            );
          })
          .catch(() => setFailed(true));
      });
  }, []);

  useEffect(loadTrips, [loadTrips]);

  const loadTrack = useCallback((id: string) => {
    if (!id) return;
    setTrackFailed(false);
    tripLocation(id)
      .then(setTrack)
      .catch(() => setTrackFailed(true));
  }, []);

  useEffect(() => {
    if (selectedId) loadTrack(selectedId);
  }, [selectedId, loadTrack]);

  // Auto-refresh (30s) while a trip is selected; active trips also push a
  // location ping each cycle (PWA pings — no telematics, spec S16).
  useEffect(() => {
    if (!selectedId) return;
    const id = window.setInterval(() => {
      loadTrack(selectedRef.current);
      const trip = (tripsRef.current ?? []).find((x) => x.id === selectedRef.current);
      if (trip && (trip.status === 'accepted' || trip.status === 'enRoute')) {
        currentPosition()
          .then((pos) => pingLocation(selectedRef.current, pos))
          .catch(() => undefined);
      }
    }, 30000);
    return () => window.clearInterval(id);
  }, [selectedId, loadTrack]);

  const selected = trips?.find((x) => x.id === selectedId) ?? null;

  const sharePing = async (retried = false) => {
    if (!selectedId) return;
    setBusy(true);
    const pos = await currentPosition();
    try {
      await pingLocation(selectedId, {
        ...pos,
        waypoint: 'in_transit',
        waypointLabel: t('trMilestoneInTransit'),
      });
      toast(t('trLocationPingSent'));
      loadTrack(selectedId);
    } catch (e) {
      if (isApiError(e) && e.code === 'FORBIDDEN_ROLE' && !retried) {
        const fixed = await ensureProfile('transport');
        if (fixed) {
          setBusy(false);
          await sharePing(true);
          return;
        }
      }
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const waypointEvents: PurchaseEvent[] = (track?.waypoints ?? []).map((w) => ({
    status: w.waypoint,
    at: w.time,
    note: w.label,
  }));

  return (
    <ToolShell toolId="liveTracking">
      {trips === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={loadTrips}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {trips !== null && trips.length === 0 ? (
        <EmptyState icon="🛰️" titleKey="trEmptyTrips" bodyKey="trEmptyTripsBody" />
      ) : null}

      {trips !== null && trips.length > 0 ? (
        <>
          <div className="av-field">
            <span className="av-label">{t('trTrackTrip')}</span>
            <select
              className="av-input"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setTrack(null);
              }}
            >
              <option value="">—</option>
              {trips.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.pickup} → {x.drop} · {fmtDate(x.date)} · {t(`status_${x.status}`)}
                </option>
              ))}
            </select>
          </div>

          {selectedId && trackFailed ? (
            <EmptyState
              icon="📡"
              titleKey="tradeLoadFailed"
              action={
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => loadTrack(selectedId)}
                >
                  ↻ {t('retry')}
                </button>
              }
            />
          ) : null}

          {selected && !track && !trackFailed ? (
            <p className="trade-hint">{t('commonLoading')}</p>
          ) : null}

          {track ? (
            <>
              <div className="trade-card" style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-title">{track.route}</span>
                  <StatusPill status={track.status} />
                </div>
                {track.currentLocation?.waypointLabel ? (
                  <div className="trade-card-row">
                    <span className="trade-card-sub">{track.currentLocation.waypointLabel}</span>
                  </div>
                ) : null}
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    {track.currentLocation?.updatedAt
                      ? `${t('trLastPing')}: ${fmtTime(track.currentLocation.updatedAt)}`
                      : t('trLastPing')}
                  </span>
                  <span className="trade-card-amount">
                    {t('trEtaMinutes', { minutes: track.estimatedMinutesLeft })}
                  </span>
                </div>
              </div>

              <div className="trade-detail-grid">
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('trVehicle')}</div>
                  <div className="trade-detail-value">{track.vehicleNo || t('commonNotAvailable')}</div>
                </div>
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('trDriver')}</div>
                  <div className="trade-detail-value">
                    {track.driverName || t('commonNotAvailable')}
                  </div>
                </div>
              </div>

              {mode === 'transporter' &&
              (track.status === 'accepted' || track.status === 'enRoute') ? (
                <div className="trade-actions">
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    onClick={() => void sharePing()}
                    disabled={busy}
                  >
                    {busy ? <span className="av-spinner" aria-hidden /> : `📍 ${t('trLocationPing')}`}
                  </button>
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    onClick={() => loadTrack(selectedId)}
                    disabled={busy}
                  >
                    ↻ {t('retry')}
                  </button>
                </div>
              ) : (
                <div className="trade-actions">
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    onClick={() => loadTrack(selectedId)}
                    disabled={busy}
                  >
                    ↻ {t('retry')}
                  </button>
                </div>
              )}

              {waypointEvents.length ? (
                <>
                  <p className="trade-section-title">{t('trTimeline')}</p>
                  <Timeline events={waypointEvents} />
                </>
              ) : null}

              <p className="trade-hint">{t('trTrackHint')}</p>
            </>
          ) : null}
        </>
      ) : null}
    </ToolShell>
  );
}
