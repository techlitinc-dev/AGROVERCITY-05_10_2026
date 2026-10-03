import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChipSelect from '../../components/ChipSelect';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { deleteVehicle, myVehicles, setAvailability, type OwnerVehicle } from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Next 30 days as YYYY-MM-DD for the availability picker. */
const next30Days = (): string[] =>
  Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return fmtDay(d);
  });

/**
 * My fleet (transporter, plan §5.2-B1) — vehicle cards with doc status,
 * driver and permit info, a 30-day availability picker per vehicle, and
 * add / edit / remove entry points.
 */
export default function FleetPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('transport');

  const [vehicles, setVehicles] = useState<OwnerVehicle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState<OwnerVehicle | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Pending availability edits, keyed by vehicle id; null = nothing dirty.
  const [availabilityDrafts, setAvailabilityDrafts] = useState<Record<string, string[] | undefined>>({});

  const days = next30Days();

  const load = useCallback(() => {
    setFailed(false);
    myVehicles()
      .then(setVehicles)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await deleteVehicle(deleting.id);
      toast(t('trVehicleDeleted'));
      setDeleting(null);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  const toggleDate = (vehicle: OwnerVehicle, date: string) => {
    const current = availabilityDrafts[vehicle.id] ?? vehicle.availableDates ?? [];
    const nextDates = current.includes(date) ? current.filter((d) => d !== date) : [...current, date];
    setAvailabilityDrafts((prev) => ({ ...prev, [vehicle.id]: nextDates }));
  };

  const saveAvailability = async (vehicle: OwnerVehicle) => {
    const dates = availabilityDrafts[vehicle.id];
    if (!dates) return;
    setBusyId(vehicle.id);
    try {
      const updated = await setAvailability(vehicle.id, dates);
      setVehicles((prev) => (prev ?? []).map((v) => (v.id === vehicle.id ? updated : v)));
      setAvailabilityDrafts((prev) => ({ ...prev, [vehicle.id]: undefined }));
      toast(t('trVehicleSaved'));
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  const availabilityLabel = (date: string): string =>
    new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <ToolShell toolId="vehicleManage">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => navigate('/dashboard/p/vehicleManage/new')}
        >
          ＋ {t('trAddVehicle')}
        </button>
      </div>

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

      <div className="trade-list">
        {vehicles?.map((v) => {
          const dirty = availabilityDrafts[v.id] !== undefined;
          return (
            <div key={v.id} className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{v.vehicleType}</span>
                <StatusPill status={v.docStatus} />
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {v.registrationNo}
                  {v.capacityTonnes ? ` · ${t('trVehicleCapacity', { tonnes: v.capacityTonnes })}` : ''}
                </span>
              </div>
              {v.driverName ? (
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    {t('trDriverName')}: {v.driverName}
                  </span>
                </div>
              ) : null}
              {v.permitType ? (
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    {t('trPermitType')}: {v.permitType}
                  </span>
                </div>
              ) : null}

              <p className="trade-section-title" style={{ marginTop: 8 }}>
                {t('trAvailability')}
              </p>
              <p className="trade-hint">{t('trAvailabilityHint')}</p>
              <ChipSelect
                options={days.map(availabilityLabel)}
                selected={(availabilityDrafts[v.id] ?? v.availableDates ?? []).map(availabilityLabel)}
                onToggle={(label) => {
                  const idx = days.map(availabilityLabel).indexOf(label);
                  if (idx >= 0) toggleDate(v, days[idx]);
                }}
              />
              {dirty ? (
                <div className="trade-actions-row">
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    onClick={() => void saveAvailability(v)}
                    disabled={busyId === v.id}
                  >
                    {busyId === v.id ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
                  </button>
                </div>
              ) : null}

              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => navigate(`/dashboard/p/vehicleManage/${v.id}/edit`)}
                  disabled={busyId === v.id}
                >
                  {t('commonEdit')}
                </button>
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  style={{ background: 'var(--av-error)' }}
                  onClick={() => setDeleting(v)}
                  disabled={busyId === v.id}
                >
                  {t('commonDelete')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmSheet
        open={deleting !== null}
        title={deleting ? `${deleting.vehicleType} · ${deleting.registrationNo}` : ''}
        confirmLabel={t('commonDelete')}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
        busy={busyId === deleting?.id}
      />
    </ToolShell>
  );
}
