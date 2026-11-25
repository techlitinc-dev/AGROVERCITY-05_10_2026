import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Droplets,
  Leaf,
  Pencil,
  Plus,
  Sprout,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { apiErrorMessage, womenHub } from '../../lib/api';
import { asRecord, asRecords, pick, pickNum, pickStr, Rec } from '../shared/records';

/** xlsx Sr 4.0 — exact growth-stage pipeline. */
const STAGE_LABELS: Record<string, string> = {
  sowing: 'Sowing',
  sprout: 'Sprout',
  vegetative: 'Vegetative',
  flowering: 'Flowering',
  harvest: 'Harvest',
};
const STAGES = ['sowing', 'sprout', 'vegetative', 'flowering', 'harvest'];

/**
 * Kitchen Garden Planner (womenhub 21nov.xlsx Sr 4.0) — nutrition-tagged
 * crops, sowing → sprout → vegetative → flowering → harvest tracker,
 * seasonal planner, water/fertilizer reminders and yield log.
 */
export const GardenPlannerView: React.FC = () => {
  const [data, setData] = useState<Rec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cropForm, setCropForm] = useState<Rec | null>(null);
  const [reminderFor, setReminderFor] = useState<Rec | null>(null);
  const [yieldFor, setYieldFor] = useState<Rec | null>(null);

  const load = useCallback(async () => {
    try {
      setData(asRecord(await womenHub.gardenCrops()));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crops = data ? asRecords(pick(data, 'items')) : [];
  const dueReminders = data ? asRecords(pick(data, 'dueReminders')) : [];

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveCrop = () => {
    const form = cropForm;
    if (!form) return;
    const editingId = pickStr(form, 'id');
    void run(async () => {
      const payload = {
        name: pickStr(form, 'name'),
        nutrition: pickStr(form, 'nutrition'),
        season: pickStr(form, 'season'),
      };
      if (editingId) {
        await womenHub.updateGardenCrop(editingId, payload);
      } else {
        await womenHub.addGardenCrop(payload);
      }
      setCropForm(null);
    });
  };

  const advance = (crop: Rec) => {
    const current = pickStr(crop, 'stage') || 'sowing';
    const next = STAGES[STAGES.indexOf(current) + 1];
    if (!next) return;
    void run(() => womenHub.setCropStage(pickStr(crop, 'id'), next));
  };

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600';

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sprout className="w-7 h-7 text-emerald-600" />
            Kitchen Garden Planner
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track each crop from sowing to harvest, plan by season, and stay on top of
            water &amp; fertilizer reminders.
          </p>
        </div>
        <button
          onClick={() => setCropForm({ name: '', nutrition: '', season: '' })}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Crop
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border p-3 text-xs flex items-start gap-2 bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {dueReminders.length > 0 && (
        <div className="bg-white rounded-3xl border border-amber-200 shadow-xs p-4 space-y-2">
          <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" /> Reminders due
          </p>
          {dueReminders.map((r, i) => (
            <p key={i} className="text-[11px] text-slate-600">
              {pickStr(r, 'cropName')} — {pickStr(r, 'type')} due {pickStr(r, 'dueDate')} (
              {pickNum(r, 'daysLeft')} days)
            </p>
          ))}
        </div>
      )}

      {data && crops.length === 0 ? (
        <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8 text-center">
          No crops yet — add spinach, methi, tomato, carrot or drumstick to start tracking.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {crops.map((crop) => {
            const current = pickStr(crop, 'stage') || 'sowing';
            const stageIdx = STAGES.indexOf(current);
            const reminders = asRecords(pick(crop, 'reminders'));
            const yields = asRecords(pick(crop, 'yieldLog'));
            return (
              <div
                key={pickStr(crop, 'id')}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Leaf className="w-4 h-4 text-emerald-600" />
                      {pickStr(crop, 'name')}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {[pickStr(crop, 'nutrition') && `${pickStr(crop, 'nutrition')}`, pickStr(crop, 'season')]
                        .filter(Boolean)
                        .join(' · ')}
                      {pickStr(crop, 'sownOn') ? ` · sown ${pickStr(crop, 'sownOn')}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() =>
                        setCropForm({
                          id: pickStr(crop, 'id'),
                          name: pickStr(crop, 'name'),
                          nutrition: pickStr(crop, 'nutrition'),
                          season: pickStr(crop, 'season'),
                        })
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600"
                      title="Edit crop"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        void run(() => womenHub.deleteGardenCrop(pickStr(crop, 'id')))
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                      title="Delete crop"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Growth-stage tracker */}
                <div className="flex items-center gap-1">
                  {STAGES.map((stage, idx) => (
                    <div key={stage} className="flex items-center gap-1 flex-1">
                      <div
                        className={`h-2 flex-1 rounded-full ${
                          idx <= stageIdx ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] font-bold text-emerald-700">
                  Stage: {STAGE_LABELS[current]}
                  {current !== 'harvest' && (
                    <button
                      onClick={() => advance(crop)}
                      disabled={busy}
                      className="ml-2 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-bold hover:bg-emerald-100 disabled:opacity-40"
                    >
                      → {STAGE_LABELS[STAGES[stageIdx + 1]]}
                    </button>
                  )}
                </p>

                <div className="flex gap-2 text-[11px] font-bold">
                  <button
                    onClick={() => setReminderFor({ id: pickStr(crop, 'id'), type: 'water', dueDate: '' })}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 flex items-center gap-1"
                  >
                    <Droplets className="w-3 h-3" /> Water
                  </button>
                  <button
                    onClick={() =>
                      setReminderFor({ id: pickStr(crop, 'id'), type: 'fertilizer', dueDate: '' })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700"
                  >
                    Fertilizer
                  </button>
                  <button
                    onClick={() => setYieldFor({ id: pickStr(crop, 'id'), quantity: '', unit: 'kg' })}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1"
                  >
                    <TrendingUp className="w-3 h-3" /> Yield
                  </button>
                </div>

                {reminders.filter((r) => !pick(r, 'doneAt')).length > 0 && (
                  <div className="space-y-1">
                    {reminders
                      .filter((r) => !pick(r, 'doneAt'))
                      .map((r) => (
                        <div key={pickStr(r, 'id')} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">
                            {pickStr(r, 'type')} due {pickStr(r, 'dueDate')}
                          </span>
                          <button
                            onClick={() =>
                              void run(() =>
                                womenHub.completeCropReminder(pickStr(crop, 'id'), pickStr(r, 'id'))
                              )
                            }
                            className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-bold"
                          >
                            Done
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                {yields.length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Yield:{' '}
                    {yields
                      .map((y) => `${pickNum(y, 'quantity')} ${pickStr(y, 'unit')}`)
                      .join(', ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {cropForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-3">
            <h2 className="font-bold text-slate-900">
              {pickStr(cropForm, 'id') ? 'Edit Crop' : 'Add Crop'}
            </h2>
            <input
              className={field}
              placeholder="Crop name (spinach, methi, tomato…)"
              value={pickStr(cropForm, 'name')}
              onChange={(e) => setCropForm({ ...cropForm, name: e.target.value })}
            />
            <input
              className={field}
              placeholder="Nutrition tag (iron, vitamin A…)"
              value={pickStr(cropForm, 'nutrition')}
              onChange={(e) => setCropForm({ ...cropForm, nutrition: e.target.value })}
            />
            <input
              className={field}
              placeholder="Season (e.g. winter)"
              value={pickStr(cropForm, 'season')}
              onChange={(e) => setCropForm({ ...cropForm, season: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveCrop()}
                disabled={busy || !pickStr(cropForm, 'name').trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Saving…' : pickStr(cropForm, 'id') ? 'Save Changes' : 'Add Crop'}
              </button>
              <button
                onClick={() => setCropForm(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {reminderFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-5 space-y-3">
            <h2 className="font-bold text-slate-900 capitalize">
              {pickStr(reminderFor, 'type')} reminder
            </h2>
            <input
              className={field}
              type="date"
              value={pickStr(reminderFor, 'dueDate')}
              onChange={(e) => setReminderFor({ ...reminderFor, dueDate: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() =>
                  void run(async () => {
                    await womenHub.addCropReminder(pickStr(reminderFor, 'id'), {
                      type: pickStr(reminderFor, 'type'),
                      dueDate: pickStr(reminderFor, 'dueDate'),
                    });
                    setReminderFor(null);
                  })
                }
                disabled={busy || !pickStr(reminderFor, 'dueDate')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                Set Reminder
              </button>
              <button
                onClick={() => setReminderFor(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {yieldFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-5 space-y-3">
            <h2 className="font-bold text-slate-900">Log Yield</h2>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={field}
                type="number"
                placeholder="Quantity"
                value={pickStr(yieldFor, 'quantity')}
                onChange={(e) => setYieldFor({ ...yieldFor, quantity: e.target.value })}
              />
              <input
                className={field}
                placeholder="Unit"
                value={pickStr(yieldFor, 'unit')}
                onChange={(e) => setYieldFor({ ...yieldFor, unit: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() =>
                  void run(async () => {
                    await womenHub.logCropYield(pickStr(yieldFor, 'id'), {
                      date: new Date().toISOString().slice(0, 10),
                      quantity: Number(pickStr(yieldFor, 'quantity')) || 0,
                      unit: pickStr(yieldFor, 'unit') || 'kg',
                    });
                    setYieldFor(null);
                  })
                }
                disabled={busy || !pickStr(yieldFor, 'quantity')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                Log Yield
              </button>
              <button
                onClick={() => setYieldFor(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
