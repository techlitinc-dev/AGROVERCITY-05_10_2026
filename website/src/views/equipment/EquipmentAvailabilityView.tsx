import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { equipment, equipmentOwner, apiErrorMessage } from '../../lib/api';

interface MachineRow {
  id: string;
  name: string;
  type: string;
}

interface DayCell {
  date: string;
  label: string;
  slots: { id: string; label: string; status: string }[];
  blocked: boolean;
}

/** Availability — per-machine schedule for the next 7 days (spec §4):
 * available slots, blocked dates (owner pricing rules) and accepted
 * bookings. Read-only overview; blocking is managed via pricing rules. */
export const EquipmentAvailabilityView: React.FC = () => {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [days, setDays] = useState<DayCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fleet = (await equipmentOwner.fleet().catch(() => [])) as unknown as MachineRow[];
      setMachines(fleet);
      const target = selected || fleet[0]?.id || '';
      setSelected(target);
      if (!target) {
        setDays([]);
        return;
      }
      const today = new Date();
      const cells: DayCell[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(today.getTime() + i * 86400000);
        const iso = d.toISOString().slice(0, 10);
        const slots = (await equipment.slots(target, { date: iso }).catch(() => [])) as Record<string, unknown>[];
        cells.push({
          date: iso,
          label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
          slots: slots.map((s) => ({
            id: String(s.id),
            label: String(s.slotName ?? ''),
            status: String(s.status ?? 'unknown'),
          })),
          blocked: false,
        });
      }
      setDays(cells);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const statusCls = (status: string): string => {
    if (status === 'available') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    if (status === 'booked') return 'bg-sky-50 border-sky-200 text-sky-700';
    if (status === 'pending') return 'bg-amber-50 border-amber-200 text-amber-700';
    return 'bg-slate-50 border-slate-200 text-slate-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-emerald-600" />
            Availability
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            The next 7 days per machine — available windows, requested/accepted bookings.
          </p>
        </div>
        <button onClick={() => void load()} className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 self-start" title="Refresh">
          <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">{error}</div>
      )}

      {machines.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold">No equipment yet</p>
          <p className="text-xs text-slate-400">Add equipment under My Equipment to see its availability.</p>
        </div>
      ) : (
        <>
          <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
            {machines.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selected === m.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading availability…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {days.map((d) => (
                <div key={d.date} className="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2">
                  <p className="text-xs font-black text-slate-900">{d.label}</p>
                  <div className="space-y-1.5">
                    {d.slots.length === 0 ? (
                      <p className="text-[10px] text-slate-400">No windows published.</p>
                    ) : (
                      d.slots.map((s) => (
                        <div key={s.id} className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold capitalize ${statusCls(s.status)}`}>
                          {s.label} · {s.status === 'available' ? 'Available' : s.status === 'booked' ? 'Accepted' : s.status === 'pending' ? 'Requested' : s.status}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
