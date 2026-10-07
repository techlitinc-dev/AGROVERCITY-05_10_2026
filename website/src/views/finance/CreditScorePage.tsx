import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { isApiError } from '../../lib/api/client';
import { getCreditScore, getKcc, type CreditScore, type Kcc } from '../../lib/api/finance';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Kisan Credit Score page (task 5.20) — score, tier, limit and improvement
 * factors, straight from `/finance/credit-score`, plus the KCC visual card.
 * Honest empty states only (no invented numbers — rule 1).
 */
export default function CreditScorePage() {
  const t = useT();
  const [score, setScore] = useState<CreditScore | null>(null);
  const [kcc, setKcc] = useState<Kcc | null>(null);
  const [kccMissing, setKccMissing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getCreditScore()
      .then(setScore)
      .catch(() => setFailed(true));
    getKcc()
      .then(setKcc)
      .catch((e) => {
        if (isApiError(e) && e.code === 'KCC_NOT_FOUND') setKccMissing(true);
      });
  }, []);

  useEffect(load, [load]);

  return (
    <ToolShell toolId="finance" backTo="/dashboard">
      <p className="trade-section-title">💳 {t('financeCreditTitle')}</p>

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

      {score ? (
        <div className="trade-card">
          <span className="trade-card-title">
            {t('financeScoreLabel')}: {score.kisanCreditScore}
          </span>
          <span className="trade-card-sub">
            {t('financeTierLabel')}: {score.creditTier}
          </span>
          <span className="trade-card-sub">
            {t('financeLimitLabel')}: {inr(score.creditLimit)}
          </span>
          <span className="trade-card-sub">
            {t('financeFactors')}: {score.factors.join(' · ')}
          </span>
        </div>
      ) : !failed ? (
        <div className="trade-card">
          <span className="trade-card-title">{t('financeNoScore')}</span>
          <span className="trade-card-sub">{t('financeNoScoreBody')}</span>
        </div>
      ) : null}

      <div className="trade-card">
        <span className="trade-card-title">🏦 {t('financeKccTitle')}</span>
        {kcc ? (
          <>
            <span className="trade-card-sub">
              {t('financeKccBank')}: {kcc.bankName}
            </span>
            <span className="trade-card-sub">
              {t('financeKccCard')}: {kcc.cardNumberMasked}
            </span>
            <span className="trade-card-sub">
              {t('financeKccLimit')}: {inr(kcc.kccLimit)}
            </span>
            <span className="trade-card-sub">
              {t('financeKccAvailable')}: {inr(kcc.availableLimit)}
            </span>
          </>
        ) : kccMissing ? (
          <>
            <span className="trade-card-sub">{t('financeKccNotLinked')}</span>
            <span className="trade-card-sub">{t('financeKccNotLinkedBody')}</span>
          </>
        ) : null}
      </div>

      <div className="trade-actions">
        <Link className="av-btn" to="/dashboard/p/loanMarketplace">
          {t('financeMarketTitle')}
        </Link>
        <Link className="av-btn" to="/dashboard/p/emiCalculator">
          {t('financeEmiTitle')}
        </Link>
        <Link className="av-btn av-btn-primary" to="/dashboard/p/loanWizard">
          {t('financeWizardTitle')}
        </Link>
      </div>
    </ToolShell>
  );
}
