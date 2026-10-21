import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  Check,
  Clock,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';
import { ApiError, apiErrorMessage, customer, readList } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { asRecords, formatDateTime, num, str, type AnyRecord } from './mallMappers';

const FREQUENCIES = ['daily', 'weekly', 'fortnightly', 'seasonal'] as const;
const GRADES = ['A', 'B', 'C'] as const;
const DELIVERY_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const DELIVERY_SLOTS = ['7–10 AM', '10–1 PM', '4–7 PM'] as const;
const UNITS = ['kg', 'g', 'L', 'dozen', 'bunch'] as const;
// Fallback quick-pick list when GET /customer/seasonal is unavailable.
const STATIC_SEASONAL_PICKS = ['Tomato', 'Onion', 'Spinach', 'Coriander', 'Okra', 'Brinjal', 'Carrot', 'Cauliflower'];

interface BasketItem {
  name: string;
  quantity: number;
  unit: string;
}

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
  items?: BasketItem[];
  deliveryDay?: string;
  deliverySlot?: string;
  skipDates?: string[];
  createdAt?: string;
}

const FREQUENCY_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  seasonal: 'Seasonal',
};

export const CustomerSubscriptionsView: React.FC = () => {
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [boxesUnavailable, setBoxesUnavailable] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SubscriptionRow | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(STATIC_SEASONAL_PICKS);
  const [form, setForm] = useState({
    farmerId: '',
    crop: '',
    grade: 'A',
    qtyKg: '',
    deliveryWindow: 'Morning (6–10 AM)',
    frequency: 'weekly',
    priceMin: '',
    priceMax: '',
    deliveryDay: 'Monday',
    deliverySlot: '7–10 AM',
  });
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [newItem, setNewItem] = useState({ name: '', quantity: '1', unit: 'kg' });

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
          items: Array.isArray(s.items) ? (s.items as BasketItem[]) : undefined,
          deliveryDay: str(s.deliveryDay),
          deliverySlot: str(s.deliverySlot),
          skipDates: Array.isArray(s.skipDates) ? (s.skipDates as string[]) : undefined,
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

  // Seasonal quick-pick suggestions; static list when the endpoint is absent.
  useEffect(() => {
    let mounted = true;
    readList<AnyRecord>('/customer/seasonal')
      .then((rows) => {
        if (!mounted) return;
        const names = rows
          .map((row) => str(row.crop) || str(row.name) || str(row.title))
          .filter(Boolean);
        if (names.length > 0) setSuggestions(names.slice(0, 8));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
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
      deliveryDay: 'Monday',
      deliverySlot: '7–10 AM',
    });
    setBasket([]);
    setNewItem({ name: '', quantity: '1', unit: 'kg' });
    setEditing(null);
    setShowForm(false);
  };

  const addBasketItem = () => {
    const name = newItem.name.trim();
    const quantity = parseFloat(newItem.quantity);
    if (!name || Number.isNaN(quantity) || quantity <= 0) return;
    setBasket((prev) => [...prev, { name, quantity, unit: newItem.unit }]);
    setNewItem({ name: '', quantity: '1', unit: newItem.unit });
  };

  const basketWeight = basket.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const handleCreate = async () => {
    setBusyId('new');
    setError(null);
    try {
      const priceBand: Record<string, number> = {};
      const minP = parseFloat(form.priceMin);
      const maxP = parseFloat(form.priceMax);
      if (!Number.isNaN(minP)) priceBand.min = Math.round(minP * 100);
      if (!Number.isNaN(maxP)) priceBand.max = Math.round(maxP * 100);
      const parsedQty = parseFloat(form.qtyKg);
      const qtyKg = !Number.isNaN(parsedQty) && parsedQty > 0 ? parsedQty : basketWeight;
      await customer.createSubscription({
        farmerIds: [form.farmerId.trim()],
        crop: form.crop.trim(),
        grade: form.grade,
        qtyKg,
        targetPriceBandPaisa: priceBand,
        deliveryWindow: form.deliveryWindow,
        frequency: form.frequency,
        items: basket,
        deliveryDay: form.deliveryDay,
        deliverySlot: form.deliverySlot,
      });
      setNotice('Subscription box created — matching suppliers will be quoted automatically.');
      resetForm();
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'FEATURE_DISABLED') setBoxesUnavailable(true);
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

  const handleSkipNext = async (sub: SubscriptionRow) => {
    setBusyId(sub.id);
    setError(null);
    try {
      await customer.updateSubscription(sub.id, { skipNext: true });
      setNotice(`Next ${FREQUENCY_LABEL[sub.frequency ?? 'weekly']?.toLowerCase() ?? ''} delivery skipped for ${sub.crop}.`);
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
      const updates: Record<string, unknown> = {
        deliveryDay: form.deliveryDay,
        deliverySlot: form.deliverySlot,
      };
      const qty = parseFloat(form.qtyKg);
      if (!Number.isNaN(qty) && qty > 0) updates.qtyKg = qty;
      if (form.deliveryWindow.trim()) updates.deliveryWindow = form.deliveryWindow.trim();
      if (basket.length > 0) updates.items = basket;
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
      grade: (sub.grade as (typeof GRADES)[number]) ?? 'A',
      qtyKg: sub.qtyKg != null ? String(sub.qtyKg) : '',
      deliveryWindow: sub.deliveryWindow ?? '',
      frequency: (sub.frequency as (typeof FREQUENCIES)[number]) ?? 'weekly',
      priceMin: '',
      priceMax: '',
      deliveryDay: (sub.deliveryDay as (typeof DELIVERY_DAYS)[number]) ?? 'Monday',
      deliverySlot: (sub.deliverySlot as (typeof DELIVERY_SLOTS)[number]) ?? '7–10 AM',
    });
    setBasket(Array.isArray(sub.items) ? sub.items : []);
    setShowForm(true);
  };

  const formValid =
    editing !== null
      ? parseFloat(form.qtyKg) > 0 || form.deliveryWindow.trim().length > 0 || basket.length > 0
      : form.farmerId.trim().length > 0 &&
        form.crop.trim().length > 0 &&
        (parseFloat(form.qtyKg) > 0 || basket.length > 0) &&
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
            Veggie-box standing orders — build a basket, pick a delivery day & slot, and skip any week
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

      {boxesUnavailable && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-900 flex items-center gap-2">
          <Ban className="w-4 h-4 shrink-0" />
          Subscription boxes are temporarily unavailable — please check back soon.
        </div>
      )}
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
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">
            {editing ? `Modify subscription · ${editing.crop}` : 'Create a veggie-box subscription'}
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
                  placeholder="Box name (e.g. Weekly Veggie Box)"
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
              placeholder="Total weight (kg, optional if items added)"
              value={form.qtyKg}
              onChange={(e) => setForm((f) => ({ ...f, qtyKg: e.target.value }))}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
            <input
              type="text"
              placeholder="Delivery window note (e.g. Morning)"
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
            <select
              value={form.deliveryDay}
              onChange={(e) => setForm((f) => ({ ...f, deliveryDay: e.target.value }))}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
            >
              {DELIVERY_DAYS.map((day) => (
                <option key={day} value={day}>
                  Every {day}
                </option>
              ))}
            </select>
            <select
              value={form.deliverySlot}
              onChange={(e) => setForm((f) => ({ ...f, deliverySlot: e.target.value }))}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
            >
              {DELIVERY_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          {/* Basket items (SR 7) */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-700">Box items</p>
            {basket.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {basket.map((item, idx) => (
                  <span
                    key={`${item.name}-${idx}`}
                    className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-800 flex items-center gap-1.5"
                  >
                    {item.name} · {item.quantity} {item.unit}
                    <button
                      type="button"
                      onClick={() => setBasket((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-emerald-400 hover:text-rose-500"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Item (e.g. Tomato)"
                value={newItem.name}
                onChange={(e) => setNewItem((it) => ({ ...it, name: e.target.value }))}
                className="flex-1 min-w-32 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
              <input
                type="number"
                min="0"
                step="0.25"
                placeholder="Qty"
                value={newItem.quantity}
                onChange={(e) => setNewItem((it) => ({ ...it, quantity: e.target.value }))}
                className="w-24 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
              <select
                value={newItem.unit}
                onChange={(e) => setNewItem((it) => ({ ...it, unit: e.target.value }))}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addBasketItem}
                disabled={!newItem.name.trim() || !(parseFloat(newItem.quantity) > 0)}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-50"
              >
                Add Item
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setNewItem((it) => ({ ...it, name }))}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg border border-dashed border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                >
                  + {name}
                </button>
              ))}
            </div>
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
            Build a veggie box and get regular produce deliveries from your trusted farmers.
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
                    <p className="text-sm font-black text-slate-900">{sub.crop}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {num(sub.qtyKg)} kg · {FREQUENCY_LABEL[sub.frequency ?? ''] ?? sub.frequency ?? '—'} ·{' '}
                      {sub.deliveryDay ? `every ${sub.deliveryDay}` : sub.deliveryWindow || 'Any window'}
                      {sub.deliverySlot ? ` · ${sub.deliverySlot}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={sub.status ?? 'active'} />
                </div>

                {Array.isArray(sub.items) && sub.items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sub.items.map((item, idx) => (
                      <span
                        key={`${item.name}-${idx}`}
                        className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-600"
                      >
                        {item.name} × {item.quantity} {item.unit}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-500">
                  <span>
                    Farmer: <span className="font-bold text-slate-700">{sub.farmerIds?.[0] ?? '—'}</span>
                  </span>
                  {sub.nextRunAt && !cancelled && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Next run: <span className="font-bold text-slate-700">{formatDateTime(sub.nextRunAt)}</span>
                    </span>
                  )}
                  {Array.isArray(sub.skipDates) && sub.skipDates.length > 0 && !cancelled && (
                    <span>
                      Skipped: <span className="font-bold text-amber-700">{sub.skipDates.join(', ')}</span>
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
                      <>
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(sub, 'paused')}
                          disabled={busyId === sub.id}
                          className="px-3 py-2 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 font-bold text-[11px] flex items-center gap-1 disabled:opacity-50"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          Pause
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSkipNext(sub)}
                          disabled={busyId === sub.id}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[11px] flex items-center gap-1 disabled:opacity-50"
                        >
                          Skip next delivery
                        </button>
                      </>
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
