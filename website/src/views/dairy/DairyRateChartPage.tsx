import React, { useEffect, useState } from 'react';
import { Award, Plus, History, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDate } from '../../lib/utils';
import { dairyExtras } from './managerApi';
import { asRec, boolOf, numOf, recArr, strOf, todayStr } from './helpers';

const EMPTY_CHART = {
  species: 'cow',
  effectiveFrom: todayStr(),
  baseRate: 35,
  fatBase: 3.5,
  snfBase: 8.5,
  fatStep: 1,
  snfStep: 1,
  minRate: 28,
  minFat: 3,
  minSnf: 8,
  active: true,
};

export const DairyRateChartPage: React.FC = () => {
  const [species, setSpecies] = useState<'cow' | 'buffalo'>('cow');
  const [chart, setChart] = useState<Record<string, unknown> | null>(null);
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(EMPTY_CHART);
  const [saving, setSaving] = useState(false);

  const reload = async (sp: 'cow' | 'buffalo' = species) => {
    setLoading(true);
    setError(null);
    try {
      const [c, v] = await Promise.all([
        dairyExtras.activeRateChart(sp).catch(() => null),
        dairyExtras.rateChartVersions(sp).catch(() => []),
      ]);
      setChart(c ? asRec(c) : null);
      setVersions(recArr(v));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload(species);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_CHART, species });
    setModalOpen(true);
  };

  const openEdit = (c: Record<string, unknown>) => {
    setEditing(c);
    setForm({
      species: strOf(c.species, 'cow') || 'cow',
      effectiveFrom: strOf(c.effectiveFrom, todayStr()) || todayStr(),
      baseRate: numOf(c.baseRate, 35),
      fatBase: numOf(c.fatBase, 3.5),
      snfBase: numOf(c.snfBase, 8.5),
      fatStep: numOf(c.fatStep, 1),
      snfStep: numOf(c.snfStep, 1),
      minRate: numOf(c.minRate),
      minFat: numOf(c.minFat),
      minSnf: numOf(c.minSnf),
      active: boolOf(c.active, true),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        baseRate: Number(form.baseRate),
        fatBase: Number(form.fatBase),
        snfBase: Number(form.snfBase),
        fatStep: Number(form.fatStep),
        snfStep: Number(form.snfStep),
        minRate: Number(form.minRate),
        minFat: Number(form.minFat),
        minSnf: Number(form.minSnf),
      };
      if (editing) {
        await dairyExtras.updateRateChart(strOf(editing.id), payload);
        setNotice('Rate chart updated.');
      } else {
        await dairyExtras.createRateChart(payload);
        setNotice('New rate chart version created.');
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const numField = (
    label: string,
    key: keyof typeof EMPTY_CHART,
    step = 0.1,
  ) => (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        value={form[key] as number}
        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
        required
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Award className="w-7 h-7 text-emerald-600" />
            FAT/SNF Rate Chart
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Active procurement chart, version history and effective-date management
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {(['cow', 'buffalo'] as const).map((sp) => (
              <button
                key={sp}
                onClick={() => setSpecies(sp)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                  species === sp ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {sp}
              </button>
            ))}
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Version
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading rate chart…</p>
      ) : !chart ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center space-y-3">
          <Award className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No active {species} rate chart</p>
          <p className="text-xs text-slate-400">Create a chart version to start auto-pricing collections.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 capitalize">{species} Milk Chart</h3>
              <p className="text-xs text-slate-400">
                Effective {formatDate(strOf(chart.effectiveFrom))} • v{strOf(chart.version) || '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={boolOf(chart.active) ? 'active' : 'inactive'} />
              <button
                onClick={() => openEdit(chart)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Base Rate', value: `₹${numOf(chart.baseRate).toFixed(2)}` },
              { label: 'FAT Base', value: `${numOf(chart.fatBase).toFixed(1)}%` },
              { label: 'SNF Base', value: `${numOf(chart.snfBase).toFixed(1)}%` },
              { label: 'FAT Step', value: `₹${numOf(chart.fatStep).toFixed(2)}` },
              { label: 'SNF Step', value: `₹${numOf(chart.snfStep).toFixed(2)}` },
              { label: 'Min Rate', value: `₹${numOf(chart.minRate).toFixed(2)}` },
              { label: 'Min FAT', value: `${numOf(chart.minFat).toFixed(1)}%` },
              { label: 'Min SNF', value: `${numOf(chart.minSnf).toFixed(1)}%` },
            ].map((s) => (
              <div key={s.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400">{s.label}</p>
                <p className="text-base font-black text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <h3 className="font-bold text-sm text-slate-900 capitalize">{species} chart version history</h3>
        </div>
        {versions.length === 0 ? (
          <p className="p-6 text-xs text-slate-400">No chart versions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Effective From</th>
                  <th className="py-3 px-3">Base ₹/L</th>
                  <th className="py-3 px-3">FAT / SNF Base</th>
                  <th className="py-3 px-3">Steps</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {versions.map((v) => (
                  <tr key={strOf(v.id)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-bold text-slate-900">{formatDate(strOf(v.effectiveFrom))}</td>
                    <td className="py-3 px-3 text-slate-700">₹{numOf(v.baseRate).toFixed(2)}</td>
                    <td className="py-3 px-3 text-slate-700">
                      {numOf(v.fatBase).toFixed(1)}% / {numOf(v.snfBase).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      ₹{numOf(v.fatStep).toFixed(2)} / ₹{numOf(v.snfStep).toFixed(2)}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={boolOf(v.active) ? 'active' : 'inactive'} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => openEdit(v)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Rate Chart' : 'Create Rate Chart Version'}
        description="Rates auto-apply to new collection slips for the selected species"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Species</label>
              <select
                value={form.species}
                onChange={(e) => setForm({ ...form, species: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                disabled={Boolean(editing)}
              >
                <option value="cow">Cow</option>
                <option value="buffalo">Buffalo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Effective From *</label>
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {numField('Base Rate ₹/L *', 'baseRate', 0.5)}
            {numField('FAT Base % *', 'fatBase')}
            {numField('SNF Base % *', 'snfBase')}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {numField('FAT Step ₹', 'fatStep', 0.05)}
            {numField('SNF Step ₹', 'snfStep', 0.05)}
            {numField('Min Rate ₹', 'minRate', 0.5)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {numField('Min FAT %', 'minFat')}
            {numField('Min SNF %', 'minSnf')}
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="w-4 h-4 accent-emerald-600"
            />
            Set as active chart for this species
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Version'}
          </button>
        </form>
      </ModalSheet>

      <button
        onClick={() => reload()}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-emerald-600"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Refresh
      </button>
    </div>
  );
};

export default DairyRateChartPage;
