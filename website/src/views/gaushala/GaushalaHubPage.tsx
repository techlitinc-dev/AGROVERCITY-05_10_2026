import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { isApiError } from '../../lib/api/client';
import { getMyGaushala } from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

/**
 * Gaushala hub gate (P8) — resolves the manager's gaushala profile and forwards
 * to the console either way: /gaushala/console shows the setup form on 404
 * (GAUSHALA_NOT_FOUND) and the dashboard when a profile exists.
 */
export default function GaushalaHubPage() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [phase, setPhase] = useState<'loading' | 'go' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    getMyGaushala()
      .then(() => {
        if (!cancelled) setPhase('go');
      })
      .catch((e) => {
        if (cancelled) return;
        if (isApiError(e) && e.status === 404) setPhase('go');
        else setPhase('failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === 'go') return <Navigate to="/gaushala/console" replace />;

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/dashboard">
      <div className="gaushala-wrap">
        {phase === 'loading' ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}
        {phase === 'failed' ? (
          <div className="gaushala-empty">
            <span className="gaushala-empty-icon" aria-hidden>
              📡
            </span>
            <p className="gaushala-empty-title">{t('gaushalaLoadFailed')}</p>
            <div className="gaushala-empty-action">
              <button type="button" className="av-btn av-btn-ghost" onClick={() => window.location.reload()}>
                ↻ {t('retry')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </ToolShell>
  );
}
