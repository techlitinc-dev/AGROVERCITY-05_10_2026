import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import PhotoUploader from '../../components/trade/PhotoUploader';
import StatusPill from '../../components/trade/StatusPill';
import Timeline from '../../components/trade/Timeline';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { api, isApiError } from '../../lib/api/client';
import type { PurchaseEvent } from '../../lib/api/purchases';
import { inr } from '../../lib/api/trade';
import {
  acceptBooking,
  addExpense,
  cancelBookingByFarmer,
  getTransportBooking,
  myVehicles,
  pingLocation,
  recordWeighbridge,
  rejectBooking,
  returnLoads,
  tripExpenses,
  updateBookingStatus,
  type ExpenseCategory,
  type OwnerVehicle,
  type ReturnLoad,
  type TransportBooking,
  type TripExpenses,
} from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import { ensureProfile } from '../../stores/dashboard';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const tripPagePosition = (): Promise<{ lat: number; lng: number }> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 8000, maximumAge: 25000 }
    );
  });

const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Manual pings only (no telematics) — use the device position when granted. */
const currentPosition = (): Promise<{ lat: number; lng: number }> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 0, lng: 0 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: 0, lng: 0 }),
      { timeout: 4000 }
    );
  });

const MILESTONES: Array<{ waypoint: string; labelKey: string }> = [
  { waypoint: 'at_pickup', labelKey: 'trMilestoneAtPickup' },
  { waypoint: 'loaded', labelKey: 'trMilestoneLoaded' },
  { waypoint: 'in_transit', labelKey: 'trMilestoneInTransit' },
  { waypoint: 'unloading', labelKey: 'trMilestoneUnloading' },
];

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'diesel',
  'toll',
  'driver_bata',
  'loading_labor',
  'mandi_cess',
  'maintenance',
  'other',
];

const CHAT_STATUSES = ['accepted', 'enRoute', 'delivered'];

type Sheet =
  | 'accept'
  | 'decline'
  | 'cancel'
  | 'pod'
  | 'weighbridge'
  | 'expense'
  | 'rate'
  | null;

interface WeighbridgeView {
  slipNo?: string;
  weighbridgeName?: string;
  tareWeightKg?: number;
  grossWeightKg?: number;
  netWeightKg?: number;
  notes?: string;
}

/** weighbridgeSlip is a free-form record — narrow the known fields safely. */
const asWeighbridge = (raw: Record<string, unknown> | null | undefined): WeighbridgeView | null => {
  if (!raw) return null;
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
  return {
    slipNo: str(raw.slipNo),
    weighbridgeName: str(raw.weighbridgeName),
    tareWeightKg: num(raw.tareWeightKg),
    grossWeightKg: num(raw.grossWeightKg),
    netWeightKg: num(raw.netWeightKg),
    notes: str(raw.notes),
  };
};

/**
 * Trip command center — the heart of the transport module. Shared by farmer
 * (booker) and transporter; the role is derived from the session uid vs the
 * booking's userId / transporterId, and every action self-heals a
 * FORBIDDEN_ROLE drift via ensureProfile + one retry. Never renders phones.
 */
