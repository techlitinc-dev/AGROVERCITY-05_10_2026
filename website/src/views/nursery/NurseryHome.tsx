import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sprout,
  Package,
  FileCheck,
  TrendingUp,
  Tag,
  DollarSign,
  Sparkles,
  BookOpen,
  ShoppingBag,
  Bot,
  GraduationCap,
  Radio,
  Award,
  Gift,
  Droplets,
  FileText,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Building2,
  CheckCircle2,
  Clock,
  Truck,
  Star,
} from 'lucide-react';
import { nursery } from '../../lib/api';

export const NurseryHome: React.FC = () => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [stockAlertCount, setStockAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([nursery.dashboard(), nursery.profile(), nursery.stockAlerts()])
      .then(([dashRes, profRes, alertsRes]) => {
        if (!mounted) return;
        setData((dashRes as Record<string, unknown>) || {});
        setProfile((profRes as Record<string, unknown>) || {});
        const alerts = (alertsRes as Record<string, unknown>) || {};
        const lowStock = (alerts.lowStock as Array<Record<string, unknown>>) || [];
        setStockAlertCount(lowStock.length);
      })
      .catch(() => {
        if (!mounted) return;
        setData({});
        setProfile({});
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const stats = (data?.stats as Record<string, unknown>) || {};
  const lowStock = (data?.lowStockAlerts as Array<Record<string, unknown>>) || [];
  const recentOrders = (data?.recentOrders as Array<Record<string, unknown>>) || [];

  const verified = profile?.verified === true || profile?.status === 'verified';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/40 text-xs font-semibold">
              <Sprout className="w-3.5 h-3.5 text-emerald-300" />
              <span>Horticulture & Plant Nursery Hub</span>
              {verified ? (
                <span className="flex items-center gap-1 text-emerald-200 ml-1">
                  • <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Verified Seller
                </span>
              ) : (
                <span className="text-amber-300 ml-1">• Pending Verification</span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {String(profile?.nurseryName || 'Green Agro Nursery')}
            </h1>
            <p className="text-emerald-100 text-sm max-w-xl">
              Manage your sapling inventory, track plant propagation batches, fulfill farmer orders, and maximize horticulture sales.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {stockAlertCount > 0 && (
              <Link
                to="/nursery/inventory"
                className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/90 hover:bg-amber-400 text-amber-950 font-bold text-xs shadow-md transition"
              >
                <AlertTriangle className="w-4 h-4" />
                Low Stock
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-950 text-amber-300 text-[10px] font-black">
                  {stockAlertCount}
                </span>
              </Link>
            )}
            <Link
              to="/nursery/inventory"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-emerald-900 font-bold text-xs shadow-md hover:bg-emerald-50 transition"
            >
              <PlusCircle className="w-4 h-4 text-emerald-700" />
              Add Plant
            </Link>
            <Link
              to="/nursery/batches"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500/50 text-white font-bold text-xs transition"
            >
              <Package className="w-4 h-4 text-emerald-300" />
              Log Batch
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Sales</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{Number(stats.grossRevenue || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] font-medium text-emerald-700">From delivered saplings</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Orders</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {Number(stats.totalOrders || 0)}
          </div>
          <p className="text-[11px] font-medium text-blue-700">
            {Number(stats.pendingOrdersCount || 0)} awaiting dispatch
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Plant Stock</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <Sprout className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {Number(stats.totalStock || 0)}
          </div>
          <p className="text-[11px] font-medium text-teal-700">
            {Number(stats.totalPlantsListed || 0)} species cataloged
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Low-Stock Items</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700">
            {Number(stats.lowStockCount || 0)}
          </div>
          <p className="text-[11px] font-medium text-amber-800">Need propagation / stock-in</p>
        </div>
      </div>

      {/* Low-Stock Alert Banner if any */}
      {Boolean(lowStock.length > 0) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">
                Low Stock Warning ({lowStock.length} varieties running low)
              </h4>
              <p className="text-xs text-amber-800">
                {lowStock.map((l) => `${String(l.title)} (${Number(l.stock)} left)`).join(' • ')}
              </p>
            </div>
          </div>
          <Link
            to="/nursery/batches"
            className="px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition"
          >
            Manage Batches
          </Link>
        </div>
      )}

      {/* Main Grid: Recent Orders & Quick AI Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders List */}
        <div className="lg:col-span-2 rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-slate-900">Recent Plant Orders</h2>
              <p className="text-xs text-slate-500">Incoming purchases placed by farmers & landscapers</p>
            </div>
            <Link
              to="/nursery/orders"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">No orders received yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentOrders.map((ord) => {
                const oId = String(ord.id || '');
                const status = String(ord.status || 'placed');
                const total = Number(ord.finalTotal || ord.total || 0);
                const items = (ord.items as Array<Record<string, unknown>>) || [];
                return (
                  <div key={oId} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Order #{oId.slice(-6).toUpperCase()}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'dispatched'
                              ? 'bg-purple-100 text-purple-800'
                              : status === 'packed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {items.length} item{items.length === 1 ? '' : 's'} • {String(ord.deliveryAddress || 'Address on file')}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">₹{total.toLocaleString('en-IN')}</p>
                      <Link
                        to={`/nursery/orders`}
                        className="text-[11px] font-bold text-emerald-700 hover:underline"
                      >
                        Manage Status →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Insight Teaser */}
        <div className="rounded-3xl bg-gradient-to-br from-teal-900 to-emerald-950 p-6 text-white shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-800/60 border border-teal-500/30 text-[11px] font-bold text-teal-200">
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              <span>AI Horticulture Forecast</span>
            </div>
            <h3 className="text-lg font-bold">Monsoon Agroforestry Surge</h3>
            <p className="text-xs text-teal-100/90 leading-relaxed">
              Monsoon arrival causes a 4.5x surge in Teak, Melia Dubia (Malabar Neem) & grafted Mango demand. Ensure at least 400 hardened saplings ready in Polyhouse Bed A before June.
            </p>
          </div>

          <div className="pt-4 border-t border-teal-800/80 space-y-2">
            <Link
              to="/nursery/ai"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-teal-950 font-bold text-xs hover:bg-teal-50 transition shadow"
            >
              Open AI Analysis Cockpit <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 21-Module Feature Directory */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Nursery Persona Suite — 21 Modules
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { to: '/nursery/profile', label: 'Profile & KYC', icon: Building2, desc: 'Shop & bank details' },
            { to: '/nursery/inventory', label: 'My Plants', icon: Sprout, desc: 'Species catalog' },
            { to: '/nursery/batches', label: 'Batches & Stock', icon: Package, desc: 'Propagation & mortality' },
            { to: '/nursery/orders', label: 'Orders Received', icon: FileCheck, desc: 'Fulfill & invoice' },
            { to: '/nursery/ratings', label: 'Reviews & Ratings', icon: Star, desc: 'Buyer reviews & replies' },
            { to: '/nursery/offers', label: 'Offers & Discounts', icon: Tag, desc: 'Seasonal coupons' },
            { to: '/nursery/payouts', label: 'Earnings & Payouts', icon: DollarSign, desc: '5% commission ledger' },
            { to: '/nursery/ai', label: 'AI Analysis', icon: Sparkles, desc: 'Demand & pricing' },
            { to: '/nursery/diary', label: 'Nursery Diary', icon: BookOpen, desc: 'Daily care & expenses' },
            { to: '/nursery/ads', label: 'Ad Manager', icon: TrendingUp, desc: 'Plant ad campaigns' },
            { to: '/nursery/shop', label: 'E-Market Shopping', icon: ShoppingBag, desc: 'Pots, seeds, fertilizer' },
            { to: '/nursery/finance', label: 'Finance CEO', icon: DollarSign, desc: 'Accounting & GST' },
            { to: '/nursery/chatbot', label: 'AI Chatbot', icon: Bot, desc: 'Plant care assistant' },
            { to: '/nursery/gyan', label: 'Gyansetu Learning', icon: GraduationCap, desc: 'Horticulture courses' },
            { to: '/nursery/news', label: 'Agri News Feed', icon: Radio, desc: 'Schemes & market' },
            { to: '/nursery/coins', label: 'Coin Rewards', icon: Award, desc: 'Krushi Ratna wallet' },
            { to: '/nursery/referrals', label: 'Refer & Earn', icon: Gift, desc: 'Referral program' },
            { to: '/nursery/trees', label: 'Tree Hub', icon: Droplets, desc: 'Plantation verification' },
            { to: '/nursery/land-records', label: '7/12 Records', icon: FileText, desc: 'Land extracts' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-400 hover:shadow-md transition text-slate-800 space-y-1.5 flex flex-col justify-between group"
              >
                <div className="p-2 rounded-xl bg-slate-50 text-emerald-800 group-hover:bg-emerald-50 group-hover:text-emerald-700 w-fit transition">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold group-hover:text-emerald-800 transition">{item.label}</h4>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{item.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
