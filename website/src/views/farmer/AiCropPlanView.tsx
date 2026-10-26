import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Sprout,
  TrendingUp,
  Wallet,
  CalendarDays,
  Droplets,
  IndianRupee,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { advisory, farmerCrops, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CropChipsInput } from '../../components/common/CropTypeahead';
import { formatDate, formatPaisa, detectSeason } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

const SEASON_META: Record<string, { label: string; hint: string }> = {
  Kharif: { label: 'Kharif / खरीप', hint: 'Monsoon season — sow Jun–Jul' },
  Rabi: { label: 'Rabi / रब्बी', hint: 'Winter season — sow Oct–Nov' },
  Zaid: { label: 'Zaid / जायद', hint: 'Short summer window — sow Mar–Apr' },
};

// Rotating motivational lines shown under the progress bar while the plan
// generates (bilingual, farming-flavoured).
const PLAN_MESSAGES = [
  'Analysing your soil, irrigation and season… / आपकी मिट्टी, सिंचाई और मौसम का विश्लेषण हो रहा है…',
  'Checking live mandi prices for your district… / आपके जिले के मंडी भाव देखे जा रहे हैं…',
  'Consulting the AI agronomist… / AI कृषि विशेषज्ञ से सलाह ली जा रही है…',
  'Comparing profit, crop by crop, for your plot… / आपके खेत के लिए फसलों का मुनाफा तुलना हो रहा है…',
  'Good planning is half the harvest — almost there! / अच्छी योजना ही आधी फसल है — बस कुछ ही पल!',
];

