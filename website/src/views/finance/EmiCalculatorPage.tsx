import { useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { computeEmiPaisa } from '../../lib/api/finance';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * EMI calculator (task 5.22) — reducing-balance EMI computed client-side from the
 * user's own inputs only (principal, annual rate, tenure), per the standard
 * formula. Pure arithmetic on input, never a data fallback.
 */
export default function EmiCalculatorPage() {
  const t = useT();
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [tenure, setTenure] = useState('');

  const principalPaisa = Math.round(Number(principal) * 100);
  const ratePct = Number(rate);
  const months = Math.floor(Number(tenure));
  const valid = principalPaisa > 0 && ratePct > 0 && months > 0;
  const emiPaisa = valid ? computeEmiPaisa(principalPaisa, ratePct, months) : 0;
  const totalPayablePaisa = valid ? emiPaisa * months : 0;
  const totalInterestPaisa = valid ? totalPayablePaisa - principalPaisa : 0;

  return (
    <ToolShell toolId="emiCalculator" backTo="/dashboard/p/finance">
      <p className="trade-section-title">🧮 {t('financeEmiTitle')}</p>

      <div className="av-field">
        <label className="av-label">{t('financeEmiPrincipal')}</label>
        <input
          className="av-input"
          type="number"
          inputMode="decimal"
          value={principal}
          onChange={(event) => setPrincipal(event.target.value)}
        />
      </div>
      <div className="av-field">
        <label className="av-label">{t('financeEmiRate')}</label>
        <input
          className="av-input"
          type="number"
          inputMode="decimal"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
        />
      </div>
      <div className="av-field">
        <label className="av-label">{t('financeEmiTenure')}</label>
        <input
          className="av-input"
          type="number"
          inputMode="numeric"
          value={tenure}
          onChange={(event) => setTenure(event.target.value)}
        />
      </div>

      <div className="trade-actions">
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => {
            if (!valid) toast(t('financeEmiInvalid'), { error: true });
          }}
        >
          {t('financeEmiTitle')}
        </button>
      </div>

      {valid ? (
        <div className="trade-card">
          <span className="trade-card-title">{t('financeEmiResult')}</span>
          <span className="trade-card-amount">
            {t('financeEmiMonthly')}: {inr(emiPaisa / 100)}
          </span>
          <span className="trade-card-sub">
            {t('financeEmiTotalInterest')}: {inr(totalInterestPaisa / 100)}
          </span>
          <span className="trade-card-sub">
            {t('financeEmiTotalPayable')}: {inr(totalPayablePaisa / 100)}
          </span>
        </div>
      ) : null}
    </ToolShell>
  );
}
