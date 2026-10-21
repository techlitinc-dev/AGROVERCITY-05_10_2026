import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
  Building,
  FileText,
  ShieldCheck,
  Scale,
} from 'lucide-react';
import { api } from '../lib/api';
import { BuyerOrg, B2BDeal, BuyerContract, MandiRate } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { useAuth } from '../context/AuthContext';

export const VyapariView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [subTab, setSubTab] = useState<'deals' | 'rates' | 'buyers' | 'contracts'>('deals');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Entities
  const [deals, setDeals] = useState<B2BDeal[]>([]);
  const [rates, setRates] = useState<MandiRate[]>([]);
  const [buyers, setBuyers] = useState<BuyerOrg[]>([]);
  const [contracts, setContracts] = useState<BuyerContract[]>([]);

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
      if (subTab === 'deals') {
        const data = await api.getB2BDeals();
        setDeals(data);
      } else if (subTab === 'rates') {
        const data = await api.getPendingMandiRates();
        setRates(data);
      } else if (subTab === 'buyers') {
        const data = await api.getBuyers();
        setBuyers(data);
      } else if (subTab === 'contracts') {
        const data = await api.getContracts();
        setContracts(data);
      }
    } catch (err: any) {
      console.error('Failed to load vyapari data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subTab]);

  const triggerRateApproval = (rate: MandiRate, action: 'approved' | 'rejected') => {
    setAuditConfig({
      title: `${action === 'approved' ? 'Approve' : 'Reject'} Vyapari Buying Rate`,
      actionName: action === 'approved' ? 'Approve' : 'Reject',
      targetId: rate.id,
      destructive: action === 'rejected',
      requiredPermission: 'vyapari:approve_rates',
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

  const triggerDealEscalate = (deal: B2BDeal) => {
    setAuditConfig({
      title: 'Escalate B2B Deal to Dispute Arbitration',
      actionName: 'Escalate Dispute',
      targetId: deal.id,
      destructive: true,
      requiredPermission: 'vyapari:manage_deals',
      onConfirm: async (reason: string) => {
        await api.escalateDeal(deal.id, reason);
        await loadData();
      },
    });
    setAuditModalOpen(true);
  };

  const triggerBuyerVerify = (buyer: BuyerOrg) => {
    setAuditConfig({
      title: 'Verify Institutional Buyer Trade License',
      actionName: 'Verify Buyer Org',
      targetId: buyer.id,
      destructive: false,
      requiredPermission: 'vyapari:verify_buyer',
      onConfirm: async (reason: string) => {
        await api.verifyBuyer(buyer.id, reason);
        await loadData();
      },
    });
    setAuditModalOpen(true);
  };

  const triggerBuyerSuspend = (buyer: BuyerOrg) => {
    setAuditConfig({
      title: 'Suspend Buyer Escrow & Trading Privileges',
      actionName: 'Suspend Buyer',
      targetId: buyer.id,
      destructive: true,
      requiredPermission: 'vyapari:verify_buyer',
      onConfirm: async (reason: string) => {
        await api.suspendBuyer(buyer.id, reason);
        await loadData();
      },
    });
    setAuditModalOpen(true);
  };

  const triggerContractStatus = (contract: BuyerContract, nextStatus: string) => {
    setAuditConfig({
      title: `Update Contract Status → ${nextStatus.toUpperCase()}`,
      actionName: `Set to ${nextStatus}`,
      targetId: contract.id,
      destructive: nextStatus === 'terminated',
      requiredPermission: 'vyapari:manage_deals',
      onConfirm: async (reason: string) => {
        await api.updateContractStatus(contract.id, nextStatus, reason);
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
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            Module SOP-04 / SOP-05 / SOP-07: Vyapari, B2B Trade & Buyer Escrow
          </span>
          <h1 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
            <Briefcase className="w-6 h-6 text-emerald-500" />
            Vyapari Trader Desk & Institutional Buyer Escrow
          </h1>
          <p className="text-xs text-slate-400">
            Moderate trader buying rates against MSP benchmarks, adjudicate B2B produce deals, and clear institutional buyer escrow accounts.
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
          onClick={() => setSubTab('deals')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'deals' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          B2B Produce Deals & Escrow
        </button>
        <button
          onClick={() => setSubTab('rates')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'rates' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Trader Buying Rates ({rates.length} Pending)
        </button>
        <button
          onClick={() => setSubTab('buyers')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'buyers' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Buyer Organizations ({buyers.length})
        </button>
        <button
          onClick={() => setSubTab('contracts')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'contracts' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Procurement Contracts ({contracts.length})
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search deal ID, buyer name, commodity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* 1. B2B DEALS & ESCROW */}
      {subTab === 'deals' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">B2B Farm Deals & Escrow Payment Status</span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/deals</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Deal ID</th>
                  <th className="py-3 px-4">Commodity</th>
                  <th className="py-3 px-4">Buyer (Vyapari)</th>
                  <th className="py-3 px-4">Farmer</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Escrow State</th>
                  <th className="py-3 px-4">Deal Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No active B2B deals found in live database.
                    </td>
                  </tr>
                ) : (
                  deals.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{d.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{d.commodity || 'Soybean JS 335'}</td>
                      <td className="py-3 px-4 text-slate-300">{d.buyerName || 'Dev Vyapari'}</td>
                      <td className="py-3 px-4 text-slate-300">{d.farmerName || 'Sunil Pawar'}</td>
                      <td className="py-3 px-4 font-semibold text-white">{d.quantityQuintals || 50} Qtl</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        ₹{(d.totalAmount || 245000).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            d.escrowStatus === 'held'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : d.escrowStatus === 'released'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {d.escrowStatus || 'held'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-300">{d.status || 'confirmed'}</td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openDrawer(d)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Inspect Deal JSON"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => triggerDealEscalate(d)}
                          className="px-2 py-1 rounded bg-amber-600/20 text-amber-300 hover:bg-amber-600 hover:text-white text-[11px] font-bold border border-amber-500/30 transition-colors"
                        >
                          Escalate Dispute
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

      {/* 2. TRADER BUYING RATES */}
      {subTab === 'rates' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Pending Vyapari Mandi Buying Proposals</span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/rates/pending</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Rate ID</th>
                  <th className="py-3 px-4">Commodity</th>
                  <th className="py-3 px-4">Target Mandi</th>
                  <th className="py-3 px-4">Proposed Modal Price</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Compliance Status</th>
                  <th className="py-3 px-4 text-right">Clearance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {rates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No pending trader buying rates awaiting moderation.
                    </td>
                  </tr>
                ) : (
                  rates.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{r.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{r.commodity}</td>
                      <td className="py-3 px-4 text-slate-300">{r.mandi || 'APMC Akola'}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">₹{r.modalPrice} / Qtl</td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{r.date}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
                          Pending Review
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => triggerRateApproval(r, 'approved')}
                          className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold border border-emerald-500/30 transition-colors"
                        >
                          Approve Rate
                        </button>
                        <button
                          onClick={() => triggerRateApproval(r, 'rejected')}
                          className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold border border-rose-500/30 transition-colors"
                        >
                          Reject Rate
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

      {/* 3. BUYER ORGANIZATIONS */}
      {subTab === 'buyers' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Registered Corporate Buyers & Institutional Organizations</span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/buyers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Buyer ID</th>
                  <th className="py-3 px-4">Organization Name</th>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Phone / GST</th>
                  <th className="py-3 px-4">Escrow Limit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {buyers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No buyer organizations currently registered in live database.
                    </td>
                  </tr>
                ) : (
                  buyers.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{b.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{b.orgName || b.name}</td>
                      <td className="py-3 px-4 text-slate-300">{b.contactPerson || 'Authorized Officer'}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{b.phone || b.gstNumber || '—'}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">₹{(b.escrowLimit || 1000000).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            b.status === 'verified'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {b.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openDrawer(b)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => triggerBuyerVerify(b)}
                          className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-[11px] font-bold"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => triggerBuyerSuspend(b)}
                          className="px-2 py-1 rounded bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white text-[11px] font-bold"
                        >
                          Suspend
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

      {/* 4. PROCUREMENT CONTRACTS */}
      {subTab === 'contracts' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Institutional Long-Term Procurement Contracts</span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/contracts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Contract ID</th>
                  <th className="py-3 px-4">Title / Commodity</th>
                  <th className="py-3 px-4">Buyer Organization</th>
                  <th className="py-3 px-4">Target Quantity</th>
                  <th className="py-3 px-4">Locked Price</th>
                  <th className="py-3 px-4">Acceptances</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No long-term contracts active in live database.
                    </td>
                  </tr>
                ) : (
                  contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{c.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{c.title}</div>
                        <div className="text-[11px] text-slate-400">{c.commodity}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{c.buyerName || 'ITC Agri'}</td>
                      <td className="py-3 px-4 font-semibold text-white">{c.targetQuantityQuintals || 500} Qtl</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">₹{c.pricePerQuintal} / Qtl</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{c.acceptancesCount || 0} Farmers</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openDrawer(c)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => triggerContractStatus(c, 'fulfilled')}
                          className="px-2 py-1 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[11px] font-bold"
                        >
                          Fulfill
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

      {/* Drawer & Modal */}
      <EntityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Vyapari & B2B Document Inspector"
        entity={selectedEntity}
        entityType="Vyapari Trade Entity"
      />

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
