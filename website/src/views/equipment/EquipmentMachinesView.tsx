import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Pencil, Power, BadgeCheck, ShieldAlert } from 'lucide-react';
import { equipment, equipmentOwner, uploads, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import { isKycError } from '../../lib/api/leads';

interface MachineRow {
  id: string;
  name: string;
  type: string;
  location?: string;
  operatorOption?: string;
  capacity?: string;
  pricingUnit?: string;
  hourlyRate: number;
  ratePerDay?: number | null;
  fuelIncluded?: boolean | null;
  travelCharge?: string;
  minBookingQty?: number | null;
  notes?: string;
  photos?: string[];
  active?: boolean;
  docStatus?: string;
  rejectionReason?: string | null;
}

const OPERATOR_LABEL: Record<string, string> = {
  withOperator: 'With operator',
  withoutOperator: 'Without operator',
  both: 'Operator optional',
};

const EMPTY_FORM = {
  name: '',
  type: '',
  location: '',
  operatorOption: 'withoutOperator',
  capacity: '',
  pricingUnit: 'perHour',
  hourlyRate: 600,
  ratePerDay: 0,
  fuelIncluded: false,
  travelCharge: '',
  minBookingQty: 0,
  notes: '',
  photoUrl: '',
};

/** My Equipment — add/edit listings, pricing, operator option, photos,
 * activate/deactivate, and the real equipment-verification state (spec §5).
 * Identity verification ≠ equipment verification — the badge here reflects
 * the document review only. */
export const EquipmentMachinesView: React.FC = () => {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MachineRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fleet + public discovery rows merged by id: fleet has docStatus/active,
      // discovery carries the operator/pricing fields and the type catalog.
      const [fleet, listed] = await Promise.all([
        equipmentOwner.fleet().catch(() => [] as MachineRow[]),
        equipment.list().catch(() => [] as MachineRow[]),
      ]);
      const listedById = new Map((listed as unknown as MachineRow[]).map((m) => [m.id, m]));
      const merged = (fleet as unknown as MachineRow[]).map((m) => ({ ...m, ...(listedById.get(m.id) ?? {}) }));
      setMachines(merged);
      setTypeOptions([...new Set((listed as unknown as MachineRow[]).map((m) => m.type).filter(Boolean))].sort());
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (m: MachineRow) => {
    setEditing(m);
    setForm({
      name: m.name ?? '',
      type: m.type ?? '',
      location: m.location ?? '',
      operatorOption: m.operatorOption ?? 'withoutOperator',
      capacity: m.capacity ?? '',
      pricingUnit: m.pricingUnit ?? 'perHour',
      hourlyRate: m.hourlyRate ?? 0,
      ratePerDay: m.ratePerDay ?? 0,
      fuelIncluded: m.fuelIncluded ?? false,
      travelCharge: m.travelCharge ?? '',
      minBookingQty: m.minBookingQty ?? 0,
      notes: m.notes ?? '',
      photoUrl: m.photos?.[0] ?? '',
    });
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type.trim(),
        hourlyRate: form.hourlyRate,
        perAcreRate: form.pricingUnit === 'perAcre' ? form.hourlyRate : undefined,
        location: form.location.trim(),
        operatorOption: form.operatorOption,
        capacity: form.capacity.trim(),
        pricingUnit: form.pricingUnit,
        ratePerDay: form.pricingUnit === 'perDay' ? form.ratePerDay || undefined : undefined,
        fuelIncluded: form.fuelIncluded,
        travelCharge: form.travelCharge.trim(),
        minBookingQty: form.minBookingQty || undefined,
        notes: form.notes.trim(),
        photos: form.photoUrl.trim() ? [form.photoUrl.trim()] : [],
      };
      if (editing) {
        await equipmentOwner.updateMachine(editing.id, payload);
        setNotice('Equipment updated.');
      } else {
        await equipmentOwner.addMachine(payload);
        setNotice('Equipment listed — it appears after the document review.');
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      if (isKycError(err)) {
        setError('Complete your identity verification (KYC) to list equipment — see Profile & Verification.');
        setFormOpen(false);
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'equipment', purpose: 'equipment-photo' })) as
        | { url?: string; fileUrl?: string }
        | undefined;
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      if (url) setForm((f) => ({ ...f, photoUrl: url }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const toggleActive = async (m: MachineRow) => {
    setBusyId(m.id);
    setError(null);
    try {
      await equipmentOwner.updateMachine(m.id, {
        name: m.name,
        type: m.type,
        hourlyRate: m.hourlyRate,
        location: m.location ?? '',
        operatorOption: m.operatorOption ?? 'withoutOperator',
        capacity: m.capacity ?? '',
        pricingUnit: m.pricingUnit ?? 'perHour',
        ratePerDay: m.ratePerDay ?? undefined,
        fuelIncluded: m.fuelIncluded ?? undefined,
        travelCharge: m.travelCharge ?? '',
        minBookingQty: m.minBookingQty ?? undefined,
        notes: m.notes ?? '',
        photos: m.photos ?? [],
        active: !(m.active ?? true),
      } as unknown as Parameters<typeof equipmentOwner.updateMachine>[1]);
      setNotice(m.active === false ? 'Listing activated.' : 'Listing deactivated.');
      await load();
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
            <BadgeCheck className="w-7 h-7 text-emerald-600" />
            My Equipment
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            List machines with pricing, operator option and photos. "Equipment Verified" appears only after the
            document review — identity KYC alone never earns it.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={openAdd} className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Equipment
          </button>
          <button onClick={() => void load()} className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading your equipment…</div>
      ) : machines.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
          <BadgeCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold">No equipment listed yet</p>
          <p className="text-xs text-slate-400">Add your first machine to start receiving farmer requests.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {machines.map((m) => (
            <div key={m.id} className={`bg-white rounded-3xl p-5 border shadow-xs space-y-3 ${m.active === false ? 'border-slate-200 opacity-70' : 'border-slate-200/80'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {m.type}
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900 mt-1">{m.name}</h3>
                  <p className="text-xs text-slate-500">{m.location || 'Operating area on request'}</p>
                </div>
                {m.docStatus === 'verified' ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                    <BadgeCheck className="w-3 h-3" /> Equipment Verified
                  </span>
                ) : m.docStatus === 'rejected' ? (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full shrink-0">
                    Rejected{m.rejectionReason ? `: ${m.rejectionReason}` : ''}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                    <ShieldAlert className="w-3 h-3" /> Documents under review
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Rate</span>
                  <span className="font-extrabold text-slate-800">
                    {formatCurrency(m.hourlyRate)} / {m.pricingUnit === 'perDay' ? 'day' : m.pricingUnit === 'perAcre' ? 'acre' : 'hr'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Operator</span>
                  <span className="font-extrabold text-slate-800">{OPERATOR_LABEL[m.operatorOption || 'withoutOperator']}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.active === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {m.active === false ? 'Inactive' : 'Active'}
                </span>
                <div className="flex gap-1.5">
                  <button onClick={() => openEdit(m)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => void toggleActive(m)}
                    disabled={busyId === m.id}
                    className={`p-2 rounded-xl border font-bold text-[10px] flex items-center gap-1 disabled:opacity-50 ${
                      m.active === false ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    title={m.active === false ? 'Activate' : 'Deactivate'}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalSheet
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Equipment' : 'Add Equipment'}
        description="Required: type, name, operating area, operator option, rate and pricing unit."
        maxWidth="md"
      >
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Equipment Name *</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Type *</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" list="eq-type-options" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required />
              <datalist id="eq-type-options">
                {typeOptions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">District / Operating Area *</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Operator Option *</label>
              <select className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white" value={form.operatorOption} onChange={(e) => setForm({ ...form, operatorOption: e.target.value })}>
                <option value="withoutOperator">Without operator</option>
                <option value="withOperator">With operator</option>
                <option value="both">Operator optional</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rate (₹) *</label>
              <input type="number" min={1} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pricing Unit *</label>
              <select className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white" value={form.pricingUnit} onChange={(e) => setForm({ ...form, pricingUnit: e.target.value })}>
                <option value="perHour">Per hour</option>
                <option value="perAcre">Per acre</option>
                <option value="perDay">Per day</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Per-Day Rate (₹)</label>
              <input type="number" min={0} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.ratePerDay} onChange={(e) => setForm({ ...form, ratePerDay: Number(e.target.value) })} disabled={form.pricingUnit !== 'perDay'} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Capacity / Spec</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 45 HP" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min Booking Qty</label>
              <input type="number" min={0} step={0.5} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.minBookingQty} onChange={(e) => setForm({ ...form, minBookingQty: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.fuelIncluded} onChange={(e) => setForm({ ...form, fuelIncluded: e.target.checked })} className="accent-emerald-600" />
              Fuel included
            </label>
            <input className="flex-1 px-3 py-2 rounded-xl border border-slate-300" value={form.travelCharge} onChange={(e) => setForm({ ...form, travelCharge: e.target.value })} placeholder="Travel charge (optional)" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Photo</label>
            <div className="flex items-center gap-3">
              <input type="file" accept="image/*" className="hidden" id="eq-photo-input" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
              <label htmlFor="eq-photo-input" className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer">
                {photoBusy ? 'Uploading…' : form.photoUrl ? 'Change Photo' : 'Upload Photo'}
              </label>
              {form.photoUrl && <img src={form.photoUrl} alt="Equipment" className="h-12 w-12 rounded-xl object-cover border border-slate-200" />}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <textarea rows={2} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'List Equipment'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
