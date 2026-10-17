import React, { useEffect, useState } from 'react';
import {
  Stethoscope,
  Plus,
  Pencil,
  Trash2,
  Syringe,
  Eye,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { livestock, readList, apiErrorMessage } from '../../../lib/api';
import { ModalSheet } from '../../../components/common/ModalSheet';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf, todayStr } from '../helpers';

type Tab = 'directory' | 'campaigns' | 'board';

const EMPTY_VET = {
  name: '',
  phone: '',
  qualification: 'B.V.Sc & A.H',
  specializations: '',
  clinicAddress: '',
  experienceYears: 0,
  feeClinic: 300,
  feeFarm: 500,
  feeTele: 200,
  serviceDistricts: '',
  languages: 'Hindi',
  vetCouncilRegNo: '',
  emergencyAvailable: false,
  availableForFarmVisit: true,
};

const EMPTY_CAMPAIGN = {
  title: '',
  vaccine: '',
  disease: '',
  fromDate: todayStr(),
  toDate: todayStr(),
  targetDistricts: '',
  status: 'upcoming',
};

/**
 * Gaushala manager's vet network & vaccination campaigns — onboard vets into
 * the district directory (livestock.vet.managed*), run vaccination drives and
 * watch the whole appointment board (livestock.vet.allAppointments).
 */
