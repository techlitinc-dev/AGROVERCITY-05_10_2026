import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../LabeledTextField';
import SegmentedControl from '../SegmentedControl';
import { SkeletonCard } from '../dashboard/tiles';
import { toast } from '../toast';
import { isApiError } from '../../lib/api/client';
import {
  createPriceAlert,
  deletePriceAlert,
  getIntelligence,
  listPriceAlerts,
  type IntelligenceResponse,
  type PriceAlert,
} from '../../lib/api/intelligence';
import { mandiPrices } from '../../lib/api/mandi';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import { useDashboardStore } from '../../stores/dashboard';
import '../../theme/intelligence.css';

/** Personas that manage bhav alerts (LOCKED backend scope). */
const ALERT_PERSONAS = ['farmer', 'seller', 'broker', 'directBuyer'];

type IntelState = 'loading' | 'ready' | 'unavailable' | 'error';

function isUnavailable(e: unknown): boolean {
  return (
    isApiError(e) && (e.status === 404 || e.code === 'INTELLIGENCE_NOT_AVAILABLE')
  );
}

function formatKpiValue(value: number | string): string {
  return typeof value === 'number' ? value.toLocaleString('en-IN') : value;
}

/**
 * Persona-agnostic renderer for the locked /v1/intelligence shape: KPI row,
 * CSS-only series bars, horizontal breakdowns, severity-coloured insight
 * cards, and (for trade personas) the bhav-alert manager. Every section
 * renders only when the server sent data — an all-empty payload renders
 * nothing. 404 INTELLIGENCE_NOT_AVAILABLE = persona not served → hidden.
 */
