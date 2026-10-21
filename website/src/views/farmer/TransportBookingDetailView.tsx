import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Check,
  Circle,
  Clock,
  Copy,
  Download,
  FileText,
  Handshake,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  Repeat,
  Share2,
  ShieldCheck,
  Star,
  Truck,
  User,
  XCircle,
} from 'lucide-react';
import { transport, chat, ratings, apiErrorMessage, ApiError } from '../../lib/api';
import type { BookingRoute } from '../../lib/api/transport';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RateUserModal } from '../../components/common/RateUserModal';
import { RouteMap } from '../../components/common/RouteMap';
import { formatCurrency, formatDateTime, formatWeight } from '../../lib/utils';
import type { TransportBooking } from '../../types';

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

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
const firstNum = (r: Record<string, unknown>, keys: string[], fb = 0): number => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return fb;
};

/**
 * Backend state machine (transport.py ALLOWED_TRANSITIONS) — Flipkart-style
 * 7-step delivery chain. Intermediate steps are skippable (accepted → enRoute,
 * reachedDestination → delivered).
 */
const TRIP_STEPS: { status: TransportBooking['status']; label: string }[] = [
  { status: 'accepted', label: 'Transporter assigned' },
  { status: 'arrivedPickup', label: 'Vehicle arrived for pickup' },
  { status: 'loading', label: 'Product loading' },
  { status: 'enRoute', label: 'In transit' },
  { status: 'reachedDestination', label: 'Reached destination' },
  { status: 'unloading', label: 'Unloading' },
  { status: 'delivered', label: 'Delivered' },
];

const stepIndex = (status: string): number => TRIP_STEPS.findIndex((s) => s.status === status);

const formatDuration = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

interface BookingOffer {
  offerId: string;
  fromRole: string;
  farePaise: number;
  message: string;
  round: number;
  status: string;
  createdAt: string;
}

const offerFrom = (o: unknown): BookingOffer => {
  const r = asRecord(o);
  return {
    offerId: firstStr(r, ['offerId', 'id']),
    fromRole: firstStr(r, ['fromRole'], 'transporter'),
    farePaise: firstNum(r, ['farePaise'], 0),
    message: firstStr(r, ['message']),
    round: firstNum(r, ['round'], 0),
    status: firstStr(r, ['status'], 'pending'),
    createdAt: firstStr(r, ['createdAt']),
  };
};

