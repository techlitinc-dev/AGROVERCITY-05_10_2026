import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import {
  fetchCheckInPins,
  fetchJobExecution,
  fetchPendingBookings,
  postCheckInPin,
  updateJobExecution,
  type CheckInPin,
  type EquipmentBooking,
  type JobExecution,
} from '../../lib/api/equipmentOwner';
import { useT } from '../../lib/i18n';
import '../../theme/saas_personas.css';
import '../../theme/trade.css';

const JOB_STATUSES = ['en_route', 'on_site', 'work_started', 'work_completed', 'verified'] as const;

const BOOKING_STATUS_META: Record<string, { cls: string; key: string }> = {
  pending: { cls: 'saas-badge-warning', key: 'status_pending' },
  booked: { cls: 'saas-badge-success', key: 'eqStatusBooked' },
  in_progress: { cls: 'saas-badge-info', key: 'eqStatusInProgress' },
  completed: { cls: 'saas-badge-success', key: 'status_completed' },
  rejected: { cls: 'saas-badge-danger', key: 'status_rejected' },
  countered: { cls: 'saas-badge-info', key: 'status_countered' },
};

const STATUS_KEY: Record<string, string> = {
  assigned: 'eqStatusAssigned',
  en_route: 'eqMarkEnRoute',
  on_site: 'eqMarkOnSite',
  work_started: 'eqStartWork',
  work_completed: 'eqMarkWorkCompleted',
  verified: 'eqVerifySignOff',
};

const CHECKLIST_ITEMS: Array<{ field: keyof JobExecution['checklist']; key: string }> = [
  { field: 'operatorDispatched', key: 'eqChecklistOperator' },
  { field: 'preWorkConditionChecked', key: 'eqChecklistPreWork' },
  { field: 'mobilizationPhotos', key: 'eqChecklistMobilization' },
  { field: 'workCompletedProof', key: 'eqChecklistWorkProof' },
  { field: 'farmerSignOff', key: 'eqChecklistSignOff' },
];

/**
 * Dispatch console (equipment owner) — select a booking, then drive the field
 * execution: status progression (en_route → on_site → work_started →
 * work_completed → verified) via updateJobExecution, with the mobilization
 * checklist and status timeline.
 */
