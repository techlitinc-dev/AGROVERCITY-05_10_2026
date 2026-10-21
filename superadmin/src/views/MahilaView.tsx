import React, { useEffect, useState } from 'react';
import {
  HeartHandshake,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Award,
  ShoppingBag,
  TrendingUp,
  ShieldCheck,
  FileBadge,
} from 'lucide-react';
import { api } from '../lib/api';
import { WomenShg, GruhCert, WomenEnterpriseProduct } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { useAuth } from '../context/AuthContext';

export const MahilaView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [subTab, setSubTab] = useState<'shgs' | 'certs' | 'products' | 'loans'>('shgs');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Entities
  const [shgs, setShgs] = useState<WomenShg[]>([]);
  const [certs, setCerts] = useState<GruhCert[]>([]);
  const [products, setProducts] = useState<WomenEnterpriseProduct[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

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
      if (subTab === 'shgs') {
        const data = await api.getShgQueue();
        setShgs(data);
      } else if (subTab === 'certs') {
        const data = await api.getGruhCertificationsQueue();
        setCerts(data);
      } else if (subTab === 'products') {
        const data = await api.getWomenEnterpriseProducts();
        setProducts(data);
      } else if (subTab === 'loans') {
        const data = await api.getWomenLoans();
        setLoans(data);
      }
    } catch (err: any) {
      console.error('Failed to load mahila graha udyog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subTab]);

  const triggerShgVerify = (shg: WomenShg) => {
    setAuditConfig({
      title: 'Approve Self-Help Group (SHG) Registration',
      actionName: 'Verify SHG',
      targetId: shg.id,
      destructive: false,
      requiredPermission: 'mahila:verify_shg',
      onConfirm: async (reason: string) => {
        await api.verifyShg(shg.id, reason);
        await loadData();
      },
    });
    setAuditModalOpen(true);
  };

  const triggerCertReview = (cert: GruhCert, action: 'verify' | 'reject') => {
    setAuditConfig({
      title: `${action === 'verify' ? 'Approve' : 'Reject'} FSSAI / Udyam Certification`,
      actionName: action === 'verify' ? 'Approve Certificate' : 'Reject Certificate',
      targetId: cert.id,
      destructive: action === 'reject',
      requiredPermission: 'mahila:verify_cert',
      onConfirm: async (reason: string) => {
        if (action === 'verify') {
          await api.verifyGruhCertification(cert.id, reason);
        } else {
          await api.rejectGruhCertification(cert.id, reason);
        }
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
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            Module SOP-24: Women Empowerment, SHG & Mahila Graha Udyog
          </span>
          <h1 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
            <HeartHandshake className="w-6 h-6 text-pink-500" />
            Mahila Graha Udyog & Women SHG Operations Desk
          </h1>
          <p className="text-xs text-slate-400">
            Verify Self-Help Groups (Bachat Gat), authenticate FSSAI/Udyam certificates, and curate home-enterprise food & handicraft storefronts.
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
          onClick={() => setSubTab('shgs')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'shgs' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          SHG Verification Queue ({shgs.length})
        </button>
        <button
          onClick={() => setSubTab('certs')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'certs' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Gruh Udyog Certifications ({certs.length})
        </button>
        <button
          onClick={() => setSubTab('products')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'products' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Enterprise Storefront Products ({products.length})
        </button>
        <button
          onClick={() => setSubTab('loans')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'loans' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Subsidies & Microfinance
        </button>
      </div>

      {/* 1. SHG QUEUE */}
      {subTab === 'shgs' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Self-Help Group (SHG / Bachat Gat) Accreditation Queue</span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/women/shgs/queue</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">SHG ID</th>
                  <th className="py-3 px-4">Group Name</th>
                  <th className="py-3 px-4">Village / District</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">Loan Fund</th>
                  <th className="py-3 px-4">Monthly Deposit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Clearance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {shgs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No pending SHG verification requests.
                    </td>
                  </tr>
                ) : (
                  shgs.map((shg) => (
                    <tr key={shg.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{shg.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{shg.name}</td>
                      <td className="py-3 px-4 text-slate-300">
                        {shg.village ? `${shg.village}, ` : ''}{shg.district || 'Akola / Nashik'}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-white">{shg.memberCount} Members</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        ₹{shg.loanFundPaisa ? (shg.loanFundPaisa / 100).toLocaleString('en-IN') : '30,000'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        ₹{shg.monthlyDepositPaisa ? (shg.monthlyDepositPaisa / 100).toLocaleString('en-IN') : '500'} / mo
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
                          {shg.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openDrawer(shg)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Inspect Group Documentation"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => triggerShgVerify(shg)}
                          className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold border border-emerald-500/30 transition-colors"
                        >
                          Verify Group
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

      {/* 2. GRUH CERTS */}
      {subTab === 'certs' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">FSSAI, Udyam & Agmark Certification Review Queue</span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/gruh/certifications/queue</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Cert ID</th>
                  <th className="py-3 px-4">Enterprise Unit</th>
                  <th className="py-3 px-4">Owner Name</th>
                  <th className="py-3 px-4">License Type</th>
                  <th className="py-3 px-4">Registration No</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Adjudication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {certs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No pending certification applications in queue.
                    </td>
                  </tr>
                ) : (
                  certs.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{c.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{c.unitName || 'Annapurna Gruh Udyog'}</td>
                      <td className="py-3 px-4 text-slate-300">{c.ownerName || 'Sunita Deshmukh'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                          {c.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{c.number || 'FSSAI-215240990001'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
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
                          onClick={() => triggerCertReview(c, 'verify')}
                          className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold border border-emerald-500/30 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => triggerCertReview(c, 'reject')}
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

      {/* 3. PRODUCTS */}
      {subTab === 'products' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Home-Enterprise Mall Storefront Products</span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/women/enterprise-products</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Product ID</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Enterprise Unit</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">FSSAI Status</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No home-enterprise products currently listed.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{p.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                      <td className="py-3 px-4 text-slate-300">{p.category}</td>
                      <td className="py-3 px-4 text-slate-400">{p.unitName || 'SHG Unit'}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">₹{p.priceRupees}</td>
                      <td className="py-3 px-4 font-mono text-white">{p.stock} units</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {p.fssaiVerified ? 'FSSAI Gate Passed' : 'Exempt / Handicraft'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openDrawer(p)}
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

      {/* 4. LOANS & SUBSIDIES */}
      {subTab === 'loans' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Women Microfinance & Government Subsidy Oversight
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Disbursement ledger and deposit compliance tracking for SHG enterprise loans.</p>
            </div>
            <span className="text-[11px] font-mono text-emerald-400">DBT Clearance Enabled</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Total SHG Micro-Loans</span>
              <div className="text-2xl font-black text-white mt-1">₹14,50,000</div>
              <p className="text-[11px] text-emerald-400 mt-1">98.4% On-time Repayment</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">DBT Subsidy Released</span>
              <div className="text-2xl font-black text-pink-400 mt-1">₹3,20,000</div>
              <p className="text-[11px] text-slate-500 mt-1">Direct Bank Transfer</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Savings Deposit Pool</span>
              <div className="text-2xl font-black text-blue-400 mt-1">₹6,80,000</div>
              <p className="text-[11px] text-slate-500 mt-1">Held in cooperative banks</p>
            </div>
          </div>
        </div>
      )}

      {/* Slide Drawer & Modal */}
      <EntityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Mahila Graha Udyog Document Inspector"
        entity={selectedEntity}
        entityType="Women Enterprise Record"
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
