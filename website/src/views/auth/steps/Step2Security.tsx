import { useState } from 'react';
import MpinPad from '../../../components/MpinPad';
import { useT } from '../../../lib/i18n';

interface Step2SecurityProps {
  onBack: () => void;
  onNext: (mpin: string) => void;
}

/** Wizard step 2 — set + re-enter 4-digit MPIN with live match feedback. */
export default function Step2Security({ onBack, onNext }: Step2SecurityProps) {
  const t = useT();
  const [mpin, setMpin] = useState('');
  const [confirm, setConfirm] = useState('');

  const match = mpin.length === 4 && confirm.length === 4 && mpin === confirm;

  const handleContinue = () => {
    if (!match) return;
    onNext(mpin);
  };

  return (
    <div>
      <h1 className="av-page-title">{t('securityMpin')}</h1>
      <p className="av-page-subtitle" style={{ marginBottom: 16 }}>
        {t('fourDigitMpin')}
      </p>

      <MpinPad label={t('mpinFourDigits')} value={mpin} onChange={setMpin} />
      <MpinPad
        label={t('reEnterMpin')}
        value={confirm}
        onChange={setConfirm}
        error={confirm.length === 4 && !match}
      />
      {confirm.length === 4 ? (
        <p className={`mpin-match-text ${match ? 'ok' : 'bad'}`}>
          {match ? t('mpinMatched') : t('mpinNotMatched')}
        </p>
      ) : null}

      <div className="wizard-actions">
        <button type="button" className="av-btn av-btn-ghost back-btn" onClick={onBack}>
          {t('back')}
        </button>
        <button type="button" className="av-btn av-btn-primary" disabled={!match} onClick={handleContinue}>
          {t('continue')}
        </button>
      </div>
    </div>
  );
}
