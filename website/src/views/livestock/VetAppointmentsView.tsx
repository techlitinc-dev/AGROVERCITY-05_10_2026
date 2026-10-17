import React, { useEffect, useState } from 'react';
import { Stethoscope, AlertCircle, CheckCircle2, Plus, Trash2, MapPin, Video, PhoneCall, X } from 'lucide-react';
import { post, readList, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf, todayStr } from './helpers';

// lib `livestock.vet.updateAppointmentStatus` only forwards `{ status }`;
// completion needs vetNotes + prescription, so post the full payload here.
const updateApptStatus = (apptId: string, payload: Record<string, unknown>): Promise<unknown> =>
  post<unknown>(`/livestock/appointments/${apptId}/status`, payload);

type StatusFilter = '' | 'requested' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';

const VISIT_ICONS: Record<string, React.ReactNode> = {
  clinic: <MapPin className="w-3.5 h-3.5" />,
  farm: <Stethoscope className="w-3.5 h-3.5" />,
  tele: <Video className="w-3.5 h-3.5" />,
};

const EMPTY_MED = { name: '', dosage: '', frequency: '', durationDays: 0, notes: '' };

export const VetAppointmentsView: React.FC = () => {
  const [appointments, setAppointments] = useState<Record<string, unknown>[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState('');

  // complete-with-prescription modal
  const [completeFor, setCompleteFor] = useState<Record<string, unknown> | null>(null);
  const [completeForm, setCompleteForm] = useState({
    vetNotes: '',
    diagnosis: '',
    advice: '',
    milkWithdrawalDays: 0,
    followUpDate: '',
    medicines: [{ ...EMPTY_MED }],
  });

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      // lib appointments() takes no params; backend supports ?status=&date=
      setAppointments(recArr(await readList<unknown[]>('/livestock/vets/me/appointments', { params })));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dateFilter]);

  const act = async (id: string, fn: () => Promise<unknown>, msg: string) => {
    setSavingId(id);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(msg);
      await reload();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err));
      return false;
    } finally {
      setSavingId('');
    }
  };

  const transition = (a: Record<string, unknown>, status: string, extra: Record<string, unknown> = {}) =>
    act(strOf(a.id), () => updateApptStatus(strOf(a.id), { status, ...extra }), `Appointment ${status}.`);

  const openComplete = (a: Record<string, unknown>) => {
    setCompleteFor(a);
    setCompleteForm({
      vetNotes: '',
      diagnosis: '',
      advice: '',
      milkWithdrawalDays: 0,
      followUpDate: '',
      medicines: [{ ...EMPTY_MED }],
    });
  };

  const saveComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeFor) return;
    const medicines = completeForm.medicines
      .filter((m) => m.name.trim())
      .map((m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        durationDays: Number(m.durationDays) || 0,
        notes: m.notes,
      }));
    const payload: Record<string, unknown> = {
      status: 'completed',
      vetNotes: completeForm.vetNotes,
      prescription: completeForm.diagnosis.trim()
        ? {
            diagnosis: completeForm.diagnosis,
            medicines,
            advice: completeForm.advice,
            milkWithdrawalDays: Number(completeForm.milkWithdrawalDays) || 0,
            followUpDate: completeForm.followUpDate || undefined,
          }
        : undefined,
    };
    const ok = await act(
      strOf(completeFor.id),
      () => updateApptStatus(strOf(completeFor.id), payload),
      `Appointment completed${payload.prescription ? ' — prescription issued' : ''}.`,
    );
    if (ok) setCompleteFor(null);
  };

  const actionsFor = (a: Record<string, unknown>) => {
    const status = strOf(a.status, 'requested');
    const busy = savingId === strOf(a.id);
    const btn = 'px-3 py-1.5 rounded-xl font-bold text-[11px] disabled:opacity-50';
    switch (status) {
      case 'requested':
        return (
          <>
            <button onClick={() => transition(a, 'confirmed')} disabled={busy} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}>
              Confirm
            </button>
            <button
              onClick={() => {
                const reason = window.prompt('Cancel reason (shared with the farmer):') || '';
                transition(a, 'cancelled', { cancelReason: reason });
              }}
              disabled={busy}
              className={`${btn} bg-rose-50 hover:bg-rose-100 text-rose-600`}
            >
              Cancel
            </button>
          </>
        );
      case 'confirmed':
        return (
          <>
            <button onClick={() => transition(a, 'in-progress')} disabled={busy} className={`${btn} bg-sky-600 hover:bg-sky-700 text-white`}>
              Start Visit
            </button>
            <button
              onClick={() => {
                const reason = window.prompt('Cancel reason (shared with the farmer):') || '';
                transition(a, 'cancelled', { cancelReason: reason });
              }}
              disabled={busy}
              className={`${btn} bg-rose-50 hover:bg-rose-100 text-rose-600`}
            >
              Cancel
            </button>
          </>
        );
      case 'in-progress':
        return (
          <button onClick={() => openComplete(a)} disabled={busy} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}>
            Complete + Prescription
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-emerald-600" />
            Appointment Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Confirm bookings, run visits and complete consultations with digital prescriptions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
          />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} className="text-xs font-bold text-slate-400 hover:text-rose-600">
              Clear
            </button>
          )}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
          >
            <option value="">All statuses</option>
            <option value="requested">Requested</option>
            <option value="confirmed">Confirmed</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
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
        <p className="text-xs text-slate-400">Loading appointments…</p>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
          No appointments{statusFilter ? ` with status “${statusFilter}”` : ''}{dateFilter ? ` on ${formatDate(dateFilter)}` : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div key={strOf(a.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    {nameOf(a, strOf(a.farmerName, 'Farmer'))}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold capitalize">
                      {VISIT_ICONS[strOf(a.visitType, 'clinic')]} {strOf(a.visitType, 'clinic')}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {strOf(a.id)} • {formatDate(strOf(a.slotDate))} at {strOf(a.slotTime)}
                    {strOf(a.animalName) ? ` • ${strOf(a.animalName)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={strOf(a.status, 'requested')} />
                  <span className="text-sm font-black text-emerald-800">{formatCurrency(numOf(a.fee))}</span>
                </div>
              </div>

              {strOf(a.symptoms) && (
                <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <span className="font-bold">Symptoms:</span> {strOf(a.symptoms)}
                </p>
              )}
              {strOf(a.address) && strOf(a.visitType) === 'farm' && (
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {strOf(a.address)}
                </p>
              )}
              {strOf(a.prescriptionId) && (
                <p className="text-[11px] text-emerald-700 font-bold">
                  Prescription {strOf(a.prescriptionId)} issued
                </p>
              )}

              <div className="flex flex-wrap gap-2">{actionsFor(a)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Complete + prescription modal */}
      <ModalSheet
        isOpen={Boolean(completeFor)}
        onClose={() => setCompleteFor(null)}
        title={completeFor ? `Complete consultation — ${nameOf(completeFor)}` : undefined}
        description="Add visit notes and a digital prescription (optional)"
        maxWidth="2xl"
      >
        <form onSubmit={saveComplete} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Visit Notes</label>
            <textarea
              value={completeForm.vetNotes}
              onChange={(e) => setCompleteForm({ ...completeForm, vetNotes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="Observations, temperature, recovery advice…"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">Prescription (optional)</h4>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Diagnosis</label>
              <input
                type="text"
                value={completeForm.diagnosis}
                onChange={(e) => setCompleteForm({ ...completeForm, diagnosis: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                placeholder="e.g. Mastitis (sub-clinical)"
              />
            </div>

            <div className="space-y-2">
              {completeForm.medicines.map((m, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400">Medicine {i + 1}</span>
                    {completeForm.medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setCompleteForm({
                            ...completeForm,
                            medicines: completeForm.medicines.filter((_, j) => j !== i),
                          })
                        }
                        className="text-slate-300 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => {
                        const next = [...completeForm.medicines];
                        next[i] = { ...m, name: e.target.value };
                        setCompleteForm({ ...completeForm, medicines: next });
                      }}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                      placeholder="Medicine name"
                    />
                    <input
                      type="text"
                      value={m.dosage}
                      onChange={(e) => {
                        const next = [...completeForm.medicines];
                        next[i] = { ...m, dosage: e.target.value };
                        setCompleteForm({ ...completeForm, medicines: next });
                      }}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                      placeholder="Dosage (e.g. 10ml)"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={m.frequency}
                      onChange={(e) => {
                        const next = [...completeForm.medicines];
                        next[i] = { ...m, frequency: e.target.value };
                        setCompleteForm({ ...completeForm, medicines: next });
                      }}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                      placeholder="Frequency (BD/TDS)"
                    />
                    <input
                      type="number"
                      min="0"
                      value={m.durationDays}
                      onChange={(e) => {
                        const next = [...completeForm.medicines];
                        next[i] = { ...m, durationDays: Number(e.target.value) };
                        setCompleteForm({ ...completeForm, medicines: next });
                      }}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                      placeholder="Days"
                    />
                    <input
                      type="text"
                      value={m.notes}
                      onChange={(e) => {
                        const next = [...completeForm.medicines];
                        next[i] = { ...m, notes: e.target.value };
                        setCompleteForm({ ...completeForm, medicines: next });
                      }}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                      placeholder="Notes"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCompleteForm({ ...completeForm, medicines: [...completeForm.medicines, { ...EMPTY_MED }] })}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
              >
                <Plus className="w-3 h-3" /> Add medicine
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Milk withdrawal (days)</label>
                <input
                  type="number"
                  min="0"
                  value={completeForm.milkWithdrawalDays}
                  onChange={(e) => setCompleteForm({ ...completeForm, milkWithdrawalDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Follow-up date</label>
                <input
                  type="date"
                  value={completeForm.followUpDate}
                  min={todayStr()}
                  onChange={(e) => setCompleteForm({ ...completeForm, followUpDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Advice</label>
                <input
                  type="text"
                  value={completeForm.advice}
                  onChange={(e) => setCompleteForm({ ...completeForm, advice: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  placeholder="Rest, hydration…"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingId === strOf(completeFor?.id)}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md inline-flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {savingId === strOf(completeFor?.id) ? 'Completing…' : 'Complete Consultation'}
          </button>
          <button
            type="button"
            onClick={() => setCompleteFor(null)}
            className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs inline-flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        </form>
      </ModalSheet>

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <PhoneCall className="w-3.5 h-3.5" />
        Tele-consult slots come from your schedule — keep them updated in the Schedule Editor.
      </div>
    </div>
  );
};

export default VetAppointmentsView;
