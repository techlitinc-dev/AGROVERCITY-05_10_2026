import { useState } from 'react';
import { Link } from 'react-router-dom';
import SegmentedControl from '../../components/SegmentedControl';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { useT } from '../../lib/i18n';
import { useOnboardingStore } from '../../stores/onboarding';
import { useSessionStore } from '../../stores/session';
import LoginForm from './LoginForm';
import MpinReentrySheet from './MpinReentrySheet';
import RegisterWizard from './RegisterWizard';
import '../../theme/views.css';

/**
 * Step 3/4 — Login (phone → MPIN) or Register wizard.
 * >=1024px: split screen with a dark green value-prop panel on the left.
 * <1024px: the panel collapses to a compact top banner.
 * The reCAPTCHA container for Firebase phone OTP is rendered once at the root.
 *
 * Note: the /register route in App.tsx is guarded on wizard.otpVerified, which is
 * only set inside the wizard itself — so a brand-new user can never reach it by
 * navigation. The register segment therefore mounts <RegisterWizard /> inline
 * (same as the mobile app's segmented AuthView); the standalone /register route
 * still serves refresh-resume once otpVerified is persisted.
 */
export default function AuthView() {
  const t = useT();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const updateWizard = useOnboardingStore((s) => s.updateWizard);
  const mpinReentryRequired = useSessionStore((s) => s.mpinReentryRequired);
  const [reentryParam] = useState(
    () => new URLSearchParams(window.location.search).get('reentry') === 'mpin'
  );

  const openRegister = (phoneE164?: string) => {
    if (phoneE164) {
      updateWizard({ phone: phoneE164 });
    }
    setMode('register');
  };

  if (mpinReentryRequired || reentryParam) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100dvh' }}>
        <div id="recaptcha-container" />
        <SiteHeader step={1} />
        <MpinReentrySheet />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100dvh' }}>
      <div id="recaptcha-container" />
      <SiteHeader step={1} />

      <div className="auth-banner">
        <div className="auth-banner-tile">🌾</div>
        <div>
          <p className="auth-banner-name">{t('appName')}</p>
          <p className="auth-banner-sub">{t('digitalAgriPlatform')}</p>
        </div>
      </div>

      {mode === 'register' ? (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <RegisterWizard
            embedded
            header={
              <div className="wiz-header-tabs">
                <SegmentedControl
                  options={[
                    { value: 'login', label: t('login') },
                    { value: 'register', label: t('register') },
                  ]}
                  value={mode}
                  onChange={(value) => setMode(value)}
                />
              </div>
            }
          />
        </main>
      ) : (
        <div className="auth-split">
          <aside className="auth-side">
            <div className="auth-side-brand">
              <div className="auth-side-tile">🌾</div>
              <div>
                <p className="auth-side-name">{t('appName')}</p>
                <p className="auth-side-tagline">{t('digitalAgriPlatform')}</p>
              </div>
            </div>
            <div className="auth-vp-list">
              <div className="auth-vp-item">
                <span className="auth-vp-check">✓</span>
                {t('vpSell')}
              </div>
              <div className="auth-vp-item">
                <span className="auth-vp-check">✓</span>
                {t('vpMandi')}
              </div>
              <div className="auth-vp-item">
                <span className="auth-vp-check">✓</span>
                {t('vpSecure')}
              </div>
            </div>
            <p className="auth-side-agree">
              {t('authAgree')}{' '}
              <Link className="av-link" to="/legal/terms">
                {t('termsLink')}
              </Link>{' '}
              {t('andLink')}{' '}
              <Link className="av-link" to="/legal/privacy">
                {t('privacyLink')}
              </Link>
              .
            </p>
          </aside>

          <div className="auth-main">
            <div className="auth-formcol">
              <h1 className="av-page-title" style={{ textAlign: 'center' }}>
                {t('welcomeTitle')}
              </h1>
              <p className="av-page-subtitle" style={{ textAlign: 'center', marginBottom: 22 }}>
                {t('welcomeSubtitle')}
              </p>
              <SegmentedControl
                options={[
                  { value: 'login', label: t('login') },
                  { value: 'register', label: t('register') },
                ]}
                value={mode}
                onChange={(value) => {
                  if (value === 'register') {
                    openRegister();
                  } else {
                    setMode('login');
                  }
                }}
              />
              <div style={{ marginTop: 22 }}>
                <LoginForm onNeedsRegister={(phone) => openRegister(phone)} />
              </div>
              <p style={{ marginTop: 22, fontSize: 12.5, color: 'var(--av-slate-1)', textAlign: 'center' }}>
                {t('authAgree')}{' '}
                <Link className="av-link" to="/legal/terms">
                  {t('termsLink')}
                </Link>{' '}
                {t('andLink')}{' '}
                <Link className="av-link" to="/legal/privacy">
                  {t('privacyLink')}
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="av-chrome-footer">
        <SiteFooter />
      </div>
    </div>
  );
}
