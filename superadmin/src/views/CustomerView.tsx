import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Package,
  RotateCcw,
  Tag,
  Megaphone,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import { MarketplaceOrder, MarketplaceProduct } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { useAuth } from '../context/AuthContext';

export const CustomerView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [subTab, setSubTab] = useState<'orders' | 'refunds' | 'products' | 'ads'>('orders');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Entities
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);

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
      if (subTab === 'orders' || subTab === 'refunds') {
        const data = await api.getMarketplaceOrders();
        setOrders(data);
      } else if (subTab === 'products') {
        const [prods, cats] = await Promise.all([
          api.getMarketplaceProducts().catch(() => []),
          api.getMarketplaceCategories().catch(() => []),
        ]);
        setProducts(prods);
        setCategories(cats);
      } else if (subTab === 'ads') {
        const data = await api.getAds();
        setAds(data);
      }
    } catch (err: any) {
      console.error('Failed to load customer eMarket data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subTab]);

  const triggerRefund = (order: MarketplaceOrder) => {
    setAuditConfig({
      title: 'Adjudicate & Issue Customer Order Refund',
      actionName: 'Process Refund',
      targetId: order.id,
      destructive: true,
      requiredPermission: 'customer:refund_orders',
      onConfirm: async (reason: string) => {
        await api.refundMarketplaceOrder(order.id, reason);
        await loadData();
      },
    });
    setAuditModalOpen(true);
  };

  const triggerAdModeration = (ad: any, action: 'approved' | 'rejected') => {
    setAuditConfig({
      title: `${action === 'approved' ? 'Approve' : 'Reject'} Advertisement Campaign`,
      actionName: action === 'approved' ? 'Approve Ad' : 'Reject Ad',
      targetId: ad.id,
      destructive: action === 'rejected',
      requiredPermission: 'customer:moderate_ads',
      onConfirm: async (reason: string) => {
        if (action === 'approved') {
          await api.approveAd(ad.id, reason);
        } else {
          await api.rejectAd(ad.id, reason);
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
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            Module SOP-06: eMarket Customer, Krishi Mall Orders & Catalog Governance
          </span>
          <h1 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
            <ShoppingBag className="w-6 h-6 text-amber-500" />
            eMarket Customer Order Adjudication & Mall Catalog Desk
          </h1>
          <p className="text-xs text-slate-400">
            Manage customer retail orders, adjudicate refund disputes with dual sign-off safeguards, and moderate input marketplace products.
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
          onClick={() => setSubTab('orders')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'orders' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Customer Orders ({orders.length})
        </button>
        <button
          onClick={() => setSubTab('refunds')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'refunds' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Refund Adjudication Desk
        </button>
        <button
          onClick={() => setSubTab('products')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'products' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Mall Catalog & Products ({products.length})
        </button>
        <button
          onClick={() => setSubTab('ads')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'ads' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Advertisement Campaigns ({ads.length})
        </button>
      </div>

      {/* Search Input */}
      <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search order ID, buyer, product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* 1. CUSTOMER ORDERS */}
      {(subTab === 'orders' || subTab === 'refunds') && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">
              {subTab === 'refunds' ? 'Orders Eligible for Refund & Dispute Adjudication' : 'Customer Marketplace Orders'}
            </span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/marketplace/orders</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Buyer Customer</th>
                  <th className="py-3 px-4">Items Summary</th>
                  <th className="py-3 px-4">Order Value</th>
                  <th className="py-3 px-4">Payment State</th>
                  <th className="py-3 px-4">Fulfillment Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No customer marketplace orders found in live database.
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{ord.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{ord.buyerName || ord.userId}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{ord.phone || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {ord.itemCount || (ord.items ? ord.items.length : 1)} Items
                        {ord.items && ord.items[0]?.productId ? ` (${ord.items[0].productId})` : ''}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        ₹{(ord.finalTotal || ord.total || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                          {ord.paymentStatus || 'paid'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            ord.status === 'delivered'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : ord.status === 'refunded'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openDrawer(ord)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Inspect Order JSON"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => triggerRefund(ord)}
                          className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold border border-rose-500/30 transition-colors"
                        >
                          Issue Refund
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

      {/* 2. PRODUCTS CATALOG */}
      {subTab === 'products' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Input Marketplace Catalog Items ({products.length})</span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/marketplace/products</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Product ID</th>
                  <th className="py-3 px-4">Title / Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Stock Availability</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No marketplace products found in live database.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{p.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                      <td className="py-3 px-4 text-slate-300">{p.category}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">₹{p.price}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{p.stock} units in stock</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                          {p.inStock ? 'Active Listed' : 'Out of Stock'}
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

      {/* 3. ADS CAMPAIGNS */}
      {subTab === 'ads' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Merchant Advertisement Banners & Featured Promos</span>
            <span className="text-[11px] font-mono text-emerald-400">Direct from /v1/admin/ads</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Campaign ID</th>
                  <th className="py-3 px-4">Campaign Title</th>
                  <th className="py-3 px-4">Advertiser / Merchant</th>
                  <th className="py-3 px-4">Placement</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {ads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No advertisements currently pending moderation.
                    </td>
                  </tr>
                ) : (
                  ads.map((ad) => (
                    <tr key={ad.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{ad.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{ad.title || 'Fertilizer Promo'}</td>
                      <td className="py-3 px-4 text-slate-300">{ad.sellerId || 'Dev Seller'}</td>
                      <td className="py-3 px-4 text-slate-400">Home Feed Banner</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
                          {ad.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openDrawer(ad)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => triggerAdModeration(ad, 'approved')}
                          className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-600 hover:text-white"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => triggerAdModeration(ad, 'rejected')}
                          className="px-2 py-1 rounded bg-rose-600/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold hover:bg-rose-600 hover:text-white"
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

      {/* Slide Drawer & Modal */}
      <EntityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Marketplace Document Inspector"
        entity={selectedEntity}
        entityType="eMarket Order/Product"
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
