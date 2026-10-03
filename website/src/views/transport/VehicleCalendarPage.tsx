import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChipSelect from '../../components/ChipSelect';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  myVehicles,
  setAvailability,
  vehicleCalendar,
  type OwnerVehicle,
  type VehicleCalendarItem,
} from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import { ensureProfile } from '../../stores/dashboard';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

const next30Days = (): string[] => {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(isoDay(d));
  }
  return days;
};

const dayLabel = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Fleet calendar (T1/T3) — per vehicle: the assigned trips for the coming
 * weeks plus the availability editor (tap the next 30 days the vehicle runs).
 */
export default function VehicleCalendarPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('transport');

  const [vehicles, setVehicles] = useState<OwnerVehicle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [calendar, setCalendar] = useState<VehicleCalendarItem[] | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const days = useMemo(next30Days, []);

  const load = useCallback(() => {
    setFailed(false);
    myVehicles()
      .then((list) => {
        setVehicles(list);
        setVehicleId((prev) => prev || list[0]?.id || '');
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  // Load the selected vehicle's assigned trips + availability.
  useEffect(() => {
    if (!vehicleId) return;
    setCalendar(null);
    vehicleCalendar(vehicleId)
      .then((res) => setCalendar(res.data))
      .catch(() => setCalendar([]));
    const selected = vehicles?.find((v) => v.id === vehicleId);
    setAvailable(selected?.availableDates ?? []);
  }, [vehicleId, vehicles]);

  /** Role self-heal: FORBIDDEN_ROLE → activate transport persona, retry once. */
  const saveAvailability = async (retried = false) => {
    if (!vehicleId) return;
    setBusy(true);
    try {
      await setAvailability(vehicleId, available);
      toast(t('trVehicleSaved'));
    } catch (e) {
      if (isApiError(e) && e.code === 'FORBIDDEN_ROLE' && !retried) {
        const fixed = await ensureProfile('transport');
        if (fixed) {
          setBusy(false);
          await saveAvailability(true);
          return;
        }
      }
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const selected = vehicles?.find((v) => v.id === vehicleId) ?? null;

  return (
    <ToolShell toolId="slotCalendarManage">
      {vehicles === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {vehicles !== null && vehicles.length === 0 ? (
        <EmptyState
          icon="🚚"
          titleKey="trEmptyFleet"
          bodyKey="trEmptyFleetBody"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => navigate('/dashboard/p/vehicleManage/new')}
            >
              ＋ {t('trAddVehicle')}
            </button>
          }
        />
      ) : null}

      {vehicles !== null && vehicles.length > 0 ? (
        <>
          <div className="av-field">
            <span className="av-label">{t('trVehicle')}</span>
            <ChipSelect
              options={vehicles.map((v) => `${v.registrationNo} · ${v.vehicleType}`)}
              selected={selected ? [`${selected.registrationNo} · ${selected.vehicleType}`] : []}
              onToggle={(label) => {
                const found = vehicles.find(
                  (v) => `${v.registrationNo} · ${v.vehicleType}` === label
                );
                if (found) setVehicleId(found.id);
              }}
              single
            />
          </div>

          <p className="trade-section-title">{t('trCalendar')}</p>
          {calendar === null ? <p className="trade-hint">{t('commonLoading')}</p> : null}
          {calendar !== null && calendar.length === 0 ? (
            <p className="trade-hint">{t('trEmptyJobs')}</p>
          ) : null}
          <div className="trade-list">
            {(calendar ?? []).map((item) => (
              <div
                key={`${item.bookingId}-${item.date}`}
                className="trade-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/dashboard/p/transport/trips/${item.bookingId}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/dashboard/p/transport/trips/${item.bookingId}`);
                }}
              >
                <div className="trade-card-row">
                  <span className="trade-card-title">
                    {item.pickup} → {item.drop}
                  </span>
                  <StatusPill status={item.status} />
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">{fmtDate(item.date)}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="trade-section-title">{t('trAvailability')}</p>
          <p className="trade-hint">{t('trAvailabilityHint')}</p>
          <div className="av-field">
            <ChipSelect
              options={days.map(dayLabel)}
              selected={days.filter((d) => available.includes(d)).map(dayLabel)}
              onToggle={(label) => {
                const iso = days.find((d) => dayLabel(d) === label);
                if (!iso) return;
                setAvailable((prev) =>
                  prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
                );
              }}
            />
          </div>
          <div className="trade-actions">
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => void saveAvailability()}
              disabled={busy}
            >
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
          </div>
        </>
      ) : null}
    </ToolShell>
  );
}