export default function TripPage() {
  const t = useT();
  const navigate = useNavigate();
  const { tripId } = useParams();
  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid);

  const [booking, setBooking] = useState<TransportBooking | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // accept sheet
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  // decline / cancel sheets
  const [reason, setReason] = useState('');
  // pod sheet
  const [podPhotos, setPodPhotos] = useState<string[]>([]);
  const [receiverName, setReceiverName] = useState('');
  const [damageNotes, setDamageNotes] = useState('');
  // weighbridge sheet
  const [wbSlipNo, setWbSlipNo] = useState('');
  const [wbName, setWbName] = useState('');
  const [wbTare, setWbTare] = useState('');
  const [wbGross, setWbGross] = useState('');
  const [wbNotes, setWbNotes] = useState('');
  // expense sheet
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('diesel');
  const [expAmount, setExpAmount] = useState('');
  const [expNotes, setExpNotes] = useState('');
  // expenses summary (transporter)
  const [pnl, setPnl] = useState<TripExpenses | null>(null);
  // return-load matches (transporter, once the trip is underway)
  const [returnLoadsList, setReturnLoadsList] = useState<ReturnLoad[]>([]);
  // bumped on every booking reload so the P&L refetches after actions
  const [tick, setTick] = useState(0);
  // rate sheet (farmer)
  const [rateStars, setRateStars] = useState(0);
  const [rateNote, setRateNote] = useState('');

  const load = useCallback(() => {
    if (!tripId) return;
    setFailed(false);
    getTransportBooking(tripId)
      .then((b) => {
        setBooking(b);
        setTick((x) => x + 1);
      })
      .catch(() => setFailed(true));
  }, [tripId]);

  useEffect(load, [load]);

  const isBooker = !!uid && !!booking && booking.userId === uid;
  const isTransporter = !!uid && !!booking?.transporterId && booking.transporterId === uid;
  const wb = asWeighbridge(booking?.weighbridgeSlip);

  const vehicleLabel = (v: OwnerVehicle): string => `${v.registrationNo} · ${v.vehicleType}`;
  const verifiedVehicles = vehicles.filter((v) => v.docStatus === 'verified' && v.active);
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  // Trip P&L is a transporter view — fetched once the role is known.
  useEffect(() => {
    if (!tripId || !isTransporter) return;
    tripExpenses(tripId)
      .then(setPnl)
      .catch(() => setPnl(null));
  }, [tripId, isTransporter, tick]);

  // Return-load matching (T8): deterministic backend query, transporter only.
  useEffect(() => {
    if (!tripId || !isTransporter) return;
    if (booking?.status !== 'enRoute' && booking?.status !== 'delivered') {
      setReturnLoadsList([]);
      return;
    }
    returnLoads(tripId)
      .then(setReturnLoadsList)
      .catch(() => setReturnLoadsList([]));
  }, [tripId, isTransporter, booking?.status]);

  // PWA location ping every 30 s while the transporter has an active trip
  // (no telematics — spec S16).
  useEffect(() => {
    if (!tripId || !isTransporter) return;
    if (booking?.status !== 'accepted' && booking?.status !== 'enRoute') return;
    const id = window.setInterval(() => {
      tripPagePosition()
        .then((pos) => pingLocation(tripId, pos))
        .catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(id);
  }, [tripId, isTransporter, booking?.status]);

  const closeSheet = () => {
    setSheet(null);
    setErrors({});
  };

  const failToast = (e: unknown) => {
    if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
      setErrors(e.fieldErrors);
    } else if (isApiError(e) && e.code === 'ALREADY_RATED') {
      toast(t('trRatedThanks'));
    } else {
      toast(t('actionFailed'), { error: true });
    }
  };

  /**
   * Run an action with role self-heal: on FORBIDDEN_ROLE, activate the needed
   * persona and retry exactly once (pattern from trade/LotForm.tsx).
   */
  const act = async (role: 'transport' | 'farmer', fn: () => Promise<unknown>, successKey: string, retried = false) => {
    setBusy(true);
    try {
      await fn();
      toast(t(successKey));
      closeSheet();
      load();
    } catch (e) {
      if (isApiError(e) && e.code === 'FORBIDDEN_ROLE' && !retried) {
        const fixed = await ensureProfile(role);
        if (fixed) {
          setBusy(false);
          await act(role, fn, successKey, true);
          return;
        }
      }
      failToast(e);
    } finally {
      setBusy(false);
    }
  };

  const openAccept = () => {
    setErrors({});
    setVehicleId('');
    setSheet('accept');
    myVehicles()
      .then((list) => {
        setVehicles(list);
        const first = list.find((v) => v.docStatus === 'verified' && v.active);
        if (first) setVehicleId(first.id);
      })
      .catch(() => setVehicles([]));
  };

  const submitAccept = () => {
    if (!booking) return;
    if (!vehicleId) {
      setErrors({ vehicle: t('commonRequired') });
      return;
    }
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    void act(
      'transport',
      () =>
        acceptBooking(booking.id, {
          vehicleId,
          vehicleNo: vehicle?.registrationNo,
          driverName: vehicle?.driverName ?? undefined,
        }),
      'trJobAccepted'
    );
  };

  const submitDecline = () => {
    if (!booking) return;
    if (reason.trim().length < 3) {
      setErrors({ reason: t('trDeclineReason') });
      return;
    }
    void act('transport', () => rejectBooking(booking.id, reason.trim()), 'trJobDeclined');
  };

  const submitCancel = () => {
    if (!booking) return;
    if (reason.trim().length < 3) {
      setErrors({ reason: t('trDeclineReason') });
      return;
    }
    void act('farmer', () => cancelBookingByFarmer(booking.id, reason.trim()), 'event_cancelled');
  };

  const markEnRoute = () => {
    if (!booking) return;
    void act('transport', () => updateBookingStatus(booking.id, { status: 'enRoute' }), 'event_enRoute');
  };

  const pingMilestone = (waypoint: string, label: string) => {
    if (!booking) return;
    void (async () => {
      const pos = await currentPosition();
      await act(
        'transport',
        () => pingLocation(booking.id, { ...pos, waypoint, waypointLabel: label }),
        'trPingSent'
      );
    })();
  };

  const openWeighbridge = () => {
    setErrors({});
    setWbSlipNo('');
    setWbName('');
    setWbTare('');
    setWbGross('');
    setWbNotes('');
    setSheet('weighbridge');
  };

  const submitWeighbridge = () => {
    if (!booking) return;
    const next: Record<string, string> = {};
    if (!wbSlipNo.trim()) next.slipNo = t('commonRequired');
    if (!wbName.trim()) next.weighbridgeName = t('commonRequired');
    if (!(Number(wbTare) >= 0) || wbTare === '') next.tare = t('commonRequired');
    if (!(Number(wbGross) > 0)) next.gross = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const tare = Number(wbTare);
    const gross = Number(wbGross);
    void act(
      'transport',
      () =>
        recordWeighbridge(booking.id, {
          slipNo: wbSlipNo.trim(),
          weighbridgeName: wbName.trim(),
          tareWeightKg: tare,
          grossWeightKg: gross,
          netWeightKg: Math.max(0, gross - tare),
          notes: wbNotes.trim() || undefined,
        }),
      'trPingSent'
    );
  };

  const openPod = () => {
    setErrors({});
    setPodPhotos([]);
    setReceiverName('');
    setDamageNotes('');
    setSheet('pod');
  };

  const submitPod = () => {
    if (!booking) return;
    const next: Record<string, string> = {};
    if (podPhotos.length === 0) next.podPhotos = t('commonRequired');
    if (!receiverName.trim()) next.receiverName = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void act(
      'transport',
      () =>
        updateBookingStatus(booking.id, {
          status: 'delivered',
          podPhotos,
          receiverName: receiverName.trim(),
          damageNotes: damageNotes.trim() || undefined,
        }),
      'trPodDone'
    );
  };

  const openExpense = () => {
    setErrors({});
    setExpCategory('diesel');
    setExpAmount('');
    setExpNotes('');
    setSheet('expense');
  };

  const submitExpense = () => {
    if (!booking) return;
    if (!(Number(expAmount) > 0)) {
      setErrors({ amount: t('commonRequired') });
      return;
    }
    void act(
      'transport',
      () =>
        addExpense(booking.id, {
          category: expCategory,
          amount: Math.round(Number(expAmount)),
          notes: expNotes.trim() || undefined,
        }),
      'trExpenseAdded'
    );
  };

  const submitRate = () => {
    if (!booking) return;
    if (rateStars < 1 || rateStars > 5) {
      setErrors({ rating: t('commonRequired') });
      return;
    }
    // No typed wrapper exists for POST /ratings — payload per backend RatingIn.
    void act('farmer', async () => {
      await api.post('/ratings', {
        bookingKind: 'transport',
        bookingId: booking.id,
        stars: rateStars,
        comment: rateNote.trim(),
      });
    }, 'trRatedThanks');
  };

  const timelineEvents: PurchaseEvent[] = (booking?.waypointsLog ?? []).map((w) => ({
    status: w.waypoint,
    at: w.time,
    note: w.label,
  }));

  return (
    <ToolShell toolId="tripDetail" backTo="/dashboard">
      {booking === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {booking ? (
        <>
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {booking.commodity || booking.lot?.crop || t('trTripTitle')} · {booking.pickup} →{' '}
                {booking.drop}
              </span>
              <StatusPill status={booking.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">{fmtDate(booking.date)}</span>
              <span className="trade-card-amount">{inr(booking.fare)}</span>
            </div>
          </div>

          {booking.status === 'cancelled' ? (
            <p className="trade-hint">
              {t('trCancelledBanner')}
              {booking.cancellationReason ? ` — ${booking.cancellationReason}` : ''}
              {booking.cancelledBy ? ` (${t('trCancelledBy')}: ${booking.cancelledBy})` : ''}
            </p>
          ) : null}

          <div className="trade-detail-grid">
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trPickup')}</div>
              <div className="trade-detail-value">{booking.pickup}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trDrop')}</div>
              <div className="trade-detail-value">{booking.drop}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trPickupDate')}</div>
              <div className="trade-detail-value">{fmtDate(booking.date)}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trDistance')}</div>
              <div className="trade-detail-value">
                {booking.distanceKm} {t('trKm')}
              </div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('trFare')}</div>
              <div className="trade-detail-value">{inr(booking.fare)}</div>
            </div>
            {booking.weightQuintals != null ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('trWeight')}</div>
                <div className="trade-detail-value">
                  {booking.weightQuintals} {t('unitQuintal')}
                </div>
              </div>
            ) : null}
            {booking.packaging ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('trPackaging')}</div>
                <div className="trade-detail-value">{booking.packaging}</div>
              </div>
            ) : null}
            {booking.vehicleNo ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('trVehicle')}</div>
                <div className="trade-detail-value">{booking.vehicleNo}</div>
              </div>
            ) : null}
            {booking.driverName ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('trDriver')}</div>
                <div className="trade-detail-value">{booking.driverName}</div>
              </div>
            ) : null}
            {booking.notes ? (
              <div className="trade-detail-item" style={{ gridColumn: '1 / -1' }}>
                <div className="trade-detail-label">{t('commonNotes')}</div>
                <div className="trade-detail-value" style={{ fontWeight: 600 }}>
                  {booking.notes}
                </div>
              </div>
            ) : null}
          </div>

          {booking.status !== 'cancelled' && timelineEvents.length ? (
            <>
              <p className="trade-section-title">{t('trTimeline')}</p>
              <Timeline events={timelineEvents} />
            </>
          ) : null}

          {wb ? (
            <>
              <p className="trade-section-title">{t('trWeighbridgeTitle')}</p>
              <div className="trade-detail-grid">
                {wb.slipNo ? (
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('trSlipNo')}</div>
                    <div className="trade-detail-value">{wb.slipNo}</div>
                  </div>
                ) : null}
                {wb.weighbridgeName ? (
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('trWeighbridgeName')}</div>
                    <div className="trade-detail-value">{wb.weighbridgeName}</div>
                  </div>
                ) : null}
                {wb.tareWeightKg != null ? (
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('trTareWeight')}</div>
                    <div className="trade-detail-value">{wb.tareWeightKg} kg</div>
                  </div>
                ) : null}
                {wb.grossWeightKg != null ? (
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('trGrossWeight')}</div>
                    <div className="trade-detail-value">{wb.grossWeightKg} kg</div>
                  </div>
                ) : null}
                {wb.netWeightKg != null ? (
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('trNetWeight')}</div>
                    <div className="trade-detail-value">{wb.netWeightKg} kg</div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {booking.pod ? (
            <>
              <p className="trade-section-title">{t('trPodTitle')}</p>
              <div className="trade-card" style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-title">{t('trReceiverName')}</span>
                  <span className="trade-card-sub">{fmtDateTime(booking.pod.deliveredAt)}</span>
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">{booking.pod.receiverName}</span>
                </div>
                {booking.pod.photos?.length ? (
                  <div className="trade-card-photos">
                    {booking.pod.photos.slice(0, 4).map((url) => (
                      <img key={url} src={url} alt={t('trPodPhotos')} loading="lazy" />
                    ))}
                  </div>
                ) : null}
                {booking.pod.damageNotes ? (
                  <p className="trade-hint">
                    {t('trDamageNotes')}: {booking.pod.damageNotes}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {isTransporter && (booking.status === 'enRoute' || booking.status === 'delivered') ? (
            <>
              <p className="trade-section-title">{t('trReturnLoads')}</p>
              {returnLoadsList.length ? (
                <div className="trade-list">
                  {returnLoadsList.map((load) => (
                    <div key={load.id} className="trade-card" style={{ cursor: 'default' }}>
                      <div className="trade-card-row">
                        <span className="trade-card-title">{load.crop}</span>
                        <span className="trade-card-amount">{inr(load.targetFare)}</span>
                      </div>
                      <div className="trade-card-row">
                        <span className="trade-card-sub">
                          {t('trReturnLoadMeta', {
                            pickup: load.pickupLocation,
                            drop: load.dropLocation,
                            qty: load.quantityQuintals,
                            date: fmtDate(load.pickupDate),
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="trade-hint">{t('trReturnLoadsEmpty')}</p>
              )}
            </>
          ) : null}

          {isTransporter && pnl ? (
            <>
              {pnl.expenses.length ? (
                <>
                  <p className="trade-section-title">{t('trExpenses')}</p>
                  <div className="trade-list">
                    {pnl.expenses.map((exp) => (
                      <div key={exp.id} className="trade-card" style={{ cursor: 'default' }}>
                        <div className="trade-card-row">
                          <span className="trade-card-title">{t(`trExp_${exp.category}`)}</span>
                          <span className="trade-card-amount">{inr(exp.amount)}</span>
                        </div>
                        {exp.notes ? (
                          <div className="trade-card-row">
                            <span className="trade-card-sub">{exp.notes}</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              <p className="trade-section-title">{t('trTripPnl')}</p>
              <div className="trade-invoice-box">
                <div className="trade-invoice-row">
                  <span>{t('trGrossFare')}</span>
                  <span>{inr(pnl.grossFare)}</span>
                </div>
                <div className="trade-invoice-row">
                  <span>{t('trTotalExpenses')}</span>
                  <span>{inr(pnl.totalExpenses)}</span>
                </div>
                <div className="trade-invoice-row">
                  <span>{t('trCommission')}</span>
                  <span>{inr(pnl.platformCommission)}</span>
                </div>
                <div className="trade-invoice-total trade-invoice-row">
                  <span>{t('trNetProfit')}</span>
                  <span>{inr(pnl.netProfit)}</span>
                </div>
              </div>
            </>
          ) : null}

          {booking.status !== 'cancelled' ? (
            <div className="trade-actions">
              {isTransporter && booking.status === 'requested' ? (
                <button type="button" className="av-btn av-btn-primary" onClick={openAccept} disabled={busy}>
                  {t('trAcceptJob')}
                </button>
              ) : null}

              {isTransporter && booking.status === 'requested' ? (
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  style={{ background: 'var(--av-error)' }}
                  onClick={() => {
                    setErrors({});
                    setReason('');
                    setSheet('decline');
                  }}
                  disabled={busy}
                >
                  {t('trDeclineJob')}
                </button>
              ) : null}

              {isTransporter && booking.status === 'accepted' ? (
                <button type="button" className="av-btn av-btn-primary" onClick={markEnRoute} disabled={busy}>
                  {busy ? <span className="av-spinner" aria-hidden /> : t('trMarkEnRoute')}
                </button>
              ) : null}

              {isTransporter && booking.status === 'enRoute' ? (
                <button type="button" className="av-btn av-btn-primary" onClick={openPod} disabled={busy}>
                  {t('trMarkDelivered')}
                </button>
              ) : null}

              {isTransporter && (booking.status === 'accepted' || booking.status === 'enRoute') ? (
                <button type="button" className="av-btn av-btn-ghost" onClick={openExpense} disabled={busy}>
                  ＋ {t('trAddExpense')}
                </button>
              ) : null}

              {isTransporter && booking.status === 'enRoute' ? (
                <button type="button" className="av-btn av-btn-ghost" onClick={openWeighbridge} disabled={busy}>
                  ⚖️ {t('trWeighbridgeTitle')}
                </button>
              ) : null}

              {CHAT_STATUSES.includes(booking.status) ? (
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => navigate(`/dashboard/p/transport/trips/${booking.id}/chat`)}
                  disabled={busy}
                >
                  💬 {t('trTripChat')}
                </button>
              ) : null}

              {isTransporter ? (
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => navigate(`/dashboard/p/biltyView?trip=${booking.id}`)}
                  disabled={busy}
                >
                  📄 {t('trViewBilty')}
                </button>
              ) : null}

              {isBooker && (booking.status === 'requested' || booking.status === 'accepted') ? (
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  style={{ background: 'var(--av-error)' }}
                  onClick={() => {
                    setErrors({});
                    setReason('');
                    setSheet('cancel');
                  }}
                  disabled={busy}
                >
                  {t('trCancelTrip')}
                </button>
              ) : null}

              {isBooker && booking.status === 'delivered' ? (
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => {
                    setErrors({});
                    setRateStars(0);
                    setRateNote('');
                    setSheet('rate');
                  }}
                  disabled={busy}
                >
                  ★ {t('trRateTransporter')}
                </button>
              ) : null}
            </div>
          ) : null}

          {isTransporter && booking.status === 'enRoute' ? (
            <>
              <p className="trade-section-title">{t('trMilestones')}</p>
              <div className="trade-actions-row">
                {MILESTONES.map((m) => (
                  <button
                    key={m.waypoint}
                    type="button"
                    className="av-btn av-btn-ghost"
                    onClick={() => pingMilestone(m.waypoint, t(m.labelKey))}
                    disabled={busy}
                  >
                    {t(m.labelKey)}
                  </button>
                ))}
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={openWeighbridge}
                  disabled={busy}
                >
                  {t('trMilestoneWeighbridge')}
                </button>
              </div>
            </>
          ) : null}

          <ModalSheet open={sheet === 'accept'} onClose={closeSheet} title={t('trAcceptJob')}>
            <p className="trade-hint">{t('trPickVehicle')}</p>
            {verifiedVehicles.length === 0 ? (
              <>
                <p className="trade-hint">{t('trNoVerifiedVehicle')}</p>
                <div className="trade-actions">
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    onClick={() => navigate('/dashboard/p/vehicleManage/new')}
                    disabled={busy}
                  >
                    ＋ {t('trAddVehicle')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="av-field">
                  <span className="av-label">{t('trPickVehicle')}</span>
                  <ChipSelect
                    options={verifiedVehicles.map(vehicleLabel)}
                    selected={selectedVehicle ? [vehicleLabel(selectedVehicle)] : []}
                    onToggle={(label) => {
                      const found = vehicles.find((v) => vehicleLabel(v) === label);
                      if (found) setVehicleId(found.id);
                    }}
                    single
                  />
                  {errors.vehicle ? <p className="av-field-error">{errors.vehicle}</p> : null}
                </div>
                <div className="trade-actions">
                  <button type="button" className="av-btn av-btn-primary" onClick={submitAccept} disabled={busy}>
                    {busy ? <span className="av-spinner" aria-hidden /> : t('trAcceptJob')}
                  </button>
                  <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                    {t('commonCancel')}
                  </button>
                </div>
              </>
            )}
          </ModalSheet>

          <ModalSheet open={sheet === 'decline'} onClose={closeSheet} title={t('trDeclineJob')}>
            <LabeledTextField
              label={t('trDeclineReason')}
              value={reason}
              onChange={setReason}
              placeholder={t('trCancelReasonPh')}
              required
              error={errors.reason}
            />
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={submitDecline}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('trDeclineJob')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'cancel'} onClose={closeSheet} title={t('trCancelTitle')}>
            <LabeledTextField
              label={t('trDeclineReason')}
              value={reason}
              onChange={setReason}
              placeholder={t('trCancelReasonPh')}
              required
              error={errors.reason}
            />
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={submitCancel}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('trCancelSubmit')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'weighbridge'} onClose={closeSheet} title={t('trWeighbridgeTitle')}>
            <LabeledTextField
              label={t('trSlipNo')}
              value={wbSlipNo}
              onChange={setWbSlipNo}
              required
              error={errors.slipNo}
            />
            <LabeledTextField
              label={t('trWeighbridgeName')}
              value={wbName}
              onChange={setWbName}
              required
              error={errors.weighbridgeName}
            />
            <LabeledTextField
              label={t('trTareWeight')}
              value={wbTare}
              onChange={setWbTare}
              type="number"
              inputMode="decimal"
              required
              error={errors.tare}
            />
            <LabeledTextField
              label={t('trGrossWeight')}
              value={wbGross}
              onChange={setWbGross}
              type="number"
              inputMode="decimal"
              required
              error={errors.gross}
            />
            <LabeledTextField label={t('commonNotes')} value={wbNotes} onChange={setWbNotes} />
            <div className="trade-actions">
              <button type="button" className="av-btn av-btn-primary" onClick={submitWeighbridge} disabled={busy}>
                {busy ? <span className="av-spinner" aria-hidden /> : t('trSaveSlip')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'pod'} onClose={closeSheet} title={t('trPodTitle')}>
            <PhotoUploader photos={podPhotos} onChange={setPodPhotos} min={1} max={6} />
            {errors.podPhotos ? <p className="av-field-error">{errors.podPhotos}</p> : null}
            <LabeledTextField
              label={t('trReceiverName')}
              value={receiverName}
              onChange={setReceiverName}
              placeholder={t('trReceiverNamePh')}
              required
              error={errors.receiverName}
            />
            <LabeledTextField
              label={t('trDamageNotes')}
              value={damageNotes}
              onChange={setDamageNotes}
            />
            <div className="trade-actions">
              <button type="button" className="av-btn av-btn-primary" onClick={submitPod} disabled={busy}>
                {busy ? <span className="av-spinner" aria-hidden /> : t('trPodSubmit')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'expense'} onClose={closeSheet} title={t('trAddExpense')}>
            <div className="av-field">
              <span className="av-label">{t('trExpenseCategory')}</span>
              <ChipSelect
                options={EXPENSE_CATEGORIES.map((c) => t(`trExp_${c}`))}
                selected={[t(`trExp_${expCategory}`)]}
                onToggle={(label) => {
                  const found = EXPENSE_CATEGORIES.find((c) => t(`trExp_${c}`) === label);
                  if (found) setExpCategory(found);
                }}
                single
              />
            </div>
            <LabeledTextField
              label={t('trExpenseAmount')}
              value={expAmount}
              onChange={setExpAmount}
              type="number"
              inputMode="numeric"
              prefix="₹"
              required
              error={errors.amount}
            />
            <LabeledTextField label={t('trExpenseNotes')} value={expNotes} onChange={setExpNotes} />
            <div className="trade-actions">
              <button type="button" className="av-btn av-btn-primary" onClick={submitExpense} disabled={busy}>
                {busy ? <span className="av-spinner" aria-hidden /> : t('trAddExpense')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'rate'} onClose={closeSheet} title={t('trRateTitle')}>
            <div className="av-field">
              <span className="av-label">{t('trRateTransporter')}</span>
              <div className="trade-filter-row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`av-chip${rateStars === n ? ' selected' : ''}`}
                    onClick={() => setRateStars(n)}
                  >
                    {'★'.repeat(n)}
                  </button>
                ))}
              </div>
              {errors.rating ? <p className="av-field-error">{errors.rating}</p> : null}
            </div>
            <LabeledTextField label={t('commonNotes')} value={rateNote} onChange={setRateNote} />
            <div className="trade-actions">
              <button type="button" className="av-btn av-btn-primary" onClick={submitRate} disabled={busy}>
                {busy ? <span className="av-spinner" aria-hidden /> : t('commonSubmit')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>
        </>
      ) : null}
    </ToolShell>
  );
}
