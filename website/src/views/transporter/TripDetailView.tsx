import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  Navigation,
  PackageCheck,
  RefreshCw,
  Scale,
  Share2,
  ShieldAlert,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import { transport, uploads, apiClient, apiErrorMessage, ApiError } from '../../lib/api';
import type { BookingRoute } from '../../lib/api/transport';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RouteMap } from '../../components/common/RouteMap';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { TransportBooking } from '../../types';
import { asArr, asRec, downloadJson, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

/**
 * Backend state machine (transport.py ALLOWED_TRANSITIONS) — Flipkart-style
 * granular chain. Intermediate steps are optional: accepted may skip straight
 * to enRoute, and reachedDestination may skip unloading to delivered.
 */
const TRIP_STEPS: { status: TransportBooking['status']; label: string }[] = [
  { status: 'accepted', label: 'Accepted' },
  { status: 'arrivedPickup', label: 'Reached pickup' },
  { status: 'loading', label: 'Loading' },
  { status: 'enRoute', label: 'In transit' },
  { status: 'reachedDestination', label: 'Reached destination' },
  { status: 'unloading', label: 'Unloading' },
  { status: 'delivered', label: 'Delivered' },
];

const ALLOWED_NEXT: Record<string, TransportBooking['status'][]> = {
  accepted: ['arrivedPickup', 'enRoute'],
  arrivedPickup: ['loading', 'enRoute'],
  loading: ['enRoute'],
  enRoute: ['reachedDestination', 'delivered'],
  reachedDestination: ['unloading', 'delivered'],
  unloading: ['delivered'],
};

const nextLabel = (status: string): string => TRIP_STEPS.find((s) => s.status === status)?.label ?? status;

const formatDuration = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const EXPENSE_CATEGORIES = [
  'diesel',
  'toll',
  'driver_bata',
  'loading_labor',
  'mandi_cess',
  'maintenance',
  'other',
];

/** /transporter/trips/:id — trip execution desk. */
export const TripDetailView: React.FC = () => {
  const { id = '' } = useParams();
  const [booking, setBooking] = useState<TransportBooking | null>(null);
  const [expenses, setExpenses] = useState<Rec[]>([]);
  const [disputes, setDisputes] = useState<Rec[]>([]);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [waitingPhase, setWaitingPhase] = useState<'pickup' | 'drop'>('pickup');
  const [wbModal, setWbModal] = useState(false);
  const [wbForm, setWbForm] = useState({ slipNo: '', weighbridgeName: 'धर्मकांटा', grossWeightKg: 0, tareWeightKg: 0, slipPhotoUrl: '', notes: '' });
  const [otpModal, setOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpReceiver, setOtpReceiver] = useState('');
  const [otpPhotos, setOtpPhotos] = useState<string[]>([]);
  const [otpUploadBusy, setOtpUploadBusy] = useState(false);
  const [deliveredModal, setDeliveredModal] = useState(false);
  const [podForm, setPodForm] = useState({ receiverName: '', receiverPhone: '', damageNotes: '' });
  const [podPhotos, setPodPhotos] = useState<string[]>([]);
  const [podUploadBusy, setPodUploadBusy] = useState(false);
  const [locModal, setLocModal] = useState(false);
  const [locForm, setLocForm] = useState({ lat: 0, lng: 0 });
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: 'diesel', amount: 0, notes: '', receiptPhotoUrl: '' });
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [disputeModal, setDisputeModal] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ kind: 'damage', notes: '', photos: '' });
  const [breakdownModal, setBreakdownModal] = useState(false);
  const [breakdownForm, setBreakdownForm] = useState({ note: '', location: '', completedDistanceKm: 0 });
  const [biltyData, setBiltyData] = useState<Rec | null>(null);
  const [route, setRoute] = useState<BookingRoute | null>(null);
  /** 'geo' = 422 GEO_REQUIRED (booking has no coordinates yet); 'error' = anything else. */
  const [routeState, setRouteState] = useState<'loading' | 'ready' | 'geo' | 'error'>('loading');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const b = await transport.booking(id);
      setBooking(b);
      setShareToken(b.shareToken ?? null);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    transport
      .expenses(id)
      .then((ex) => setExpenses(asArr(ex).map(asRec)))
      .catch(() => setExpenses([]));
    transport
      .reports(id)
      .then((d) => setDisputes(asArr(d).map(asRec)))
      .catch(() => setDisputes([]));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setRoute(null);
    setRouteState('loading');
    transport
      .getBookingRoute(id)
      .then((r) => {
        if (!alive) return;
        setRoute(r);
        setRouteState('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setRouteState(e instanceof ApiError && (e.code === 'GEO_REQUIRED' || e.status === 422) ? 'geo' : 'error');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const run = async (fn: () => Promise<unknown>, msg: string, close?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      flash(msg);
      close?.();
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const refreshExpenses = async () => {
    try {
      const ex = await transport.expenses(id);
      setExpenses(asArr(ex).map(asRec));
    } catch {
      setExpenses([]);
    }
  };

  /** File → POST /uploads → append the returned URL to the photo list. */
  const uploadPodPhoto = async (
    file: File | undefined,
    setUrls: React.Dispatch<React.SetStateAction<string[]>>,
    setUploadBusy: (b: boolean) => void
  ) => {
    if (!file) return;
    setUploadBusy(true);
    setError(null);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'pod', purpose: 'pod-photo' })) as {
        url?: string;
        fileUrl?: string;
      };
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      if (url) {
        setUrls((prev) => [...prev, url]);
        flash('Photo uploaded.');
      } else {
        setError('Upload succeeded but no URL was returned.');
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setUploadBusy(false);
    }
  };

  const currentIdx = booking ? TRIP_STEPS.findIndex((s) => s.status === booking.status) : -1;
  const nextSteps = booking ? (ALLOWED_NEXT[booking.status] ?? []) : [];

  if (loading && !booking) {
    return <div className="p-10 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">Loading trip…</div>;
  }

  if (!booking) {
    return (
      <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
        <p className="text-sm font-bold text-slate-700">Trip not found</p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <Link to="/transporter" className="text-xs text-emerald-700 font-bold hover:underline">← Back to Transporter Home</Link>
      </div>
    );
  }

  const crop = booking.commodity || booking.cargoCrop || 'Cargo';
  const pickup = booking.pickup || booking.pickupAddress;
  const drop = booking.drop || booking.dropAddress;
  const origin = booking.pickupGeo ?? booking.pickupCoords ?? null;
  const destination = booking.dropGeo ?? booking.dropCoords ?? null;
  const fare = booking.fare ?? booking.estimatedFare ?? 0;
  const weight = booking.weightQuintals ?? booking.cargoWeightQuintal ?? 0;
  const wbNet = wbForm.grossWeightKg - wbForm.tareWeightKg;
  const podVerified = !!booking.podOtp?.verifiedAt;
  const shareUrl = shareToken ? `${window.location.origin}/track/${shareToken}` : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter/trips" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Trips
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Trip {booking.id}
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {pickup} → {drop}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <StatusBadge status={booking.status} />
          <button onClick={load} className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary + actions grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-white rounded-2xl border border-slate-200/80">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Cargo</span>
          <p className="font-bold text-slate-900">{crop} {weight > 0 ? `(${formatWeight(weight)})` : ''}</p>
        </div>
        <div className="p-3 bg-white rounded-2xl border border-slate-200/80">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Fare</span>
          <p className="font-bold text-emerald-800">{formatCurrency(fare)}</p>
        </div>
        <div className="p-3 bg-white rounded-2xl border border-slate-200/80">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Waiting Charges</span>
          <p className="font-bold text-amber-700">{formatCurrency((booking.waitingChargePaisa || 0) / 100)}</p>
        </div>
        <div className="p-3 bg-white rounded-2xl border border-slate-200/80">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Pickup</span>
          <p className="font-bold text-slate-900">{fmtDate(booking.date ?? booking.pickupTime)}</p>
        </div>
      </div>

      {/* Route map — polyline + pickup/drop pins; degrades to a hint card when the
          booking has no coordinates (422 GEO_REQUIRED) or no API key is set. */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-600" /> Route
          </h3>
          {route && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {Math.round(route.distanceKm)} km · ~{formatDuration(route.durationMin)}
            </span>
          )}
        </div>
        <RouteMap
          origin={origin}
          destination={destination}
          polyline={route?.polyline ?? null}
          bounds={route?.bounds ?? null}
          distanceKm={route?.distanceKm ?? booking.distanceKm}
          durationMin={route?.durationMin ?? null}
          hint={routeState === 'geo' ? 'Route available once pickup/drop pins are set.' : null}
        />
      </div>

      {/* Waypoint timeline */}
      {booking.waypointsLog && booking.waypointsLog.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <h3 className="font-bold text-sm text-slate-900">Trip Timeline</h3>
          <div className="flex flex-wrap gap-2">
            {booking.waypointsLog.slice(-8).map((w, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-200">
                {w.label || w.waypoint} • {fmtDate(w.time)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status — granular 7-step chain with per-status transition buttons */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Trip Status</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {TRIP_STEPS.map((s, i) => {
              const reached = currentIdx >= 0 && i <= currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <React.Fragment key={s.status}>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      isCurrent
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : reached
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {s.label}
                  </span>
                  {i < TRIP_STEPS.length - 1 && <span className="text-slate-300">→</span>}
                </React.Fragment>
              );
            })}
          </div>
          {podVerified && <p className="text-[11px] text-emerald-700 font-bold">POD OTP verified</p>}
          {nextSteps.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Next:</span>
              {nextSteps.map((s) => (
                <button
                  key={s}
                  onClick={() => run(() => transport.updateBooking(id, { status: s }), `Status updated to ${nextLabel(s)}.`)}
                  disabled={busy}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
                >
                  Mark {nextLabel(s)}
                </button>
              ))}
            </div>
          ) : (
            ['delivered', 'completed'].includes(booking.status) && (
              <p className="text-[11px] text-emerald-700 font-bold">Trip delivered — collect the agreed fare directly from the farmer. Agrovercity is not part of the payment.</p>
            )
          )}
          <p className="text-[10px] text-slate-400">
            Steps are optional — you can skip from Accepted straight to In transit, and from Reached destination straight
            to Delivered. Delivery also files the POD (photos + receiver name).
          </p>
        </div>

        {/* Location ping */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Live Location Ping</h3>
          <p className="text-xs text-slate-400">
            {booking.currentLat != null && booking.currentLng != null
              ? `Last known: ${booking.currentLat.toFixed(4)}, ${booking.currentLng.toFixed(4)}`
              : 'No location pings yet for this trip.'}
          </p>
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => setLocForm({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => setLocModal(true)
                );
              }
              setLocModal(true);
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5" /> Ping Current Location
          </button>
        </div>

        {/* Waiting (FT-2): start/stop timer events */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" /> Detention / Waiting (FT-2)
          </h3>
          <p className="text-xs text-slate-400">
            60 free minutes, then auto-billed slabs (cap ₹2,000). Waiting so far: {booking.waitingHours || 0} hrs.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={waitingPhase}
              onChange={(e) => setWaitingPhase(e.target.value as 'pickup' | 'drop')}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold"
            >
              <option value="pickup">Pickup</option>
              <option value="drop">Drop</option>
            </select>
            <button
              onClick={() => run(() => transport.logWaiting(id, { phase: waitingPhase, action: 'start' }), 'Waiting timer started.')}
              disabled={busy || currentIdx < 0 || currentIdx >= TRIP_STEPS.length - 1}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs disabled:opacity-60"
            >
              Start Timer
            </button>
            <button
              onClick={() => run(() => transport.logWaiting(id, { phase: waitingPhase, action: 'stop' }), 'Waiting timer stopped — detention billed.')}
              disabled={busy}
              className="px-4 py-2 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 font-bold text-xs disabled:opacity-60"
            >
              Stop Timer
            </button>
          </div>
        </div>

        {/* Weighbridge */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-sky-600" /> Weighbridge Slip
          </h3>
          <p className="text-xs text-slate-400">Record gross/tare weights to settle charged-weight disputes.</p>
          <button onClick={() => setWbModal(true)} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs">
            Enter Weighbridge Slip
          </button>
        </div>

        {/* POD */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-emerald-600" /> Proof of Delivery (POD)
          </h3>
          <p className="text-xs text-slate-400">
            The shipper reveals the 6-digit POD OTP in their app and reads it to you at drop. Enter it here — delivery
            photos + receiver name are filed with it.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setOtpInput('');
                setOtpReceiver('');
                setOtpPhotos([]);
                setOtpModal(true);
              }}
              disabled={busy || !['enRoute', 'reachedDestination', 'unloading'].includes(booking.status) || podVerified}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
            >
              {podVerified ? 'POD Verified ✓' : 'Verify POD OTP'}
            </button>
            <button
              onClick={() => {
                setPodForm({ receiverName: '', receiverPhone: '', damageNotes: '' });
                setPodPhotos([]);
                setDeliveredModal(true);
              }}
              disabled={busy || !['enRoute', 'reachedDestination', 'unloading'].includes(booking.status)}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs disabled:opacity-60"
            >
              Mark Delivered (photos + receiver)…
            </button>
          </div>
        </div>

        {/* Bilty + share */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Bilty & Sharing</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                run(async () => {
                  setBiltyData(asRec(await transport.bilty(id)));
                }, 'Bilty fetched.')
              }
              disabled={busy}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" /> View Bilty
            </button>
            <button
              onClick={() =>
                run(async () => {
                  const res = await transport.shareBooking(id);
                  setShareToken(res.token);
                }, 'Share link created.')
              }
              disabled={busy}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> {shareToken ? 'Re-generate Share Link' : 'Create Share Link'}
            </button>
          </div>
          {shareUrl && (
            <div className="flex items-center gap-2">
              <input readOnly value={shareUrl} className="flex-1 px-3 py-2 text-[11px] rounded-xl border border-slate-200 bg-slate-50 font-mono" onFocus={(e) => e.target.select()} />
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(shareUrl);
                  flash('Share link copied.');
                }}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                Copy
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-rose-600" /> Trip Expenses
          </h3>
          <button onClick={() => setExpenseModal(true)} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
            Add Expense
          </button>
        </div>
        {expenses.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No expenses logged for this trip.</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((ex) => (
              <div key={str(ex.id) || JSON.stringify(ex).slice(0, 24)} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                <div>
                  <p className="font-bold text-slate-800">{firstStr(ex, ['category', 'type', 'title'], 'Expense').replace(/_/g, ' ')}</p>
                  <p className="text-slate-400">{str(ex.notes ?? ex.note, '') !== '—' ? str(ex.notes ?? ex.note) : fmtDate(ex.createdAt)}</p>
                </div>
                <span className="font-bold text-rose-700">{formatCurrency(firstNum(ex, ['amount'], 0))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trip reports + incidents (support cases — direct-connect, no funds held) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" /> Trip Reports
            </h3>
            <button onClick={() => setDisputeModal(true)} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs">
              File Report
            </button>
          </div>
          {disputes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No reports on this trip.</p>
          ) : (
            <div className="space-y-2">
              {disputes.map((d) => (
                <div key={str(d.id) || JSON.stringify(d).slice(0, 24)} className="p-3 bg-slate-50 rounded-2xl text-xs flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{str(d.kind, 'damage')}</p>
                    <p className="text-slate-400">{str(d.note, '') !== '—' ? str(d.note).slice(0, 80) : ''}</p>
                  </div>
                  <StatusBadge status={str(d.status, 'open')} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-600" /> Vehicle Breakdown
          </h3>
          <p className="text-xs text-slate-400">Report a breakdown to notify the shipper. Under direct-connect you settle the partial leg directly with the farmer — no platform pro-rata.</p>
          <button onClick={() => setBreakdownModal(true)} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs">
            Report Breakdown
          </button>
        </div>
      </div>

      {/* Cancel — transporter cancels via PATCH (accepted → cancelled). The
          POST /cancel lane is booker-only and would 403 here. */}
      {['accepted', 'requested', 'pending'].includes(booking.status) && (
        <div className="bg-white rounded-3xl p-6 border border-rose-200 shadow-xs">
          <p className="text-xs text-slate-500 mb-3">
            Cancelling inside the pickup window records a no-show strike (3 strikes = load-board suspension).
          </p>
          <button onClick={() => setCancelModal(true)} className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs">
            Cancel This Trip…
          </button>
        </div>
      )}

      {/* --- Modals --- */}

      <ModalSheet isOpen={wbModal} onClose={() => setWbModal(false)} title="Weighbridge Slip" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                transport.weighbridge(id, {
                  slipNo: wbForm.slipNo,
                  weighbridgeName: wbForm.weighbridgeName,
                  grossWeightKg: wbForm.grossWeightKg,
                  tareWeightKg: wbForm.tareWeightKg,
                  netWeightKg: wbNet,
                  slipPhotoUrl: wbForm.slipPhotoUrl || undefined,
                  notes: wbForm.notes || undefined,
                }),
              'Weighbridge slip recorded.',
              () => setWbModal(false)
            );
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Slip No.</label>
              <input type="text" value={wbForm.slipNo} onChange={(e) => setWbForm({ ...wbForm, slipNo: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Weighbridge</label>
              <input type="text" value={wbForm.weighbridgeName} onChange={(e) => setWbForm({ ...wbForm, weighbridgeName: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Gross (kg)</label>
              <input type="number" value={wbForm.grossWeightKg} onChange={(e) => setWbForm({ ...wbForm, grossWeightKg: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tare (kg)</label>
              <input type="number" value={wbForm.tareWeightKg} onChange={(e) => setWbForm({ ...wbForm, tareWeightKg: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl text-xs flex justify-between">
            <span className="text-slate-500">Net weight</span>
            <span className="font-bold text-slate-900">{wbNet.toLocaleString('en-IN')} kg ({(wbNet / 100).toFixed(2)} q)</span>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Slip photo URL (optional)</label>
            <input type="url" value={wbForm.slipPhotoUrl} onChange={(e) => setWbForm({ ...wbForm, slipPhotoUrl: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <input type="text" value={wbForm.notes} onChange={(e) => setWbForm({ ...wbForm, notes: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs disabled:opacity-60">
            Save Weighbridge Slip
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={otpModal} onClose={() => setOtpModal(false)} title="Verify POD OTP" description="The shipper reveals the 6-digit OTP in their app and reads it to you at drop — photos and receiver name are mandatory with it" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                apiClient.post(`/transport/bookings/${id}/verify-pod-otp`, {
                  otp: otpInput,
                  receiverName: otpReceiver.trim(),
                  podPhotos: otpPhotos,
                }),
              'POD verified — trip delivered.',
              () => {
                setOtpModal(false);
                setOtpInput('');
              }
            );
          }}
          className="space-y-3"
        >
          <input
            type="text"
            inputMode="numeric"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full px-3 py-3 text-center text-xl font-black tracking-[0.5em] rounded-xl border border-slate-300"
            placeholder="••••••"
            required
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Receiver name</label>
            <input type="text" value={otpReceiver} onChange={(e) => setOtpReceiver(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Delivery photos (at least one)</label>
            <input
              type="file"
              accept="image/*"
              disabled={otpUploadBusy}
              onChange={(e) => {
                void uploadPodPhoto(e.target.files?.[0], setOtpPhotos, setOtpUploadBusy);
                e.target.value = '';
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            />
            {otpPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {otpPhotos.map((u) => (
                  <span key={u} className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-[10px] font-mono text-emerald-800 truncate max-w-full">
                    {u.split('/').pop()}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            OTP not accepted? Ask the shipper to reveal it again (it expires after a fixed window).
          </p>
          <button type="submit" disabled={busy || otpInput.length !== 6 || otpPhotos.length === 0} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            Verify OTP & Mark Delivered
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={deliveredModal} onClose={() => setDeliveredModal(false)} title="Mark Delivered (POD)" description="Delivery requires at least one photo and the receiver name (422 POD_REQUIRED otherwise)" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                transport.updateBooking(id, {
                  status: 'delivered',
                  receiverName: podForm.receiverName.trim(),
                  receiverPhone: podForm.receiverPhone.trim() || undefined,
                  podPhotos,
                  damageNotes: podForm.damageNotes.trim() || undefined,
                }),
              'Trip marked delivered.',
              () => setDeliveredModal(false)
            );
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Receiver name</label>
            <input type="text" value={podForm.receiverName} onChange={(e) => setPodForm({ ...podForm, receiverName: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Receiver phone (optional)</label>
            <input type="tel" value={podForm.receiverPhone} onChange={(e) => setPodForm({ ...podForm, receiverPhone: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Delivery photos (at least one)</label>
            <input
              type="file"
              accept="image/*"
              disabled={podUploadBusy}
              onChange={(e) => {
                void uploadPodPhoto(e.target.files?.[0], setPodPhotos, setPodUploadBusy);
                e.target.value = '';
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            />
            {podPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {podPhotos.map((u) => (
                  <span key={u} className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-[10px] font-mono text-emerald-800 truncate max-w-full">
                    {u.split('/').pop()}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Damage notes (optional)</label>
            <input type="text" value={podForm.damageNotes} onChange={(e) => setPodForm({ ...podForm, damageNotes: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <button type="submit" disabled={busy || podPhotos.length === 0} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            Mark Delivered
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={locModal} onClose={() => setLocModal(false)} title="Ping Location" maxWidth="sm">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
              <input type="number" step="any" value={locForm.lat} onChange={(e) => setLocForm({ ...locForm, lat: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
              <input type="number" step="any" value={locForm.lng} onChange={(e) => setLocForm({ ...locForm, lng: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
          </div>
          <button
            onClick={() => run(() => transport.updateLocation(id, locForm.lat, locForm.lng), 'Location pinged.', () => setLocModal(false))}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
          >
            Send Location Ping
          </button>
        </div>
      </ModalSheet>

      <ModalSheet isOpen={expenseModal} onClose={() => setExpenseModal(false)} title="Add Trip Expense" maxWidth="sm">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await transport.addExpense(id, {
                category: expenseForm.category,
                amount: expenseForm.amount,
                notes: expenseForm.notes || undefined,
                receiptPhotoUrl: expenseForm.receiptPhotoUrl || undefined,
              });
              setExpenseModal(false);
              setExpenseForm({ category: 'diesel', amount: 0, notes: '', receiptPhotoUrl: '' });
              flash('Expense added.');
              await refreshExpenses();
            } catch (err) {
              setError(apiErrorMessage(err));
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
            <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
            <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
            <input type="text" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Receipt photo URL (optional)</label>
            <input type="url" value={expenseForm.receiptPhotoUrl} onChange={(e) => setExpenseForm({ ...expenseForm, receiptPhotoUrl: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
            Add Expense
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={cancelModal} onClose={() => setCancelModal(false)} title="Cancel Trip" description="Cancelling inside the pickup window records a no-show strike" maxWidth="sm">
        <div className="space-y-3">
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            placeholder="Reason for cancellation…"
          />
          <button
            onClick={() =>
              run(
                () => transport.updateBooking(id, { status: 'cancelled' }),
                'Trip cancelled.',
                () => {
                  setCancelModal(false);
                  setCancelReason('');
                }
              )
            }
            disabled={busy}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-60"
          >
            Confirm Cancellation
          </button>
        </div>
      </ModalSheet>

      <ModalSheet isOpen={disputeModal} onClose={() => setDisputeModal(false)} title="File a Trip Report" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await transport.openReport(id, {
                kind: disputeForm.kind,
                note: disputeForm.notes,
                photos: disputeForm.photos.split(',').map((u) => u.trim()).filter(Boolean),
              });
              const d = await transport.reports(id);
              setDisputes(asArr(d).map(asRec));
            }, 'Report filed — support will follow up. Settle any money matters directly with the farmer.', () => {
              setDisputeModal(false);
              setDisputeForm({ kind: 'damage', notes: '', photos: '' });
            });
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Report kind</label>
            <select
              value={disputeForm.kind}
              onChange={(e) => setDisputeForm({ ...disputeForm, kind: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            >
              <option value="damage">Cargo damage</option>
              <option value="payment">Payment issue</option>
              <option value="behaviour">Behaviour / conduct</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Evidence photo URLs (comma separated)</label>
            <input type="text" value={disputeForm.photos} onChange={(e) => setDisputeForm({ ...disputeForm, photos: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">What happened?</label>
            <textarea value={disputeForm.notes} onChange={(e) => setDisputeForm({ ...disputeForm, notes: e.target.value })} rows={3} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required minLength={3} />
          </div>
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-60">
            Submit Report
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={breakdownModal} onClose={() => setBreakdownModal(false)} title="Report Breakdown" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                transport.reportBreakdown(id, {
                  note: breakdownForm.note,
                  location: breakdownForm.location || undefined,
                  completedDistanceKm: breakdownForm.completedDistanceKm || undefined,
                }),
              'Breakdown reported. Shipper notified.',
              () => {
                setBreakdownModal(false);
                setBreakdownForm({ note: '', location: '', completedDistanceKm: 0 });
              }
            );
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">What happened</label>
            <textarea value={breakdownForm.note} onChange={(e) => setBreakdownForm({ ...breakdownForm, note: e.target.value })} rows={2} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="Clutch failure, waiting for mechanic…" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Current location</label>
            <input type="text" value={breakdownForm.location} onChange={(e) => setBreakdownForm({ ...breakdownForm, location: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="NH-48, km 112 near Satara" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Distance covered (km)</label>
            <input type="number" value={breakdownForm.completedDistanceKm} onChange={(e) => setBreakdownForm({ ...breakdownForm, completedDistanceKm: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs disabled:opacity-60">
            Report Breakdown
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={!!biltyData} onClose={() => setBiltyData(null)} title={`Bilty — ${id}`} description="Digital lorry receipt (print or save as PDF)" maxWidth="md">
        {biltyData && (
          <div className="space-y-3">
            <div className="space-y-2">
              {Object.entries(biltyData).map(([k, v]) => (
                <div key={k} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                  <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="font-bold text-slate-900 text-right max-w-[60%]">{typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs no-print">
                Print / Save PDF
              </button>
              <button onClick={() => downloadJson(`bilty-${id}.json`, biltyData)} className="flex-1 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs">
                Download JSON
              </button>
            </div>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
