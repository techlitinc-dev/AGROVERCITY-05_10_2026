import React, { useEffect, useState } from 'react';
import {
  Sprout,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  BookOpen,
  FlaskConical,
  AlertTriangle,
  User,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { ProduceLot, MandiRate, FarmDiaryEntry, AdvisoryScan, SoilTest } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { useAuth } from '../context/AuthContext';

export const FarmerView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [subTab, setSubTab] = useState<'lots' | 'mandi' | 'diary' | 'advisory' | 'farmers'>('lots');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Entities state
  const [lots, setLots] = useState<ProduceLot[]>([]);
  const [mandiRates, setMandiRates] = useState<MandiRate[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<FarmDiaryEntry[]>([]);
  const [advisoryScans, setAdvisoryScans] = useState<AdvisoryScan[]>([]);
  const [soilTests, setSoilTests] = useState<SoilTest[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);

  // Modals state
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
      if (subTab === 'lots') {
        const data = await api.getFarmerLots();
        setLots(data);
      } else if (subTab === 'mandi') {
        const [all, pending] = await Promise.all([
          api.getMandiRates().catch(() => []),
          api.getPendingMandiRates().catch(() => []),
        ]);
        // Combine unique
        const combined = [...pending, ...all.filter((a) => !pending.some((p) => p.id === a.id))];
        setMandiRates(combined);
      } else if (subTab === 'diary') {
        const data = await api.getFarmDiaryEntries();
        setDiaryEntries(data);
      } else if (subTab === 'advisory') {
        const [scans, tests] = await Promise.all([
          api.getAdvisoryScans().catch(() => []),
          api.getSoilTests().catch(() => []),
        ]);
        setAdvisoryScans(scans);
        setSoilTests(tests);
      } else if (subTab === 'farmers') {
        const data = await api.getAllUsers('farmer');
        setFarmers(data);
      }
    } catch (err: any) {
      console.error('Failed to load farmer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subTab]);

  // Action Triggers with Audit Reasons
  const triggerLotModeration = (lot: ProduceLot, action: 'approved' | 'rejected') => {
    setAuditConfig({
      title: `${action === 'approved' ? 'Approve' : 'Reject'} Produce Lot`,
      actionName: action === 'approved' ? 'Approve' : 'Reject',
      targetId: lot.id,
      destructive: action === 'rejected',
      requiredPermission: 'farmer:moderate_lots',
      onConfirm: async (reason: string) => {
        await api.moderateLot(lot.id, action, reason);
        await loadData();
      },
    });
    setAuditModalOpen(true);
  };

  const triggerRateApproval = (rate: MandiRate, action: 'approved' | 'rejected') => {
    setAuditConfig({
      title: `${action === 'approved' ? 'Approve' : 'Reject'} Mandi Rate`,
      actionName: action === 'approved' ? 'Approve' : 'Reject',
      targetId: rate.id,
      destructive: action === 'rejected',
      requiredPermission: 'farmer:approve_rates',
      onConfirm: async (reason: string) => {
        if (action === 'approved') {
          await api.approveMandiRate(rate.id, reason);
        } else {
          await api.rejectMandiRate(rate.id, reason);
        }
        await loadData();
      },
    });
    setAuditModalOpen(true);
  };

  const triggerUserSuspension = (farmer: any) => {
    const isBanned = farmer.status === 'banned';
    const newStatus = isBanned ? 'active' : 'banned';
    setAuditConfig({
      title: `${isBanned ? 'Reactivate' : 'Suspend'} Farmer Account`,
      actionName: isBanned ? 'Reactivate' : 'Suspend',
      targetId: farmer.id,
      destructive: !isBanned,
      requiredPermission: 'farmer:modify',
      onConfirm: async (reason: string) => {
        await api.updateUserStatus(farmer.id, newStatus, reason);
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
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              Module SOP-02 / SOP-04 / SOP-05 / SOP-11 / SOP-13
            </span>
          </div>
          <h1 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
            <Sprout className="w-6 h-6 text-emerald-500" />
            Farmer Governance & Field Operations Desk
          </h1>
          <p className="text-xs text-slate-400">
            Real-time oversight for produce lots, mandi pricing approvals, farm diary expenditures, and soil laboratory tests.
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

      {/* Sub-Tabs Nav */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setSubTab('lots')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'lots' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Produce Lots Moderation
        </button>
        <button
          onClick={() => setSubTab('mandi')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'mandi' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Mandi Rates & Approvals
        </button>
        <button
          onClick={() => setSubTab('diary')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'diary' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Farm Diary & P&L Oversight
        </button>
        <button
          onClick={() => setSubTab('advisory')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'advisory' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Advisory & Soil Health Labs
        </button>
        <button
          onClick={() => setSubTab('farmers')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'farmers' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Farmers Directory
        </button>
      </div>

      {/* Controls: Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search crop, variety, village, ID..."
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
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="sold">Sold</option>
          </select>
        </div>
      </div>

      {/* 1. PRODUCE LOTS SUBTAB */}
      {subTab === 'lots' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              Live Harvested Produce Lots ({lots.length} in database)
            </span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/lots</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Lot ID</th>
                  <th className="py-3 px-4">Crop & Variety</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Expected Rate</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Grade</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {lots.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No produce lots found in live Firestore.
                    </td>
                  </tr>
                ) : (
                  lots
                    .filter((lot) => {
                      if (statusFilter !== 'all' && lot.status !== statusFilter) return false;
                      if (!searchQuery) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        (lot.crop && lot.crop.toLowerCase().includes(q)) ||
                        (lot.variety && lot.variety.toLowerCase().includes(q)) ||
                        (lot.village && lot.village.toLowerCase().includes(q)) ||
                        lot.id.toLowerCase().includes(q)
                      );
                    })
                    .map((lot) => (
                      <tr key={lot.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{lot.id}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{lot.crop}</div>
                          <div className="text-[11px] text-slate-400">{lot.variety || 'Standard'}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {lot.quantityQuintals || lot.quantity || '—'} Qtl
                        </td>
                        <td className="py-3 px-4 font-bold text-amber-300">
                          ₹{lot.expectedRate || lot.expectedPricePerQuintal || '—'} / Qtl
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {lot.village ? `${lot.village}, ` : ''}{lot.district || 'Maharashtra'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            Grade {lot.grade || 'A'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              lot.status === 'active' || lot.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : lot.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {lot.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => openDrawer(lot)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                            title="Inspect JSON & Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => triggerLotModeration(lot, 'approved')}
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400"
                            title="Approve Lot"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => triggerLotModeration(lot, 'rejected')}
                            className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                            title="Reject/Flag Lot"
                          >
                            <XCircle className="w-4 h-4" />
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

      {/* 2. MANDI RATES SUBTAB */}
      {subTab === 'mandi' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Mandi Pricing Proposals & Official Benchmarks</span>
            <span className="text-[11px] font-mono text-emerald-400">Real-time /v1/admin/mandi/rates</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Commodity</th>
                  <th className="py-3 px-4">Mandi Market</th>
                  <th className="py-3 px-4">Min Price</th>
                  <th className="py-3 px-4">Max Price</th>
                  <th className="py-3 px-4">Modal Price</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {mandiRates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No mandi rates available in live database.
                    </td>
                  </tr>
                ) : (
                  mandiRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{rate.commodity}</td>
                      <td className="py-3 px-4 text-slate-300">{rate.mandi || rate.market || 'APMC Akola'}</td>
                      <td className="py-3 px-4 text-slate-400">₹{rate.minPrice}</td>
                      <td className="py-3 px-4 text-slate-400">₹{rate.maxPrice}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">₹{rate.modalPrice} / Qtl</td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{rate.date}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            rate.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {rate.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => triggerRateApproval(rate, 'approved')}
                          className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold border border-emerald-500/30 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => triggerRateApproval(rate, 'rejected')}
                          className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold border border-rose-500/30 transition-colors"
                        >
                          Reject
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

      {/* 3. FARM DIARY SUBTAB */}
      {subTab === 'diary' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Farm Expenditure Ledger & P&L Log Entries</span>
            <span className="text-[11px] font-mono text-emerald-400">Real records from /v1/admin/diary/entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Entry ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Farmer ID</th>
                  <th className="py-3 px-4">Crop</th>
                  <th className="py-3 px-4">Field Activity</th>
                  <th className="py-3 px-4">Expense (₹)</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {diaryEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No diary entries registered in live database.
                    </td>
                  </tr>
                ) : (
                  diaryEntries.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{d.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{d.date}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{d.farmerId}</td>
                      <td className="py-3 px-4 font-bold text-white">{d.crop}</td>
                      <td className="py-3 px-4 text-slate-300">{d.activity}</td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        ₹{(d.costRupees || (d.costPaisa ? d.costPaisa / 100 : 0)).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-slate-400 italic">{d.notes || '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openDrawer(d)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        >
                          <Eye className="w-4 h-4" />
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

      {/* 4. ADVISORY & SOIL LABS SUBTAB */}
      {subTab === 'advisory' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Advisory Scans */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-400" />
                AI Crop Disease Scans & Accuracy Review
              </h3>
              <span className="text-[10px] font-mono text-slate-400">{advisoryScans.length} scans</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {advisoryScans.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No disease scans recorded.</p>
              ) : (
                advisoryScans.map((s) => (
                  <div key={s.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{s.crop}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {s.disease || 'Pest Detected'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Scan #{s.id}</p>
                    </div>
                    <button
                      onClick={() => openDrawer(s)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Soil Tests */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-teal-400" />
                Soil Health Tests & Certification Desk
              </h3>
              <span className="text-[10px] font-mono text-slate-400">{soilTests.length} tests</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {soilTests.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No soil lab tests submitted.</p>
              ) : (
                soilTests.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-white">Sample #{t.sampleId || t.id}</span>
                      <p className="text-[10px] text-slate-400">User: {t.userId}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. FARMERS DIRECTORY */}
      {subTab === 'farmers' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Registered Farmers Directory ({farmers.length} accounts)</span>
            <span className="text-[11px] font-mono text-emerald-400">Query users collection (persona=farmer)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">UID</th>
                  <th className="py-3 px-4">Farmer Name</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">District</th>
                  <th className="py-3 px-4">Land Area</th>
                  <th className="py-3 px-4">Crops</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {farmers.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{f.id}</td>
                    <td className="py-3 px-4 font-bold text-white">{f.name || 'Unnamed Farmer'}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{f.phone}</td>
                    <td className="py-3 px-4 text-slate-300">{f.district || 'Nashik'}</td>
                    <td className="py-3 px-4 text-slate-300">{f.landAreaAcres ? `${f.landAreaAcres} Acres` : '—'}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {Array.isArray(f.activeCrops) ? f.activeCrops.join(', ') : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          f.status === 'banned'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {f.status || 'active'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => openDrawer(f)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        title="View Full Profile JSON"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => triggerUserSuspension(f)}
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                          f.status === 'banned'
                            ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600 hover:text-white'
                            : 'bg-rose-600/20 text-rose-400 border-rose-500/30 hover:bg-rose-600 hover:text-white'
                        }`}
                      >
                        {f.status === 'banned' ? 'Reactivate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-Over JSON & Detail Inspector */}
      <EntityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Entity Document Inspector"
        entity={selectedEntity}
        entityType="Farmer Module Entity"
      />

      {/* Mandatory Audit Reason Mutation Modal */}
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
