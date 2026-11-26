import React, { useEffect, useState } from 'react';
import { Wind, CheckCircle2 } from 'lucide-react';
import { water, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export const WaterClimateView: React.FC = () => {
  const [schedule, setSchedule] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    water
      .schedule()
      .then((s) => {
        if (active && s) setSchedule(asRecord(s));
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Wind className="w-7 h-7 text-sky-600" />
          Climate
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Micro-climate spray windows and foliar spray advisory for your crops
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading climate advisory…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="Optimal Spray Window"
            value={asStr(schedule?.sprayWindow ?? schedule?.sprayWindowTime, '—')}
            subtitle={asStr(schedule?.sprayAdvice, 'Wind and humidity within safe spraying limits')}
            icon={Wind}
            colorScheme="amber"
          />

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Micro-Climate Spray Window Advice</h3>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Safe Foliar Spray Window Active</span>
              </div>
              <p className="leading-relaxed">
                {asStr(
                  schedule?.sprayAdvice,
                  'Relative humidity and wind speed are within safe limits for spraying bio-pesticides or water-soluble NPK.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
