import React, { useEffect, useState } from 'react';
import { Lightbulb, LineChart, Tag } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';

interface Insights {
  demandForecast?: { month: string; perProduct: Record<string, number> } | null;
  pricingSuggestions?: { productId: string; title: string; suggestion: string }[];
  salesInsights?: { bestSeller?: { title: string; unitsSold: number }; distinctProductsSold?: number; fulfilledOrders?: number } | null;
}

export const InsightsView: React.FC = () => {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    agriMarketSeller
      .insights()
      .then((p) => mounted && setData(p as Insights))
      .catch((e) => mounted && setError(apiErrorMessage(e)));
    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</div>;
  if (!data) return <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading AI analysis…</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
          <LineChart className="w-4 h-4 text-emerald-600" /> Demand forecast
        </p>
        {data.demandForecast ? (
          <div className="space-y-1">
            <p className="text-[11px] text-slate-400">Units sold per product · {data.demandForecast.month}</p>
            {Object.entries(data.demandForecast.perProduct).map(([title, units]) => (
              <p key={title} className="text-[11px] text-slate-700">
                <span className="font-bold text-slate-900">{title}</span> — {units} units
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">Sell for a month to unlock the demand forecast.</p>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-emerald-600" /> Pricing suggestions
        </p>
        {(data.pricingSuggestions ?? []).length === 0 ? (
          <p className="text-[11px] text-slate-400">No pricing suggestions — your catalog looks well priced.</p>
        ) : (
          <div className="space-y-1.5">
            {(data.pricingSuggestions ?? []).map((s) => (
              <p key={s.productId} className="text-[11px] text-slate-700">
                <span className="font-bold text-slate-900">{s.title}</span> — {s.suggestion}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-amber-500" /> Sales insights
        </p>
        {data.salesInsights ? (
          <div className="space-y-1 text-[11px] text-slate-700">
            {data.salesInsights.bestSeller && (
              <p>
                Best seller: <span className="font-bold text-slate-900">{data.salesInsights.bestSeller.title}</span> (
                {data.salesInsights.bestSeller.unitsSold} units)
              </p>
            )}
            <p>{data.salesInsights.distinctProductsSold ?? 0} distinct products sold</p>
            <p>{data.salesInsights.fulfilledOrders ?? 0} fulfilled orders</p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">No sales data yet.</p>
        )}
      </div>
    </div>
  );
};
