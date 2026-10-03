import { useCallback, useEffect, useState } from 'react';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { inr } from '../../lib/api/trade';
import {
  transporterProfile,
  updateTransporterProfile,
  type TransporterProfile,
} from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import { ensureProfile } from '../../stores/dashboard';
import '../../theme/trade.css';

const TRANSPORTER_TYPES: Array<{ value: string; labelKey: string }> = [
  { value: 'owner_driver', labelKey: 'trOwnerDriver' },
  { value: 'fleet_owner', labelKey: 'trFleetOwner' },
  { value: 'logistics_partner', labelKey: 'trLogisticsCompany' },
];

/**
 * Transporter business profile (T3) — business name, transporter type,
 * operating routes, fleet size and experience, plus the backend performance
 * stats (trips, earnings, rating, on-time rate, verification badge).
 */
export default function TransporterProfilePage() {
  const t = useT();
  useEnsureProfile('transport');

  const [profile, setProfile] = useState<TransporterProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [transporterType, setTransporterType] = useState('owner_driver');
  const [routes, setRoutes] = useState('');
  const [fleetSize, setFleetSize] = useState('');
  const [experienceYears, setExperienceYears] = useState('');

  const hydrate = (p: TransporterProfile) => {
    setBusinessName(p.businessName ?? '');
    setTransporterType(p.transporterType ?? 'owner_driver');
    setRoutes((p.operatingRoutes ?? []).join(', '));
    setFleetSize(p.fleetSize != null ? String(p.fleetSize) : '');
    setExperienceYears(p.experienceYears != null ? String(p.experienceYears) : '');
  };

  const load = useCallback(() => {
    setFailed(false);
    transporterProfile()
      .then((p) => {
        setProfile(p);
        hydrate(p);
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(load, [load]);

  /** Role self-heal: FORBIDDEN_ROLE → activate transport persona, retry once. */
  const submit = async (retried = false) => {
    setBusy(true);
    const payload: Partial<TransporterProfile> = {
      businessName: businessName.trim() || undefined,
      transporterType,
      operatingRoutes: routes
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
      fleetSize: fleetSize ? Number(fleetSize) : undefined,
      experienceYears: experienceYears ? Number(experienceYears) : undefined,
    };
    try {
      const updated = await updateTransporterProfile(payload);
      setProfile(updated);
      hydrate(updated);
      toast(t('trProfileSaved'));
    } catch (e) {
      if (isApiError(e) && e.code === 'FORBIDDEN_ROLE' && !retried) {
        const fixed = await ensureProfile('transport');
        if (fixed) {
          setBusy(false);
          await submit(true);
          return;
        }
      }
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const stats = profile?.stats;
  const typeLabel = (value: string): string => {
    const found = TRANSPORTER_TYPES.find((x) => x.value === value);
    return found ? t(found.labelKey) : value;
  };

  return (
    <ToolShell toolId="transporterProfile">
      {profile === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {stats ? (
        <>
          <p className="trade-section-title">{t('trAnalyticsTitle')}</p>
          <div className="trade-stats-grid">
            <div className="trade-stat">
              <div className="trade-stat-label">{t('trHomeVehicles')}</div>
              <div className="trade-stat-value">{stats.totalVehicles ?? 0}</div>
            </div>
            <div className="trade-stat">
              <div className="trade-stat-label">{t('trHomeTrips')}</div>
              <div className="trade-stat-value">{stats.totalTrips ?? 0}</div>
            </div>
            <div className="trade-stat">
              <div className="trade-stat-label">{t('trHomeEarnings')}</div>
              <div className="trade-stat-value">{inr(stats.lifetimeEarnings ?? 0)}</div>
            </div>
            <div className="trade-stat">
              <div className="trade-stat-label">{t('trHomeRating')}</div>
              <div className="trade-stat-value">{stats.rating != null ? `★ ${stats.rating}` : '—'}</div>
            </div>
            <div className="trade-stat">
              <div className="trade-stat-label">{t('trOnTimeRate')}</div>
              <div className="trade-stat-value">
                {stats.onTimeRate != null ? `${stats.onTimeRate}%` : '—'}
              </div>
            </div>
            <div className="trade-stat">
              <div className="trade-stat-label">{t('trVehicleVerified')}</div>
              <div className="trade-stat-value">
                {stats.verified ? <StatusPill status="verified" /> : <StatusPill status="pending" />}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {profile !== null ? (
        <>
          <p className="trade-section-title">{t('trProfileTitle')}</p>
          <LabeledTextField
            label={t('trBusinessName')}
            value={businessName}
            onChange={setBusinessName}
          />
          <div className="av-field">
            <span className="av-label">{t('trTransporterType')}</span>
            <ChipSelect
              options={TRANSPORTER_TYPES.map((x) => t(x.labelKey))}
              selected={[typeLabel(transporterType)]}
              onToggle={(label) => {
                const found = TRANSPORTER_TYPES.find((x) => t(x.labelKey) === label);
                if (found) setTransporterType(found.value);
              }}
              single
            />
          </div>
          <LabeledTextField
            label={t('trOperatingRoutes')}
            value={routes}
            onChange={setRoutes}
          />
          <LabeledTextField
            label={t('trFleetSize')}
            value={fleetSize}
            onChange={setFleetSize}
            type="number"
            inputMode="numeric"
          />
          <LabeledTextField
            label={t('trExperienceYears')}
            value={experienceYears}
            onChange={setExperienceYears}
            type="number"
            inputMode="numeric"
          />
          <div className="trade-actions">
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => void submit()}
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
