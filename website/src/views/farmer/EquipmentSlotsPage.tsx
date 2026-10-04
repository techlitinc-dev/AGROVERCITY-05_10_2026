import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import {
  bookEquipmentSlot,
  cancelEquipmentBooking,
  fetchEquipmentList,
  fetchEquipmentSlots,
  joinEquipmentWaitlist,
  quoteEquipment,
  type EquipmentListItem,
  type EquipmentQuote,
  type EquipmentSlot,
} from '../../lib/api/equipmentOwner';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/saas_personas.css';
import '../../theme/trade.css';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * Farmer slot calendar (toolId equipment deep route) — daily slots for one
 * machine with book / waitlist / cancel against the farmer-face endpoints,
 * plus a pricing-engine estimate before booking.
 */
export default function EquipmentSlotsPage() {
  const t = useT();
  useEnsureProfile('farmer');
  const { equipmentId = '' } = useParams();
  const userName = useSessionStore((s) => s.user?.name);

  const [machine, setMachine] = useState<EquipmentListItem | null>(null);
  const [machineLoaded, setMachineLoaded] = useState(false);
  const [machineFailed, setMachineFailed] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<EquipmentSlot[] | null>(null);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  /** slotId → bookingId for bookings created in this session (cancel needs it). */
  const [myBookings, setMyBookings] = useState<Record<string, string>>({});
  const [waitlisted, setWaitlisted] = useState<string[]>([]);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateMode, setEstimateMode] = useState<'hourly' | 'perAcre'>('hourly');
  const [estimateQty, setEstimateQty] = useState('4');
  const [estimate, setEstimate] = useState<EquipmentQuote | null>(null);
  const [estimateBusy, setEstimateBusy] = useState(false);

  const loadMachine = useCallback(() => {
    setMachineFailed(false);
    fetchEquipmentList()
      .then((list) => {
        setMachine(list.find((m) => m.id === equipmentId) ?? null);
        setMachineLoaded(true);
      })
      .catch(() => setMachineFailed(true));
  }, [equipmentId]);

  useEffect(loadMachine, [loadMachine]);

  const loadSlots = useCallback(() => {
    if (!equipmentId) return;
    setSlotsFailed(false);
    fetchEquipmentSlots(equipmentId, date)
      .then(setSlots)
      .catch(() => setSlotsFailed(true));
  }, [equipmentId, date]);

  useEffect(loadSlots, [loadSlots]);

  const handleBook = async (slot: EquipmentSlot) => {
    setBusySlotId(slot.id);
    try {
      const res = await bookEquipmentSlot(slot.id, userName ?? t('eqDefaultFarmerName'));
      if (res.booking?.id) {
        setMyBookings((prev) => ({ ...prev, [slot.id]: res.booking.id as string }));
      }
      toast(
        res.status === 'booked'
          ? `${t('eqBookedOk')} · ${t('eqAgriCoinsEarned', { count: res.agriCoinsEarned })}`
          : t('eqBookedPending')
      );
      loadSlots();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusySlotId(null);
    }
  };

  const handleWaitlist = async (slot: EquipmentSlot) => {
    setBusySlotId(slot.id);
    try {
      await joinEquipmentWaitlist(slot.id);
      setWaitlisted((prev) => [...prev, slot.id]);
      toast(t('eqWaitlisted'));
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusySlotId(null);
    }
  };

  const handleCancel = async (slot: EquipmentSlot) => {
    const bookingId = myBookings[slot.id];
    if (!bookingId) return;
    setBusySlotId(slot.id);
    try {
      await cancelEquipmentBooking(bookingId);
      setMyBookings((prev) => {
        const next = { ...prev };
        delete next[slot.id];
        return next;
      });
      toast(t('eqCancelled'));
      loadSlots();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusySlotId(null);
    }
  };

  const handleEstimate = async (e: FormEvent) => {
    e.preventDefault();
    if (!machine) return;
    setEstimateBusy(true);
    try {
      const res = await quoteEquipment(machine.id, {
        mode: estimateMode,
        hours: estimateMode === 'hourly' ? Number(estimateQty) : undefined,
        acres: estimateMode === 'perAcre' ? Number(estimateQty) : undefined,
      });
      setEstimate(res);
    } catch {
      setEstimate(null);
      toast(t('actionFailed'), { error: true });
    } finally {
      setEstimateBusy(false);
    }
  };

  const slotBadge = (slot: EquipmentSlot): { cls: string; label: string } => {
    if (slot.status === 'available') return { cls: 'saas-badge-success', label: t('eqSlotAvailable') };
    if (slot.status === 'pending') return { cls: 'saas-badge-warning', label: t('eqSlotPendingApproval') };
    return { cls: 'saas-badge-info', label: t('eqStatusBooked') };
  };

  if (machineFailed) {
    return (
      <div className="saas-container" style={{ padding: 0 }}>
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="saas-btn-secondary" onClick={loadMachine}>
              ↻ {t('retry')}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="saas-container" style={{ padding: 0 }}>
      <div className="saas-panel">
        <div className="saas-panel-title">
          <span>{machine ? machine.name : t('commonLoading')}</span>
          {machine ? (
            <button type="button" className="saas-btn-secondary" onClick={() => setEstimateOpen(true)}>
              💰 {t('eqEstimate')}
            </button>
          ) : null}
        </div>

        {machine ? (
          <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '1rem' }}>
            {t('eqRatePerHour', { rate: machine.hourlyRate })}
            {machine.perAcreRate ? ` · ${t('eqRatePerAcre', { rate: machine.perAcreRate })}` : ''}
            {' · '}
            <span className={`saas-badge ${machine.ownerType === 'fpo' ? 'saas-badge-info' : 'saas-badge-warning'}`}>
              {machine.ownerType === 'fpo' ? t('eqOwnerBadgeFpo') : t('eqOwnerBadgePrivate')}
            </span>
          </div>
        ) : null}

        {machine === null && !machineLoaded ? <p className="trade-hint">{t('commonLoading')}</p> : null}

        {machine === null && machineLoaded ? <EmptyState icon="🚜" titleKey="eqMachineNotFound" /> : null}

        <div className="saas-form-group" style={{ maxWidth: '220px' }}>
          <label className="saas-form-label" htmlFor="eq-slot-date">
            {t('eqPickDate')}
          </label>
          <input
            id="eq-slot-date"
            type="date"
            className="saas-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {slots === null && !slotsFailed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

        {slotsFailed ? (
          <EmptyState
            icon="📡"
            titleKey="tradeLoadFailed"
            action={
              <button type="button" className="saas-btn-secondary" onClick={loadSlots}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {slots !== null && slots.length === 0 ? <EmptyState icon="📅" titleKey="eqNoSlots" /> : null}

        {machine !== null && slots !== null && slots.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {slots.map((slot) => {
              const badge = slotBadge(slot);
              const isMine = Boolean(myBookings[slot.id]);
              const isWaitlisted = waitlisted.includes(slot.id);
              return (
                <div
                  key={slot.id}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.75rem',
                    padding: '0.875rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.375rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>{slot.slotName}</span>
                    <span className={`saas-badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {slot.duration} · {slot.recommendedTask}
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>₹{slot.priceRupees}</div>
                  {slot.bookedByName ? (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {isMine ? t('eqMyBookingBadge') : t('eqSlotBookedBy', { name: slot.bookedByName })}
                    </div>
                  ) : null}
                  <div style={{ marginTop: '0.25rem' }}>
                    {slot.status === 'available' ? (
                      <button
                        type="button"
                        className="saas-btn-primary"
                        style={{ fontSize: '0.8125rem' }}
                        onClick={() => void handleBook(slot)}
                        disabled={busySlotId === slot.id}
                      >
                        {t('eqBookSlot')}
                      </button>
                    ) : isMine ? (
                      <button
                        type="button"
                        className="saas-btn-secondary"
                        style={{ fontSize: '0.8125rem', color: '#f87171' }}
                        onClick={() => void handleCancel(slot)}
                        disabled={busySlotId === slot.id}
                      >
                        {t('eqCancelBooking')}
                      </button>
                    ) : !isMine && slot.status !== 'pending' ? (
                      <button
                        type="button"
                        className="saas-btn-secondary"
                        style={{ fontSize: '0.8125rem' }}
                        onClick={() => void handleWaitlist(slot)}
                        disabled={busySlotId === slot.id || isWaitlisted}
                      >
                        {isWaitlisted ? t('eqWaitlisted') : t('eqJoinWaitlist')}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <ModalSheet open={estimateOpen} onClose={() => setEstimateOpen(false)} title={t('eqEstimate')}>
        <form onSubmit={handleEstimate}>
          <div className="saas-form-group">
            <label className="saas-form-label" htmlFor="eq-est-mode">
              {t('eqEstimateMode')}
            </label>
            <select
              id="eq-est-mode"
              className="saas-select"
              value={estimateMode}
              onChange={(e) => {
                setEstimateMode(e.target.value as 'hourly' | 'perAcre');
                setEstimate(null);
              }}
            >
              <option value="hourly">{t('eqModeHourly')}</option>
              <option value="perAcre">{t('eqModePerAcre')}</option>
            </select>
          </div>
          <div className="saas-form-group">
            <label className="saas-form-label" htmlFor="eq-est-qty">
              {estimateMode === 'hourly' ? t('eqHoursLabel') : t('eqAcresLabel')}
            </label>
            <input
              id="eq-est-qty"
              type="number"
              min={0}
              step="0.5"
              className="saas-input"
              value={estimateQty}
              onChange={(e) => setEstimateQty(e.target.value)}
              required
            />
          </div>
          {estimate ? (
            <div className="saas-compliance-callout" style={{ marginBottom: '0.75rem' }}>
              {t('eqEstimatedTotal')}: <strong>₹{estimate.totalRupees.toLocaleString('en-IN')}</strong>
              {' · '}
              {estimate.unitLabel} × {estimate.quantity}
            </div>
          ) : null}
          <p className="trade-hint">{t('eqEstimateHint')}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="saas-btn-secondary" onClick={() => setEstimateOpen(false)} disabled={estimateBusy}>
              {t('commonCancel')}
            </button>
            <button type="submit" className="saas-btn-primary" disabled={estimateBusy}>
              {estimateBusy ? <span className="av-spinner" aria-hidden /> : t('eqGetEstimate')}
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
}
