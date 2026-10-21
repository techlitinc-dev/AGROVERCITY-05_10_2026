import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  MapPin,
  Clock,
  ShieldCheck,
  Share2,
  Check,
  Copy,
  DollarSign,
  XCircle,
  ChevronRight,
  BookmarkPlus,
  Repeat,
  Trash2,
} from 'lucide-react';
import { transport, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { TransportVehicle, TransportBooking } from '../../types';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
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

/** Backend-valid vehicle catalog names (transport.py VEHICLE_TYPES) for templates. */
const TEMPLATE_VEHICLE: Record<string, string> = {
  'Pickup 1.5T': 'Bolero Maxi',
  'Tata Ace (1T)': 'Tata Ace',
  'Eicher 14ft (4T)': 'Eicher 6-Wheeler',
  'Reefer / Cold Truck': 'Reefer Cold Van',
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
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [bookings, setBookings] = useState<TransportBooking[]>([]);
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([]);
  const [tripTab, setTripTab] = useState<TripTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [shareModalBooking, setShareModalBooking] = useState<TransportBooking | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [repeatTemplate, setRepeatTemplate] = useState<Record<string, unknown> | null>(null);
  const [repeatDate, setRepeatDate] = useState('');
  const [repeatFare, setRepeatFare] = useState<number>(0);

  // Booking Form State
  const [selectedVehicle, setSelectedVehicle] = useState('Pickup 1.5T');
  const [pickupAddr, setPickupAddr] = useState('Pimpalgaon Baswant Farm Gate, Nashik');
  const [dropAddr, setDropAddr] = useState('Vashi APMC Yard, Navi Mumbai');
  const [distanceKm, setDistanceKm] = useState(170);
  const [cargoCrop, setCargoCrop] = useState('Soybean');
  const [cargoWeight, setCargoWeight] = useState(20);
  const [pickupTime, setPickupTime] = useState('2026-10-18T06:00');
  const [timeWindow, setTimeWindow] = useState(120);
  const [insuranceOptIn, setInsuranceOptIn] = useState(true);
  const [declaredValue, setDeclaredValue] = useState(100000); // ₹1,00,000

  // Server fare estimate (paise or rupees — rendered defensively)
  const [fareEstimate, setFareEstimate] = useState<Record<string, unknown> | null>(null);

  const insurancePremium = insuranceOptIn ? Math.ceil(declaredValue * 0.008) : 0;

  useEffect(() => {
    let active = true;
    setLoading(true);
    // One unfiltered fetch — the farmer sees their own bookings; tab filters
    // are applied client-side (backend ?status= accepts a single status).
    Promise.all([
      transport.vehicles(),
      transport.bookings(),
      transport.loadTemplates().catch(() => [] as unknown[]),
    ])
      .then(([v, b, t]) => {
        if (!active) return;
        setVehicles(v);
        setBookings(b);
        setTemplates(asArr(t).map(asRecord));
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

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

  const estimateFare = async () => {
    setError(null);
    try {
      const res = await transport.fareEstimate({
        vehicleType: selectedVehicle,
        distanceKm,
        cargoWeightQuintal: cargoWeight,
        insuranceOptIn,
        declaredValue,
      });
      setFareEstimate(asRecord(res));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const estimatedFareTotal = (() => {
    const r = fareEstimate;
    if (!r) return null;
    const totalPaisa = asNum(r.totalPaisa ?? r.total ?? r.farePaisa, 0);
    const totalRupees = asNum(r.totalRupees ?? r.estimatedFare ?? r.totalFare, 0);
    const base = asNum(r.baseFare ?? r.fare, 0);
    if (totalPaisa > 0) return totalPaisa / 100;
    if (totalRupees > 0) return totalRupees;
    if (base > 0) return base + (insuranceOptIn ? insurancePremium : 0);
    return null;
  })();

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingBusy(true);
    setError(null);
    try {
      const created = await transport.createBooking({
        vehicleType: selectedVehicle,
        pickupAddress: pickupAddr,
        dropAddress: dropAddr,
        distanceKm,
        cargoCrop,
        cargoWeightQuintal: cargoWeight,
        pickupTime,
        timeWindowMinutes: timeWindow,
        insuranceOptIn,
        declaredValue,
      });
      setBookings((prev) => [created, ...prev]);
      setBookModalOpen(false);
      setFareEstimate(null);
      setNotice(`Transport booking #${created.id} confirmed and broadcast to transporters.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBookingBusy(false);
    }
  };

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

  /** Save the current booking-form values as a repeatable load template (FT-5). */
  const handleSaveTemplate = async () => {
    setError(null);
    setTemplateBusy(true);
    try {
      await transport.createLoadTemplate({
        name: `${cargoCrop} · ${pickupAddr.split(',')[0].trim()} → ${dropAddr.split(',')[0].trim()}`,
        pickupLocation: pickupAddr,
        dropLocation: dropAddr,
        crop: cargoCrop,
        quantityQuintals: cargoWeight,
        preferredVehicleType: TEMPLATE_VEHICLE[selectedVehicle] ?? selectedVehicle,
        targetFare: estimatedFareTotal ?? 0,
        insuranceOptIn,
        ...(declaredValue > 0 ? { declaredValuePaisa: declaredValue * 100 } : {}),
      });
      setNotice('Load template saved — reuse it from the Templates section below.');
      await refreshTemplates();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setTemplateBusy(false);
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
            Book Gadi / Transport (FT-1 to FT-8 Protocol)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Book agricultural transport with verified drivers, guaranteed transit insurance, detention timers, and live trip tracking
          </p>
        </div>

        <button
          onClick={() => setBookModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Truck className="w-4 h-4" />
          <span>Book Gadi Now</span>
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

      {/* Available Vehicles Grid */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Standard Vehicle Fleets & Rates</h3>
        {loading ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading vehicles…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-sky-50 text-sky-700">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{v.vehicleType}</h4>
                    <p className="text-xs text-slate-500">{v.transporterName}</p>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md mt-1 inline-block">
                      {v.registrationNumber} • {v.capacityTons}T Payload
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-semibold">Standard Rate</span>
                  <span className="text-sm font-extrabold text-slate-900">
                    ₹{v.baseFare} base + ₹{v.ratePerKm}/km
                  </span>
                  <button
                    onClick={() => {
                      setSelectedVehicle(v.vehicleType);
                      setBookModalOpen(true);
                    }}
                    className="mt-2 block px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition-colors"
                  >
                    Book This
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
              ? 'No transport bookings yet. Book a gadi to move your produce safely.'
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
                        {booking.cargoCrop} ({formatWeight(booking.cargoWeightQuintal)}) • {booking.vehicleType}
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
                    <p className="font-bold text-slate-900">{booking.pickupAddress.split(',')[0]} → {booking.dropAddress.split(',')[0]}</p>
                    <p className="text-slate-500">{booking.distanceKm} km</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-sky-600" /> Pickup Window (FT-1)
                    </span>
                    <p className="font-bold text-slate-900">
                      {new Date(booking.pickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-slate-500">±{booking.timeWindowMinutes} mins window</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-amber-600" /> Fare & Insurance (FT-6)
                    </span>
                    <p className="font-bold text-slate-900">
                      {formatCurrency(booking.estimatedFare)}
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

      {/* Load Templates (FT-5) — saved repeatable loads */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900">My Load Templates ({templates.length})</h3>
            <p className="text-[11px] text-slate-500">Save a route once (from the booking form) and re-book it in one tap all season.</p>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="py-6 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No saved templates yet — open “Book Gadi Now” and use “Save as Template” to store a repeat route.
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

      {/* Book Gadi Modal */}
      <ModalSheet
        isOpen={bookModalOpen}
        onClose={() => setBookModalOpen(false)}
        title="Book Transport Vehicle (FT-1 / FT-6)"
        description="Calculate fare, select vehicle, and attach transit insurance"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateBooking} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Type</label>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Pickup 1.5T">Pickup 1.5T (Max 1.5 Ton)</option>
                <option value="Tata Ace (1T)">Tata Ace 1T</option>
                <option value="Eicher 14ft (4T)">Eicher 14ft (4T)</option>
                <option value="Reefer / Cold Truck">Reefer / Cold Truck</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cargo Crop</label>
              <input
                type="text"
                value={cargoCrop}
                onChange={(e) => setCargoCrop(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Address</label>
              <input
                type="text"
                value={pickupAddr}
                onChange={(e) => setPickupAddr(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Destination Address</label>
              <input
                type="text"
                value={dropAddr}
                onChange={(e) => setDropAddr(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Distance (km)</label>
              <input
                type="number"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Weight (q)</label>
              <input
                type="number"
                value={cargoWeight}
                onChange={(e) => setCargoWeight(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Date & Time</label>
              <input
                type="datetime-local"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          {/* Transit Insurance Add-on (FT-6) */}
          <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Transit Cargo Insurance (FT-6)</h5>
                  <p className="text-[10px] text-slate-500">Covers theft, accident, overturn & weather spoilage</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={insuranceOptIn}
                onChange={(e) => setInsuranceOptIn(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600"
              />
            </div>

            {insuranceOptIn && (
              <div className="pt-2 border-t border-emerald-200/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Declared Cargo Value:</span>
                  <input
                    type="number"
                    value={declaredValue}
                    onChange={(e) => setDeclaredValue(Number(e.target.value))}
                    className="w-32 px-2 py-1 text-xs rounded-lg border border-emerald-300 font-bold"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Estimated Premium (0.8%):</span>
                  <span className="font-bold text-emerald-800">{formatCurrency(insurancePremium)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Fare estimate box */}
          <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs font-bold text-slate-800">
            <span>Estimated Total:</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={estimateFare}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-[10px]"
              >
                Get Live Fare Estimate
              </button>
              <span className="text-base font-black text-emerald-700">
                {estimatedFareTotal !== null ? formatCurrency(estimatedFareTotal) : '—'}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={bookingBusy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60"
          >
            {bookingBusy ? 'Confirming Booking…' : 'Confirm Transport Booking'}
          </button>

          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={templateBusy}
            className="w-full py-2.5 rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
          >
            <BookmarkPlus className="w-4 h-4" />
            {templateBusy ? 'Saving Template…' : 'Save as Template (Book Again Later)'}
          </button>
        </form>
      </ModalSheet>

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
    </div>
  );
};
