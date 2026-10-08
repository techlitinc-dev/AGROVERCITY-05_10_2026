import { useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { getNorthStar, type NorthStar } from '../../lib/api/admin';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/** Render integer paisa as ₹ at display time only (never in the API). */
const rupees = (paisa: number): string => `₹${Math.round(paisa / 100).toLocaleString('en-IN')}`;

/**
 * North-star metrics dashboard (WS-09 X13) — six metrics from `analytics_events`.
 * Phase-07 restyles the console.
 */
export default function MetricsPage() {
  const t = useT();
  const [metrics, setMetrics] = useState<NorthStar | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getNorthStar()
      .then(setMetrics)
      .catch(() => setFailed(true));
  }, []);

  const gmv = metrics
    ? Object.entries(metrics.gmvPerMarketplace)
        .map(([market, paisa]) => `${market}: ${rupees(paisa)}`)
        .join(', ') || '—'
    : '—';

  const cards: Array<{ key: string; labelKey: string; value: string }> = metrics
    ? [
        { key: 'wtf', labelKey: 'metrics.wtf', value: String(metrics.weeklyTransactingFarmers) },
        { key: 'gmv', labelKey: 'metrics.gmv', value: gmv },
        { key: 'take', labelKey: 'metrics.takeRate', value: rupees(metrics.takeRateRevenuePaisa) },
        { key: 'paid', labelKey: 'metrics.paidConversion', value: `${(metrics.paidPlanConversion * 100).toFixed(1)}%` },
        { key: 'tasks', labelKey: 'metrics.tasksPerUser', value: String(metrics.tasksPerUserPerWeek) },
        { key: 'dl', labelKey: 'metrics.deepLinkRate', value: `${(metrics.deepLinkCompletionRate * 100).toFixed(1)}%` },
      ]
    : [];

  return (
    <ToolShell toolId="settings" backTo="/dashboard">
      <h2 className="trade-card-title">{t('metrics.title')}</h2>
      {failed ? <EmptyState icon="📡" titleKey="tradeLoadFailed" /> : null}
      <div className="trade-list">
        {cards.map((card) => (
          <div key={card.key} className="trade-card">
            <div className="trade-card-row">
              <span className="trade-card-title">{t(card.labelKey)}</span>
              <span className="trade-pill">{card.value}</span>
            </div>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
