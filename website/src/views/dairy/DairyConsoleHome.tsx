import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import {
  fmtINR,
  fmtL,
  getDailyReport,
  getProcurementSummary,
  getSalesSummary,
  listStock,
  type DailyReport,
  type ProcurementSummary,
  type SalesSummary,
  type StockItem,
} from '../../lib/api/dairy';
import { useT } from '../../lib/i18n';
import DairyStatCard from './components/DairyStatCard';
import EmptyState from './components/EmptyState';

/**
 * Manager console home (P3) — today's procurement snapshot, sales summary,
 * quick actions for every console section, and stock alerts (expiring soon /
 * running low).
 */

const todayStr = (): string => new Date().toLocaleDateString('en-CA');

const QUICK_ACTIONS = [
  { to: '/dairy/console/collections/new', icon: '➕', labelKey: 'dairyQaNewCollection' },
  { to: '/dairy/console/collections', icon: '🧾', labelKey: 'dairyQaCollections' },
  { to: '/dairy/console/members', icon: '👨‍🌾', labelKey: 'dairyQaMembers' },
  { to: '/dairy/console/rate-chart', icon: '📊', labelKey: 'dairyQaRateChart' },
  { to: '/dairy/console/payments', icon: '💸', labelKey: 'dairyQaPayments' },
  { to: '/dairy/console/sales/customers', icon: '🏪', labelKey: 'dairyQaCustomers' },
  { to: '/dairy/console/sales/orders', icon: '📦', labelKey: 'dairyQaOrders' },
  { to: '/dairy/console/stock', icon: '🥣', labelKey: 'dairyQaStock' },
  { to: '/dairy/console/reports', icon: '📈', labelKey: 'dairyQaReports' },
] as const;

const LOW_STOCK_QTY = 5;
const EXPIRY_WINDOW_DAYS = 3;

interface StockAlert {
  item: StockItem;
  kind: 'expiring' | 'expired' | 'low';
  days?: number;
}

export default function DairyConsoleHome() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [summary, setSummary] = useState<ProcurementSummary | null>(null);
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [stock, setStock] = useState<StockItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    const today = todayStr();
    Promise.all([
      getProcurementSummary(today),
      getDailyReport(today),
      getSalesSummary(today, today),
      listStock({ pageSize: 500 }),
    ])
      .then(([sumRes, dailyRes, salesRes, stockRes]) => {
        setSummary(sumRes);
        setDaily(dailyRes);
        setSales(salesRes);
        setStock(stockRes.data);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const alerts = useMemo<StockAlert[]>(() => {
    const today = new Date(`${todayStr()}T00:00:00`);
    const out: StockAlert[] = [];
    for (const item of stock ?? []) {
      if (item.stockQty < LOW_STOCK_QTY) out.push({ item, kind: 'low' });
      if (item.expiryDate) {
        const days = Math.round(
          (new Date(`${item.expiryDate}T00:00:00`).getTime() - today.getTime()) / 86_400_000
        );
        if (days < 0) out.push({ item, kind: 'expired', days });
        else if (days <= EXPIRY_WINDOW_DAYS) out.push({ item, kind: 'expiring', days });
      }
    }
    return out;
  }, [stock]);

  return (
    <ToolShell toolId="dairyConsole">
      <div className="dairy-wrap">
        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="dairyLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : (
          <>
            <div className="dairy-section">
              <span className="dairy-section-title">🌅 {t('dairyTodaySnapshot')}</span>
              <div className="dairy-stats-grid">
                <DairyStatCard
                  label={t('dairyStatLitersAM')}
                  value={summary ? fmtL(summary.totalMorningLiters) : '—'}
                  unit={t('dairyLiters')}
                />
                <DairyStatCard
                  label={t('dairyStatLitersPM')}
                  value={summary ? fmtL(summary.totalEveningLiters) : '—'}
                  unit={t('dairyLiters')}
                />
                <DairyStatCard
                  label={t('dairyStatPayoutDue')}
                  value={summary ? fmtINR(summary.totalPayoutAmount) : '—'}
                  sub={summary ? `${fmtL(summary.totalLiters)} L` : undefined}
                />
                <DairyStatCard
                  label={t('dairyStatCollections')}
                  value={summary ? String(summary.collectionsCount) : '—'}
                  sub={
                    summary && summary.collectionsCount > 0
                      ? `${t('dairyStatAvgFat')} ${summary.avgFat}% · ${t('dairyStatAvgSnf')} ${summary.avgSnf}%`
                      : undefined
                  }
                />
              </div>
              {summary && summary.collectionsCount === 0 ? (
                <p className="dairy-hint">{t('dairyTodayEmpty')}</p>
              ) : null}
            </div>

            <div className="dairy-section">
              <span className="dairy-section-title">🏪 {t('dairySalesToday')}</span>
              <div className="dairy-stats-grid">
                <DairyStatCard
                  label={t('dairySalesOrders')}
                  value={daily ? String(daily.sales.orders) : sales ? String(sales.totalOrders) : '—'}
                />
                <DairyStatCard
                  label={t('dairySalesAmount')}
                  value={daily ? fmtINR(daily.sales.amount) : sales ? fmtINR(sales.totalAmount) : '—'}
                />
                <DairyStatCard
                  label={t('dairySalesCollected')}
                  value={sales ? fmtINR(sales.collectedAmount) : '—'}
                />
              </div>
            </div>

            <div className="dairy-section">
              <span className="dairy-section-title">⚡ {t('dairyQuickActions')}</span>
              <div className="dairy-qa-grid">
                {QUICK_ACTIONS.map((qa) => (
                  <Link key={qa.to} to={qa.to} className="dairy-qa">
                    <span className="dairy-qa-icon" aria-hidden>
                      {qa.icon}
                    </span>
                    <span>{t(qa.labelKey)}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="dairy-section">
              <span className="dairy-section-title">⚠️ {t('dairyHintsTitle')}</span>
              {alerts.length === 0 ? (
                <p className="dairy-hint">{t('dairyNoAlerts')}</p>
              ) : (
                <div className="dairy-list" style={{ marginTop: 0 }}>
                  {alerts.map((alert) => (
                    <Link key={`${alert.kind}-${alert.item.id}`} to="/dairy/console/stock" className="dairy-alert">
                      <span aria-hidden>{alert.kind === 'low' ? '📉' : '⏳'}</span>
                      <span>
                        {alert.kind === 'low'
                          ? t('dairyHintLowStock', {
                              name: alert.item.name,
                              qty: alert.item.stockQty,
                              unit: alert.item.unit,
                            })
                          : alert.kind === 'expired'
                            ? t('dairyHintExpired', { name: alert.item.name })
                            : t('dairyHintExpiring', { name: alert.item.name, days: alert.days ?? 0 })}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ToolShell>
  );
}
