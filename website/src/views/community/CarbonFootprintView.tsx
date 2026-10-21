import React, { useEffect, useState } from 'react';
import {
  Leaf,
  Calculator,
  TreePine,
  Sprout,
  StickyNote,
  Plus,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { advisory, apiErrorMessage, tree } from '../../lib/api';
import { cn, formatDateTime, formatNumber, formatPaisa } from '../../lib/utils';
import { asRecord, asRecords, pickNum, pickStr, type Rec } from '../shared/records';

const ECO_TIPS = [
  'One mature neem or teak on a farm bund can soak up 20–35 kg of CO₂ every year — boundary planting is the cheapest carbon farm you own.',
  'Drip irrigation cuts diesel-pump run time; every litre of diesel saved keeps ~2.7 kg of CO₂ out of the air.',
  'Mulching and zero-burn residue management protect soil carbon — burning one tonne of stubble releases nearly 1.5 tonnes of CO₂.',
  'Agroforestry rows lower field temperature and wind stress, which quietly reduces crop water demand in the summer months.',
  'Carbon credits are paid only on verified, surviving trees — log growth every season to keep your MRV record clean.',
];

const inr = (rupees: number): string => formatPaisa(Math.round(rupees) * 100);

const inputCls =
  'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

/** /community/carbon — carbon footprint, tree sequestration and eco impact. */
export const CarbonFootprintView: React.FC = () => {
  const [potential, setPotential] = useState<Rec | null>(null);
  const [potentialErr, setPotentialErr] = useState<string | null>(null);
  const [potentialLoading, setPotentialLoading] = useState(true);

  const [species, setSpecies] = useState('');
  const [count, setCount] = useState('25');
  const [ageYears, setAgeYears] = useState('1');
  const [estimate, setEstimate] = useState<Rec | null>(null);
  const [estimateBusy, setEstimateBusy] = useState(false);
  const [estimateErr, setEstimateErr] = useState<string | null>(null);

  const [plantations, setPlantations] = useState<Rec[]>([]);
  const [plantationsErr, setPlantationsErr] = useState<string | null>(null);
  const [plantationsLoading, setPlantationsLoading] = useState(true);

  const [regSpecies, setRegSpecies] = useState('');
  const [regCount, setRegCount] = useState('25');
  const [regParcel, setRegParcel] = useState('');
  const [regBusy, setRegBusy] = useState(false);

  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setPotentialLoading(true);
      setPlantationsLoading(true);
      const [p, pl] = await Promise.all([
        advisory.carbonPotential().then(asRecord).catch((e: unknown) => e),
        tree.myPlantations().catch(() => [] as unknown[]),
      ]);
      if (!alive) return;
      if (p instanceof Error) {
        setPotentialErr(apiErrorMessage(p));
        setPotential(null);
      } else {
        setPotentialErr(null);
        const rec = asRecord(p);
        setPotential(Object.keys(rec).length > 0 ? rec : null);
      }
      setPotentialLoading(false);
      setPlantations(asRecords(pl));
      setPlantationsLoading(false);
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const handleEstimate = async () => {
    if (estimateBusy) return;
    setEstimateBusy(true);
    setEstimateErr(null);
    try {
      const res = await tree.estimateCarbon({
        treeSpecies: species.trim(),
        treeCount: Number(count) || 0,
        ageYears: Number(ageYears) || 1,
      });
      setEstimate(asRecord(res));
    } catch (err) {
      setEstimateErr(apiErrorMessage(err));
    } finally {
      setEstimateBusy(false);
    }
  };

  const refreshPlantations = async () => {
    const rows = await tree.myPlantations().catch(() => [] as unknown[]);
    setPlantations(asRecords(rows));
  };

  const handleRegister = async () => {
    if (regBusy) return;
    setRegBusy(true);
    try {
      await tree.registerPlantation({
        parcelName: regParcel.trim() || 'Home farm',
        treeSpecies: regSpecies.trim(),
        treeCount: Number(regCount) || 1,
        plantingDate: new Date().toISOString().slice(0, 10),
        landType: 'bund',
        latitude: 0,
        longitude: 0,
      });
      flash('ok', `${regSpecies.trim()} plantation registered — it now counts toward your carbon ledger.`);
      setRegSpecies('');
      await refreshPlantations();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setRegBusy(false);
    }
  };

  const handleAddNote = async (plantation: Rec) => {
    const plId = pickStr(plantation, 'id');
    if (!plId || noteBusy || !noteText.trim()) return;
    setNoteBusy(true);
    try {
      await tree.addPlantationLog(plId, {
        notes: noteText.trim(),
        heightCm: pickNum(plantation, 'currentAvgHeightCm') || 30,
        survivalCount: pickNum(plantation, 'treeCount'),
        healthStatus: 'healthy',
      });
      flash('ok', 'Note added to the plantation log.');
      setNoteFor(null);
      setNoteText('');
      await refreshPlantations();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setNoteBusy(false);
    }
  };

  const totalCo2 = plantations.reduce((sum, p) => sum + pickNum(p, 'estimatedCo2KgPerYear'), 0);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Leaf className="w-7 h-7 text-emerald-600" />
          Carbon Footprint & Eco Impact
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Estimate your farm's carbon potential, calculate tree sequestration, and track every plantation you grow
        </p>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* My Carbon Potential */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-600" /> My Carbon Potential
        </h3>
        {potentialLoading ? (
          <p className="text-xs text-slate-400 py-4 text-center">Loading your carbon potential…</p>
        ) : potentialErr ? (
          <p className="text-xs text-slate-500 py-2">
            {potentialErr} — this estimate needs a farmer profile, so it may stay hidden for other roles.
          </p>
        ) : potential ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                <p className="text-[10px] font-bold uppercase text-emerald-700">CO₂e potential</p>
                <p className="text-lg font-extrabold text-emerald-900">
                  {formatNumber(pickNum(potential, 'co2eTonnes'))} t/yr
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                <p className="text-[10px] font-bold uppercase text-amber-700">Income potential</p>
                <p className="text-lg font-extrabold text-amber-900">
                  {inr(pickNum(potential, 'annualIncomePotential'))}/yr
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-sky-50 border border-sky-100">
                <p className="text-[10px] font-bold uppercase text-sky-700">From my trees</p>
                <p className="text-lg font-extrabold text-sky-900">
                  {formatNumber(pickNum(potential, 'plantation_estimate'))} t/yr
                </p>
              </div>
            </div>
            {asRecords(pickPractices(potential)).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {asRecords(pickPractices(potential)).map((pr, i) => (
                  <span
                    key={pickStr(pr, 'id') || pickStr(pr, 'practice') || i}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200"
                  >
                    {pickStr(pr, 'practice', 'name', 'title') || `Practice ${i + 1}`}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              Estimate only — not verified carbon credits. Payment starts after partner MRV verification.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-2">No carbon data available yet.</p>
        )}
      </div>

      {/* Tree Sequestration Estimator */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Calculator className="w-4 h-4 text-emerald-600" /> Tree Sequestration Estimator
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tree species</label>
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="e.g. Teak, Neem, Bamboo"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Number of trees</label>
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Age (years)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={ageYears}
              onChange={(e) => setAgeYears(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <button
          onClick={() => void handleEstimate()}
          disabled={estimateBusy || !species.trim()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
        >
          {estimateBusy ? 'Estimating…' : 'Estimate CO₂'}
        </button>
        {estimateErr && <p className="text-xs text-rose-600">{estimateErr}</p>}
        {estimate && Object.keys(estimate).length > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-emerald-700">Per tree / yr</p>
                <p className="text-base font-extrabold text-emerald-900">
                  {formatNumber(pickNum(estimate, 'co2PerTreePerYearKg'))} kg
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-emerald-700">CO₂ / yr</p>
                <p className="text-base font-extrabold text-emerald-900">
                  {formatNumber(pickNum(estimate, 'annualCo2Kg'))} kg
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-emerald-700">10-yr CO₂</p>
                <p className="text-base font-extrabold text-emerald-900">
                  {formatNumber(pickNum(estimate, 'tenYearCo2Kg'))} kg
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-emerald-700">10-yr credits</p>
                <p className="text-base font-extrabold text-emerald-900">
                  {formatNumber(pickNum(estimate, 'carbonCredits10Yr'))}
                </p>
              </div>
            </div>
            <p className="text-xs text-emerald-800">
              Estimated earnings: <span className="font-extrabold">{inr(pickNum(estimate, 'estimatedEarningsInr'))}</span> over 10
              years
            </p>
            {pickStr(estimate, 'formulaExplanation') && (
              <p className="text-[11px] text-emerald-700">{pickStr(estimate, 'formulaExplanation')}</p>
            )}
          </div>
        )}
      </div>

      {/* My Plantations */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <TreePine className="w-4 h-4 text-emerald-600" /> My Plantations
            {plantations.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {formatNumber(totalCo2)} kg CO₂/yr total
              </span>
            )}
          </h3>
        </div>

        {plantationsLoading ? (
          <p className="text-xs text-slate-400 py-4 text-center">Loading your plantations…</p>
        ) : (
          <div className="space-y-2.5">
            {plantations.length === 0 && !plantationsErr && (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 p-4 text-center">
                No plantations yet — register your first below and start your carbon ledger.
              </p>
            )}
            {plantationsErr && <p className="text-xs text-rose-600">{plantationsErr}</p>}
            {plantations.map((p, i) => {
              const plId = pickStr(p, 'id') || `pl-${i}`;
              const isNoteOpen = noteFor === plId;
              return (
                <div key={plId} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-xs truncate">
                        {pickStr(p, 'treeSpecies', 'vernacularSpecies') || 'Plantation'} ×{' '}
                        {formatNumber(pickNum(p, 'treeCount'))}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {pickStr(p, 'parcelName') || 'Farm parcel'} · planted{' '}
                        {formatDateTime(pickStr(p, 'plantingDate')) || '—'} · {formatNumber(pickNum(p, 'logsCount'))} logs
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold uppercase text-emerald-700">CO₂/yr</p>
                      <p className="text-sm font-extrabold text-emerald-900">
                        {formatNumber(pickNum(p, 'estimatedCo2KgPerYear'))} kg
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setNoteFor(isNoteOpen ? null : plId);
                        setNoteText('');
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 text-[11px] font-bold flex items-center gap-1"
                    >
                      <StickyNote className="w-3.5 h-3.5" /> Add note
                    </button>
                    <span className="text-[11px] text-slate-400">
                      Survival {pickNum(p, 'survivalRate')}%
                    </span>
                  </div>
                  {isNoteOpen && (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={2}
                        placeholder="e.g. Fenced the bund, all saplings healthy after monsoon…"
                        className={cn(inputCls, 'resize-none')}
                      />
                      <button
                        onClick={() => void handleAddNote(p)}
                        disabled={noteBusy || !noteText.trim()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                      >
                        {noteBusy ? 'Saving…' : 'Save note'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Register mini-form */}
        <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-4 space-y-3">
          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <Sprout className="w-4 h-4 text-emerald-600" /> Register a plantation
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={regSpecies}
              onChange={(e) => setRegSpecies(e.target.value)}
              placeholder="Species (e.g. Bamboo)"
              className={inputCls}
            />
            <input
              type="number"
              min={1}
              value={regCount}
              onChange={(e) => setRegCount(e.target.value)}
              placeholder="Tree count"
              className={inputCls}
            />
            <input
              type="text"
              value={regParcel}
              onChange={(e) => setRegParcel(e.target.value)}
              placeholder="Parcel name (optional)"
              className={inputCls}
            />
          </div>
          <button
            onClick={() => void handleRegister()}
            disabled={regBusy || regSpecies.trim().length < 2}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {regBusy ? 'Registering…' : 'Register plantation'}
          </button>
        </div>
      </div>

      {/* Eco tips */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-amber-500" /> Eco Tips for the Farm
        </h3>
        <ul className="space-y-2">
          {ECO_TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
              <Leaf className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/** Practices arrive as a list of strings (current API) — tolerate object rows too. */
function pickPractices(potential: Rec): unknown {
  const raw = potential['practices'];
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) =>
    typeof item === 'string' ? { id: `practice-${i}`, practice: item } : item
  );
}
