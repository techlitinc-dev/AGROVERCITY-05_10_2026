import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import {
  approveBooking,
  counterBookingQuote,
  fetchPendingBookings,
  rejectBooking,
  type EquipmentBooking,
} from '../../lib/api/equipmentOwner';
import { useT } from '../../lib/i18n';
import '../../theme/saas_personas.css';
import '../../theme/trade.css';

const STATUS_META: Record<string, { cls: string; key: string }> = {
  pending: { cls: 'saas-badge-warning', key: 'status_pending' },
  booked: { cls: 'saas-badge-success', key: 'eqStatusBooked' },
  in_progress: { cls: 'saas-badge-info', key: 'eqStatusInProgress' },
  completed: { cls: 'saas-badge-success', key: 'status_completed' },
  rejected: { cls: 'saas-badge-danger', key: 'status_rejected' },
  countered: { cls: 'saas-badge-info', key: 'status_countered' },
};

/**
 * Booking queue (equipment owner) — pending farmer hire requests with
 * approve / counter (revised rate + reason) / reject (reason modal) and a
 * dispatch deep-link into the field execution console.
 */
export default function BookingQueuePage() {
  const t = useT();
  useEnsureProfile('equipmentRental');

  const [bookings, setBookings] = useState<EquipmentBooking[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counterTarget, setCounterTarget] = useState<EquipmentBooking | null>(null);
  const [rejectTarget, setRejectTarget] = useState<EquipmentBooking | null>(null);
  const [counterRate, setCounterRate] = useState('');
  const [counterReason, setCounterReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    fetchPendingBookings()
      .then(setBookings)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const openCounter = (b: EquipmentBooking) => {
    setCounterTarget(b);
    setCounterRate(String(b.counterRateRupees ?? b.priceRupees ?? ''));
    setCounterReason(b.counterReason ?? '');
  };

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await approveBooking(id);
      toast(t('eqApproved'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  const handleCounter = async (e: FormEvent) => {
    e.preventDefault();
    if (!counterTarget) return;
    const ref = bookingRef(counterTarget);
    setBusyId(ref);
    try {
      await counterBookingQuote(ref, {
        revisedRateRupees: Number(counterRate),
        reason: counterReason,
      });
      setCounterTarget(null);
      toast(t('eqCounterSent'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    const ref = bookingRef(rejectTarget);
    setBusyId(ref);
    try {
      await rejectBooking(ref, rejectReason);
      setRejectTarget(null);
      setRejectReason('');
      toast(t('eqRejected'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  const slotLabel = (b: EquipmentBooking): string =>
    [b.date, b.slotName].filter(Boolean).join(' • ') || t('commonNotAvailable');

  /** Pending-inbox rows key the id as `bookingId`; older shapes used `id`. */
  const bookingRef = (b: EquipmentBooking): string => b.bookingId ?? b.id ?? '';

  const statusMeta = (b: EquipmentBooking): { cls: string; key: string } =>
    STATUS_META[b.status ?? ''] ?? { cls: 'saas-badge-warning', key: 'status_pending' };

  return (
    <>
      <div className="saas-container" style={{ padding: 0 }}>
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>{t('eqQueueTitle')}</span>
            <span className="saas-tab-badge">{bookings?.length ?? 0}</span>
          </div>
          <p className="trade-hint">{t('eqQueueFpoHint')}</p>

          {bookings === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

          {failed ? (
            <EmptyState
              icon="📡"
              titleKey="tradeLoadFailed"
              action={
                <button type="button" className="saas-btn-secondary" onClick={load}>
                  ↻ {t('retry')}
                </button>
              }
            />
          ) : null}

          {bookings !== null && bookings.length === 0 ? (
            <EmptyState icon="📥" titleKey="eqNoPending" />
          ) : null}

          {bookings !== null && bookings.length > 0 ? (
            <div className="saas-table-container">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>{t('eqFarmer')}</th>
                    <th>{t('eqEquipment')}</th>
                    <th>{t('eqRequestedSlot')}</th>
                    <th>{t('eqQuotePrice')}</th>
                    <th>{t('eqStatus')}</th>
                    <th>{t('eqActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const meta = statusMeta(b);
                    const ref = bookingRef(b);
                    const isFpo = (b.ownerType ?? 'private') === 'fpo';
                    return (
                      <tr key={ref}>
                        <td style={{ fontWeight: 600 }}>{b.farmerName ?? t('commonNotAvailable')}</td>
                        <td>{b.equipmentName ?? t('commonNotAvailable')}</td>
                        <td>{slotLabel(b)}</td>
                        <td style={{ fontWeight: 600 }}>
                          {b.counterRateRupees !== undefined
                            ? `₹${b.counterRateRupees} ${t('eqCounterSuffix')}`
                            : b.priceRupees !== undefined
                              ? `₹${b.priceRupees}`
                              : t('commonNotAvailable')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className={`saas-badge ${meta.cls}`}>{t(meta.key)}</span>
                            <span
                              className={`saas-badge ${isFpo ? 'saas-badge-info' : 'saas-badge-warning'}`}
                              title={t(isFpo ? 'eqPillFpoAuto' : 'eqPillPrivateManual')}
                            >
                              {isFpo ? t('eqPillFpoAuto') : t('eqPillPrivateManual')}
                            </span>
                            {b.recommendationScore !== undefined ? (
                              <span
                                className={`saas-badge ${
                                  b.recommendationScore >= 0.7
                                    ? 'saas-badge-success'
                                    : b.recommendationScore >= 0.5
                                      ? 'saas-badge-warning'
                                      : 'saas-badge-danger'
                                }`}
                                title={`${t('eqAiRec')}: ${Math.round(b.recommendationScore * 100)}%`}
                              >
                                🤖 {t('eqAiRec')}: {Math.round(b.recommendationScore * 100)}%
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="saas-btn-primary"
                              style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                              onClick={() => void handleApprove(ref)}
                              disabled={busyId === ref}
                            >
                              {t('eqApprove')}
                            </button>
                            <button
                              type="button"
                              className="saas-btn-secondary"
                              style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                              onClick={() => openCounter(b)}
                              disabled={busyId === ref}
                            >
                              {t('eqCounter')}
                            </button>
                            <Link
                              className="saas-btn-secondary"
                              style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', textDecoration: 'none' }}
                              to={`/dashboard/p/dispatch?booking=${ref}`}
                            >
                              {t('eqDispatch')}
                            </Link>
                            <button
                              type="button"
                              className="saas-btn-secondary"
                              style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', color: '#f87171' }}
                              onClick={() => {
                                setRejectTarget(b);
                                setRejectReason('');
                              }}
                              disabled={busyId === ref}
                            >
                              {t('eqReject')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <ModalSheet open={counterTarget !== null} onClose={() => setCounterTarget(null)} title={t('eqCounterTitle')}>
        {counterTarget ? (
          <form onSubmit={handleCounter}>
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '1rem' }}>
              {t('eqFarmer')}: <strong>{counterTarget.farmerName ?? t('commonNotAvailable')}</strong>
              {counterTarget.priceRupees !== undefined
                ? ` · ${t('eqOriginalQuote')}: ₹${counterTarget.priceRupees}`
                : null}
            </div>
            <div className="saas-form-group">
              <label className="saas-form-label" htmlFor="eq-counter-rate">
                {t('eqRevisedRate')}
              </label>
              <input
                id="eq-counter-rate"
                type="number"
                min={0}
                className="saas-input"
                value={counterRate}
                onChange={(e) => setCounterRate(e.target.value)}
                required
              />
            </div>
            <div className="saas-form-group">
              <label className="saas-form-label" htmlFor="eq-counter-reason">
                {t('eqCounterReason')}
              </label>
              <textarea
                id="eq-counter-reason"
                className="saas-textarea"
                rows={3}
                value={counterReason}
                onChange={(e) => setCounterReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="saas-btn-secondary"
                onClick={() => setCounterTarget(null)}
                disabled={busyId !== null}
              >
                {t('commonCancel')}
              </button>
              <button type="submit" className="saas-btn-primary" disabled={busyId !== null}>
                {busyId !== null ? <span className="av-spinner" aria-hidden /> : t('eqSendCounter')}
              </button>
            </div>
          </form>
        ) : null}
      </ModalSheet>

      <ModalSheet open={rejectTarget !== null} onClose={() => setRejectTarget(null)} title={t('eqRejectTitle')}>
        {rejectTarget ? (
          <form onSubmit={handleReject}>
            <div className="saas-form-group">
              <label className="saas-form-label" htmlFor="eq-reject-reason">
                {t('eqRejectReasonLabel')}
              </label>
              <textarea
                id="eq-reject-reason"
                className="saas-textarea"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="saas-btn-secondary"
                onClick={() => setRejectTarget(null)}
                disabled={busyId !== null}
              >
                {t('commonCancel')}
              </button>
              <button type="submit" className="saas-btn-primary" disabled={busyId !== null}>
                {busyId !== null ? <span className="av-spinner" aria-hidden /> : t('eqConfirmReject')}
              </button>
            </div>
          </form>
        ) : null}
      </ModalSheet>
    </>
  );
}
