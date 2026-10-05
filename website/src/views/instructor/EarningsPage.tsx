import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { fetchEarningsLedger, type InstructorEarningsLedger } from '../../lib/api/instructorAcademy';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/** Format integer paisa as ₹ with 2 decimals (client-side only). */
function formatPaisa(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Earnings (WS-02 task 2.7) — binds GET /v1/teachers/earnings (integer paisa):
 * fees collected − commission = payout, a course-wise breakdown, the next
 * payout date and an onHold notice when the bank account is unverified. No
 * money movement happens in this UI (global rule 3).
 */
export default function EarningsPage() {
  const t = useT();
  const [ledger, setLedger] = useState<InstructorEarningsLedger | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchEarningsLedger()
      .then(setLedger)
      .catch(() => {
        setLedger(null);
        setFailed(true);
        toast(t('instructorLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ToolShell toolId="earnings">
      <section className="dash-section">
        <h3>{t('instructorEarnings')}</h3>
        {failed ? (
          <p className="dash-empty-line">{t('instructorLoadFailed')}</p>
        ) : ledger === null ? (
          <p className="dash-empty-line">{t('instructorLoading')}</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <div style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{t('instructorGrossPaisa')}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{formatPaisa(ledger.grossPaisa)}</div>
              </div>
              <div style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {t('instructorCommissionPaisa')} ({ledger.commissionPct}%)
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#B91C1C' }}>
                  −{formatPaisa(ledger.commissionPaisa)}
                </div>
              </div>
              <div style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{t('instructorNetPaisa')}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#166534' }}>{formatPaisa(ledger.netPaisa)}</div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 13, color: '#6B7280' }}>
              {t('instructorNextPayout')}: {ledger.nextPayoutDate}
            </div>
            {ledger.onHold ? (
              <div style={{ marginTop: 8, padding: 8, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, fontSize: 13 }}>
                ⚠️ {t('instructorOnHold')}
              </div>
            ) : null}

            <h4 style={{ marginTop: 16 }}>{t('instructorByCourse')}</h4>
            {ledger.byCourse.length === 0 ? (
              <p className="dash-empty-line">💰 {t('instructorNoEarnings')}</p>
            ) : (
              ledger.byCourse.map((row) => (
                <div key={row.courseId} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 14 }}>
                  <span>{row.courseTitle}</span>
                  <span>
                    {formatPaisa(row.grossPaisa)} → {formatPaisa(row.netPaisa)}
                  </span>
                </div>
              ))
            )}
          </>
        )}
      </section>
    </ToolShell>
  );
}
