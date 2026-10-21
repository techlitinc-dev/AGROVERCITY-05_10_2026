import React, { useEffect, useState } from 'react';
import {
  Droplets,
  Wind,
  CheckCircle2,
  Calendar,
  Calculator,
  Waves,
  RefreshCw,
} from 'lucide-react';
import { water, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

export const WaterClimateView: React.FC = () => {
  const [schedule, setSchedule] = useState<Record<string, unknown> | null>(null);
  const [groundwater, setGroundwater] = useState<Record<string, unknown> | null>(null);
  const [rotation, setRotation] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PMKSY calculator
  const [areaHa, setAreaHa] = useState(1.0);
  const [cropType, setCropType] = useState('horticulture');
  const [calculatorResult, setCalculatorResult] = useState<Record<string, unknown> | null>(null);
  const [calcBusy, setCalcBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      water.schedule().catch(() => null),
      water.groundwater().catch(() => null),
      water.canalRotation().catch(() => []),
    ])
      .then(([s, g, r]) => {
        if (!active) return;
        if (s) setSchedule(asRecord(s));
        if (g) setGroundwater(asRecord(g));
        setRotation(asArray(r));
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const runCalculator = async () => {
    setCalcBusy(true);
    setError(null);
    try {
      const res = await water.pmksyCalculator({ areaHa, cropType });
      setCalculatorResult(asRecord(res));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setCalcBusy(false);
    }
  };

  const waterTableFt = asNum(
    groundwater?.waterTableFt ?? groundwater?.levelFt ?? groundwater?.depthFt,
    0
  );
  const groundwaterStatus = asStr(groundwater?.status ?? groundwater?.zone, 'Safe');
  const nextIrrigation = asStr(schedule?.nextIrrigationDate ?? schedule?.nextDate, '');

  const scheduleSteps = asArray(schedule?.stages ?? schedule?.schedule ?? schedule?.items).map((s) =>
    asRecord(s)
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Droplets className="w-7 h-7 text-sky-600" />
          Water Intelligence & Climate Resilience
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Borewell groundwater telemetry, canal rotation roster, and micro-climate spray windows
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading water intelligence…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Borewell Water Table"
              value={waterTableFt > 0 ? `${waterTableFt} Feet` : '—'}
              subtitle={groundwaterStatus ? `Zone: ${groundwaterStatus}` : 'Safe recharge zone'}
              icon={Droplets}
              colorScheme="blue"
            />
            <StatCard
              title="Canal Water Roster"
              value={rotation.length > 0 ? asStr(asRecord(rotation[0]).turn ?? asRecord(rotation[0]).slot, `Turn #${rotation.length}`) : '—'}
              subtitle={
                rotation.length > 0
                  ? `${asStr(asRecord(rotation[0]).date, '')} ${asStr(asRecord(rotation[0]).duration, asStr(asRecord(rotation[0]).hours, ''))}`.trim() ||
                    'Check roster below'
                  : 'No active rotation'
              }
              icon={Calendar}
              colorScheme="green"
            />
            <StatCard
              title="Optimal Spray Window"
              value={asStr(schedule?.sprayWindow ?? schedule?.sprayWindowTime, '07:00 – 11:00 AM')}
              subtitle={asStr(schedule?.sprayAdvice, 'Wind speed < 8 km/h • Zero drift risk')}
              icon={Wind}
              colorScheme="amber"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Irrigation Schedule for Upcoming Stages</h3>
                {nextIrrigation && (
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                    Next: {nextIrrigation}
                  </span>
                )}
              </div>
              {scheduleSteps.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No schedule entries published for your crops yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {scheduleSteps.map((step, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <h5 className="font-bold text-slate-900">{asStr(step.stage ?? step.title, 'Irrigation')}</h5>
                        <p className="text-slate-500">{asStr(step.duration ?? step.method, '')}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-800">{asStr(step.date, '')}</span>
                        <span className="text-[10px] text-emerald-700 block font-semibold capitalize">
                          {asStr(step.status, 'Scheduled')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Canal rotation roster */}
              {rotation.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Waves className="w-4 h-4 text-sky-600" /> Canal Rotation Roster
                  </h4>
                  {rotation.slice(0, 4).map((r, i) => {
                    const rec = asRecord(r);
                    return (
                      <div key={i} className="p-2.5 bg-sky-50/60 border border-sky-100 rounded-xl flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800">{asStr(rec.turn ?? rec.slot, `Turn ${i + 1}`)}</span>
                        <span className="text-slate-500">
                          {asStr(rec.date, '')} • {asStr(rec.duration ?? rec.hours, '')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-6">
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

              {/* PMKSY drip subsidy calculator */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-sm text-slate-900">PMKSY Drip Subsidy Calculator</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Area (hectares)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={areaHa}
                      onChange={(e) => setAreaHa(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Crop Type</label>
                    <select
                      value={cropType}
                      onChange={(e) => setCropType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="horticulture">Horticulture (55% subsidy)</option>
                      <option value="plantation">Plantation Crops</option>
                      <option value="field">Field Crops (Sprinkler)</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={runCalculator}
                  disabled={calcBusy}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {calcBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                  {calcBusy ? 'Calculating…' : 'Calculate My Subsidy'}
                </button>
                {calculatorResult && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Est. System Cost</span>
                      <span className="font-black text-sm">
                        ₹{asNum(calculatorResult.totalCost ?? calculatorResult.estimatedCost ?? calculatorResult.systemCost, 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Govt Subsidy (55%)</span>
                      <span className="font-black text-sm">
                        ₹{asNum(calculatorResult.subsidyAmount ?? calculatorResult.subsidy, 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Your Share</span>
                      <span className="font-black text-sm">
                        ₹{asNum(calculatorResult.farmerShare ?? calculatorResult.yourShare, 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
