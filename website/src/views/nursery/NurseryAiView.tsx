import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Sprout,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { nursery } from '../../lib/api';

export const NurseryAiView: React.FC = () => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    nursery
      .aiInsights()
      .then((res) => {
        if (!mounted) return;
        setData((res as Record<string, unknown>) || {});
      })
      .catch(() => {
        if (!mounted) return;
        setData({});
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const seasonalTrend = (data?.seasonalTrend as Record<string, unknown>) || {};
  const salesForecast = (data?.salesForecast as Array<Record<string, unknown>>) || [];
  const pricing = (data?.pricingSuggestions as Array<Record<string, unknown>>) || [];
  const stockPlanning = (data?.stockPlanning as Array<Record<string, unknown>>) || [];
  const fastMoving = (data?.fastMovingCategories as Array<Record<string, unknown>>) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-teal-600" />
          AI Analysis & Horticulture Insights
        </h1>
        <p className="text-xs text-slate-500">
          Machine-learning forecasts for seasonal demand spikes, dynamic plant pricing, and propagation planning.
        </p>
      </div>

      {/* Seasonal Demand Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-950 p-6 md:p-8 text-white shadow-xl space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-800/60 border border-teal-500/40 text-xs font-semibold text-teal-200">
          <Calendar className="w-3.5 h-3.5 text-teal-300" />
          <span>Current Focus: {String(seasonalTrend.currentSeason || 'Monsoon Planting Season')}</span>
        </div>

        <h2 className="text-xl md:text-2xl font-black text-white">
          Peak Demand Ahead for Agroforestry & Fruit Orchards
        </h2>

        <p className="text-xs md:text-sm text-teal-100/90 max-w-2xl leading-relaxed">
          {String(
            seasonalTrend.trendSummary ||
              'Monsoon arrival drives 4.5x surge in Teak, Bamboo, and Malabar Neem timber saplings. High demand expected for grafted Kesar Mango and Guava.'
          )}
        </p>
      </div>

      {/* Grid: 30/60/90 Day Forecast & Fast Moving Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forecast Cards */}
        <div className="lg:col-span-2 rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              Projected Sales Forecast (Next Quarter)
            </h3>
            <p className="text-xs text-slate-500">Estimated sapling volume and revenue based on historical procurement cycles</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {salesForecast.map((f, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 hover:bg-emerald-50/50 hover:border-emerald-300 transition"
              >
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  {String(f.period)}
                </span>
                <div className="text-xl font-black text-slate-900">
                  ₹{Number(f.projectedRevenue || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-600 font-semibold">
                  ~{Number(f.projectedUnits || 0)} saplings
                </div>
                <div className="text-[10px] text-emerald-700 font-medium">
                  {Math.round(Number(f.confidence || 0.8) * 100)}% forecast confidence
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fast Moving Categories */}
        <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-700" />
              Top Sourcing Categories
            </h3>
            <p className="text-xs text-slate-500">Share of marketplace inquiries</p>
          </div>

          <div className="space-y-3 pt-2">
            {fastMoving.map((c, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-800">
                  <span>{String(c.category)}</span>
                  <span>{Number(c.sharePct)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${Number(c.sharePct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Pricing Suggestions */}
      <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-700" />
            AI Dynamic Pricing Recommendations
          </h3>
          <p className="text-xs text-slate-500">
            Compare your rates with regional APMC and nursery averages to maximize sales margin
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {pricing.map((p, idx) => (
            <div key={idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-900">{String(p.species)}</h4>
                <p className="text-[11px] text-emerald-800 font-medium">{String(p.action)}</p>
              </div>

              <div className="flex items-center gap-6 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Your Price</span>
                  <span className="font-bold text-slate-800">₹{Number(p.currentPrice)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Market Average</span>
                  <span className="font-bold text-slate-500">₹{Number(p.marketAverage)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-teal-700 block font-bold">Suggested</span>
                  <span className="font-black text-emerald-700">₹{Number(p.suggestedPrice)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stock Planning & Propagation Targets */}
      <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sprout className="w-4 h-4 text-emerald-700" />
            Propagation & Stock Planning Targets
          </h3>
          <p className="text-xs text-slate-500">Suggested grafting and bed preparation actions before peak procurement</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stockPlanning.map((s, idx) => {
            const urgency = String(s.urgency || 'Normal');
            const isHigh = urgency.toLowerCase() === 'high';
            return (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">{String(s.species)}</h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isHigh ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {urgency} Priority
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{String(s.recommendation)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
