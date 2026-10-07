import { useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { applyLoan } from '../../lib/api/finance';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';

/**
 * Loan application wizard (F17, task 5.23) — a 2-step form (amount + tenure →
 * purpose + review) posting to `POST /finance/loans/apply`. `client.ts` attaches
 * the `Idempotency-Key` on the write (rule 7). This is the farmer mirror of the
 * phase-03 bank console — it consumes the existing endpoints only.
 */
export default function LoanWizardPage() {
  const t = useT();
  const user = useSessionStore((s) => s.user);

  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const amountRupees = Number(amount);
  const months = Math.floor(Number(tenure));
  const stepOneValid = amountRupees > 0 && months > 0;

  const submit = async () => {
    if (!stepOneValid || !purpose.trim()) {
      toast(t('financeWizardInvalid'), { error: true });
      return;
    }
    setBusy(true);
    try {
      const res = await applyLoan({
        amount: amountRupees,
        tenureMonths: months,
        purpose: purpose.trim(),
        ...(typeof user?.district === 'string' ? { district: user.district } : {}),
      });
      setApplicationId(res.applicationId);
      toast(t('financeWizardSuccess'));
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        toast(Object.values(e.fieldErrors)[0], { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  if (applicationId) {
    return (
      <ToolShell toolId="loanWizard" backTo="/dashboard/p/finance">
        <div className="trade-card">
          <span className="trade-card-title">✅ {t('financeWizardSuccess')}</span>
          <span className="trade-card-sub">{t('financeStatusApplication')}: {applicationId}</span>
          <div className="trade-actions">
            <Link className="av-btn av-btn-primary" to="/dashboard/p/loanStatus">
              {t('financeWizardViewStatus')}
            </Link>
          </div>
        </div>
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="loanWizard" backTo="/dashboard/p/finance">
      <p className="trade-section-title">📝 {t('financeWizardTitle')}</p>
      <p className="trade-hint">{t('financeWizardIntro')}</p>

      {step === 0 ? (
        <>
          <div className="av-field">
            <label className="av-label">{t('financeWizardAmount')}</label>
            <input
              className="av-input"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="av-field">
            <label className="av-label">{t('financeWizardTenure')}</label>
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
              disabled={!stepOneValid}
              onClick={() => setStep(1)}
            >
              {t('financeWizardTenure')} →
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="trade-card">
            <span className="trade-card-sub">
              {t('financeWizardAmount')}: {inr(amountRupees)}
            </span>
            <span className="trade-card-sub">
              {t('financeWizardTenure')}: {months}
            </span>
          </div>
          <div className="av-field">
            <label className="av-label">{t('financeWizardPurpose')}</label>
            <input
              className="av-input"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
            />
          </div>
          <div className="trade-actions">
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setStep(0)}>
              ← {t('financeWizardAmount')}
            </button>
            <button
              type="button"
              className="av-btn av-btn-primary"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? <span className="av-spinner" /> : t('financeWizardSubmit')}
            </button>
          </div>
        </>
      )}
    </ToolShell>
  );
}