/** Vertical Flipkart-style stepper. Steps before `current` are complete. */
const TripStepper: React.FC<{ status: TransportBooking['status'] }> = ({ status }) => {
  const current = stepIndex(status);
  return (
    <ol className="space-y-0">
      {TRIP_STEPS.map((step, i) => {
        const complete = current > i || status === 'delivered';
        const isCurrent = i === current && status !== 'delivered';
        const last = i === TRIP_STEPS.length - 1;
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
              {isCurrent && <p className="text-[10px] text-sky-600 font-semibold mt-0.5">Current stage — live updates as the driver moves</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

/** /farmer/transport/:id — booking detail, live stepper, fare negotiation & actions. */
export const TransportBookingDetailView: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<TransportBooking | null>(null);
  const [offers, setOffers] = useState<BookingOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Share / cancel / counter modals
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [counterOffer, setCounterOffer] = useState<BookingOffer | null>(null);
  const [counterFare, setCounterFare] = useState(0);
  const [counterMessage, setCounterMessage] = useState('');
  // SR 5: rate the transporter once the trip is delivered
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [transporterRated, setTransporterRated] = useState(false);
  const [route, setRoute] = useState<BookingRoute | null>(null);
  /** 'geo' = 422 GEO_REQUIRED (booking has no coordinates yet); 'error' = anything else. */
  const [routeState, setRouteState] = useState<'loading' | 'ready' | 'geo' | 'error'>('loading');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [b, o, given] = await Promise.all([
        transport.booking(id),
        transport.bookingOffers(id).catch(() => [] as unknown[]),
        ratings.given().catch(() => [] as unknown[]),
      ]);
      setBooking(b);
      setOffers(asArr(o).map(offerFrom));
      const mine = asArr(given) as { bookingKind?: string; bookingId?: string }[];
      setTransporterRated(mine.some((g) => g.bookingKind === 'transport' && g.bookingId === b.id));
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

  const refreshOffers = () =>
    transport
      .bookingOffers(id)
      .then((o) => setOffers(asArr(o).map(offerFrom)))
      .catch(() => undefined);

  const pickup = booking?.pickupAddress || booking?.pickup || '—';
  const drop = booking?.dropAddress || booking?.drop || '—';
  const cargo = booking?.cargoCrop || booking?.commodity || 'Cargo';
  const weight = booking?.cargoWeightQuintal ?? booking?.weightQuintals ?? 0;
  const fareRupees = booking
    ? booking.farePaise
      ? booking.farePaise / 100
      : booking.fare ?? booking.estimatedFare
    : 0;

  // --- actions ---

  const openChat = async () => {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const room = asRecord(await chat.openDirect({ bookingId: booking.id }));
      const roomId = firstStr(room, ['id', 'roomId']);
      if (roomId) navigate(`/chat?room=${roomId}`);
      else setError('Chat room could not be opened. Please try again.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRebook = async () => {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      // RebookRequest.date is required — reuse the original trip date when
      // present, otherwise schedule exactly one week out.
      const fallback = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const date = (booking.date || booking.pickupTime || '').slice(0, 10) || fallback;
      const created = asRecord(await transport.rebook(booking.id, { date }));
      const newId = firstStr(created, ['id']);
      setNotice(newId ? `Rebooked as trip #${newId}.` : 'Trip rebooked.');
      if (newId) navigate(`/farmer/transport/${newId}`);
      else await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      await transport.cancelBooking(booking.id, cancelReason.trim() || 'Cancelled by farmer');
      setCancelModalOpen(false);
      setNotice('Booking cancelled.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // --- fare payment (P0-1): order → Razorpay checkout → verify → escrow held ---
  const escrowRec = asRecord((booking as unknown as Record<string, unknown> | null)?.escrow);
  const escrowStatus = firstStr(escrowRec, ['status']);
  const insuranceRec = asRecord((booking as unknown as Record<string, unknown> | null)?.insurance);
  const insurancePremiumPaisa = firstNum(insuranceRec, ['premiumPaisa'], booking?.insurancePremiumPaisa ?? 0);
  const payableRupees = fareRupees + insurancePremiumPaisa / 100;
  // Backend PAYMENT_CLOSED_STATUSES: cancelled / delivered / breakdown.
  const paymentClosed = ['cancelled', 'delivered', 'breakdown'].includes(booking?.status ?? '');
  const escrowHeld = escrowStatus === 'held' || escrowStatus === 'released';
  const payable = !!booking && !paymentClosed && !escrowHeld;

  const startRazorpay = (orderId: string, amountPaisa: number, currency: string, keyId: string): Promise<boolean> =>
    new Promise((resolve) => {
      const rzp = new window.Razorpay!({
        key: keyId,
        order_id: orderId,
        amount: amountPaisa,
        currency,
        name: 'Agrovercity Kisan Setu',
        description: `Trip fare #${booking?.id ?? ''}`,
        theme: { color: '#059669' },
        handler: (resp: RazorpayResponse) => {
          transport
            .payBooking(booking!.id, {
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            })
            .then(() => resolve(true))
            .catch((err: unknown) => {
              setError(apiErrorMessage(err));
              resolve(false);
            });
        },
        modal: { ondismiss: () => resolve(false) },
      });
      rzp.open();
    });

  const handlePayFare = async () => {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const order = asRecord(await transport.payBooking(booking.id, {}));
      const orderId = firstStr(order, ['orderId']);
      const amountPaisa = firstNum(order, ['amountPaisa'], 0);
      const keyId = firstStr(order, ['keyId']);
      if (!orderId || amountPaisa <= 0) {
        setError('Could not create the payment order — please retry.');
        return;
      }
      if (!window.Razorpay || !keyId) {
        setError('Online fare payment is not enabled yet — please pay the transporter directly on delivery.');
        return;
      }
      const paid = await startRazorpay(orderId, amountPaisa, firstStr(order, ['currency'], 'INR'), keyId);
      if (paid) {
        setNotice('Payment secured — the fare is held in escrow until delivery.');
        await load();
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openShare = async () => {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const res = asRecord(await transport.shareBooking(booking.id));
      const token = firstStr(res, ['token']);
      if (token) {
        setShareToken(token);
        setShareModalOpen(true);
      } else {
        setError('Could not generate the tracking link.');
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/track/${shareToken}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const downloadReceipt = async () => {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await transport.bookingReceiptPdf(booking.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${booking.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const respondOffer = async (offer: BookingOffer, action: 'accept' | 'decline') => {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      await transport.respondBookingOffer(booking.id, offer.offerId, action);
      setNotice(action === 'accept' ? `Accepted ₹${(offer.farePaise / 100).toFixed(0)} — fare locked for this trip.` : 'Offer declined.');
      await Promise.all([load(), refreshOffers()]);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openCounter = (offer: BookingOffer) => {
    setCounterOffer(offer);
    setCounterFare(offer.farePaise / 100);
    setCounterMessage('');
  };

  const submitCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !counterOffer) return;
    setBusy(true);
    setError(null);
    try {
      await transport.respondBookingOffer(booking.id, counterOffer.offerId, 'counter', {
        farePaise: Math.round(counterFare * 100),
        ...(counterMessage.trim() ? { message: counterMessage.trim() } : {}),
      });
      setCounterOffer(null);
      setNotice('Counter offer sent — the transporter will respond shortly.');
      await refreshOffers();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitTransporterRating = async (stars: number, review: string) => {
    if (!booking) return;
    await ratings.submit({
      bookingKind: 'transport',
      bookingId: booking.id,
      stars,
      ...(review ? { comment: review } : {}),
    });
    setRateModalOpen(false);
    setTransporterRated(true);
    setNotice('Thanks! Your rating helps other farmers choose reliable transporters.');
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs font-bold text-slate-400 animate-pulse">
        Loading trip details…
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="p-6 bg-white rounded-3xl border border-slate-200/80 text-center">
          <p className="text-xs font-semibold text-rose-600">{error || 'Trip not found.'}</p>
        </div>
      </div>
    );
  }

  const podPhotos = booking.pod?.photos ?? [];
  const waypoints = (booking.waypointsLog ?? []).slice(-8).reverse();

  return (
    <div className="space-y-6">
      <BackLink />

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

      {/* Cancelled banner */}
      {booking.status === 'cancelled' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-3xl flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm text-rose-900">This booking was cancelled</h3>
            <p className="text-xs text-rose-700 mt-0.5">
              {booking.cancellationReason
                ? `Reason: ${booking.cancellationReason}`
                : 'No reason recorded.'}
              {booking.cancelledBy ? ` · Cancelled by ${booking.cancelledBy}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-slate-900">
                {cargo}
                {weight > 0 && <span className="text-slate-500 font-bold"> ({formatWeight(weight)})</span>}
              </h1>
              <p className="text-xs text-slate-500">
                {booking.vehicleType} · <span className="font-mono">#{booking.id}</span>
              </p>
            </div>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Route
            </span>
            <p className="font-bold text-slate-900">{pickup}</p>
            <p className="text-slate-500">↓ {drop}</p>
            {booking.distanceKm > 0 && <p className="text-slate-500">{booking.distanceKm} km</p>}
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-sky-600" /> Schedule & Fare
            </span>
            <p className="font-bold text-slate-900">
              {booking.pickupTime ? formatDateTime(booking.pickupTime) : booking.date || '—'}
              {booking.timeWindowMinutes ? ` (±${booking.timeWindowMinutes} min)` : ''}
            </p>
            <p className="font-bold text-emerald-800">{formatCurrency(fareRupees)}</p>
            {booking.insuranceOptIn && (
              <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Transit insurance opted in
              </p>
            )}
          </div>
        </div>

        {/* Transporter / driver block */}
        {booking.transporterName ? (
          <div className="p-3 bg-sky-50 border border-sky-100 rounded-2xl flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <Handshake className="w-4 h-4 text-sky-700" /> {booking.transporterName}
            </span>
            {booking.driverName && (
              <span className="flex items-center gap-1.5 text-slate-600">
                <User className="w-3.5 h-3.5" /> Driver: <strong>{booking.driverName}</strong>
              </span>
            )}
            {booking.driverPhone && (
              <a href={`tel:${booking.driverPhone}`} className="flex items-center gap-1.5 text-emerald-700 font-bold hover:underline">
                <Phone className="w-3.5 h-3.5" /> {booking.driverPhone}
              </a>
            )}
            {booking.vehicleNo && (
              <span className="font-mono bg-white border border-sky-200 px-2 py-0.5 rounded-md">{booking.vehicleNo}</span>
            )}
          </div>
        ) : (
          booking.status === 'requested' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-amber-800">
              <Clock className="w-4 h-4 flex-shrink-0" />
              Awaiting transporter — nearby transporters are being notified of your load.
            </div>
          )
        )}
      </div>

      {/* Route map — polyline + pickup/drop pins; degrades to a hint card when the
          booking has no coordinates (422 GEO_REQUIRED) or no API key is set. */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" /> Route
          </h3>
          {route && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {Math.round(route.distanceKm)} km · ~{formatDuration(route.durationMin)}
            </span>
          )}
        </div>
        <RouteMap
          origin={booking.pickupGeo ?? booking.pickupCoords ?? null}
          destination={booking.dropGeo ?? booking.dropCoords ?? null}
          polyline={route?.polyline ?? null}
          bounds={route?.bounds ?? null}
          distanceKm={route?.distanceKm ?? booking.distanceKm}
          durationMin={route?.durationMin ?? null}
          hint={routeState === 'geo' ? 'Route available once pickup/drop pins are set.' : null}
        />
      </div>

      {/* Stepper + milestone log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-4">Delivery Progress</h3>
          {booking.status === 'requested' ? (
            <div className="flex items-start gap-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
              <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Awaiting transporter.</strong> The 7-step tracker activates as soon as a transporter
                accepts your booking.
              </span>
            </div>
          ) : booking.status === 'cancelled' ? (
            <div className="flex items-start gap-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl p-3.5">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Cancelled trips stop here — no delivery stages were completed.</span>
            </div>
          ) : (
            <TripStepper status={booking.status} />
          )}

          {waypoints.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-2">Recent milestones</h4>
              <ul className="space-y-1.5">
                {waypoints.map((w, i) => (
                  <li key={`${w.time ?? i}-${i}`} className="text-[11px] text-slate-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <span>
                      {w.label || w.waypoint}
                      {w.time && <span className="text-slate-400 ml-1.5">· {formatDateTime(w.time)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column: offers / POD */}
        <div className="space-y-4">
          {/* Offers & negotiation */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Offers & Negotiation</h3>
              {booking.offerRound ? (
                <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                  Round {booking.offerRound}
                </span>
              ) : null}
            </div>

            {offers.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                {booking.status === 'requested'
                  ? 'No transporter offers yet — quotes will appear here as transporters respond.'
                  : 'No fare negotiation happened on this trip.'}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {offers.map((o) => {
                  const pending = o.status === 'pending' && o.fromRole === 'transporter' && booking.status === 'requested';
                  return (
                    <li key={o.offerId} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-700">
                          {o.fromRole === 'transporter' ? 'Transporter' : 'You (farmer)'} · Round {o.round}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            o.status === 'accepted'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : o.status === 'pending'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold text-slate-900">{formatCurrency(o.farePaise / 100)}</p>
                      {o.message && <p className="text-[11px] text-slate-500 italic">“{o.message}”</p>}
                      {pending && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => respondOffer(o, 'accept')}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => respondOffer(o, 'decline')}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-bold disabled:opacity-50"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => openCounter(o)}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-bold disabled:opacity-50"
                          >
                            Counter
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {(booking.farePaise || booking.fare) && booking.status !== 'requested' && (
              <p className="text-[11px] font-bold text-emerald-700 pt-1 border-t border-slate-100">
                Final agreed fare: {formatCurrency(fareRupees)}
              </p>
            )}
          </div>

          {/* Proof of delivery */}
          {booking.status === 'delivered' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-600" /> Proof of Delivery
              </h3>
              {booking.pod?.receiverName && (
                <p className="text-xs text-slate-600">
                  Received by <strong>{booking.pod.receiverName}</strong>
                  {booking.pod.deliveredAt ? ` · ${formatDateTime(booking.pod.deliveredAt)}` : ''}
                </p>
              )}
              {podPhotos.length === 0 ? (
                <p className="text-[11px] text-slate-400">No delivery photos attached by the transporter.</p>
              ) : (
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-3">Actions</h3>
        <div className="flex flex-wrap items-center gap-2.5">
          {escrowHeld && (
            <span className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              {escrowStatus === 'released'
                ? 'Fare released to the transporter'
                : `Fare held in escrow${firstNum(escrowRec, ['amountPaisa'], 0) > 0 ? ` — ${formatCurrency(firstNum(escrowRec, ['amountPaisa'], 0) / 100)}` : ''}`}
            </span>
          )}

          {payable && (
            <button
              onClick={handlePayFare}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Banknote className="w-4 h-4" />
              Pay Fare {formatCurrency(payableRupees)}
            </button>
          )}

          {booking.transporterId && (
            <button
              onClick={openChat}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <MessageCircle className="w-4 h-4" />
              Chat with Transporter
            </button>
          )}

          {(booking.status === 'delivered' || booking.status === 'cancelled') && (
            <button
              onClick={handleRebook}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Repeat className="w-4 h-4" />
              Repeat Booking
            </button>
          )}

          {booking.status === 'requested' && (
            <button
              onClick={() => setCancelModalOpen(true)}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Cancel Booking
            </button>
          )}

          {booking.status !== 'cancelled' && (
            <button
              onClick={openShare}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              Share Tracking Link
            </button>
          )}

          {booking.status === 'delivered' && (
            <button
              onClick={downloadReceipt}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Download Receipt (PDF)
            </button>
          )}

          {booking.status === 'delivered' && booking.transporterId && !transporterRated && (
            <button
              onClick={() => setRateModalOpen(true)}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Star className="w-4 h-4" />
              Rate Transporter
            </button>
          )}

          {booking.biltyNumber && (
            <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Bilty: {booking.biltyNumber}
            </span>
          )}
        </div>
      </div>

      {/* Rate transporter modal (SR 5) */}
      <RateUserModal
        open={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        title="Rate the transporter"
        subtitle={`Trip #${booking.id} — one rating per trip`}
        submitLabel="Submit Rating"
        onSubmit={submitTransporterRating}
      />

      {/* Cancel modal */}
      <ModalSheet
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel this booking?"
        description="Cancelling is immediate and notifies any transporters who quoted."
        maxWidth="sm"
      >
        <form onSubmit={handleCancel} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Produce sold locally, no transport needed"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60"
          >
            {busy ? 'Cancelling…' : 'Yes, Cancel Booking'}
          </button>
        </form>
      </ModalSheet>

      {/* Share modal */}
      <ModalSheet
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Share Live Trip Tracking (FT-7)"
        description="Login-free public link, valid for 48 hours (no phone or fare details revealed)"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs font-mono break-all border border-slate-200">
            {window.location.origin}/track/{shareToken}
          </div>
          <button
            onClick={copyShareLink}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</span>
          </button>
          <p className="text-[11px] text-slate-400 text-center">
            Family members or buyers can follow the trip live without an Agrovercity account.
          </p>
        </div>
      </ModalSheet>

      {/* Counter-offer modal */}
      <ModalSheet
        isOpen={Boolean(counterOffer)}
        onClose={() => setCounterOffer(null)}
        title="Counter this Offer"
        description={counterOffer ? `Round ${counterOffer.round} · transporter asked ${formatCurrency(counterOffer.farePaise / 100)}` : ''}
        maxWidth="sm"
      >
        <form onSubmit={submitCounter} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Your Fare (₹)</label>
            <input
              type="number"
              min={1}
              step="any"
              value={counterFare}
              onChange={(e) => setCounterFare(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Message (optional)</label>
            <textarea
              value={counterMessage}
              onChange={(e) => setCounterMessage(e.target.value)}
              rows={3}
              placeholder="e.g. Rate is high for this route — can you do ₹2,800?"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60"
          >
            {busy ? 'Sending Counter…' : 'Send Counter Offer'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

const BackLink: React.FC = () => (
  <Link
    to="/farmer/transport"
    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
  >
    <ArrowLeft className="w-4 h-4" />
    Back to My Transport Trips
  </Link>
);
