import React, { useEffect, useState } from 'react';
import {
  Wrench,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Eye,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import { EquipmentItem, EquipmentBooking } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { KpiCard } from '../components/KpiCard';

export const EquipmentView: React.FC = () => {
  const [subTab, setSubTab] = useState<'inventory' | 'bookings'>('inventory');
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [bookings, setBookings] = useState<EquipmentBooking[]>([]);

  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [drawerTitle, setDrawerTitle] = useState<string>('');

  const [auditAction, setAuditAction] = useState<{
    type: 'verify_equipment' | 'escalate_booking';
    title: string;
    description: string;
    targetId: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eqRes, bookRes] = await Promise.all([
        api.getEquipment(),
        api.getEquipmentBookings(),
      ]);
      setEquipmentList(eqRes);
      setBookings(bookRes);
    } catch (err) {
      console.error('Error fetching equipment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const executeAuditAction = async (reason: string) => {
    if (!auditAction) return;
    if (auditAction.type === 'verify_equipment') {
      await api.verifyEquipment(auditAction.targetId, reason);
    } else if (auditAction.type === 'escalate_booking') {
      await api.escalateEquipmentBooking(auditAction.targetId, reason);
    }
    setAuditAction(null);
    await loadData();
  };

  const filteredEquipment = equipmentList.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.name?.toLowerCase().includes(q) ||
      item.type?.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });

  const filteredBookings = bookings.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.id.toLowerCase().includes(q) ||
      b.equipmentName?.toLowerCase().includes(q) ||
      b.renterName?.toLowerCase().includes(q) ||
      b.status?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Persona 5: Equipment Owner & Custom Hiring (Yantra)
              </span>
              <span className="text-xs text-slate-400">Live Custom Hiring Center Pool</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              Farm Machinery & Rental Desk
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Inspect verified tractors, rotavators, drone sprayers and harvesters. Audit hourly and per-acre rental rates,
              and resolve farmer booking schedule disputes with audit transparency.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Subtab Navigation */}
        <div className="flex border-b border-slate-800 mt-6 -mb-2">
          <button
            onClick={() => setSubTab('inventory')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              subTab === 'inventory'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Machinery Fleet & Rates
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {equipmentList.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('bookings')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              subTab === 'bookings'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            Farmer Bookings & Disputes
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {bookings.length}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active Farm Machinery"
          value={equipmentList.filter((e) => e.active).length}
          change="Available for hire"
          changeType="positive"
          icon={Wrench}
        />
        <KpiCard
          title="Total Farmer Bookings"
          value={bookings.length}
          change="Slots reserved"
          changeType="neutral"
          icon={CalendarCheck}
        />
        <KpiCard
          title="Dispute Triage Rate"
          value={bookings.filter((b) => b.status === 'disputed').length}
          change="Escalated slots"
          changeType="negative"
          icon={AlertTriangle}
        />
        <KpiCard
          title="Avg Tractor Hourly Rate"
          value="₹625 / hr"
          change="Custom hiring benchmark"
          changeType="neutral"
          icon={Clock}
        />
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search equipment, renter, booking id..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="text-xs text-slate-400">
          Showing{' '}
          <span className="text-white font-semibold">
            {subTab === 'inventory' ? filteredEquipment.length : filteredBookings.length}
          </span>{' '}
          real machinery records
        </div>
      </div>

      {/* Subtab 1: Inventory Table */}
      {subTab === 'inventory' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Machinery Name & Type</th>
                  <th className="py-3.5 px-4">Owner Model</th>
                  <th className="py-3.5 px-4">Hourly Rate</th>
                  <th className="py-3.5 px-4">Per Acre Rate</th>
                  <th className="py-3.5 px-4">Doc Verification</th>
                  <th className="py-3.5 px-4">Operational Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEquipment.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No farm equipment records found.
                    </td>
                  </tr>
                ) : (
                  filteredEquipment.map((eq) => (
                    <tr key={eq.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="text-sm font-bold text-white">{eq.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{eq.id}</div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                          {eq.ownerType || 'Private Individual'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-emerald-400 whitespace-nowrap">
                        {eq.hourlyRate ? `₹${eq.hourlyRate} / hr` : '—'}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-cyan-300 whitespace-nowrap">
                        {eq.perAcreRate ? `₹${eq.perAcreRate} / acre` : '—'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {eq.docStatus === 'verified' ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            RC & Insurance Verified
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {eq.docStatus || 'Pending'}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            eq.active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {eq.active ? 'Active & Ready' : 'Maintenance'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedEntity(eq);
                              setDrawerTitle(`Equipment [${eq.id}]`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                            title="Inspect Doc"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {eq.docStatus !== 'verified' && (
                            <button
                              onClick={() => {
                                setAuditAction({
                                  type: 'verify_equipment',
                                  title: `Verify Machinery Registration: ${eq.name}`,
                                  description: `Confirm RC book, horsepower compliance, and safety certificate.`,
                                  targetId: eq.id,
                                });
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 rounded-lg transition border border-emerald-500/30"
                            >
                              Verify Unit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Bookings Table */}
      {subTab === 'bookings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Booking ID</th>
                  <th className="py-3.5 px-4">Equipment Unit</th>
                  <th className="py-3.5 px-4">Renter Kisan</th>
                  <th className="py-3.5 px-4">Date & Slot</th>
                  <th className="py-3.5 px-4">Total Amount (₹)</th>
                  <th className="py-3.5 px-4">Booking Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No equipment bookings found matching search.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-300">
                        {b.id}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-white">
                        {b.equipmentName || b.equipmentId || 'Swaraj 855 Tractor'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="font-medium text-white">{b.renterName || 'Kisan User'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{b.renterId}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div>{b.bookingDate || '2026-10-22'}</div>
                        <div className="text-[10px] text-cyan-400 font-medium">{b.slot || 'Morning (8am - 12pm)'}</div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-emerald-400 font-mono">
                        ₹{(b.totalAmountRupees || 2400).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {b.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedEntity(b);
                              setDrawerTitle(`Equipment Booking [${b.id}]`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setAuditAction({
                                type: 'escalate_booking',
                                title: `Escalate Booking Dispute: ${b.id}`,
                                description: `Escalate time slot conflict or breakdown dispute to operations lead.`,
                                targetId: b.id,
                              });
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition border border-amber-500/20"
                          >
                            Escalate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw JSON Inspector Drawer */}
      <EntityDrawer
        isOpen={Boolean(selectedEntity)}
        onClose={() => setSelectedEntity(null)}
        title={drawerTitle}
        data={selectedEntity}
      />

      {/* Rule 8 Audit Reason Modal */}
      {auditAction && (
        <AuditModal
          isOpen={true}
          title={auditAction.title}
          description={auditAction.description}
          targetEntityId={auditAction.targetId}
          onConfirm={executeAuditAction}
          onCancel={() => setAuditAction(null)}
        />
      )}
    </div>
  );
};
