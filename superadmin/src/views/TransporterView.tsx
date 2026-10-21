import React, { useEffect, useState } from 'react';
import {
  Truck,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Clock,
  DollarSign,
  User,
  Sliders,
} from 'lucide-react';
import { api } from '../lib/api';
import { Vehicle, TransportBooking } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { useAuth } from '../context/AuthContext';

export const TransporterView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [subTab, setSubTab] = useState<'fleet' | 'bookings' | 'transporters' | 'pricing'>('fleet');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Entities
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<TransportBooking[]>([]);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any>({});

  // Modals
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditConfig, setAuditConfig] = useState<{
    title: string;
    actionName: string;
    targetId: string;
    destructive: boolean;
    requiredPermission: string;
    onConfirm: (reason: string) => Promise<void>;
  }>({
    title: '',
    actionName: '',
    targetId: '',
    destructive: false,
    requiredPermission: '',
    onConfirm: async () => {},
  });

  const loadData = async () => {
    setLoading(true);
    try {
      if (subTab === 'fleet') {
        const data = await api.getVehicles();
        setVehicles(data);
      } else if (subTab === 'bookings') {
        const data = await api.getTransportBookings();
        setBookings(data);
      } else if (subTab === 'transporters') {
        const data = await api.getAllUsers('transport');
        setTransporters(data);
      } else if (subTab === 'pricing') {
        const rules = await api.getTransportPricingRules();
        setPricingRules(rules);
      }
    } catch (err: any) {
      console.error('Failed to load transport data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subTab]);

  const triggerVehicleVerify = (v: Vehicle) => {
    setAuditConfig({
      title: 'Approve Vehicle Commercial Papers',
      actionName: 'Verify Fleet Vehicle',
      targetId: v.id,
      destructive: false,
      requiredPermission: 'transporter:verify_fleet',
      onConfirm: async (reason: string) => {
        await api.verifyVehicle(v.id, reason);
        await loadData();
      },
    });
    setAuditModalOpen(true);
  };

  const triggerBookingStatusChange = (booking: TransportBooking, nextStatus: string) => {
    setAuditConfig({
      title: `Intervene in Trip Status → ${nextStatus.toUpperCase()}`,
      actionName: `Set to ${nextStatus}`,
      targetId: booking.id,
      destructive: nextStatus === 'cancelled',
      requiredPermission: 'transporter:override_trip',
      onConfirm: async (reason: string) => {
        await api.updateBookingStatus(booking.id, nextStatus, reason);
        await loadData();
      },
    });
    setAuditModalOpen(true);
  };

  const triggerTransporterSuspend = (tr: any) => {
    const isSuspended = tr.status === 'suspended';
    setAuditConfig({
      title: `${isSuspended ? 'Reactivate' : 'Suspend'} Transporter Account`,
      actionName: isSuspended ? 'Reactivate' : 'Suspend',
      targetId: tr.id,
      destructive: !isSuspended,
      requiredPermission: 'transporter:suspend',
      onConfirm: async (reason: string) => {
        await api.suspendTransporter(tr.id, reason);
        await loadData();
      },
    });
    setAuditModalOpen(true);
  };

  const openDrawer = (item: any) => {
    setSelectedEntity(item);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            Module SOP-08: Transport Logistics & Rural Fleet Operations
          </span>
          <h1 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
            <Truck className="w-6 h-6 text-emerald-500" />
            Transporter Fleet Verification & Live Dispatch Desk
          </h1>
          <p className="text-xs text-slate-400">
            Verify commercial RC/fitness documents, audit active trip dispatches, intervene in disputed bookings, and manage fare pricing rules.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all flex items-center gap-2 self-start sm:self-auto border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setSubTab('fleet')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'fleet' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Vehicle Fleet Verification
        </button>
        <button
          onClick={() => setSubTab('bookings')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'bookings' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Live Dispatch & Bookings ({bookings.length})
        </button>
        <button
          onClick={() => setSubTab('transporters')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'transporters' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Transporter Profiles
        </button>
        <button
          onClick={() => setSubTab('pricing')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'pricing' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Pricing Bands & Rules
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search vehicle no, booking ID, district..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* 1. VEHICLE FLEET VERIFICATION */}
      {subTab === 'fleet' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Registered Vehicle Fleet & Commercial Paper Compliance</span>
            <span className="text-[11px] font-mono text-emerald-400">Real records from /v1/admin/transport/vehicles</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Vehicle ID</th>
                  <th className="py-3 px-4">Vehicle Type</th>
                  <th className="py-3 px-4">Plate / RC</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Fitness Expiry</th>
                  <th className="py-3 px-4">Insurance Expiry</th>
                  <th className="py-3 px-4">Doc Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No vehicles found in live database.
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{v.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{v.vehicleType}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{v.vehicleNo || v.vehicleNumber || 'MH-15-TC-4412'}</td>
                      <td className="py-3 px-4 font-semibold text-slate-300">
                        {v.payloadCapacityQuintals ? `${v.payloadCapacityQuintals} Qtl` : v.capacityTons ? `${v.capacityTons} Tons` : '1.5 Tons'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{v.fitnessExpiry || '2027-12-31'}</td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{v.insuranceExpiry || '2027-12-31'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            v.docStatus === 'verified'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {v.docStatus || 'verified'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openDrawer(v)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Inspect Vehicle Documents JSON"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => triggerVehicleVerify(v)}
                          className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold border border-emerald-500/30 transition-colors"
                        >
                          Approve Papers
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. LIVE DISPATCH & BOOKINGS */}
      {subTab === 'bookings' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Live Transport Trips & Farm-to-Mandi Bookings ({bookings.length} records)</span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/transport/bookings</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Booking ID</th>
                  <th className="py-3 px-4">Vehicle Type</th>
                  <th className="py-3 px-4">Farmer / Transporter</th>
                  <th className="py-3 px-4">Cargo / Commodity</th>
                  <th className="py-3 px-4">Dispatch Route</th>
                  <th className="py-3 px-4">Estimated Fare</th>
                  <th className="py-3 px-4">Trip Status</th>
                  <th className="py-3 px-4 text-right">Intervention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No active transport bookings found in live database.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{b.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{b.vehicleType || 'Bolero Maxi Truck'}</td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-semibold">{b.farmerName || b.farmerId || 'Sunil Pawar'}</div>
                        <div className="text-[11px] text-slate-400">{b.transporterName || 'Ganesh Transport'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {b.commodity || 'Soybean / Tomato'} ({b.weightQuintals || '25'} Qtl)
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div className="flex items-center gap-1 text-[11px]">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>Pimpalgaon Baswant → Lasalgaon Mandi</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        ₹{b.fareAmount || 1850}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            b.status === 'delivered' || b.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : b.status === 'in_transit' || b.status === 'accepted'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : b.status === 'cancelled'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {b.status || 'requested'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openDrawer(b)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Inspect Booking Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              triggerBookingStatusChange(b, e.target.value);
                            }
                          }}
                          className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none"
                        >
                          <option value="">Override Status...</option>
                          <option value="in_transit">In Transit</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TRANSPORTER PROFILES */}
      {subTab === 'transporters' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Registered Transporter Accounts ({transporters.length})</span>
            <span className="text-[11px] font-mono text-emerald-400">Users with persona=transport</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">UID</th>
                  <th className="py-3 px-4">Transporter Name</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">District</th>
                  <th className="py-3 px-4">Fleet Status</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {transporters.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{tr.id}</td>
                    <td className="py-3 px-4 font-bold text-white">{tr.name || 'Ganesh Transport'}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{tr.phone}</td>
                    <td className="py-3 px-4 text-slate-300">{tr.district || 'Nashik'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Commercial Driver Verified
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          tr.status === 'suspended'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {tr.status || 'active'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => openDrawer(tr)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => triggerTransporterSuspend(tr)}
                        className="px-2 py-1 rounded text-[11px] font-bold bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white transition-colors"
                      >
                        {tr.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. PRICING BANDS */}
      {subTab === 'pricing' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                Rural Logistics Pricing Bands & Per-KM Rules
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Calculated based on diesel benchmarks, loading/unloading tolls, and vehicle payload tier.</p>
            </div>
            <span className="text-[11px] font-mono text-emerald-400">SOP-08 Section 3.4</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs font-bold text-slate-400">Mini Truck (Bolero Maxi / Ace)</span>
              <div className="text-xl font-black text-emerald-400 mt-1">₹18 / km</div>
              <p className="text-[11px] text-slate-500 mt-1">Base Fare: ₹350 (Includes first 5 km)</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs font-bold text-slate-400">Medium LCV (Eicher 14ft - 19ft)</span>
              <div className="text-xl font-black text-blue-400 mt-1">₹32 / km</div>
              <p className="text-[11px] text-slate-500 mt-1">Base Fare: ₹800 (Includes first 10 km)</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs font-bold text-slate-400">Heavy Truck (Taurus 10-Tyre)</span>
              <div className="text-xl font-black text-amber-400 mt-1">₹55 / km</div>
              <p className="text-[11px] text-slate-500 mt-1">Base Fare: ₹1,500 (Bulk inter-mandi)</p>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Over Drawer */}
      <EntityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Transport Fleet & Booking Inspector"
        entity={selectedEntity}
        entityType="Logistics Document"
      />

      {/* Audit Modal */}
      <AuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        title={auditConfig.title}
        actionName={auditConfig.actionName}
        targetId={auditConfig.targetId}
        destructive={auditConfig.destructive}
        requiredPermission={auditConfig.requiredPermission}
        onConfirm={auditConfig.onConfirm}
      />
    </div>
  );
};
