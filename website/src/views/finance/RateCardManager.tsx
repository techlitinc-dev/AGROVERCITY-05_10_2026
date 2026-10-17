import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, Plus, RefreshCw, Calculator } from 'lucide-react';
import { insurance, apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import { str, num, arr, fromPaisa, type Row } from './loanTypes';

const SEASONS = ['Kharif', 'Rabi', 'Annual'];
const CATEGORIES = ['crop', 'livestock', 'weather', 'equipment'];

/** Rate card manager — create and review crop premium rates (sum insured / farmer share). */
export const RateCardManager: React.FC = () => {
  const [rates, setRates] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    cropName: '',
    category: 'crop',
    season: 'Kharif',
    sumInsuredPerAcre: '',
    farmerSharePercent: '2',
    totalActuarialRatePercent: '3',
    cutoffDate: '',
  });

  // Premium quote panel — prices off the published rate table server-side.
  const [calcCrop, setCalcCrop] = useState('');
  const [calcSeason, setCalcSeason] = useState('Kharif');
  const [calcAcres, setCalcAcres] = useState('1');
  const [calcSumInsured, setCalcSumInsured] = useState('');
  const [calcResult, setCalcResult] = useState<Row | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcBusy, setCalcBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRates(arr((await insurance.rates()) as unknown) as Row[]);
    } catch (e) {
      setError(apiErrorMessage(e));
      setRates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const quotePremium = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalcBusy(true);
    setCalcError(null);
    setCalcResult(null);
    try {
      setCalcResult(
        (await insurance.premiumCalculator({
          cropName: calcCrop.trim(),
          season: calcSeason,
          landAreaAcres: Number(calcAcres),
          sumInsuredPaisa: calcSumInsured ? Math.round(Number(calcSumInsured) * 100) : undefined,
        })) as Row
      );
    } catch (err) {
      setCalcError(apiErrorMessage(err));
    } finally {
      setCalcBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await insurance.addRate({
        cropName: form.cropName.trim(),
        category: form.category,
        season: form.season,
        sumInsuredPerAcre: Number(form.sumInsuredPerAcre),
        farmerSharePercent: Number(form.farmerSharePercent),
        totalActuarialRatePercent: Number(form.totalActuarialRatePercent),
        cutoffDate: form.cutoffDate,
      });
      setNotice(`Rate card for ${form.cropName} (${form.season}) published.`);
      setForm((f) => ({ ...f, cropName: '', sumInsuredPerAcre: '' }));
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <Link to="/insuranceProvider" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to claims desk
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Scale className="w-7 h-7 text-emerald-600" />
          Premium Rate Card Manager
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Publish crop × season actuarial rates — sum insured per acre and the PMFBY premium split
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 h-fit">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" /> New Rate Card
            </h3>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Crop
              <input value={form.cropName} onChange={set('cropName')} required placeholder="e.g. Cotton"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Category
                <select value={form.category} onChange={set('category')}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Season
                <select value={form.season} onChange={set('season')}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
                  {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Sum Insured / Acre ₹
              <input value={form.sumInsuredPerAcre} onChange={set('sumInsuredPerAcre')} type="number" min="1" required
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Farmer Share %
                <input value={form.farmerSharePercent} onChange={set('farmerSharePercent')} type="number" min="0" max="100" step="0.1" required
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Actuarial Rate %
                <input value={form.totalActuarialRatePercent} onChange={set('totalActuarialRatePercent')} type="number" min="0" max="100" step="0.1" required
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
            </div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Enrolment Cutoff
              <input value={form.cutoffDate} onChange={set('cutoffDate')} type="date" required
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <button type="submit" disabled={busy}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
              {busy ? 'Publishing…' : 'Publish Rate Card'}
            </button>
          </form>

          <form onSubmit={quotePremium} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 h-fit">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600" /> Premium Quote
            </h3>
            <p className="text-[11px] text-slate-500">
              Prices off the published rate table — same math farmers see on the quote screen.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Crop
                <input value={calcCrop} onChange={(e) => setCalcCrop(e.target.value)} required list="rate-crops" placeholder="e.g. Grapes"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Season
                <select value={calcSeason} onChange={(e) => setCalcSeason(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
                  {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Land Area (acres)
              <input value={calcAcres} onChange={(e) => setCalcAcres(e.target.value)} type="number" min="0.1" step="0.1" required
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Sum Insured ₹ (blank = rate card × acres)
              <input value={calcSumInsured} onChange={(e) => setCalcSumInsured(e.target.value)} type="number" min="0"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <datalist id="rate-crops">
              {rates.map((r) => <option key={str(r.id ?? `${r.cropName}-${r.season}`)} value={str(r.cropName)} />)}
            </datalist>
            <button type="submit" disabled={calcBusy || !calcCrop.trim()}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
              {calcBusy ? 'Quoting…' : 'Quote Premium'}
            </button>
            {calcError && <p className="text-[11px] font-semibold text-rose-600">{calcError}</p>}
            {calcResult && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-emerald-50 rounded-xl p-2.5">
                    <span className="text-[9px] font-bold uppercase text-emerald-600">Farmer Premium</span>
                    <div className="text-sm font-black text-emerald-800">{formatCurrency(fromPaisa(num(calcResult.farmerPremiumPaisa)))}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5">
                    <span className="text-[9px] font-bold uppercase text-slate-500">Govt Subsidy</span>
                    <div className="text-sm font-black text-slate-800">{formatCurrency(fromPaisa(num(calcResult.govtSubsidyPaisa)))}</div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 text-center">
                  Sum insured {formatCurrency(fromPaisa(num(calcResult.sumInsuredPaisa)))} · farmer share{' '}
                  {num(calcResult.farmerSharePercent)}% of {num(calcResult.totalActuarialRatePercent)}% actuarial
                </p>
              </div>
            )}
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Published Rates ({rates.length})</h3>
            <button onClick={load} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-4">Crop</th>
                  <th className="py-3 px-4">Season</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Sum Insured / Acre</th>
                  <th className="py-3 px-4">Farmer Share</th>
                  <th className="py-3 px-4">Actuarial Rate</th>
                  <th className="py-3 px-4">Cutoff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rates.map((r) => (
                  <tr key={str(r.id ?? `${r.cropName}-${r.season}`)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-bold text-slate-900">{str(r.cropName)}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{str(r.season)}</td>
                    <td className="py-3 px-4 capitalize text-slate-600">{str(r.category)}</td>
                    <td className="py-3 px-4 font-black text-slate-900">{formatCurrency(num(r.sumInsuredPerAcre))}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-700">{num(r.farmerSharePercent)}%</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{num(r.totalActuarialRatePercent)}%</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(str(r.cutoffDate))}</td>
                  </tr>
                ))}
                {rates.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">
                      No rate cards published yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
