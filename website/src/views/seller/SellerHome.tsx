import React, { useCallback, useEffect, useState } from 'react';
import {
  Store,
  Package,
  FileSpreadsheet,
  DollarSign,
  Plus,
  AlertTriangle,
  ArrowRight,
  Landmark,
  RefreshCcw,
  Link2,
  Building2,
  Search,
  Truck,
  Sparkles,
  Star,
  Megaphone,
  BookOpen,
  Bot,
  Coins,
  Share2,
  FileText,
  Trees,
  Newspaper,
  ShoppingBag,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  FileCheck,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { seller, purchases, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import type { PurchaseOrder } from '../../types';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  num,
  paisaToRupees,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

type Tab = 'catalog' | 'orders' | 'procure' | 'pos';

const NEXT_ORDER_STATUS: Record<string, string> = {
  placed: 'confirmed',
  paid: 'confirmed',
  confirmed: 'shipped',
  shipped: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

const ORDER_ACTION_LABEL: Record<string, string> = {
  placed: 'Confirm Order',
  paid: 'Confirm Order',
  confirmed: 'Mark Shipped',
  shipped: 'Out for Delivery',
  out_for_delivery: 'Mark Delivered',
};

/** GET /seller/orders — orders the seller fulfils (own sellerId or item lines). */
async function loadSellerOrders(): Promise<Rec[]> {
  try {
    const rows = await seller.orders();
    return (rows as unknown[]).map(rec);
  } catch {
    return [];
  }
}

export const SellerHome: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('catalog');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<Rec>({});
  const [cashflow, setCashflow] = useState<Rec>({});
  const [products, setProducts] = useState<Rec[]>([]);
  const [orders, setOrders] = useState<Rec[]>([]);
  const [procurement, setProcurement] = useState<Rec[]>([]);
  const [procStats, setProcStats] = useState<Rec>({});
  const [ledgers, setLedgers] = useState<Rec[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<Rec>({});
  const [stockSummary, setStockSummary] = useState<Rec[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<PurchaseOrder[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, cf, prods, ords, proc, led, stock, poList] = await Promise.all([
        seller.dashboard().catch(() => ({})),
        seller.cashflow().catch(() => ({})),
        seller.products().catch(() => []),
        loadSellerOrders(),
        seller.procurement().catch(() => []),
        seller.ledgers().catch(() => []),
        seller.stock().catch(() => []),
        purchases.list().catch(() => []),
      ]);
      setDashboard(rec(dash));
      setCashflow(rec(cf));
      setProducts((prods as unknown[]).map(rec));
      setOrders(ords);
      setRecentPurchases(poList);
      const procList = arr(proc).map(rec);
      const maybeWrapped = rec(proc);
      setProcurement(procList);
      setProcStats(rec(maybeWrapped.stats ?? {}));
      const ledgerPayload = rec(led);
      setLedgers(arr(ledgerPayload.entries ?? ledgerPayload.data ?? (Array.isArray(led) ? led : [])).map(rec));
      setLedgerSummary(ledgerPayload);
      const stockPayload = rec(stock);
      const summary = rec(stockPayload.summary);
      setStockSummary(arr(summary.byCrop).map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // --- KPI helpers -------------------------------------------------------
  const todayProc = rec(dashboard.todayProcurement);
  const pendingPay = rec(dashboard.pendingFarmerPayments);
  const udhaar = rec(dashboard.udhaarOutstanding);
  const rateStatus = rec(dashboard.rateStatus);
  const openOffers = rec(dashboard.openOffers);
  const lowStock = stockSummary.filter((s) => num(s.availableQuintals) < 5).length;

  const kpi = [
    {
      title: "Today's Procurement",
      value: formatCurrency(paisaToRupees(todayProc.amountPaisa)),
      subtitle: `${num(todayProc.quantityQuintals)} q across ${num(todayProc.lotsCount)} lots`,
      icon: DollarSign,
      colorScheme: 'green' as const,
    },
    {
      title: 'Pending Farmer Payments',
      value: formatCurrency(paisaToRupees(pendingPay.amountPaisa)),
      subtitle: `${num(pendingPay.count)} lots awaiting settlement`,
      icon: Landmark,
      colorScheme: 'amber' as const,
    },
    {
      title: 'Udhar Outstanding',
      value: formatCurrency(paisaToRupees(udhaar.netPaisa)),
      subtitle: `${num(ledgerSummary.totalDebtors)} buyers on khata book`,
      icon: AlertTriangle,
      colorScheme: 'purple' as const,
    },
    {
      title: 'Open Offers / Negotiations',
      value: `${num(openOffers.count)} live`,
      subtitle: `${num(rateStatus.pendingCount)} rates pending review`,
      icon: Package,
      colorScheme: 'blue' as const,
    },
  ];

  // --- product CRUD ------------------------------------------------------
  const [addProductModal, setAddProductModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pTitle, setPTitle] = useState('');
  const [pBrand, setPBrand] = useState('');
  const [pCategory, setPCategory] = useState('Seeds');
  const [pPrice, setPPrice] = useState(1200);
  const [pMrp, setPMrp] = useState(1500);
  const [pStock, setPStock] = useState(50);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await seller.addProduct({
        title: pTitle,
        brand: pBrand,
        category: pCategory,
        price: pPrice,
        mrp: pMrp || pPrice,
        stockQty: pStock,
      });
      setAddProductModal(false);
      await loadAll();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const restockProduct = async (product: Rec, delta: number) => {
    setFormError(null);
    try {
      await seller.updateProduct(str(product.id), {
        stockQty: Math.max(0, num(product.stockQty) + delta),
      });
      await loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  // --- orders -------------------------------------------------------------
  const [orderError, setOrderError] = useState<string | null>(null);
  const advanceOrder = async (order: Rec) => {
    const next = NEXT_ORDER_STATUS[str(order.status)];
    if (!next) return;
    setOrderError(null);
    try {
      await seller.updateOrderStatus(str(order.id), next);
      await loadAll();
    } catch (err) {
      setOrderError(apiErrorMessage(err));
    }
  };

  // --- procurement J-form ---------------------------------------------------
  const [jFormModal, setJFormModal] = useState(false);
  const [jSaving, setJSaving] = useState(false);
  const [jfFarmer, setJfFarmer] = useState('');
  const [jfPhone, setJfPhone] = useState('');
  const [jfCrop, setJfCrop] = useState('Soybean');
  const [jfQty, setJfQty] = useState(20);
  const [jfRate, setJfRate] = useState(4750);
  const [jfDeduction, setJfDeduction] = useState(0);

  const handleCreateJForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setJSaving(true);
    setFormError(null);
    try {
      await seller.createProcurement({
        farmerName: jfFarmer,
        farmerPhone: jfPhone,
        crop: jfCrop,
        grossWeightKg: jfQty * 100,
        tareWeightKg: 0,
        netWeightQuintals: jfQty,
        ratePerQuintal: jfRate,
        qualityDeductionPct: jfDeduction,
      });
      setJFormModal(false);
      await loadAll();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setJSaving(false);
    }
  };

  const payLot = async (lot: Rec) => {
    setFormError(null);
    try {
      await seller.payProcurement(str(lot.id), { paymentMode: 'bank_transfer', utrNo: '' });
      await loadAll();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    }
  };

  // --- POS quick sale -------------------------------------------------------
  const [posModal, setPosModal] = useState(false);
  const [posSaving, setPosSaving] = useState(false);
  const [posBuyer, setPosBuyer] = useState('');
  const [posItem, setPosItem] = useState('');
  const [posQty, setPosQty] = useState(1);
  const [posRate, setPosRate] = useState(1000);
  const [posPaid, setPosPaid] = useState(0);
  const [posMode, setPosMode] = useState('cash');

  const handlePosSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosSaving(true);
    setFormError(null);
    try {
      await seller.recordSale({
        buyerName: posBuyer,
        buyerPhone: '',
        item: posItem,
        quantity: posQty,
        unit: 'Quintal',
        ratePerUnit: posRate,
        paymentMode: posMode,
        amountPaid: posPaid,
      });
      setPosModal(false);
      await loadAll();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setPosSaving(false);
    }
  };

  const inflow = arr(cashflow.summary ?? cashflow.data);
  const netCash = num(cashflow.netBalance ?? cashflow.netPaisa);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Store className="w-7 h-7 text-emerald-600" />
            Agri Vyapari & Retailer Suite
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Storefront input sales on Krishi Mall, direct farmer crop procurement, J-Form issuance, and customer Khata ledger
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button onClick={() => void loadAll()} className={ghostBtnCls} title="Refresh">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
            {[
              { id: 'catalog', label: 'Store Products' },
              { id: 'orders', label: 'Mall Orders' },
              { id: 'procure', label: 'Procurement (J-Form)' },
              { id: 'pos', label: 'Khata & POS' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ErrorBanner message={error ?? formError} />

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          {/* KPI Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {kpi.map((k) => (
              <StatCard key={k.title} {...k} />
            ))}
          </div>

          {/* Upcoming Pickups & Trade Alerts */}
          {(() => {
            const pickups = recentPurchases.filter(
              (p) => p.status === 'pickupScheduled' || Boolean((p as unknown as Rec).pickup)
            );
            const pendingAdvance = recentPurchases.filter((p) => p.status === 'confirmed');

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upcoming Pickups Card */}
                <div className={`${cardCls} space-y-3`}>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-emerald-600" />
                      Upcoming Pickups & Logistics
                    </h3>
                    <Link to="/seller/purchases" className="text-xs font-bold text-emerald-700 hover:underline">
                      View All ({pickups.length}) →
                    </Link>
                  </div>

                  {pickups.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                      No active pickups scheduled. Propose agent slots under My Purchases.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pickups.slice(0, 3).map((po) => {
                        const pk = rec((po as unknown as Rec).pickup);
                        return (
                          <div key={po.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-900">{po.crop} ({po.quantityQuintal} Qt)</span>
                              <p className="text-[10px] text-slate-500">
                                {str(pk.date) || 'Tomorrow'} ({str(pk.slot) || '07:00-08:00'}) · Vehicle: {str(pk.vehicleNumber) || 'Bolero'}
                              </p>
                            </div>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              Grace: {num(pk.graceMinutes) || 60}m
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Trade Alerts & Pending Advance */}
                <div className={`${cardCls} space-y-3`}>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Pending Advances & Trade Alerts
                    </h3>
                    <span className="text-xs font-bold text-slate-400">Escrow Queue</span>
                  </div>

                  {pendingAdvance.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                      All purchase orders have advances deposited. Farmgate pipeline is clear.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingAdvance.slice(0, 3).map((po) => (
                        <div key={po.id} className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900">Order #{po.id}: {po.crop}</span>
                            <p className="text-[10px] text-rose-700">Total: {formatCurrency(po.totalAmount)} · Awaiting advance escrow</p>
                          </div>
                          <Link
                            to="/seller/purchases"
                            className="px-2.5 py-1 text-[11px] font-black bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
                          >
                            Deposit
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 23-Module Vyapari Hub Directory */}
          <div className={`${cardCls} space-y-3`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  Vyapari Enterprise Hub — Full Feature Directory (23 Modules)
                </h3>
                <p className="text-xs text-slate-500">Produce procurement, APMC mandi trading, AI forecasting, accounting & direct buyer connections</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 text-xs font-bold text-slate-800">
              {[
                { to: '/seller/profile', label: '1. Vyapari Business Profile', icon: Building2 },
                { to: '/seller/lots', label: '2. Lot Search & Discovery', icon: Search },
                { to: '/seller/purchases', label: '3. My Purchases & Bookings', icon: FileCheck },
                { to: '/seller/direct-buyers', label: '4. Direct Buyers Network', icon: Building2 },
                { to: '/seller/ai', label: '5. AI Insights & Sourcing', icon: Sparkles },
                { to: '/seller/rates', label: '6. Mandi Rates & Arbitrage', icon: Landmark },
                { to: '/seller/ratings', label: '7. Rate Farmers & Reputation', icon: Star },
                { to: '/seller/ads', label: '8. Ad Manager & Campaigns', icon: Megaphone },
                { to: '/seller/diary', label: '9. Farm / Business Diary', icon: BookOpen },
                { to: '/seller/chatbot', label: '10. Chatbot Support Desk', icon: Bot },
                { to: '/seller/procure', label: '11. J-Form Procurement', icon: FileSpreadsheet },
                { to: '/seller/demands', label: '12. Post Crop Demands', icon: Link2 },
                { to: '/seller/stock', label: '13. Stock & Resale Hub', icon: Package },
                { to: '/seller/pos', label: '14. Finance CEO & POS Khata', icon: DollarSign },
                { to: '/seller/catalog', label: '15. E-Market Storefront', icon: Store },
                { to: '/seller/orders', label: '16. My Shop Orders', icon: ShoppingBag },
                { to: '/seller/compliance', label: '17. GST & APMC Compliance', icon: ShieldCheck },
                { to: '/seller/analytics', label: '18. Trade Analytics Desk', icon: TrendingUp },
                { to: '/seller/news', label: '19. Agri News & Channels', icon: Newspaper },
                { to: '/seller/coins', label: '20. Coin Rewards (Krushi Ratna)', icon: Coins },
                { to: '/seller/referrals', label: '21. Refer & Earn Network', icon: Share2 },
                { to: '/seller/712', label: '22. 7/12 Land Records', icon: FileText },
                { to: '/seller/trees', label: '23. Tree Plantation Hub', icon: Trees },
              ].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200/80 transition-all flex items-center gap-2"
                >
                  <l.icon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{l.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Tab 1: Storefront Catalog */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900">Live Krishi Mall SKUs ({products.length})</h3>
                <button onClick={() => setAddProductModal(true)} className={primaryBtnCls}>
                  <Plus className="w-4 h-4 inline mr-1" /> Add New SKU
                </button>
              </div>

              {products.length === 0 ? (
                <div className={cardCls}>
                  <EmptyState label="No products yet — add your first SKU" />
                </div>
              ) : (
                <div className={`${cardCls} overflow-hidden`}>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                        <th className="py-3 px-6">Product Title & Brand</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Price / MRP</th>
                        <th className="py-3 px-4">Stock In Hand</th>
                        <th className="py-3 px-6 text-right">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((p) => {
                        const stockQty = num(p.stockQty);
                        return (
                          <tr key={str(p.id)} className="hover:bg-slate-50/60">
                            <td className="py-3.5 px-6 font-bold text-slate-900">
                              {str(p.title || p.name, 'Untitled SKU')}
                              <span className="text-[11px] text-slate-400 block font-normal">
                                {str(p.brand, '—')} · {str(p.batchNo, '')}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-600">{str(p.category, 'General')}</td>
                            <td className="py-3.5 px-4 font-bold text-emerald-800">
                              {formatCurrency(num(p.price))}
                              <span className="text-[10px] text-slate-400 block font-normal">
                                MRP {formatCurrency(num(p.mrp, num(p.price)))}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-800">
                              {stockQty} {str(p.unit, 'units')}
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <div className="inline-flex gap-1.5">
                                <button onClick={() => void restockProduct(p, 10)} className={ghostBtnCls}>
                                  +10
                                </button>
                                <button onClick={() => void restockProduct(p, -10)} className={ghostBtnCls}>
                                  −10
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Mall Orders */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Customer Mall Orders & Shipping Desk</h3>
                {orderError && <ErrorBanner message={orderError} />}
              </div>
              {orders.length === 0 ? (
                <div className={cardCls}>
                  <EmptyState label="No mall orders found for your store yet" />
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((ord) => {
                    const status = str(ord.status, 'placed');
                    const items = arr(ord.items);
                    const total = num(ord.finalTotal, num(ord.total));
                    return (
                      <div key={str(ord.id)} className={`${cardCls} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900">Order #{str(ord.id)}</h4>
                            <StatusBadge status={status} />
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {items.length > 0
                              ? `${items.length} line item(s): ${items
                                  .slice(0, 2)
                                  .map((it) => str(rec(it).title || rec(it).name))
                                  .join(', ')}${items.length > 2 ? '…' : ''}`
                              : 'Marketplace order'}
                            {ord.paymentMethod ? ` · ${str(ord.paymentMethod)}` : ''}
                            {str(rec(ord.buyer).name) ? ` · Buyer: ${str(rec(ord.buyer).name)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-emerald-800">{formatCurrency(total)}</span>
                          {ORDER_ACTION_LABEL[status] && (
                            <button onClick={() => void advanceOrder(ord)} className={primaryBtnCls}>
                              {ORDER_ACTION_LABEL[status]}
                            </button>
                          )}
                          <Link to={`/seller/orders/${str(ord.id)}`} className={ghostBtnCls}>
                            Detail
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: J-Form Procurement */}
          {activeTab === 'procure' && (
            <div className={`${cardCls} p-6 space-y-4`}>
              <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">APMC J-Form Digital Sale Receipts</h3>
                  <p className="text-xs text-slate-400">
                    {num(procStats.totalLots)} lots · {num(procStats.totalProcuredQuintals)} q procured ·{' '}
                    {formatCurrency(num(procStats.pendingPayouts))} pending payout
                  </p>
                </div>
                <button onClick={() => setJFormModal(true)} className={primaryBtnCls}>
                  <Plus className="w-4 h-4 inline mr-1" /> Generate New J-Form
                </button>
              </div>

              {procurement.length === 0 ? (
                <EmptyState label="No procurement J-forms recorded yet" />
              ) : (
                <div className="space-y-3">
                  {procurement.map((jf) => {
                    const paid = str(jf.paymentStatus) === 'paid';
                    return (
                      <div key={str(jf.id)} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                        <div className="flex flex-wrap justify-between font-bold text-slate-900 gap-2">
                          <span>J-Form: {str(jf.jFormNumber, jf.id)}</span>
                          <span className="text-emerald-700">{formatCurrency(num(jf.finalAmount))}</span>
                        </div>
                        <p className="text-slate-600">
                          Farmer: <strong>{str(jf.farmerName)}</strong> • {str(jf.crop)} ({num(jf.netWeightQuintals)} q @ ₹
                          {num(jf.ratePerQuintal)}/q)
                        </p>
                        <div className="flex flex-wrap justify-between items-center gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                          <span>
                            {paid
                              ? `Paid · UTR ${str(jf.utrNumber)} · ${str(jf.receiptNo)}`
                              : `Payment: ${str(jf.paymentStatus, 'unpaid')}`}
                          </span>
                          {!paid && (
                            <button onClick={() => void payLot(jf)} className={primaryBtnCls}>
                              Mark Paid (Bank Transfer)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Khata & POS */}
          {activeTab === 'pos' && (
            <div className="space-y-4">
              <div className={`${cardCls} p-6 space-y-4`}>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-900">Customer Udhar Khata Ledger</h3>
                  <Link to="/seller/pos" className={primaryBtnCls}>
                    Open Full POS Desk
                  </Link>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 flex justify-between items-center gap-4">
                  <div>
                    <h5 className="font-bold">
                      Total Udhar Outstanding Across {num(ledgerSummary.totalDebtors)} Buyers
                    </h5>
                    <p className="text-[11px] text-amber-800">
                      {inflow.length > 0 ? `${inflow.length} cashflow entr(y/ies) this period` : 'Ledger-driven khata book'}
                    </p>
                  </div>
                  <span className="text-xl font-black text-amber-900 whitespace-nowrap">
                    {formatCurrency(num(ledgerSummary.totalCreditOutstanding, paisaToRupees(ledgerSummary.totalCreditOutstandingPaisa)))}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">Top Khata Accounts</h4>
                  {ledgers.length === 0 ? (
                    <EmptyState label="No ledger entries yet" />
                  ) : (
                    <div className="space-y-2">
                      {ledgers.slice(0, 5).map((b) => (
                        <div key={`${str(b.buyerName)}-${str(b.buyerPhone)}`} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-xs">
                          <span className="font-bold text-slate-800">{str(b.buyerName, 'Unknown buyer')}</span>
                          <span className={num(b.netBalance) > 0 ? 'font-black text-rose-700' : 'font-bold text-emerald-700'}>
                            {formatCurrency(Math.abs(num(b.netBalance)))} {num(b.netBalance) > 0 ? 'due' : 'settled'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-500">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    Net cash position: <strong className="text-slate-800">{formatCurrency(netCash)}</strong>
                  </div>
                  <button onClick={() => setPosModal(true)} className={primaryBtnCls}>
                    <Plus className="w-4 h-4 inline mr-1" /> Record Counter Sale
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Product Modal */}
      <ModalSheet
        isOpen={addProductModal}
        onClose={() => setAddProductModal(false)}
        title="Add New Agri Input SKU"
        description="Publish product on Krishi Shopping Mall"
        maxWidth="md"
      >
        <form onSubmit={(e) => void handleAddProduct(e)} className="space-y-4">
          <div>
            <label className={labelCls}>Product Title</label>
            <input className={inputCls} value={pTitle} onChange={(e) => setPTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Brand</label>
              <input className={inputCls} value={pBrand} onChange={(e) => setPBrand(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={pCategory} onChange={(e) => setPCategory(e.target.value)}>
                <option>Seeds</option>
                <option>Fertilizers</option>
                <option>Crop Protection</option>
                <option>Tools & Machinery</option>
                <option>Cattle Feed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Price (₹)</label>
              <input type="number" className={inputCls} value={pPrice} onChange={(e) => setPPrice(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>MRP (₹)</label>
              <input type="number" className={inputCls} value={pMrp} onChange={(e) => setPMrp(Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Stock Qty</label>
              <input type="number" className={inputCls} value={pStock} onChange={(e) => setPStock(Number(e.target.value))} required />
            </div>
          </div>
          <ErrorBanner message={formError} />
          <button type="submit" disabled={saving} className={`${primaryBtnCls} w-full py-3`}>
            {saving ? 'Publishing…' : 'Publish SKU to Krishi Mall'}
          </button>
        </form>
      </ModalSheet>

      {/* J-Form Modal */}
      <ModalSheet
        isOpen={jFormModal}
        onClose={() => setJFormModal(false)}
        title="Generate APMC J-Form Procurement"
        description="Weighbridge-captured farmer produce purchase with statutory market fee"
        maxWidth="md"
      >
        <form onSubmit={(e) => void handleCreateJForm(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Farmer Name</label>
              <input className={inputCls} value={jfFarmer} onChange={(e) => setJfFarmer(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Farmer Phone</label>
              <input className={inputCls} value={jfPhone} onChange={(e) => setJfPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Crop</label>
              <input className={inputCls} value={jfCrop} onChange={(e) => setJfCrop(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Net Quantity (q)</label>
              <input type="number" className={inputCls} value={jfQty} onChange={(e) => setJfQty(Number(e.target.value))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Rate (₹/quintal)</label>
              <input type="number" className={inputCls} value={jfRate} onChange={(e) => setJfRate(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Quality Deduction (%)</label>
              <input type="number" className={inputCls} value={jfDeduction} onChange={(e) => setJfDeduction(Number(e.target.value))} min={0} max={50} />
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
            Gross: <strong>{formatCurrency(jfQty * jfRate)}</strong> → Net after {jfDeduction}% deduction:{' '}
            <strong className="text-emerald-800">{formatCurrency(jfQty * jfRate * (1 - jfDeduction / 100))}</strong>
          </div>
          <ErrorBanner message={formError} />
          <button type="submit" disabled={jSaving} className={`${primaryBtnCls} w-full py-3`}>
            {jSaving ? 'Recording…' : 'Record J-Form Purchase'}
          </button>
        </form>
      </ModalSheet>

      {/* POS Quick Sale Modal */}
      <ModalSheet
        isOpen={posModal}
        onClose={() => setPosModal(false)}
        title="Record Counter Sale (POS)"
        description="Creates a GST invoice-ready sale entry; unpaid balance goes to buyer khata"
        maxWidth="md"
      >
        <form onSubmit={(e) => void handlePosSale(e)} className="space-y-4">
          <div>
            <label className={labelCls}>Buyer Name</label>
            <input className={inputCls} value={posBuyer} onChange={(e) => setPosBuyer(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Item</label>
            <input className={inputCls} value={posItem} onChange={(e) => setPosItem(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Quantity</label>
              <input type="number" className={inputCls} value={posQty} onChange={(e) => setPosQty(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Rate (₹/unit)</label>
              <input type="number" className={inputCls} value={posRate} onChange={(e) => setPosRate(Number(e.target.value))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment Mode</label>
              <select className={inputCls} value={posMode} onChange={(e) => setPosMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit">Credit (Udhar)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount Paid (₹)</label>
              <input type="number" className={inputCls} value={posPaid} onChange={(e) => setPosPaid(Number(e.target.value))} />
            </div>
          </div>
          <ErrorBanner message={formError} />
          <button type="submit" disabled={posSaving} className={`${primaryBtnCls} w-full py-3`}>
            {posSaving ? 'Saving…' : `Record Sale · ${formatCurrency(posQty * posRate)}`}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
