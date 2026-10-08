import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MpinPad from '../../components/MpinPad';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { deleteAccount } from '../../lib/api/users';
import { useT } from '../../lib/i18n';
import { useOnboardingStore } from '../../stores/onboarding';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';

type Step = 'consequences' | 'reauth' | 'done';

/**
 * Verified account-deletion flow (WS-04): consequences → MPIN re-auth → delete
 * → logged-out landing. No confirm()/alert().
 */
export default function DeleteAccountPage() {
  const t = useT();
  const navigate = useNavigate();
  const clearSession = useSessionStore((s) => s.clear);
  const resetWizard = useOnboardingStore((s) => s.resetWizard);

  const [step, setStep] = useState<Step>('consequences');
  const [mpin, setMpin] = useState('');
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (mpin.length !== 4) return;
    setBusy(true);
    try {
      await deleteAccount(mpin);
      clearSession();
      resetWizard();
      setStep('done');
      navigate('/auth');
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <ToolShell toolId="settings" backTo="/">
        <p className="trade-hint">{t('delete.done')}</p>
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="settings" backTo="/dashboard">
      <h2 className="trade-card-title">{t('delete.title')}</h2>

      {step === 'consequences' ? (
        <>
          <div className="trade-card" style={{ cursor: 'default' }}>
            <p className="trade-card-sub">{t('delete.consequences')}</p>
          </div>
          <button type="button" className="av-btn av-btn-primary" onClick={() => setStep('reauth')}>
            {t('delete.confirm')}
          </button>
        </>
      ) : (
        <>
          <p className="trade-hint">{t('delete.reauth')}</p>
          <MpinPad value={mpin} onChange={setMpin} label={t('delete.reauth')} disabled={busy} />
          <button
            type="button"
            className="av-btn av-btn-plain"
            style={{ background: 'var(--av-error)' }}
            disabled={busy || mpin.length !== 4}
            onClick={() => void confirmDelete()}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('delete.confirm')}
          </button>
        </>
      )}
    </ToolShell>
  );
}
