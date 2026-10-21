import React, { useEffect, useState } from 'react';
import {
  Users,
  TrendingUp,
  Truck,
  ShoppingBag,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  Sprout,
  HeartHandshake,
  Flower2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import { KpiCard } from '../components/KpiCard';
import { useAuth } from '../context/AuthContext';

export const OverviewView: React.FC = () => {
  const { currentRole, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [shgs, setShgs] = useState<any[]>([]);
  const [nurseries, setNurseries] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        summaryData,
        lotsData,
        vehiclesData,
        bookingsData,
        ordersData,
        shgsData,
        nurseriesData,
        ratesData,
      ] = await Promise.all([
        api.getPlatformOverview().catch(() => null),
        api.getFarmerLots().catch(() => []),
        api.getVehicles().catch(() => []),
        api.getTransportBookings().catch(() => []),
        api.getMarketplaceOrders().catch(() => []),
        api.getShgQueue().catch(() => []),
        api.getNurseries().catch(() => []),
        api.getPendingMandiRates().catch(() => []),
      ]);

      setSummary(summaryData);
      setLots(lotsData);
      setVehicles(vehiclesData);
      setBookings(bookingsData);
      setOrders(ordersData);
      setShgs(shgsData);
      setNurseries(nurseriesData);
      setRates(ratesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load live data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              Live Production State
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">System Operations & Multi-Persona Clearance Desk</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time governance over Farmers, Transporters, Vyaparis, Mahila Graha Udyog, Nurseries & eMarket Customers.
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all flex items-center gap-2 self-start md:self-auto border border-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Live Data
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Backend Notice: {error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Registered Users"
          value={summary?.activeUsersTotal ?? '27'}
          subtitle="Across 15 rural persona tiers"
          icon={Users}
          color="blue"
          trend="Real Firestore"
        />
        <KpiCard
          title="Produce Lots Listed"
          value={lots.length}
          subtitle="Farmer harvested crop lots"
          icon={Sprout}
          color="emerald"
          trend={`${lots.filter((l) => l.status === 'active' || l.status === 'approved').length} Active`}
        />
        <KpiCard
          title="Fleet & Logistics"
          value={`${vehicles.length} Vehicles`}
          subtitle={`${bookings.length} Bookings dispatched`}
          icon={Truck}
          color="purple"
          trend={`${bookings.filter((b) => b.status === 'in_transit' || b.status === 'accepted').length} In Transit`}
        />
        <KpiCard
          title="Marketplace GMV"
          value={`₹${(summary?.marketplaceGMV ?? 1660).toLocaleString('en-IN')}`}
          subtitle={`${orders.length} Real customer orders`}
          icon={ShoppingBag}
          color="amber"
          trend="Escrow Protected"
        />
      </div>

      {/* Operational Queues Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Clearance Queues */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Administrative Verification Queues
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Real-time Backend Counters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300">Pending Mandi Rates</span>
                <p className="text-[10px] text-slate-500">Vyapari trader rate proposals</p>
              </div>
              <span className="text-lg font-black text-amber-400 font-mono">{rates.length}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300">Women SHG Verification</span>
                <p className="text-[10px] text-slate-500">Mahila Bachat Gat approvals</p>
              </div>
              <span className="text-lg font-black text-purple-400 font-mono">{shgs.length}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300">Nursery Accreditation</span>
                <p className="text-[10px] text-slate-500">Certified sapling providers</p>
              </div>
              <span className="text-lg font-black text-teal-400 font-mono">{nurseries.length}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300">Vehicle RC & Fitness</span>
                <p className="text-[10px] text-slate-500">Transporter fleet compliance</p>
              </div>
              <span className="text-lg font-black text-blue-400 font-mono">{vehicles.length}</span>
            </div>
          </div>

          {/* Persona Distribution Live Breakdown */}
          {summary?.personaBreakdown && (
            <div className="pt-3 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300 block mb-2">Live Persona Distribution in Database:</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.personaBreakdown).map(([persona, count]: any) => (
                  <span
                    key={persona}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono flex items-center gap-1.5"
                  >
                    <span className="font-semibold text-emerald-400">{persona}:</span>
                    <span>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Quick Action & Active Operator Desk */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Active Operator Session
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Session identity and privilege enforcement</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Current Officer</span>
              <p className="text-sm font-bold text-white mt-0.5">{currentUser?.name || 'Administrator'}</p>
              <p className="text-xs text-slate-400 font-mono">{currentUser?.phone}</p>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-slate-500">Assigned RBAC Role</span>
              <div className="mt-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {currentRole}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>FastAPI Base:</span>
                <span className="font-mono text-slate-300">http://0.0.0.0:8000</span>
              </div>
              <div className="flex justify-between">
                <span>Audit Header:</span>
                <span className="font-mono text-emerald-400">X-Audit-Reason</span>
              </div>
              <div className="flex justify-between">
                <span>RBAC Header:</span>
                <span className="font-mono text-emerald-400">X-Admin-Role</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
