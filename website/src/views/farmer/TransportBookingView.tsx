import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Truck,
  MapPin,
  Clock,
  Share2,
  Check,
  Copy,
  DollarSign,
  XCircle,
  ChevronRight,
  Repeat,
  Trash2,
  Layers,
  Phone,
  MessageSquare,
  Send,
} from 'lucide-react';
import { transport, apiErrorMessage } from '../../lib/api';
import { DIRECT_CONNECT_TERMS_TEXT } from '../../lib/api/transport';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { VehicleCatalogEntry, TransportBooking } from '../../types';

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

type TripTab = 'all' | 'ongoing' | 'upcoming' | 'previous' | 'cancelled';

const TRIP_TABS: { id: TripTab; label: string; statuses: TransportBooking['status'][] }[] = [
  { id: 'all', label: 'All', statuses: [] },
  { id: 'ongoing', label: 'Ongoing', statuses: ['accepted', 'arrivedPickup', 'loading', 'enRoute', 'reachedDestination', 'unloading'] },
  { id: 'upcoming', label: 'Upcoming', statuses: ['requested'] },
  { id: 'previous', label: 'Previous', statuses: ['delivered'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];

export const TransportBookingView: React.FC = () => {
  const navigate = useNavigate();
  // Vehicle rate card (GET /transport/vehicles) — feeds the demand form's
  // vehicle type dropdown.
  const [catalog, setCatalog] = useState<VehicleCatalogEntry[]>([]);
  const [bookings, setBookings] = useState<TransportBooking[]>([]);
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([]);
  const [tripTab, setTripTab] = useState<TripTab>('all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareModalBooking, setShareModalBooking] = useState<TransportBooking | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [repeatTemplate, setRepeatTemplate] = useState<Record<string, unknown> | null>(null);
  const [repeatDate, setRepeatDate] = useState('');
  const [repeatFare, setRepeatFare] = useState<number>(0);

  // --- Book-a-Vehicle demand flow (produce/vyapari parity): the farmer posts
  // a demand to the load board, transporters apply (terms + MPIN), and the
  // farmer accepts one application to unlock phone + WhatsApp both ways.
  const [myLoads, setMyLoads] = useState<Record<string, unknown>[]>([]);
  const [demandModalOpen, setDemandModalOpen] = useState(false);
  const [demandBusy, setDemandBusy] = useState(false);
  const [demandForm, setDemandForm] = useState({
    pickupLocation: '',
    dropLocation: '',
    crop: '',
    quantityQuintals: 0,
    preferredVehicleType: '',
    pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    pickupTime: '06:00',
    targetFare: 0,
    notes: '',
    urgent: false,
    termsAccepted: false,
  });
  const [appsFor, setAppsFor] = useState<Record<string, unknown> | null>(null);
  const [acceptBusyId, setAcceptBusyId] = useState<string | null>(null);
  const [revealFor, setRevealFor] = useState<Record<string, unknown> | null>(null);
  /** Farmer's pre-reveal direct-connect confirmation (per application). */
  const [acceptTermsFor, setAcceptTermsFor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // One unfiltered fetch — the farmer sees their own bookings; tab filters
    // are applied client-side (backend ?status= accepts a single status).
    Promise.all([
      transport.vehicles(),
      transport.bookings(),
      transport.loadTemplates().catch(() => [] as unknown[]),
      transport.myLoads().catch(() => [] as unknown[]),
    ])
      .then(([v, b, t, ml]) => {
        if (!active) return;
        setCatalog(v as unknown as VehicleCatalogEntry[]);
        setBookings(b);
        setTemplates(asArr(t).map(asRecord));
        setMyLoads(asArr(ml).map(asRecord));
      })
      .catch((e) => active && setError(apiErrorMessage(e)));
    return () => {
      active = false;
    };
  }, []);

  // Deep-link prefill from the mandi price board:
  // /farmer/transport?open=demand&crop=&destination=<mandi>
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('open') !== 'demand') return;
    const crop = searchParams.get('crop');
    const destination = searchParams.get('destination');
    setDemandForm((f) => ({
      ...f,
      ...(crop ? { crop } : {}),
      ...(destination ? { dropLocation: destination } : {}),
    }));
    setDemandModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshMyLoads = () =>
    transport
      .myLoads()
      .then((ml) => setMyLoads(asArr(ml).map(asRecord)))
      .catch(() => undefined);

  const refreshBookings = () =>
    transport
      .bookings()
      .then((b) => setBookings(b))
      .catch((e) => setError(apiErrorMessage(e)));

  const refreshTemplates = () =>
    transport
      .loadTemplates()
      .then((t) => setTemplates(asArr(t).map(asRecord)))
      .catch(() => undefined);

  const handleCancelBooking = async (id: string) => {
    setError(null);
    setBusyBookingId(id);
    try {
      const updated = await transport.cancelBooking(id, 'Cancelled by farmer');
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)));
      setNotice('Booking cancelled.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyBookingId(null);
    }
  };

  /** Post a vehicle demand to the freight load board — transporters apply on it. */
  const handlePostDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemandBusy(true);
    setError(null);
    try {
      await transport.createLoad({
        pickupLocation: demandForm.pickupLocation,
        dropLocation: demandForm.dropLocation,
        crop: demandForm.crop,
        quantityQuintals: demandForm.quantityQuintals,
        preferredVehicleType: demandForm.preferredVehicleType,
        pickupDate: demandForm.pickupDate,
        pickupTime: `${demandForm.pickupDate}T${demandForm.pickupTime}:00`,
        targetFare: demandForm.targetFare,
        packaging: 'Gunny Bags',
        ...(demandForm.notes.trim() ? { notes: demandForm.notes.trim() } : {}),
        urgent: demandForm.urgent,
        termsAccepted: demandForm.termsAccepted,
      });
      setDemandModalOpen(false);
      setNotice('Vehicle demand posted — transporters with a free vehicle on the pickup date will apply.');
      await refreshMyLoads();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDemandBusy(false);
    }
  };

  /** Accept a transporter's application — the farmer's direct-connect
   *  confirmation unlocks phone + WhatsApp both ways and turns the demand
   *  into a confirmed transport booking. */
  const handleAcceptBid = async (load: Record<string, unknown>, bidId: string) => {
    setAcceptBusyId(bidId);
    setError(null);
    try {
      const res = asRecord(
        await transport.acceptBid(String(load.id), bidId, acceptTermsFor === bidId)
      );
      setRevealFor(asRecord(res.contactReveal));
      setAcceptTermsFor(null);
      await Promise.all([refreshMyLoads(), refreshBookings()]);
      setNotice('Application accepted — phone & WhatsApp unlocked for both sides. Trip created. Agree fare, advance and delivery terms directly with the transporter.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setAcceptBusyId(null);
    }
  };

  const openRepeatModal = (t: Record<string, unknown>) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    setRepeatTemplate(t);
    setRepeatDate(tomorrow);
    setRepeatFare(firstNum(t, ['targetFare', 'fare'], 0));
  };

  /** Book again — instantiate the template as a fresh load, then refresh. */
  const handleRepeatTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repeatTemplate) return;
    setTemplateBusy(true);
    setError(null);
    try {
      await transport.repeatLoadTemplate(firstStr(repeatTemplate, ['id']), {
        pickupDate: repeatDate,
        ...(repeatFare > 0 ? { targetFare: repeatFare } : {}),
      });
      setRepeatTemplate(null);
      setNotice('Template repeated — a fresh load was posted to transporters.');
      await Promise.all([refreshTemplates(), refreshBookings()]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleDeleteTemplate = async (t: Record<string, unknown>) => {
    const name = firstStr(t, ['name'], 'this load');
    if (!window.confirm(`Delete template "${name}"?`)) return;
    setError(null);
    try {
      await transport.deleteLoadTemplate(firstStr(t, ['id']));
      setTemplates((prev) => prev.filter((x) => firstStr(x, ['id']) !== firstStr(t, ['id'])));
      setNotice('Template deleted.');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const tabDef = TRIP_TABS.find((t) => t.id === tripTab) ?? TRIP_TABS[0];
  const visibleBookings =
    tabDef.statuses.length === 0 ? bookings : bookings.filter((b) => tabDef.statuses.includes(b.status));
  const tabCount = (statuses: TransportBooking['status'][]) =>
    statuses.length === 0 ? bookings.length : bookings.filter((b) => statuses.includes(b.status)).length;

  const copyShareLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/track/${token}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Book a Vehicle / Transport
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Post your vehicle demand — verified transporters with a free vehicle apply with their fare,
            you accept one and both sides get phone &amp; WhatsApp to coordinate the pickup.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            onClick={() => setDemandModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Layers className="w-4 h-4" />
            <span>Post Vehicle Demand</span>
          </button>
        </div>
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

      {/* Active & Scheduled Bookings */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-sm text-slate-900">My Transport Trips ({bookings.length})</h3>
          {/* Status filter tabs — client-side over one unfiltered fetch */}
          <div className="flex flex-wrap items-center gap-1.5">
            {TRIP_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTripTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${
                  tripTab === t.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t.label} ({tabCount(t.statuses)})
              </button>
            ))}
          </div>
        </div>

        {visibleBookings.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            {bookings.length === 0
              ? 'No trips yet. Post a vehicle demand — a confirmed trip appears here once you accept a transporter.'
              : `No ${tabDef.label.toLowerCase()} trips right now.`}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleBookings.map((booking) => (
              <div
                key={booking.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/farmer/transport/${booking.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/farmer/transport/${booking.id}`);
                }}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 text-left w-full cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {booking.cargoCrop || booking.commodity || 'Cargo'} ({formatWeight(booking.cargoWeightQuintal ?? booking.weightQuintals ?? 0)}) • {booking.vehicleType}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Transporter: <strong>{booking.transporterName || 'Awaiting assignment'}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <StatusBadge status={booking.status} />
                    <span className="text-xs font-mono text-slate-400">#{booking.id}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>

                {/* Route & Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Route & Distance
                    </span>
                    <p className="font-bold text-slate-900">{(booking.pickupAddress || booking.pickup || '—').split(',')[0]} → {(booking.dropAddress || booking.drop || '—').split(',')[0]}</p>
                    <p className="text-slate-500">{booking.distanceKm} km</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-sky-600" /> Pickup Window (FT-1)
                    </span>
                    <p className="font-bold text-slate-900">
                      {booking.pickupTime
                        ? new Date(booking.pickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : booking.date || '—'}
                    </p>
                    <p className="text-slate-500">
                      {booking.timeWindowMinutes ? `±${booking.timeWindowMinutes} mins window` : 'Loading window set with transporter'}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-amber-600" /> Fare & Insurance (FT-6)
                    </span>
                    <p className="font-bold text-slate-900">
                      {formatCurrency(booking.estimatedFare ?? booking.fare ?? 0)}
                      {booking.insuranceOptIn && (
                        <span className="text-[10px] text-emerald-700 ml-1 font-semibold">
                          (+{formatCurrency(booking.insurancePremiumPaisa ? booking.insurancePremiumPaisa / 100 : 800)} Ins.)
                        </span>
                      )}
                    </p>
                    <p className="text-slate-500">60m free loading, then ₹150/slab</p>
                  </div>
                </div>

                {/* Bottom Actions: Share Trip (FT-7), Bilty & Cancel */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {booking.shareToken && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareModalBooking(booking);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share Live Trip (48h Token)</span>
                      </button>
                    )}

                    {booking.biltyNumber && (
                      <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                        Bilty: {booking.biltyNumber}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {booking.status === 'requested' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelBooking(booking.id);
                        }}
                        disabled={busyBookingId === booking.id}
                        className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    )}
                    <span className="text-xs font-semibold text-slate-400">Driver Contact unlocked on trip start</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Posted Demands (Book-a-Vehicle reverse marketplace) */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div>
          <h3 className="font-bold text-sm text-slate-900">My Posted Vehicle Demands ({myLoads.length})</h3>
          <p className="text-[11px] text-slate-500">
            Transporters with a free vehicle on your pickup date apply with their fare — you accept one and
            both sides get phone &amp; WhatsApp.
          </p>
        </div>

        {myLoads.length === 0 ? (
          <div className="py-6 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No demands posted yet — use “Post Vehicle Demand” and let transporters come to you.
          </div>
        ) : (
          <div className="space-y-4">
            {myLoads.map((load) => {
              const bids = asArr(load.bids).map(asRecord);
              const pending = bids.filter((b) => firstStr(b, ['status'], '') === 'pending').length;
              const accepted = bids.find((b) => firstStr(b, ['status'], '') === 'accepted');
              const reveal = accepted ? asRecord(load.contactReveal) : null;
              const transporterContact = reveal ? asRecord(reveal.transporter) : null;
              return (
                <div
                  key={firstStr(load, ['id'])}
                  className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="p-3 rounded-2xl bg-sky-50 text-sky-700">
                        <Layers className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">
                          {firstStr(load, ['crop'], 'Cargo')} ({formatWeight(firstNum(load, ['quantityQuintals'], 0))})
                          {firstStr(load, ['preferredVehicleType'], '') !== '—'
                            ? ` • wants ${firstStr(load, ['preferredVehicleType'])}`
                            : ''}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-600" />
                          {firstStr(load, ['pickupLocation'], '—')} → {firstStr(load, ['dropLocation'], '—')}
                        </p>
                        <p className="text-xs text-slate-400">
                          Pickup {firstStr(load, ['pickupDate'], '—')} • Target {formatCurrency(firstNum(load, ['targetFare'], 0))}
                          {Boolean(load.urgent) ? ' • Urgent' : ''}
                        </p>
                      </div>
                      <StatusBadge status={firstStr(load, ['status'], 'open')} />
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {accepted ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Transporter finalized
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setAppsFor(load);
                            setRevealFor(null);
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Applications ({pending > 0 ? pending : bids.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {accepted && transporterContact && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {firstStr(transporterContact, ['name'], 'Transporter')} — accepted at{' '}
                        {formatCurrency(firstNum(accepted, ['quotedFare'], 0))}:
                      </span>
                      {firstStr(transporterContact, ['phoneDigits'], '') && (
                        <a
                          href={`tel:+${firstStr(transporterContact, ['phoneDigits'])}`}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call
                        </a>
                      )}
                      {firstStr(transporterContact, ['whatsappDigits'], '') && (
                        <a
                          href={`https://wa.me/${firstStr(transporterContact, ['whatsappDigits'])}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#1fb857] text-white font-bold text-xs flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      )}
                      <span className="text-[10px] text-slate-400">Contact unlocked on acceptance</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Load Templates (FT-5) — saved repeatable loads */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900">My Load Templates ({templates.length})</h3>
            <p className="text-[11px] text-slate-500">Saved repeat routes — repost one to the transporter board in a single tap.</p>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="py-6 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No saved templates yet — repeat routes you save will appear here for one-tap reposting.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {templates.map((t) => (
              <div
                key={firstStr(t, ['id'])}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{firstStr(t, ['name'], 'Saved Load')}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <MapPin className="w-3 h-3 inline text-emerald-600 mr-0.5" />
                      {firstStr(t, ['pickupLocation', 'pickup'], '—')} → {firstStr(t, ['dropLocation', 'drop'], '—')}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md whitespace-nowrap">
                    {firstStr(t, ['preferredVehicleType', 'vehicleType'], 'Any vehicle')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                  <span>Crop: <strong>{firstStr(t, ['crop', 'commodity'], '—')}</strong></span>
                  <span>Qty: <strong>{firstNum(t, ['quantityQuintals', 'weightQuintals'], 0)} q</strong></span>
                  <span>Target fare: <strong>{formatCurrency(firstNum(t, ['targetFare', 'fare'], 0))}</strong></span>
                  <span>Used: <strong>{firstNum(t, ['useCount'], 0)}×</strong></span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => openRepeatModal(t)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    Book Again
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(t)}
                    className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Share Live Trip Modal (FT-7) */}
      <ModalSheet
        isOpen={Boolean(shareModalBooking)}
        onClose={() => setShareModalBooking(null)}
        title="Share Live Trip Tracking (FT-7)"
        description="Login-free, sanitized public link with 48h TTL (no phone or fares revealed)"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs font-mono break-all border border-slate-200">
            {window.location.origin}/track/{shareModalBooking?.shareToken}
          </div>

          <button
            onClick={() => shareModalBooking && copyShareLink(shareModalBooking.shareToken || '')}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</span>
          </button>

          <p className="text-[11px] text-slate-400 text-center">
            Family members or buyers can view live movement without needing an Agrovercity account.
          </p>
        </div>
      </ModalSheet>

      {/* Repeat Load Template Modal (FT-5) */}
      <ModalSheet
        isOpen={Boolean(repeatTemplate)}
        onClose={() => setRepeatTemplate(null)}
        title="Book Again from Template"
        description={firstStr(repeatTemplate ?? {}, ['name'], 'Saved load')}
        maxWidth="sm"
      >
        <form onSubmit={handleRepeatTemplate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">New Pickup Date</label>
            <input
              type="date"
              value={repeatDate}
              onChange={(e) => setRepeatDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Fare (₹, optional override)</label>
            <input
              type="number"
              min={0}
              value={repeatFare}
              onChange={(e) => setRepeatFare(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
            />
          </div>
          <button
            type="submit"
            disabled={templateBusy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Repeat className="w-4 h-4" />
            {templateBusy ? 'Posting Load…' : 'Post Load to Transporters'}
          </button>
        </form>
      </ModalSheet>
      {/* Post Vehicle Demand Modal — farmer posts his demand to the load board */}
      <ModalSheet
        isOpen={demandModalOpen}
        onClose={() => setDemandModalOpen(false)}
        title="Post Vehicle Demand"
        description="Transporters with a free vehicle on your pickup date will apply with their fare. You accept one — then phone & WhatsApp are shared."
        maxWidth="lg"
      >
        <form onSubmit={handlePostDemand} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Location</label>
              <input
                type="text"
                value={demandForm.pickupLocation}
                onChange={(e) => setDemandForm({ ...demandForm, pickupLocation: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Drop Location</label>
              <input
                type="text"
                value={demandForm.dropLocation}
                onChange={(e) => setDemandForm({ ...demandForm, dropLocation: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop / Commodity</label>
              <input
                type="text"
                value={demandForm.crop}
                onChange={(e) => setDemandForm({ ...demandForm, crop: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity (q)</label>
              <input
                type="number"
                value={demandForm.quantityQuintals}
                onChange={(e) => setDemandForm({ ...demandForm, quantityQuintals: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Vehicle</label>
              <select
                value={demandForm.preferredVehicleType}
                onChange={(e) => setDemandForm({ ...demandForm, preferredVehicleType: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                required
              >
                <option value="" disabled>
                  {catalog.length === 0 ? 'No vehicle types on the rate card' : 'Select vehicle type'}
                </option>
                {catalog.map((v) => (
                  <option key={v.type} value={v.type}>
                    {v.type} ({v.capacityTonnes}T)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Fare (₹)</label>
              <input
                type="number"
                value={demandForm.targetFare}
                onChange={(e) => setDemandForm({ ...demandForm, targetFare: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-emerald-800"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Date</label>
              <input
                type="date"
                value={demandForm.pickupDate}
                onChange={(e) => setDemandForm({ ...demandForm, pickupDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Time</label>
              <input
                type="time"
                value={demandForm.pickupTime}
                onChange={(e) => setDemandForm({ ...demandForm, pickupTime: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes for transporters (optional)</label>
            <textarea
              rows={2}
              value={demandForm.notes}
              onChange={(e) => setDemandForm({ ...demandForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="Loading help needed, tarpaulin required, weighbridge slip…"
            />
          </div>

          <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
            <span className="text-[11px] text-slate-600">
              <strong>Urgent load</strong> — pinned on the transporter board and pushed to verified vehicles near the pickup point.
            </span>
            <input
              type="checkbox"
              checked={demandForm.urgent}
              onChange={(e) => setDemandForm({ ...demandForm, urgent: e.target.checked })}
              className="w-4 h-4 accent-emerald-600"
            />
          </label>

          <label className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 cursor-pointer">
            <input
              type="checkbox"
              checked={demandForm.termsAccepted}
              onChange={(e) => setDemandForm({ ...demandForm, termsAccepted: e.target.checked })}
              className="w-4 h-4 mt-0.5 accent-emerald-600 flex-shrink-0"
            />
            <span className="text-[11px] text-amber-800 leading-relaxed">
              <strong>Direct-connect terms (required).</strong> {DIRECT_CONNECT_TERMS_TEXT}
            </span>
          </label>

          <button
            type="submit"
            disabled={
              demandBusy ||
              !demandForm.pickupLocation.trim() ||
              !demandForm.dropLocation.trim() ||
              !demandForm.crop.trim() ||
              !demandForm.preferredVehicleType ||
              demandForm.quantityQuintals <= 0 ||
              demandForm.targetFare <= 0 ||
              !demandForm.termsAccepted
            }
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60"
          >
            {demandBusy ? 'Posting Demand…' : 'Post Demand to Transporters'}
          </button>
        </form>
      </ModalSheet>

      {/* Applications modal: review transporter applications, accept to reveal contact */}
      <ModalSheet
        isOpen={Boolean(appsFor)}
        onClose={() => {
          setAppsFor(null);
          setRevealFor(null);
        }}
        title={revealFor ? 'Application Accepted' : 'Transporter Applications'}
        description={
          appsFor
            ? `${firstStr(appsFor, ['crop'], 'Cargo')} — ${firstStr(appsFor, ['pickupLocation'], '—')} → ${firstStr(appsFor, ['dropLocation'], '—')} • pickup ${firstStr(appsFor, ['pickupDate'], '—')}`
            : undefined
        }
        maxWidth="md"
      >
        {appsFor && (
          <div className="space-y-3">
            {revealFor &&
              (() => {
                const contact = asRecord(revealFor.transporter);
                return (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-5 h-5" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {firstStr(contact, ['fullName'], firstStr(contact, ['name'], 'Transporter'))} finalized
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Phone &amp; WhatsApp unlocked for both sides — coordinate the pickup directly.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {firstStr(contact, ['phoneDigits'], '') && (
                        <a
                          href={`tel:+${firstStr(contact, ['phoneDigits'])}`}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5" /> {firstStr(contact, ['phone'], 'Call')}
                        </a>
                      )}
                      {firstStr(contact, ['whatsappDigits'], '') && (
                        <a
                          href={`https://wa.me/${firstStr(contact, ['whatsappDigits'])}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1fb857] text-white font-bold text-xs flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {firstStr(contact, ['village'], '')}
                        {firstStr(contact, ['district'], '') !== '—' ? `, ${firstStr(contact, ['district'])}` : ''}
                      </span>
                    </div>
                  </div>
                );
              })()}

            {asArr(appsFor.bids)
              .map(asRecord)
              .map((bid) => {
                const status = firstStr(bid, ['status'], 'pending');
                const isAccepted = status === 'accepted';
                const isPending = status === 'pending';
                return (
                  <div
                    key={firstStr(bid, ['id'])}
                    className={`p-4 rounded-2xl border space-y-2 ${
                      isAccepted ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{firstStr(bid, ['transporterName'], 'Transporter')}</p>
                        <p className="text-[11px] text-slate-500">
                          {firstStr(bid, ['vehicleNo'], 'Vehicle on assignment') !== '—'
                            ? firstStr(bid, ['vehicleNo'], '')
                            : 'Vehicle assigned later'}
                          {firstStr(bid, ['estimatedPickupTime'], '') !== '—'
                            ? ` • ETA ${firstStr(bid, ['estimatedPickupTime'])}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-emerald-700">
                          {formatCurrency(firstNum(bid, ['quotedFare'], 0))}
                        </span>
                        <StatusBadge status={status} />
                      </div>
                    </div>
                    {firstStr(bid, ['notes'], '') !== '—' && (
                      <p className="text-[11px] text-slate-500 italic">“{firstStr(bid, ['notes'])}”</p>
                    )}
                    {isPending && (
                      <div className="space-y-2">
                        <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acceptTermsFor === firstStr(bid, ['id'])}
                            onChange={(e) =>
                              setAcceptTermsFor(e.target.checked ? firstStr(bid, ['id']) : null)
                            }
                            className="w-3.5 h-3.5 mt-0.5 accent-emerald-600 flex-shrink-0"
                          />
                          <span className="text-[10px] text-amber-800 leading-relaxed">
                            I confirm: {DIRECT_CONNECT_TERMS_TEXT}
                          </span>
                        </label>
                        <button
                          onClick={() => void handleAcceptBid(appsFor, firstStr(bid, ['id']))}
                          disabled={acceptBusyId !== null || acceptTermsFor !== firstStr(bid, ['id'])}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-60"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {acceptBusyId === firstStr(bid, ['id']) ? 'Accepting…' : 'Accept — reveal phone & WhatsApp'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            {asArr(appsFor.bids).length === 0 && (
              <p className="py-6 text-center text-xs font-semibold text-slate-400">
                No applications yet — transporters with a free vehicle on {firstStr(appsFor, ['pickupDate'], 'the pickup date')}{' '}
                will apply here.
              </p>
            )}
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
