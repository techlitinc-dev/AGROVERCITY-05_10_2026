import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import Timeline from '../../components/trade/Timeline';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import PhotoUploader from '../../components/trade/PhotoUploader';
import { recordCollectionCheck } from '../../lib/api/dairyMarketplace';
import { isApiError } from '../../lib/api/client';
import {
  amountDue,
  cancelPurchase,
  deliverPurchase,
  dispatchPurchase,
  fundEscrow,
  getHandoverOtp,
  getPurchase,
  paidSoFar,
  payAdvance,
  rateCounterparty,
  recordPayment,
  recordQc,
  resolveQcDispute,
  schedulePickup,
  verifyHandover,
  type Purchase,
} from '../../lib/api/purchases';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const unitLabel = (t: (key: string) => string, unit: string): string =>
  unit === 'kg' ? t('unitKg') : t('unitQuintal');

const PAY_METHODS = ['cash', 'upi', 'bank', 'other'] as const;

const METHOD_LABEL_KEYS: Record<string, string> = {
  cash: 'paymentMethodCash',
  upi: 'paymentMethodUpi',
  bank: 'paymentMethodBank',
  bank_transfer: 'paymentMethodBank',
  other: 'paymentMethodOther',
};

const CANCELLABLE = ['confirmed', 'advancePaid', 'pickupScheduled'];

const ESCROW_STATUS_KEYS: Record<string, string> = {
  unfunded: 'escrowUnfunded',
  held: 'escrowHeld',
  released: 'escrowReleased',
  refunded: 'escrowRefunded',
};

/** Handover OTP is verified by the buyer any time after pickup is scheduled. */
const OTP_VERIFY_STATUSES = ['pickupScheduled', 'inTransit', 'delivered'];

/** Chat is open to both parties until the booking reaches a terminal status. */
const CHAT_STATUSES = [
  'confirmed',
  'advancePaid',
  'pickupScheduled',
  'inTransit',
  'delivered',
  'qcDisputed',
];

/** "M:SS" countdown for the handover OTP validity window. */
const fmtClock = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

type Sheet = 'advance' | 'escrow' | 'otp' | 'pickup' | 'cancel' | 'qc' | 'resolve' | 'pay' | 'rate' | null;

/**
 * Purchase detail — the booking state machine (spec F8/V8): advance → pickup →
 * dispatch → deliver → QC / dispute → complete, with payments, invoice and
 * timeline. Buyer-side actions (advance, pickup, deliver, QC, pay) and
 * farmer-side actions (dispatch) are gated by role and current status.
 */