export const AiCropPlanView: React.FC = () => {
  const { user } = useAuthStore();
  const farmerDistrict = asStr(user?.district);

  const [cycles, setCycles] = useState<unknown[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Plan generator
  const [form, setForm] = useState({
    soil: 'black',
    irrigation: 'drip',
    plotSizeAcres: 2,
    district: farmerDistrict || 'Nashik',
    season: '',
    cropHistory: [] as string[],
  });
  useEffect(() => {
    if (farmerDistrict) setForm((f) => ({ ...f, district: farmerDistrict }));
  }, [farmerDistrict]);

  const [result, setResult] = useState<{
    options: Record<string, unknown>[];
    source: string;
    season: string;
    cached: boolean;
  } | null>(null);
  const [planning, setPlanning] = useState(false);
  // Simulated progress — the API is one long call, so the bar eases toward
  // ~92% while waiting and snaps to 100% when the plan lands.
  const [planProgress, setPlanProgress] = useState(0);
  const [planMsgIdx, setPlanMsgIdx] = useState(0);
  const planTimerRef = useRef<number | null>(null);
  const msgTimerRef = useRef<number | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const activeSeason = useMemo(() => detectSeason(), []);
  const resolvedSeason = result?.season || form.season || activeSeason;
  const seasonMeta = SEASON_META[resolvedSeason] ?? { label: resolvedSeason, hint: '' };

  const loadCycles = async () => {
    setLoadingCycles(true);
    try {
      setCycles(await farmerCrops.list());
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoadingCycles(false);
    }
  };

  useEffect(() => {
    loadCycles().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aiPlans = useMemo(
    () =>
      cycles
        .map(asRecord)
        .filter((c) => c.fromPlanner === true)
        .sort((a, b) => asStr(b.createdAt).localeCompare(asStr(a.createdAt))),
    [cycles]
  );

  const totalPlannedProfit = useMemo(
    () =>
      aiPlans.reduce((sum, c) => {
        const details = asRecord(c.planDetails);
        return sum + asNum(details.expectedProfitPaisa);
      }, 0),
    [aiPlans]
  );

  const chartData = useMemo(
    () =>
      (result?.options ?? []).map((o) => ({
        crop: asStr(o.crop, 'Crop'),
        Profit: Math.round(asNum(o.expectedProfitPaisa) / 100),
        Revenue: Math.round(asNum(o.estimatedRevenuePaisa) / 100),
        Cost: Math.round(asNum(o.estimatedCostPaisa) / 100),
      })),
    [result]
  );

  const stopPlanProgress = () => {
    if (planTimerRef.current !== null) {
      window.clearInterval(planTimerRef.current);
      planTimerRef.current = null;
    }
    if (msgTimerRef.current !== null) {
      window.clearInterval(msgTimerRef.current);
      msgTimerRef.current = null;
    }
  };

  const startPlanProgress = () => {
    stopPlanProgress();
    setPlanProgress(0);
    setPlanMsgIdx(0);
    let p = 0;
    planTimerRef.current = window.setInterval(() => {
      p += Math.max(0.5, (92 - p) * 0.05);
      setPlanProgress(p > 92 ? 92 : p);
    }, 150);
    msgTimerRef.current = window.setInterval(() => {
      setPlanMsgIdx((i) => (i + 1) % PLAN_MESSAGES.length);
    }, 3500);
  };

  useEffect(() => () => stopPlanProgress(), []);

  const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanning(true);
    setError(null);
    setNotice(null);
    startPlanProgress();
    let ok = false;
    try {
      const res = asRecord(
        await advisory.cropPlan({
          soil: form.soil,
          irrigation: form.irrigation,
          plotSizeAcres: form.plotSizeAcres,
          cropHistory: form.cropHistory,
          district: form.district || 'Nashik',
          season: form.season || undefined,
          lang: 'en',
        })
      );
      const options = asArray(res.options).map(asRecord);
      const season = asStr(res.season, form.season || activeSeason);
      setResult({
        options,
        source: asStr(res.source, 'fallback'),
        season,
        cached: res.cached === true,
      });
      ok = true;
      setPlanProgress(100);
      setNotice(
        `${options.length} plan${options.length === 1 ? '' : 's'} generated for the ${season} season.`
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      stopPlanProgress();
      if (ok) {
        // Brief 100% flash before swapping the bar for the results.
        window.setTimeout(() => setPlanning(false), 600);
      } else {
        setPlanning(false);
      }
    }
  };

  const handleConfirm = async (option: Record<string, unknown>) => {
    const crop = asStr(option.crop);
    if (!crop) return;
    setConfirming(crop);
    setError(null);
    try {
      await advisory.confirmCropPlan({
        crop,
        district: form.district || 'Nashik',
        season: result?.season || undefined,
        rationale: asStr(option.rationale),
        planDetails: option,
      });
      setNotice(`${crop} plan confirmed for ${result?.season} — tasks scheduled. Track it under My AI Plans.`);
      await loadCycles();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setConfirming(null);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600';
  const labelCls = 'block text-xs font-bold text-slate-700 mb-1';

  const DetailTile: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({
    icon: Icon,
    label,
    value,
  }) => (
    <div className="p-2.5 bg-slate-50 rounded-xl">
      <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-slate-400">
        <Icon className="w-3 h-3" /> {label}
      </span>
      <span className="block text-[11px] font-bold text-slate-800 mt-0.5">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-violet-600" />
            AI Crop Plan <span className="text-sm font-bold text-slate-500">/ पीक नियोजन</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
            Gemini-planned crop cycles for your plot
            {form.district ? ` • ${form.district}` : ''}
            <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-black uppercase">
              {seasonMeta.label}
            </span>
            <span className="text-[10px] text-slate-400">{seasonMeta.hint}</span>
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Link
            to="/farmer/crops"
            className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> My Crops
          </Link>
          <button
            onClick={loadCycles}
            disabled={loadingCycles}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loadingCycles ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400">
            <Sprout className="w-3.5 h-3.5" /> My AI Plans
          </span>
          <span className="block text-2xl font-black text-slate-900 mt-1">{aiPlans.length}</span>
          <span className="text-[10px] text-slate-500">confirmed crop cycles</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400">
            <CalendarDays className="w-3.5 h-3.5" /> Season (auto)
          </span>
          <span className="block text-2xl font-black text-violet-700 mt-1">{resolvedSeason}</span>
          <span className="text-[10px] text-slate-500">auto-detected from the calendar</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400">
            <Wallet className="w-3.5 h-3.5" /> Planned Profit
          </span>
          <span className="block text-2xl font-black text-emerald-700 mt-1">
            {formatPaisa(totalPlannedProfit)}
          </span>
          <span className="text-[10px] text-slate-500">across AI plans (indicative)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Planner form */}
        <form onSubmit={handlePlan} className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3 self-start">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" /> Plan My Season
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Soil Type</label>
              <select className={inputCls} value={form.soil} onChange={(e) => setForm((f) => ({ ...f, soil: e.target.value }))}>
                <option value="black">Black (regur)</option>
                <option value="red">Red / laterite</option>
                <option value="alluvial">Alluvial</option>
                <option value="clay">Clay</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Irrigation</label>
              <select className={inputCls} value={form.irrigation} onChange={(e) => setForm((f) => ({ ...f, irrigation: e.target.value }))}>
                <option value="drip">Drip</option>
                <option value="sprinkler">Sprinkler</option>
                <option value="flood">Flood / canal</option>
                <option value="rainfed">Rainfed</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Plot Size (acres)</label>
              <input type="number" step="0.5" min={0.5} className={inputCls} value={form.plotSizeAcres} onChange={(e) => setForm((f) => ({ ...f, plotSizeAcres: Number(e.target.value) }))} required />
            </div>
            <div>
              <label className={labelCls}>District</label>
              <input className={inputCls} value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} required />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Season</label>
              <select className={inputCls} value={form.season} onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}>
                <option value="">Auto — current ({activeSeason})</option>
                <option value="Kharif">Kharif</option>
                <option value="Rabi">Rabi</option>
                <option value="Zaid">Zaid</option>
              </select>
              {form.season === '' && (
                <p className="mt-1 text-[9px] font-bold text-emerald-700">
                  ✓ Season auto-detected — the planner uses {activeSeason} unless you override it
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Crop History (last few seasons)</label>
              <CropChipsInput
                crops={form.cropHistory}
                onChange={(crops) => setForm((f) => ({ ...f, cropHistory: crops }))}
                placeholder={form.cropHistory.length === 0 ? 'Add crops you grew recently — e.g. Onion, Tomato' : 'Add another crop…'}
              />
            </div>
          </div>
          <button type="submit" disabled={planning} className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs disabled:opacity-60 flex items-center justify-center gap-2">
            <Sparkles className={`w-4 h-4 ${planning ? 'animate-spin' : ''}`} />
            {planning ? 'Planning…' : 'Generate AI Crop Plan'}
          </button>
          <p className="text-[10px] text-slate-400 text-center">
            Planned with Gemini Flash-Lite — the fastest, cheapest model • nothing is saved until you confirm
          </p>
        </form>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          {planning ? (
            <div className="bg-white rounded-3xl p-8 border border-violet-200 shadow-xs space-y-4">
              <Sparkles
                className={`w-8 h-8 mx-auto ${planProgress >= 100 ? 'text-emerald-500' : 'text-violet-500 animate-pulse'}`}
              />
              <div className="text-center">
                <p className="text-sm font-black text-slate-900">{Math.round(planProgress)}%</p>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  {planProgress >= 100
                    ? 'Your season plan is ready! / आपकी फसल योजना तैयार है!'
                    : PLAN_MESSAGES[planMsgIdx]}
                </p>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-200 ease-out"
                  style={{ width: `${planProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                Fastest Gemini model • usually ready in under 20 seconds
              </p>
            </div>
          ) : !result ? (
            <div className="p-10 bg-slate-50 rounded-3xl border border-slate-200 text-center">
              <Sparkles className="w-8 h-8 text-violet-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">
                Tell the planner about your plot and press “Generate AI Crop Plan”.
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                You will get 2-3 detailed plans: variety, sowing window, cost, yield, profit, risks and a task checklist.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">
                  {result.options.length} plan{result.options.length === 1 ? '' : 's'} • {result.season} season
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${result.source === 'ai' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {result.source === 'ai' ? 'Gemini AI' : 'Fallback rules'}
                </span>
                {result.cached && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border bg-slate-50 text-slate-500 border-slate-200">
                    cached
                  </span>
                )}
              </div>

              {chartData.length > 0 && chartData.some((d) => d.Profit > 0 || d.Revenue > 0) && (
                <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
                  <h4 className="font-bold text-xs text-slate-700 mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" /> Cost vs Revenue vs Profit per crop (₹, your whole plot)
                  </h4>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="crop" tick={{ fontSize: 11, fill: '#475569' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={56} />
                        <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                        <Bar dataKey="Cost" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Revenue" fill="#34d399" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Profit" radius={[4, 4, 0, 0]}>
                          {chartData.map((d) => (
                            <Cell key={d.crop} fill={d.Profit >= d.Cost ? '#059669' : '#f59e0b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {result.options.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No suggestions available right now.</p>
              )}

              {result.options.map((o, i) => {
                const profit = asNum(o.expectedProfitPaisa);
                const cost = asNum(o.estimatedCostPaisa);
                const revenue = asNum(o.estimatedRevenuePaisa);
                const risks = asArray(o.risks).map((r) => asStr(r)).filter(Boolean);
                const tasks = asArray(o.tasks).map((t) => asStr(t)).filter(Boolean);
                const alreadyPlanned = aiPlans.some(
                  (p) => asStr(p.crop).toLowerCase() === asStr(o.crop).toLowerCase() && asStr(p.season) === result.season
                );
                return (
                  <div key={i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-base text-slate-900 capitalize flex items-center gap-2">
                          {asStr(o.crop, 'Crop')}
                          {alreadyPlanned && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase">
                              Planned
                            </span>
                          )}
                        </h4>
                        {asStr(o.variety) && <p className="text-[11px] text-slate-500">Variety: {asStr(o.variety)}</p>}
                      </div>
                      {profit > 0 && (
                        <div className="text-right">
                          <span className="block text-lg font-black text-emerald-700">{formatPaisa(profit)}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">est. profit</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600">{asStr(o.rationale)}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {asStr(o.sowingWindow) && <DetailTile icon={CalendarDays} label="Sowing Window" value={asStr(o.sowingWindow)} />}
                      {asNum(o.durationDays) > 0 && <DetailTile icon={RefreshCw} label="Duration" value={`~${asNum(o.durationDays)} days`} />}
                      {asStr(o.waterRequirement) && <DetailTile icon={Droplets} label="Water Need" value={asStr(o.waterRequirement)} />}
                      {asNum(o.expectedYieldQuintalPerAcre) > 0 && <DetailTile icon={Sprout} label="Yield (est.)" value={`${asNum(o.expectedYieldQuintalPerAcre)} q/acre`} />}
                      {cost > 0 && <DetailTile icon={Wallet} label="Cost (est.)" value={formatPaisa(cost)} />}
                      {revenue > 0 && <DetailTile icon={IndianRupee} label="Revenue (est.)" value={formatPaisa(revenue)} />}
                    </div>

                    {asStr(o.marketOutlook) && (
                      <p className="text-[10px] text-slate-500 flex items-start gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-sky-600 flex-shrink-0 mt-0.5" />
                        {asStr(o.marketOutlook)}
                      </p>
                    )}

                    {risks.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Key Risks
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {risks.map((risk, j) => (
                            <span key={j} className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-[10px] font-semibold">
                              {risk}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {tasks.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                          <ListChecks className="w-3.5 h-3.5 text-emerald-600" /> Season Task Checklist
                        </p>
                        <ul className="space-y-1">
                          {tasks.map((task, j) => (
                            <li key={j} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                              {task}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleConfirm(o)}
                      disabled={confirming !== null || alreadyPlanned}
                      className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {alreadyPlanned
                        ? 'Already in your plan'
                        : confirming === asStr(o.crop)
                          ? 'Confirming…'
                          : `Confirm ${asStr(o.crop)} Plan`}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* My AI Plans */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Sprout className="w-4 h-4 text-emerald-600" /> My AI Plans ({aiPlans.length})
        </h3>
        {loadingCycles ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading plans…</div>
        ) : aiPlans.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No AI plans yet — generate one above and confirm the crop you like.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiPlans.map((c, i) => {
              const cycleId = asStr(c.id ?? c.cropCycleId, String(i));
              const details = asRecord(c.planDetails);
              const hasDetails = Object.keys(details).length > 0;
              const expanded = expandedPlan === cycleId;
              return (
                <div key={cycleId} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 capitalize flex items-center gap-2">
                        {asStr(c.crop, 'Crop')}
                        <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {asStr(c.season)} season
                        {asStr(c.plannedDate) ? ` • planned ${formatDate(asStr(c.plannedDate))}` : ''}
                        {asStr(details.variety) ? ` • ${asStr(details.variety)}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={c.isIntent === true ? 'intent' : asStr(c.status, 'growing')} />
                  </div>

                  {asStr(c.rationale) && <p className="text-[11px] text-slate-600">{asStr(c.rationale)}</p>}

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Duration</span>
                      <span className="text-[11px] font-black text-slate-800">
                        {asNum(details.durationDays) > 0 ? `${asNum(details.durationDays)}d` : '—'}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Yield</span>
                      <span className="text-[11px] font-black text-slate-800">
                        {asNum(details.expectedYieldQuintalPerAcre) > 0 ? `${asNum(details.expectedYieldQuintalPerAcre)} q/ac` : '—'}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Est. Profit</span>
                      <span className="text-[11px] font-black text-emerald-700">
                        {asNum(details.expectedProfitPaisa) > 0 ? formatPaisa(asNum(details.expectedProfitPaisa)) : '—'}
                      </span>
                    </div>
                  </div>

                  {hasDetails && (
                    <button
                      type="button"
                      onClick={() => setExpandedPlan(expanded ? null : cycleId)}
                      className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-[10px] flex items-center justify-center gap-1"
                    >
                      {expanded ? (
                        <>
                          Hide plan details <ChevronUp className="w-3 h-3" />
                        </>
                      ) : (
                        <>
                          View plan details <ChevronDown className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  )}

                  {expanded && hasDetails && (
                    <div className="space-y-2 pt-1">
                      {asStr(details.sowingWindow) && (
                        <p className="text-[10px] text-slate-500">
                          <span className="font-bold">Sowing window:</span> {asStr(details.sowingWindow)}
                        </p>
                      )}
                      {asStr(details.waterRequirement) && (
                        <p className="text-[10px] text-slate-500">
                          <span className="font-bold">Water:</span> {asStr(details.waterRequirement)}
                        </p>
                      )}
                      {asNum(details.estimatedCostPaisa) > 0 && (
                        <p className="text-[10px] text-slate-500">
                          <span className="font-bold">Est. cost:</span> {formatPaisa(asNum(details.estimatedCostPaisa))}
                          {asNum(details.estimatedRevenuePaisa) > 0 && (
                            <> • <span className="font-bold">Revenue:</span> {formatPaisa(asNum(details.estimatedRevenuePaisa))}</>
                          )}
                        </p>
                      )}
                      {asArray(details.risks).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {asArray(details.risks)
                            .map((r) => asStr(r))
                            .filter(Boolean)
                            .map((risk, j) => (
                            <span key={j} className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-800 text-[9px] font-semibold">
                              {risk}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <Link
                    to="/farmer/crops"
                    className="block text-center py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px]"
                  >
                    Update stage in My Crops
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
