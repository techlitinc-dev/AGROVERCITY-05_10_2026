import React, { useEffect, useMemo, useState } from 'react';
import {
  Sprout,
  FlaskConical,
  Radar,
  TestTube2,
  Plus,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { advisory, farmerCrops, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDate } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

const GROWTH_STAGES = ['land_prep', 'sowing', 'germination', 'vegetative', 'flowering', 'harvest'];

const STAGE_LABELS: Record<string, string> = {
  land_prep: 'Land Preparation / जमीन तयारी',
  sowing: 'Sowing / पेरणी',
  germination: 'Germination / अंकुरण',
  vegetative: 'Vegetative / वाढ',
  flowering: 'Flowering / फुलकळा',
  harvest: 'Harvest / काढणी',
};

const stageIndex = (stage: string): number => {
  const idx = GROWTH_STAGES.indexOf(stage);
  return idx >= 0 ? idx : 1;
};

type Tab = 'crops' | 'npk' | 'pest' | 'soil';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'crops', label: 'My Crop Cycles / माझी पिके', icon: Sprout },
  { key: 'npk', label: 'NPK Calculator', icon: FlaskConical },
  { key: 'pest', label: 'Pest Radar (5 km)', icon: Radar },
  { key: 'soil', label: 'Soil Tests / माती चाचणी', icon: TestTube2 },
];

