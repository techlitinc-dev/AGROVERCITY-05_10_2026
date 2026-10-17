import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, Pause, Pencil, Play, Plus, Repeat, Trash2, X } from 'lucide-react';
import { apiErrorMessage, customer } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { asRecords, formatDateTime, num, str, type AnyRecord } from './mallMappers';

const FREQUENCIES = ['daily', 'weekly', 'seasonal'] as const;
const GRADES = ['A', 'B', 'C'] as const;

interface SubscriptionRow {
  id: string;
  crop: string;
  grade?: string;
  qtyKg?: number;
  deliveryWindow?: string;
  frequency?: string;
  status?: string;
  nextRunAt?: string;
  farmerIds?: string[];
  createdAt?: string;
}

const FREQUENCY_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  seasonal: 'Seasonal',
};

export const CustomerSubscriptionsView: React.FC = () => {
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SubscriptionRow | null>(null);
  const [form, setForm] = useState({
    farmerId: '',
    crop: '',
    grade: 'A',
    qtyKg: '',
    deliveryWindow: 'Morning (6–10 AM)',
    frequency: 'weekly',
    priceMin: '',
    priceMax: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const payload = await customer.subscriptions();
      setSubs(
        asRecords(payload).map((s: AnyRecord) => ({
          id: str(s.id),
          crop: str(s.crop),
          grade: str(s.grade),
          qtyKg: typeof s.qtyKg === 'number' ? s.qtyKg : undefined,
          deliveryWindow: str(s.deliveryWindow),
          frequency: str(s.frequency),
          status: str(s.status, 'active'),
          nextRunAt: str(s.nextRunAt),
          farmerIds: Array.isArray(s.farmerIds) ? (s.farmerIds as string[]) : [],
          createdAt: str(s.createdAt),
        }))
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm({
      farmerId: '',
      crop: '',
      grade: 'A',
      qtyKg: '',
      deliveryWindow: 'Morning (6–10 AM)',
      frequency: 'weekly',
      priceMin: '',
      priceMax: '',
    });
    setEditing(null);
    setShowForm(false);
  };

  const handleCreate = async () => {
    setBusyId('new');
    setError(null);
    try {
      const priceBand: Record<string, number> = {};
      const minP = parseFloat(form.priceMin);
      const maxP = parseFloat(form.priceMax);
      if (!Number.isNaN(minP)) priceBand.min = Math.round(minP * 100);
      if (!Number.isNaN(maxP)) priceBand.max = Math.round(maxP * 100);
      await customer.createSubscription({
        farmerIds: [form.farmerId.trim()],
        crop: form.crop.trim(),
        grade: form.grade,
        qtyKg: parseFloat(form.qtyKg),
        targetPriceBandPaisa: priceBand,
        deliveryWindow: form.deliveryWindow,
        frequency: form.frequency,
      });
      setNotice('Subscription created — matching suppliers will be quoted automatically.');
      resetForm();
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChange = async (sub: SubscriptionRow, status: 'active' | 'paused') => {
    setBusyId(sub.id);
    setError(null);
    try {
      await customer.updateSubscription(sub.id, { status });
      setNotice(`Subscription ${status === 'paused' ? 'paused' : 'resumed'}.`);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleModify = async () => {
    if (!editing) return;
    setBusyId(editing.id);
    setError(null);
    try {
      const updates: Record<string, unknown> = {};
      const qty = parseFloat(form.qtyKg);
      if (!Number.isNaN(qty) && qty > 0) updates.qtyKg = qty;
      if (form.deliveryWindow.trim()) updates.deliveryWindow = form.deliveryWindow.trim();
      await customer.updateSubscription(editing.id, updates);
      setNotice('Subscription updated.');
      resetForm();
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (sub: SubscriptionRow) => {
    setBusyId(sub.id);
    setError(null);
    try {
      await customer.cancelSubscription(sub.id);
      setNotice('Subscription cancelled.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (sub: SubscriptionRow) => {
    setEditing(sub);
    setForm({
      farmerId: sub.farmerIds?.[0] ?? '',
      crop: sub.crop,
      grade: sub.grade ?? 'A',
      qtyKg: sub.qtyKg != null ? String(sub.qtyKg) : '',
      deliveryWindow: sub.deliveryWindow ?? '',
      frequency: (sub.frequency as (typeof FREQUENCIES)[number]) ?? 'weekly',
      priceMin: '',
      priceMax: '',
    });
    setShowForm(true);
  };

  const formValid =
    editing !== null
      ? parseFloat(form.qtyKg) > 0 || form.deliveryWindow.trim().length > 0
      : form.farmerId.trim().length > 0 &&
        form.crop.trim().length > 0 &&
        parseFloat(form.qtyKg) > 0 &&
        FREQUENCIES.includes(form.frequency as (typeof FREQUENCIES)[number]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Repeat className="w-7 h-7 text-emerald-600" />
            My Subscriptions
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Standing produce orders — set crop, quantity and frequency; we source from your preferred farmers
          </p>
        </div>
        <button
          type="button"
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 self-start sm:self-auto transition-all"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? 'Close' : 'New Subscription'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          {notice}
        </div>
      )}

      {/* Create / modify form */}
      {showForm && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">
            {editing ? `Modify subscription · ${editing.crop}` : 'Create a standing order'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {editing === null && (
              <>
                <input
                  type="text"
                  placeholder="Farmer ID (from storefront / offer)"
                  value={form.farmerId}
                  onChange={(e) => setForm((f) => ({ ...f, farmerId: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <input
                  type="text"
                  placeholder="Crop (e.g. Onion, Wheat)"
                  value={form.crop}
                  onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <select
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
              </>
            )}
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="Quantity (kg)"
              value={form.qtyKg}
              onChange={(e) => setForm((f) => ({ ...f, qtyKg: e.target.value }))}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
            <input
              type="text"
              placeholder="Delivery window (e.g. Morning 6–10 AM)"
              value={form.deliveryWindow}
              onChange={(e) => setForm((f) => ({ ...f, deliveryWindow: e.target.value }))}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
            {editing === null && (
              <>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
                >
                  {FREQUENCIES.map((freq) => (
                    <option key={freq} value={freq}>
                      {FREQUENCY_LABEL[freq]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Target price min (₹/kg, optional)"
                  value={form.priceMin}
                  onChange={(e) => setForm((f) => ({ ...f, priceMin: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Target price max (₹/kg, optional)"
                  value={form.priceMax}
                  onChange={(e) => setForm((f) => ({ ...f, priceMax: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
              </>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => (editing ? void handleModify() : void handleCreate())}
              disabled={!formValid || busyId !== null}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50"
            >
              {busyId !== null ? 'Saving…' : editing ? 'Save Changes' : 'Create Subscription'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3 mt-2" />
            </div>
          ))}
        </div>
      ) : subs.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Repeat className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-base text-slate-800">No subscriptions yet</h3>
          <p className="text-xs text-slate-500">
            Create a standing order for regular produce deliveries from your trusted farmers.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map((sub) => {
            const cancelled = sub.status === 'cancelled';
            const paused = sub.status === 'paused';
            return (
              <div
                key={sub.id}
                className={`bg-white rounded-3xl border shadow-xs p-5 space-y-3 ${
                  cancelled ? 'border-slate-200 opacity-70' : paused ? 'border-amber-200' : 'border-slate-200/80'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900 capitalize">
                      {sub.crop}
                      {sub.grade ? <span className="text-slate-400 font-bold"> · Grade {sub.grade}</span> : null}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {num(sub.qtyKg)} kg · {FREQUENCY_LABEL[sub.frequency ?? ''] ?? sub.frequency ?? '—'} · {sub.deliveryWindow || 'Any window'}
                    </p>
                  </div>
                  <StatusBadge status={sub.status ?? 'active'} />
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-500">
                  <span>
                    Farmer: <span className="font-bold text-slate-700">{sub.farmerIds?.[0] ?? '—'}</span>
                  </span>
                  {sub.nextRunAt && !cancelled && (
                    <span>
                      Next run: <span className="font-bold text-slate-700">{formatDateTime(sub.nextRunAt)}</span>
                    </span>
                  )}
                  <span>Started {formatDateTime(sub.createdAt)}</span>
                </div>

                {!cancelled && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {paused ? (
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(sub, 'active')}
                        disabled={busyId === sub.id}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Resume
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(sub, 'paused')}
                        disabled={busyId === sub.id}
                        className="px-3 py-2 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 font-bold text-[11px] flex items-center gap-1 disabled:opacity-50"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        Pause
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(sub)}
                      disabled={busyId === sub.id}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[11px] flex items-center gap-1 disabled:opacity-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Modify
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCancel(sub)}
                      disabled={busyId === sub.id}
                      className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[11px] flex items-center gap-1 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Tip: find farmer IDs from{' '}
        <Link to="/mall" className="text-emerald-700 font-bold underline">
          Krishi Mall
        </Link>{' '}
        storefront listings or your accepted quotes.
      </p>
    </div>
  );
};
