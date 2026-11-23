import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';

interface Reports {
  daily?: { date: string; orders: number; revenuePaisa: number }[];
  monthly?: { month: string; orders: number; revenuePaisa: number }[];
  topProducts?: { title: string; quantity: number; revenuePaisa: number }[];
  ordersByStatus?: Record<string, number>;
  discountsPaisa?: number;
  cancellations?: number;
  returns?: number;
  revenuePaisa?: number;
}

export const ReportsView: React.FC = () => {
  const [data, setData] = useState<Reports | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    agriMarketSeller
      .salesReports()
      .then((p) => mounted && setData(p as Reports))
      .catch((e) => mounted && setError(apiErrorMessage(e)));
    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</div>;
  if (!data) return <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading reports…</div>;

  const maxMonthly = Math.max(...(data.monthly ?? []).map((m) => m.revenuePaisa), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(
          [
            ['Revenue', formatCurrency((data.revenuePaisa ?? 0) / 100)],
            ['Discounts given', formatCurrency((data.discountsPaisa ?? 0) / 100)],
            ['Cancellations', String(data.cancellations ?? 0)],
            ['Returns', String(data.returns ?? 0)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
            <p className="text-lg font-black text-slate-900">{value}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-black text-slate-900 mb-3 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-emerald-600" /> Monthly sales
        </p>
        <div className="flex items-end gap-2 h-28">
          {(data.monthly ?? []).map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-lg bg-emerald-500/80"
                style={{ height: `${Math.max((m.revenuePaisa / maxMonthly) * 100, 2)}%` }}
                title={formatCurrency(m.revenuePaisa / 100)}
              />
              <span className="text-[9px] font-bold text-slate-400">{m.month.slice(5)}</span>
            </div>
          ))}
          {(data.monthly ?? []).length === 0 && <p className="text-[11px] text-slate-400">No sales yet.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <p className="text-xs font-black text-slate-900 mb-2">Top products</p>
          <div className="space-y-1.5">
            {(data.topProducts ?? []).map((t) => (
              <div key={t.title} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1.5">
                <span className="font-bold text-slate-800">{t.title}</span>
                <span className="text-slate-500">
                  {t.quantity} sold · {formatCurrency(t.revenuePaisa / 100)}
                </span>
              </div>
            ))}
            {(data.topProducts ?? []).length === 0 && <p className="text-[11px] text-slate-400">No data yet.</p>}
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <p className="text-xs font-black text-slate-900 mb-2">Order status breakdown</p>
          <div className="space-y-1.5">
            {Object.entries(data.ordersByStatus ?? {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1.5">
                <span className="font-bold text-slate-800 capitalize">{status.replace(/_/g, ' ')}</span>
                <span className="text-slate-500">{count}</span>
              </div>
            ))}
            {Object.keys(data.ordersByStatus ?? {}).length === 0 && <p className="text-[11px] text-slate-400">No orders yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
