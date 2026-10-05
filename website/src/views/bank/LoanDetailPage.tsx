import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import {
  approveLoan,
  disburseLoan,
  getLoan,
  getLoanFarmer360,
  getSchedule,
  rejectLoan,
  requestInfo,
  reviewLoan,
  type Loan,
  type LoanFarmer360,
  type LoanScheduleEntry,
} from '../../lib/api/loans';
import { useT } from '../../lib/i18n';
import AiBadges from './AiBadges';
import { rupeesFromAmount } from './money';

type ActionKind = 'approve' | 'reject' | 'info' | 'disburse' | null;

/**
 * CreditDesk loan detail — farmer-360 (task 3.5) + decision action bar and EMI
 * schedule (task 3.8) + AI annotation badges (task 3.17). Every decision
 * requires a typed reason/note before it can be submitted; disbursal uses a
 * two-click inline confirm (no `confirm()`).
 */
export default function LoanDetailPage() {
  const t = useT();
  const { applicationId = '' } = useParams();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [farmer, setFarmer] = useState<LoanFarmer360 | null>(null);
  const [schedule, setSchedule] = useState<LoanScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionKind>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDisburse, setConfirmDisburse] = useState(false);

  const [reason, setReason] = useState('');
  const [sanctionedAmount, setSanctionedAmount] = useState('');
  const [interestRate, setInterestRate] = useState('12');
  const [tenureMonths, setTenureMonths] = useState('');
  const [disbursementRef, setDisbursementRef] = useState('');

  const reload = async () => {
    const loanData = await getLoan(applicationId);
    setLoan(loanData);
    if (loanData.status === 'approved' || loanData.status === 'disbursed') {
      setSchedule(await getSchedule(applicationId));
    } else {
      setSchedule([]);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([getLoan(applicationId), getLoanFarmer360(applicationId)])
      .then(async ([loanData, farmerData]) => {
        if (!mounted) return;
        setLoan(loanData);
        setFarmer(farmerData);
        setTenureMonths(String(loanData.tenureMonths || ''));
        setSanctionedAmount(String(loanData.amount || ''));
        if (loanData.status === 'approved' || loanData.status === 'disbursed') {
          setSchedule(await getSchedule(applicationId));
        }
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
  }, [applicationId, t]);

  const show = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? t('bankNotAvailable') : String(value);

  const resetForm = () => {
    setReason('');
    setActionError(null);
    setConfirmDisburse(false);
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await reload();
      setAction(null);
      resetForm();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setActionError(message || t('bankActionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const submitApprove = () => {
    if (!loan || reason.trim().length === 0) return;
    void run(() =>
      approveLoan(loan.applicationId, {
        sanctionedAmount: Number(sanctionedAmount),
        interestRate: Number(interestRate),
        tenureMonths: Number(tenureMonths),
        reason: reason.trim(),
      }),
    );
  };

  const submitReject = () => {
    if (!loan || reason.trim().length === 0) return;
    void run(() => rejectLoan(loan.applicationId, { reason: reason.trim() }));
  };

  const submitInfo = () => {
    if (!loan || reason.trim().length === 0) return;
    void run(() => requestInfo(loan.applicationId, { note: reason.trim() }));
  };

  const submitDisburse = () => {
    if (!loan || disbursementRef.trim().length === 0) return;
    if (!confirmDisburse) {
      setConfirmDisburse(true);
      return;
    }
    void run(() => disburseLoan(loan.applicationId, { disbursementRef: disbursementRef.trim() }));
  };

  const reasonMissing = reason.trim().length === 0;

  const content = (
    <div className="bank-detail" style={{ padding: '1rem', maxWidth: '1000px', margin: '0 auto' }}>
      <Link className="av-link" to="/dashboard/p/loanReview">
        ← {t('bankBackToQueue')}
      </Link>

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>{t('bankLoading')}</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginTop: '1rem' }}>{error}</div>
      )}

      {loan && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.75rem 0' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
              {loan.applicationNumber || loan.applicationId.slice(0, 8)}
            </h2>
            <span style={badge('#334155', '#e2e8f0')}>{t(`bank_status_${loan.status}`)}</span>
            <AiBadges ai={loan.ai} />
          </div>

          <div className="trade-card" style={{ padding: '1rem', marginBottom: '0.9rem' }}>
            <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.98rem', fontWeight: 700 }}>{t('bankActionBarTitle')}</h3>
            {actionError && (
              <div style={{ padding: '0.6rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '0.6rem', fontSize: '0.85rem' }}>
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {loan.status === 'submitted' && (
                <button type="button" disabled={busy} style={primaryBtn(busy)} onClick={() => void run(() => reviewLoan(loan.applicationId))}>
                  {t('bankActionReview')}
                </button>
              )}
              {loan.status === 'underReview' && (
                <>
                  <button type="button" style={btn(action === 'approve', '#15803d')} onClick={() => { setAction('approve'); resetForm(); }}>
                    {t('bankActionApprove')}
                  </button>
                  <button type="button" style={btn(action === 'reject', '#b91c1c')} onClick={() => { setAction('reject'); resetForm(); }}>
                    {t('bankActionReject')}
                  </button>
                  <button type="button" style={btn(action === 'info', '#6d28d9')} onClick={() => { setAction('info'); resetForm(); }}>
                    {t('bankActionRequestInfo')}
                  </button>
                </>
              )}
              {loan.status === 'approved' && (
                <button type="button" style={btn(action === 'disburse', '#0d9488')} onClick={() => { setAction('disburse'); resetForm(); }}>
                  {t('bankActionDisburse')}
                </button>
              )}
            </div>

            {action === 'approve' && (
              <div style={formBox}>
                <label style={labelStyle}>
                  {t('bankFieldSanctioned')}
                  <input value={sanctionedAmount} inputMode="numeric" onChange={(e) => setSanctionedAmount(e.target.value)} style={input} />
                </label>
                <label style={labelStyle}>
                  {t('bankFieldInterestRate')}
                  <input value={interestRate} inputMode="decimal" onChange={(e) => setInterestRate(e.target.value)} style={input} />
                </label>
                <label style={labelStyle}>
                  {t('bankFieldTenure')}
                  <input value={tenureMonths} inputMode="numeric" onChange={(e) => setTenureMonths(e.target.value)} style={input} />
                </label>
                <label style={{ ...labelStyle, flexBasis: '100%' }}>
                  {t('bankFieldReason')}
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...input, minHeight: 60 }} />
                </label>
                <button type="button" disabled={busy || reasonMissing} style={primaryBtn(busy || reasonMissing)} onClick={submitApprove}>
                  {t('bankSubmitApprove')}
                </button>
              </div>
            )}

            {action === 'reject' && (
              <div style={formBox}>
                <label style={{ ...labelStyle, flexBasis: '100%' }}>
                  {t('bankFieldRejectReason')}
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...input, minHeight: 60 }} />
                </label>
                <button type="button" disabled={busy || reasonMissing} style={primaryBtn(busy || reasonMissing)} onClick={submitReject}>
                  {t('bankSubmitReject')}
                </button>
              </div>
            )}

            {action === 'info' && (
              <div style={formBox}>
                <label style={{ ...labelStyle, flexBasis: '100%' }}>
                  {t('bankFieldInfoNote')}
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...input, minHeight: 60 }} />
                </label>
                <button type="button" disabled={busy || reasonMissing} style={primaryBtn(busy || reasonMissing)} onClick={submitInfo}>
                  {t('bankSubmitInfo')}
                </button>
              </div>
            )}

            {action === 'disburse' && (
              <div style={formBox}>
                <label style={{ ...labelStyle, flexBasis: '100%' }}>
                  {t('bankFieldDisbursementRef')}
                  <input value={disbursementRef} onChange={(e) => setDisbursementRef(e.target.value)} style={input} />
                </label>
                <button
                  type="button"
                  disabled={busy || disbursementRef.trim().length === 0}
                  style={primaryBtn(busy || disbursementRef.trim().length === 0)}
                  onClick={submitDisburse}
                >
                  {confirmDisburse ? t('bankConfirmDisburse') : t('bankActionDisburse')}
                </button>
                {confirmDisburse && <span style={{ fontSize: '0.8rem', color: '#b45309' }}>{t('bankConfirmDisburseHint')}</span>}
              </div>
            )}
          </div>

          {loan.status === 'rejected' && (
            <div className="trade-card" style={{ padding: '1rem', marginBottom: '0.9rem', background: '#fef2f2' }}>
              <span style={{ color: '#b91c1c', fontWeight: 600 }}>{t('bankFieldRejectReason')}: </span>
              <span>{show(loan.rejectionReason)}</span>
            </div>
          )}

          <Section title={t('bankSectionLoan')}>
            <Row label={t('bankColAmount')} value={rupeesFromAmount(loan.amount)} />
            <Row label={t('bankFieldPurpose')} value={show(loan.purpose)} />
            <Row label={t('bankFieldTenure')} value={show(loan.tenureMonths)} />
            <Row label={t('bankFieldCreated')} value={show(loan.createdAt)} />
            {loan.sanctionedAmount !== null && loan.sanctionedAmount !== undefined && (
              <Row label={t('bankFieldSanctioned')} value={rupeesFromAmount(loan.sanctionedAmount)} />
            )}
          </Section>

          {schedule.length > 0 && (
            <Section title={t('bankSectionEmiSchedule')}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>{t('bankColInstallment')}</th>
                    <th style={thStyle}>{t('bankColDueDate')}</th>
                    <th style={thStyle}>{t('bankColEmi')}</th>
                    <th style={thStyle}>{t('bankColPrincipal')}</th>
                    <th style={thStyle}>{t('bankColInterest')}</th>
                    <th style={thStyle}>{t('bankColOutstanding')}</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((e) => (
                    <tr key={e.installmentNo}>
                      <td style={tdStyle}>{e.installmentNo}</td>
                      <td style={tdStyle}>{e.dueDate}</td>
                      <td style={tdStyle}>{rupeesFromAmount(e.emi)}</td>
                      <td style={tdStyle}>{rupeesFromAmount(e.principal)}</td>
                      <td style={tdStyle}>{rupeesFromAmount(e.interest)}</td>
                      <td style={tdStyle}>{rupeesFromAmount(e.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {farmer && (
            <Section title={t('bankSectionProfile')}>
              <Row label={t('bankFieldName')} value={show(farmer.profile.name)} />
              <Row label={t('bankFieldPhone')} value={show(farmer.profile.phone)} />
              <Row label={t('bankFieldVillage')} value={show(farmer.profile.village)} />
              <Row label={t('bankFieldDistrict')} value={show(farmer.profile.district)} />
            </Section>
          )}

          {farmer && (
            <Section title={t('bankSectionCredit')}>
              <Row label={t('bankFieldCreditScore')} value={show(farmer.credit.kisanCreditScore)} />
              <Row label={t('bankFieldCreditTier')} value={show(farmer.credit.creditTier)} />
              <Row label={t('bankFieldLand')} value={show(farmer.landCrop.landHoldingAcres)} />
              <Row
                label={t('bankFieldCrops')}
                value={farmer.landCrop.primaryCrops.length ? farmer.landCrop.primaryCrops.join(', ') : t('bankNotAvailable')}
              />
            </Section>
          )}

          {farmer && (
            <Section title={t('bankSectionKcc')}>
              {farmer.kcc ? (
                <>
                  <Row label={t('bankFieldBank')} value={show(farmer.kcc.bankName)} />
                  <Row label={t('bankFieldCardMasked')} value={show(farmer.kcc.cardNumberMasked)} />
                  <Row label={t('bankFieldKccLimit')} value={rupeesFromAmount(farmer.kcc.kccLimit)} />
                  <Row label={t('bankFieldKccAvailable')} value={rupeesFromAmount(farmer.kcc.availableLimit)} />
                </>
              ) : (
                <p style={{ color: '#6b7280', margin: 0 }}>{t('bankKccNone')}</p>
              )}
            </Section>
          )}

          {farmer && (
            <Section title={t('bankSectionRepayment')}>
              {farmer.repaymentHistory.length === 0 ? (
                <p style={{ color: '#6b7280', margin: 0 }}>{t('bankRepaymentEmpty')}</p>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t('bankColApplication')}</th>
                      <th style={thStyle}>{t('bankColAmount')}</th>
                      <th style={thStyle}>{t('bankColStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmer.repaymentHistory.map((h) => (
                      <tr key={h.applicationId}>
                        <td style={tdStyle}>{h.applicationNumber || h.applicationId.slice(0, 8)}</td>
                        <td style={tdStyle}>{rupeesFromAmount(h.amount)}</td>
                        <td style={tdStyle}>{t(`bank_status_${h.status}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          )}

          <Section title={t('bankSectionDocuments')}>
            {loan.documents.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>{t('bankDocumentsEmpty')}</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {loan.documents.map((doc) => (
                  <li key={doc.documentId} style={{ marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>{doc.name}</span>
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}> · {doc.uploadedAt}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );

  return <ToolShell toolId="loanReview">{content}</ToolShell>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="trade-card" style={{ padding: '1rem', marginTop: '0.9rem' }}>
      <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.98rem', fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.28rem 0', borderBottom: '1px solid #f8fafc', fontSize: '0.9rem' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function badge(color: string, background: string): CSSProperties {
  return { padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, color, background };
}

function btn(active: boolean, color: string): CSSProperties {
  return {
    padding: '0.45rem 0.9rem',
    borderRadius: '6px',
    border: `1px solid ${color}`,
    background: active ? color : '#fff',
    color: active ? '#fff' : color,
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  };
}

function primaryBtn(disabled: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: 'none',
    background: disabled ? '#cbd5e1' : '#2563eb',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const formBox: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.75rem', alignItems: 'flex-end' };
const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', color: '#6b7280', flexBasis: '30%' };
const input: CSSProperties = { padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const thStyle: CSSProperties = { textAlign: 'left', padding: '0.4rem 0.5rem', color: '#6b7280', fontSize: '0.78rem', fontWeight: 600 };
const tdStyle: CSSProperties = { padding: '0.45rem 0.5rem', borderTop: '1px solid #f1f5f9' };
