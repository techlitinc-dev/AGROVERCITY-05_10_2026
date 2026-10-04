import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { fetchOwnerAnalytics, type EquipmentOwnerAnalytics } from '../../lib/api/equipmentOwner';
import { useT } from '../../lib/i18n';
import '../../theme/saas_personas.css';
import '../../theme/trade.css';

/**
 * Fleet ROI analytics (equipment owner) — hero metrics grid, daily utilization
 * trend bars, and the revenue breakdown by equipment category, all fed by
 * /equipment/owner/analytics (moved out of the EquipmentOwnerHomeBoard
 * monolith; no demo fallbacks).
 */
export default function RoiAnalyticsPage() {
  const t = useT();
  useEnsureProfile('equipmentRental');

  const [analytics, setAnalytics] = useState<EquipmentOwnerAnalytics | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchOwnerAnalytics()
      .then(setAnalytics)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const trend = analytics?.utilizationTrend ?? [];
  const maxHours = Math.max(1, ...trend.map((u) => u.hours));
  const categories = analytics?.categoryBreakdown ?? [];
  const maxCategoryRevenue = Math.max(1, ...categories.map((c) => c.revenue));

  return (
    <>
      <div className="saas-container" style={{ padding: 0 }}>
        {analytics === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

        {analytics !== null ? (
          <>
            <div className="saas-metrics-grid">
              <div className="saas-metric-card">
                <span className="saas-metric-label">{t('eqMetricFleetSize')}</span>
                <span className="saas-metric-value">
                  {analytics.fleetSize} {t('eqUnits')}
                </span>
                <span className="saas-metric-sub">
                  {t('eqFleetAvailable', { count: analytics.activeFleet })}
                </span>
              </div>
              <div className="saas-metric-card">
                <span className="saas-metric-label">{t('eqMetricUtilization')}</span>
                <span className="saas-metric-value">{analytics.utilizationRatePercent}%</span>
                <span className="saas-metric-sub">
                  {t('eqJobsCompleted', { count: analytics.totalCompletedJobs })}
                </span>
              </div>
              <div className="saas-metric-card">
                <span className="saas-metric-label">{t('eqMetricRevenue')}</span>
                <span className="saas-metric-value">
                  ₹{analytics.totalRevenueRupees.toLocaleString('en-IN')}
                </span>
                <span className="saas-metric-sub">
                  {t('eqHoursLoggedValue', { count: analytics.totalHoursLogged })}
                </span>
              </div>
              <div className="saas-metric-card">
                <span className="saas-metric-label">{t('eqMetricQueue')}</span>
                <span className="saas-metric-value">{analytics.pendingRequestsCount}</span>
                <span className="saas-metric-sub">
                  {t('eqRepeatHirePercent', { percent: analytics.repeatHireRatePercent })}
                </span>
              </div>
            </div>

            <div className="saas-panel">
              <div className="saas-panel-title">
                <span>{t('eqAnalyticsTitle')}</span>
              </div>

              {trend.length === 0 && categories.length === 0 ? (
                <EmptyState icon="📊" titleKey="eqNoAnalytics" />
              ) : null}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                }}
              >
                {trend.length > 0 ? (
                  <div
                    style={{
                      background: '#0f172a',
                      padding: '1.25rem',
                      borderRadius: '0.75rem',
                      border: '1px solid #334155',
                    }}
                  >
                    <h4 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>{t('eqDailyHoursRevenue')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {trend.map((u) => (
                        <div key={u.day}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.8125rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            <span>{u.day}</span>
                            <span style={{ color: '#10b981', fontWeight: 600 }}>
                              {t('eqTrendHours', { hours: u.hours })} • ₹{u.revenue.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div style={{ height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${(u.hours / maxHours) * 100}%`,
                                background: '#f59e0b',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {categories.length > 0 ? (
                  <div
                    style={{
                      background: '#0f172a',
                      padding: '1.25rem',
                      borderRadius: '0.75rem',
                      border: '1px solid #334155',
                    }}
                  >
                    <h4 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>{t('eqRevenueBreakdown')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {categories.map((c) => (
                        <div
                          key={c.category}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.5rem',
                            background: '#1e293b',
                            borderRadius: '0.375rem',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <span>{c.category}</span>
                          <span style={{ fontWeight: 600, color: '#10b981' }}>
                            ₹{c.revenue.toLocaleString('en-IN')}
                          </span>
                          <span
                            style={{
                              height: '8px',
                              width: '72px',
                              background: '#0f172a',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                display: 'block',
                                height: '100%',
                                width: `${(c.revenue / maxCategoryRevenue) * 100}%`,
                                background: '#10b981',
                              }}
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
