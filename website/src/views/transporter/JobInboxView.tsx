import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Inbox, MapPin, RefreshCw, X } from 'lucide-react';
import { transport, apiClient, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { TransportBooking, TransportVehicle } from '../../types';

/** /transporter/inbox — requested bookings awaiting accept/reject. */
export const JobInboxView: React.FC = () => {
  const [bookings, setBookings] = useState<TransportBooking[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptFor, setAcceptFor] = useState<TransportBooking | null>(null);
  const [acceptVehicleId, setAcceptVehicleId] = useState('');
  const [rejectFor, setRejectFor] = useState<TransportBooking | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Backend status for open requests is "requested".
      const [b, v] = await Promise.all([
        transport.bookings({ status: 'requested' }).catch(() => [] as TransportBooking[]),
        transport.myVehicles().catch(() => [] as TransportVehicle[]),
      ]);
      setBookings(b.filter((x) => ['requested', 'pending'].includes(x.status)));
      setVehicles(v.filter((veh) => (veh.docStatus ?? 'verified') === 'verified'));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const openAccept = (b: TransportBooking) => {
    setAcceptFor(b);
    setAcceptVehicleId(vehicles[0]?.id ?? '');
  };

  const confirmAccept = async () => {
    if (!acceptFor) return;
    try {
      const vehicle = vehicles.find((v) => v.id === acceptVehicleId);
      // AcceptBookingRequest takes the vehicle in the same call; the PATCH
      // lane can't re-assign later (accepted→accepted is not a legal transition).
      await apiClient.post(`/transport/bookings/${acceptFor.id}/accept`, {
        vehicleId: vehicle?.id,
        vehicleNo: vehicle?.registrationNo ?? vehicle?.registrationNumber,
      });
      setAcceptFor(null);
      flash(`Booking ${acceptFor.id} accepted. Trip is ready to start.`);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const reject = async () => {
    if (!rejectFor) return;
    try {
      await transport.rejectBooking(rejectFor.id, rejectReason.trim() || 'Not feasible for my fleet right now');
      setRejectFor(null);
      setRejectReason('');
      flash('Booking rejected.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Inbox className="w-7 h-7 text-emerald-600" />
            Job Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-1">Direct booking requests from farmers/shippers — accept or reject</p>
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

      {vehicles.length === 0 && !loading && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-900">
          No verified vehicles on file — a verified vehicle is required before bookings can be accepted (422
          VEHICLE_NOT_VERIFIED). Add and verify one in <Link to="/transporter/fleet" className="underline">Fleet</Link>.
        </div>
      )}

      {bookings.length === 0 && !loading ? (
        <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700">Inbox zero</p>
          <p className="text-xs text-slate-500">New booking requests from farmers will appear here for accept/reject.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const crop = b.commodity || b.cargoCrop || 'Cargo';
            const pickup = b.pickup || b.pickupAddress;
            const drop = b.drop || b.dropAddress;
            const fare = b.fare ?? b.estimatedFare ?? 0;
            const weight = b.weightQuintals ?? b.cargoWeightQuintal ?? 0;
            return (
              <div key={b.id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-base text-slate-900">
                      {crop} {weight > 0 ? `(${formatWeight(weight)})` : ''} — {b.vehicleType}
                    </h4>
                    <p className="text-xs text-slate-400">{b.id} • {fmtDateLabel(b.date ?? b.pickupTime)}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl col-span-2">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Route</span>
                    <p className="font-bold text-slate-900 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-600" /> {pickup} → {drop}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Distance</span>
                    <p className="font-bold text-slate-900">{b.distanceKm} km</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <span className="text-emerald-600 text-[10px] uppercase font-bold">Fare</span>
                    <p className="font-bold text-emerald-800">{formatCurrency(fare)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <button
                    onClick={() => setRejectFor(b)}
                    className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => openAccept(b)}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  >
                    Accept Job
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalSheet isOpen={!!acceptFor} onClose={() => setAcceptFor(null)} title="Accept Booking" description={acceptFor ? `${acceptFor.commodity || acceptFor.cargoCrop} — ${acceptFor.id}` : undefined} maxWidth="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle for this trip</label>
            <select value={acceptVehicleId} onChange={(e) => setAcceptVehicleId(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white" required>
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNo ?? v.registrationNumber} — {v.vehicleType}
                </option>
              ))}
            </select>
          </div>
          <button onClick={confirmAccept} disabled={!acceptVehicleId} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            Accept & Assign Vehicle
          </button>
        </div>
      </ModalSheet>

      <ModalSheet isOpen={!!rejectFor} onClose={() => setRejectFor(null)} title="Reject Booking" description={rejectFor ? `Booking ${rejectFor.id}` : undefined} maxWidth="sm">
        <div className="space-y-3">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            placeholder="Reason (vehicle busy, route not feasible…) — min 3 characters"
          />
          <button onClick={reject} disabled={rejectReason.trim().length > 0 && rejectReason.trim().length < 3} className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-60">
            Confirm Reject
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};

const fmtDateLabel = (v?: string): string => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
