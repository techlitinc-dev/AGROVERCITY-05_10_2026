import { useState } from 'react';
import { Link } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import AllToolsSheet from '../../components/dashboard/AllToolsSheet';
import BottomMenuBar from '../../components/dashboard/BottomMenuBar';
import MenuBar from '../../components/dashboard/MenuBar';
import { useT } from '../../lib/i18n';
import SkillPassportSection from './SkillPassportSection';
import '../../theme/dashboard.css';

/**
 * Profile hub (task 1.24) — replaces the `/dashboard/profile` PlaceholderPage
 * slice with the "Certificates / Skill Passport" section plus the standard
 * dashboard chrome. No demo data.
 */
export default function SkillPassportPage() {
  const t = useT();
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader />
      <MenuBar onOpenAllTools={() => setToolsOpen(true)} />
      <main className="dash-content" style={{ flex: 1 }}>
        <Link className="av-link dash-back-link" to="/dashboard">
          ← {t('dashBack')}
        </Link>
        <SkillPassportSection />
      </main>
      <SiteFooter />
      <BottomMenuBar />
      <AllToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </div>
  );
}
