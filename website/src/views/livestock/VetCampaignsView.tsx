import React, { useEffect, useState } from 'react';
import { Syringe, Plus, Eye, AlertCircle, CheckCircle2 } from 'lucide-react';
import { livestock, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDate } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf, todayStr } from './helpers';

export const VetCampaignsView: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    vaccine: '',
    disease: '',
    fromDate: todayStr(),
    toDate: todayStr(),
    targetDistricts: '',
    status: 'upcoming',
  });

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingAnimal, setSavingAnimal] = useState('');

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(recArr(await livestock.vet.campaigns()));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const saveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await livestock.vet.createCampaign({
        title: form.title,
        vaccine: form.vaccine,
        disease: form.disease,
        fromDate: form.fromDate,
        toDate: form.toDate,
        targetDistricts: form.targetDistricts
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        status: form.status,
      });
      setCreateOpen(false);
      setNotice(`Campaign “${form.title}” created.`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (c: Record<string, unknown>) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(asRec(await livestock.vet.campaign(strOf(c.id))));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const markVaccinated = async (campaignId: string, animalId: string) => {
    setSavingAnimal(animalId);
    setError(null);
    try {
      await livestock.vet.markVaccinated(campaignId, { animalId });
      setNotice(`Animal ${animalId} marked as vaccinated.`);
      await openDetail({ id: campaignId });
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingAnimal('');
    }
  };

  const filtered = statusFilter ? campaigns.filter((c) => strOf(c.status) === statusFilter) : campaigns;
  const enrollments = detail ? recArr(detail.enrollments) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Syringe className="w-7 h-7 text-emerald-600" />
            Vaccination Campaigns
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            FMD / HS / BQ drives — schedule campaigns, track enrolment and mark coverage
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
          >
            <option value="">All statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
          <button
            onClick={() => {
              setForm({ title: '', vaccine: '', disease: '', fromDate: todayStr(), toDate: todayStr(), targetDistricts: '', status: 'upcoming' });
              setCreateOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Campaign
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
        <p className="text-xs text-slate-400">Loading campaigns…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
          No campaigns{statusFilter ? ` with status “${statusFilter}”` : ''} yet — create one to coordinate a vaccination drive.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <div key={strOf(c.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">{nameOf(c)}</h3>
                <StatusBadge status={strOf(c.status, 'upcoming')} />
              </div>
              <p className="text-xs text-slate-600">
                <span className="font-bold">{strOf(c.vaccine)}</span>
                {strOf(c.disease) ? ` — against ${strOf(c.disease)}` : ''}
              </p>
              <p className="text-[11px] text-slate-400">
                {formatDate(strOf(c.fromDate))} → {formatDate(strOf(c.toDate))}
                {recArr(c.targetDistricts).length > 0 && ` • ${recArr(c.targetDistricts).map((d) => strOf(d)).join(', ')}`}
              </p>
              <button
                onClick={() => openDetail(c)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
              >
                <Eye className="w-3.5 h-3.5" /> Enrolment & Coverage
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create campaign modal */}
      <ModalSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Vaccination Campaign"
        maxWidth="md"
      >
        <form onSubmit={saveCampaign} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="e.g. FMD Drive — Monsoon 2026"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vaccine *</label>
              <input
                type="text"
                value={form.vaccine}
                onChange={(e) => setForm({ ...form, vaccine: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                placeholder="e.g. FMD Vaccine"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Disease</label>
              <input
                type="text"
                value={form.disease}
                onChange={(e) => setForm({ ...form, disease: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                placeholder="e.g. Foot & Mouth Disease"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">From Date *</label>
              <input
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">To Date *</label>
              <input
                type="date"
                value={form.toDate}
                onChange={(e) => setForm({ ...form, toDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Districts (comma separated)</label>
            <input
              type="text"
              value={form.targetDistricts}
              onChange={(e) => setForm({ ...form, targetDistricts: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="Nashik, Dhule, Jalgaon"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Creating…' : 'Create Campaign'}
          </button>
        </form>
      </ModalSheet>

      {/* Detail / enrolment modal */}
      <ModalSheet
        isOpen={Boolean(detail) || detailLoading}
        onClose={() => setDetail(null)}
        title={detail ? nameOf(detail) : undefined}
        description={
          detail
            ? `${strOf(detail.vaccine)} • ${formatDate(strOf(detail.fromDate))} → ${formatDate(strOf(detail.toDate))} • ${numOf(detail.enrollmentCount)} enrolled`
            : undefined
        }
        maxWidth="2xl"
      >
        {detailLoading ? (
          <p className="text-xs text-slate-400">Loading enrolment…</p>
        ) : !detail ? null : enrollments.length === 0 ? (
          <p className="text-xs text-slate-400">
            No animals enrolled yet. Farmers enroll their animals from the campaign directory.
          </p>
        ) : (
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                  <th className="py-2.5 px-4">Animal</th>
                  <th className="py-2.5 px-3">Farmer</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Vaccinated At</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {enrollments.map((en) => (
                  <tr key={strOf(en.id)}>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{strOf(en.animalId)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{strOf(en.farmerUid)}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={strOf(en.status, 'enrolled')} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {strOf(en.vaccinatedAt) ? formatDate(strOf(en.vaccinatedAt)) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {strOf(en.status) !== 'vaccinated' && strOf(detail.status) !== 'closed' && (
                        <button
                          onClick={() => markVaccinated(strOf(detail.id), strOf(en.animalId))}
                          disabled={savingAnimal === strOf(en.animalId)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[11px]"
                        >
                          {savingAnimal === strOf(en.animalId) ? 'Saving…' : 'Mark Vaccinated'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};

export default VetCampaignsView;
