import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AllToolsSheet from '../dashboard/AllToolsSheet';
import BottomMenuBar from '../dashboard/BottomMenuBar';
import MenuBar from '../dashboard/MenuBar';
import SiteFooter from '../SiteFooter';
import SiteHeader from '../SiteHeader';
import { TOOL_BY_ID } from '../../lib/dashboard';
import { useT } from '../../lib/i18n';
import '../../theme/dashboard.css';

interface ToolShellProps {
  toolId: string;
  /** Optional back override; defaults to the dashboard home. */
  backTo?: string;
  children: ReactNode;
}

/**
 * Shared chrome for every tool page and deep route (same shell as ToolPage):
 * header + menubar + back link + tool icon/title header + footer + bottom bar.
 */
export default function ToolShell({ toolId, backTo, children }: ToolShellProps) {
  const t = useT();
  const [toolsOpen, setToolsOpen] = useState(false);
  const tool = TOOL_BY_ID[toolId];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader />
      <MenuBar onOpenAllTools={() => setToolsOpen(true)} />
      <main className="dash-content" style={{ flex: 1 }}>
        <Link className="av-link dash-back-link" to={backTo ?? '/dashboard'}>
          ← {t('dashBack')}
        </Link>
        {tool ? (
          <div className="dash-toolpage-head">
            <span
              className="dash-toolpage-icon"
              style={{ background: `${tool.color}22`, color: tool.color }}
            >
              {tool.icon}
            </span>
            <span>
              <span className="dash-toolpage-title">{t(`tool_${toolId}`)}</span>
              <br />
              <span className="dash-toolpage-sub">{t(`tool_${toolId}_sub`)}</span>
            </span>
          </div>
        ) : null}
        {children}
      </main>
      <SiteFooter />
      <BottomMenuBar />
      <AllToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </div>
  );
}
