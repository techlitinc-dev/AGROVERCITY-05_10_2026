import { useT } from '../../lib/i18n';
import { personaByType, personaLabel } from '../../lib/personas';
import { useDashboardStore } from '../../stores/dashboard';

interface ProfileSwitcherBarProps {
  onOpenSheet: () => void;
}

/**
 * Horizontal role-chip strip — mirrors mobile DashboardProfileSwitcherBar
 * (apps/mobile/lib/components/navigation/dashboard_profile_switcher_bar.dart).
 */
export default function ProfileSwitcherBar({ onOpenSheet }: ProfileSwitcherBarProps) {
  const t = useT();
  const linkedProfiles = useDashboardStore((s) => s.linkedProfiles);
  const activeProfile = useDashboardStore((s) => s.activeProfile);
  const setActiveProfile = useDashboardStore((s) => s.setActiveProfile);

  return (
    <div className="dash-switcher-card">
      <div className="dash-switcher-head">
        <span className="dash-switcher-title">🔁 {t('dashSwitchRole')}</span>
        <button type="button" className="dash-view-all-btn" onClick={onOpenSheet}>
          {t('dashViewAll', { count: linkedProfiles.length })} ▾
        </button>
      </div>
      <div className="dash-role-chips">
        {linkedProfiles.map((type) => {
          const persona = personaByType(type);
          if (!persona) return null;
          const active = type === activeProfile;
          return (
            <button
              key={type}
              type="button"
              className={`dash-role-chip${active ? ' active' : ''}`}
              onClick={() => setActiveProfile(type)}
            >
              {persona.icon} {personaLabel(type)}
            </button>
          );
        })}
        <button type="button" className="dash-role-chip add" onClick={onOpenSheet}>
          {t('dashAddRole')}
        </button>
      </div>
    </div>
  );
}
