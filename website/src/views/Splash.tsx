import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchAppConfig } from '../lib/api/reference';
import { useT } from '../lib/i18n';
import { useOnboardingStore } from '../stores/onboarding';
import { useSessionStore } from '../stores/session';
import '../theme/views.css';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.agrovercity.kisansetu';
const APP_VERSION = '1.0.0';
const LOGO_PHASE_MS = 800;
const BRAND_PHASE_MS = 1800;

type Gate = { type: 'force' | 'maintenance' } | null;

/** Full-viewport dark hero splash: logo pop → brand reveal, with app-config gate. */
export default function Splash() {
  const t = useT();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'logo' | 'brand'>('logo');
  const [gate, setGate] = useState<Gate>(null);
  const gatePassed = useRef(false);
  const gatePending = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const advance = useCallback(async () => {
    if (gatePending.current) return; // a gate check is already running
    if (!gatePassed.current) {
      gatePending.current = true;
      const config = await fetchAppConfig(APP_VERSION, 'web'); // never throws (fail-open)
      gatePending.current = false;
      if (!config) {
        gatePassed.current = true;
      } else if (config.forceUpdate) {
        setGate({ type: 'force' });
        return;
      } else if (config.maintenanceMode) {
        setGate({ type: 'maintenance' });
        return;
      } else {
        gatePassed.current = true;
      }
    }
    // Flow: splash → phone/MPIN (registered) or register → language →
    // profiles → farm map → dashboard. Returning onboarded users go straight
    // to the dashboard.
    const { isOnboarded } = useOnboardingStore.getState();
    const { accessToken } = useSessionStore.getState();
    navigate(isOnboarded && accessToken ? '/dashboard' : '/auth');
  }, [navigate]);

  const skip = useCallback(() => {
    if (phaseRef.current === 'logo') {
      setPhase('brand');
    } else {
      void advance();
    }
  }, [advance]);

  useEffect(() => {
    const logoTimer = window.setTimeout(() => setPhase('brand'), LOGO_PHASE_MS);
    return () => window.clearTimeout(logoTimer);
  }, []);

  useEffect(() => {
    if (phase !== 'brand') return;
    const brandTimer = window.setTimeout(() => void advance(), BRAND_PHASE_MS);
    return () => window.clearTimeout(brandTimer);
  }, [phase, advance]);

  return (
    <div className="splash" onClick={skip}>
      {phase === 'logo' ? (
        <div className="splash-phase" key="logo">
          <div className="splash-logo-tile">🌾</div>
        </div>
      ) : (
        <div className="splash-phase" key="brand">
          <div className="splash-logo-tile small">🌾</div>
          <h1 className="splash-brand">{t('appName')}</h1>
          <p className="splash-subtitle">{t('digitalAgriPlatform')}</p>
          <button
            type="button"
            className="splash-cta"
            onClick={(e) => {
              e.stopPropagation();
              void advance();
            }}
          >
            {t('getStarted')} →
          </button>
        </div>
      )}

      <div className="splash-legal">
        <Link className="av-link" to="/legal/privacy">
          {t('privacyLink')}
        </Link>
        <Link className="av-link" to="/legal/terms">
          {t('termsLink')}
        </Link>
        <Link className="av-link" to="/legal/refunds">
          {t('refundsLink')}
        </Link>
        <Link className="av-link" to="/legal/community">
          {t('communityLink')}
        </Link>
      </div>

      {gate ? (
        <div className="splash-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="splash-dialog-card">
            <h3>{gate.type === 'force' ? t('updateRequired') : t('maintenanceTitle')}</h3>
            <p>{gate.type === 'force' ? t('updateMessage') : t('maintenanceMessage')}</p>
            <div className="splash-dialog-actions">
              {gate.type === 'force' ? (
                <a className="av-btn av-btn-primary splash-store-link" href={PLAY_STORE_URL}>
                  {t('updateNow')}
                </a>
              ) : (
                <button type="button" className="av-btn av-btn-primary" onClick={() => void advance()}>
                  {t('retry')}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
