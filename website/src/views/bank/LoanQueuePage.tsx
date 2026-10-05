import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { getQueue, type Loan, type LoanQueueParams, type LoanStatus } from '../../lib/api/loans';
import { useT } from '../../lib/i18n';
import AiBadges from './AiBadges';
import { rupeesFromAmount } from './money';

const STATUSES: LoanStatus[] = [
  'submitted',
  'underReview',
  'infoRequested',
  'approved',
  'rejected',
  'disbursed',
  'cancelled',
];

const PAGE_SIZE = 10;

/**
 * Loan review queue (toolId loanReview) — filters (status / amount range /
 * district) mapped to GET /loans/queue's exact query params, with real cursor
 * pagination driven by the response's `nextCursor` field.
 */
export default function LoanQueuePage({ embedded }: { embedded?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [district, setDistrict] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [rows, setRows] = useState<Loan[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (withCursor: string | null) => {
      setLoading(true);
      setError(null);
      const params: LoanQueueParams = { pageSize: PAGE_SIZE };
      if (status) params.status = status as LoanStatus;
      if (district.trim()) params.district = district.trim();
      if (minAmount.trim()) params.minAmount = Number(minAmount);
      if (maxAmount.trim()) params.maxAmount = Number(maxAmount);
      if (withCursor) params.cursor = withCursor;
      try {
        const page = await getQueue(params);
        setRows(page.data);
        setNextCursor(page.nextCursor);
        setTotal(page.total);
      } catch (err) {
        const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
        setError(message || t('bankLoadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [status, district, minAmount, maxAmount, t],
  );

  useEffect(() => {
    setCursor(null);
    setHistory([]);
    load(null);
  }, [load]);

  const onNext = () => {
    if (!nextCursor) return;
    setHistory((h) => [...h, cursor]);
    setCursor(nextCursor);
    load(nextCursor);
  };

  const onPrev = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setCursor(prev);
    load(prev);
  };

  const content = (
    <div className="bank-queue" style={{ padding: '1rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{t('bankQueueTitle')}</h2>
      <p style={{ margin: '0.25rem 0 0.75rem', color: '#666', fontSize: '0.9rem' }}>{t('bankQueueSub')}</p>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
        <Field label={t('bankFilterStatus')}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="">{t('bankFilterAllStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`bank_status_${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('bankFilterDistrict')}>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={t('bankFilterDistrictPlaceholder')} style={inputStyle} />
        </Field>
        <Field label={t('bankFilterMinAmount')}>
          <input value={minAmount} onChange={(e) => setMinAmount(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 120 }} />
        </Field>
        <Field label={t('bankFilterMaxAmount')}>
          <input value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 120 }} />
        </Field>
      </div>

      {loading && <div style={{ padding: '1.5rem', textAlign: 'center', color: '#888' }}>{t('bankLoading')}</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: '2.5rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
          {t('bankQueueEmpty')}
        </div>
      )}

      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.78rem' }}>
              <Th>{t('bankColApplication')}</Th>
              <Th>{t('bankColFarmer')}</Th>
              <Th>{t('bankColAmount')}</Th>
              <Th>{t('bankColDistrict')}</Th>
              <Th>{t('bankColStatus')}</Th>
              <Th>{t('bankColAi')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((loan) => (
              <tr
                key={loan.applicationId}
                onClick={() => navigate(`/dashboard/p/loanReview/${loan.applicationId}`)}
                style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
              >
                <Td>{loan.applicationNumber || loan.applicationId.slice(0, 8)}</Td>
                <Td>{loan.farmerName || t('bankNotAvailable')}</Td>
                <Td>{rupeesFromAmount(loan.amount)}</Td>
                <Td>{loan.district || t('bankNotAvailable')}</Td>
                <Td>
                  <span style={statusBadge(loan.status)}>{t(`bank_status_${loan.status}`)}</span>
                </Td>
                <Td>
                  <AiBadges ai={loan.ai} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem' }}>
        <button type="button" onClick={onPrev} disabled={history.length === 0} style={pagerStyle(history.length === 0)}>
          {t('bankPrev')}
        </button>
        <button type="button" onClick={onNext} disabled={!nextCursor} style={pagerStyle(!nextCursor)}>
          {t('bankNext')}
        </button>
        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{t('bankQueueTotal', { count: total })}</span>
      </div>
    </div>
  );

  if (embedded) return content;
  return <ToolShell toolId="loanReview">{content}</ToolShell>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', color: '#6b7280' }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={{ padding: '0.55rem 0.5rem' }}>{children}</td>;
}

const inputStyle: CSSProperties = {
  padding: '0.4rem 0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '0.85rem',
};

function statusBadge(status: LoanStatus): CSSProperties {
  const palette: Record<string, [string, string]> = {
    submitted: ['#334155', '#e2e8f0'],
    underReview: ['#b45309', '#fef3c7'],
    infoRequested: ['#6d28d9', '#ede9fe'],
    approved: ['#15803d', '#dcfce7'],
    rejected: ['#b91c1c', '#fee2e2'],
    disbursed: ['#0d9488', '#ccfbf1'],
    cancelled: ['#64748b', '#f1f5f9'],
  };
  const [color, background] = palette[status] || ['#334155', '#e2e8f0'];
  return { padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, color, background };
}

function pagerStyle(disabled: boolean): CSSProperties {
  return {
    padding: '0.4rem 0.9rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: disabled ? '#f1f5f9' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.85rem',
  };
}
