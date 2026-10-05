import { useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { getStats, type LoanStats } from '../../lib/api/loans';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.bank';
import '../../lib/i18n/locales/hi.bank';
import { count, percent, rupeesFromPaisa } from './money';

/**
 * CreditDesk home board (toolId bankManagerHome) — stat cards from
 * GET /loans/stats: queue depth by SLA, approvals today, disbursals this week,
 * at-risk accounts and portfolio totals (integer paisa rendered as ₹).
 */
export default function BankHomeBoard({ embedded }: { embedded?: boolean }) {
  const t = useT();
  const [stats, setStats] = useState<LoanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getStats()
      .then((data) => {
        if (mounted) setStats(data);
      })
      .catch((err) => {
        if (mounted) setError(err?.response?.data?.error?.message || t('bankLoadFailed'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t]);

  const sla = stats?.queueDepthBySla;
  const disbursals = stats?.disbursalsThisWeek;
  const portfolio = stats?.portfolioTotals;

  const content = (
    <div className="bank-home" style={{ padding: '1rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{t('bankHomeTitle')}</h2>
      <p style={{ margin: '0.25rem 0 0.75rem', color: '#666', fontSize: '0.9rem' }}>
        {t('bankHomeSub')}
      </p>

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>{t('bankLoading')}</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <Stat label={t('bankStatPendingReview')} value={String(stats.pendingReview)} color="#334155" />
          <Stat label={t('bankStatTotalApplications')} value={String(stats.totalApplications)} color="#334155" />
          <Stat label={t('bankStatApprovalsToday')} value={String(count(stats.approvalsToday))} color="#16a34a" />
          <Stat
            label={t('bankStatDisbursalsWeek')}
            value={rupeesFromPaisa(disbursals?.amountPaisa)}
            color="#334155"
            sub={`${count(disbursals?.count)} ${t('bankDisbursalUnit')}`}
          />
          <Stat label={t('bankStatAtRisk')} value={String(count(stats.atRiskAccounts))} color="#b91c1c" />
          <Stat label={t('bankStatCollectionRate')} value={percent(stats.emiCollectionRate)} color="#0d9488" />
        </div>
      )}

      {stats && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{t('bankSlaSection')}</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={chip('#b91c1c', '#fee2e2')}>
              {t('bankSlaBreach')}: {count(sla?.breach)}
            </span>
            <span style={chip('#b45309', '#fef3c7')}>
              {t('bankSlaDueSoon')}: {count(sla?.dueSoon)}
            </span>
            <span style={chip('#15803d', '#dcfce7')}>
              {t('bankSlaOnTrack')}: {count(sla?.onTrack)}
            </span>
          </div>
        </div>
      )}

      {stats && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{t('bankPortfolioSection')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <Stat label={t('bankPortfolioSanctioned')} value={rupeesFromPaisa(portfolio?.sanctionedPaisa)} color="#334155" />
            <Stat label={t('bankPortfolioDisbursed')} value={rupeesFromPaisa(portfolio?.disbursedPaisa)} color="#334155" />
            <Stat label={t('bankPortfolioOutstanding')} value={rupeesFromPaisa(portfolio?.outstandingPaisa)} color="#334155" />
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return content;
  return <ToolShell toolId="bankManagerHome">{content}</ToolShell>;
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="trade-card" style={{ padding: '1rem' }}>
      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{sub}</div>}
    </div>
  );
}

function chip(color: string, background: string) {
  return {
    padding: '0.35rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.85rem',
    fontWeight: 600,
    color,
    background,
  } as const;
}