export const VetNetworkCampaigns: React.FC = () => {
  const [tab, setTab] = useState<Tab>('directory');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Stethoscope className="w-7 h-7 text-emerald-600" />
          Vet Network & Campaigns
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Onboard vets into the district directory, coordinate vaccination drives and watch the appointment board
        </p>
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

      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
        {[
          { id: 'directory', label: 'Vet Directory' },
          { id: 'campaigns', label: 'Vaccination Campaigns' },
          { id: 'board', label: 'Appointment Board' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id as Tab);
              setError(null);
              setNotice(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'directory' && <VetDirectory onError={setError} onNotice={setNotice} />}
      {tab === 'campaigns' && <CampaignsPanel onError={setError} onNotice={setNotice} />}
      {tab === 'board' && <AppointmentBoard onError={setError} />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Vet directory — managed CRUD                                        */
/* ------------------------------------------------------------------ */

const VetDirectory: React.FC<{ onError: (m: string | null) => void; onNotice: (m: string | null) => void }> = ({
  onError,
  onNotice,
}) => {
  const [vets, setVets] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(EMPTY_VET);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    onError(null);
    try {
      setVets(recArr(await livestock.vet.managed()));
    } catch (e) {
      onError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_VET);
    setModalOpen(true);
  };

  const openEdit = (v: Record<string, unknown>) => {
    setEditing(v);
    setForm({
      name: strOf(v.name),
      phone: strOf(v.phone),
      qualification: strOf(v.qualification, 'B.V.Sc & A.H'),
      specializations: recArr(v.specializations).map((s) => strOf(s)).join(', '),
      clinicAddress: strOf(v.clinicAddress),
      experienceYears: numOf(v.experienceYears),
      feeClinic: numOf(v.feeClinic),
      feeFarm: numOf(v.feeFarm),
      feeTele: numOf(v.feeTele),
      serviceDistricts: recArr(v.serviceDistricts).map((s) => strOf(s)).join(', '),
      languages: recArr(v.languages).map((s) => strOf(s)).join(', ') || 'Hindi',
      vetCouncilRegNo: strOf(v.vetCouncilRegNo),
      emergencyAvailable: Boolean(v.emergencyAvailable),
      availableForFarmVisit: Boolean(v.availableForFarmVisit ?? true),
    });
    setModalOpen(true);
  };

  const toPayload = () => ({
    name: form.name,
    phone: form.phone,
    qualification: form.qualification,
    specializations: form.specializations.split(',').map((s) => s.trim()).filter(Boolean),
    clinicAddress: form.clinicAddress,
    experienceYears: Number(form.experienceYears) || 0,
    feeClinic: Number(form.feeClinic) || 0,
    feeFarm: Number(form.feeFarm) || 0,
    feeTele: Number(form.feeTele) || 0,
    visitTypes: [
      ...(Number(form.feeClinic) > 0 ? ['clinic'] : []),
      ...(Number(form.feeFarm) > 0 ? ['farm'] : []),
      ...(Number(form.feeTele) > 0 ? ['tele'] : []),
    ],
    serviceDistricts: form.serviceDistricts.split(',').map((s) => s.trim()).filter(Boolean),
    languages: form.languages.split(',').map((s) => s.trim()).filter(Boolean),
    vetCouncilRegNo: form.vetCouncilRegNo,
    emergencyAvailable: form.emergencyAvailable,
    availableForFarmVisit: form.availableForFarmVisit,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    onError(null);
    onNotice(null);
    try {
      if (editing) {
        await livestock.vet.updateManaged(strOf(editing.id), toPayload());
        onNotice(`Vet ${form.name} updated.`);
      } else {
        await livestock.vet.addManaged(toPayload());
        onNotice(`Vet ${form.name} onboarded into the directory.`);
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (v: Record<string, unknown>) => {
    if (!window.confirm(`Deactivate ${nameOf(v)}? No new appointments will land on their board.`)) return;
    onError(null);
    try {
      await livestock.vet.removeManaged(strOf(v.id));
      onNotice(`Vet ${nameOf(v)} deactivated.`);
      await reload();
    } catch (err) {
      onError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900">Directory ({vets.length})</h3>
        <div className="flex gap-2">
          <button
            onClick={reload}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Onboard Vet
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading directory…</p>
      ) : vets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
          No vets in the directory yet — onboard your first vet.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Vet</th>
                  <th className="py-3 px-3">Fees (clinic/farm/tele)</th>
                  <th className="py-3 px-3">Claimed</th>
                  <th className="py-3 px-3">Credential</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vets.map((v) => (
                  <tr key={strOf(v.id)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-bold text-slate-900">
                      {nameOf(v)}
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        {strOf(v.qualification)} • {numOf(v.experienceYears)} yrs • ★ {numOf(v.rating).toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono">
                      ₹{numOf(v.feeClinic)}/₹{numOf(v.feeFarm)}/₹{numOf(v.feeTele)}
                    </td>
                    <td className="py-3 px-3">
                      {v.claimed ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          Claimed
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Unclaimed</span>
                      )}
                    </td>
                    <td className="py-3 px-3 capitalize text-slate-600">{strOf(v.credentialStatus, 'pending') || 'pending'}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={strOf(v.status, 'active')} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openEdit(v)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {strOf(v.status, 'active') === 'active' && (
                          <button
                            onClick={() => handleDeactivate(v)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${nameOf(editing)}` : 'Onboard Vet'}
        description="Listing is claimable by the vet with their registered phone number."
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Qualification</label>
              <input
                type="text"
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Experience (years)</label>
              <input
                type="number"
                min="0"
                value={form.experienceYears}
                onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Specializations (comma separated)</label>
            <input
              type="text"
              value={form.specializations}
              onChange={(e) => setForm({ ...form, specializations: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="bovine fertility, mastitis"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Clinic Address</label>
            <input
              type="text"
              value={form.clinicAddress}
              onChange={(e) => setForm({ ...form, clinicAddress: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Clinic Fee ₹</label>
              <input
                type="number"
                min="0"
                value={form.feeClinic}
                onChange={(e) => setForm({ ...form, feeClinic: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Farm Visit ₹</label>
              <input
                type="number"
                min="0"
                value={form.feeFarm}
                onChange={(e) => setForm({ ...form, feeFarm: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tele ₹</label>
              <input
                type="number"
                min="0"
                value={form.feeTele}
                onChange={(e) => setForm({ ...form, feeTele: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Service Districts</label>
              <input
                type="text"
                value={form.serviceDistricts}
                onChange={(e) => setForm({ ...form, serviceDistricts: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                placeholder="Mathura, Bharatpur"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Languages</label>
              <input
                type="text"
                value={form.languages}
                onChange={(e) => setForm({ ...form, languages: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Vet Council Registration No.</label>
            <input
              type="text"
              value={form.vetCouncilRegNo}
              onChange={(e) => setForm({ ...form, vetCouncilRegNo: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={form.availableForFarmVisit}
                onChange={(e) => setForm({ ...form, availableForFarmVisit: e.target.checked })}
                className="w-4 h-4 accent-emerald-600"
              />
              Farm visits
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={form.emergencyAvailable}
                onChange={(e) => setForm({ ...form, emergencyAvailable: e.target.checked })}
                className="w-4 h-4 accent-emerald-600"
              />
              Emergency
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Onboard Vet'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Campaigns — manager co-runs drives, marks coverage                  */
/* ------------------------------------------------------------------ */

const CampaignsPanel: React.FC<{ onError: (m: string | null) => void; onNotice: (m: string | null) => void }> = ({
  onError,
  onNotice,
}) => {
  const [campaigns, setCampaigns] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CAMPAIGN);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingAnimal, setSavingAnimal] = useState('');

  const reload = async () => {
    setLoading(true);
    onError(null);
    try {
      setCampaigns(recArr(await livestock.vet.campaigns()));
    } catch (e) {
      onError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    onError(null);
    onNotice(null);
    try {
      await livestock.vet.createCampaign({
        title: form.title,
        vaccine: form.vaccine,
        disease: form.disease,
        fromDate: form.fromDate,
        toDate: form.toDate,
        targetDistricts: form.targetDistricts.split(',').map((s) => s.trim()).filter(Boolean),
        status: form.status,
      });
      setCreateOpen(false);
      setForm(EMPTY_CAMPAIGN);
      onNotice(`Campaign “${form.title}” scheduled.`);
      await reload();
    } catch (err) {
      onError(apiErrorMessage(err));
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
      onError(apiErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const markVaccinated = async (campaignId: string, animalId: string) => {
    setSavingAnimal(animalId);
    onError(null);
    try {
      await livestock.vet.markVaccinated(campaignId, { animalId });
      onNotice(`Animal ${animalId} marked vaccinated — farmer notified.`);
      await openDetail({ id: campaignId });
      await reload();
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setSavingAnimal('');
    }
  };

  const enrollments = detail ? recArr(detail.enrollments) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Syringe className="w-4 h-4 text-emerald-600" /> Vaccination Drives ({campaigns.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={reload}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> New Drive
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading drives…</p>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
          No vaccination drives yet — schedule one for your district network.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <div key={strOf(c.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900">{nameOf(c)}</h4>
                <StatusBadge status={strOf(c.status, 'upcoming')} />
              </div>
              <p className="text-xs text-slate-600">
                <span className="font-bold">{strOf(c.vaccine)}</span>
                {strOf(c.disease) ? ` — against ${strOf(c.disease)}` : ''}
              </p>
              <p className="text-[11px] text-slate-400">
                {formatDate(strOf(c.fromDate))} → {formatDate(strOf(c.toDate))}
                {numOf(c.enrollmentCount) > 0 && ` • ${numOf(c.enrollmentCount)} enrolled`}
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

      <ModalSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Vaccination Drive"
        description="Farmers enroll their own animals; you mark coverage on the ground."
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="e.g. HS Tika Abhiyan"
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
                placeholder="HS"
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
                placeholder="Haemorrhagic Septicaemia"
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
              placeholder="Mathura, Bharatpur"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Creating…' : 'Schedule Drive'}
          </button>
        </form>
      </ModalSheet>

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
          <p className="text-xs text-slate-400">No animals enrolled yet — farmers enroll from their own app.</p>
        ) : (
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                  <th className="py-2.5 px-4">Animal</th>
                  <th className="py-2.5 px-3">Owner</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {enrollments.map((en) => (
                  <tr key={strOf(en.animalId) || strOf(en.id)}>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{strOf(en.animalId)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{strOf(en.farmerUid) || '—'}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={strOf(en.status, 'enrolled')} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {strOf(en.status) !== 'vaccinated' && (
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

/* ------------------------------------------------------------------ */
/* Appointment board — district-wide oversight                         */
/* ------------------------------------------------------------------ */

const AppointmentBoard: React.FC<{ onError: (m: string | null) => void }> = ({ onError }) => {
  const [appointments, setAppointments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const reload = async () => {
    setLoading(true);
    onError(null);
    try {
      // lib allAppointments() takes no params; backend supports ?status=&date=
      const params: Record<string, unknown> = {};
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      setAppointments(recArr(await readList<unknown[]>('/livestock/appointments', { params })));
    } catch (e) {
      onError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dateFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 mr-auto">
          <CalendarDays className="w-4 h-4 text-emerald-600" /> District Appointment Board
        </h3>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
        >
          <option value="">All statuses</option>
          <option value="requested">Requested</option>
          <option value="confirmed">Confirmed</option>
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={reload}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading appointments…</p>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
          No appointments match these filters.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Vet</th>
                  <th className="py-3 px-3">Visit</th>
                  <th className="py-3 px-3">Slot</th>
                  <th className="py-3 px-3">Fee</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((a) => (
                  <tr key={strOf(a.id)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-bold text-slate-900">
                      {strOf(a.vetName) || strOf(a.vetId)}
                      <span className="text-[10px] text-slate-400 block font-semibold">{strOf(a.animalId) || 'general visit'}</span>
                    </td>
                    <td className="py-3 px-3 capitalize text-slate-600">{strOf(a.visitType, 'clinic')}</td>
                    <td className="py-3 px-3 text-slate-600">{formatDate(strOf(a.slotDate))}</td>
                    <td className="py-3 px-3 font-bold text-slate-800">{formatCurrency(numOf(a.feeRupees))}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={strOf(a.status, 'requested')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default VetNetworkCampaigns;
