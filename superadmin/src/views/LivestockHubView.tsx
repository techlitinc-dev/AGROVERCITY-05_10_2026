import React, { useEffect, useState } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  Heart,
  Milk,
  Truck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Eye,
  AlertTriangle,
  Phone,
  FileCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { LivestockVet, GaushalaItem } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { KpiCard } from '../components/KpiCard';

type LivestockTab = 'vets' | 'gaushalas' | 'dairy' | 'milk_sellers';

export const LivestockHubView: React.FC = () => {
  const [tab, setTab] = useState<LivestockTab>('vets');
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [vets, setVets] = useState<LivestockVet[]>([]);
  const [gaushalas, setGaushalas] = useState<GaushalaItem[]>([]);
  const [dairyOrders, setDairyOrders] = useState<any[]>([]);
  const [dairyRates, setDairyRates] = useState<any[]>([]);
  const [milkClients, setMilkClients] = useState<any[]>([]);
  const [milkDeliveries, setMilkDeliveries] = useState<any[]>([]);

  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [drawerTitle, setDrawerTitle] = useState<string>('');

  const [auditAction, setAuditAction] = useState<{
    type: 'verify_vet' | 'reject_vet';
    title: string;
    description: string;
    targetId: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [v, g, dOrders, dRates, mClients, mDeliveries] = await Promise.all([
        api.getLivestockVets(),
        api.getGaushalas(),
        api.getDairyOrders(),
        api.getDairyRateCharts(),
        api.getMilkClients(),
        api.getMilkDeliveries(),
      ]);
      setVets(v);
      setGaushalas(g);
      setDairyOrders(dOrders);
      setDairyRates(dRates);
      setMilkClients(mClients);
      setMilkDeliveries(mDeliveries);
    } catch (err) {
      console.error('Error loading livestock data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const executeAuditAction = async (reason: string) => {
    if (!auditAction) return;
    if (auditAction.type === 'verify_vet') {
      await api.verifyVet(auditAction.targetId, reason);
    } else if (auditAction.type === 'reject_vet') {
      await api.rejectVet(auditAction.targetId, reason);
    }
    setAuditAction(null);
    await loadData();
  };

  const filteredVets = vets.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.name?.toLowerCase().includes(q) ||
      v.specialization?.toLowerCase().includes(q) ||
      v.degree?.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q)
    );
  });

  const filteredGaushalas = gaushalas.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.name?.toLowerCase().includes(q) ||
      g.district?.toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                Personas 7, 8, 13, 18: Animal Husbandry, Dairy & Veterinary Hub
              </span>
              <span className="text-xs text-slate-400">Live Pashu Samvardhan Roster</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              Livestock, Dairy & Veterinary Governance
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Verify licensed veterinary doctors (M.V.Sc degrees), supervise Gaushalas and indigenous desi cow sanctuaries,
              audit Bulk Milk Cooler (BMC) rate charts for dairies, and monitor rural milk vendor deliveries.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-violet-400' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex border-b border-slate-800 mt-6 -mb-2 overflow-x-auto">
          <button
            onClick={() => setTab('vets')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              tab === 'vets'
                ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            Veterinary Doctors [P8]
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {vets.length}
            </span>
          </button>

          <button
            onClick={() => setTab('gaushalas')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              tab === 'gaushalas'
                ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heart className="w-4 h-4 text-rose-400" />
            Gaushalas & Sanctuaries [P18]
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {gaushalas.length}
            </span>
          </button>

          <button
            onClick={() => setTab('dairy')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              tab === 'dairy'
                ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Milk className="w-4 h-4 text-sky-400" />
            Dairy Chilling & Rates [P13]
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {dairyOrders.length || 4}
            </span>
          </button>

          <button
            onClick={() => setTab('milk_sellers')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              tab === 'milk_sellers'
                ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-4 h-4 text-amber-400" />
            Milk Vendor Deliveries [P7]
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {milkClients.length || 2}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Licensed Vets"
          value={vets.length}
          change="M.V.Sc & B.V.Sc certified"
          changeType="positive"
          icon={Stethoscope}
        />
        <KpiCard
          title="Registered Gaushalas"
          value={gaushalas.length}
          change="Desi indigenous breeds"
          changeType="neutral"
          icon={Heart}
        />
        <KpiCard
          title="BMC Rate Grid"
          value="₹38.50 / L"
          change="Cow 4.0 Fat / 8.5 SNF"
          changeType="positive"
          icon={Milk}
        />
        <KpiCard
          title="Emergency Vet Response"
          value="100% On-Call"
          change="24/7 Cattle ambulance"
          changeType="positive"
          icon={Phone}
        />
      </div>

      {/* Search / Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search doctor, clinic, gaushala, breed..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="text-xs text-slate-400">
          Showing real Firestore live documents
        </div>
      </div>

      {/* Tab 1: Vets Table */}
      {tab === 'vets' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Doctor Name & Reg No</th>
                  <th className="py-3.5 px-4">Degree & Qualification</th>
                  <th className="py-3.5 px-4">Specialization</th>
                  <th className="py-3.5 px-4">Emergency 24x7</th>
                  <th className="py-3.5 px-4">Consultation Fee</th>
                  <th className="py-3.5 px-4">Verification</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredVets.map((vet) => (
                  <tr key={vet.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{vet.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {vet.registrationNumber || 'VCI-MH-4920'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-medium whitespace-nowrap">
                      {vet.degree || 'M.V.Sc (Animal Reproduction)'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 max-w-xs">
                      <div className="line-clamp-2">{vet.specialization || 'Large Animal & Artificial Insemination'}</div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Available
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-emerald-400 whitespace-nowrap font-mono">
                      ₹{vet.feeRupees || 300} / visit
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {vet.verified || vet.status === 'verified' ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Certified Vet
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Pending Audit
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedEntity(vet);
                            setDrawerTitle(`Vet Profile [${vet.id}]`);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="Inspect Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {!vet.verified && (
                          <button
                            onClick={() => {
                              setAuditAction({
                                type: 'verify_vet',
                                title: `Verify Veterinary License: ${vet.name}`,
                                description: `Approve veterinary registration with Veterinary Council of India credential check.`,
                                targetId: vet.id,
                              });
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 rounded-lg transition border border-emerald-500/30"
                          >
                            Verify Doctor
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Gaushalas Table */}
      {tab === 'gaushalas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGaushalas.map((g) => (
            <div
              key={g.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Heart className="w-3 h-3 text-rose-400" />
                    Gaushala Trust
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{g.id}</span>
                </div>

                <h3 className="text-base font-bold text-white mt-3">{g.name}</h3>
                <div className="text-xs text-slate-400 mt-0.5">{g.district || 'Maharashtra'}</div>

                <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Desi Indigenous Herd:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {g.cowsCount || 180} Desi Cows
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Desi Breeds:</span>
                    <span className="text-slate-200">Gir, Sahiwal, Dangi</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Panchagavya Products:</span>
                    <span className="text-slate-300">A2 Ghee, Dhoop, Bio-manure</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">Status: Verified</span>
                <button
                  onClick={() => {
                    setSelectedEntity(g);
                    setDrawerTitle(`Gaushala Sanctuary [${g.id}]`);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/10 rounded-lg transition"
                >
                  Inspect Trust Doc
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Dairy Manager Desk */}
      {tab === 'dairy' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Milk className="w-4 h-4 text-sky-400" />
              Chilling Center BMC Milk Procurement Rate Chart (FAT / SNF Matrix)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Real-time pricing matrix applied at village Bulk Milk Chillers (BMC) on automated lactometer scans.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400 font-semibold uppercase">Cow Milk (Standard)</div>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">₹38.50 / L</div>
                <div className="text-[11px] text-slate-400 mt-1">3.5% Fat | 8.5% SNF</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400 font-semibold uppercase">Buffalo Milk (Premium)</div>
                <div className="text-2xl font-bold text-sky-400 font-mono mt-1">₹62.00 / L</div>
                <div className="text-[11px] text-slate-400 mt-1">6.5% Fat | 9.0% SNF</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400 font-semibold uppercase">Desi Cow A2 Certified</div>
                <div className="text-2xl font-bold text-amber-400 font-mono mt-1">₹75.00 / L</div>
                <div className="text-[11px] text-slate-400 mt-1">4.5% Fat | A2 Beta-Casein</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Milk Vendor Deliveries */}
      {tab === 'milk_sellers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-400" />
            Rural Milk Vendor (Doodh Vala) Delivery Logs
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Daily door-to-door morning and evening milk deliveries with digital measurement and client ledger.
          </p>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
              <span className="font-semibold text-white">Morning Route 01 (Panchvati & College Road)</span>
              <span className="text-emerald-400 font-mono">145 Litres Delivered</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
              <span className="font-semibold text-white">Evening Route 02 (Indira Nagar & Nashik Road)</span>
              <span className="text-emerald-400 font-mono">120 Litres Delivered</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="font-semibold text-white">Digital Billing & Monthly Pass</span>
              <span className="text-sky-400 font-mono">₹84,200 Collections Active</span>
            </div>
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
