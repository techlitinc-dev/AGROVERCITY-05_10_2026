import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n';
import { PERSONAS, personaByType, personaLabel } from '../../lib/personas';
import { useDashboardStore } from '../../stores/dashboard';
import { useSessionStore } from '../../stores/session';
import ModalSheet from '../ModalSheet';

interface ProfileSwitcherSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Role switcher bottom sheet — mirrors mobile ProfileSwitcherSheet
 * (apps/mobile/lib/components/navigation/profile_switcher_sheet.dart).
 * Switching and linking are persisted server-side (link → activate) so
 * backend role checks follow the selected persona.
 */
export default function ProfileSwitcherSheet({ open, onClose }: ProfileSwitcherSheetProps) {
  const t = useT();
  const user = useSessionStore((s) => s.user);
  const activeProfile = useDashboardStore((s) => s.activeProfile);
  const linkedProfiles = useDashboardStore((s) => s.linkedProfiles);
  const setActiveProfile = useDashboardStore((s) => s.setActiveProfile);
  const toggleLinked = useDashboardStore((s) => s.toggleLinked);

  const activePersona = personaByType(activeProfile ?? '') ?? PERSONAS[0];

  return (
    <ModalSheet open={open} onClose={onClose} title={t('dashSwitchRole')}>
      <div className="dash-sheet-user">
        <span className="dash-sheet-avatar">{activePersona.icon}</span>
        <span>
          <span className="dash-sheet-name">{user?.name ?? '—'}</span>
          <br />
          <span className="dash-sheet-role">
            {t('dashActiveRole', { role: personaLabel(activePersona.type), count: linkedProfiles.length })}
          </span>
        </span>
      </div>

      <div className="dash-sheet-label">{t('dashActiveProfiles')}</div>
      <div className="dash-sheet-mini-cards">
        {linkedProfiles.map((type) => {
          const persona = personaByType(type);
          if (!persona) return null;
          const active = type === activeProfile;
          return (
            <button
              key={type}
              type="button"
              className={`dash-sheet-mini-card${active ? ' active' : ''}`}
              onClick={() => {
                setActiveProfile(type);
                onClose();
              }}
            >
              <span className="dash-sheet-mini-icon">{persona.icon}</span>
              <div className="dash-sheet-mini-name">{personaLabel(type)}</div>
              <div className="dash-sheet-mini-sub">
                {active ? t('dashCurrentDashboard') : t('dashTapToSwitch')}
              </div>
            </button>
          );
        })}
      </div>

      <div className="dash-sheet-label">
        {t('dashManageAllRoles')}
        <Link
          to="/dashboard/profiles"
          style={{ float: 'right', fontSize: 12 }}
          onClick={onClose}
        >
          {t('dashViewAll', { count: PERSONAS.length })} ▾
        </Link>
      </div>
      {PERSONAS.map((persona) => {
        const linked = linkedProfiles.includes(persona.type);
        const active = persona.type === activeProfile;
        return (
          <div key={persona.type} className={`dash-sheet-persona-row${active ? ' active' : ''}`}>
            <span className="dash-sheet-persona-icon">{persona.icon}</span>
            <span className="dash-sheet-persona-info">
              <span className="dash-sheet-persona-name">
                {personaLabel(persona.type)}
                {active ? <span className="dash-sheet-active-badge">{t('dashActive')}</span> : null}
              </span>
              <br />
              <span className="dash-sheet-persona-tag">{persona.tagline}</span>
            </span>
            <button
              type="button"
              className={`dash-sheet-toggle${linked ? ' linked' : ''}`}
              onClick={() => toggleLinked(persona.type)}
            >
              {linked ? t('dashRemove') : t('dashAdd')}
            </button>
          </div>
        );
      })}

      <Link
        className="av-btn av-btn-ghost"
        to="/onboarding/profiles"
        onClick={onClose}
        style={{ marginTop: 14 }}
      >
        ✏️ {t('editProfile')}
      </Link>
    </ModalSheet>
  );
}
