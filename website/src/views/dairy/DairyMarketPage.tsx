import React, { useEffect, useState } from 'react';
import {
  Store,
  Plus,
  Handshake,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Star,
  Repeat,
} from 'lucide-react';
import { dairy, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf, todayStr } from './helpers';

type MarketTab = 'demands' | 'standing' | 'offers' | 'bids';

const TABS: { id: MarketTab; label: string }[] = [
  { id: 'demands', label: 'Procurement Demands' },
  { id: 'standing', label: 'Standing Orders' },
  { id: 'offers', label: 'Farmer Offers' },
  { id: 'bids', label: 'My Bids' },
];

/**
 * Dairy procurement market — post demands, run standing orders, discover
 * farmer offers and negotiate RFQ bids (3-round counter, accept creates the
 * purchase). All surfaces hit the live dairy-manager / dairy hub endpoints.
 */
export const DairyMarketPage: React.FC = () => {
  const [tab, setTab] = useState<MarketTab>('demands');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Store className="w-7 h-7 text-emerald-600" />
            Dairy Procurement Market
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Post milk demands, run standing orders, discover farmer offers and close supply bids
          </p>
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

      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
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

      {tab === 'demands' && <DemandsBoard onError={setError} onNotice={setNotice} />}
      {tab === 'standing' && <StandingOrdersBoard onError={setError} onNotice={setNotice} />}
      {tab === 'offers' && <FarmerOffersBoard onError={setError} onNotice={setNotice} />}
      {tab === 'bids' && <MyBidsBoard onError={setError} onNotice={setNotice} />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Demands — my posts + live public demand board                       */
/* ------------------------------------------------------------------ */

const DemandsBoard: React.FC<{ onError: (m: string | null) => void; onNotice: (m: string | null) => void }> = ({
  onError,
  onNotice,
}) => {
  const [mine, setMine] = useState<Record<string, unknown>[]>([]);
  const [board, setBoard] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    milkType: 'Buffalo',
    minFatPercent: 6.5,
    minSnfPercent: 9.0,
    dailyQuantityLiters: 100,
    targetRatePerLiter: 64,
    recurringFrequency: 'Daily',
    procurementZone: '',
    notes: '',
  });

  const reload = async () => {
    setLoading(true);
    onError(null);
    try {
      const [m, b] = await Promise.all([dairy.manager.demands(), dairy.demandsBrowse()]);
      setMine(recArr(m));
      setBoard(recArr(b));
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
      await dairy.manager.createDemand({ ...form });
      setCreateOpen(false);
      onNotice('Demand posted — it is now live for every farmer on the demand board.');
      await reload();
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-600" /> My Demands ({mine.length})
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
            <Plus className="w-3.5 h-3.5" /> Post Demand
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading demands…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(mine.length === 0 ? [] : mine).map((d) => (
            <DemandCard key={strOf(d.id)} d={d} mine />
          ))}
          {mine.length === 0 && (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-6 text-xs text-slate-400 md:col-span-2">
              No demands posted yet — post your procurement need and farmers will see it on their board.
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="font-bold text-sm text-slate-900 mb-3">Live Demand Board (farmer view)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {board.slice(0, 8).map((d) => (
            <DemandCard key={strOf(d.id)} d={d} />
          ))}
          {board.length === 0 && !loading && (
            <p className="text-xs text-slate-400 md:col-span-2">No active demands on the public board right now.</p>
          )}
        </div>
      </div>

      <ModalSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Post Procurement Demand"
        description="Requires FSSAI KYC. The demand goes live for every farmer on the platform."
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Milk Type *</label>
              <select
                value={form.milkType}
                onChange={(e) => setForm({ ...form, milkType: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option>Buffalo</option>
                <option>Cow</option>
                <option>Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Recurring *</label>
              <select
                value={form.recurringFrequency}
                onChange={(e) => setForm({ ...form, recurringFrequency: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Festival / seasonal</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min FAT % *</label>
              <input
                type="number"
                step="0.1"
                min="2"
                max="12"
                value={form.minFatPercent}
                onChange={(e) => setForm({ ...form, minFatPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min SNF % *</label>
              <input
                type="number"
                step="0.1"
                min="5"
                max="12"
                value={form.minSnfPercent}
                onChange={(e) => setForm({ ...form, minSnfPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Daily Quantity (L) *</label>
              <input
                type="number"
                step="1"
                min="1"
                value={form.dailyQuantityLiters}
                onChange={(e) => setForm({ ...form, dailyQuantityLiters: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Rate (₹/L) *</label>
              <input
                type="number"
                step="0.25"
                min="1"
                value={form.targetRatePerLiter}
                onChange={(e) => setForm({ ...form, targetRatePerLiter: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Procurement Zone</label>
            <input
              type="text"
              value={form.procurementZone}
              onChange={(e) => setForm({ ...form, procurementZone: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="e.g. Ozar, Nashik district"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              rows={2}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Posting…' : 'Post Demand'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

const DemandCard: React.FC<{ d: Record<string, unknown>; mine?: boolean }> = ({ d, mine }) => {
  const summary = asRec(d.dairySummary);
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-slate-900 capitalize">{strOf(d.milkType, 'Milk')} milk</span>
        <StatusBadge status={strOf(d.status, 'active')} />
      </div>
      <p className="text-xs text-slate-600">
        {numOf(d.dailyQuantityLiters)} L/day @ target {formatCurrency(numOf(d.targetRatePerLiter))}/L
      </p>
      <p className="text-[11px] text-slate-400">
        FAT ≥ {numOf(d.minFatPercent).toFixed(1)}% • SNF ≥ {numOf(d.minSnfPercent).toFixed(1)}% •{' '}
        {strOf(d.recurringFrequency, 'Daily')}
      </p>
      {!mine && nameOf(summary) !== '—' && (
        <p className="text-[11px] text-slate-500">
          {nameOf(summary)} • {numOf(d.bidsCount)} live bid(s)
        </p>
      )}
      {mine && numOf(d.bidsCount) > 0 && (
        <p className="text-[11px] font-bold text-amber-700">{numOf(d.bidsCount)} farmer bid(s) waiting</p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Standing orders — full-spec recurring contracts                     */
/* ------------------------------------------------------------------ */

const EMPTY_STANDING = {
  milkType: 'Buffalo',
  minFatPercent: 6.0,
  minSnfPercent: 9.0,
  quantityPerSlotLiters: 100,
  frequency: 'daily',
  minRatePerLiter: 62,
  maxRatePerLiter: 68,
  startDate: todayStr(),
  endDate: todayStr(),
  procurementZone: '',
  pickupSlot: '',
  notes: '',
};

const StandingOrdersBoard: React.FC<{ onError: (m: string | null) => void; onNotice: (m: string | null) => void }> = ({
  onError,
  onNotice,
}) => {
  const [mine, setMine] = useState<Record<string, unknown>[]>([]);
  const [browse, setBrowse] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(EMPTY_STANDING);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    onError(null);
    try {
      const [m, b] = await Promise.all([dairy.standingOrders(), dairy.standingBrowse()]);
      setMine(recArr(m));
      setBrowse(recArr(b));
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
    setForm(EMPTY_STANDING);
    setModalOpen(true);
  };

  const openEdit = (o: Record<string, unknown>) => {
    setEditing(o);
    setForm({
      milkType: strOf(o.milkType, 'Buffalo') || 'Buffalo',
      minFatPercent: numOf(o.minFatPercent, 6),
      minSnfPercent: numOf(o.minSnfPercent, 9),
      quantityPerSlotLiters: numOf(o.quantityPerSlotLiters, 100),
      frequency: strOf(o.frequency, 'daily') || 'daily',
      minRatePerLiter: numOf(o.minRatePerLiter),
      maxRatePerLiter: numOf(o.maxRatePerLiter),
      startDate: strOf(o.startDate, todayStr()) || todayStr(),
      endDate: strOf(o.endDate, todayStr()) || todayStr(),
      procurementZone: strOf(o.procurementZone),
      pickupSlot: strOf(o.pickupSlot),
      notes: strOf(o.notes),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    onError(null);
    onNotice(null);
    try {
      if (editing) {
        await dairy.updateStandingOrder(strOf(editing.id), { ...form });
        onNotice('Standing order updated.');
      } else {
        await dairy.createStandingOrder({ ...form });
        onNotice('Standing order published — farmers can now discover it.');
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (o: Record<string, unknown>) => {
    if (!window.confirm(`Close standing order ${strOf(o.milkType)}? Farmers will no longer see it.`)) return;
    onError(null);
    try {
      await dairy.closeStandingOrder(strOf(o.id));
      onNotice('Standing order closed.');
      await reload();
    } catch (err) {
      onError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Repeat className="w-4 h-4 text-emerald-600" /> My Standing Orders ({mine.length})
        </h3>
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
            <Plus className="w-3.5 h-3.5" /> New Standing Order
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading standing orders…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mine.map((o) => (
            <div key={strOf(o.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 capitalize">{strOf(o.milkType)} milk</span>
                <StatusBadge status={strOf(o.status, 'open')} />
              </div>
              <p className="text-xs text-slate-600">
                {numOf(o.quantityPerSlotLiters)} L/{strOf(o.frequency, 'daily')} • band{' '}
                {formatCurrency(numOf(o.minRatePerLiter))}–{formatCurrency(numOf(o.maxRatePerLiter))}/L
              </p>
              <p className="text-[11px] text-slate-400">
                {formatDate(strOf(o.startDate))} → {formatDate(strOf(o.endDate))}
                {strOf(o.pickupSlot) ? ` • ${strOf(o.pickupSlot)}` : ''}
              </p>
              {strOf(o.status, 'open') === 'open' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => openEdit(o)}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleClose(o)}
                    className="px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px]"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          ))}
          {mine.length === 0 && (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-6 text-xs text-slate-400 md:col-span-2">
              No standing orders yet — create a full-spec recurring contract for your steady wholesalers.
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="font-bold text-sm text-slate-900 mb-3">Open Standing Orders (public browse)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {browse.slice(0, 8).map((o) => (
            <div key={strOf(o.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 capitalize">{strOf(o.milkType)} milk</span>
                <span className="text-[10px] text-slate-400">{nameOf(asRec(o.dairySummary))}</span>
              </div>
              <p className="text-xs text-slate-600">
                {numOf(o.quantityPerSlotLiters)} L/{strOf(o.frequency, 'daily')} • band{' '}
                {formatCurrency(numOf(o.minRatePerLiter))}–{formatCurrency(numOf(o.maxRatePerLiter))}/L
              </p>
              <p className="text-[11px] text-slate-400">
                {formatDate(strOf(o.startDate))} → {formatDate(strOf(o.endDate))}
              </p>
            </div>
          ))}
          {browse.length === 0 && !loading && (
            <p className="text-xs text-slate-400 md:col-span-2">No open standing orders on the board.</p>
          )}
        </div>
      </div>

      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Standing Order' : 'New Standing Order'}
        description="Full-spec recurring contract — farmers discover it on the standing browse board."
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Milk Type *</label>
              <select
                value={form.milkType}
                onChange={(e) => setForm({ ...form, milkType: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option>Buffalo</option>
                <option>Cow</option>
                <option>Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Frequency *</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min FAT % *</label>
              <input
                type="number"
                step="0.1"
                min="2"
                max="12"
                value={form.minFatPercent}
                onChange={(e) => setForm({ ...form, minFatPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min SNF % *</label>
              <input
                type="number"
                step="0.1"
                min="5"
                max="12"
                value={form.minSnfPercent}
                onChange={(e) => setForm({ ...form, minSnfPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Quantity per slot (L) *</label>
            <input
              type="number"
              step="1"
              min="1"
              value={form.quantityPerSlotLiters}
              onChange={(e) => setForm({ ...form, quantityPerSlotLiters: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min Rate (₹/L) *</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={form.minRatePerLiter}
                onChange={(e) => setForm({ ...form, minRatePerLiter: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Max Rate (₹/L) *</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={form.maxRatePerLiter}
                onChange={(e) => setForm({ ...form, maxRatePerLiter: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">End Date *</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Slot</label>
              <input
                type="text"
                value={form.pickupSlot}
                onChange={(e) => setForm({ ...form, pickupSlot: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                placeholder="Morning (06:00–08:30)"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Procurement Zone</label>
              <input
                type="text"
                value={form.procurementZone}
                onChange={(e) => setForm({ ...form, procurementZone: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Publish Standing Order'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Farmer offers — browse + farmer card + place bid                    */
/* ------------------------------------------------------------------ */

const FarmerOffersBoard: React.FC<{ onError: (m: string | null) => void; onNotice: (m: string | null) => void }> = ({
  onError,
  onNotice,
}) => {
  const [offers, setOffers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidFor, setBidFor] = useState<Record<string, unknown> | null>(null);
  const [farmerCard, setFarmerCard] = useState<Record<string, unknown> | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [bidForm, setBidForm] = useState({ offeredRatePerLiter: 64, dailyLiters: 50, transportIncluded: true, pickupSlot: 'Morning (06:00 - 08:30 AM)', notes: '' });
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    onError(null);
    try {
      setOffers(recArr(await dairy.bidsBrowse()));
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

  const openFarmerCard = async (farmerId: string) => {
    setCardLoading(true);
    setFarmerCard(null);
    try {
      setFarmerCard(asRec(await dairy.farmer(farmerId)));
    } catch (e) {
      onError(apiErrorMessage(e));
    } finally {
      setCardLoading(false);
    }
  };

  const openBid = (offer: Record<string, unknown>) => {
    setBidFor(offer);
    setBidForm({
      offeredRatePerLiter: numOf(offer.askingRatePerLiter, numOf(offer.offeredRatePerLiter, 64)) || 64,
      dailyLiters: numOf(offer.dailyLiters, 50) || 50,
      transportIncluded: true,
      pickupSlot: 'Morning (06:00 - 08:30 AM)',
      notes: '',
    });
  };

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidFor) return;
    setSaving(true);
    onError(null);
    onNotice(null);
    try {
      const farmerSummary = asRec(bidFor.farmerSummary);
      await dairy.manager.createBid({
        rfqId: strOf(bidFor.rfqId) || undefined,
        farmerId: strOf(bidFor.farmerId) || strOf(bidFor.farmerUid),
        farmerName: nameOf(farmerSummary, strOf(bidFor.farmerName, 'Farmer')),
        milkType: strOf(bidFor.milkType, 'Buffalo'),
        ...bidForm,
      });
      setBidFor(null);
      onNotice('Bid submitted — negotiation opens in My Bids (max 3 rounds).');
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900">Live Farmer Offers ({offers.length})</h3>
        <button
          onClick={reload}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading farmer offers…</p>
      ) : offers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
          No farmer milk offers live right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {offers.map((o) => {
            const summary = asRec(o.farmerSummary);
            return (
              <div key={strOf(o.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 capitalize">
                    {numOf(o.dailyLiters)} L/day {strOf(o.milkType, '').toLowerCase()} milk
                  </span>
                  <StatusBadge status={strOf(o.status, 'pending')} />
                </div>
                <p className="text-xs text-slate-600">
                  Asking {formatCurrency(numOf(o.askingRatePerLiter, numOf(o.offeredRatePerLiter)))}/L
                  {numOf(o.fatPercent) > 0 && ` • FAT ${numOf(o.fatPercent).toFixed(1)}%`}
                </p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500" />
                  {nameOf(summary, strOf(o.farmerName, 'Farmer'))}
                  {numOf(summary.ratingAverage) > 0 && ` • ${numOf(summary.ratingAverage).toFixed(1)}★`}
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => openBid(o)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                  >
                    Place Bid <ArrowRight className="w-3 h-3" />
                  </button>
                  {(strOf(o.farmerId) || strOf(o.farmerUid)) && (
                    <button
                      onClick={() => openFarmerCard(strOf(o.farmerId) || strOf(o.farmerUid))}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px]"
                    >
                      Farmer Card
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Farmer card modal */}
      <ModalSheet
        isOpen={cardLoading || Boolean(farmerCard)}
        onClose={() => setFarmerCard(null)}
        title={farmerCard ? nameOf(farmerCard) : undefined}
        description="Public farmer reliability card from other dairies' ratings"
        maxWidth="md"
      >
        {cardLoading ? (
          <p className="text-xs text-slate-400">Loading farmer card…</p>
        ) : !farmerCard ? null : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Rating', value: numOf(farmerCard.ratingAverage) > 0 ? `${numOf(farmerCard.ratingAverage).toFixed(1)} ★` : 'New' },
                { label: 'Reviews', value: String(numOf(farmerCard.ratingCount)) },
                { label: 'Deliveries', value: String(numOf(farmerCard.completedDeliveries)) },
              ].map((s) => (
                <div key={s.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400">{s.label}</p>
                  <p className="text-sm font-black text-slate-900">{s.value}</p>
                </div>
              ))}
            </div>
            {recArr(farmerCard.reviews).length > 0 && (
              <div className="space-y-2">
                {recArr(farmerCard.reviews)
                  .slice(0, 5)
                  .map((r, i) => (
                    <div key={strOf(r.id) || i} className="border border-slate-100 rounded-2xl p-3 text-xs">
                      <span className="font-bold text-amber-600">{numOf(r.stars)}★</span>{' '}
                      <span className="text-slate-600">{strOf(r.comment) || strOf(r.note) || 'Rated'}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </ModalSheet>

      {/* Place bid modal */}
      <ModalSheet
        isOpen={Boolean(bidFor)}
        onClose={() => setBidFor(null)}
        title="Submit Supply Bid"
        description="The farmer can counter — up to 3 negotiation rounds, then accept creates the purchase."
        maxWidth="md"
      >
        <form onSubmit={handleBid} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Offered Rate (₹/L) *</label>
              <input
                type="number"
                step="0.25"
                min="1"
                value={bidForm.offeredRatePerLiter}
                onChange={(e) => setBidForm({ ...bidForm, offeredRatePerLiter: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Daily Liters *</label>
              <input
                type="number"
                step="1"
                min="1"
                value={bidForm.dailyLiters}
                onChange={(e) => setBidForm({ ...bidForm, dailyLiters: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Slot</label>
            <select
              value={bidForm.pickupSlot}
              onChange={(e) => setBidForm({ ...bidForm, pickupSlot: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option>Morning (06:00 - 08:30 AM)</option>
              <option>Evening (05:30 - 07:30 PM)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={bidForm.transportIncluded}
              onChange={(e) => setBidForm({ ...bidForm, transportIncluded: e.target.checked })}
              className="w-4 h-4 accent-emerald-600"
            />
            Transport included by my dairy
          </label>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <textarea
              value={bidForm.notes}
              onChange={(e) => setBidForm({ ...bidForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              rows={2}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Submitting…' : 'Submit Bid'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* My bids — inbox, counter, accept                                    */
/* ------------------------------------------------------------------ */

const MyBidsBoard: React.FC<{ onError: (m: string | null) => void; onNotice: (m: string | null) => void }> = ({
  onError,
  onNotice,
}) => {
  const [bids, setBids] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [counterFor, setCounterFor] = useState<Record<string, unknown> | null>(null);
  const [counterRate, setCounterRate] = useState(0);
  const [counterTerms, setCounterTerms] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    onError(null);
    try {
      setBids(recArr(await dairy.manager.bids()));
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

  const openCounter = (b: Record<string, unknown>) => {
    setCounterFor(b);
    setCounterRate(numOf(b.counterRatePerLiter, numOf(b.offeredRatePerLiter)));
    setCounterTerms(strOf(b.terms));
  };

  const handleCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterFor) return;
    setSaving(true);
    onError(null);
    onNotice(null);
    try {
      await dairy.manager.counterBid(strOf(counterFor.id), {
        counterRatePerLiter: counterRate,
        terms: counterTerms,
      });
      setCounterFor(null);
      onNotice('Counter offer sent — the farmer is notified.');
      await reload();
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (b: Record<string, unknown>) => {
    if (!window.confirm(`Accept ${nameOf(b)}'s bid at ${formatCurrency(numOf(b.offeredRatePerLiter, numOf(b.counterRatePerLiter)))}/L? This creates the purchase contract.`))
      return;
    onError(null);
    onNotice(null);
    try {
      await dairy.manager.acceptBid(strOf(b.id));
      onNotice('Bid accepted — purchase created, chat room opened with the farmer.');
      await reload();
    } catch (err) {
      onError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Handshake className="w-4 h-4 text-emerald-600" /> Bid Negotiations ({bids.length})
        </h3>
        <button
          onClick={reload}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading bids…</p>
      ) : bids.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
          No bids yet — find a farmer offer and place your first bid.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Farmer / Milk</th>
                  <th className="py-3 px-3">Rate</th>
                  <th className="py-3 px-3">Liters</th>
                  <th className="py-3 px-3">Round</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bids.map((b) => {
                  const rate = numOf(b.counterRatePerLiter, numOf(b.offeredRatePerLiter));
                  const actionable = ['pending', 'countered'].includes(strOf(b.status));
                  return (
                    <tr key={strOf(b.id)} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-bold text-slate-900">
                        {nameOf(b, strOf(b.farmerName, 'Farmer'))}
                        <span className="text-[10px] text-slate-400 block font-semibold capitalize">
                          {strOf(b.milkType, 'milk')} • {strOf(b.pickupSlot) || 'flexible slot'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-black text-emerald-800">{formatCurrency(rate)}/L</td>
                      <td className="py-3 px-3 font-bold text-slate-800">{numOf(b.dailyLiters)} L/day</td>
                      <td className="py-3 px-3 text-slate-600">{numOf(b.round, 1)}/3</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={strOf(b.status, 'pending')} />
                      </td>
                      <td className="py-3 px-5 text-right">
                        {actionable && (
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => openCounter(b)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px]"
                            >
                              Counter
                            </button>
                            <button
                              onClick={() => handleAccept(b)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                            >
                              Accept
                            </button>
                          </div>
                        )}
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
        isOpen={Boolean(counterFor)}
        onClose={() => setCounterFor(null)}
        title="Counter Offer"
        description="Server enforces the 3-round maximum — a 4th counter is rejected."
        maxWidth="sm"
      >
        <form onSubmit={handleCounter} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Counter Rate (₹/L) *</label>
            <input
              type="number"
              step="0.25"
              min="1"
              value={counterRate}
              onChange={(e) => setCounterRate(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Terms</label>
            <textarea
              value={counterTerms}
              onChange={(e) => setCounterTerms(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              rows={2}
              placeholder="e.g. rate locked for 3 months, cans returned same day"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Sending…' : 'Send Counter'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default DairyMarketPage;