export default function DispatchPage() {
  const t = useT();
  useEnsureProfile('equipmentRental');
  const [searchParams] = useSearchParams();

  const [bookings, setBookings] = useState<EquipmentBooking[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [execution, setExecution] = useState<JobExecution | null>(null);
  const [busy, setBusy] = useState(false);
  const [pins, setPins] = useState<CheckInPin[]>([]);
  const [pinLat, setPinLat] = useState('');
  const [pinLng, setPinLng] = useState('');
  const [pinLabel, setPinLabel] = useState('');
  const [pinEvent, setPinEvent] = useState<'dispatch' | 'return'>('dispatch');
  const [pinBusy, setPinBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchPendingBookings()
      .then(setBookings)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const openExecution = useCallback(
    (bookingId: string) => {
      fetchJobExecution(bookingId)
        .then(async (exec) => {
          setExecution(exec);
          const existing = await fetchCheckInPins(bookingId).catch(() => [] as CheckInPin[]);
          setPins(existing);
          // Prefill the manual pin form with the most recent pin's coords.
          const last = existing[existing.length - 1];
          setPinLat(last ? String(last.lat) : '');
          setPinLng(last ? String(last.lng) : '');
          setPinLabel('');
          setPinEvent('dispatch');
        })
        .catch(() => toast(t('tradeLoadFailed'), { error: true }));
    },
    [t],
  );

  // Deep-link from the booking queue: /dashboard/p/dispatch?booking=<id>
  const initialBookingId = searchParams.get('booking');
  useEffect(() => {
    if (initialBookingId) openExecution(initialBookingId);
  }, [initialBookingId, openExecution]);

  const handleUpdateStatus = async (status: string) => {
    if (!execution) return;
    setBusy(true);
    try {
      const updated = await updateJobExecution(execution.bookingId, {
        jobStatus: status,
        notes: t('eqStatusUpdated'),
      });
      setExecution(updated);
      toast(t('eqStatusUpdated'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleCheckIn = async () => {
    if (!execution) return;
    setPinBusy(true);
    try {
      await postCheckInPin(execution.bookingId, {
        lat: Number(pinLat),
        lng: Number(pinLng),
        label: pinLabel,
        event: pinEvent,
      });
      const existing = await fetchCheckInPins(execution.bookingId).catch(() => [] as CheckInPin[]);
      setPins(existing);
      setPinLabel('');
      toast(t('eqPinSaved'));
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setPinBusy(false);
    }
  };

  const statusLabel = (status: string): string =>
    STATUS_KEY[status] ? t(STATUS_KEY[status]) : status;

  return (
    <>
      <div className="saas-container" style={{ padding: 0 }}>
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>{t('eqDispatchTitle')}</span>
          </div>

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

          {bookings !== null && bookings.length === 0 && !execution ? (
            <EmptyState icon="📋" titleKey="eqNoDispatchBookings" />
          ) : null}

          {bookings !== null && bookings.length > 0 ? (
            <div className="saas-table-container">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>{t('eqFarmer')}</th>
                    <th>{t('eqEquipment')}</th>
                    <th>{t('eqRequestedSlot')}</th>
                    <th>{t('eqStatus')}</th>
                    <th>{t('eqActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const meta = BOOKING_STATUS_META[b.status ?? ''] ?? { cls: 'saas-badge-warning', key: '' };
                    const ref = b.bookingId ?? b.id ?? '';
                    return (
                      <tr key={ref}>
                        <td style={{ fontWeight: 600 }}>{b.farmerName ?? t('commonNotAvailable')}</td>
                        <td>{b.equipmentName ?? t('commonNotAvailable')}</td>
                        <td>{[b.date, b.slotName].filter(Boolean).join(' • ') || t('commonNotAvailable')}</td>
                        <td>
                          <span className={`saas-badge ${meta.cls}`}>
                            {meta.key ? t(meta.key) : b.status}
                          </span>
                        </td>
                      <td>
                        <button
                          type="button"
                          className="saas-btn-secondary"
                          style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                          onClick={() => openExecution(ref)}
                        >
                          {t('eqDispatch')}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {execution ? (
            <div
              style={{
                background: '#0f172a',
                padding: '1.25rem',
                borderRadius: '0.75rem',
                border: '1px solid #334155',
                marginTop: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#f8fafc' }}>
                    {t('eqJob')}: {execution.bookingId.slice(0, 10)}
                  </h3>
                  <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                    {t('eqEquipment')}: {execution.equipmentId}
                  </div>
                </div>
                <span className="saas-badge saas-badge-info" style={{ fontSize: '0.875rem' }}>
                  {t('eqStatus')}: {statusLabel(execution.jobStatus)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0' }}>
                {JOB_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={status === execution.jobStatus ? 'saas-btn-primary' : 'saas-btn-secondary'}
                    onClick={() => void handleUpdateStatus(status)}
                    disabled={busy}
                  >
                    {statusLabel(status)}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.75rem',
                  marginTop: '1rem',
                }}
              >
                {CHECKLIST_ITEMS.map((item) => (
                  <div key={item.field} style={{ padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t(item.key)}</div>
                    <div style={{ fontWeight: 600, color: execution.checklist[item.field] ? '#34d399' : '#fbbf24' }}>
                      {execution.checklist[item.field] ? `✓ ${t('commonYes')}` : `… ${t('commonNo')}`}
                    </div>
                  </div>
                ))}
                <div style={{ padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('eqHoursLogged')}</div>
                  <div style={{ fontWeight: 600, color: '#38bdf8' }}>{execution.hoursLogged}</div>
                </div>
                <div style={{ padding: '0.75rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('eqAcresCovered')}</div>
                  <div style={{ fontWeight: 600, color: '#38bdf8' }}>{execution.acresCovered}</div>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#f8fafc' }}>{t('eqTimelineTitle')}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {execution.statusTimeline.map((entry, idx) => (
                    <div
                      key={`${entry.timestamp}-${idx}`}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#1e293b', borderRadius: '0.375rem', fontSize: '0.8125rem' }}
                    >
                      <span style={{ fontWeight: 600 }}>{statusLabel(entry.status)}</span>
                      <span style={{ color: '#94a3b8' }}>{new Date(entry.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#f8fafc' }}>{t('eqPinsTitle')}</h4>
                {pins.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: '#94a3b8', padding: '0.5rem 0' }}>
                    {t('eqNoPins')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {pins.map((pin, idx) => (
                      <div
                        key={`${pin.at}-${idx}`}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: '#1e293b', borderRadius: '0.375rem', fontSize: '0.8125rem', flexWrap: 'wrap' }}
                      >
                        <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span className={`saas-badge ${pin.event === 'return' ? 'saas-badge-success' : 'saas-badge-info'}`}>
                            {pin.event === 'return' ? t('eqPinReturn') : t('eqPinDispatch')}
                          </span>
                          <span style={{ fontWeight: 600 }}>{pin.label || pin.event}</span>
                        </span>
                        <span style={{ color: '#94a3b8' }}>
                          {t('eqPinCoords', { lat: pin.lat, lng: pin.lng })}
                          {' · '}
                          {new Date(pin.at).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '0.5rem',
                    alignItems: 'end',
                  }}
                >
                  <div className="saas-form-group" style={{ margin: 0 }}>
                    <label className="saas-form-label" htmlFor="eq-pin-event">
                      {t('eqPinEvent')}
                    </label>
                    <select
                      id="eq-pin-event"
                      className="saas-select"
                      value={pinEvent}
                      onChange={(e) => setPinEvent(e.target.value as 'dispatch' | 'return')}
                    >
                      <option value="dispatch">{t('eqPinDispatch')}</option>
                      <option value="return">{t('eqPinReturn')}</option>
                    </select>
                  </div>
                  <div className="saas-form-group" style={{ margin: 0 }}>
                    <label className="saas-form-label" htmlFor="eq-pin-lat">
                      {t('eqLatLabel')}
                    </label>
                    <input
                      id="eq-pin-lat"
                      type="number"
                      step="any"
                      className="saas-input"
                      value={pinLat}
                      onChange={(e) => setPinLat(e.target.value)}
                      required
                    />
                  </div>
                  <div className="saas-form-group" style={{ margin: 0 }}>
                    <label className="saas-form-label" htmlFor="eq-pin-lng">
                      {t('eqLngLabel')}
                    </label>
                    <input
                      id="eq-pin-lng"
                      type="number"
                      step="any"
                      className="saas-input"
                      value={pinLng}
                      onChange={(e) => setPinLng(e.target.value)}
                      required
                    />
                  </div>
                  <div className="saas-form-group" style={{ margin: 0 }}>
                    <label className="saas-form-label" htmlFor="eq-pin-label">
                      {t('eqPinLabelOptional')}
                    </label>
                    <input
                      id="eq-pin-label"
                      type="text"
                      className="saas-input"
                      value={pinLabel}
                      onChange={(e) => setPinLabel(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="saas-btn-primary"
                    style={{ fontSize: '0.8125rem' }}
                    onClick={() => void handleCheckIn()}
                    disabled={pinBusy || pinLat === '' || pinLng === ''}
                  >
                    {pinBusy ? <span className="av-spinner" aria-hidden /> : t('eqCheckIn')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              {t('eqSelectBookingHint')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
