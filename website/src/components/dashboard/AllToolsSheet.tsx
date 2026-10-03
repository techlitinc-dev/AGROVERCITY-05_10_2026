import { useNavigate } from 'react-router-dom';
import { useT } from '../../lib/i18n';
import { ALL_TOOLS_IDS, TOOL_BY_ID, canAccess } from '../../lib/dashboard';
import { personaLabel } from '../../lib/personas';
import { useDashboardStore } from '../../stores/dashboard';
import ModalSheet from '../ModalSheet';

interface AllToolsSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * All services grid — mirrors mobile AllToolsSheet
 * (apps/mobile/lib/components/navigation/all_tools_sheet.dart).
 * Tools are filtered by the active persona's route access.
 */
export default function AllToolsSheet({ open, onClose }: AllToolsSheetProps) {
  const t = useT();
  const navigate = useNavigate();
  const activeProfile = useDashboardStore((s) => s.activeProfile) ?? 'farmer';

  const openTool = (id: string) => {
    onClose();
    navigate(id === 'home' ? '/dashboard' : `/dashboard/p/${id}`);
  };

  return (
    <ModalSheet open={open} onClose={onClose} title={`${t('appName')}: ${t('dashAllServices')}`}>
      <div className="dash-grid-3">
        {ALL_TOOLS_IDS.filter((id) => id === 'home' || canAccess(activeProfile, id)).map((id) => {
          const tool = TOOL_BY_ID[id];
          if (!tool) return null;
          const isHome = id === 'home';
          return (
            <button
              key={id}
              type="button"
              className="dash-sheet-mini-card"
              style={{ border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
              onClick={() => openTool(id)}
            >
              <span
                className="dash-tile-icon"
                style={{ background: `${tool.color}22`, color: tool.color }}
              >
                {tool.icon}
              </span>
              <span className="dash-sheet-mini-name" style={{ textAlign: 'center' }}>
                {isHome ? personaLabel(activeProfile) : t(`tool_${id}`)}
              </span>
              <span className="dash-sheet-mini-sub" style={{ textAlign: 'center' }}>
                {isHome ? t('dashBack') : t(`tool_${id}_sub`)}
              </span>
            </button>
          );
        })}
      </div>
    </ModalSheet>
  );
}