export const MyCropsView: React.FC = () => {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('crops');
  const [cycles, setCycles] = useState<unknown[]>([]);
  const [soilTests, setSoilTests] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Add-crop modal (two flows: quick sowing intent / AI crop plan)
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'intent' | 'plan'>('intent');
  const [intentForm, setIntentForm] = useState({
    crop: 'Soybean',
    plannedDate: new Date().toISOString().slice(0, 10),
  });
  const [planForm, setPlanForm] = useState({
    soil: 'black',
    irrigation: 'drip',
    plotSizeAcres: 2,
    cropHistory: '',
    season: '',
  });
  const [planOptions, setPlanOptions] = useState<unknown[] | null>(null);
  const [savingCrop, setSavingCrop] = useState(false);

  // Stage update modal
  const [stageCycle, setStageCycle] = useState<Record<string, unknown> | null>(null);
  const [stageForm, setStageForm] = useState({ stage: 'sowing', status: 'growing', notes: '' });
  const [savingStage, setSavingStage] = useState(false);

  // NPK calculator
  const [npkForm, setNpkForm] = useState({ n: 40, p: 20, k: 10, crop: 'wheat', soilType: 'black' });
  const [npkResult, setNpkResult] = useState<Record<string, unknown> | null>(null);
  const [npkBusy, setNpkBusy] = useState(false);

  // Pest radar
  const [pestAlerts, setPestAlerts] = useState<unknown[] | null>(null);
  const [pestBusy, setPestBusy] = useState(false);

  // Soil test booking
  const [soilForm, setSoilForm] = useState({
    address: '',
    slotDate: new Date().toISOString().slice(0, 10),
    slotHalf: 'am' as 'am' | 'pm',
  });
  const [bookingSoil, setBookingSoil] = useState(false);

  const farmerDistrict = asStr(user?.district);
  const [radarLat, setRadarLat] = useState<number | ''>('');
  const [radarLng, setRadarLng] = useState<number | ''>('');

  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRadarLat(Number(pos.coords.latitude.toFixed(5)));
        setRadarLng(Number(pos.coords.longitude.toFixed(5)));
      },
      () => undefined
    );
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, s] = await Promise.all([
        farmerCrops.list().catch(() => []),
        advisory.soilTests().catch(() => []),
      ]);
      setCycles(c);
      setSoilTests(s);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSeason = useMemo(() => {
    const month = new Date().getMonth() + 1;
    return month >= 6 && month <= 10 ? 'Kharif' : 'Rabi';
  }, []);

  // ---- add crop ----
  const handleSowingIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCrop(true);
    setError(null);
    try {
      await advisory.sowingIntent({ crop: intentForm.crop, plannedDate: intentForm.plannedDate });
      setAddModalOpen(false);
      setNotice(`${intentForm.crop} sowing intent recorded for ${intentForm.plannedDate}.`);
      setCycles(await farmerCrops.list());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingCrop(false);
    }
  };

  const handleCropPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCrop(true);
    setError(null);
    try {
      const res = asRecord(
        await advisory.cropPlan({
          soil: planForm.soil,
          irrigation: planForm.irrigation,
          plotSizeAcres: planForm.plotSizeAcres,
          cropHistory: planForm.cropHistory
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          district: farmerDistrict || 'Nashik',
          season: planForm.season || undefined,
        })
      );
      setPlanOptions(asArray(res.options));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingCrop(false);
    }
  };

  const handleConfirmPlan = async (option: Record<string, unknown>) => {
    const crop = asStr(option.crop);
    if (!crop) return;
    setSavingCrop(true);
    setError(null);
    try {
      await advisory.confirmCropPlan({
        crop,
        district: farmerDistrict || 'Nashik',
        season: planForm.season || undefined,
        rationale: asStr(option.rationale),
      });
      setAddModalOpen(false);
      setPlanOptions(null);
      setNotice(`${crop} plan confirmed — tasks have been scheduled.`);
      setCycles(await farmerCrops.list());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingCrop(false);
    }
  };

  // ---- stage update ----
  const openStageModal = (cycle: Record<string, unknown>) => {
    setStageCycle(cycle);
    setStageForm({
      stage: asStr(cycle.stage, 'sowing'),
      status: asStr(cycle.status, 'growing'),
      notes: asStr(cycle.notes),
    });
  };

  const handleStageSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageCycle) return;
    const cycleId = asStr(stageCycle.id ?? stageCycle.cropCycleId);
    if (!cycleId) return;
    setSavingStage(true);
    setError(null);
    try {
      await farmerCrops.update(cycleId, { ...stageForm, notes: stageForm.notes || undefined });
      setStageCycle(null);
      setNotice('Crop cycle updated.');
      setCycles(await farmerCrops.list());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingStage(false);
    }
  };

  // ---- NPK ----
  const handleNpk = async (e: React.FormEvent) => {
    e.preventDefault();
    setNpkBusy(true);
    setError(null);
    try {
      setNpkResult(asRecord(await advisory.npkAdvice(npkForm)));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setNpkBusy(false);
    }
  };

  // ---- pest radar ----
  const handlePestRadar = async () => {
    if (radarLat === '' || radarLng === '') {
      setError('Set your farm coordinates first — use "My location" or type them in.');
      return;
    }
    setPestBusy(true);
    setError(null);
    try {
      const res = asRecord(await advisory.pestRadar({ lat: radarLat, lng: radarLng }));
      setPestAlerts(asArray(res.data ?? res.alerts));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPestBusy(false);
    }
  };

  // ---- soil test ----
  const handleSoilBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingSoil(true);
    setError(null);
    try {
      await advisory.bookSoilTest({
        address: soilForm.address,
        slot: `${soilForm.slotDate} ${soilForm.slotHalf}`,
      });
      setNotice(`Soil test booked for ${soilForm.slotDate} (${soilForm.slotHalf === 'am' ? 'morning' : 'afternoon'}).`);
      setSoilTests(await advisory.soilTests());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBookingSoil(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600';
  const labelCls = 'block text-xs font-bold text-slate-700 mb-1';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sprout className="w-7 h-7 text-emerald-600" />
            My Crops & Agronomy Tools <span className="text-sm font-bold text-slate-500">/ माझी पिके</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Crop cycles, sowing plans, fertiliser math, pest alerts and soil health — {activeSeason} season
            {farmerDistrict ? ` • ${farmerDistrict}` : ''}
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setAddModalOpen(true);
              setPlanOptions(null);
            }}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Crop
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
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="flex bg-slate-100 p-1 rounded-2xl self-start w-fit max-w-full overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              tab === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading crop cycles…</div>
      ) : tab === 'crops' ? (
        <div className="space-y-4">
          {cycles.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              No crop cycles yet — record a sowing intent or generate an AI crop plan to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cycles.map((raw, i) => {
                const c = asRecord(raw);
                const cycleId = asStr(c.id ?? c.cropCycleId, String(i));
                const stage = asStr(c.stage, 'sowing');
                const progress = Math.round(((stageIndex(stage) + 1) / GROWTH_STAGES.length) * 100);
                return (
                  <div key={cycleId} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 capitalize">{asStr(c.crop, 'Crop')}</h4>
                        <p className="text-[11px] text-slate-500">
                          {asStr(c.season, activeSeason)} season
                          {asStr(c.plannedDate) ? ` • planned ${formatDate(asStr(c.plannedDate))}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={c.isIntent === true ? 'intent' : asStr(c.status, 'growing')} />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>{STAGE_LABELS[stage] ?? stage}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    {asStr(c.notes) && <p className="text-[11px] text-slate-600">{asStr(c.notes)}</p>}
                    <button
                      onClick={() => openStageModal(c)}
                      className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] flex items-center justify-center gap-1"
                    >
                      Update Stage <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : tab === 'npk' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form onSubmit={handleNpk} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-600" /> Fertiliser Recommendation (NPK)
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>N (kg/ha)</label>
                <input type="number" className={inputCls} value={npkForm.n} onChange={(e) => setNpkForm((f) => ({ ...f, n: Number(e.target.value) }))} />
              </div>
              <div>
                <label className={labelCls}>P (kg/ha)</label>
                <input type="number" className={inputCls} value={npkForm.p} onChange={(e) => setNpkForm((f) => ({ ...f, p: Number(e.target.value) }))} />
              </div>
              <div>
                <label className={labelCls}>K (kg/ha)</label>
                <input type="number" className={inputCls} value={npkForm.k} onChange={(e) => setNpkForm((f) => ({ ...f, k: Number(e.target.value) }))} />
              </div>
              <div>
                <label className={labelCls}>Crop</label>
                <select className={inputCls} value={npkForm.crop} onChange={(e) => setNpkForm((f) => ({ ...f, crop: e.target.value }))}>
                  <option value="wheat">Wheat</option>
                  <option value="onion">Onion</option>
                  <option value="soybean">Soybean</option>
                  <option value="cotton">Cotton</option>
                  <option value="tomato">Tomato</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Soil Type</label>
                <select className={inputCls} value={npkForm.soilType} onChange={(e) => setNpkForm((f) => ({ ...f, soilType: e.target.value }))}>
                  <option value="black">Black (regur)</option>
                  <option value="red">Red / laterite</option>
                  <option value="alluvial">Alluvial</option>
                  <option value="clay">Clay</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={npkBusy} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
              {npkBusy ? 'Calculating…' : 'Calculate Dose'}
            </button>
          </form>
          <div className="space-y-3">
            {npkResult ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="font-bold text-sm text-slate-900">Per-Acre Recommendation</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Urea</span>
                    <span className="text-lg font-black text-slate-900">{asNum(npkResult.ureaKgPerAcre)} kg</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">DAP</span>
                    <span className="text-lg font-black text-slate-900">{asNum(npkResult.dapKgPerAcre)} kg</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">MOP</span>
                    <span className="text-lg font-black text-slate-900">{asNum(npkResult.mopKgPerAcre)} kg</span>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {asArray(npkResult.recommendations).map((r, i) => (
                    <li key={i} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      {asStr(r)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 text-xs text-slate-500 text-center">
                Enter your soil-test NPK values to get the urea/DAP/MOP dose per acre.
              </div>
            )}
          </div>
        </div>
      ) : tab === 'pest' ? (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Radar className="w-4 h-4 text-emerald-600" /> Pest & Disease Radar — 5 km around your farm
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <input
                  type="number"
                  step="0.00001"
                  placeholder="Lat"
                  value={radarLat}
                  onChange={(e) => setRadarLat(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-mono"
                />
                <input
                  type="number"
                  step="0.00001"
                  placeholder="Lng"
                  value={radarLng}
                  onChange={(e) => setRadarLng(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-mono"
                />
                <button
                  type="button"
                  onClick={locateMe}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-[10px]"
                >
                  My location
                </button>
              </div>
            </div>
            <button
              onClick={handlePestRadar}
              disabled={pestBusy}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60 self-start sm:self-auto"
            >
              {pestBusy ? 'Scanning…' : 'Scan Now'}
            </button>
          </div>
          {pestAlerts === null ? (
            <p className="text-xs text-slate-400 text-center py-6">Run the radar to see nearby pest reports from fellow farmers.</p>
          ) : pestAlerts.length === 0 ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> No pest or disease reports within 5 km — crops look safe today.
            </div>
          ) : (
            <div className="space-y-2">
              {pestAlerts.map((raw, i) => {
                const a = asRecord(raw);
                const risk = asStr(a.riskLevel, 'green');
                return (
                  <div key={i} className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{asStr(a.disease ?? a.pest, 'Pest report')}</p>
                      <p className="text-[10px] text-slate-500">
                        {asStr(a.crop)} • {asNum(a.distanceKm).toFixed(1)} km away • reported {formatDate(asStr(a.reportedAt))}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        risk === 'red'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : risk === 'yellow'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {risk}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form onSubmit={handleSoilBook} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <TestTube2 className="w-4 h-4 text-emerald-600" /> Book a Soil Test
            </h3>
            <div>
              <label className={labelCls}>Collection Address *</label>
              <textarea
                rows={2}
                className={inputCls}
                value={soilForm.address}
                onChange={(e) => setSoilForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Gat No. 312, Pimpalgaon Baswant, Nashik"
                required
                minLength={10}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" className={inputCls} value={soilForm.slotDate} onChange={(e) => setSoilForm((f) => ({ ...f, slotDate: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Slot</label>
                <select className={inputCls} value={soilForm.slotHalf} onChange={(e) => setSoilForm((f) => ({ ...f, slotHalf: e.target.value as 'am' | 'pm' }))}>
                  <option value="am">Morning (AM)</option>
                  <option value="pm">Afternoon (PM)</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={bookingSoil} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
              {bookingSoil ? 'Booking…' : 'Book Collection Visit'}
            </button>
          </form>
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900">My Soil Tests ({soilTests.length})</h3>
            {soilTests.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No soil tests booked yet.</p>
            ) : (
              soilTests.map((raw, i) => {
                const t = asRecord(raw);
                return (
                  <div key={asStr(t.id, String(i))} className="p-3.5 bg-slate-50 rounded-2xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{formatDate(asStr(t.bookedAt ?? t.slot))}</p>
                      <p className="text-[10px] text-slate-500">{asStr(t.address)}</p>
                      {t.resultPdfUrl ? (
                        <a href={asStr(t.resultPdfUrl)} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-emerald-700 hover:underline">
                          Download report PDF
                        </a>
                      ) : null}
                    </div>
                    <StatusBadge status={asStr(t.status, 'booked')} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Add-crop modal: quick intent or AI plan */}
      <ModalSheet
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setPlanOptions(null);
        }}
        title="Add Crop Cycle"
        description="Record a sowing intent or let the AI planner suggest crops for your plot"
        maxWidth="md"
      >
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mb-4">
          <button
            type="button"
            onClick={() => {
              setAddMode('intent');
              setPlanOptions(null);
            }}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold ${addMode === 'intent' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
          >
            Quick Sowing Intent
          </button>
          <button
            type="button"
            onClick={() => setAddMode('plan')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold ${addMode === 'plan' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
          >
            AI Crop Plan
          </button>
        </div>

        {addMode === 'intent' ? (
          <form onSubmit={handleSowingIntent} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Crop</label>
                <select className={inputCls} value={intentForm.crop} onChange={(e) => setIntentForm((f) => ({ ...f, crop: e.target.value }))}>
                  <option value="Soybean">Soybean (सोयाबीन)</option>
                  <option value="Wheat">Wheat (गहू)</option>
                  <option value="Onion">Onion (कांदा)</option>
                  <option value="Cotton">Cotton (कापूस)</option>
                  <option value="Tomato">Tomato (टमाटर)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Planned Sowing Date</label>
                <input type="date" className={inputCls} value={intentForm.plannedDate} onChange={(e) => setIntentForm((f) => ({ ...f, plannedDate: e.target.value }))} required />
              </div>
            </div>
            <button type="submit" disabled={savingCrop} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
              {savingCrop ? 'Recording…' : 'Record Sowing Intent'}
            </button>
          </form>
        ) : planOptions === null ? (
          <form onSubmit={handleCropPlan} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Soil Type</label>
                <select className={inputCls} value={planForm.soil} onChange={(e) => setPlanForm((f) => ({ ...f, soil: e.target.value }))}>
                  <option value="black">Black (regur)</option>
                  <option value="red">Red / laterite</option>
                  <option value="alluvial">Alluvial</option>
                  <option value="clay">Clay</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Irrigation</label>
                <select className={inputCls} value={planForm.irrigation} onChange={(e) => setPlanForm((f) => ({ ...f, irrigation: e.target.value }))}>
                  <option value="drip">Drip</option>
                  <option value="sprinkler">Sprinkler</option>
                  <option value="flood">Flood / canal</option>
                  <option value="rainfed">Rainfed</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Plot Size (acres)</label>
                <input type="number" step="0.5" min={0.5} className={inputCls} value={planForm.plotSizeAcres} onChange={(e) => setPlanForm((f) => ({ ...f, plotSizeAcres: Number(e.target.value) }))} required />
              </div>
              <div>
                <label className={labelCls}>Season</label>
                <select className={inputCls} value={planForm.season} onChange={(e) => setPlanForm((f) => ({ ...f, season: e.target.value }))}>
                  <option value="">Current ({activeSeason})</option>
                  <option value="Kharif">Kharif</option>
                  <option value="Rabi">Rabi</option>
                  <option value="Zaid">Zaid</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Crop History (comma separated)</label>
                <input className={inputCls} value={planForm.cropHistory} onChange={(e) => setPlanForm((f) => ({ ...f, cropHistory: e.target.value }))} placeholder="e.g. Wheat, Chickpea" />
              </div>
            </div>
            <button type="submit" disabled={savingCrop} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
              {savingCrop ? 'Planning…' : 'Suggest Crops'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            {planOptions.length === 0 && <p className="text-xs text-slate-400">No suggestions available right now.</p>}
            {planOptions.map((raw, i) => {
              const o = asRecord(raw);
              return (
                <div key={i} className="p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900 capitalize">{asStr(o.crop, 'Crop')}</h4>
                    {asNum(o.estimatedRevenuePaisa) > 0 && (
                      <span className="text-[11px] font-black text-emerald-700">
                        ~₹{Math.round(asNum(o.estimatedRevenuePaisa) / 100).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600">{asStr(o.rationale)}</p>
                  <button
                    type="button"
                    onClick={() => handleConfirmPlan(o)}
                    disabled={savingCrop}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] disabled:opacity-60"
                  >
                    {savingCrop ? 'Confirming…' : 'Confirm This Plan'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </ModalSheet>

      {/* Stage update modal */}
      <ModalSheet
        isOpen={Boolean(stageCycle)}
        onClose={() => setStageCycle(null)}
        title={`Update ${asStr(stageCycle?.crop, 'Crop')} — ${asStr(stageCycle?.season, '')}`}
        description="Track the growth stage and add field notes"
        maxWidth="sm"
      >
        <form onSubmit={handleStageSave} className="space-y-3">
          <div>
            <label className={labelCls}>Growth Stage</label>
            <select className={inputCls} value={stageForm.stage} onChange={(e) => setStageForm((f) => ({ ...f, stage: e.target.value }))}>
              {GROWTH_STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s] ?? s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={stageForm.status} onChange={(e) => setStageForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="growing">Growing</option>
              <option value="planned">Planned</option>
              <option value="harvested">Harvested</option>
              <option value="failed">Crop Failed</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={2} className={inputCls} value={stageForm.notes} onChange={(e) => setStageForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Irrigation, fertiliser, observations…" />
          </div>
          <button type="submit" disabled={savingStage} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            {savingStage ? 'Saving…' : 'Save Update'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
