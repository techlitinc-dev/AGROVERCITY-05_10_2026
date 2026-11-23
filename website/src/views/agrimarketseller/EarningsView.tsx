import React, { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';

interface Earnings {
  salesRevenuePaisa?: number;
  commissionPct?: number;
  commissionPaisa?: number;
  netPayoutPaisa?: number;
  payoutHistory?: { id?: string; amountPaisa?: number; status?: string; createdAt?: string }[];
}

export const EarningsView: React.FC = () => {
  const [data, setData] = useState<Earnings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    agriMarketSeller
      .earnings()
      .then((p) => mounted && setData(p as Earnings))
      .catch((e) => mounted && setError(apiErrorMessage(e)));
    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</div>;
  if (!data) return <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading earnings…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sales revenue</p>
          <p className="text-2xl font-black text-slate-900">{formatCurrency((data.salesRevenuePaisa ?? 0) / 100)}</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Commission deduction ({data.commissionPct ?? 0}%)</p>
          <p className="text-2xl font-black text-rose-600">−{formatCurrency((data.commissionPaisa ?? 0) / 100)}</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Net payout</p>
          <p className="text-2xl font-black text-emerald-700">{formatCurrency((data.netPayoutPaisa ?? 0) / 100)}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-black text-slate-900 mb-3 flex items-center gap-1.5">
          <Landmark className="w-4 h-4 text-emerald-600" /> Payout history (settlement ledger)
        </p>
        <div className="space-y-1.5">
          {(data.payoutHistory ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800">{p.id}</span>
              <span className="text-slate-500">
                {formatCurrency((p.amountPaisa ?? 0) / 100)} · <span className="font-bold">{p.status}</span>
              </span>
            </div>
          ))}
          {(data.payoutHistory ?? []).length === 0 && (
            <p className="text-[11px] text-slate-400">No settlements yet — payouts appear here as orders settle.</p>
          )}
        </div>
      </div>
    </div>
  );
};
