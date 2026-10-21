import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Lightbulb,
  RefreshCw,
  Route,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { transport, ApiError, apiErrorMessage } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { asArr, asRec, firstNum, str, type Rec } from './utils';

/** /transporter/ai — rule-based demand/earnings insights (plan-gated). */
export const TransporterAiView: React.FC = () => {
  const [insights, setInsights] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<{ planId?: string; feature?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUpgrade(null);
    try {
      const res = await transport.aiInsights();
      setInsights(asRec(res));
    } catch (e) {
      // 402 ENTITLEMENT_EXCEEDED — plan-gated exactly like /transport/analytics.
      if (e instanceof ApiError && e.status === 402) {
        setUpgrade({ feature: 'routeAnalytics' });
      } else {
        setError(apiErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const routeDemand = asArr(insights?.routeDemand).map(asRec);
  const earningsTrend = asArr(insights?.earningsTrend)
    .map(asRec)
    .map((m) => ({
      ...m,
      month: str(m.month, ''),
      earningsRupees: Math.round(firstNum(m, ['earningsPaise'], 0) / 100),
    }));
  const suggestions = asArr(insights?.suggestions).map((s) => str(s, '')).filter(Boolean);
  const utilizationPct = firstNum(insights ?? {}, ['utilizationPct'], 0);
  const idleDays = firstNum(insights ?? {}, ['idleDays'], 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-emerald-600" />
            AI Business Insights
          </h1>
          <p className="text-xs text-slate-500 mt-1">Route demand, earnings trend, fleet utilization, and growth suggestions from your own trips</p>
        </div>
        <button onClick={load} className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 self-start sm:self-auto" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {upgrade && (
        <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl space-y-3">
          <h3 className="font-extrabold text-base text-amber-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> Route analytics is a Pro feature
          </h3>
          <p className="text-xs text-amber-800">
            AI insights (route demand, earnings trend, utilization) are not available on your current plan
            {upgrade.feature ? ` (${upgrade.feature})` : ''}. Upgrade to unlock data-driven load planning.
          </p>
          <Link
            to="/billing"
            className="inline-block px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md"
          >
            View Plans & Upgrade →
          </Link>
        </div>
      )}

      {!upgrade && insights && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
              <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-emerald-600" /> Fleet utilization (this month)
              </p>
              <p className="text-2xl font-black text-emerald-700 mt-1">{utilizationPct}%</p>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, utilizationPct)}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
              <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-amber-600" /> Idle days (this month)
              </p>
              <p className="text-2xl font-black text-amber-700 mt-1">{idleDays}</p>
              <p className="text-[10px] text-slate-400 mt-2">Days with no active trip — target them with backhaul loads.</p>
            </div>
          </div>

          {/* Earnings trend chart */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-600" /> Earnings Trend (last 6 months)
            </h3>
            {earningsTrend.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No delivered trips in the window yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={earningsTrend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Earnings']} />
                    <Bar dataKey="earningsRupees" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Route demand table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Route className="w-4 h-4 text-emerald-600" /> Top Routes by Earnings
            </h3>
            {routeDemand.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No delivered trips yet — complete trips to build route demand.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 uppercase text-[10px]">
                      <th className="py-2 pr-4 font-bold">Route</th>
                      <th className="py-2 pr-4 font-bold text-right">Trips</th>
                      <th className="py-2 font-bold text-right">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeDemand.map((r) => (
                      <tr key={str(r.route)} className="border-t border-slate-100">
                        <td className="py-2.5 pr-4 font-bold text-slate-800">{str(r.route)}</td>
                        <td className="py-2.5 pr-4 text-right text-slate-600">{firstNum(r, ['count'], 0)}</td>
                        <td className="py-2.5 text-right font-black text-emerald-700">{formatCurrency(firstNum(r, ['earningsPaise'], 0) / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Suggestions */}
          <div className="bg-sky-50/60 rounded-3xl p-6 border border-sky-100 space-y-3">
            <h3 className="font-bold text-sm text-sky-900 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" /> Suggestions for your fleet
            </h3>
            {suggestions.length === 0 ? (
              <p className="text-xs text-sky-700">Keep completing trips — personalized suggestions appear here.</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-sky-900 bg-white rounded-2xl p-3 border border-sky-100">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600 mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {!upgrade && !insights && !error && !loading && (
        <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
          No insights available yet.
        </div>
      )}
    </div>
  );
};
