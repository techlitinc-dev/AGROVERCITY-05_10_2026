import React, { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { transport, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
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
  const [settlements, setSettlements] = useState<Rec[]>([]);
  const [wallet, setWallet] = useState<Rec>({});
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bidModal, setBidModal] = useState<Rec | null>(null);
  const [bidFare, setBidFare] = useState(0);
  const [bidVehicleId, setBidVehicleId] = useState('');
  const [bidNotes, setBidNotes] = useState('');
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
      const [l, m, f, b, s] = await Promise.all([
        transport.loads(),
        transport.matchedLoads().catch(() => [] as unknown[]),
        transport.fareTrends().catch(() => [] as unknown[]),
        transport.bookings(),
        transport.settlements().catch(() => [] as unknown[]),
      ]);
      setLoads(asArr(l).map(asRec));
      setMatched(asArr(m).map(asRec));
      setFareTrends(asArr(f).map(asRec));
      setBookings(b);
      setSettlements(asArr(s).map(asRec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openBid = (loadRec: Rec) => {
    setBidModal(loadRec);
    setBidFare(firstNum(loadRec, ['targetFare', 'currentBid', 'lowestBid', 'estFare', 'estimatedFare'], 0));
    setBidVehicleId(vehicles[0]?.id ?? '');
    setBidNotes('');
  };

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidModal) return;
    try {
      const vehicle = vehicles.find((v) => v.id === bidVehicleId);
      await transport.bid(str(bidModal.id), {
        quotedFare: bidFare,
        ...(vehicle ? { vehicleId: vehicle.id, vehicleNo: vehicle.registrationNo ?? vehicle.registrationNumber } : {}),
        ...(bidNotes.trim() ? { notes: bidNotes.trim() } : {}),
      });
      setBidModal(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
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
                      </div>
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        {firstStr(load, ['pickupLocation', 'pickup', 'pickupAddress'], '—')} → {firstStr(load, ['dropLocation', 'drop', 'dropAddress'], '—')}
                        {distance > 0 ? ` (${distance} km)` : ''}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> Pickup: {fmtDate(load.pickupDate ?? load.pickupTime ?? load.date)}
                        {str(load.preferredVehicleType, '') !== '—' ? ` • prefers ${str(load.preferredVehicleType)}` : ''}
                        {firstNum(load, ['bidsCount'], 0) > 0 ? ` • ${firstNum(load, ['bidsCount'])} bid(s)` : ''}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-end justify-between gap-3">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Fare</span>
                        <span className="text-xl font-black text-emerald-700">{formatCurrency(targetFare)}</span>
                        {currentBid > 0 && <span className="text-[10px] text-slate-400 block">Lowest bid {formatCurrency(currentBid)}</span>}
                      </div>
                      <button
                        onClick={() => openBid(load)}
                        className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                      >
                        Place Bid
                      </button>
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

      {/* Bid Modal */}
      <ModalSheet isOpen={!!bidModal} onClose={() => setBidModal(null)} title="Place Freight Bid" description={bidModal ? `${firstStr(bidModal, ['crop', 'cargoCrop', 'commodity', 'title'], 'Load')} #${str(bidModal.id)}` : undefined} maxWidth="sm">
        <form onSubmit={handleBid} className="space-y-3">
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
            <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle (optional)</label>
            <select
              value={bidVehicleId}
              onChange={(e) => setBidVehicleId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="">No vehicle attached</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNo ?? v.registrationNumber} — {v.vehicleType}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note to load owner (optional)</label>
            <textarea
              value={bidNotes}
              onChange={(e) => setBidNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="ETA, tarpaulin available, loading at 6 AM…"
            />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md">
            Submit Bid
          </button>
        </form>
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
