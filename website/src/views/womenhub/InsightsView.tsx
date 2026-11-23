import React, { useEffect, useState } from 'react';
import { HeartPulse, Landmark, LineChart, Sprout, TrendingUp, Trophy } from 'lucide-react';
import { apiErrorMessage, womenHub } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';

interface InsightsPayload {
  savingsTrend?: { month: string; depositsPaisa: number; count: number }[];
  loanHealth?: { submitted: number; approved: number; rejected: number; repaid: number; health: string };
  garden?: {
    activeCrops: number;
    byStage?: Record<string, number>;
    harvested: number;
    yieldPrediction?: { perCropKg: Record<string, number>; totalKg: number } | null;
  };
  livestock?: { animalCount: number; milkingAnimals: number; dueVaccinations: number };
  enterprise?: {
    totalMonthlyProfitPaisa: number;
    bestSeller?: { name: string; unitsSold?: number; revenuePaisa?: number; profitPaisa?: number } | null;
    suggestion: string;
  };
}

const STAGE_LABEL: Record<string, string> = {
  sowing: 'Sowing',
  sprout: 'Sprout',
  vegetative: 'Vegetative',
  flowering: 'Flowering',
  harvest: 'Harvest',
};

export const WomanHubInsightsView: React.FC = () => {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    womenHub
      .insights()
      .then((payload) => {
        if (mounted) setData(payload as InsightsPayload);
      })
      .catch((e) => mounted && setError(apiErrorMessage(e)));
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading AI analysis…</div>;
  }

  const savings = data.savingsTrend ?? [];
  const maxSavings = Math.max(...savings.map((s) => s.depositsPaisa), 1);

  return (
    <div className="space-y-4">
      {/* 1. Savings trend */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <p className="text-xs font-bold text-slate-700">Savings group savings trend</p>
        </div>
        <div className="flex items-end gap-2 h-24">
          {savings.map((s) => (
            <div key={s.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-lg bg-emerald-500/80"
                style={{ height: `${Math.max((s.depositsPaisa / maxSavings) * 100, 2)}%` }}
                title={`₹${(s.depositsPaisa / 100).toFixed(0)}`}
              />
              <span className="text-[9px] font-bold text-slate-400">{s.month.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Loan repayment health */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse className="w-4 h-4 text-rose-500" />
          <p className="text-xs font-bold text-slate-700">Loan repayment health</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              ['Applied', data.loanHealth?.submitted],
              ['Approved', data.loanHealth?.approved],
              ['Repaid', data.loanHealth?.repaid],
              ['Rejected', data.loanHealth?.rejected],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-slate-50 rounded-2xl p-3 text-center">
              <p className="text-lg font-black text-slate-900">{value ?? 0}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] mt-2 font-bold text-emerald-700 capitalize">
          Status: {data.loanHealth?.health ?? 'good'}
        </p>
      </div>

      {/* 3. Garden yield prediction */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sprout className="w-4 h-4 text-emerald-600" />
          <p className="text-xs font-bold text-slate-700">Garden yield prediction</p>
        </div>
        {data.garden?.byStage && (
          <p className="text-[11px] text-slate-500 mb-2">
            {Object.entries(data.garden.byStage)
              .map(([stage, count]) => `${STAGE_LABEL[stage] ?? stage}: ${count}`)
              .join(' · ')}
          </p>
        )}
        {data.garden?.yieldPrediction ? (
          <div className="space-y-1">
            <p className="text-sm font-black text-slate-900">
              ~{data.garden.yieldPrediction.totalKg} kg expected
            </p>
            {Object.entries(data.garden.yieldPrediction.perCropKg).map(([crop, kg]) => (
              <p key={crop} className="text-[11px] text-slate-600">
                {crop}: ~{kg} kg
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">
            Log a harvest in the Kitchen Garden Planner to unlock yield prediction.
          </p>
        )}
      </div>

      {/* 4. Livestock productivity */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center gap-2 mb-3">
          <LineChart className="w-4 h-4 text-amber-600" />
          <p className="text-xs font-bold text-slate-700">Livestock productivity insights</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-slate-900">{data.livestock?.animalCount ?? 0}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Animals</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-slate-900">{data.livestock?.milkingAnimals ?? 0}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">In milk</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-slate-900">{data.livestock?.dueVaccinations ?? 0}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vaccines due</p>
          </div>
        </div>
      </div>

      {/* 5. Enterprise best seller & price suggestion */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-500" />
          <p className="text-xs font-bold text-slate-700">Enterprise best-seller &amp; price suggestion</p>
        </div>
        {data.enterprise?.bestSeller ? (
          <div className="mb-2">
            <p className="text-sm font-black text-slate-900">{data.enterprise.bestSeller.name}</p>
            {'unitsSold' in data.enterprise.bestSeller ? (
              <p className="text-[11px] text-slate-500">
                {data.enterprise.bestSeller.unitsSold} units delivered
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                Revenue {formatCurrency(((data.enterprise.bestSeller.revenuePaisa ?? 0) / 100))} · Profit{' '}
                {formatCurrency(((data.enterprise.bestSeller.profitPaisa ?? 0) / 100))}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 mb-2">No sales data yet.</p>
        )}
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
          <Landmark className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
          <p className="text-[11px] text-emerald-900 font-semibold">{data.enterprise?.suggestion}</p>
        </div>
      </div>
    </div>
  );
};
