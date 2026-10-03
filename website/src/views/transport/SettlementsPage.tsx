import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { inr } from '../../lib/api/trade';
import { transportSettlements, type SettlementDoc } from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Weekly settlements (T9) — the transporter's payout ledger: one card per
 * settlement period with gross, 10% platform commission, net payout and
 * status, plus a running totals row on top.
 */
export default function SettlementsPage() {
  const t = useT();
  useEnsureProfile('transport');

  const [docs, setDocs] = useState<SettlementDoc[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    transportSettlements()
      .then((res) => setDocs(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const totals = (docs ?? []).reduce(
    (acc, d) => ({
      gross: acc.gross + (d.grossRupees || 0),
      commission: acc.commission + (d.commissionRupees || 0),
      net: acc.net + (d.netRupees || 0),
    }),
    { gross: 0, commission: 0, net: 0 }
  );

  return (
    <ToolShell toolId="settlements">
      {docs === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {docs !== null && docs.length === 0 ? (
        <EmptyState icon="💸" titleKey="trEmptySettlements" />
      ) : null}

      {docs !== null && docs.length > 0 ? (
        <>
          <div className="trade-stats-grid">
            <div className="trade-stat">
              <div className="trade-stat-label">{t('trSettlementGross')}</div>
              <div className="trade-stat-value">{inr(totals.gross)}</div>
            </div>
            <div className="trade-stat">
              <div className="trade-stat-label">{t('trSettlementCommission')}</div>
              <div className="trade-stat-value">{inr(totals.commission)}</div>
            </div>
            <div className="trade-stat">
              <div className="trade-stat-label">{t('trSettlementNet')}</div>
              <div className="trade-stat-value">{inr(totals.net)}</div>
            </div>
          </div>

          <div className="trade-list">
            {docs.map((d) => (
              <div key={d.id} className="trade-card" style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-title">
                    {t('trSettlementPeriod')}: {fmtDate(d.periodStart)} – {fmtDate(d.periodEnd)}
                  </span>
                  <StatusPill status={d.status} />
                </div>
                <div className="trade-detail-grid" style={{ marginTop: 8 }}>
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('trSettlementGross')}</div>
                    <div className="trade-detail-value">{inr(d.grossRupees)}</div>
                  </div>
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('trSettlementCommission')}</div>
                    <div className="trade-detail-value">{inr(d.commissionRupees)}</div>
                  </div>
                  <div className="trade-detail-item">
                    <div className="trade-detail-label">{t('trSettlementNet')}</div>
                    <div className="trade-detail-value">{inr(d.netRupees)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </ToolShell>
  );
}
