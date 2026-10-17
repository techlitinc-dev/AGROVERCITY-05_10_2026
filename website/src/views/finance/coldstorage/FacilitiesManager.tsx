import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Plus,
  RefreshCw,
  Pencil,
  ShieldCheck,
  DoorOpen,
} from 'lucide-react';
import { postHarvest, apiErrorMessage } from '../../../lib/api';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ModalSheet } from '../../../components/common/ModalSheet';
import { formatCurrency } from '../../../lib/utils';
import { str, num, arr, type Row, type FacilityRow } from './types';

const FACILITY_TYPES = ['cold_storage', 'dry_godown', 'godown', 'silo', 'warehouse'];
const CHAMBER_TYPES = ['cold_storage', 'dry_godown', 'godown', 'silo'];

interface FacilityForm {
  name: string;
  facilityType: string;
  capacityMT: string;
  ratePerQuintalMonth: string;
  district: string;
  state: string;
  tempRange: string;
  managerName: string;
  contactPhone: string;
  wdraRegistered: boolean;
  distanceKm: string;
}

const emptyForm: FacilityForm = {
  name: '',
  facilityType: 'cold_storage',
  capacityMT: '',
  ratePerQuintalMonth: '50',
  district: 'Nashik',
  state: 'Maharashtra',
  tempRange: '2-8°C',
  managerName: '',
  contactPhone: '',
  wdraRegistered: true,
  distanceKm: '0',
};

