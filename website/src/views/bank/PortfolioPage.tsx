import { useEffect, useState, type CSSProperties } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { getStats, type LoanStats } from '../../lib/api/loans';
import { useT } from '../../lib/i18n';
import { count, percent, rupeesFromPaisa } from './money';

/**
 * Loan portfolio / NPA watch (toolId loanDashboard). Reads GET /loans/stats:
 * `npaWatch` (at-risk rows) and `emiCollectionRate` (integer percent), plus
 * portfolio totals in integer paisa rendered as ₹.
 */
export default function PortfolioPage({ embedded }: { embedded?: boolean }) {
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
        if (!mounted) return;
        const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
        setError(message || t('bankLoadFailed'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t]);

  const rows = stats && Array.isArray(stats.npaWatch) ? stats.npaWatch : [];
  const portfolio = stats?.portfolioTotals;

  const content = (
    <div className="bank-portfolio" style={{ padding: '1rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{t('bankPortfolioTitle')}</h2>
      <p style={{ margin: '0.25rem 0 0.75rem', color: '#666', fontSize: '0.9rem' }}>{t('bankPortfolioSub')}</p>

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>{t('bankLoading')}</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>
      )}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <Card label={t('bankStatCollectionRate')} value={percent(stats.emiCollectionRate)} color="#0d9488" />
          <Card label={t('bankStatAtRisk')} value={String(count(stats.atRiskAccounts))} color="#b91c1c" />
          <Card label={t('bankPortfolioSanctioned')} value={rupeesFromPaisa(portfolio?.sanctionedPaisa)} color="#334155" />
          <Card label={t('bankPortfolioDisbursed')} value={rupeesFromPaisa(portfolio?.disbursedPaisa)} color="#334155" />
          <Card label={t('bankPortfolioOutstanding')} value={rupeesFromPaisa(portfolio?.outstandingPaisa)} color="#334155" />
        </div>
      )}

      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '1.25rem 0 0.5rem' }}>{t('bankNpaSection')}</h3>
      {rows.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db', color: '#6b7280' }}>
          {t('bankNpaEmpty')}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={th}> {t('bankColApplication')}</th>
              <th style={th}>{t('bankColFarmer')}</th>
              <th style={th}>{t('bankColAmount')}</th>
              <th style={th}>{t('bankColStatus')}</th>
              <th style={th}>{t('bankColCreditScore')}</th>
              <th style={th}>{t('bankColDaysOverdue')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.applicationId}>
                <td style={td}>{row.applicationNumber || row.applicationId.slice(0, 8)}</td>
                <td style={td}>{row.farmerName || t('bankNotAvailable')}</td>
                <td style={td}>{rupeesFromPaisa(row.amountPaisa)}</td>
                <td style={td}>{t(`bank_status_${row.status}`)}</td>
                <td style={td}>{count(row.creditScore)}</td>
                <td style={td}>{count(row.daysOverdue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  if (embedded) return content;
  return <ToolShell toolId="loanDashboard">{content}</ToolShell>;
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="trade-card" style={{ padding: '1rem' }}>
      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const th: CSSProperties = { textAlign: 'left', padding: '0.4rem 0.5rem', color: '#6b7280', fontSize: '0.78rem', fontWeight: 600 };
const td: CSSProperties = { padding: '0.5rem 0.5rem', borderTop: '1px solid #f1f5f9' };
