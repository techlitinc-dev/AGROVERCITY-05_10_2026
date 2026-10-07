import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { buildOfferRows, getMyLoans, type LoanOfferRow } from '../../lib/api/finance';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Loan marketplace / comparison (task 5.21). There is no separate partner-offers
 * endpoint, so this compares the farmer's own loan applications' real terms
 * (amount, rate, tenure) with an EMI computed from those terms — never invented
 * rates (rule 1). All money is displayed from integer paisa / server rupees.
 */
export default function LoanMarketplacePage() {
  const t = useT();
  const [rows, setRows] = useState<LoanOfferRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getMyLoans()
      .then((loans) => setRows(buildOfferRows(loans)))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  return (
    <ToolShell toolId="loanMarketplace" backTo="/dashboard/p/finance">
      <p className="trade-section-title">⚖️ {t('financeMarketTitle')}</p>
      <p className="trade-hint">{t('financeMarketIntro')}</p>

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

      {rows !== null && rows.length === 0 ? (
        <div className="trade-card">
          <span className="trade-card-title">{t('financeMarketEmpty')}</span>
          <span className="trade-card-sub">{t('financeMarketEmptyBody')}</span>
          <div className="trade-actions">
            <Link className="av-btn av-btn-primary" to="/dashboard/p/loanWizard">
              {t('financeWizardTitle')}
            </Link>
          </div>
        </div>
      ) : null}

      {rows?.map((row) => (
        <div className="trade-card" key={row.applicationId}>
          <div className="trade-card-row">
            <span className="trade-card-title">{row.label}</span>
            <span className="trade-card-sub">{row.status}</span>
          </div>
          <span className="trade-card-sub">
            {t('financeOfferAmount')}: {inr(row.amountRupees)}
          </span>
          <span className="trade-card-sub">
            {t('financeOfferRate')}: {row.interestRate}%
          </span>
          <span className="trade-card-sub">
            {t('financeOfferTenure')}: {row.tenureMonths}
          </span>
          <span className="trade-card-amount">
            {t('financeOfferEmi')}: {row.emiPaisa > 0 ? inr(row.emiPaisa / 100) : '—'}
          </span>
        </div>
      ))}
    </ToolShell>
  );
}
