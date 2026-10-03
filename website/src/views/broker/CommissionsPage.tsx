import { useCallback, useEffect, useState } from 'react';
import DealStatusPill from '../../components/broker/DealStatusPill';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import {
  dealMath,
  getCommissions,
  inr,
  listSettlements,
  type CommissionsSummary,
  type Settlement,
} from '../../lib/api/broker';
import { useT } from '../../lib/i18n';
import { useBrokerStore } from '../../stores/broker';
import '../../theme/trade.css';
import '../../theme/broker.css';

const fmtPeriod = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Commission & payouts — totals from /broker/commissions, a per-deal
 * commission table, and the weekly settlement ledger (pending → approved →
 * paid). Requires the P1 settlement fix for non-zero grossRupees.
 */
export default function CommissionsPage() {
  const t = useT();
  useEnsureProfile('broker');

  const commissions = useBrokerStore((s) => s.commissions);
  const refreshCommissions = useBrokerStore((s) => s.refreshCommissions);
  const [settlements, setSettlements] = useState<Settlement[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    refreshCommissions().catch(() => setFailed(true));
    listSettlements({ page: 1, pageSize: 50 })
      .then((res) => setSettlements(res.data))
      .catch(() => setFailed(true));
  }, [refreshCommissions]);

  useEffect(load, [load]);

  const summary: CommissionsSummary | null = commissions;
  const deals = summary?.deals ?? [];

  return (
    <ToolShell toolId="commissions">
      {summary === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {summary !== null ? (
        <>
          <div className="trade-stats-grid">
            <div className="trade-stat">
              <p className="trade-stat-label">{t('commTotalEarned')}</p>
              <p className="trade-stat-value">{inr(summary.totalEarned)}</p>
            </div>
            <div className="trade-stat">
              <p className="trade-stat-label">{t('commPendingPayout')}</p>
              <p className="trade-stat-value">{inr(summary.pendingPayout)}</p>
            </div>
            <div className="trade-stat">
              <p className="trade-stat-label">{t('commCompletedDeals')}</p>
              <p className="trade-stat-value">{summary.completedDealsCount}</p>
            </div>
            <div className="trade-stat">
              <p className="trade-stat-label">{t('commActiveDeals')}</p>
              <p className="trade-stat-value">{summary.activeDealsCount}</p>
            </div>
          </div>

          <p className="trade-section-title">{t('commPerDeal')}</p>
          {deals.length === 0 ? (
            <p className="trade-hint">{t('commEmpty')}</p>
          ) : (
            <div className="trade-list" style={{ marginTop: 0 }}>
              {deals.map((d) => {
                const math = dealMath(d.quantityQuintals, d.agreedRate, d.brokerCommissionPct);
                return (
                  <div key={d.id} className="trade-card" style={{ cursor: 'default' }}>
                    <div className="trade-card-row">
                      <span className="trade-card-title">{d.commodity}</span>
                      <DealStatusPill status={d.status} />
                    </div>
                    <div className="trade-card-row">
                      <span className="trade-card-sub">
                        {inr(math.gross)} · {d.brokerCommissionPct}%
                      </span>
                      <span className="trade-card-amount">{inr(math.commission)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="trade-section-title">{t('commSettlements')}</p>
          {settlements === null ? <p className="trade-hint">{t('commonLoading')}</p> : null}
          {settlements !== null && settlements.length === 0 ? (
            <p className="trade-hint">{t('commSettlementsEmpty')}</p>
          ) : null}
          {settlements !== null && settlements.length > 0 ? (
            <div className="trade-list" style={{ marginTop: 0 }}>
              {settlements.map((s) => (
                <div key={s.id} className="trade-card" style={{ cursor: 'default' }}>
                  <div className="trade-card-row">
                    <span className="trade-card-title">
                      {fmtPeriod(s.periodStart)} — {fmtPeriod(s.periodEnd)}
                    </span>
                    <StatusPill status={s.status} />
                  </div>
                  <div className="trade-card-row">
                    <span className="trade-card-sub">
                      {t('commGross')}: {inr(s.grossRupees)} · {t('commCommission')}:{' '}
                      {inr(s.commissionRupees)}
                    </span>
                    <span className="trade-card-amount">{inr(s.netRupees)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </ToolShell>
  );
}
