import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Truck,
  Layers,
  MapPin,
  Clock,
  DollarSign,
  RefreshCw,
  X,
  Check,
  Inbox,
  Wallet,
  TrendingUp,
  Calculator,
  FileText,
  ArrowRight,
  ShieldAlert,
  CalendarDays,
  User,
  FileCheck,
  Star,
  Megaphone,
  Sparkles,
  Bot,
  BookOpen,
  Lock,
  Phone,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { transport, apiErrorMessage } from '../../lib/api';
import { isMpinError } from '../../lib/api/leads';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { MpinPad } from '../../components/common/MpinPad';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { TransportBooking, TransportVehicle } from '../../types';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

type TabId = 'loads' | 'trips' | 'bilty' | 'settlements';

const TAB_FOR_PATH: Record<string, TabId> = {
  '/transporter/loads': 'loads',
  '/transporter/trips': 'trips',
  '/transporter/bilty': 'bilty',
  '/transporter/settlements': 'settlements',
};

/** Vehicle-type catalog names accepted by POST /transport/vehicles. */
const VEHICLE_TYPES = ['Tata Ace', 'Bolero Maxi', 'Tractor Trolley', 'Eicher 6-Wheeler', 'Reefer Cold Van', '10-Wheeler Truck'];

const QUICK_LINKS = [
  { to: '/transporter/profile', label: 'Profile', icon: User },
  { to: '/transporter/bookings', label: 'My Bookings', icon: FileCheck },
  { to: '/transporter/ratings', label: 'Ratings & Reviews', icon: Star },
  { to: '/transporter/ads', label: 'My Advertisements', icon: Megaphone },
  { to: '/transporter/ai', label: 'AI Analysis', icon: Sparkles },
  { to: '/transporter/chatbot', label: 'Chatbot', icon: Bot },
  { to: '/transporter/diary', label: 'Diary', icon: BookOpen },
  { to: '/transporter/inbox', label: 'Booking Requests', icon: Inbox },
];

const bookingCrop = (b: TransportBooking): string => b.commodity || b.cargoCrop || 'Cargo';
const bookingPickup = (b: TransportBooking): string => b.pickup || b.pickupAddress || '—';
const bookingDrop = (b: TransportBooking): string => b.drop || b.dropAddress || '—';
const bookingFare = (b: TransportBooking): number => b.fare ?? b.estimatedFare ?? 0;
const bookingWeight = (b: TransportBooking): number => b.weightQuintals ?? b.cargoWeightQuintal ?? 0;

