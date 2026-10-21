import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Check,
  Circle,
  Clock,
  Loader2,
  MapPin,
  PackageCheck,
  Truck,
  User,
} from 'lucide-react';
import { transport } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const firstStr = (r: Record<string, unknown>, keys: string[], fb = ''): string => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return fb;
};

/** Same 7-step chain as the booking detail page (transport.py state machine). */
const TRACK_STEPS: { status: string; label: string }[] = [
  { status: 'accepted', label: 'Transporter assigned' },
  { status: 'arrivedPickup', label: 'Vehicle arrived for pickup' },
  { status: 'loading', label: 'Product loading' },
  { status: 'enRoute', label: 'In transit' },
  { status: 'reachedDestination', label: 'Reached destination' },
  { status: 'unloading', label: 'Unloading' },
  { status: 'delivered', label: 'Delivered' },
];

const stepIndex = (status: string): number => TRACK_STEPS.findIndex((s) => s.status === status);

const POLL_MS = 30_000;

/**
 * /track/:token — public, login-free shared trip tracking (FT-7).
 * Reads GET /transport/shared/{token}, which is deliberately sanitized:
 * route, vehicle plate, driver name, status, last location and milestones —
 * no fares, phone numbers or user ids.
 */
export const TrackDeliveryView: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [failed, setFailed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async (showSpinner: boolean) => {
    if (!token) return;
    if (showSpinner) setRefreshing(true);
    try {
      // Public route — the http layer only attaches a Bearer token when one
      // exists in localStorage, so anonymous visitors stay anonymous.
      const data = await transport.sharedBooking(token);
      setPayload(asRecord(data));
      setFailed(false);
      setLastUpdated(new Date());
    } catch {
      setFailed(true);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    setPayload(null);
    setFailed(false);
    void poll(false);
    timerRef.current = setInterval(() => void poll(false), POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [poll]);

  if (failed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900">Tracking link is invalid or expired</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            This shared trip link was revoked, expired (links live for 48 hours), or the URL is
            incomplete. Ask the sender to share the trip again from the Agrovercity app.
          </p>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500 animate-pulse">Loading live trip…</p>
        </div>
      </div>
    );
  }

  const status = firstStr(payload, ['status'], 'requested');
  const route = asRecord(payload.route);
  const pickup = firstStr(route, ['pickup'], 'Pickup location');
  const drop = firstStr(route, ['drop'], 'Destination');
  const commodity = firstStr(payload, ['commodity']);
  const vehicleType = firstStr(payload, ['vehicleType']);
  const vehicleNo = firstStr(payload, ['vehicleNo']);
  const driverName = firstStr(payload, ['driverName']);
  const transporterName = firstStr(payload, ['transporterName']);
  const transporterPhone = firstStr(payload, ['transporterPhone']);
  const bookingId = firstStr(payload, ['bookingId', 'id'], 'trip');
  const eta = typeof payload.estimatedMinutesLeft === 'number' ? (payload.estimatedMinutesLeft as number) : null;
  const waypoints = asArr(payload.waypoints).map(asRecord).slice(-8).reverse();
  const pod = asRecord(payload.pod);
  const podPhotos = asArr(pod.photos).filter((u): u is string => typeof u === 'string' && !!u);
  const currentLocation = asRecord(payload.currentLocation);
  const locationLabel = firstStr(currentLocation, ['label', 'address', 'name']) ||
    (typeof payload.currentLocation === 'string' ? (payload.currentLocation as string) : '');
  const current = stepIndex(status);

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-1">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-base leading-tight">Live Trip Tracking</h1>
              <p className="text-[11px] text-slate-400 font-mono">Ref #{bookingId}</p>
            </div>
          </div>
          <span
            className={`text-[11px] font-bold px-3 py-1 rounded-full border capitalize ${
              status === 'delivered'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : status === 'cancelled'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200'
            }`}
          >
            {status.replace(/([A-Z])/g, ' $1').trim()}
          </span>
        </div>

        {/* Route */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
          <p className="flex items-start gap-2 font-bold text-slate-900">
            <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            {pickup}
          </p>
          <p className="flex items-start gap-2 text-slate-600">
            <span className="w-4 flex justify-center flex-shrink-0">
              <span className="w-px h-3 bg-slate-300" />
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">to</span>
          </p>
          <p className="flex items-start gap-2 font-bold text-slate-900">
            <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            {drop}
          </p>
          {commodity && <p className="text-[11px] text-slate-500 pt-1">Cargo: <strong>{commodity}</strong></p>}
        </div>

        {/* Vehicle / driver / transporter (whatever the sanitized payload carries) */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-700">
          {vehicleType && (
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-sky-600" />
              <strong>{vehicleType}</strong>
              {vehicleNo && <span className="font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">{vehicleNo}</span>}
            </span>
          )}
          {driverName && (
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              Driver: <strong>{driverName}</strong>
            </span>
          )}
          {transporterName && (
            <span className="flex items-center gap-1.5">
              <strong>{transporterName}</strong>
              {transporterPhone && <a className="text-emerald-700 font-bold" href={`tel:${transporterPhone}`}>{transporterPhone}</a>}
            </span>
          )}
        </div>

        {locationLabel && eta !== null && status !== 'delivered' && (
          <p className="text-[11px] text-sky-700 font-semibold flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            Last seen near {locationLabel} · ~{eta} min to destination
          </p>
        )}
      </div>

      {/* Stepper */}
      {status === 'requested' ? (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3">Delivery Progress</h3>
          <div className="flex items-start gap-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
            <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span><strong>Awaiting transporter.</strong> The trip tracker starts once a transporter accepts this load.</span>
          </div>
        </div>
      ) : status === 'cancelled' ? (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3">Delivery Progress</h3>
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl p-3.5">
            This trip was cancelled by the sender.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-4">Delivery Progress</h3>
          <ol className="space-y-0">
            {TRACK_STEPS.map((step, i) => {
              const complete = current > i || status === 'delivered';
              const isCurrent = i === current && status !== 'delivered';
              const last = i === TRACK_STEPS.length - 1;
              return (
                <li key={step.status} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    {complete ? (
                      <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/30">
                        <Check className="w-4 h-4" strokeWidth={3} />
                      </span>
                    ) : isCurrent ? (
                      <span className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-sm shadow-sky-600/30 animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </span>
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center">
                        <Circle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {!last && <span className={`w-0.5 flex-1 min-h-[18px] ${complete ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                  </div>
                  <div className="pb-5">
                    <p className={`text-xs font-bold ${complete ? 'text-emerald-800' : isCurrent ? 'text-sky-800' : 'text-slate-400'}`}>
                      {step.label}
                    </p>
                    {isCurrent && <p className="text-[10px] text-sky-600 font-semibold mt-0.5">Happening now</p>}
                  </div>
                </li>
              );
            })}
          </ol>

          {waypoints.length > 0 && (
            <div className="mt-2 pt-4 border-t border-slate-100">
              <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-2">Recent updates</h4>
              <ul className="space-y-1.5">
                {waypoints.map((w, i) => {
                  const label = firstStr(w, ['label', 'waypoint'], 'Update');
                  const time = firstStr(w, ['time']);
                  return (
                    <li key={`${time || i}-${i}`} className="text-[11px] text-slate-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span>
                        {label}
                        {time && <span className="text-slate-400 ml-1.5">· {formatDateTime(time)}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* POD photos (present when the transporter attached them) */}
      {status === 'delivered' && podPhotos.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-emerald-600" /> Delivery Proof
          </h3>
          {firstStr(pod, ['receiverName']) && (
            <p className="text-xs text-slate-600">
              Received by <strong>{firstStr(pod, ['receiverName'])}</strong>
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {podPhotos.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 hover:opacity-80 transition-opacity"
                title="Open photo in new tab"
              >
                <img src={url} alt="Delivery proof" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-slate-400">
        Auto-refreshes every 30 seconds
        {lastUpdated ? ` · last updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        {refreshing ? ' · updating…' : ''}
      </p>
    </div>
  );
};
