import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { updateSettings } from '../lib/api/users';
import { useT } from '../lib/i18n';
import { LANGUAGE_CATALOGUE } from '../lib/languages';
import { useOnboardingStore } from '../stores/onboarding';
import { useSessionStore } from '../stores/session';
import OnboardingProgress from './OnboardingProgress';

/** Header language switcher — every language with a shipped dictionary. */
const LANGUAGES: Array<{ code: string; native: string }> = LANGUAGE_CATALOGUE.map((l) => ({
  code: l.code,
  native: l.name,
}));

interface SiteHeaderProps {
  /** 1–4 shows the onboarding stepper in the center; omit for non-step pages. */
  step?: number;
  /** Extra right-aligned action (e.g. the farm-map Save & Finish button). */
  actions?: ReactNode;
}

/** Sticky website top bar: brand, optional stepper, language switcher, legal links. */
export default function SiteHeader({ step, actions }: SiteHeaderProps) {
  const t = useT();
  const language = useOnboardingStore((s) => s.language);
  const setLanguage = useOnboardingStore((s) => s.setLanguage);
  const hasToken = useSessionStore((s) => !!s.accessToken);

  const changeLanguage = (code: string) => {
    setLanguage(code);
    if (hasToken) {
      void updateSettings({ language: code, preferredLanguage: code }).catch(() => undefined);
    }
  };

  return (
    <header className="av-topbar">
      <div className="av-container av-topbar-inner">
        <Link to="/" className="av-brand">
          <span className="av-brand-tile">🌾</span>
          <span className="av-brand-name">{t('appName')}</span>
        </Link>
        {step ? <OnboardingProgress step={step} /> : <div className="av-topbar-stepper" />}
        <div className="av-topbar-right">
          {actions}
          <select
            className="av-lang-select"
            value={language}
            aria-label={t('languageLabel')}
            onChange={(e) => changeLanguage(e.target.value)}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.native}
              </option>
            ))}
          </select>
          <nav className="av-topbar-legal">
            <Link className="av-link" to="/legal/privacy">
              {t('privacyLink')}
            </Link>
            <Link className="av-link" to="/legal/terms">
              {t('termsLink')}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