export default function PurchaseDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { purchaseId } = useParams();
  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid);

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // advance sheet
  const [advAmount, setAdvAmount] = useState('');
  const [advMethod, setAdvMethod] = useState<string>('cash');
  const [advReference, setAdvReference] = useState('');
  // pickup sheet
  const [pkDate, setPkDate] = useState('');
  const [pkVehicle, setPkVehicle] = useState('');
  const [pkAddress, setPkAddress] = useState('');
  const [pkNotes, setPkNotes] = useState('');
  // cancel sheet
  const [cnReason, setCnReason] = useState('');
  // qc sheet
  const [qcGrade, setQcGrade] = useState<'A' | 'B' | 'C'>('A');
  const [qcAccepted, setQcAccepted] = useState('');
  const [qcRejected, setQcRejected] = useState('');
  const [qcNote, setQcNote] = useState('');
  // resolve sheet
  const [rsNote, setRsNote] = useState('');
  // pay sheet
  const [payAmount, setPayAmount] = useState('');
  const [payKind, setPayKind] = useState<'balance' | 'full'>('balance');
  const [payMethod, setPayMethod] = useState<string>('cash');
  const [payReference, setPayReference] = useState('');
  // rate sheet
  const [rateTarget, setRateTarget] = useState<'farmer' | 'buyer'>('farmer');
  const [rateStars, setRateStars] = useState(0);
  const [rateNote, setRateNote] = useState('');
  // escrow sheet
  const [escMethod, setEscMethod] = useState<string>('upi');
  const [escReference, setEscReference] = useState('');
  // handover OTP (farmer reveal)
  const [otpInfo, setOtpInfo] = useState<{ otp: string; expiresAt: string } | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  // buyer OTP verify sheet
  const [otpCode, setOtpCode] = useState('');
  // dairy collection check
  const [dairyFat, setDairyFat] = useState('6.5');
  const [dairySnf, setDairySnf] = useState('9.0');
  const [dairyGrade, setDairyGrade] = useState<'accepted' | 'regraded' | 'rejected'>('accepted');
  const [dairyQty, setDairyQty] = useState('');
  const [dairyPhotos, setDairyPhotos] = useState<string[]>([]);
  const [dairyCheckRecorded, setDairyCheckRecorded] = useState(false);

  const load = useCallback(() => {
    if (!purchaseId) return;
    setFailed(false);
    getPurchase(purchaseId)
      .then(setPurchase)
      .catch(() => setFailed(true));
  }, [purchaseId]);

  useEffect(load, [load]);

  // 1s ticker while the farmer has an OTP revealed (drives the countdown).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!otpInfo) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [otpInfo]);

  const methodLabel = (method: string): string => {
    const key = METHOD_LABEL_KEYS[method.toLowerCase()];
    return key ? t(key) : method;
  };

  const kindLabel = (kind: string): string => {
    if (kind === 'full') return t('purchasePayKindFull');
    if (kind === 'advance') return t('status_advancePaid');
    return t('purchasePayKindBalance');
  };

  const closeSheet = () => {
    setSheet(null);
    setErrors({});
  };

  const failToast = (e: unknown) => {
    if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
      setErrors(e.fieldErrors);
    } else if (isApiError(e) && e.code === 'ALREADY_RATED') {
      toast(t('purchaseAlreadyRated'));
    } else if (isApiError(e) && e.code === 'HANDOVER_REQUIRED') {
      // QC before handover OTP verification — tell the buyer what is missing.
      toast(t('otpVerifyNote'), { error: true });
    } else {
      toast(t('actionFailed'), { error: true });
    }
  };

  const otpFailToast = (e: unknown) => {
    if (isApiError(e)) {
      if (e.code === 'INVALID_OTP') return toast(t('otpInvalid'), { error: true });
      if (e.code === 'OTP_EXPIRED') return toast(t('otpExpiredError'), { error: true });
      if (e.code === 'TOO_MANY_ATTEMPTS') return toast(t('otpAttemptsError'), { error: true });
      if (e.code === 'OTP_NOT_GENERATED') return toast(t('otpNotGenerated'), { error: true });
      if (e.code === 'HANDOVER_REQUIRED') return toast(t('otpVerifyNote'), { error: true });
    }
    toast(t('actionFailed'), { error: true });
  };

  /** Direct status actions (no sheet) — dispatch / deliver. */
  const act = async (fn: () => Promise<unknown>, successKey: string) => {
    setBusy(true);
    try {
      await fn();
      toast(t(successKey));
      load();
    } catch (e) {
      failToast(e);
    } finally {
      setBusy(false);
    }
  };

  /** Sheet submissions. */
  const submit = async (fn: () => Promise<unknown>, successKey: string) => {
    setBusy(true);
    try {
      await fn();
      toast(t(successKey));
      closeSheet();
      load();
    } catch (e) {
      failToast(e);
    } finally {
      setBusy(false);
    }
  };

  const openAdvance = () => {
    if (!purchase) return;
    setErrors({});
    setAdvAmount('');
    setAdvMethod('cash');
    setAdvReference('');
    setSheet('advance');
  };

  const openEscrow = () => {
    setErrors({});
    setEscMethod('upi');
    setEscReference('');
    setSheet('escrow');
  };

  const submitEscrow = () => {
    if (!purchase) return;
    void (async () => {
      setBusy(true);
      try {
        // No amount — the backend defaults the escrow to the booking total.
        const updated = await fundEscrow(purchase.id, {
          method: escMethod,
          reference: escReference.trim() || undefined,
        });
        toast(t('escrowFundedToast'));
        setPurchase(updated);
        closeSheet();
      } catch (e) {
        failToast(e);
      } finally {
        setBusy(false);
      }
    })();
  };

  /** Farmer: always fetch a fresh OTP on reveal — expired codes regenerate. */
  const revealOtp = () => {
    if (!purchase) return;
    setOtpBusy(true);
    getHandoverOtp(purchase.id)
      .then((res) => {
        setOtpInfo({ otp: res.otp, expiresAt: res.expiresAt });
        setNowMs(Date.now());
      })
      .catch(failToast)
      .finally(() => setOtpBusy(false));
  };

  const submitOtpVerify = () => {
    if (!purchase) return;
    const next: Record<string, string> = {};
    if (!/^\d{6}$/.test(otpCode.trim())) next.otp = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void (async () => {
      setBusy(true);
      try {
        const updated = await verifyHandover(purchase.id, otpCode.trim());
        toast(t('event_handedOver'));
        setPurchase(updated);
        closeSheet();
      } catch (e) {
        otpFailToast(e);
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleRecordCollectionCheck = async () => {
    if (!purchase) return;
    setBusy(true);
    try {
      await recordCollectionCheck({
        farmerId: purchase.farmerId,
        farmerName: purchase.farmerName,
        milkType: purchase.variety || 'Buffalo',
        quantityLiters: Number(dairyQty || purchase.quantity),
        fatPercent: Number(dairyFat),
        snfPercent: Number(dairySnf),
        ratePerLiter: purchase.agreedPricePerUnit / 100,
        qualityStatus: dairyGrade,
        evidencePhotoUrl: dairyPhotos[0] || '',
        farmerOtpVerified: false,
      });
      setDairyCheckRecorded(true);
      toast(t('dairyCollectionCheckRecorded'));
    } catch (e) {
      failToast(e);
    } finally {
      setBusy(false);
    }
  };

  const openPickup = () => {
    setErrors({});
    setPkDate(new Date().toISOString().slice(0, 10));
    setPkVehicle('');
    setPkAddress('');
    setPkNotes('');
    setSheet('pickup');
  };

  const openPay = () => {
    if (!purchase) return;
    setErrors({});
    setPayAmount(String(amountDue(purchase)));
    setPayKind('balance');
    setPayMethod('cash');
    setPayReference('');
    setSheet('pay');
  };

  const openQc = () => {
    if (!purchase) return;
    setErrors({});
    setQcGrade('A');
    setQcAccepted(String(purchase.quantity));
    setQcRejected('0');
    setQcNote('');
    setSheet('qc');
  };

  const openRate = (target: 'farmer' | 'buyer') => {
    setErrors({});
    setRateTarget(target);
    setRateStars(0);
    setRateNote('');
    setSheet('rate');
  };

  const submitAdvance = () => {
    if (!purchase) return;
    const next: Record<string, string> = {};
    if (!(Number(advAmount) > 0)) next.amount = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void submit(
      () =>
        payAdvance(purchase.id, {
          amount: Math.round(Number(advAmount)),
          method: advMethod,
          reference: advReference.trim() || undefined,
        }),
      'event_advancePaid'
    );
  };

  const submitPickup = () => {
    if (!purchase) return;
    const next: Record<string, string> = {};
    if (!pkDate) next.date = t('commonRequired');
    if (!pkAddress.trim()) next.address = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void submit(
      () =>
        schedulePickup(purchase.id, {
          date: pkDate,
          vehicleType: pkVehicle.trim() || undefined,
          address: pkAddress.trim(),
          notes: pkNotes.trim() || undefined,
        }),
      'event_pickupScheduled'
    );
  };

  const submitQc = () => {
    if (!purchase) return;
    const next: Record<string, string> = {};
    const accepted = Number(qcAccepted);
    const rejected = Number(qcRejected);
    if (!Number.isFinite(accepted) || accepted < 0) next.acceptedQty = t('commonRequired');
    if (!Number.isFinite(rejected) || rejected < 0) next.rejectedQty = t('commonRequired');
    if (
      Number.isFinite(accepted) &&
      Number.isFinite(rejected) &&
      Math.abs(accepted + rejected - purchase.quantity) > 0.001
    ) {
      next.acceptedQty = t('purchaseQcSumError');
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void submit(
      () =>
        recordQc(purchase.id, {
          grade: qcGrade,
          acceptedQty: accepted,
          rejectedQty: rejected,
          note: qcNote.trim() || undefined,
        }),
      'event_qc'
    );
  };

  const submitPay = () => {
    if (!purchase) return;
    const next: Record<string, string> = {};
    if (!(Number(payAmount) > 0)) next.amount = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void submit(
      () =>
        recordPayment(purchase.id, {
          amount: Math.round(Number(payAmount)),
          method: payMethod,
          reference: payReference.trim() || undefined,
          kind: payKind,
        }),
      'event_payment'
    );
  };

  const submitRate = () => {
    if (!purchase) return;
    const next: Record<string, string> = {};
    if (rateStars < 1 || rateStars > 5) next.rating = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void submit(
      () =>
        rateCounterparty(purchase.id, {
          target: rateTarget,
          rating: rateStars,
          review: rateNote.trim() || undefined,
        }),
      'purchaseRatedThanks'
    );
  };

  const isBuyer = !!uid && purchase?.buyerId === uid;
  const isFarmer = !!uid && purchase?.farmerId === uid;
  const due = purchase ? amountDue(purchase) : 0;
  const otpRemainingMs = otpInfo ? new Date(otpInfo.expiresAt).getTime() - nowMs : 0;

  return (
    <ToolShell toolId="purchases" backTo="/dashboard/p/purchases">
      {purchase === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {purchase ? (
        <>
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {purchase.crop} · {purchase.quantity} {unitLabel(t, purchase.unit)}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {purchase.source?.type === 'dairy' ? (
                  <span
                    className="trade-pill"
                    style={{ color: '#0369a1', borderColor: '#0369a1', background: '#e0f2fe' }}
                  >
                    {t('purchase.sourceDairy')}
                  </span>
                ) : null}
                <StatusPill status={purchase.status} />
              </div>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">{fmtDate(purchase.createdAt)}</span>
              <span className="trade-card-amount">{inr(purchase.totalAmount)}</span>
            </div>
          </div>

          {purchase.status === 'cancelled' ? (
            <p className="trade-hint">{t('purchaseCancelledBanner')}</p>
          ) : null}
          {purchase.status === 'qcDisputed' ? (
            <p className="trade-hint">{t('purchaseQcDisputedBanner')}</p>
          ) : null}
          {purchase.status === 'completed' ? (
            <p className="trade-hint">{t('purchaseCompletedBanner')}</p>
          ) : null}

          <div className="trade-detail-grid">
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('purchaseBuyer')}</div>
              <div className="trade-detail-value">{purchase.buyerName}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('purchaseFarmer')}</div>
              <div className="trade-detail-value">{purchase.farmerName}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('purchaseAgreedPrice')}</div>
              <div className="trade-detail-value">
                {inr(purchase.agreedPricePerUnit)}/{unitLabel(t, purchase.unit)}
              </div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('commonQuantity')}</div>
              <div className="trade-detail-value">
                {purchase.quantity} {unitLabel(t, purchase.unit)}
              </div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('purchaseBookingValue')}</div>
              <div className="trade-detail-value">{inr(purchase.totalAmount)}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('purchasePaid')}</div>
              <div className="trade-detail-value">{inr(paidSoFar(purchase))}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('purchaseDue')}</div>
              <div className="trade-detail-value">{inr(due)}</div>
            </div>
            {purchase.finalAmount !== undefined && purchase.finalAmount !== null ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('purchaseFinal')}</div>
                <div className="trade-detail-value">{inr(purchase.finalAmount)}</div>
              </div>
            ) : null}
          </div>

          {purchase.pickup ? (
            <>
              <p className="trade-section-title">{t('purchasePickupInfo')}</p>
              <div className="trade-detail-grid">
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('purchasePickupDate')}</div>
                  <div className="trade-detail-value">{fmtDate(purchase.pickup.date)}</div>
                </div>
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('purchasePickupVehicle')}</div>
                  <div className="trade-detail-value">
                    {purchase.pickup.vehicleType || t('commonNotAvailable')}
                  </div>
                </div>
                <div className="trade-detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="trade-detail-label">{t('purchasePickupAddress')}</div>
                  <div className="trade-detail-value">{purchase.pickup.address}</div>
                </div>
                {purchase.pickup.notes ? (
                  <div className="trade-detail-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="trade-detail-label">{t('purchasePickupNotes')}</div>
                    <div className="trade-detail-value" style={{ fontWeight: 600 }}>
                      {purchase.pickup.notes}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {purchase.qc ? (
            <>
              <p className="trade-section-title">{t('purchaseQcTitle')}</p>
              <div className="trade-detail-grid">
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('purchaseQcGrade')}</div>
                  <div className="trade-detail-value">{purchase.qc.grade}</div>
                </div>
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('purchaseQcAccepted')}</div>
                  <div className="trade-detail-value">{purchase.qc.acceptedQty}</div>
                </div>
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('purchaseQcRejected')}</div>
                  <div className="trade-detail-value">{purchase.qc.rejectedQty}</div>
                </div>
                {purchase.qc.note ? (
                  <div className="trade-detail-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="trade-detail-label">{t('commonNotes')}</div>
                    <div className="trade-detail-value" style={{ fontWeight: 600 }}>
                      {purchase.qc.note}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {purchase.escrow ? (
            <>
              <p className="trade-section-title">{t('escrowTitle')}</p>
              <div className="trade-detail-grid">
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('escrowTitle')}</div>
                  <div className="trade-detail-value">
                    {t(ESCROW_STATUS_KEYS[purchase.escrow.status] ?? purchase.escrow.status)}
                  </div>
                </div>
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('escrowAmount')}</div>
                  <div className="trade-detail-value">{inr(purchase.escrow.amount)}</div>
                </div>
                {purchase.escrow.status === 'released' && purchase.escrow.commission != null ? (
                  <>
                    <div className="trade-detail-item">
                      <div className="trade-detail-label">{t('escrowCommission')}</div>
                      <div className="trade-detail-value">{inr(purchase.escrow.commission)}</div>
                    </div>
                    <div className="trade-detail-item">
                      <div className="trade-detail-label">{t('escrowNetRelease')}</div>
                      <div className="trade-detail-value">
                        {inr(purchase.escrow.netRelease ?? purchase.escrow.amount)}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : null}

          {purchase.source?.type === 'dairy' ? (
            <div className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{t('dairyCollectionCheckTitle')}</span>
                {dairyCheckRecorded ? (
                  <span className="trade-pill" style={{ color: 'var(--av-success)', borderColor: 'var(--av-success)' }}>
                    ✓ {t('dairyCollectionCheckRecorded')}
                  </span>
                ) : null}
              </div>
              <p className="trade-hint">{t('dairyCollectionCheckSub')}</p>
              {dairyCheckRecorded ? (
                <div className="trade-detail-grid" style={{ marginTop: '0.5rem' }}>
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('dairyFat')}</div>
                    <div className="trade-detail-value">{dairyFat}%</div>
                  </div>
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('dairySnf')}</div>
                    <div className="trade-detail-value">{dairySnf}%</div>
                  </div>
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('dairyQualityGrade')}</div>
                    <div className="trade-detail-value">{dairyGrade}</div>
                  </div>
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('commonQuantity')}</div>
                    <div className="trade-detail-value">{dairyQty || purchase.quantity} L</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="trade-label">{t('dairyFat')}</label>
                      <input
                        type="number"
                        step="0.1"
                        className="trade-input"
                        value={dairyFat}
                        onChange={(e) => setDairyFat(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="trade-label">{t('dairySnf')}</label>
                      <input
                        type="number"
                        step="0.1"
                        className="trade-input"
                        value={dairySnf}
                        onChange={(e) => setDairySnf(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="trade-label">{t('dairyQualityGrade')}</label>
                      <select
                        className="trade-input"
                        value={dairyGrade}
                        onChange={(e) => setDairyGrade(e.target.value as 'accepted' | 'regraded' | 'rejected')}
                      >
                        <option value="accepted">{t('dairyGradeAccepted')}</option>
                        <option value="regraded">{t('dairyGradeRegraded')}</option>
                        <option value="rejected">{t('dairyGradeRejected')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="trade-label">{t('commonQuantity')} (L)</label>
                      <input
                        type="number"
                        step="1"
                        className="trade-input"
                        value={dairyQty || String(purchase.quantity)}
                        onChange={(e) => setDairyQty(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="trade-label">{t('dairyEvidencePhoto')}</label>
                    <PhotoUploader photos={dairyPhotos} onChange={setDairyPhotos} min={1} max={4} />
                  </div>
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    disabled={busy}
                    onClick={handleRecordCollectionCheck}
                  >
                    {busy ? <span className="av-spinner" aria-hidden /> : t('dairyRecordCheckCta')}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {isFarmer && purchase.escrow?.status === 'held' ? (
            <div className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{t('otpTitle')}</span>
                {purchase.handover?.verifiedAt ? (
                  <span className="trade-pill" style={{ color: 'var(--av-success)', borderColor: 'var(--av-success)' }}>
                    ✓ {t('otpVerifiedBadge')}
                  </span>
                ) : null}
              </div>
              {purchase.handover?.verifiedAt ? null : otpInfo && otpRemainingMs > 0 ? (
                <>
                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: 34,
                      fontWeight: 900,
                      letterSpacing: 6,
                      color: 'var(--av-green-deep)',
                    }}
                  >
                    {otpInfo.otp}
                  </div>
                  <p className="trade-hint" style={{ textAlign: 'center' }}>
                    {t('otpCountdown', { time: fmtClock(otpRemainingMs) })}
                  </p>
                  <p className="trade-hint">{t('otpRevealNote')}</p>
                </>
              ) : (
                <>
                  {otpInfo ? (
                    <p className="trade-hint">{t('otpExpiredNote')}</p>
                  ) : (
                    <p className="trade-hint">{t('otpRevealNote')}</p>
                  )}
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    onClick={revealOtp}
                    disabled={otpBusy}
                  >
                    {otpBusy ? <span className="av-spinner" aria-hidden /> : t('otpRevealCta')}
                  </button>
                </>
              )}
            </div>
          ) : null}

          {purchase.invoice ? (
            <div className="trade-invoice-box">
              <div className="trade-invoice-row">
                <span>{t('purchaseInvoiceTitle')}</span>
                <span>{fmtDate(purchase.invoice.issuedAt)}</span>
              </div>
              <div className="trade-invoice-row">
                <span>{t('purchaseInvoiceNumber')}</span>
                <span>{purchase.invoice.number}</span>
              </div>
              <div className="trade-invoice-row">
                <span>{t('purchaseBookingValue')}</span>
                <span>{inr(purchase.totalAmount)}</span>
              </div>
              {purchase.payments.map((pay) => (
                <div key={pay.id} className="trade-invoice-row">
                  <span>
                    {[kindLabel(pay.kind), pay.method ? methodLabel(pay.method) : '', fmtDate(pay.at)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span>{inr(pay.amount)}</span>
                </div>
              ))}
              <div className="trade-invoice-row">
                <span>{t('purchasePaid')}</span>
                <span>{inr(paidSoFar(purchase))}</span>
              </div>
              <div className="trade-invoice-row">
                <span>{t('purchaseDue')}</span>
                <span>{inr(due)}</span>
              </div>
              <div className="trade-invoice-total trade-invoice-row">
                <span>
                  {purchase.finalAmount !== undefined && purchase.finalAmount !== null
                    ? t('purchaseFinal')
                    : t('commonTotal')}
                </span>
                <span>{inr(purchase.finalAmount ?? purchase.totalAmount)}</span>
              </div>
            </div>
          ) : null}

          <p className="trade-section-title">{t('purchaseTimeline')}</p>
          <Timeline events={purchase.events} />

          {purchase.status !== 'cancelled' && purchase.status !== 'completed' ? (
            <div className="trade-actions">
              {isBuyer && purchase.status === 'confirmed' && purchase.escrow?.status === 'unfunded' ? (
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={openEscrow}
                  disabled={busy}
                >
                  {t('escrowFundCta')}
                </button>
              ) : null}

              {isBuyer &&
              purchase.status === 'confirmed' &&
              purchase.escrow?.status !== 'held' ? (
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={openAdvance}
                  disabled={busy}
                >
                  {t('purchaseAdvanceTitle')}
                </button>
              ) : null}

              {isBuyer && purchase.status === 'advancePaid' ? (
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={openPickup}
                  disabled={busy}
                >
                  {t('purchasePickupTitle')}
                </button>
              ) : null}

              {isBuyer && purchase.status === 'pickupScheduled' ? (
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => void act(() => dispatchPurchase(purchase.id), 'event_inTransit')}
                  disabled={busy}
                >
                  {busy ? <span className="av-spinner" aria-hidden /> : t('purchaseDispatch')}
                </button>
              ) : null}

              {isBuyer && purchase.status === 'inTransit' ? (
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => void act(() => deliverPurchase(purchase.id), 'event_delivered')}
                  disabled={busy}
                >
                  {busy ? <span className="av-spinner" aria-hidden /> : t('purchaseDeliver')}
                </button>
              ) : null}

              {isBuyer &&
              purchase.escrow?.status === 'held' &&
              !purchase.handover?.verifiedAt &&
              OTP_VERIFY_STATUSES.includes(purchase.status) ? (
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => {
                    setErrors({});
                    setOtpCode('');
                    setSheet('otp');
                  }}
                  disabled={busy}
                >
                  {t('otpVerifyCta')}
                </button>
              ) : null}

              {isBuyer && purchase.status === 'delivered' ? (
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={openQc}
                  disabled={busy}
                >
                  {t('purchaseQcTitle')}
                </button>
              ) : null}

              {purchase.status === 'qcDisputed' ? (
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => {
                    setErrors({});
                    setRsNote('');
                    setSheet('resolve');
                  }}
                  disabled={busy}
                >
                  {t('purchaseResolveTitle')}
                </button>
              ) : null}

              {isBuyer && purchase.status !== 'confirmed' && due > 0 ? (
                <button type="button" className="av-btn av-btn-ghost" onClick={openPay} disabled={busy}>
                  {t('purchasePayTitle')}
                </button>
              ) : null}

              {(isBuyer || isFarmer) && CHAT_STATUSES.includes(purchase.status) ? (
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => navigate(`/dashboard/p/purchases/${purchase.id}/chat`)}
                  disabled={busy}
                >
                  {t('chatOpenCta')}
                </button>
              ) : null}

              {CANCELLABLE.includes(purchase.status) ? (
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  style={{ background: 'var(--av-error)' }}
                  onClick={() => {
                    setErrors({});
                    setCnReason('');
                    setSheet('cancel');
                  }}
                  disabled={busy}
                >
                  {t('purchaseCancel')}
                </button>
              ) : null}
            </div>
          ) : null}

          {purchase.status === 'completed' ? (
            <div className="trade-actions">
              {isBuyer && !purchase.rating?.buyerToFarmer ? (
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => openRate('farmer')}
                  disabled={busy}
                >
                  {t('purchaseRateFarmer')}
                </button>
              ) : null}
              {isFarmer && !purchase.rating?.farmerToBuyer ? (
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => openRate('buyer')}
                  disabled={busy}
                >
                  {t('purchaseRateBuyer')}
                </button>
              ) : null}
            </div>
          ) : null}

          {(isBuyer && purchase.rating?.buyerToFarmer) ||
          (isFarmer && purchase.rating?.farmerToBuyer) ? (
            <p className="trade-hint">{t('purchaseAlreadyRated')}</p>
          ) : null}

          <ModalSheet
            open={sheet === 'advance'}
            onClose={closeSheet}
            title={t('purchaseAdvanceTitle')}
          >
            <LabeledTextField
              label={t('purchaseAdvanceAmount')}
              value={advAmount}
              onChange={setAdvAmount}
              type="number"
              inputMode="numeric"
              prefix="₹"
              required
              error={errors.amount}
            />
            <div className="av-field">
              <span className="av-label">{t('purchaseAdvanceMethod')}</span>
              <ChipSelect
                options={PAY_METHODS.map((m) => methodLabel(m))}
                selected={[methodLabel(advMethod)]}
                onToggle={(label) => {
                  const found = PAY_METHODS.find((m) => methodLabel(m) === label);
                  if (found) setAdvMethod(found);
                }}
                single
              />
            </div>
            <LabeledTextField
              label={t('purchaseAdvanceReference')}
              value={advReference}
              onChange={setAdvReference}
            />
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={submitAdvance}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('purchaseAdvanceSubmit')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'escrow'} onClose={closeSheet} title={t('escrowFundTitle')}>
            <p className="trade-hint">{t('escrowFundNote')}</p>
            <div className="av-field">
              <span className="av-label">{t('purchasePayMethod')}</span>
              <ChipSelect
                options={PAY_METHODS.map((m) => methodLabel(m))}
                selected={[methodLabel(escMethod)]}
                onToggle={(label) => {
                  const found = PAY_METHODS.find((m) => methodLabel(m) === label);
                  if (found) setEscMethod(found);
                }}
                single
              />
            </div>
            <LabeledTextField
              label={t('purchaseAdvanceReference')}
              value={escReference}
              onChange={setEscReference}
            />
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={submitEscrow}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('escrowFundCta')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'otp'} onClose={closeSheet} title={t('otpVerifyTitle')}>
            <p className="trade-hint">{t('otpVerifyNote')}</p>
            <LabeledTextField
              label={t('otpCodeLabel')}
              value={otpCode}
              onChange={(v) => setOtpCode(v.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder={t('otpVerifyPlaceholder')}
              required
              error={errors.otp}
            />
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={submitOtpVerify}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('otpVerifySubmit')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'pickup'} onClose={closeSheet} title={t('purchasePickupTitle')}>
            <LabeledTextField
              label={t('purchasePickupDate')}
              value={pkDate}
              onChange={setPkDate}
              type="date"
              required
              error={errors.date}
            />
            <LabeledTextField
              label={t('purchasePickupVehicle')}
              value={pkVehicle}
              onChange={setPkVehicle}
              placeholder={t('purchasePickupVehiclePlaceholder')}
            />
            <LabeledTextField
              label={t('purchasePickupAddress')}
              value={pkAddress}
              onChange={setPkAddress}
              required
              error={errors.address}
            />
            <LabeledTextField
              label={t('purchasePickupNotes')}
              value={pkNotes}
              onChange={setPkNotes}
            />
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={submitPickup}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('purchasePickupSubmit')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'cancel'} onClose={closeSheet} title={t('purchaseCancelTitle')}>
            <LabeledTextField
              label={t('purchaseCancelReason')}
              value={cnReason}
              onChange={setCnReason}
              placeholder={t('purchaseCancelReasonPlaceholder')}
            />
            <p className="trade-hint">{t('purchaseCancelNote')}</p>
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={() =>
                  void submit(
                    () => cancelPurchase(purchase.id, { reason: cnReason.trim() }),
                    'event_cancelled'
                  )
                }
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('purchaseCancelSubmit')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'qc'} onClose={closeSheet} title={t('purchaseQcTitle')}>
            <div className="av-field">
              <span className="av-label">{t('purchaseQcGrade')}</span>
              <ChipSelect
                options={['A', 'B', 'C']}
                selected={[qcGrade]}
                onToggle={(g) => setQcGrade(g as 'A' | 'B' | 'C')}
                single
              />
            </div>
            <LabeledTextField
              label={t('purchaseQcAccepted')}
              value={qcAccepted}
              onChange={setQcAccepted}
              type="number"
              inputMode="decimal"
              required
              error={errors.acceptedQty}
            />
            <LabeledTextField
              label={t('purchaseQcRejected')}
              value={qcRejected}
              onChange={setQcRejected}
              type="number"
              inputMode="decimal"
              required
              error={errors.rejectedQty}
            />
            <LabeledTextField label={t('purchaseQcNote')} value={qcNote} onChange={setQcNote} />
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={submitQc}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('purchaseQcSubmit')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet
            open={sheet === 'resolve'}
            onClose={closeSheet}
            title={t('purchaseResolveTitle')}
          >
            <LabeledTextField
              label={t('purchaseResolveLabel')}
              value={rsNote}
              onChange={setRsNote}
              placeholder={t('purchaseResolvePlaceholder')}
              required
              error={errors.resolution}
            />
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => {
                  if (!rsNote.trim()) {
                    setErrors({ resolution: t('commonRequired') });
                    return;
                  }
                  void submit(
                    () => resolveQcDispute(purchase.id, { resolution: rsNote.trim() }),
                    'event_resolved'
                  );
                }}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('purchaseResolveSubmit')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'pay'} onClose={closeSheet} title={t('purchasePayTitle')}>
            <LabeledTextField
              label={t('purchasePayAmount')}
              value={payAmount}
              onChange={setPayAmount}
              type="number"
              inputMode="numeric"
              prefix="₹"
              required
              error={errors.amount}
            />
            <div className="av-field">
              <span className="av-label">{t('purchasePayKind')}</span>
              <ChipSelect
                options={[t('purchasePayKindBalance'), t('purchasePayKindFull')]}
                selected={[
                  payKind === 'full' ? t('purchasePayKindFull') : t('purchasePayKindBalance'),
                ]}
                onToggle={(label) => setPayKind(label === t('purchasePayKindFull') ? 'full' : 'balance')}
                single
              />
            </div>
            <div className="av-field">
              <span className="av-label">{t('purchasePayMethod')}</span>
              <ChipSelect
                options={PAY_METHODS.map((m) => methodLabel(m))}
                selected={[methodLabel(payMethod)]}
                onToggle={(label) => {
                  const found = PAY_METHODS.find((m) => methodLabel(m) === label);
                  if (found) setPayMethod(found);
                }}
                single
              />
            </div>
            <LabeledTextField
              label={t('purchasePayReference')}
              value={payReference}
              onChange={setPayReference}
            />
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={submitPay}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('purchasePaySubmit')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={closeSheet} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </ModalSheet>

          <ModalSheet open={sheet === 'rate'} onClose={closeSheet} title={t('purchaseRateTitle')}>
            <div className="av-field">
              <span className="av-label">
                {rateTarget === 'farmer' ? t('purchaseRateFarmer') : t('purchaseRateBuyer')}
              </span>
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
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={submitRate}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('purchaseRateSubmit')}
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