/** 3. Transporter Logistics Hub — load board, trips, bilty, settlements. */
export const TransporterHome: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>(TAB_FOR_PATH[location.pathname] ?? 'loads');

  const [dashboard, setDashboard] = useState<Rec>({});
  const [analytics, setAnalytics] = useState<Rec>({});
  const [loads, setLoads] = useState<Rec[]>([]);
  const [matched, setMatched] = useState<Rec[]>([]);
  const [fareTrends, setFareTrends] = useState<Rec[]>([]);
  const [bookings, setBookings] = useState<TransportBooking[]>([]);
  const [acceptedTrips, setAcceptedTrips] = useState<TransportBooking[]>([]);
  const [settlements, setSettlements] = useState<Rec[]>([]);
  const [wallet, setWallet] = useState<Rec>({});
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bidModal, setBidModal] = useState<Rec | null>(null);
  const [bidFare, setBidFare] = useState(0);
  const [bidVehicleId, setBidVehicleId] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [myBids, setMyBids] = useState<Rec[]>([]);
  const [bidStep, setBidStep] = useState<'form' | 'mpin' | 'done'>('form');
  const [bidTerms, setBidTerms] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidBusy, setBidBusy] = useState(false);
  const [mpinKey, setMpinKey] = useState(0);
  const [fareForm, setFareForm] = useState({ vehicleType: 'Tractor Trolley', distanceKm: 100 });
  const [fareResult, setFareResult] = useState<Rec | null>(null);
  const [invoice, setInvoice] = useState<Rec | null>(null);
  const [biltyFor, setBiltyFor] = useState<TransportBooking | null>(null);
  const [biltyData, setBiltyData] = useState<Rec | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, a, w, v] = await Promise.all([
        transport.dashboard(),
        transport.analytics().catch(() => ({})),
        transport.wallet().catch(() => ({})),
        transport.myVehicles().catch(() => [] as TransportVehicle[]),
      ]);
      setDashboard(asRec(d));
      setAnalytics(asRec(a));
      setWallet(asRec(w));
      setVehicles(v);
    } catch {
      setDashboard({});
      setAnalytics({});
    }
    try {
      const [l, m, f, b, s, accepted, mine] = await Promise.all([
        transport.loads(),
        transport.matchedLoads().catch(() => [] as unknown[]),
        transport.fareTrends().catch(() => [] as unknown[]),
        transport.bookings(),
        transport.settlements().catch(() => [] as unknown[]),
        transport.bookings({ status: 'accepted' }).catch(() => [] as TransportBooking[]),
        transport.myLoadBids().catch(() => [] as unknown[]),
      ]);
      setLoads(asArr(l).map(asRec));
      setMatched(asArr(m).map(asRec));
      setFareTrends(asArr(f).map(asRec));
      setBookings(b);
      setSettlements(asArr(s).map(asRec));
      setAcceptedTrips(accepted);
      setMyBids(asArr(mine).map(asRec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // --- load-board apply (produce/vyapari parity): the Apply action is only
  // available when one of my vehicles is free on the load's pickup date.
  const pickupDateOf = (loadRec: Rec): string =>
    str(loadRec.pickupDate ?? loadRec.date, '').slice(0, 10);

  const vehiclesFreeOn = (dateIso: string): TransportVehicle[] => {
    const today = new Date().toISOString().slice(0, 10);
    return vehicles.filter((v) => {
      if (v.active === false) return false;
      if ((v.docStatus ?? 'verified') !== 'verified') return false;
      const dates = v.availableDates ?? [];
      return Boolean(v.availableNow) || dates.includes(dateIso) || dates.includes(today);
    });
  };

  const myBidFor = (loadId: string): Rec | undefined => {
    const bid = myBids.find((b) => {
      const loadRef = asRec(b.load);
      return str(loadRef.id ?? b.loadId, '') === loadId;
    });
    return bid;
  };

  const openBid = (loadRec: Rec) => {
    const free = vehiclesFreeOn(pickupDateOf(loadRec));
    setBidModal(loadRec);
    setBidFare(firstNum(loadRec, ['targetFare', 'currentBid', 'lowestBid', 'estFare', 'estimatedFare'], 0));
    setBidVehicleId(free[0]?.id ?? '');
    setBidNotes('');
    setBidTerms(false);
    setBidError(null);
    setBidStep('form');
    setMpinKey((k) => k + 1);
  };

  const submitBid = async (mpin: string) => {
    if (!bidModal) return;
    setBidBusy(true);
    setBidError(null);
    try {
      const vehicle = vehicles.find((v) => v.id === bidVehicleId);
      await transport.bid(str(bidModal.id), {
        quotedFare: bidFare,
        vehicleId: vehicle?.id,
        vehicleNo: vehicle ? (vehicle.registrationNo ?? vehicle.registrationNumber) : undefined,
        ...(bidNotes.trim() ? { notes: bidNotes.trim() } : {}),
        termsAccepted: true,
        mpin,
      });
      setBidStep('done');
      await load();
    } catch (err) {
      if (isMpinError(err)) {
        setBidError('Incorrect MPIN — try again.');
        setMpinKey((k) => k + 1);
      } else {
        setBidError(apiErrorMessage(err));
      }
    } finally {
      setBidBusy(false);
    }
  };

  /** Compact phone/WhatsApp pair shown once the farmer accepts my application. */
  const ContactButtons: React.FC<{ contact: Rec; phoneLabel: string }> = ({ contact, phoneLabel }) => {
    const phoneDigits = str(contact.phoneDigits, '');
    const whatsappDigits = str(contact.whatsappDigits, '');
    return (
      <div className="flex items-center gap-2">
        {phoneDigits && (
          <a
            href={`tel:+${phoneDigits}`}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5" /> {phoneLabel}
          </a>
        )}
        {whatsappDigits && (
          <a
            href={`https://wa.me/${whatsappDigits}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#1fb857] text-white font-bold text-xs flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
          </a>
        )}
      </div>
    );
  };

  const handleFareEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFareResult(asRec(await transport.fareEstimate({ ...fareForm })));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openInvoice = async (bookingId: string) => {
    try {
      setInvoice(asRec(await transport.commissionInvoice(bookingId)));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openBilty = async (b: TransportBooking) => {
    setBiltyFor(b);
    try {
      setBiltyData(asRec(await transport.bilty(b.id)));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const trips = bookings.filter((b) => !['pending', 'requested'].includes(b.status));
  const completedBookings = bookings.filter((b) => ['delivered', 'completed'].includes(b.status));
  const requestedJobs = bookings.filter((b) => ['pending', 'requested'].includes(b.status));

  const todayTrips = asArr(dashboard.todayTrips);
  const docExpiries = asArr(dashboard.documentExpiries);
  const walletBalance = firstNum(wallet, ['balancePaisa'], 0) / 100;

  // Trip calendar: accepted bookings grouped by scheduled/pickup date over the next 7 days.
  const weekDays = useMemo(() => {
    const byDay = new Map<string, TransportBooking[]>();
    acceptedTrips.forEach((b) => {
      const key = String(b.date ?? b.pickupTime ?? '').slice(0, 10);
      if (!key) return;
      byDay.set(key, [...(byDay.get(key) ?? []), b]);
    });
    const days: { key: string; weekday: string; dateLabel: string; trips: TransportBooking[] }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        key,
        weekday: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
        dateLabel: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        trips: byDay.get(key) ?? [],
      });
    }
    return days;
  }, [acceptedTrips]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Transporter Logistics Cockpit (FT Desk)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Freight load auction board, trip execution, digital bilty, and net settlements
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Link
            to="/transporter/inbox"
            className="px-3.5 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
          >
            <Inbox className="w-4 h-4" /> Job Inbox
            {requestedJobs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px]">{requestedJobs.length}</span>
            )}
          </Link>
          <button
            onClick={load}
            className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {docExpiries.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-900 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          <span>
            Document expiry:{' '}
            {docExpiries
              .slice(0, 3)
              .map((d) => `${firstStr(asRec(d), ['document', 'docType', 'kind'], 'document')} expires ${fmtDate(asRec(d).expiryDate ?? asRec(d).expiresAt)}`)
              .join(' • ')}
          </span>
          <Link to="/transporter/fleet" className="ml-auto underline">Renew in Fleet</Link>
        </div>
      )}

      {/* KPI Cards (transport.dashboard + analytics + wallet) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Today's Trips"
          value={todayTrips.length || firstNum(dashboard, ['activeTrips', 'activeBookings'], trips.filter((t) => ['accepted', 'enRoute'].includes(t.status)).length)}
          subtitle={`${requestedJobs.length} new job request(s) waiting`}
          icon={Truck}
          colorScheme="blue"
        />
        <StatCard
          title="Trips Completed"
          value={firstNum(analytics, ['totalTripsCompleted', 'tripsThisMonth', 'trips'], trips.length)}
          subtitle={`${firstNum(analytics, ['totalDistanceKm'], 0)} km • ${firstNum(analytics, ['totalVehicles'], vehicles.length)} vehicle(s)`}
          icon={Layers}
          colorScheme="green"
        />
        <StatCard
          title="Gross Revenue"
          value={formatCurrency(firstNum(analytics, ['totalGrossRevenue', 'grossRevenue', 'revenue'], 0))}
          subtitle={`Est. net ${formatCurrency(firstNum(analytics, ['estimatedNetProfit'], 0))} after fuel + 10% commission`}
          icon={DollarSign}
          colorScheme="amber"
        />
        <StatCard
          title="Wallet Balance"
          value={formatCurrency(walletBalance)}
          subtitle={`Week earnings ${formatCurrency(firstNum(dashboard, ['earningsWeekPaisa'], 0) / 100)}`}
          icon={Wallet}
          colorScheme="purple"
        />
      </div>

      {/* Trip Calendar — next 7 days of accepted bookings */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-600" /> Trip Calendar — Next 7 Days
          </h3>
          <span className="text-xs text-slate-400 font-semibold">{acceptedTrips.length} accepted trip(s)</span>
        </div>
        {acceptedTrips.length === 0 && !loading ? (
          <div className="p-6 border border-dashed border-slate-300 rounded-2xl text-center text-xs font-semibold text-slate-500">
            No trips scheduled. Accept jobs from the Job Inbox or win bids on the load board.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <div
                key={day.key}
                className={`rounded-2xl border p-3 space-y-2 min-h-[96px] ${
                  day.trips.length > 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/60'
                }`}
              >
                <div>
                  <p className={`text-[10px] font-bold uppercase ${day.trips.length > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {day.weekday}
                  </p>
                  <p className="text-xs font-black text-slate-900">{day.dateLabel}</p>
                </div>
                {day.trips.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No trips scheduled</p>
                ) : (
                  <div className="space-y-1.5">
                    {day.trips.map((t) => (
                      <Link
                        key={t.id}
                        to={`/transporter/trips/${t.id}`}
                        className="block p-2 rounded-xl bg-white border border-emerald-100 hover:border-emerald-300 transition-colors"
                        title={`${bookingPickup(t)} → ${bookingDrop(t)}`}
                      >
                        <p className="text-[10px] font-bold text-slate-900 truncate">{bookingCrop(t)}</p>
                        <p className="text-[9px] text-slate-500 truncate">
                          {bookingPickup(t)} → {bookingDrop(t)}
                        </p>
                        <p className="text-[9px] font-bold text-emerald-700">{formatCurrency(bookingFare(t))}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="px-3.5 py-2.5 rounded-2xl border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 text-slate-700 hover:text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <l.icon className="w-4 h-4" /> {l.label}
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
        {[
          { id: 'loads', label: 'Load Board (Auction)' },
          { id: 'trips', label: 'Active Trips' },
          { id: 'bilty', label: 'Bilty Generator' },
          { id: 'settlements', label: 'P&L / Settlements' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Load Board */}
      {activeTab === 'loads' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Fare estimator */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600" /> Fare Estimate
              </h3>
              <form onSubmit={handleFareEstimate} className="space-y-2.5 text-xs">
                <select
                  value={fareForm.vehicleType}
                  onChange={(e) => setFareForm({ ...fareForm, vehicleType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={fareForm.distanceKm}
                  onChange={(e) => setFareForm({ ...fareForm, distanceKm: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  placeholder="Distance (km)"
                  required
                />
                <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                  Estimate Fare
                </button>
              </form>
              {fareResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs space-y-1">
                  {[
                    ['Base fare', 'baseFare'],
                    ['Distance fare', 'distanceFare'],
                    ['Loading labour', 'loadingLabor'],
                    ['Toll estimate', 'tollEstimate'],
                    ['Perishable surcharge', 'perishableSurcharge'],
                    ['Return discount', 'returnDiscount'],
                  ].map(([label, key]) =>
                    firstNum(fareResult, [key], 0) > 0 ? (
                      <div key={key} className="flex justify-between">
                        <span className="text-emerald-700">{label}</span>
                        <span className="font-bold text-emerald-900">{formatCurrency(firstNum(fareResult, [key]))}</span>
                      </div>
                    ) : null
                  )}
                  <div className="flex justify-between border-t border-emerald-200 pt-1">
                    <span className="text-emerald-700 font-bold">Total</span>
                    <span className="font-black text-emerald-900">{formatCurrency(firstNum(fareResult, ['totalFare'], 0))}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Fare trends */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3 lg:col-span-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-600" /> Fare Trends
              </h3>
              {fareTrends.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No fare trend data for your routes yet.</p>
              ) : (
                <div className="space-y-2">
                  {fareTrends.slice(0, 6).map((t, i) => {
                    const value = firstNum(t, ['farePerKm', 'ratePerKm', 'avgFare', 'fare'], 0);
                    const max = Math.max(...fareTrends.map((x) => firstNum(x, ['farePerKm', 'ratePerKm', 'avgFare', 'fare'], 0)), 1);
                    return (
                      <div key={i} className="text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="font-bold text-slate-700">
                            {firstStr(t, ['route', 'routeName', 'vehicleType', 'label'], `Trend ${i + 1}`)}
                          </span>
                          <span className="font-bold text-sky-700">{value > 0 ? `₹${value}/km` : '—'}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Matched loads */}
          {matched.length > 0 && (
            <div className="bg-sky-50/60 rounded-3xl p-5 border border-sky-100 space-y-3">
              <h3 className="font-bold text-sm text-sky-900 flex items-center gap-2">
                <Check className="w-4 h-4" /> Matched for Your Fleet
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matched.map((m) => (
                  <div key={str(m.id) || JSON.stringify(m).slice(0, 24)} className="bg-white rounded-2xl p-4 border border-sky-100 text-xs space-y-1">
                    <p className="font-bold text-slate-900">{firstStr(m, ['crop', 'cargoCrop', 'title', 'commodity'], 'Load')}</p>
                    <p className="text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {firstStr(m, ['pickupLocation', 'pickup', 'pickupAddress'], '—')} → {firstStr(m, ['dropLocation', 'drop', 'dropAddress'], '—')}
                    </p>
                    <button
                      onClick={() => openBid(m)}
                      className="mt-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs"
                    >
                      Bid Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load board */}
          <h3 className="font-bold text-sm text-slate-900">Live Freight Load Board (Auction Bids)</h3>
          {loads.length === 0 && !loading ? (
            <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No open loads on the board right now. Matched loads and fare trends appear above when available.
            </div>
          ) : (
            <div className="space-y-4">
              {loads.map((load) => {
                const id = str(load.id);
                const targetFare = firstNum(load, ['targetFare', 'estFare', 'estimatedFare', 'baseFare'], 0);
                const currentBid = firstNum(load, ['currentBid', 'lowestBid'], 0);
                const weight = firstNum(load, ['quantityQuintals', 'weightQuintal', 'cargoWeightQuintal', 'weight'], 0);
                const distance = firstNum(load, ['distanceKm', 'distance'], 0);
                const pickupDate = pickupDateOf(load);
                const freeVehicles = vehiclesFreeOn(pickupDate);
                const myBid = myBidFor(id);
                const accepted = myBid?.status === 'accepted';
                const reveal = accepted ? asRec(myBid?.contactReveal) : null;
                const farmerContact = reveal ? asRec(reveal.farmer) : null;
                return (
                  <div key={id || JSON.stringify(load).slice(0, 24)} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="p-2 rounded-xl bg-sky-50 text-sky-700">
                          <Truck className="w-4 h-4" />
                        </span>
                        <h4 className="font-bold text-base text-slate-900">
                          {firstStr(load, ['crop', 'cargoCrop', 'commodity', 'title'], 'Cargo')} {weight > 0 ? `(${formatWeight(weight)})` : ''}
                        </h4>
                        <span className="text-xs font-mono text-slate-400">#{id}</span>
                        <StatusBadge status={str(load.status, 'open')} />
                        {myBid && !accepted && (
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Applied — awaiting farmer
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        {firstStr(load, ['pickupLocation', 'pickup', 'pickupAddress'], '—')} → {firstStr(load, ['dropLocation', 'drop', 'dropAddress'], '—')}
                        {distance > 0 ? ` (${distance} km)` : ''}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> Pickup: {fmtDate(load.pickupDate ?? load.pickupTime ?? load.date)}
                        {str(load.preferredVehicleType, '') !== '—' ? ` • prefers ${str(load.preferredVehicleType)}` : ''}
                        {firstNum(load, ['bidsCount'], 0) > 0 ? ` • ${firstNum(load, ['bidsCount'])} application(s)` : ''}
                      </p>
                      {accepted && farmerContact && (
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" /> Application accepted — contact unlocked
                          </span>
                          <ContactButtons contact={farmerContact} phoneLabel={`Call ${str(farmerContact.name, 'farmer')}`} />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-end justify-between gap-3">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Fare</span>
                        <span className="text-xl font-black text-emerald-700">{formatCurrency(targetFare)}</span>
                        {currentBid > 0 && <span className="text-[10px] text-slate-400 block">Lowest bid {formatCurrency(currentBid)}</span>}
                      </div>
                      {accepted ? (
                        <Link
                          to={`/transporter/trips/${str(reveal?.bookingId, '')}`}
                          className="px-5 py-2.5 rounded-2xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold text-xs"
                        >
                          Open Trip
                        </Link>
                      ) : myBid ? (
                        <button
                          disabled
                          className="px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xs cursor-not-allowed"
                        >
                          Applied — awaiting farmer
                        </button>
                      ) : freeVehicles.length === 0 ? (
                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <button
                            disabled
                            className="px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xs cursor-not-allowed"
                          >
                            No vehicle free {pickupDate ? `on ${fmtDate(pickupDate)}` : ''}
                          </button>
                          <Link to="/transporter/fleet" className="text-[10px] font-bold text-sky-700 hover:underline">
                            Mark availability in Fleet →
                          </Link>
                        </div>
                      ) : (
                        <button
                          onClick={() => openBid(load)}
                          className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                        >
                          Apply for Load
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Active Trips */}
      {activeTab === 'trips' && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-900">My Trips & Bookings</h3>
          {trips.length === 0 && !loading ? (
            <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No trips yet. Accept jobs from the Job Inbox or win bids on the load board.
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((t) => (
                <div key={t.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                      {bookingCrop(t)} {bookingWeight(t) > 0 ? `(${formatWeight(bookingWeight(t))})` : ''}
                      <StatusBadge status={t.status} />
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-emerald-600" /> {bookingPickup(t)} → {bookingDrop(t)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {fmtDate(t.date ?? t.pickupTime)} • Fare {formatCurrency(bookingFare(t))}
                      {t.vehicleNo ? ` • ${t.vehicleNo}` : ''}
                    </p>
                  </div>
                  <Link
                    to={`/transporter/trips/${t.id}`}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 self-start sm:self-auto"
                  >
                    Open Trip <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Bilty Generator */}
      {activeTab === 'bilty' && (
        <div className="space-y-4 max-w-2xl mx-auto">
          <h3 className="font-bold text-sm text-slate-900">Generate Bilty (Consignment Note)</h3>
          {completedBookings.length === 0 && !loading ? (
            <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No delivered/completed trips available for bilty generation.
            </div>
          ) : (
            <div className="space-y-3">
              {completedBookings.map((b) => (
                <div key={b.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-slate-900">
                      {bookingCrop(b)} — {b.id}
                    </p>
                    <p className="text-xs text-slate-400">{bookingPickup(b)} → {bookingDrop(b)} • {formatCurrency(bookingFare(b))}</p>
                  </div>
                  <button
                    onClick={() => openBilty(b)}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 self-start sm:self-auto"
                  >
                    <FileText className="w-3.5 h-3.5" /> View / Print Bilty
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Settlements */}
      {activeTab === 'settlements' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <p className="text-[10px] uppercase font-bold text-slate-400">Wallet Balance</p>
              <p className="text-xl font-black text-emerald-700">{formatCurrency(walletBalance)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <p className="text-[10px] uppercase font-bold text-slate-400">TDS Deducted (194-O)</p>
              <p className="text-xl font-black text-slate-900">{formatCurrency(firstNum(asRec(wallet.tds), ['tdsDeductedPaisa'], 0) / 100)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <p className="text-[10px] uppercase font-bold text-slate-400">Settlements</p>
              <p className="text-xl font-black text-slate-900">{settlements.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <p className="text-[10px] uppercase font-bold text-slate-400">Est. Net Profit</p>
              <p className="text-xl font-black text-emerald-700">{formatCurrency(firstNum(analytics, ['estimatedNetProfit'], 0))}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Settlements & Platform Deductions (10%)</h3>
            <Link to="/transporter/wallet" className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> Wallet & Payouts
            </Link>
          </div>
          {settlements.length === 0 && !loading ? (
            <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No settlements yet. Settlements are generated after trip completion.
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((s) => {
                const sourceIds = Array.isArray(s.sourceIds) ? (s.sourceIds as unknown[]) : [];
                const firstBookingId = sourceIds.length > 0 ? str(sourceIds[0]) : str(s.bookingId ?? s.booking_id, '');
                const gross = firstNum(s, ['grossRupees', 'gross', 'grossAmount', 'fare'], 0);
                const fee = firstNum(s, ['commissionRupees', 'commission', 'platformFee', 'fee'], 0);
                const net = firstNum(s, ['netRupees', 'net', 'netAmount', 'payout'], gross - fee);
                return (
                  <div key={str(s.id) || JSON.stringify(s).slice(0, 24)} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm text-slate-900">
                          {firstStr(s, ['periodStart', 'reference', 'label'], 'Settlement')}
                          {firstStr(s, ['periodEnd'], '') !== '—' ? ` → ${firstStr(s, ['periodEnd'])}` : ''}
                        </p>
                        <p className="text-xs text-slate-400">
                          {sourceIds.length > 0 ? `${sourceIds.length} trip(s)` : fmtDate(s.createdAt ?? s.settledAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={str(s.status, 'pending')} />
                        {firstBookingId && (
                          <button
                            onClick={() => openInvoice(firstBookingId)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                          >
                            Commission Invoice
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Gross</span>
                        <p className="font-bold text-slate-900">{formatCurrency(gross)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Platform Fee</span>
                        <p className="font-bold text-rose-700">-{formatCurrency(fee)}</p>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <span className="text-emerald-600 text-[10px] uppercase font-bold">Net Payout</span>
                        <p className="font-bold text-emerald-800">{formatCurrency(net)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Apply modal: quote → vehicle → terms → MPIN → done */}
      <ModalSheet
        isOpen={!!bidModal}
        onClose={() => setBidModal(null)}
        title={bidStep === 'done' ? 'Application Submitted' : 'Apply for this Load'}
        description={
          bidModal
            ? `${firstStr(bidModal, ['crop', 'cargoCrop', 'commodity', 'title'], 'Load')} #${str(bidModal.id)} — ${firstStr(bidModal, ['pickupLocation', 'pickup'], '—')} → ${firstStr(bidModal, ['dropLocation', 'drop'], '—')}`
            : undefined
        }
        maxWidth="sm"
      >
        {bidStep === 'done' ? (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <span className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <Check className="w-8 h-8" />
            </span>
            <p className="text-sm font-bold text-slate-900">Application sent to the farmer</p>
            <p className="text-xs text-slate-500 max-w-sm">
              Your quote and vehicle were shared. Your phone number stays hidden until the farmer
              accepts your application — then both sides see phone &amp; WhatsApp to coordinate the pickup.
            </p>
            <button
              onClick={() => setBidModal(null)}
              className="mt-1 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              Done
            </button>
          </div>
        ) : bidStep === 'form' ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setBidError(null);
              setMpinKey((k) => k + 1);
              setBidStep('mpin');
            }}
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Your Quoted Fare (₹)</label>
              <input
                type="number"
                value={bidFare}
                onChange={(e) => setBidFare(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-base font-bold rounded-xl border border-slate-300 text-emerald-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle (must be free on the pickup date)</label>
              <select
                value={bidVehicleId}
                onChange={(e) => setBidVehicleId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                required
              >
                <option value="" disabled>
                  {vehiclesFreeOn(pickupDateOf(bidModal ?? {})).length === 0
                    ? 'No verified vehicle free on this date'
                    : 'Select your vehicle'}
                </option>
                {vehiclesFreeOn(pickupDateOf(bidModal ?? {})).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNo ?? v.registrationNumber} — {v.vehicleType}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Note to farmer (optional)</label>
              <textarea
                value={bidNotes}
                onChange={(e) => setBidNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                placeholder="ETA, tarpaulin available, loading at 6 AM…"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={bidTerms}
                onChange={(e) => setBidTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600"
              />
              <span className="text-[11px] text-slate-600 leading-relaxed">
                I accept the platform <strong>terms &amp; conditions</strong> and confirm the selected
                vehicle is available for the pickup date. My contact stays hidden until the farmer
                accepts this application; on acceptance both sides' phone &amp; WhatsApp are shared to
                coordinate pickup directly. Agrovercity only connects the two parties.
              </span>
            </label>

            {bidError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                {bidError}
              </div>
            )}

            <button
              type="submit"
              disabled={!bidTerms || bidFare <= 0 || !bidVehicleId}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" /> Continue — Verify MPIN
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center justify-between">
              <span>
                Quote: <strong className="text-emerald-800">{formatCurrency(bidFare)}</strong>
                {(() => {
                  const vehicle = vehicles.find((v) => v.id === bidVehicleId);
                  return vehicle ? (
                    <>
                      {' '}
                      • <strong className="text-slate-900">{vehicle.registrationNo ?? vehicle.registrationNumber}</strong>
                    </>
                  ) : null;
                })()}
              </span>
              <button type="button" onClick={() => setBidStep('form')} className="font-bold text-emerald-700 hover:underline">
                Edit
              </button>
            </div>
            <MpinPad
              key={mpinKey}
              onSuccess={(mpin) => void submitBid(mpin)}
              title="Verify MPIN to Apply"
              subtitle="Confirms your identity and records the application — contact is shared only if the farmer accepts."
            />
            {bidError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                {bidError}
              </div>
            )}
            {bidBusy && (
              <div className="py-2 text-center text-xs font-bold text-slate-500 animate-pulse">
                Verifying &amp; submitting application…
              </div>
            )}
          </div>
        )}
      </ModalSheet>

      {/* Commission invoice modal */}
      <ModalSheet isOpen={!!invoice} onClose={() => setInvoice(null)} title="Commission Invoice" maxWidth="sm">
        {invoice && (
          <div className="space-y-2">
            {Object.entries(invoice).map(([k, v]) => (
              <div key={k} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                <span className="font-bold text-slate-900 text-right">
                  {typeof v === 'number' ? formatCurrency(v) : typeof v === 'string' ? v : JSON.stringify(v)}
                </span>
              </div>
            ))}
          </div>
        )}
      </ModalSheet>

      {/* Bilty modal */}
      <ModalSheet isOpen={!!biltyFor} onClose={() => { setBiltyFor(null); setBiltyData(null); }} title={`Bilty — ${biltyFor?.id ?? ''}`} description="Consignment note (print or save as PDF)" maxWidth="md">
        {biltyData && Object.keys(biltyData).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(biltyData).map(([k, v]) => (
              <div key={k} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                <span className="font-bold text-slate-900 text-right max-w-[60%]">{typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v)}</span>
              </div>
            ))}
            <button onClick={() => window.print()} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs no-print">
              Print / Save PDF
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-4">Loading bilty…</p>
        )}
      </ModalSheet>
    </div>
  );
};
