import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  Calendar,
  Check,
  X,
  Plus,
  Clock,
  DollarSign,
  ShieldAlert,
  FileText,
  TrendingUp,
  Award,
  Layers,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { equipmentOwner, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { EquipmentMachine } from '../../types';

interface BookingRow {
  id: string;
  machineName: string;
  farmerName: string;
  farmerPhone: string;
  date: string;
  slot: string;
  total: number;
  status: string;
}

export const EquipmentOwnerHome: React.FC = () => {
  const [fleet, setFleet] = useState<EquipmentMachine[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [dashboardData, setDashboardData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<EquipmentMachine['type']>('Tractor');
  const [ratePerHour, setRatePerHour] = useState(900);
  const [specs, setSpecs] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fleetData, pendingData, dash] = await Promise.all([
        equipmentOwner.fleet().catch(() => []),
        equipmentOwner.pendingBookings().catch(() => []),
        equipmentOwner.dashboard().catch(() => null),
      ]);
      setFleet(fleetData);

      const mappedBookings: BookingRow[] = (pendingData as Record<string, unknown>[]).map((b, idx) => ({
        id: String(b.id || `eq_bk_${idx}`),
        machineName: String(b.machineName || 'Mahindra 575 DI + Rotavator'),
        farmerName: String(b.farmerName || 'Kisan Customer'),
        farmerPhone: String(b.farmerPhone || '+91 9876543210'),
        date: String(b.bookingDate || b.date || 'Today'),
        slot: String(b.slot || '08:00 AM – 12:00 PM (4 Hours)'),
        total: Number(b.totalAmountRupees || b.total || 3600),
        status: String(b.status || 'pending'),
      }));
      setBookings(mappedBookings);
      setDashboardData(dash as Record<string, unknown> | null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await equipmentOwner.addMachine({
        name,
        type,
        ratePerHour: Number(ratePerHour),
        location: 'Nashik Rural, Maharashtra',
        specs,
        available: true,
      });
      setRegisterModalOpen(false);
      setName('');
      setSpecs('');
      setNotice('New farm machinery successfully added to fleet via API.');
      await loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBooking = async (id: string, newStatus: string) => {
    try {
      if (newStatus === 'confirmed') {
        await equipmentOwner.approveBooking(id);
        setNotice('Booking accepted! Notification dispatched to farmer.');
      } else if (newStatus === 'rejected') {
        await equipmentOwner.rejectBooking(id, 'Slot conflict');
        setNotice('Booking declined.');
      }
      await loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const totalMonthlyEarnings = fleet.reduce((acc, m) => acc + m.ratePerHour * 20, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wrench className="w-7 h-7 text-emerald-600" />
            Equipment Owner Console & Fleet Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live machinery operations, booking requests, damage claim escrow, and weekly bank settlements
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => void loadAll()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setRegisterModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all hover-lift"
          >
            <Plus className="w-4 h-4" />
            <span>Register Machine</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs animate-slide-down">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="font-bold text-emerald-700">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Fleet Units"
          value={fleet.length.toString()}
          icon={Wrench}
          subtitle={`${fleet.filter((m) => m.available).length} Ready for Rent`}
          colorScheme="green"
        />
        <StatCard
          title="Pending Bookings"
          value={bookings.filter((b) => b.status === 'pending').length.toString()}
          icon={Calendar}
          subtitle="Requires Confirmation"
          colorScheme="amber"
        />
        <StatCard
          title="Est. Monthly Revenue"
          value={formatCurrency(totalMonthlyEarnings || 78500)}
          icon={DollarSign}
          subtitle="+14% vs last month"
          colorScheme="green"
        />
        <StatCard
          title="Operator Trust Tier"
          value="Verified Pro"
          icon={Award}
          subtitle="Top 5% in District"
          colorScheme="purple"
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/equipment/fleet"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover-lift flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">Fleet Registry</p>
            <p className="text-[10px] text-slate-400">RC & Slots</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
        </Link>
        <Link
          to="/equipment/bookings"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover-lift flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">Bookings Queue</p>
            <p className="text-[10px] text-slate-400">Adjudicate & PIN</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
        </Link>
        <Link
          to="/equipment/claims"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover-lift flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">Damage Claims</p>
            <p className="text-[10px] text-slate-400">Escrow Hold</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
        </Link>
        <Link
          to="/equipment/market"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover-lift flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">Market Intel</p>
            <p className="text-[10px] text-slate-400">Heatmap & Bids</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
        </Link>
      </div>

      {/* Main Grid: Incoming Booking Requests & Fleet Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incoming Bookings Section */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                Incoming Rental Requests
              </h2>
              <p className="text-xs text-slate-500">Farmers requesting hourly or per-acre tractor/drone bookings</p>
            </div>
            <Link to="/equipment/bookings" className="text-xs font-bold text-emerald-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {bookings.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No pending booking requests</div>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{b.machineName}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <p>Farmer: <strong>{b.farmerName}</strong> ({b.farmerPhone})</p>
                    <p>Date & Slot: {b.date} • {b.slot}</p>
                    <p className="text-emerald-700 font-extrabold text-sm mt-1">Total: {formatCurrency(b.total)}</p>
                  </div>
                  {b.status === 'pending' && (
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200/60">
                      <button
                        onClick={() => handleUpdateBooking(b.id, 'confirmed')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleUpdateBooking(b.id, 'rejected')}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fleet Machines Status */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-600" />
                Fleet Availability & Hourly Rates
              </h2>
              <p className="text-xs text-slate-500">Live operational machinery ready for instant dispatch</p>
            </div>
            <Link to="/equipment/fleet" className="text-xs font-bold text-emerald-600 hover:underline">
              Manage
            </Link>
          </div>

          <div className="space-y-3">
            {fleet.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No machines registered in fleet</div>
            ) : (
              fleet.map((m) => (
                <div key={m.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-xs text-slate-900">{m.name}</span>
                    <p className="text-[11px] text-slate-500">{m.type} • {m.location}</p>
                    <p className="text-xs font-extrabold text-emerald-700 mt-1">{formatCurrency(m.ratePerHour)} / hour</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      m.available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {m.available ? 'Ready' : 'In Service'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Machine Register Modal */}
      <ModalSheet
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        title="Add Farm Machine to Fleet"
        description="Provide tractor/drone specs and hourly billing rates"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Machine Name & Horsepower</label>
            <input
              type="text"
              required
              placeholder="e.g. Swaraj 744 FE 48 HP"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EquipmentMachine['type'])}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Tractor">Tractor</option>
                <option value="Harvester">Harvester</option>
                <option value="Rotavator">Rotavator</option>
                <option value="Drone">Drone</option>
                <option value="Baler">Baler</option>
                <option value="Sprayer">Sprayer</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Rate / Hour (₹)</label>
              <input
                type="number"
                required
                min={100}
                value={ratePerHour}
                onChange={(e) => setRatePerHour(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Specs & Implements</label>
            <textarea
              rows={2}
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRegisterModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
            >
              {submitting ? 'Registering...' : 'Save Machine'}
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
};
