import { useCallback, useEffect, useState } from 'react';
import {
  fetchMyEquipment,
  fetchOwnerAnalytics,
  type EquipmentItem,
  type EquipmentOwnerAnalytics,
} from '../../lib/api/equipmentOwner';
import { useT } from '../../lib/i18n';
import '../../theme/saas_personas.css';

/**
 * Legacy EquipmentOwnerHomeBoard — the fleet/queue/dispatch/claims/analytics
 * sections moved to their own routed views (phase-02 WS-04, tasks 4.2–4.8):
 * FleetPage, BookingQueuePage, DispatchPage, DamageClaimsPage,
 * MaintenancePage, RoiAnalyticsPage and OwnerOverviewPage. This board is
 * kept only as a slim metrics shell until the file can be deleted; it renders
 * no dialogs (toast/modal only) and no demo fallbacks.
 */
export default function EquipmentOwnerHomeBoard({ embedded }: { embedded?: boolean }) {
  const t = useT();
  const [analytics, setAnalytics] = useState<EquipmentOwnerAnalytics | null>(null);
  const [fleet, setFleet] = useState<EquipmentItem[]>([]);

  const loadData = useCallback(async () => {
    const [anData, flData] = await Promise.all([
      fetchOwnerAnalytics().catch(() => null),
      fetchMyEquipment().catch(() => [] as EquipmentItem[]),
    ]);
    setAnalytics(anData);
    setFleet(flData);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="saas-container" style={embedded ? undefined : { padding: '1rem' }}>
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
              {analytics?.fleetSize ?? fleet.length} {t('eqUnits')}
            </span>
            <span className="saas-metric-sub">
              {analytics
                ? t('eqFleetAvailable', { count: analytics.activeFleet })
                : t('eqAvailableForRent')}
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
            <span className="saas-metric-value">{analytics?.pendingRequestsCount ?? '…'}</span>
            <span className="saas-metric-sub">
              {analytics ? t('eqRepeatHirePercent', { percent: analytics.repeatHireRatePercent }) : t('commonLoading')}
            </span>
          </div>
        </div>
      </div>

      <div className="saas-compliance-callout">🔒 {t('eqComplianceNote')}</div>
    </div>
  );
}