export default function InsightsPanel() {
  const t = useT();
  const persona = useDashboardStore((s) => s.activeProfile) ?? 'farmer';
  const alertsEligible = ALERT_PERSONAS.includes(persona);

  const [intel, setIntel] = useState<IntelligenceResponse | null>(null);
  const [intelState, setIntelState] = useState<IntelState>('loading');
  const [alerts, setAlerts] = useState<PriceAlert[] | null>(null);

  const load = useCallback(() => {
    setIntelState('loading');
    getIntelligence()
      .then((res) => {
        setIntel(res);
        setIntelState('ready');
      })
      .catch((e: unknown) => {
        if (isUnavailable(e)) {
          setIntel(null);
          setIntelState('unavailable');
        } else {
          setIntelState('error');
        }
      });
  }, []);

  // Re-fetch when the active persona switches (the backend reads activeProfile
  // server-side; the panel remounts per persona home but stays mounted when
  // the same home renders a different persona).
  useEffect(load, [load, persona]);

  useEffect(() => {
    if (!alertsEligible) {
      setAlerts(null);
      return;
    }
    let live = true;
    listPriceAlerts()
      .then((res) => live && setAlerts(res.data ?? []))
      .catch(() => live && setAlerts([]));
    return () => {
      live = false;
    };
  }, [alertsEligible]);

  const hasIntel =
    intel !== null &&
    (intel.kpis.length > 0 ||
      intel.series.length > 0 ||
      intel.breakdowns.length > 0 ||
      intel.insights.length > 0);

  const alertsVisible = alertsEligible && alerts !== null;
  const alertsLoading = alertsEligible && alerts === null;

  if (intelState === 'loading' || (alertsLoading && !hasIntel)) {
    return (
      <section className="dash-section intel-section">
        <SkeletonCard />
        <SkeletonCard />
      </section>
    );
  }

  if (!hasIntel && !alertsVisible) {
    // Nothing to show: unsupported persona or an all-empty payload with no
    // alerts. Never fabricate filler content.
    if (intelState === 'error') {
      return <IntelErrorLine onRetry={load} />;
    }
    return null;
  }

  return (
    <section className="dash-section intel-section">
      <p className="trade-section-title" style={{ marginTop: 0 }}>
        {t('intelTitle')}
      </p>

      {intelState === 'error' ? <IntelErrorLine onRetry={load} /> : null}

      {hasIntel && intel ? (
        <>
          {intel.kpis.length > 0 ? (
            <div className="intel-kpi-grid">
              {intel.kpis.map((kpi) => (
                <div key={kpi.key} className="intel-kpi">
                  <span className="intel-kpi-label">{t(kpi.labelKey)}</span>
                  <span className="intel-kpi-value-row">
                    <span className="intel-kpi-value">{formatKpiValue(kpi.value)}</span>
                    {kpi.unit ? <span className="intel-kpi-unit">{kpi.unit}</span> : null}
                  </span>
                  {kpi.deltaPct !== undefined ? (
                    <span className={`intel-delta ${kpi.direction ?? ''}`.trim()}>
                      {kpi.direction === 'down'
                        ? t('intelKpiDeltaDown', { pct: Math.abs(kpi.deltaPct) })
                        : t('intelKpiDeltaUp', { pct: Math.abs(kpi.deltaPct) })}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {intel.series.map((series) => {
            const max = Math.max(1, ...series.points.map((p) => p.value));
            return (
              <div key={series.key}>
                <p className="trade-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                  {t(series.labelKey)}
                </p>
                <div className="intel-chart" role="img" aria-label={t(series.labelKey)}>
                  {series.points.map((point) => (
                    <div key={point.label} className="intel-chart-col">
                      <div className="intel-chart-bar-wrap">
                        <div
                          className="intel-chart-bar"
                          style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
                          title={`${point.label}: ${point.value.toLocaleString('en-IN')}`}
                        />
                      </div>
                      <span className="intel-chart-label">{point.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {intel.breakdowns.map((breakdown) => {
            const max = Math.max(1, ...breakdown.items.map((i) => i.value));
            return (
              <div key={breakdown.key}>
                <p className="trade-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                  {t(breakdown.labelKey)}
                </p>
                <div className="intel-breakdown">
                  {breakdown.items.map((item) => (
                    <div key={item.label} className="intel-break-row">
                      <div className="intel-break-head">
                        <span className="intel-break-label">{item.label}</span>
                        <span className="intel-break-value">
                          {item.value.toLocaleString('en-IN')}
                          {item.unit ? ` ${item.unit}` : ''}
                        </span>
                      </div>
                      <div className="intel-break-track">
                        <div
                          className="intel-break-fill"
                          style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {intel.insights.length > 0 ? (
            <div className="intel-insights">
              {intel.insights.map((insight, i) => (
                <div key={`${insight.labelKey}-${i}`} className={`intel-insight ${insight.severity}`}>
                  {t(insight.labelKey, insight.params)}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {alertsVisible ? <PriceAlertsSection alerts={alerts} onChange={setAlerts} /> : null}
    </section>
  );
}

/** Collapsible load-error line with a retry action. */
function IntelErrorLine({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div className="intel-error">
      <details>
        <summary>{t('intelErrorTitle')}</summary>
        <div className="intel-error-body">
          <span className="trade-hint" style={{ marginTop: 0 }}>
            {t('tradeLoadFailed')}
          </span>
          <button type="button" className="av-btn av-btn-ghost" style={{ width: 'auto', height: 38, padding: '0 16px' }} onClick={onRetry}>
            ↻ {t('retry')}
          </button>
        </div>
      </details>
    </div>
  );
}

/** Bhav-alert manager — list + create + delete (farmer/seller/broker/directBuyer). */
function PriceAlertsSection({
  alerts,
  onChange,
}: {
  alerts: PriceAlert[];
  onChange: (alerts: PriceAlert[]) => void;
}) {
  const t = useT();
  const [crop, setCrop] = useState('');
  const [target, setTarget] = useState('');
  const [above, setAbove] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cropOptions, setCropOptions] = useState<string[]>([]);

  // Crop datalist from the live mandi price feed (DealFormPage pattern).
  useEffect(() => {
    mandiPrices({ page: 1, pageSize: 100 })
      .then((res) => {
        setCropOptions(Array.from(new Set(res.data.map((p) => p.commodity).filter(Boolean))));
      })
      .catch(() => setCropOptions([]));
  }, []);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!crop.trim()) next.crop = t('commonRequired');
    if (!(Number(target) > 0)) next.target = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0 || busy) return;
    setBusy(true);
    try {
      const created = await createPriceAlert({
        crop: crop.trim(),
        targetPrice: Number(target),
        above,
      });
      onChange([created, ...alerts]);
      setCrop('');
      setTarget('');
      toast(t('intelAlertCreated'));
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        setErrors(e.fieldErrors);
        toast(Object.values(e.fieldErrors).join(' · ') || t('intelAlertCreateFailed'), {
          error: true,
        });
      } else {
        toast(t('intelAlertCreateFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (alert: PriceAlert) => {
    try {
      await deletePriceAlert(alert.id);
      onChange(alerts.filter((a) => a.id !== alert.id));
      toast(t('intelAlertDeleted'));
    } catch {
      toast(t('actionFailed'), { error: true });
    }
  };

  return (
    <div>
      <p className="trade-section-title">{t('intelAlertsTitle')}</p>

      {alerts.length === 0 ? <p className="trade-hint">{t('intelAlertsEmpty')}</p> : null}

      {alerts.length > 0 ? (
        <div className="intel-alert-list">
          {alerts.map((alert) => (
            <div key={alert.id} className="intel-alert-row">
              <div className="intel-alert-main">
                <span className="intel-alert-crop">{alert.crop}</span>
                <span className="intel-alert-meta">
                  <span>
                    {alert.above ? '▲' : '▼'} {inr(alert.targetPrice)}
                    {t('perQuintal')}
                  </span>
                  <span>
                    {alert.currentModal !== null
                      ? t('intelAlertModalNow', { price: inr(alert.currentModal) })
                      : t('commonNotAvailable')}
                  </span>
                </span>
              </div>
              {alert.fired ? <span className="intel-alert-fired">{t('intelAlertFired')}</span> : null}
              <button
                type="button"
                className="intel-alert-remove"
                aria-label={`${t('intelAlertDeleted')} — ${alert.crop}`}
                onClick={() => void remove(alert)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="intel-alert-form">
        <div className="av-field">
          <label className="av-label" htmlFor="intel-alert-crop">
            {t('intelAlertCrop')} *
          </label>
          <input
            id="intel-alert-crop"
            className={`av-input${errors.crop ? ' invalid' : ''}`}
            list="intel-crop-options"
            value={crop}
            onChange={(e) => {
              setCrop(e.target.value);
              setErrors((prev) => {
                const nextErr = { ...prev };
                delete nextErr.crop;
                return nextErr;
              });
            }}
            placeholder={t('lotsCropPlaceholder')}
          />
          <datalist id="intel-crop-options">
            {cropOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {errors.crop ? <p className="av-field-error">{errors.crop}</p> : null}
        </div>

        <LabeledTextField
          label={t('intelAlertTarget')}
          value={target}
          onChange={(v) => {
            setTarget(v);
            setErrors((prev) => {
              const nextErr = { ...prev };
              delete nextErr.target;
              return nextErr;
            });
          }}
          type="number"
          inputMode="decimal"
          prefix="₹"
          error={errors.target}
          required
        />

        <div className="av-field">
          <span className="av-label">{t('intelAlertDirection')}</span>
          <SegmentedControl
            options={[
              { value: 'above', label: t('intelAlertAbove') },
              { value: 'below', label: t('intelAlertBelow') },
            ]}
            value={above ? 'above' : 'below'}
            onChange={(v) => setAbove(v === 'above')}
          />
        </div>

        <button
          type="button"
          className="av-btn av-btn-primary intel-alert-submit"
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? <span className="av-spinner" aria-hidden /> : `＋ ${t('intelAlertCreate')}`}
        </button>
      </div>
    </div>
  );
}
