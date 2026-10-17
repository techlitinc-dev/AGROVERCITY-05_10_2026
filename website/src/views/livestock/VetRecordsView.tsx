import React, { useEffect, useState } from 'react';
import { FileText, Stethoscope, Syringe, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { livestock, apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

type Tab = 'prescriptions' | 'records' | 'vaccinations';

export const VetRecordsView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('prescriptions');
  const [prescriptions, setPrescriptions] = useState<Record<string, unknown>[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [vaccinations, setVaccinations] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRx, setExpandedRx] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rx, rec, vac] = await Promise.all([
          livestock.vet.prescriptions().catch(() => []),
          livestock.vetRecords().catch(() => []),
          livestock.vaccinations().catch(() => []),
        ]);
        setPrescriptions(recArr(rx));
        setRecords(recArr(rec));
        setVaccinations(recArr(vac));
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-emerald-600" />
            Medical Records
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Prescriptions issued, treatment history and vaccination log across your patients
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'prescriptions', label: `Prescriptions (${prescriptions.length})` },
              { id: 'records', label: `Vet Records (${records.length})` },
              { id: 'vaccinations', label: `Vaccinations (${vaccinations.length})` },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading records…</p>
      ) : tab === 'prescriptions' ? (
        prescriptions.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
            No prescriptions yet — complete an appointment with a diagnosis to issue one.
          </div>
        ) : (
          <div className="space-y-3">
            {prescriptions.map((rx) => {
              const open = expandedRx === strOf(rx.id);
              const medicines = recArr(rx.medicines);
              return (
                <div key={strOf(rx.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
                  <button
                    onClick={() => setExpandedRx(open ? '' : strOf(rx.id))}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{strOf(rx.diagnosis) || 'Prescription'}</h3>
                      <p className="text-[11px] text-slate-400">
                        {strOf(rx.id)} • {formatDate(strOf(rx.createdAt ?? rx.date))}
                        {strOf(rx.animalId) ? ` • Animal ${strOf(rx.animalId)}` : ''}
                      </p>
                    </div>
                    {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {open && (
                    <div className="mt-3 space-y-2">
                      {medicines.length > 0 ? (
                        medicines.map((m, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <span className="font-black text-slate-800">{nameOf(m)}</span>
                            <span className="text-slate-600">{strOf(m.dosage)}</span>
                            <span className="text-slate-600">{strOf(m.frequency)}</span>
                            {numOf(m.durationDays) > 0 && <span className="text-slate-600">× {numOf(m.durationDays)} days</span>}
                            {strOf(m.notes) && <span className="text-slate-400 italic">{strOf(m.notes)}</span>}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">No medicines listed.</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
                        {strOf(rx.advice) && <span><span className="font-bold">Advice:</span> {strOf(rx.advice)}</span>}
                        {numOf(rx.milkWithdrawalDays) > 0 && (
                          <span className="font-bold text-amber-700">
                            Milk withdrawal: {numOf(rx.milkWithdrawalDays)} days
                          </span>
                        )}
                        {strOf(rx.followUpDate) && <span><span className="font-bold">Follow-up:</span> {formatDate(strOf(rx.followUpDate))}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : tab === 'records' ? (
        records.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
            No vet treatment records on file.
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-3">Animal</th>
                    <th className="py-3 px-3">Condition</th>
                    <th className="py-3 px-3">Treatment</th>
                    <th className="py-3 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <tr key={strOf(r.id)} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-bold text-slate-700">{formatDate(strOf(r.date ?? r.createdAt))}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{strOf(r.animalId) || '—'}</td>
                      <td className="py-3 px-3 text-slate-700">{strOf(r.condition) || strOf(r.diagnosis) || '—'}</td>
                      <td className="py-3 px-3 text-slate-700">{strOf(r.treatment) || '—'}</td>
                      <td className="py-3 px-3 text-slate-500 max-w-[220px] truncate">{strOf(r.notes) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : vaccinations.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
          No vaccinations logged.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-3">Animal</th>
                  <th className="py-3 px-3">Vaccine</th>
                  <th className="py-3 px-3">Disease</th>
                  <th className="py-3 px-3">Next Due</th>
                  <th className="py-3 px-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vaccinations.map((v) => (
                  <tr key={strOf(v.id)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-bold text-slate-700">{formatDate(strOf(v.date ?? v.vaccinatedAt ?? v.createdAt))}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{strOf(v.animalId) || '—'}</td>
                    <td className="py-3 px-3 font-bold text-slate-800">{nameOf(v, strOf(v.vaccineName))}</td>
                    <td className="py-3 px-3 text-slate-600">{strOf(v.disease) || '—'}</td>
                    <td className="py-3 px-3 text-slate-600">{strOf(v.nextDueDate) ? formatDate(strOf(v.nextDueDate)) : '—'}</td>
                    <td className="py-3 px-3 text-slate-500">{strOf(v.vaccinatedBy) || strOf(v.vetId) || '—'}</td>
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

export default VetRecordsView;
