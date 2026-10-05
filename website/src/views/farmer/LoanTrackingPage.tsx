import { useEffect, useState, type CSSProperties, type ChangeEvent } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import {
  getLoan,
  getMyLoans,
  getSchedule,
  respondLoan,
  uploadLoanDocument,
  type Loan,
  type LoanScheduleEntry,
} from '../../lib/api/loans';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.bank';
import '../../lib/i18n/locales/hi.bank';
import { rupeesFromAmount } from '../bank/money';

const STAGES = ['submitted', 'underReview', 'infoRequested', 'approved', 'disbursed'];
const SIDE_STATES = ['rejected', 'cancelled'];

/**
 * Farmer loan mirror (toolId loanTracking) — the applicant's applications with
 * an LN-YYYY-#### chip and a stage timeline, the document-request upload flow
 * (task 3.11 deep link) and the EMI schedule for approved/disbursed loans.
 */
export default function LoanTrackingPage({ embedded }: { embedded?: boolean }) {
  const t = useT();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Record<string, LoanScheduleEntry[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    const data = await getMyLoans();
    setLoans(data);
    return data;
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    load()
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

  const onUpload = async (loan: Loan, event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;
    setBusyId(loan.applicationId);
    setActionError(null);
    try {
      await uploadLoanDocument(loan.applicationId, files);
      await respondLoan(loan.applicationId, { message: t('bankDocsUploadedNote') });
      await load();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setActionError(message || t('bankActionFailed'));
    } finally {
      setBusyId(null);
      event.target.value = '';
    }
  };

  const toggleSchedule = async (loan: Loan) => {
    if (openId === loan.applicationId) {
      setOpenId(null);
      return;
    }
    setOpenId(loan.applicationId);
    if (!schedules[loan.applicationId]) {
      try {
        const fresh = await getLoan(loan.applicationId);
        const entries = await getSchedule(fresh.applicationId);
        setSchedules((s) => ({ ...s, [loan.applicationId]: entries }));
      } catch {
        setSchedules((s) => ({ ...s, [loan.applicationId]: [] }));
      }
    }
  };

  const content = (
    <div className="bank-tracking" style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{t('bankTrackingTitle')}</h2>
      <p style={{ margin: '0.25rem 0 0.75rem', color: '#666', fontSize: '0.9rem' }}>{t('bankTrackingSub')}</p>

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>{t('bankLoading')}</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>
      )}
      {actionError && (
        <div style={{ padding: '0.6rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {actionError}
        </div>
      )}

      {!loading && !error && loans.length === 0 && (
        <div style={{ padding: '2.5rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db', color: '#6b7280' }}>
          {t('bankTrackingEmpty')}
        </div>
      )}

      {loans.map((loan) => {
        const sideState = SIDE_STATES.includes(loan.status) ? loan.status : null;
        const reached = new Set((loan.timeline || []).map((e) => e.status));
        return (
          <div key={loan.applicationId} className="trade-card" style={{ padding: '1rem', marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={chipStyle}>{loan.applicationNumber || loan.applicationId.slice(0, 8)}</span>
                <span style={statusBadge(sideState || loan.status)}>{t(`bank_status_${loan.status}`)}</span>
              </div>
              <span style={{ fontWeight: 700 }}>{rupeesFromAmount(loan.amount)}</span>
            </div>

            {!sideState && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                {STAGES.map((stage) => (
                  <span key={stage} style={stageChip(reached.has(stage))}>
                    {t(`bankStage_${stage}`)}
                  </span>
                ))}
              </div>
            )}

            <ul style={{ margin: '0.7rem 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem', color: '#4b5563' }}>
              {(loan.timeline || []).map((entry, idx) => (
                <li key={`${entry.status}-${idx}`}>
                  <span style={{ fontWeight: 600 }}>{entry.statusText || t(`bank_status_${entry.status}`)}</span>
                  <span style={{ color: '#9ca3af' }}> · {entry.at}</span>
                  {entry.note && <span> — {entry.note}</span>}
                </li>
              ))}
            </ul>

            {loan.status === 'infoRequested' && (
              <div style={{ marginTop: '0.75rem', padding: '0.7rem', background: '#f5f3ff', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: '#6d28d9', fontWeight: 600, marginBottom: '0.4rem' }}>
                  {t('bankDocRequestTitle')}
                </div>
                {loan.note && <div style={{ fontSize: '0.82rem', color: '#4b5563', marginBottom: '0.5rem' }}>{loan.note}</div>}
                <label style={{ fontSize: '0.82rem', color: '#4b5563', display: 'block' }}>
                  {t('bankDocUploadLabel')}
                  <input type="file" multiple disabled={busyId === loan.applicationId} onChange={(e) => void onUpload(loan, e)} style={{ display: 'block', marginTop: '0.3rem' }} />
                </label>
              </div>
            )}

            {(loan.status === 'approved' || loan.status === 'disbursed') && (
              <div style={{ marginTop: '0.6rem' }}>
                <button type="button" style={linkBtn} onClick={() => void toggleSchedule(loan)}>
                  {openId === loan.applicationId ? t('bankHideSchedule') : t('bankShowSchedule')}
                </button>
                {openId === loan.applicationId && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>{t('bankColInstallment')}</th>
                        <th style={thStyle}>{t('bankColDueDate')}</th>
                        <th style={thStyle}>{t('bankColEmi')}</th>
                        <th style={thStyle}>{t('bankColOutstanding')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(schedules[loan.applicationId] || []).map((e) => (
                        <tr key={e.installmentNo}>
                          <td style={tdStyle}>{e.installmentNo}</td>
                          <td style={tdStyle}>{e.dueDate}</td>
                          <td style={tdStyle}>{rupeesFromAmount(e.emi)}</td>
                          <td style={tdStyle}>{rupeesFromAmount(e.outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (embedded) return content;
  return <ToolShell toolId="loanTracking">{content}</ToolShell>;
}

function statusBadge(status: string): CSSProperties {
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

function stageChip(reached: boolean): CSSProperties {
  return {
    padding: '0.25rem 0.6rem',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: reached ? '#fff' : '#94a3b8',
    background: reached ? '#2563eb' : '#f1f5f9',
  };
}

const chipStyle: CSSProperties = {
  padding: '0.15rem 0.5rem',
  borderRadius: '6px',
  fontSize: '0.78rem',
  fontWeight: 700,
  background: '#f1f5f9',
  color: '#334155',
  letterSpacing: '0.02em',
};
const linkBtn: CSSProperties = { background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', padding: 0, fontWeight: 600 };
const thStyle: CSSProperties = { textAlign: 'left', padding: '0.35rem 0.5rem', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 };
const tdStyle: CSSProperties = { padding: '0.4rem 0.5rem', borderTop: '1px solid #f1f5f9' };
