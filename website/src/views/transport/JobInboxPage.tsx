import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { inr } from '../../lib/api/trade';
import {
  acceptBooking,
  myVehicles,
  rejectBooking,
  transportBookings,
  type OwnerVehicle,
  type TransportBooking,
} from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import { ensureProfile } from '../../stores/dashboard';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

type Sheet = 'accept' | 'decline' | null;

/**
 * Job inbox (transporter) — instant bookings waiting on the fleet: requested
 * bookings are actionable (accept with a verified vehicle / decline with a
 * reason); accepted and en-route jobs link through to the trip command center.
 */
export default function JobInboxPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('transport');

  const [bookings, setBookings] = useState<TransportBooking[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [current, setCurrent] = useState<TransportBooking | null>(null);
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    transportBookings()
      .then((res) => setBookings(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const requested = (bookings ?? []).filter((b) => b.status === 'requested');
  const active = (bookings ?? []).filter((b) => b.status === 'accepted' || b.status === 'enRoute');

  const closeSheet = () => {
    setSheet(null);
    setErrors({});
  };

  /** Role self-heal: FORBIDDEN_ROLE → activate transport persona, retry once. */
  const act = async (fn: () => Promise<unknown>, successKey: string, retried = false) => {
    if (!current) return;
    setBusy(true);
    try {
      await fn();
      toast(t(successKey));
      closeSheet();
      setCurrent(null);
      load();
    } catch (e) {
      if (isApiError(e) && e.code === 'FORBIDDEN_ROLE' && !retried) {
        const fixed = await ensureProfile('transport');
        if (fixed) {
          setBusy(false);
          await act(fn, successKey, true);
          return;
        }
      }
      if (isApiError(e) && e.fieldErrors) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const openAccept = (booking: TransportBooking) => {
    setErrors({});
    setCurrent(booking);
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
    if (!current) return;
    if (!vehicleId) {
      setErrors({ vehicle: t('commonRequired') });
      return;
    }
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    void act(
      () =>
        acceptBooking(current.id, {
          vehicleId,
          vehicleNo: vehicle?.registrationNo,
          driverName: vehicle?.driverName ?? undefined,
        }),
      'trJobAccepted'
    );
  };

  const openDecline = (booking: TransportBooking) => {
    setErrors({});
    setCurrent(booking);
    setReason('');
    setSheet('decline');
  };

  const submitDecline = () => {
    if (!current) return;
    if (reason.trim().length < 3) {
      setErrors({ reason: t('trDeclineReason') });
      return;
    }
    void act(() => rejectBooking(current.id, reason.trim()), 'trJobDeclined');
  };

  const vehicleLabel = (v: OwnerVehicle): string => `${v.registrationNo} · ${v.vehicleType}`;
  const verifiedVehicles = vehicles.filter((v) => v.docStatus === 'verified' && v.active);
  const selectedVehicle = verifiedVehicles.find((v) => v.id === vehicleId);

  return (
    <ToolShell toolId="bookingInbox">
      {bookings === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {bookings !== null ? (
        <>
          <p className="trade-section-title">{t('trJobInbox')}</p>
          {requested.length === 0 && active.length === 0 ? (
            <EmptyState icon="📥" titleKey="trEmptyJobs" />
          ) : null}

          <div className="trade-list">
            {requested.map((b) => (
              <div key={b.id} className="trade-card" style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-title">
                    {b.pickup} → {b.drop}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {b.noshowRisk !== undefined ? (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 500,
                          background:
                            b.noshowRisk > 0.4
                              ? 'rgba(239, 68, 68, 0.15)'
                              : b.noshowRisk > 0.15
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(16, 185, 129, 0.15)',
                          color: b.noshowRisk > 0.4 ? '#dc2626' : b.noshowRisk > 0.15 ? '#d97706' : '#059669',
                        }}
                      >
                        {b.noshowRisk > 0.4
                          ? t('trNoShowRiskHigh')
                          : b.noshowRisk > 0.15
                          ? t('trNoShowRiskMed')
                          : t('trNoShowRiskLow')}
                      </span>
                    ) : null}
                    <StatusPill status={b.status} />
                  </div>
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    {[fmtDate(b.date), b.commodity, b.vehicleType].filter(Boolean).join(' · ')}
                  </span>
                  <span className="trade-card-amount">{inr(b.fare)}</span>
                </div>
                <div className="trade-actions-row">
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    onClick={() => openAccept(b)}
                    disabled={busy}
                  >
                    {t('trAcceptJob')}
                  </button>
                  <button
                    type="button"
                    className="av-btn av-btn-plain"
                    style={{ background: 'var(--av-error)' }}
                    onClick={() => openDecline(b)}
                    disabled={busy}
                  >
                    {t('trDeclineJob')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {active.length ? (
            <>
              <p className="trade-section-title">{t('trRecentJobs')}</p>
              <div className="trade-list">
                {active.map((b) => (
                  <div
                    key={b.id}
                    className="trade-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/dashboard/p/transport/trips/${b.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(`/dashboard/p/transport/trips/${b.id}`);
                    }}
                  >
                    <div className="trade-card-row">
                      <span className="trade-card-title">
                        {b.pickup} → {b.drop}
                      </span>
                      <StatusPill status={b.status} />
                    </div>
                    <div className="trade-card-row">
                      <span className="trade-card-sub">{fmtDate(b.date)}</span>
                      <span className="trade-card-amount">{inr(b.fare)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      <ModalSheet open={sheet === 'accept'} onClose={closeSheet} title={t('trAcceptJob')}>
        {current && current.noshowRisk !== undefined ? (
          <div style={{ marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 500,
                background:
                  current.noshowRisk > 0.4
                    ? 'rgba(239, 68, 68, 0.15)'
                    : current.noshowRisk > 0.15
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(16, 185, 129, 0.15)',
                color: current.noshowRisk > 0.4 ? '#dc2626' : current.noshowRisk > 0.15 ? '#d97706' : '#059669',
              }}
            >
              {current.noshowRisk > 0.4
                ? t('trNoShowRiskHigh')
                : current.noshowRisk > 0.15
                ? t('trNoShowRiskMed')
                : t('trNoShowRiskLow')}
            </span>
          </div>
        ) : null}
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
                selected={
                  selectedVehicle ? [vehicleLabel(selectedVehicle)] : []
                }
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
    </ToolShell>
  );
}
