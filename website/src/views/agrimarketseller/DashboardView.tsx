import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, IndianRupee, Megaphone, Package, MessageSquareQuote, ShoppingCart, Star, TrendingUp } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';

interface Kpi {
  count?: number;
  counts?: Record<string, number>;
  deepLink: string;
}

interface DashboardPayload {
  revenuePaisa?: number;
  ordersReceived?: number;
  ordersByStatus?: Record<string, number>;
  productStats?: { count: number; lowStock: number; outOfStock: number };
  adPerformance?: { campaigns: number; impressions: number; clicks: number };
  alerts?: { lowStock: { productId: string; title: string; availability: number }[]; openEnquiries: number; pendingQuotations: number };
  kpis?: { enquiries: Kpi; pendingQuotations: Kpi; lowStock: Kpi; orderStatus: Kpi };
}

export const SellerDashboardView: React.FC = () => {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    agriMarketSeller
      .dashboard()
      .then((p) => mounted && setData(p as DashboardPayload))
      .catch((e) => mounted && setError(apiErrorMessage(e)));
    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</div>;
  if (!data) return <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading dashboard…</div>;

  const kpis = data.kpis;
  const statusTotal = Object.values(data.ordersByStatus ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Sr 2 widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
          <IndianRupee className="w-4 h-4 text-emerald-600 mb-1" />
          <p className="text-lg font-black text-slate-900">{formatCurrency((data.revenuePaisa ?? 0) / 100)}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Revenue</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
          <ShoppingCart className="w-4 h-4 text-emerald-600 mb-1" />
          <p className="text-lg font-black text-slate-900">{data.ordersReceived ?? 0}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Orders received</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
          <Package className="w-4 h-4 text-emerald-600 mb-1" />
          <p className="text-lg font-black text-slate-900">{data.productStats?.count ?? 0}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Products · {data.productStats?.lowStock ?? 0} low stock
          </p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
          <Megaphone className="w-4 h-4 text-emerald-600 mb-1" />
          <p className="text-lg font-black text-slate-900">{data.adPerformance?.campaigns ?? 0}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Ads · {data.adPerformance?.clicks ?? 0}/{data.adPerformance?.impressions ?? 0} clicks
          </p>
        </div>
      </div>

      {/* Sr 2 KPI strip — each tile deep-links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(
          [
            ['Enquiries', kpis?.enquiries?.count, kpis?.enquiries?.deepLink, MessageSquareQuote],
            ['Pending quotations', kpis?.pendingQuotations?.count, kpis?.pendingQuotations?.deepLink, Star],
            ['Low stock', kpis?.lowStock?.count, kpis?.lowStock?.deepLink, BellRing],
            ['Order status', statusTotal, kpis?.orderStatus?.deepLink, TrendingUp],
          ] as const
        ).map(([label, value, link, Icon]) => (
          <Link
            key={label}
            to={link ?? '/agriMarketSeller'}
            className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 hover:border-emerald-600 transition-colors"
          >
            <Icon className="w-4 h-4 text-emerald-600 mb-1" />
            <p className="text-lg font-black text-slate-900">{value ?? 0}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
          </Link>
        ))}
      </div>

      {(data.alerts?.lowStock?.length || data.alerts?.openEnquiries) ? (
        <div className="bg-white rounded-3xl border border-amber-200 bg-amber-50/60 shadow-xs p-5">
          <p className="text-xs font-bold text-slate-700 mb-2">Alerts</p>
          <ul className="space-y-1 text-[11px] text-slate-600">
            {(data.alerts?.lowStock ?? []).map((a) => (
              <li key={a.productId}>
                <span className="font-bold text-slate-800">{a.title}</span> — low stock ({a.availability} left)
              </li>
            ))}
            {data.alerts?.openEnquiries ? (
              <li>
                <span className="font-bold text-slate-800">{data.alerts.openEnquiries}</span> enquiry(ies) awaiting response
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
