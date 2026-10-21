import React, { useEffect, useState } from 'react';
import {
  Snowflake,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Search,
  Eye,
  ThermometerSnowflake,
  Boxes,
  MapPin,
  Clock,
} from 'lucide-react';
import { api } from '../lib/api';
import { ColdStorageFacility } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { KpiCard } from '../components/KpiCard';

export const ColdStorageView: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [facilities, setFacilities] = useState<ColdStorageFacility[]>([]);

  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [drawerTitle, setDrawerTitle] = useState<string>('');

  const [auditAction, setAuditAction] = useState<{
    type: 'verify_facility';
    title: string;
    description: string;
    targetId: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getColdStorages();
      setFacilities(res);
    } catch (err) {
      console.error('Error fetching cold storage facilities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const executeAuditAction = async (reason: string) => {
    if (!auditAction) return;
    if (auditAction.type === 'verify_facility') {
      await api.verifyColdStorage(auditAction.targetId, reason);
    }
    setAuditAction(null);
    await loadData();
  };

  const filtered = facilities.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.name?.toLowerCase().includes(q) ||
      f.district?.toLowerCase().includes(q) ||
      f.operatorName?.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Persona 17: Cold Storage Owner (Post-Harvest Infrastructure)
              </span>
              <span className="text-xs text-slate-400">Live Cold Chain & Chamber Network</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              Cold Storage Warehousing Governance
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Audit cold warehouse chambers, atmospheric control certifications, temperature sensors,
              and electronic negotiable warehouse receipt (e-NWR) collateral storage for farmers.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active Cold Chains"
          value={facilities.length}
          change="4 live facilities"
          changeType="positive"
          icon={Snowflake}
        />
        <KpiCard
          title="Aggregate Capacity"
          value="18,500 MT"
          change="Onion, Grape & Potato"
          changeType="positive"
          icon={Boxes}
        />
        <KpiCard
          title="Temperature Regimes"
          value="0°C to 15°C"
          change="Multi-chamber CA"
          changeType="neutral"
          icon={ThermometerSnowflake}
        />
        <KpiCard
          title="Avg Chamber Occupancy"
          value="74% Full"
          change="Pre-Diwali peak season"
          changeType="neutral"
          icon={Clock}
        />
      </div>

      {/* Search / Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search facility name, district, crop..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="text-white font-semibold">{filtered.length}</span> verified cold chain facilities
        </div>
      </div>

      {/* Facilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((f) => (
          <div
            key={f.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Snowflake className="w-3.5 h-3.5" />
                  Cold Chain Facility
                </span>
                <span className="text-xs font-mono text-slate-400">{f.id}</span>
              </div>

              <h3 className="text-base font-bold text-white mt-3">{f.name}</h3>
              <div className="text-xs text-slate-400 mt-0.5">{f.district || 'Nashik'}, Maharashtra</div>

              <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Storage Capacity:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {(f.capacityMetricTons || 5000).toLocaleString()} MT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Atmospheric Temp:</span>
                  <span className="text-cyan-300 font-mono">{f.temperatureRangeCelsius || '0°C to 4°C'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Supported Crops:</span>
                  <span className="text-slate-200">
                    {(f.cropsSupported || ['Onion', 'Grapes', 'Pomegranate']).join(', ')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedEntity(f);
                  setDrawerTitle(`Cold Storage Facility [${f.id}]`);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
              >
                Inspect Sensors
              </button>

              <button
                onClick={() => {
                  setAuditAction({
                    type: 'verify_facility',
                    title: `Verify Cold Storage: ${f.name}`,
                    description: `Confirm WDRA accreditation, fire safety, and temperature sensor uptime.`,
                    targetId: f.id,
                  });
                }}
                className="px-3 py-1.5 text-xs font-semibold text-blue-300 hover:text-blue-200 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg transition border border-blue-500/30"
              >
                Verify Compliance
              </button>
            </div>
          </div>
        ))}
      </div>

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
