import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { fetchMyEquipment, fetchOwnerAnalytics, type EquipmentOwnerAnalytics } from '../../lib/api/equipmentOwner';
import { TOOL_BY_ID } from '../../lib/dashboard';
import { useT } from '../../lib/i18n';
import '../../theme/saas_personas.css';
import '../../theme/trade.css';

const MODULE_TOOLS = ['machineManage', 'bookingQueue', 'dispatch', 'damageClaims', 'maintenance', 'roiAnalytics'];

/**
 * Equipment owner home (toolId equipmentOwnerHome) — hero metrics grid fed by
 * the owner analytics API plus quick links into every owner module. The
 * original EquipmentOwnerHomeBoard monolith is being retired; this is its
 * slim replacement.
 */
export default function OwnerOverviewPage() {
  const t = useT();
  useEnsureProfile('equipmentRental');

  const [analytics, setAnalytics] = useState<EquipmentOwnerAnalytics | null>(null);
  const [fleetSize, setFleetSize] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([
      fetchOwnerAnalytics().then(setAnalytics),
      fetchMyEquipment().then((fleet) => setFleetSize(fleet.length)),
    ]).catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <div className="saas-container" style={{ padding: 0 }}>
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

        {!failed ? (
          <div className="saas-hero-card">
            <div className="saas-hero-header">
              <div className="saas-hero-title-group">
                <div className="saas-hero-icon">🚜</div>
                <div>
                  <h1 className="saas-hero-title">{t('eqHeroTitle')}</h1>
                  <div className="saas-hero-subtitle">{t('eqHeroSubtitle')}</div>
                </div>
              </div>
            </div>

            <div className="saas-metrics-grid">
              <div className="saas-metric-card">
                <span className="saas-metric-label">{t('eqMetricFleetSize')}</span>
                <span className="saas-metric-value">
                  {analytics !== null ? analytics.fleetSize : (fleetSize ?? '…')} {t('eqUnits')}
                </span>
                <span className="saas-metric-sub">
                  {analytics ? t('eqFleetAvailable', { count: analytics.activeFleet }) : t('commonLoading')}
                </span>
              </div>
              <div className="saas-metric-card">
                <span className="saas-metric-label">{t('eqMetricUtilization')}</span>
                <span className="saas-metric-value">
                  {analytics ? `${analytics.utilizationRatePercent}%` : '…'}
                </span>
                <span className="saas-metric-sub">
                  {analytics ? t('eqJobsCompleted', { count: analytics.totalCompletedJobs }) : t('commonLoading')}
                </span>
              </div>
              <div className="saas-metric-card">
                <span className="saas-metric-label">{t('eqMetricRevenue')}</span>
                <span className="saas-metric-value">
                  {analytics ? `₹${analytics.totalRevenueRupees.toLocaleString('en-IN')}` : '…'}
                </span>
                <span className="saas-metric-sub">
                  {analytics ? t('eqHoursLoggedValue', { count: analytics.totalHoursLogged }) : t('commonLoading')}
                </span>
              </div>
              <div className="saas-metric-card">
                <span className="saas-metric-label">{t('eqMetricQueue')}</span>
                <span className="saas-metric-value">
                  {analytics ? analytics.pendingRequestsCount : '…'}
                </span>
                <span className="saas-metric-sub">
                  {analytics ? t('eqRepeatHirePercent', { percent: analytics.repeatHireRatePercent }) : t('commonLoading')}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="saas-compliance-callout">🔒 {t('eqComplianceNote')}</div>

        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>{t('eqQuickLinksTitle')}</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {MODULE_TOOLS.map((toolId) => {
              const tool = TOOL_BY_ID[toolId];
              if (!tool) return null;
              return (
                <Link
                  key={toolId}
                  to={`/dashboard/p/${toolId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.875rem 1rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.75rem',
                    textDecoration: 'none',
                    color: '#f8fafc',
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{tool.icon}</span>
                  <span>
                    <span style={{ display: 'block', fontWeight: 600 }}>{t(`tool_${toolId}`)}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {t(`tool_${toolId}_sub`)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
