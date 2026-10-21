import React, { useEffect, useState } from 'react';
import {
  Building2,
  FileText,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  Eye,
  XCircle,
  MapPin,
  Calendar,
} from 'lucide-react';
import { api } from '../lib/api';
import { LandListing, LandLease } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { KpiCard } from '../components/KpiCard';

export const LandlordView: React.FC = () => {
  const [subTab, setSubTab] = useState<'listings' | 'leases'>('listings');
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [listings, setListings] = useState<LandListing[]>([]);
  const [leases, setLeases] = useState<LandLease[]>([]);

  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [drawerTitle, setDrawerTitle] = useState<string>('');

  const [auditAction, setAuditAction] = useState<{
    type: 'terminate_lease';
    title: string;
    description: string;
    targetId: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, leaseRes] = await Promise.all([
        api.getLandListings(),
        api.getLandLeases(),
      ]);
      setListings(listRes);
      setLeases(leaseRes);
    } catch (err) {
      console.error('Error fetching landlord data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const executeAuditAction = async (reason: string) => {
    if (!auditAction) return;
    if (auditAction.type === 'terminate_lease') {
      await api.terminateLandLease(auditAction.targetId, reason);
    }
    setAuditAction(null);
    await loadData();
  };

  const filteredListings = listings.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.village?.toLowerCase().includes(q) ||
      l.district?.toLowerCase().includes(q) ||
      l.landlordName?.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  });

  const filteredLeases = leases.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.village?.toLowerCase().includes(q) ||
      l.landlordName?.toLowerCase().includes(q) ||
      l.farmerName?.toLowerCase().includes(q) ||
      l.surveyNumber?.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Persona 2: Landlord & Farm Real Estate
              </span>
              <span className="text-xs text-slate-400">Live 7/12 Land Registry Verification</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              Farm Landlord & Lease Governance
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Inspect farm plots available for agricultural lease, verify 7/12 revenue records, audit village rental rates,
              and manage formal lease agreements between landlords and kisan tenants.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex border-b border-slate-800 mt-6 -mb-2">
          <button
            onClick={() => setSubTab('listings')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              subTab === 'listings'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Active Land Listings
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {listings.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('leases')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              subTab === 'leases'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Lease Agreements & 7/12 Audit
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {leases.length}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Plots Listed"
          value={listings.length}
          change="Available for lease"
          changeType="positive"
          icon={Building2}
        />
        <KpiCard
          title="Active Lease Deeds"
          value={leases.filter((l) => l.status === 'active').length}
          change="Formal stamp agreement"
          changeType="neutral"
          icon={FileText}
        />
        <KpiCard
          title="7/12 Audit Flagged"
          value={leases.filter((l) => l.recordMismatch).length}
          change="Survey number checks"
          changeType="negative"
          icon={AlertTriangle}
        />
        <KpiCard
          title="Avg Land Acreage"
          value="4.5 Acres"
          change="Per listing plot"
          changeType="neutral"
          icon={MapPin}
        />
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search village, landlord, plot, survey #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="text-xs text-slate-400">
          Showing{' '}
          <span className="text-white font-semibold">
            {subTab === 'listings' ? filteredListings.length : filteredLeases.length}
          </span>{' '}
          records from Firestore
        </div>
      </div>

      {/* Subtab 1: Listings Table */}
      {subTab === 'listings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Plot ID & Landlord</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Area (Acres)</th>
                  <th className="py-3.5 px-4">Expected Rent (₹/yr)</th>
                  <th className="py-3.5 px-4">Quality / Audit Flags</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredListings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No farm land listings found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredListings.map((plot) => (
                    <tr key={plot.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{plot.landlordName || 'Registered Landlord'}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{plot.id}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="font-medium text-white">{plot.village || 'Niphad'}</div>
                        <div className="text-[10px] text-slate-400">{plot.district || 'Nashik'}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-white">
                        {plot.areaAcres ? `${plot.areaAcres} Acres` : '3.0 Acres'}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-emerald-400">
                        ₹{(plot.expectedRentRupees || 45000).toLocaleString()}/yr
                      </td>

                      <td className="py-3.5 px-4">
                        {plot.auditFlags && plot.auditFlags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {plot.auditFlags.map((flag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verified Rent Band
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {plot.status || 'open'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedEntity(plot);
                            setDrawerTitle(`Land Listing Plot [${plot.id}]`);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="Inspect Plot Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

      {/* Subtab 2: Leases Table */}
      {subTab === 'leases' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Lease ID & Parties</th>
                  <th className="py-3.5 px-4">Survey Number (7/12)</th>
                  <th className="py-3.5 px-4">Village & District</th>
                  <th className="py-3.5 px-4">Annual Rent (₹)</th>
                  <th className="py-3.5 px-4">Tenure Period</th>
                  <th className="py-3.5 px-4">Audit Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No active lease agreements found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredLeases.map((lease) => (
                    <tr key={lease.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">
                          Landlord: {lease.landlordName || 'Ashok Patil'}
                        </div>
                        <div className="text-[11px] text-emerald-400 mt-0.5">
                          Tenant: {lease.farmerName || 'Kisan Tenant'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{lease.id}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-slate-200">{lease.surveyNumber || 'Gat No 142/B'}</div>
                        {lease.recordMismatch && (
                          <div className="flex items-center gap-1 text-[10px] text-rose-400 font-sans mt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            7/12 mismatch
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div>{lease.village || 'Panchvati'}</div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-emerald-400">
                        ₹{(lease.rentPerYearRupees || 60000).toLocaleString()}/yr
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{lease.startDate || '2026-06-01'} to {lease.endDate || '2027-05-31'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {lease.status || 'active'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedEntity(lease);
                              setDrawerTitle(`Lease Agreement [${lease.id}]`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setAuditAction({
                                type: 'terminate_lease',
                                title: `Arbitrated Lease Termination: ${lease.id}`,
                                description: `Issue formal termination notice and release security escrow.`,
                                targetId: lease.id,
                              });
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition"
                            title="Arbitrated Termination"
                          >
                            <XCircle className="w-3.5 h-3.5" />
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
