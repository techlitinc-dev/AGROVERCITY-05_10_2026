import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, ClipboardList, Plus, Trash2, X } from 'lucide-react';
import { apiErrorMessage, customer } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { asRecords, formatDateTime, num, str, type AnyRecord } from './mallMappers';

const UNITS = [
  { value: 'quintal', label: 'Quintal (100 kg)', factor: 1 },
  { value: 'kg', label: 'Kg', factor: 0.01 },
  { value: 'tonne', label: 'Tonne', factor: 10 },
] as const;

const FREQUENCIES = ['Daily', 'Weekly', 'Seasonal'] as const;
const GRADES = ['A', 'B', 'C'] as const;

interface DemandRow {
  id: string;
  crop: string;
  variety: string;
  grade: string;
  quantityQuintals: number;
  targetMinPrice: number;
  targetMaxPrice: number;
  recurringFrequency: string;
  deliveryWindow: string;
  district: string;
  notes: string;
  status: string;
  bidsCount: number;
  createdAt: string;
}

const EMPTY_FORM = {
  crop: '',
  variety: '',
  grade: 'A',
  quantity: '',
  unit: 'quintal' as (typeof UNITS)[number]['value'],
  priceMin: '',
  priceMax: '',
  recurringFrequency: 'Daily',
  neededBy: '',
  district: '',
  notes: '',
};

export const CustomerDemandsView: React.FC = () => {
  const [demands, setDemands] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const payload = await customer.demands();
      setDemands(
        asRecords(payload).map((d: AnyRecord) => ({
          id: str(d.id),
          crop: str(d.crop),
          variety: str(d.variety),
          grade: str(d.grade),
          quantityQuintals: num(d.quantityQuintals),
          targetMinPrice: num(d.targetMinPrice),
          targetMaxPrice: num(d.targetMaxPrice),
          recurringFrequency: str(d.recurringFrequency),
          deliveryWindow: str(d.deliveryWindow),
          district: str(d.district),
          notes: str(d.notes),
          status: str(d.status, 'open'),
          bidsCount: num(d.bidsCount),
          createdAt: str(d.createdAt),
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

  const set = (key: keyof typeof EMPTY_FORM) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleCreate = async () => {
    setError(null);
    setNotice(null);
    const qty = parseFloat(form.quantity);
    const minP = parseFloat(form.priceMin);
    const maxP = parseFloat(form.priceMax);
    if (!form.crop.trim()) {
      setError('Please enter the crop / commodity name.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (!Number.isFinite(minP) || minP <= 0 || !Number.isFinite(maxP) || maxP <= 0) {
      setError('Please enter a valid budget band (both min and max price per quintal).');
      return;
    }
    if (maxP < minP) {
      setError('Max price cannot be lower than min price.');
      return;
    }
    const unit = UNITS.find((u) => u.value === form.unit) ?? UNITS[0];
    setSaving(true);
    try {
      await customer.createDemand({
        crop: form.crop.trim(),
        variety: form.variety.trim() || 'Standard',
        grade: form.grade,
        quantityQuintals: Math.round(qty * unit.factor * 1000) / 1000,
        targetMinPrice: minP,
        targetMaxPrice: maxP,
        recurringFrequency: form.recurringFrequency,
        deliveryWindow: form.neededBy ? `Needed by ${form.neededBy}` : '7 Days',
        district: form.district.trim(),
        notes: form.notes.trim(),
      });
      setNotice(`Purchase request for "${form.crop.trim()}" posted — sellers can now quote against it.`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await customer.removeDemand(id);
      setDemands((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-emerald-600" />
            My Purchase Requests
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tell sellers what you need — crop, quantity and budget — and let quotes come to you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? 'Close' : 'New purchase request'}</span>
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* New request form */}
      {showForm && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="font-bold text-sm text-slate-900">New purchase request</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Crop / commodity *</span>
              <input
                type="text"
                value={form.crop}
                onChange={set('crop')}
                placeholder="e.g. Organic Sharbati Wheat"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Variety (optional)</span>
              <input
                type="text"
                value={form.variety}
                onChange={set('variety')}
                placeholder="e.g. Sharbati"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Quantity *</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={set('quantity')}
                  placeholder="e.g. 120"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <select
                  value={form.unit}
                  onChange={set('unit')}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Grade</span>
              <select
                value={form.grade}
                onChange={set('grade')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Budget min (₹ / quintal) *</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.priceMin}
                onChange={set('priceMin')}
                placeholder="e.g. 3100"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Budget max (₹ / quintal) *</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.priceMax}
                onChange={set('priceMax')}
                placeholder="e.g. 3350"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Recurring</span>
              <select
                value={form.recurringFrequency}
                onChange={set('recurringFrequency')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Needed by (optional)</span>
              <input
                type="date"
                value={form.neededBy}
                onChange={set('neededBy')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600">Delivery location</span>
              <input
                type="text"
                value={form.district}
                onChange={set('district')}
                placeholder="e.g. Nashik, Maharashtra"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[11px] font-bold text-slate-600">Notes for sellers (optional)</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={set('notes')}
                placeholder="Quality expectations, packaging, payment terms…"
                maxLength={500}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </label>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Posting…' : 'Post request'}
            </button>
            <span className="text-[10px] text-slate-400">Sellers matching your demand will see it in their feed.</span>
          </div>
        </div>
      )}

      {/* My requests */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-5 animate-pulse space-y-2">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : demands.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 py-14 text-center">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            No purchase requests yet. Post what you need and let sellers come to you with quotes.
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              Create your first request
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {demands.map((d) => (
            <div key={d.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-tight">
                    {d.crop}
                    {d.variety && d.variety !== 'Standard' ? ` · ${d.variety}` : ''}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {d.quantityQuintals} quintals
                    {d.grade ? ` · Grade ${d.grade}` : ''}
                    {d.district ? ` · ${d.district}` : ''}
                    {d.recurringFrequency ? ` · ${d.recurringFrequency}` : ''}
                  </p>
                </div>
                <StatusBadge status={d.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                <span>
                  Budget: <b className="text-slate-800">₹{d.targetMinPrice.toLocaleString('en-IN')}–{d.targetMaxPrice.toLocaleString('en-IN')}</b> / quintal
                </span>
                {d.deliveryWindow && <span>Delivery: {d.deliveryWindow}</span>}
                <span className={d.bidsCount > 0 ? 'font-bold text-emerald-700' : 'text-slate-400'}>
                  {d.bidsCount > 0 ? `${d.bidsCount} offer${d.bidsCount === 1 ? '' : 's'} received` : 'No offers yet'}
                </span>
                <span className="text-slate-400">Posted {formatDateTime(d.createdAt)}</span>
              </div>
              {d.notes && <p className="text-[11px] text-slate-500 italic">"{d.notes}"</p>}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleDelete(d.id)}
                  disabled={busyId === d.id}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:border-rose-200 flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{busyId === d.id ? 'Removing…' : 'Withdraw'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
