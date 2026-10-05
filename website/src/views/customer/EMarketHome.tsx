import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { fetchCustomerAnalytics, type CustomerAnalytics } from '../../lib/api/emarketCustomer';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const SECTIONS = [
  { toolId: 'browse', labelKey: 'emarketBrowse', icon: '🛒' },
  { toolId: 'demands', labelKey: 'emarketDemands', icon: '📣' },
  { toolId: 'quotes', labelKey: 'emarketQuotes', icon: '💬' },
  { toolId: 'orderTracking', labelKey: 'emarketOrders', icon: '📍' },
  { toolId: 'favorites', labelKey: 'emarketFavorites', icon: '⭐' },
];

/**
 * FarmGate customer home (WS-03 task 3.2) — dashboard summary bound to
 * GET /v1/customer/analytics plus links to every buying surface. No demo data,
 * no `?? <number>` fallbacks.
 */
export default function EMarketHome() {
  const t = useT();
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchCustomerAnalytics()
      .then(setAnalytics)
      .catch(() => {
        setAnalytics(null);
        setFailed(true);
        toast(t('emarketLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = analytics
    ? [
        { key: 'emarketTotalSpend', value: `₹${analytics.totalSpendRupees}` },
        { key: 'emarketActiveOrders', value: analytics.activeOrdersCount },
        { key: 'emarketStandingDemands', value: analytics.standingDemandsCount },
        { key: 'emarketOpenQuotes', value: analytics.openQuotesCount },
        { key: 'emarketTonnage', value: analytics.totalTonnageMT },
      ]
    : [];

  return (
    <ToolShell toolId="emarketHome">
      <section className="dash-section">
        <h3>{t('emarketHomeTitle')}</h3>
        {failed ? (
          <p className="dash-empty-line">{t('emarketLoadFailed')}</p>
        ) : analytics === null ? (
          <p className="dash-empty-line">{t('emarketLoading')}</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            {metrics.map((metric) => (
              <div
                key={metric.key}
                className="dash-summary-card"
                style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10 }}
              >
                <div style={{ fontSize: 12, color: '#6B7280' }}>{t(metric.key)}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{metric.value}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dash-section">
        <h3>{t('emarketQuickLinks')}</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {SECTIONS.map((section) => (
            <Link
              key={section.toolId}
              to={`/dashboard/p/${section.toolId}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 12,
                border: '1px solid #E5E7EB',
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>{section.icon}</span>
              <span>{t(section.labelKey)}</span>
            </Link>
          ))}
        </div>
      </section>
    </ToolShell>
  );
}
