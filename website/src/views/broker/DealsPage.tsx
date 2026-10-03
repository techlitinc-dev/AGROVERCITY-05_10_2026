import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DealStatusPill from '../../components/broker/DealStatusPill';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { dealMath, inr, type Deal, type DealStatus } from '../../lib/api/broker';
import { useT } from '../../lib/i18n';
import { useBrokerStore } from '../../stores/broker';
import '../../theme/trade.css';
import '../../theme/broker.css';

/** Lifecycle order drives the grouped pipeline sections (plan §2.9). */
const SECTIONS: Array<{ status: DealStatus; labelKey: string }> = [
  { status: 'negotiating', labelKey: 'dealsSectionNegotiating' },
  { status: 'contract_issued', labelKey: 'dealsSectionContract' },
  { status: 'accepted', labelKey: 'dealsSectionAccepted' },
  { status: 'in_transit', labelKey: 'dealsSectionTransit' },
  { status: 'completed', labelKey: 'dealsSectionCompleted' },
];

const fmtUpdated = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * My Deals — status-grouped pipeline list (Kanban-lite). Cancelled deals sit
 * in a collapsed section; every row shows the payout math mini-line so the
 * broker never opens a deal to remember its numbers.
 */
export default function DealsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('broker');

  const deals = useBrokerStore((s) => s.deals);
  const refreshDeals = useBrokerStore((s) => s.refreshDeals);
  const [failed, setFailed] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    refreshDeals().catch(() => setFailed(true));
  }, [refreshDeals]);

  useEffect(load, [load]);

  const refresh = () => {
    setRefreshing(true);
    refreshDeals()
      .catch(() => setFailed(true))
      .finally(() => setRefreshing(false));
  };

  const list = deals ?? [];
  const active = list.filter((d) => d.status !== 'cancelled');
  const cancelled = list.filter((d) => d.status === 'cancelled');

  const renderRow = (d: Deal) => {
    const math = dealMath(d.quantityQuintals, d.agreedRate, d.brokerCommissionPct);
    return (
      <Link key={d.id} className="trade-card" to={`/dashboard/p/broker/deals/${d.id}`}>
        <div className="trade-card-row">
          <span className="trade-card-title">
            {d.commodity}
            {d.variety ? ` · ${d.variety}` : ''}
          </span>
          <DealStatusPill status={d.status} />
        </div>
        <div className="trade-card-row">
          <span className="trade-card-sub">
            {d.quantityQuintals} {t('unitQuintalShort')} · {d.sellerName} → {d.buyerName}
          </span>
          <span className="trade-card-amount">
            {inr(d.agreedRate)}
            {t('perQuintal')}
          </span>
        </div>
        <div className="trade-card-row">
          <span className="trade-card-sub">
            {t('dealsMathLine', {
              gross: inr(math.gross),
              commission: inr(math.commission),
              payout: inr(math.payout),
            })}
          </span>
          <span className="trade-card-sub">{fmtUpdated(d.updatedAt)}</span>
        </div>
      </Link>
    );
  };

  return (
    <ToolShell toolId="deals">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => navigate('/dashboard/p/broker/deals/new')}
        >
          ＋ {t('dealsNew')}
        </button>
        <button
          type="button"
          className="av-btn av-btn-ghost"
          onClick={refresh}
          disabled={refreshing}
        >
          {refreshing ? <span className="av-spinner" aria-hidden /> : `↻ ${t('dealsRefresh')}`}
        </button>
      </div>

      {deals === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {deals !== null && list.length === 0 ? (
        <EmptyState
          icon="🤝"
          titleKey="dealsEmpty"
          bodyKey="dealsEmptyBody"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => navigate('/dashboard/p/broker/deals/new')}
            >
              ＋ {t('dealsNew')}
            </button>
          }
        />
      ) : null}

      {SECTIONS.map(({ status, labelKey }) => {
        const rows = active.filter((d) => d.status === status);
        if (rows.length === 0) return null;
        return (
          <section key={status}>
            <p className="trade-section-title">
              {t(labelKey)} · {rows.length}
            </p>
            <div className="trade-list" style={{ marginTop: 0 }}>
              {rows.map(renderRow)}
            </div>
          </section>
        );
      })}

      {cancelled.length > 0 ? (
        <section>
          <button
            type="button"
            className="av-chip"
            style={{ marginTop: 16 }}
            onClick={() => setShowCancelled((v) => !v)}
          >
            {t('dealsCancelledSection', { count: cancelled.length })} {showCancelled ? '▲' : '▼'}
          </button>
          {showCancelled ? (
            <div className="trade-list" style={{ marginTop: 8 }}>
              {cancelled.map(renderRow)}
            </div>
          ) : null}
        </section>
      ) : null}
    </ToolShell>
  );
}
