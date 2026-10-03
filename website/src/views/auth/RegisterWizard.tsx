import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { useT } from '../../lib/i18n';
import { useOnboardingStore } from '../../stores/onboarding';
import Step1Identity from './steps/Step1Identity';
import Step2Security from './steps/Step2Security';
import '../../theme/views.css';

interface RegisterWizardProps {
  /**
   * true when mounted inside AuthView (which already renders the shared
   * reCAPTCHA container at its root); standalone route renders its own.
   */
  embedded?: boolean;
  /** Optional content rendered above the steps (e.g. the Login/Register tabs). */
  header?: ReactNode;
}

const STEP_LABEL_KEYS = ['yourDetails', 'securityMpin'] as const;

/**
 * Register wizard — step 1 of the journey (Account): Identity & Contact
 * (name, state, phone + Firebase OTP, referral) → Security MPIN.
 * The account is created later: after language and profile selection, the
 * "Farm & Profile Details" step submits POST /auth/register with everything.
 */
export default function RegisterWizard({ embedded = false, header }: RegisterWizardProps) {
  const t = useT();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const updateWizard = useOnboardingStore((s) => s.updateWizard);

  const steps = (
    <>
      {step === 1 ? <Step1Identity onNext={() => setStep(2)} /> : null}

      {step === 2 ? (
        <Step2Security
          onBack={() => setStep(1)}
          onNext={(pin) => {
            updateWizard({ mpin: pin });
            navigate('/onboarding/language');
          }}
        />
      ) : null}
    </>
  );

  const split = (
    <div className="wiz-split">
      <aside className="wiz-side">
        {STEP_LABEL_KEYS.map((key, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'active' : '';
          return (
            <div key={key} className={`wiz-vstep ${state}`}>
              <span className="wiz-vstep-circle">{n < step ? '✓' : n}</span>
              <span className="wiz-vstep-title">{t(key)}</span>
            </div>
          );
        })}
      </aside>
      <div className="wiz-main">
        <div className="wiz-formcol">
          {header}
          <div className="wizard-segments">
            {STEP_LABEL_KEYS.map((_, i) => (
              <div key={i} className={`wizard-segment${i < step ? ' filled' : ''}`} />
            ))}
          </div>
          <div className="wizard-step-labels">
            {STEP_LABEL_KEYS.map((key, i) => (
              <span key={key} className={i + 1 === step ? 'active' : ''}>
                {t(key)}
              </span>
            ))}
          </div>
          {steps}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {split}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader step={1} />
      <div id="recaptcha-container" />
      {split}
      <div className="av-chrome-footer">
        <SiteFooter />
      </div>
    </div>
  );
}
