import { Navigate } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useDashboardStore } from '../../stores/dashboard';
import { useT } from '../../lib/i18n';

/**
 * Role-aware entry for the dairy tool: farmers/sellers go to their read-only
 * "My Dairy" self-view, dairy managers to the console; anyone else gets a
 * friendly prompt to activate the Dairy & Gaushala profile first.
 */
export default function DairyHubPage() {
  const t = useT();
  const activeProfile = useDashboardStore((s) => s.activeProfile);
  const setActiveProfile = useDashboardStore((s) => s.setActiveProfile);

  if (activeProfile === 'farmer' || activeProfile === 'seller') {
    return <Navigate to="/dairy/me" replace />;
  }
  if (activeProfile === 'dairyManager') {
    return <Navigate to="/dairy/console" replace />;
  }

  return (
    <ToolShell toolId="livestockDairy">
      <div className="dairy-hub-prompt">
        <span className="dairy-hub-icon" aria-hidden>
          🐄
        </span>
        <p className="dairy-empty-title">{t('dairyHubPromptTitle')}</p>
        <p className="dairy-empty-body">{t('dairyHubPromptBody')}</p>
        <div className="dairy-empty-action">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void setActiveProfile('dairyManager')}
          >
            {t('dairyHubActivate')}
          </button>
        </div>
      </div>
    </ToolShell>
  );
}
