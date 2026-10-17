import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  IdCard,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Truck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { transport, apiClient, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { TransportBooking, TransportVehicle } from '../../types';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

/** Vehicle-type catalog names accepted by POST /transport/vehicles. */
const VEHICLE_TYPES = ['Tata Ace', 'Bolero Maxi', 'Tractor Trolley', 'Eicher 6-Wheeler', 'Reefer Cold Van', '10-Wheeler Truck'];
const PERMIT_TYPES = ['State Permit', 'National Permit'];

interface VehicleForm {
  vehicleType: string;
  registrationNo: string;
  capacityTonnes: number;
  permitType: string;
  baseFare: number | '';
  perKmRate: number | '';
  rcDocUrl: string;
  insuranceDocUrl: string;
  fitnessExpiry: string;
  insuranceExpiry: string;
}

const EMPTY_VEHICLE: VehicleForm = {
  vehicleType: 'Tractor Trolley',
  registrationNo: '',
  capacityTonnes: 3,
  permitType: 'State Permit',
  baseFare: '',
  perKmRate: '',
  rcDocUrl: '',
  insuranceDocUrl: '',
  fitnessExpiry: '',
  insuranceExpiry: '',
};

const regNo = (v: TransportVehicle): string => v.registrationNo ?? v.registrationNumber ?? '—';
const vehAvailable = (v: TransportVehicle): boolean => v.availableNow ?? v.available ?? false;

/** /transporter/fleet — vehicles management + drivers sub-tab. */
export const FleetView: React.FC = () => {
  const [tab, setTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [drivers, setDrivers] = useState<Rec[]>([]);
  const [bookings, setBookings] = useState<TransportBooking[]>([]);
  const [compliance, setCompliance] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [vehModal, setVehModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<TransportVehicle | null>(null);
  const [vehForm, setVehForm] = useState<VehicleForm>(EMPTY_VEHICLE);
  const [driverModal, setDriverModal] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '' });
  const [analyticsFor, setAnalyticsFor] = useState<Rec | null>(null);
  const [driverAnalytics, setDriverAnalytics] = useState<Rec | null>(null);
  const [assignFor, setAssignFor] = useState<Rec | null>(null);
  const [assignBookingId, setAssignBookingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, d] = await Promise.all([transport.myVehicles(), transport.drivers().catch(() => [] as unknown[])]);
      setVehicles(v);
      setDrivers(asArr(d).map(asRec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    transport.compliance().then((c) => setCompliance(asRec(c))).catch(() => setCompliance({}));
  }, [load]);

  useEffect(() => {
    if (tab !== 'drivers') return;
    transport.bookings().then((b) => setBookings(b.filter((x) => ['accepted', 'driverAssigned', 'enRoute', 'inTransit'].includes(x.status)))).catch(() => setBookings([]));
  }, [tab]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const openCreate = () => {
    setEditingVehicle(null);
    setVehForm(EMPTY_VEHICLE);
    setVehModal(true);
  };

  const openEdit = (v: TransportVehicle) => {
    setEditingVehicle(v);
    setVehForm({
      vehicleType: v.vehicleType,
      registrationNo: regNo(v),
      capacityTonnes: v.capacityTonnes ?? v.capacityTons ?? 0,
      permitType: v.permitType ?? 'State Permit',
      baseFare: v.baseFare ?? '',
      perKmRate: v.perKmRate ?? v.ratePerKm ?? '',
      rcDocUrl: v.rcDocUrl ?? '',
      insuranceDocUrl: v.insuranceDocUrl ?? '',
      fitnessExpiry: v.fitnessExpiry ?? '',
      insuranceExpiry: v.insuranceExpiry ?? '',
    });
    setVehModal(true);
  };

  const saveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      vehicleType: vehForm.vehicleType,
      registrationNo: vehForm.registrationNo,
      capacityTonnes: vehForm.capacityTonnes,
      permitType: vehForm.permitType,
      ...(vehForm.baseFare !== '' ? { baseFare: Number(vehForm.baseFare) } : {}),
      ...(vehForm.perKmRate !== '' ? { perKmRate: Number(vehForm.perKmRate) } : {}),
      ...(vehForm.rcDocUrl.trim() ? { rcDocUrl: vehForm.rcDocUrl.trim() } : {}),
      ...(vehForm.insuranceDocUrl.trim() ? { insuranceDocUrl: vehForm.insuranceDocUrl.trim() } : {}),
      ...(vehForm.fitnessExpiry ? { fitnessExpiry: vehForm.fitnessExpiry } : {}),
      ...(vehForm.insuranceExpiry ? { insuranceExpiry: vehForm.insuranceExpiry } : {}),
    };
    try {
      if (editingVehicle) {
        await transport.updateVehicle(editingVehicle.id, payload as Partial<TransportVehicle>);
        flash('Vehicle updated — documents re-enter review (docStatus: pending).');
      } else {
        await transport.addVehicle(payload as Partial<TransportVehicle>);
        flash('Vehicle added to fleet — documents under review.');
      }
      setVehModal(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  /** Live availability is OwnerVehicleUpdateRequest.availableNow (PUT vehicle). */
  const toggleAvailability = async (v: TransportVehicle) => {
    try {
      await transport.updateVehicle(v.id, { availableNow: !vehAvailable(v) } as Partial<TransportVehicle>);
      flash(`${regNo(v)} ${vehAvailable(v) ? 'marked unavailable' : 'is available now'}.`);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const removeVehicle = async (v: TransportVehicle) => {
    if (!window.confirm(`Remove vehicle ${regNo(v)} from fleet?`)) return;
    try {
      await transport.removeVehicle(v.id);
      flash('Vehicle removed.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const saveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await transport.addDriver({ name: driverForm.name, phone: driverForm.phone || undefined });
      setDriverModal(false);
      setDriverForm({ name: '', phone: '' });
      flash('Driver added.');
      const d = await transport.drivers().catch(() => [] as unknown[]);
      setDrivers(asArr(d).map(asRec));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openAnalytics = async (d: Rec) => {
    setAnalyticsFor(d);
    setDriverAnalytics(null);
    try {
      setDriverAnalytics(asRec(await transport.driverAnalytics(str(d.id))));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  /** Backend AssignDriverRequest is {driverName, driverPhone} — no driver id. */
  const confirmAssign = async () => {
    if (!assignFor || !assignBookingId) return;
    try {
      await apiClient.post(`/transport/bookings/${assignBookingId}/assign-driver`, {
        driverName: firstStr(assignFor, ['name'], 'Driver'),
        driverPhone: firstStr(assignFor, ['phone'], ''),
      });
      setAssignFor(null);
      setAssignBookingId('');
      flash('Driver assigned to trip.');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const docStatusOf = (v: TransportVehicle): string => v.docStatus ?? 'pending';
  const strikeCount = firstNum(compliance, ['strikeCount', 'noShowStrikes', 'strikes'], 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Fleet & Drivers
          </h1>
          <p className="text-xs text-slate-500 mt-1">Manage vehicles, document status, and driver assignments</p>
        </div>
        <button
          onClick={load}
          className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
        {[
          { id: 'vehicles', label: `Vehicles (${vehicles.length})` },
          { id: 'drivers', label: `Drivers (${drivers.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'vehicles' | 'drivers')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openCreate}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Vehicle
            </button>
          </div>

          {vehicles.length === 0 && !loading ? (
            <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">No vehicles in your fleet</p>
              <p className="text-xs text-slate-500">Add vehicles to receive matched loads and direct bookings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {vehicles.map((v) => (
                <div key={v.id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900">{regNo(v)}</h4>
                      <p className="text-xs text-slate-400">
                        {v.vehicleType} • {v.capacityTonnes ?? v.capacityTons ?? 0} T • {v.permitType ?? 'State Permit'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={docStatusOf(v)} />
                      <StatusBadge status={vehAvailable(v) ? 'available' : 'unavailable'} />
                    </div>
                  </div>

                  {(v.rejectionReason ?? '') !== '' && (
                    <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-2.5">
                      Rejected: {v.rejectionReason}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Base Fare</span>
                      <p className="font-bold text-slate-900">{v.baseFare ? formatCurrency(v.baseFare) : 'catalog'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Per Km</span>
                      <p className="font-bold text-slate-900">{v.perKmRate ? formatCurrency(v.perKmRate) : 'catalog'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Insurance</span>
                      <p className="font-bold text-slate-900">{v.insuranceExpiry ? fmtDate(v.insuranceExpiry) : '—'}</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => toggleAvailability(v)}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                    >
                      {vehAvailable(v) ? <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />}
                      {vehAvailable(v) ? 'Live' : 'Go Live'}
                    </button>
                    <button
                      onClick={() => openEdit(v)}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                    >
                      <IdCard className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => removeVehicle(v)}
                      className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {strikeCount > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-900 flex items-center gap-2">
              <IdCard className="w-5 h-5" />
              Compliance notice: {strikeCount} strike(s) on record. Keep vehicle documents current.
            </div>
          )}
        </div>
      )}

      {tab === 'drivers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setDriverModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Add Driver
            </button>
          </div>

          {drivers.length === 0 && !loading ? (
            <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">No drivers added</p>
              <p className="text-xs text-slate-500">Driver sub-accounts are a Pro feature — drivers operate assigned trips but can never view settlements.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {drivers.map((d) => (
                <div key={str(d.id) || JSON.stringify(d).slice(0, 24)} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900">{firstStr(d, ['name'], 'Driver')}</h4>
                      <p className="text-xs text-slate-400">{firstStr(d, ['phone'], '—')}</p>
                    </div>
                    <StatusBadge status={firstStr(d, ['status'], 'active')} />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => openAnalytics(d)}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                    >
                      <Users className="w-3.5 h-3.5" /> Analytics
                    </button>
                    <button
                      onClick={() => {
                        setAssignFor(d);
                        setAssignBookingId('');
                      }}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      Assign to Trip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vehicle modal */}
      <ModalSheet isOpen={vehModal} onClose={() => setVehModal(false)} title={editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'} description="Documents re-enter review on every change (docStatus resets to pending)" maxWidth="md">
        <form onSubmit={saveVehicle} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Type</label>
              <select
                value={vehForm.vehicleType}
                onChange={(e) => setVehForm({ ...vehForm, vehicleType: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Registration No.</label>
              <input
                type="text"
                value={vehForm.registrationNo}
                onChange={(e) => setVehForm({ ...vehForm, registrationNo: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 uppercase"
                placeholder="MH-16-AB-4471"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Capacity (Tonnes)</label>
              <input type="number" step="0.5" value={vehForm.capacityTonnes} onChange={(e) => setVehForm({ ...vehForm, capacityTonnes: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Permit</label>
              <select value={vehForm.permitType} onChange={(e) => setVehForm({ ...vehForm, permitType: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white">
                {PERMIT_TYPES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Base fare override (₹, optional)</label>
              <input type="number" value={vehForm.baseFare} onChange={(e) => setVehForm({ ...vehForm, baseFare: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="catalog" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Per-km override (₹, optional)</label>
              <input type="number" value={vehForm.perKmRate} onChange={(e) => setVehForm({ ...vehForm, perKmRate: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="catalog" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">RC doc URL (vault)</label>
              <input type="url" value={vehForm.rcDocUrl} onChange={(e) => setVehForm({ ...vehForm, rcDocUrl: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Insurance doc URL (vault)</label>
              <input type="url" value={vehForm.insuranceDocUrl} onChange={(e) => setVehForm({ ...vehForm, insuranceDocUrl: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Fitness expiry</label>
              <input type="date" value={vehForm.fitnessExpiry} onChange={(e) => setVehForm({ ...vehForm, fitnessExpiry: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Insurance expiry</label>
              <input type="date" value={vehForm.insuranceExpiry} onChange={(e) => setVehForm({ ...vehForm, insuranceExpiry: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md">
            {editingVehicle ? 'Save Changes' : 'Add Vehicle'}
          </button>
        </form>
      </ModalSheet>

      {/* Driver modal */}
      <ModalSheet isOpen={driverModal} onClose={() => setDriverModal(false)} title="Add Driver" description="Driver sub-accounts are a Pro-tier feature" maxWidth="sm">
        <form onSubmit={saveDriver} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Name</label>
            <input type="text" value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
            <input type="tel" value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="91…" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md">
            Add Driver
          </button>
        </form>
      </ModalSheet>

      {/* Driver analytics modal */}
      <ModalSheet isOpen={!!analyticsFor} onClose={() => setAnalyticsFor(null)} title={`Driver Analytics — ${analyticsFor ? firstStr(analyticsFor, ['name'], 'Driver') : 'Driver'}`} maxWidth="sm">
        {driverAnalytics && Object.keys(driverAnalytics).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(driverAnalytics).map(([k, v]) => (
              <div key={k} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                <span className="font-bold text-slate-900">
                  {typeof v === 'number' ? (k.toLowerCase().includes('revenue') || k.toLowerCase().includes('amount') ? formatCurrency(v) : v) : typeof v === 'string' ? v : JSON.stringify(v)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-4">{driverAnalytics === null ? 'Loading analytics…' : 'No analytics available.'}</p>
        )}
      </ModalSheet>

      {/* Assign modal — backend takes {driverName, driverPhone}, not an id */}
      <ModalSheet isOpen={!!assignFor} onClose={() => setAssignFor(null)} title="Assign Driver to Trip" description={assignFor ? firstStr(assignFor, ['name'], 'Driver') : undefined} maxWidth="sm">
        <div className="space-y-3">
          <select value={assignBookingId} onChange={(e) => setAssignBookingId(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white" required>
            <option value="">Select accepted trip…</option>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} — {b.commodity || b.cargoCrop} ({b.status})
              </option>
            ))}
          </select>
          <button
            onClick={confirmAssign}
            disabled={!assignBookingId}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
          >
            Assign Driver
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
