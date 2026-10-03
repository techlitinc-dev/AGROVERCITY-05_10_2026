import { useState } from 'react';
import { Link } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import AllToolsSheet from '../../components/dashboard/AllToolsSheet';
import BottomMenuBar from '../../components/dashboard/BottomMenuBar';
import MenuBar from '../../components/dashboard/MenuBar';
import { SkeletonCard } from '../../components/dashboard/tiles';
import { useT } from '../../lib/i18n';
import { PERSONAS, personaByType } from '../../lib/personas';
import { useDashboardStore } from '../../stores/dashboard';
import '../../theme/dashboard.css';

interface PlaceholderPageProps {
  icon: string;
  titleKey: string;
  subKey: string;
}

/**
 * Generic "module under construction" placeholder page — mirrors the mobile
 * ModulePlaceholderView (apps/mobile/lib/views/common/module_placeholder_view.dart).
 * Used for bottom-menu-bar destinations that do not have a real backend module
 * yet (Wallet, Profile hub). Static empty state only — no mock data.
 */
export default function PlaceholderPage({ icon, titleKey, subKey }: PlaceholderPageProps) {
  const t = useT();
  const activeProfile = useDashboardStore((s) => s.activeProfile) ?? 'farmer';
  const persona = personaByType(activeProfile) ?? PERSONAS[0];
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader />
      <MenuBar onOpenAllTools={() => setToolsOpen(true)} />
      <main className="dash-content" style={{ flex: 1 }}>
        <Link className="av-link dash-back-link" to="/dashboard">
          ← {t('dashBack')}
        </Link>

        <div className="dash-toolpage-head">
          <span
            className="dash-toolpage-icon"
            style={{ background: `${persona.color}22`, color: persona.color }}
          >
            {icon}
          </span>
          <span>
            <span className="dash-toolpage-title">{t(titleKey)}</span>
            <br />
            <span className="dash-toolpage-sub">{t(subKey)}</span>
          </span>
        </div>

        <div className="dash-placeholder-body">🛠️ {t('dashPlaceholderBody')}</div>

        <div className="dash-skeleton-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </main>
      <SiteFooter />
      <BottomMenuBar />
      <AllToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </div>
  );
}
