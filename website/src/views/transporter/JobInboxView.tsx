import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CopyPlus,
  HandCoins,
  Inbox,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { chat, transport, apiClient, apiErrorMessage } from '../../lib/api';
import { DIRECT_CONNECT_TERMS_TEXT } from '../../lib/api/transport';
import { isMpinError } from '../../lib/api/leads';
import { MpinPad } from '../../components/common/MpinPad';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { TransportBooking, TransportVehicle, VehicleCatalogEntry } from '../../types';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

/** /transporter/inbox — requested bookings awaiting accept/reject, with fare
 *  negotiation, per-request chat, and repeatable load templates. */
export const JobInboxView: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<TransportBooking[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [templates, setTemplates] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptFor, setAcceptFor] = useState<TransportBooking | null>(null);
  const [acceptVehicleId, setAcceptVehicleId] = useState('');
  const [acceptStep, setAcceptStep] = useState<'vehicle' | 'mpin'>('vehicle');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [mpinKey, setMpinKey] = useState(0);
  const [rejectFor, setRejectFor] = useState<TransportBooking | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // --- negotiation state ---
  const [negFor, setNegFor] = useState<TransportBooking | null>(null);
  const [offers, setOffers] = useState<Rec[]>([]);
  const [offerFare, setOfferFare] = useState(0);
  const [offerMessage, setOfferMessage] = useState('');
  const [counterFare, setCounterFare] = useState<Record<string, number>>({});
  const [offerBusy, setOfferBusy] = useState(false);

  // --- templates state ---
  const [templateModal, setTemplateModal] = useState(false);
  const [catalog, setCatalog] = useState<VehicleCatalogEntry[]>([]);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    crop: '',
    pickup: '',
    drop: '',
    weightQuintals: 0,
    fare: 0,
    vehicleType: '',
    packaging: 'Gunny Bags',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Backend status for open requests is "requested".
      const [b, v, t, cat] = await Promise.all([
        transport.bookings({ status: 'requested' }).catch(() => [] as TransportBooking[]),
        transport.myVehicles().catch(() => [] as TransportVehicle[]),
        transport.loadTemplates().catch(() => [] as unknown[]),
        transport.vehicles().catch(() => [] as unknown[]),
      ]);
      setBookings(b.filter((x) => ['requested', 'pending'].includes(x.status)));
      setVehicles(v.filter((veh) => (veh.docStatus ?? 'verified') === 'verified'));
      setTemplates(asArr(t).map(asRec));
      setCatalog(asArr(cat) as unknown as VehicleCatalogEntry[]);
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
    setAcceptStep('vehicle');
    setAcceptTerms(false);
    setMpinKey((k) => k + 1);
  };

  const confirmAccept = async (mpin?: string) => {
    if (!acceptFor) return;
    try {
      const vehicle = vehicles.find((v) => v.id === acceptVehicleId);
      const isDirect = acceptFor.requestKind === 'direct' || Boolean(acceptFor.transporterId);
      // AcceptBookingRequest takes the vehicle in the same call; the PATCH
      // lane can't re-assign later (accepted→accepted is not a legal transition).
      // Direct requests additionally carry the direct-connect terms + MPIN.
      await apiClient.post(`/transport/bookings/${acceptFor.id}/accept`, {
        vehicleId: vehicle?.id,
        vehicleNo: vehicle?.registrationNo ?? vehicle?.registrationNumber,
        ...(isDirect ? { termsAccepted: true, ...(mpin ? { mpin } : {}) } : {}),
      });
      setAcceptFor(null);
      setAcceptStep('vehicle');
      setAcceptTerms(false);
      flash(
        isDirect
          ? `Request accepted — phone & WhatsApp unlocked for both sides. Trip ${acceptFor.id} is ready to start.`
          : `Booking ${acceptFor.id} accepted. Trip is ready to start.`
      );
      await load();
    } catch (e) {
      if (isMpinError(e)) {
        setMpinKey((k) => k + 1);
        setError('Incorrect MPIN — try again.');
      } else {
        setAcceptFor(null);
        setAcceptStep('vehicle');
        setError(apiErrorMessage(e));
      }
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

  // --- negotiation ---
  const bookingFare = (b: TransportBooking): number => b.fare ?? b.estimatedFare ?? 0;

  const openNegotiate = async (b: TransportBooking) => {
    setNegFor(b);
    setOffers([]);
    setOfferFare(bookingFare(b));
    setOfferMessage('');
    setCounterFare({});
    try {
      const rows = await transport.bookingOffers(b.id);
      setOffers(asArr(rows).map(asRec));
    } catch {
      setOffers([]);
    }
  };

  const reloadOffers = async (bookingId: string) => {
    try {
      const rows = await transport.bookingOffers(bookingId);
      setOffers(asArr(rows).map(asRec));
    } catch {
      setOffers([]);
    }
  };

  const sendOffer = async () => {
    if (!negFor || offerFare <= 0) return;
    setOfferBusy(true);
    setError(null);
    try {
      await transport.createBookingOffer(negFor.id, {
        farePaise: Math.round(offerFare * 100),
        ...(offerMessage.trim() ? { message: offerMessage.trim() } : {}),
      });
      setOfferMessage('');
      flash('Fare offer sent to the farmer.');
      await reloadOffers(negFor.id);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setOfferBusy(false);
    }
  };

  const respondOffer = async (offer: Rec, action: 'accept' | 'decline') => {
    if (!negFor) return;
    setOfferBusy(true);
    setError(null);
    try {
      await transport.respondBookingOffer(negFor.id, str(offer.offerId), action);
      flash(action === 'accept' ? 'Offer accepted — fare locked, booking confirmed.' : 'Offer declined.');
      await reloadOffers(negFor.id);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setOfferBusy(false);
    }
  };

  const counterOffer = async (offer: Rec) => {
    if (!negFor) return;
    const fare = counterFare[str(offer.offerId)];
    if (!fare || fare <= 0) return;
    setOfferBusy(true);
    setError(null);
    try {
      await transport.respondBookingOffer(negFor.id, str(offer.offerId), 'counter', { farePaise: Math.round(fare * 100) });
      flash('Counter offer sent.');
      await reloadOffers(negFor.id);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setOfferBusy(false);
    }
  };

  // --- chat ---
  const openChat = async (b: TransportBooking) => {
    setError(null);
    try {
      const room = asRec(await chat.openDirect({ bookingId: b.id }));
      const roomId = firstStr(room, ['id', 'roomId'], '');
      if (roomId) {
        navigate(`/chat?room=${encodeURIComponent(roomId)}`);
      } else {
        setError('Chat room could not be opened.');
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  // --- load templates ---
  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      // Backend LoadTemplateRequest: pickupLocation/dropLocation/quantityQuintals/
      // targetFare/preferredVehicleType/packaging (not pickup/drop/weightQuintals/fare).
      await transport.createLoadTemplate({
        name: templateForm.name.trim(),
        crop: templateForm.crop.trim(),
        pickupLocation: templateForm.pickup.trim(),
        dropLocation: templateForm.drop.trim(),
        quantityQuintals: templateForm.weightQuintals,
        preferredVehicleType: templateForm.vehicleType,
        packaging: templateForm.packaging,
        targetFare: templateForm.fare,
        ...(templateForm.notes.trim() ? { notes: templateForm.notes.trim() } : {}),
      });
      setTemplateModal(false);
      setTemplateForm({ name: '', crop: '', pickup: '', drop: '', weightQuintals: 0, fare: 0, vehicleType: '', packaging: 'Gunny Bags', notes: '' });
      flash('Load template saved.');
      const t = await transport.loadTemplates().catch(() => [] as unknown[]);
      setTemplates(asArr(t).map(asRec));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const repeatTemplate = async (t: Rec) => {
    setError(null);
    try {
      await transport.repeatLoadTemplate(str(t.id));
      flash(`Template "${firstStr(t, ['name'], 'Load')}" repeated — a fresh load was posted.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const deleteTemplate = async (t: Rec) => {
    if (!window.confirm(`Delete template "${firstStr(t, ['name'], 'Load')}"?`)) return;
    setError(null);
    try {
      await transport.deleteLoadTemplate(str(t.id));
      flash('Template deleted.');
      setTemplates((prev) => prev.filter((x) => str(x.id) !== str(t.id)));
    } catch (err) {
      setError(apiErrorMessage(err));
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
          <p className="text-xs text-slate-500 mt-1">Direct booking requests from farmers/shippers — negotiate the fare, accept, or reject</p>
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
          No vehicles on file — add one in <Link to="/transporter/fleet" className="underline">Fleet</Link>. Vehicles are
          usable immediately (no review) unless a document date has expired.
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
            const fare = bookingFare(b);
            const weight = b.weightQuintals ?? b.cargoWeightQuintal ?? 0;
            return (
              <div key={b.id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-base text-slate-900">
                      {crop} {weight > 0 ? `(${formatWeight(weight)})` : ''} — {b.vehicleType}
                    </h4>
                    <p className="text-xs text-slate-400">{b.id} • {fmtDate(b.date ?? b.pickupTime)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.requestKind === 'direct' && (
                      <span className="text-[10px] font-black uppercase tracking-wide text-sky-700 bg-sky-50 border border-sky-200 px-2 py-1 rounded-lg">
                        Direct request
                      </span>
                    )}
                    <StatusBadge status={b.status} />
                  </div>
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
                  {b.status === 'requested' ? (
                    <span
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-400 font-bold text-xs flex items-center gap-1.5 cursor-not-allowed"
                      title="Chat unlocks after you accept"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Chat
                      <span className="text-[10px] font-normal">Chat unlocks after you accept</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => openChat(b)}
                      className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Chat
                    </button>
                  )}
                  <button
                    onClick={() => openNegotiate(b)}
                    className="px-4 py-2 rounded-xl border border-sky-200 text-sky-700 hover:bg-sky-50 font-bold text-xs flex items-center gap-1.5"
                  >
                    <HandCoins className="w-3.5 h-3.5" /> Negotiate Fare
                  </button>
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

      {/* Load templates */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Load Templates</h3>
            <p className="text-[11px] text-slate-400">Save a regular lane once and re-post it as a fresh load in one tap.</p>
          </div>
          <button
            onClick={() => setTemplateModal(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New Template
          </button>
        </div>
        {templates.length === 0 && !loading ? (
          <p className="text-xs text-slate-400 text-center py-4">No templates yet — save your frequent routes here.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((t) => (
              <div key={str(t.id) || JSON.stringify(t).slice(0, 24)} className="p-4 bg-slate-50 rounded-2xl text-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  {firstStr(t, ['name'], 'Load template')}
                  {firstNum(t, ['targetFare', 'fare'], 0) > 0 && <span className="text-emerald-700">{formatCurrency(firstNum(t, ['targetFare', 'fare']))}</span>}
                </p>
                <p className="text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  {firstStr(t, ['pickupLocation', 'pickup'], '—')} → {firstStr(t, ['dropLocation', 'drop'], '—')}
                  {firstStr(t, ['crop'], '') !== '—' ? ` • ${firstStr(t, ['crop'])}` : ''}
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => repeatTemplate(t)}
                    className="px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold text-[11px] flex items-center gap-1"
                  >
                    <CopyPlus className="w-3 h-3" /> Repeat
                  </button>
                  <button
                    onClick={() => deleteTemplate(t)}
                    className="p-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50"
                    title="Delete template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalSheet
        isOpen={!!acceptFor}
        onClose={() => {
          setAcceptFor(null);
          setAcceptStep('vehicle');
        }}
        title={acceptFor?.requestKind === 'direct' ? 'Accept Direct Request' : 'Accept Booking'}
        description={acceptFor ? `${acceptFor.commodity || acceptFor.cargoCrop} — ${acceptFor.id}` : undefined}
        maxWidth="sm"
      >
        {acceptFor && (
          <div className="space-y-3">
            {acceptStep === 'vehicle' ? (
              <>
                {acceptFor.requestKind === 'direct' && (
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl text-[11px] font-semibold text-sky-800">
                    This farmer requested you directly. Accepting confirms the trip and unlocks both
                    sides' phone &amp; WhatsApp.
                  </div>
                )}
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
                {acceptFor.requestKind === 'direct' ? (
                  <>
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="w-3.5 h-3.5 mt-0.5 accent-emerald-600 flex-shrink-0"
                      />
                      <span className="text-[10px] text-amber-800 leading-relaxed">
                        I confirm: {DIRECT_CONNECT_TERMS_TEXT}
                      </span>
                    </label>
                    <button
                      onClick={() => setAcceptStep('mpin')}
                      disabled={!acceptVehicleId || !acceptTerms}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
                    >
                      Continue — Verify MPIN
                    </button>
                  </>
                ) : (
                  <button onClick={() => void confirmAccept()} disabled={!acceptVehicleId} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
                    Accept & Assign Vehicle
                  </button>
                )}
              </>
            ) : (
              <>
                <MpinPad
                  key={mpinKey}
                  onSuccess={(mpin) => void confirmAccept(mpin)}
                  title="Verify MPIN to Accept"
                  subtitle="Accepting unlocks the farmer's phone & WhatsApp for direct coordination."
                />
                <button
                  onClick={() => setAcceptStep('vehicle')}
                  className="w-full py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-[11px] hover:bg-slate-50"
                >
                  Back
                </button>
              </>
            )}
          </div>
        )}
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

      {/* Negotiation panel */}
      <ModalSheet
        isOpen={!!negFor}
        onClose={() => setNegFor(null)}
        title="Negotiate Fare"
        description={negFor ? `${negFor.commodity || negFor.cargoCrop} — ${negFor.id} • farmer's offer ${formatCurrency(bookingFare(negFor))}` : undefined}
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Offers thread */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Offer Thread</h4>
            {offers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No offers yet — quote your fare below.</p>
            ) : (
              offers.map((o) => {
                const fromRole = firstStr(o, ['fromRole'], 'transporter');
                const mine = fromRole === 'transporter';
                const status = firstStr(o, ['status'], 'pending');
                const pending = status === 'pending';
                const farePaise = firstNum(o, ['farePaise'], 0);
                return (
                  <div key={str(o.offerId) || JSON.stringify(o).slice(0, 24)} className={`p-3 rounded-2xl text-xs border ${mine ? 'bg-sky-50 border-sky-100' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 capitalize">
                        {mine ? 'You (transporter)' : 'Farmer'} • Round {firstNum(o, ['round'], 1)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-emerald-800">{formatCurrency(farePaise / 100)}</span>
                        <StatusBadge status={status} />
                      </div>
                    </div>
                    {firstStr(o, ['message'], '') !== '—' && <p className="text-slate-500 mt-1">{firstStr(o, ['message'])}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">{fmtDate(o.createdAt)}</p>
                    {!mine && pending && (
                      <div className="mt-2 space-y-2 border-t border-amber-200/70 pt-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => respondOffer(o, 'accept')}
                            disabled={offerBusy}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] disabled:opacity-60"
                          >
                            Accept Fare
                          </button>
                          <button
                            onClick={() => respondOffer(o, 'decline')}
                            disabled={offerBusy}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-[11px] disabled:opacity-60"
                          >
                            Decline
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={counterFare[str(o.offerId)] ?? ''}
                            onChange={(e) => setCounterFare((prev) => ({ ...prev, [str(o.offerId)]: Number(e.target.value) }))}
                            className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                            placeholder="Your counter fare (₹)"
                          />
                          <button
                            onClick={() => counterOffer(o)}
                            disabled={offerBusy || !(counterFare[str(o.offerId)] > 0)}
                            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] disabled:opacity-60"
                          >
                            Counter
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Send / counter-offer composer */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Send Your Fare Quote</h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={offerFare || ''}
                onChange={(e) => setOfferFare(Number(e.target.value))}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300"
                placeholder="Fare (₹)"
              />
              <button
                onClick={sendOffer}
                disabled={offerBusy || offerFare <= 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
              >
                Send Offer
              </button>
            </div>
            <input
              type="text"
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="Message (optional) — tarpaulin included, loading at 6 AM…"
            />
            <p className="text-[11px] text-slate-400">
              Accepting the farmer's counter locks that fare and confirms the booking automatically.
            </p>
          </div>
        </div>
      </ModalSheet>

      {/* New template modal */}
      <ModalSheet isOpen={templateModal} onClose={() => setTemplateModal(false)} title="New Load Template" description="Save a frequent lane for one-tap re-posting" maxWidth="sm">
        <form onSubmit={saveTemplate} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Template name</label>
            <input type="text" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="Nashik → Azadpur tomato" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pickup</label>
              <input type="text" value={templateForm.pickup} onChange={(e) => setTemplateForm({ ...templateForm, pickup: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Drop</label>
              <input type="text" value={templateForm.drop} onChange={(e) => setTemplateForm({ ...templateForm, drop: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop (optional)</label>
              <input type="text" value={templateForm.crop} onChange={(e) => setTemplateForm({ ...templateForm, crop: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Weight (quintals)</label>
              <input type="number" step="0.5" value={templateForm.weightQuintals} onChange={(e) => setTemplateForm({ ...templateForm, weightQuintals: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Usual fare (₹)</label>
            <input type="number" value={templateForm.fare || ''} onChange={(e) => setTemplateForm({ ...templateForm, fare: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle type</label>
              <select value={templateForm.vehicleType} onChange={(e) => setTemplateForm({ ...templateForm, vehicleType: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white" required>
                <option value="" disabled>
                  {catalog.length === 0 ? 'No vehicle types on the rate card' : 'Select vehicle type'}
                </option>
                {catalog.map((vt) => (
                  <option key={vt.type} value={vt.type}>
                    {vt.type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Packaging</label>
              <select value={templateForm.packaging} onChange={(e) => setTemplateForm({ ...templateForm, packaging: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white">
                {['Gunny Bags', 'Plastic Crates', 'Wooden Boxes', 'Bulk'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes (optional)</label>
            <input type="text" value={templateForm.notes} onChange={(e) => setTemplateForm({ ...templateForm, notes: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
            Save Template
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
