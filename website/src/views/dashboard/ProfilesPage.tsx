import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import AllToolsSheet from '../../components/dashboard/AllToolsSheet';
import BottomMenuBar from '../../components/dashboard/BottomMenuBar';
import MenuBar from '../../components/dashboard/MenuBar';
import { useT } from '../../lib/i18n';
import { PERSONAS, personaLabel } from '../../lib/personas';
import { useDashboardStore } from '../../stores/dashboard';
import { useOnboardingStore } from '../../stores/onboarding';
import { useSessionStore } from '../../stores/session';
import '../../theme/dashboard.css';

/**
 * Full-page "Manage All Roles" — the profile switch page
 * (/dashboard/profiles). Linking/unlinking is local state only.
 */
export default function ProfilesPage() {
  const t = useT();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);
  const setOnboarded = useOnboardingStore((s) => s.setOnboarded);
  const activeProfile = useDashboardStore((s) => s.activeProfile);
  const linkedProfiles = useDashboardStore((s) => s.linkedProfiles);
  const setActiveProfile = useDashboardStore((s) => s.setActiveProfile);
  const toggleLinked = useDashboardStore((s) => s.toggleLinked);
  const [toolsOpen, setToolsOpen] = useState(false);

  const signOut = () => {
    clear();
    setOnboarded(false);
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader />
      <MenuBar onOpenAllTools={() => setToolsOpen(true)} />
      <main className="dash-content" style={{ flex: 1 }}>
        <Link className="av-link dash-back-link" to="/dashboard">
          ← {t('dashBack')}
        </Link>

        <div className="dash-profiles-head">
          <span style={{ fontSize: 32 }}>🔄</span>
          <span>
            <span className="dash-profiles-title">{t('dashManageAllRoles')}</span>
            <br />
            <span className="dash-profiles-sub">{t('dashManageProfilesSub')}</span>
          </span>
        </div>

        <div className="dash-sheet-user">
          <span className="dash-sheet-avatar">👤</span>
          <span>
            <span className="dash-sheet-name">{user?.name ?? '—'}</span>
            <br />
            <span className="dash-sheet-role">
              {t('dashLinkedRoles')}: {linkedProfiles.length} / {PERSONAS.length}
            </span>
          </span>
        </div>

        {PERSONAS.map((persona) => {
          const linked = linkedProfiles.includes(persona.type);
          const active = persona.type === activeProfile;
          return (
            <div key={persona.type} className={`dash-profile-page-row${active ? ' active' : ''}`}>
              <span className="dash-profile-page-icon">{persona.icon}</span>
              <span className="dash-profile-page-info">
                <span className="dash-profile-page-name">
                  {personaLabel(persona.type)}
                  {active ? <span className="dash-sheet-active-badge">{t('dashActive')}</span> : null}
                </span>
                <br />
                <span className="dash-profile-page-tag">{persona.tagline}</span>
              </span>
              {linked ? (
                <button
                  type="button"
                  className="dash-sheet-toggle linked"
                  onClick={() => setActiveProfile(persona.type)}
                >
                  {active ? t('dashCurrentDashboard') : t('dashTapToSwitch')}
                </button>
              ) : null}
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

        <div className="dash-profile-actions">
          <Link className="av-btn av-btn-ghost" style={{ width: 'auto', padding: '0 22px' }} to="/onboarding/profiles">
            ✏️ {t('editProfile')}
          </Link>
          <button
            type="button"
            className="av-btn av-btn-primary"
            style={{ width: 'auto', padding: '0 22px' }}
            onClick={signOut}
          >
            {t('dashSignOut')}
          </button>
        </div>
      </main>
      <SiteFooter />
      <BottomMenuBar />
      <AllToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </div>
  );
}
