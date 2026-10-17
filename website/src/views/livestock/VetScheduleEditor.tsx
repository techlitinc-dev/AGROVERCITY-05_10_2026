import React, { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { livestock, apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { asRec, boolOf, recArr, strOf, todayStr } from './helpers';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Slot {
  start: string;
  end: string;
}

export const VetScheduleEditor: React.FC = () => {
  const [schedule, setSchedule] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newLeave, setNewLeave] = useState(todayStr());

  useEffect(() => {
    (async () => {
      try {
        setSchedule(asRec(await livestock.vet.schedule()));
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-xs text-slate-400">Loading schedule…</p>;
  if (!schedule) return <p className="text-xs text-rose-600">{error || 'Schedule unavailable'}</p>;

  const weeklySlots = recArr(schedule.weeklySlots).map((d) => ({
    day: Number(d.day ?? 0),
    slots: recArr(d.slots).map((s) => ({ start: strOf(s.start, '09:00'), end: strOf(s.end, '10:00') })),
  }));
  const leaves = recArr(schedule.leaves).map((l) => strOf(l));
  const emergencyAvailable = boolOf(schedule.emergencyAvailable);
  const teleAvailable = boolOf(schedule.teleAvailable);

  const daySlots = (day: number): Slot[] => weeklySlots.find((d) => d.day === day)?.slots || [];

  const updateDay = (day: number, slots: Slot[]) => {
    const next = weeklySlots.filter((d) => d.day !== day);
    if (slots.length) next.push({ day, slots });
    next.sort((a, b) => a.day - b.day);
    setSchedule({ ...schedule, weeklySlots: next });
  };

  const saveSchedule = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = asRec(
        await livestock.vet.updateSchedule({
          weeklySlots,
          emergencyAvailable,
          teleAvailable,
        }),
      );
      setSchedule(updated);
      setNotice('Schedule saved — farmers see your live slots when booking.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const addLeave = async () => {
    if (!newLeave || leaves.includes(newLeave)) return;
    setSaving(true);
    setError(null);
    try {
      const updated = asRec(await livestock.vet.updateSchedule({ leaves: [newLeave] }));
      setSchedule(updated);
      setNotice(`Leave added for ${formatDate(newLeave)}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <CalendarClock className="w-7 h-7 text-emerald-600" />
          Consultation Schedule
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Weekly consultation slots, leaves, emergency & tele-consult availability
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Weekly slots</h3>
          {DAYS.map((dayName, dayIdx) => {
            const slots = daySlots(dayIdx);
            return (
              <div key={dayName} className="border-b border-slate-50 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">{dayName}</span>
                  <button
                    onClick={() => updateDay(dayIdx, [...slots, { start: '09:00', end: '12:00' }])}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    <Plus className="w-3 h-3" /> Add slot
                  </button>
                </div>
                {slots.length === 0 ? (
                  <p className="text-[11px] text-slate-300">No slots — leave day</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700"
                      >
                        <input
                          type="time"
                          value={s.start}
                          onChange={(e) => {
                            const next = [...slots];
                            next[i] = { ...s, start: e.target.value };
                            updateDay(dayIdx, next);
                          }}
                          className="bg-transparent outline-none"
                        />
                        –
                        <input
                          type="time"
                          value={s.end}
                          onChange={(e) => {
                            const next = [...slots];
                            next[i] = { ...s, end: e.target.value };
                            updateDay(dayIdx, next);
                          }}
                          className="bg-transparent outline-none"
                        />
                        <button
                          onClick={() => updateDay(dayIdx, slots.filter((_, j) => j !== i))}
                          className="text-slate-300 hover:text-rose-500"
                          title="Remove slot"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button
            onClick={saveSchedule}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : 'Save Weekly Schedule'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Availability flags</h3>
            {(
              [
                { key: 'emergencyAvailable', label: 'Emergency calls', desc: 'Show an emergency-call badge to farmers' },
                { key: 'teleAvailable', label: 'Tele-consultations', desc: 'Accept video/phone consultations' },
              ] as const
            ).map((f) => (
              <label key={f.key} className="flex items-start gap-3 p-3 rounded-2xl border border-slate-100 hover:border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={boolOf(schedule[f.key])}
                  onChange={(e) => setSchedule({ ...schedule, [f.key]: e.target.checked })}
                  className="w-4 h-4 mt-0.5 accent-emerald-600"
                />
                <span>
                  <span className="block text-xs font-bold text-slate-800">{f.label}</span>
                  <span className="block text-[11px] text-slate-400">{f.desc}</span>
                </span>
              </label>
            ))}
            <button
              onClick={saveSchedule}
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-bold text-xs"
            >
              Save Flags
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Leaves</h3>
            <div className="flex gap-2">
              <input
                type="date"
                value={newLeave}
                min={todayStr()}
                onChange={(e) => setNewLeave(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
              <button
                onClick={addLeave}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs"
              >
                Add Leave
              </button>
            </div>
            {leaves.length === 0 ? (
              <p className="text-[11px] text-slate-400">No leaves scheduled.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {leaves
                  .slice()
                  .sort()
                  .map((l) => (
                    <span
                      key={l}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700"
                    >
                      {formatDate(l)}
                      <button
                        onClick={async () => {
                          setSaving(true);
                          try {
                            const updated = asRec(
                              await livestock.vet.updateSchedule({ leaves: leaves.filter((x) => x !== l) }),
                            );
                            setSchedule(updated);
                          } catch (err) {
                            setError(apiErrorMessage(err));
                          } finally {
                            setSaving(false);
                          }
                        }}
                        className="text-amber-400 hover:text-rose-500"
                        title="Remove leave"
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400">
              Note: removing a leave re-submits the remaining list — the backend merges new leaves into existing ones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VetScheduleEditor;
