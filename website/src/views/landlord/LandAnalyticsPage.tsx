import { useCallback, useEffect, useState } from 'react';
import { toast } from '../../components/toast';
import { fetchLandlordAnalytics, type LandlordAnalytics } from '../../lib/api/landlord';
import { useT } from '../../lib/i18n';

/** LandBank — per-plot occupancy and rent analytics (task 1.8). */
export default function LandAnalyticsPage() {
  const t = useT();
  const [analytics, setAnalytics] = useState<LandlordAnalytics | null>(null);

  const load = useCallback(() => {
    fetchLandlordAnalytics()
      .then(setAnalytics)
      .catch(() => toast(t('llLoadFailed'), { error: true }));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!analytics) {
    return (
      <section className="dash-section">
        <p className="dash-empty-line">…</p>
      </section>
    );
  }

  const maxDemand = Math.max(1, ...analytics.demandTrend.map((point) => point.demandScore));

  return (
    <section className="dash-section">
      <h3>{t('llAnalyticsTitle')}</h3>
      <div className="dash-grid-3">
        <div className="dash-module-card">
          <span className="dash-module-name">{t('llTotalAcreage')}</span>
          <span className="dash-module-count clear">{analytics.totalAcreage}</span>
        </div>
        <div className="dash-module-card">
          <span className="dash-module-name">{t('llOccupancy')}</span>
          <span className="dash-module-count clear">{analytics.occupancyRatePercent}%</span>
        </div>
        <div className="dash-module-card">
          <span className="dash-module-name">{t('llMonthlyIncome')}</span>
          <span className="dash-module-count clear">₹{analytics.monthlyRentIncomeRupees}</span>
        </div>
      </div>

      <h4 style={{ marginTop: 14 }}>{t('llDemandTrend')}</h4>
      <div className="intel-chart" role="img" aria-label={t('llDemandTrend')}>
        {analytics.demandTrend.map((point) => (
          <div key={point.month} className="intel-chart-col">
            <div className="intel-chart-bar-wrap">
              <div className="intel-chart-bar" style={{ height: `${Math.max(2, (point.demandScore / maxDemand) * 100)}%` }}
                title={`${point.month}: ${point.demandScore}`} />
            </div>
            <span className="intel-chart-label">{point.month}</span>
          </div>
        ))}
      </div>
      <p className="dash-empty-line" style={{ marginTop: 10 }}>
        {analytics.activeTenants} {t('llTenant').toLowerCase()} · {analytics.pendingRequestsCount} {t('llRequestsTitle').toLowerCase()}
      </p>
    </section>
  );
}
