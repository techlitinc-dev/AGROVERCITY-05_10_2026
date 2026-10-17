import React, { useEffect, useState } from 'react';
import { Beef, Plus, AlertCircle, CheckCircle2, Filter } from 'lucide-react';
import { livestock, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDate } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf, todayStr } from './helpers';

const EVENT_TYPES = [
  { id: 'intake', label: 'Intake (new arrival)' },
  { id: 'adopted-out', label: 'Adopted out' },
  { id: 'transferred', label: 'Transferred' },
  { id: 'deceased', label: 'Deceased' },
];

export const CattleInventoryView: React.FC = () => {
  const [cattle, setCattle] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const [eventFor, setEventFor] = useState<Record<string, unknown> | null>(null);
  const [eventForm, setEventForm] = useState({ type: 'intake', note: '', date: todayStr() });
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setCattle(recArr(await livestock.gaushala.cattle()));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventFor) return;
    setSaving(true);
    setError(null);
    try {
      await livestock.gaushala.addCattleEvent(strOf(eventFor.id), { ...eventForm });
      setNotice(`${EVENT_TYPES.find((t) => t.id === eventForm.type)?.label} recorded for ${nameOf(eventFor)}.`);
      setEventFor(null);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const statuses = Array.from(new Set(cattle.map((c) => strOf(c.cattleStatus, 'in-shelter'))));
  const filtered = statusFilter ? cattle.filter((c) => strOf(c.cattleStatus, 'in-shelter') === statusFilter) : cattle;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Beef className="w-7 h-7 text-emerald-600" />
            Cattle Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Herd register — arrivals, adoptions-out, transfers and mortalities
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
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
        <p className="text-xs text-slate-400">Loading herd…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
          {cattle.length === 0
            ? 'No cattle in the register yet. Cattle appear here when registered against your gaushala.'
            : 'No cattle match this filter.'}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Animal</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Tag / Breed</th>
                  <th className="py-3 px-3">Age</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Recent Events</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const events = recArr(c.events).slice(-2).reverse();
                  return (
                    <tr key={strOf(c.id)} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-bold text-slate-900">
                        {nameOf(c)}
                        <span className="text-[10px] text-slate-400 block font-mono">{strOf(c.id)}</span>
                      </td>
                      <td className="py-3 px-3 capitalize text-slate-600">{strOf(c.category) || strOf(c.lactationStatus) || '—'}</td>
                      <td className="py-3 px-3 text-slate-600">
                        {strOf(c.tagId) || strOf(c.tagNumber) || '—'}
                        {strOf(c.breed) && <span className="block text-[10px] text-slate-400">{strOf(c.breed)}</span>}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{strOf(c.ageYears) ? `${strOf(c.ageYears)} yrs` : '—'}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={strOf(c.cattleStatus, 'in-shelter')} />
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-500">
                        {events.length === 0
                          ? '—'
                          : events.map((ev) => (
                              <span key={`${strOf(ev.date)}-${strOf(ev.type)}`} className="block">
                                {formatDate(strOf(ev.date))}: <span className="font-bold capitalize">{strOf(ev.type).replace(/-/g, ' ')}</span>
                              </span>
                            ))}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() => {
                            setEventFor(c);
                            setEventForm({ type: 'intake', note: '', date: todayStr() });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Event
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalSheet
        isOpen={Boolean(eventFor)}
        onClose={() => setEventFor(null)}
        title={eventFor ? `Record event — ${nameOf(eventFor)}` : undefined}
        maxWidth="sm"
      >
        <form onSubmit={saveEvent} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Event Type *</label>
            <select
              value={eventForm.type}
              onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              required
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={eventForm.date}
              onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
            <input
              type="text"
              value={eventForm.note}
              onChange={(e) => setEventForm({ ...eventForm, note: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="e.g. rescued from highway, adopted by Sharma family"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : 'Save Event'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default CattleInventoryView;
