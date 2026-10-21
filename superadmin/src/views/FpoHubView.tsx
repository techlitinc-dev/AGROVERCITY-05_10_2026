import React, { useEffect, useState } from 'react';
import {
  Users2,
  Package,
  ShieldCheck,
  RefreshCw,
  Search,
  Eye,
  CheckCircle2,
  TrendingDown,
  Building,
} from 'lucide-react';
import { api } from '../lib/api';
import { FpoItem, FpoPoolItem } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { KpiCard } from '../components/KpiCard';

export const FpoHubView: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [fpos, setFpos] = useState<FpoItem[]>([]);
  const [pools, setPools] = useState<FpoPoolItem[]>([]);

  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [drawerTitle, setDrawerTitle] = useState<string>('');

  const [auditAction, setAuditAction] = useState<{
    type: 'verify_fpo' | 'update_pool';
    title: string;
    description: string;
    targetId: string;
    payload?: any;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const fpoList = await api.getFpos();
      setFpos(fpoList);
      if (fpoList.length > 0) {
        const poolList = await api.getFpoPools(fpoList[0].id);
        setPools(poolList);
      }
    } catch (err) {
      console.error('Error fetching FPO data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const executeAuditAction = async (reason: string) => {
    if (!auditAction) return;
    if (auditAction.type === 'verify_fpo') {
      await api.verifyFpo(auditAction.targetId, reason);
    } else if (auditAction.type === 'update_pool') {
      await api.updateFpoPoolStatus(auditAction.targetId, auditAction.payload.status, reason);
    }
    setAuditAction(null);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                Persona 9: FPO / Cooperative Leader
              </span>
              <span className="text-xs text-slate-400">Live Farmer Producer Organization Directory</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              FPO & Farmer Producer Company Hub
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Audit registered Farmer Producer Organizations (FPOs), verify corporate registrar certificates,
              and oversee group-buying procurement pools for bulk seeds, bio-fertilisers, and inputs.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active FPOs"
          value={fpos.length}
          change="Sahyadri Shetkari FPO"
          changeType="positive"
          icon={Building}
        />
        <KpiCard
          title="Shareholder Farmers"
          value={fpos.reduce((acc, f) => acc + (f.memberCount || 214), 0)}
          change="Member network"
          changeType="positive"
          icon={Users2}
        />
        <KpiCard
          title="Group Buying Pools"
          value={pools.length || 1}
          change="Bulk discounts"
          changeType="positive"
          icon={Package}
        />
        <KpiCard
          title="Average Input Discount"
          value="18% Off"
          change="Direct manufacturer deal"
          changeType="positive"
          icon={TrendingDown}
        />
      </div>

      {/* FPO Roster Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Building className="w-4 h-4 text-teal-400" />
          Registered FPOs in Database
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fpos.map((fpo) => (
            <div
              key={fpo.id}
              className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    FPO Cooperative
                  </span>
                  <span className="text-xs font-mono text-slate-400">{fpo.id}</span>
                </div>

                <h3 className="text-lg font-bold text-white mt-3">{fpo.name}</h3>
                <div className="text-xs text-slate-400 mt-0.5">{fpo.district || 'Nashik'}, Maharashtra</div>

                <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Shareholder Members:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {fpo.memberCount || 214} Kisan Members
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Registration:</span>
                    <span className="text-slate-300 font-mono">NABARD / MCA Certified</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => {
                    setSelectedEntity(fpo);
                    setDrawerTitle(`FPO Entity [${fpo.id}]`);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                >
                  Inspect FPO Doc
                </button>

                <button
                  onClick={() => {
                    setAuditAction({
                      type: 'verify_fpo',
                      title: `Verify FPO: ${fpo.name}`,
                      description: `Certify FPO for collective input discounts and government equity grants.`,
                      targetId: fpo.id,
                    });
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-teal-300 hover:text-teal-200 bg-teal-600/20 hover:bg-teal-600/30 rounded-lg transition border border-teal-500/30"
                >
                  Verify Compliance
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Procurement Pools Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-400" />
          Bulk Input Procurement Pools (Live Group Buying)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Pool ID & Item</th>
                <th className="py-3.5 px-4">FPO Organizer</th>
                <th className="py-3.5 px-4">Booked / Target Units</th>
                <th className="py-3.5 px-4">Bulk Discount</th>
                <th className="py-3.5 px-4">Order Deadline</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {pools.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4 font-semibold text-white">
                    <div className="text-sm font-bold text-white">{p.item}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{p.id}</div>
                  </td>

                  <td className="py-3.5 px-4 text-slate-300 font-medium">
                    {p.fpoName || 'Sahyadri Shetkari FPO'}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-emerald-400">{p.bookedUnits || 380}</span>
                      <span className="text-slate-500">/</span>
                      <span className="text-slate-300">{p.targetUnits || 500}</span>
                      <span className="text-[10px] text-emerald-400 font-sans font-semibold">(76% filled)</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-amber-300 font-mono">
                    {p.discountPercent || 18}% Off
                  </td>

                  <td className="py-3.5 px-4 text-slate-300 font-mono">
                    {p.deadline || '2026-10-31'}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {p.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedEntity(p);
                          setDrawerTitle(`Procurement Pool [${p.id}]`);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setAuditAction({
                            type: 'update_pool',
                            title: `Close Procurement Pool: ${p.id}`,
                            description: `Close booking window and dispatch bulk purchase order to factory.`,
                            targetId: p.id,
                            payload: { status: 'closed' },
                          });
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                      >
                        Close Pool
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
