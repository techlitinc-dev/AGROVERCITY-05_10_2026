import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { isApiError } from '../../lib/api/client';
import {
  getLoanSchedule,
  getMyLoans,
  type Loan,
  type LoanScheduleEntry,
} from '../../lib/api/finance';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Loan status tracker (F17, task 5.23) — the farmer's applications with their
 * current status and full timeline (statusText arrives from the backend), plus
 * the computed EMI schedule for the selected application. Farmer mirror of the
 * phase-03 console; consumes existing endpoints only.
 */
export default function LoanStatusPage() {
  const t = useT();
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<LoanScheduleEntry[] | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    getMyLoans()
      .then((rows) => {
        setLoans(rows);
        setSelected(rows[0]?.applicationId ?? null);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!selected) {
      setSchedule(null);
      return;
    }
    getLoanSchedule(selected)
      .then(setSchedule)
      .catch((e) => {
        if (!(isApiError(e) && e.status === 404)) setSchedule(null);
      });
  }, [selected]);

  const current = (loans ?? []).find((loan) => loan.applicationId === selected) ?? null;

  return (
    <ToolShell toolId="loanStatus" backTo="/dashboard/p/finance">
      <p className="trade-section-title">🧮 {t('financeStatusTitle')}</p>

      {failed ? (
        <div className="trade-card">
          <span className="trade-card-sub">📡 {t('financeLoadFailed')}</span>
          <div className="trade-actions">
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          </div>
        </div>
      ) : null}

      {loans !== null && loans.length === 0 ? (
        <div className="trade-card">
          <span className="trade-card-title">{t('financeStatusEmpty')}</span>
          <span className="trade-card-sub">{t('financeStatusEmptyBody')}</span>
        </div>
      ) : null}

      {loans?.map((loan) => (
        <button
          key={loan.applicationId}
          type="button"
          className="trade-card"
          style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
          onClick={() => setSelected(loan.applicationId)}
        >
          <div className="trade-card-row">
            <span className="trade-card-title">
              {loan.applicationNumber ?? loan.applicationId}
            </span>
            <span className="trade-card-sub">{loan.status}</span>
          </div>
          <span className="trade-card-sub">
            {t('financeOfferAmount')}: {inr(loan.sanctionedAmount ?? loan.amount)}
          </span>
        </button>
      ))}

      {current ? (
        <div className="trade-card">
          <span className="trade-card-title">{t('financeStatusTimeline')}</span>
          {current.timeline.map((entry, index) => (
            <span className="trade-card-sub" key={`${entry.status}-${index}`}>
              • {entry.statusText || entry.status} — {entry.at}
            </span>
          ))}
          {schedule && schedule.length > 0 ? (
            <>
              <span className="trade-card-title">{t('financeEmiMonthly')}</span>
              {schedule.map((row) => (
                <span className="trade-card-sub" key={row.installmentNo}>
                  {row.installmentNo}. {row.dueDate} — {inr(row.emi)}
                </span>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </ToolShell>
  );
}