/** FacilitiesManager — register warehouses, edit capacity/rates, add chambers. */
export const FacilitiesManager: React.FC = () => {
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editFacility, setEditFacility] = useState<FacilityRow | null>(null);
  const [chamberFacility, setChamberFacility] = useState<FacilityRow | null>(null);
  const [form, setForm] = useState<FacilityForm>(emptyForm);
  const [editForm, setEditForm] = useState({ availableMT: '', totalCapacityMT: '', ratePerQuintalMonth: '', tempRange: '' });
  const [chamberForm, setChamberForm] = useState({ name: '', chamberType: 'cold_storage', capacityMT: '', tempRange: '2-8°C' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await postHarvest.provider.facilities()) as unknown;
      setFacilities(arr((res as Row)?.data ?? res) as FacilityRow[]);
    } catch (e) {
      setError(apiErrorMessage(e));
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await postHarvest.provider.addFacility({
        name: form.name.trim(),
        facilityType: form.facilityType,
        capacityMT: Number(form.capacityMT),
        ratePerQuintalMonth: Number(form.ratePerQuintalMonth),
        district: form.district.trim(),
        state: form.state.trim(),
        tempRange: form.tempRange,
        managerName: form.managerName.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        wdraRegistered: form.wdraRegistered,
        distanceKm: Number(form.distanceKm) || 0,
      });
      setNotice(`${form.name.trim()} registered — default chambers created.`);
      setForm(emptyForm);
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (f: FacilityRow) => {
    setEditFacility(f);
    setEditForm({
      availableMT: String(num(f.availableMT)),
      totalCapacityMT: String(num(f.totalCapacityMT)),
      ratePerQuintalMonth: String(num(f.ratePerQuintalMonth)),
      tempRange: str(f.tempRange, '2-8°C'),
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFacility) return;
    setBusy(true);
    setError(null);
    try {
      await postHarvest.provider.updateFacility(str(editFacility.id), {
        availableMT: Number(editForm.availableMT),
        totalCapacityMT: Number(editForm.totalCapacityMT),
        ratePerQuintalMonth: Number(editForm.ratePerQuintalMonth),
        tempRange: editForm.tempRange,
      });
      setNotice(`${str(editFacility.name)} updated.`);
      setEditFacility(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const addChamber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chamberFacility) return;
    setBusy(true);
    setError(null);
    try {
      await postHarvest.provider.addChamber(str(chamberFacility.id), {
        name: chamberForm.name.trim(),
        chamberType: chamberForm.chamberType,
        capacityMT: Number(chamberForm.capacityMT),
        tempRange: chamberForm.tempRange,
        status: 'active',
      });
      setNotice(`Chamber "${chamberForm.name.trim()}" added to ${str(chamberFacility.name)}.`);
      setChamberFacility(null);
      setChamberForm({ name: '', chamberType: 'cold_storage', capacityMT: '', tempRange: '2-8°C' });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof FacilityForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/coldStorageProvider" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to console
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Warehouses & Chambers
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Register WDRA facilities, tune capacity and rent rates, and expand chamber inventory
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs">
          <Plus className="w-4 h-4" /> Register Facility
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>
      )}

      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {facilities.map((f) => {
            const chambers = arr(f.chambers);
            const capacity = num(f.totalCapacityMT, num(f.availableMT));
            const booked = num(f.bookedQuintals) / 10;
            const pct = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
            return (
              <div key={str(f.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      {str(f.name, 'Facility')}
                      {f.wdraRegistered && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> WDRA {str(f.wdraRegNo, 'registered')}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {str(f.address) || `${str(f.district)}, ${str(f.state)}`} · {str(f.facilityType).replace(/_/g, ' ')} · {str(f.tempRange)} ·{' '}
                      {formatCurrency(num(f.ratePerQuintalMonth))}/q/month
                      {f.managerName ? ` · Manager ${str(f.managerName)} (${str(f.contactPhone)})` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(f)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-bold text-[11px] rounded-xl">
                      <Pencil className="w-3.5 h-3.5 text-emerald-600" /> Edit
                    </button>
                    <button onClick={() => setChamberFacility(f)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-xl">
                      <Plus className="w-3.5 h-3.5" /> Chamber
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600">
                      {num(f.availableMT)} MT free of {capacity} MT · {num(f.bookedQuintals)} q booked
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {chambers.map((c) => {
                      const ch = c as Row;
                      const chCap = num(ch.capacityMT);
                      const chOcc = num(ch.currentOccupancyMT);
                      return (
                        <div key={str(ch.id)} className="bg-slate-50 rounded-2xl p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <DoorOpen className="w-3.5 h-3.5 text-emerald-600" /> {str(ch.name, 'Chamber')}
                            </span>
                            <StatusBadge status={str(ch.status, 'active')} />
                          </div>
                          <span className="text-slate-500 block mt-1">
                            {str(ch.chamberType).replace(/_/g, ' ')} · {str(ch.tempRange, '—')}
                          </span>
                          <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-500 rounded-full" style={{ width: `${chCap > 0 ? Math.min(100, (chOcc / chCap) * 100) : 0}%` }} />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500">{chOcc} / {chCap} MT</span>
                        </div>
                      );
                    })}
                    {chambers.length === 0 && (
                      <p className="text-xs text-slate-400 col-span-3">No chambers — add one to start accepting bookings.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {facilities.length === 0 && (
            <p className="py-10 text-center text-slate-400 font-semibold text-xs">No facilities registered yet.</p>
          )}
        </div>
      )}

      {/* Create facility modal */}
      <ModalSheet isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Register Facility" description="Auto-creates default chambers when none are specified." maxWidth="2xl">
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Facility Name
            <input value={form.name} onChange={set('name')} required
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Type
            <select value={form.facilityType} onChange={set('facilityType')}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
              {FACILITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Capacity (MT)
            <input value={form.capacityMT} onChange={set('capacityMT')} type="number" min="1" step="0.1" required
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Rent ₹/quintal/month
            <input value={form.ratePerQuintalMonth} onChange={set('ratePerQuintalMonth')} type="number" min="1" step="0.5" required
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            District
            <input value={form.district} onChange={set('district')} required
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            State
            <input value={form.state} onChange={set('state')} required
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Temperature Range
            <input value={form.tempRange} onChange={set('tempRange')}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Distance (km)
            <input value={form.distanceKm} onChange={set('distanceKm')} type="number" min="0" step="0.5"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Manager Name
            <input value={form.managerName} onChange={set('managerName')}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Contact Phone
            <input value={form.contactPhone} onChange={set('contactPhone')}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="md:col-span-2 flex items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={form.wdraRegistered} onChange={(e) => setForm((f) => ({ ...f, wdraRegistered: e.target.checked }))}
              className="w-4 h-4 accent-emerald-600" />
            WDRA registered (registration number auto-generated when left blank)
          </label>
          <button type="submit" disabled={busy}
            className="md:col-span-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            {busy ? 'Registering…' : 'Register Facility'}
          </button>
        </form>
      </ModalSheet>

      {/* Edit facility modal */}
      <ModalSheet isOpen={!!editFacility} onClose={() => setEditFacility(null)} title={`Edit ${str(editFacility?.name)}`} description="Capacity and rate updates apply immediately to the booking engine." maxWidth="md">
        <form onSubmit={saveEdit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Available (MT)
              <input value={editForm.availableMT} onChange={(e) => setEditForm((f) => ({ ...f, availableMT: e.target.value }))} type="number" min="0" step="0.1" required
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Total Capacity (MT)
              <input value={editForm.totalCapacityMT} onChange={(e) => setEditForm((f) => ({ ...f, totalCapacityMT: e.target.value }))} type="number" min="0" step="0.1" required
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Rent ₹/q/month
              <input value={editForm.ratePerQuintalMonth} onChange={(e) => setEditForm((f) => ({ ...f, ratePerQuintalMonth: e.target.value }))} type="number" min="1" step="0.5" required
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Temperature Range
              <input value={editForm.tempRange} onChange={(e) => setEditForm((f) => ({ ...f, tempRange: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
          </div>
          <button type="submit" disabled={busy}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            Save Changes
          </button>
        </form>
      </ModalSheet>

      {/* Add chamber modal */}
      <ModalSheet isOpen={!!chamberFacility} onClose={() => setChamberFacility(null)} title={`Add Chamber — ${str(chamberFacility?.name)}`} description="Capacity expands the facility totals automatically." maxWidth="md">
        <form onSubmit={addChamber} className="space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Chamber Name
            <input value={chamberForm.name} onChange={(e) => setChamberForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Chamber C (CA storage)"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Type
              <select value={chamberForm.chamberType} onChange={(e) => setChamberForm((f) => ({ ...f, chamberType: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
                {CHAMBER_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Capacity (MT)
              <input value={chamberForm.capacityMT} onChange={(e) => setChamberForm((f) => ({ ...f, capacityMT: e.target.value }))} type="number" min="0.1" step="0.1" required
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
          </div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Temperature Range
            <input value={chamberForm.tempRange} onChange={(e) => setChamberForm((f) => ({ ...f, tempRange: e.target.value }))}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <button type="submit" disabled={busy}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            Add Chamber
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
