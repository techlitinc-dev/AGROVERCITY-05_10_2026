import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import AllToolsSheet from '../../components/dashboard/AllToolsSheet';
import BottomMenuBar from '../../components/dashboard/BottomMenuBar';
import MenuBar from '../../components/dashboard/MenuBar';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { SkeletonCard } from '../../components/dashboard/tiles';
import { useT } from '../../lib/i18n';
import { TOOL_BY_ID, canAccess } from '../../lib/dashboard';
import { useDashboardStore } from '../../stores/dashboard';
import { TRADE_PAGES } from '../trade';
import { TRANSPORT_PAGES } from '../transport';
import { DIARY_PAGES } from '../diary';
import { DAIRY_PAGES } from '../dairy';
import { GAUSHALA_PAGES } from '../gaushala';
import { VET_PAGES } from '../vetnet';
import { ANIMAL_PAGES } from '../animals';
import { PNL_PAGES } from '../pnl';
import { BROKER_PAGES } from '../broker';
import { DIRECT_BUYER_PAGES } from '../directbuyer';
import { FARMER_PAGES } from '../farmer';
import { LANDLORD_PAGES } from '../landlord';
import { EQUIPMENT_PAGES } from '../equipment';
import { CUSTOMER_PAGES } from '../customer';
import { INSTRUCTOR_PAGES } from '../instructor';
import { DAIRY_MARKET_PAGES } from '../dairyMarket';
import '../../theme/dashboard.css';

/**
 * Generic tool route (/dashboard/p/:toolId). Registered tool modules render
 * their real page (TRADE_PAGES, TRANSPORT_PAGES, DIARY_PAGES, DAIRY_PAGES,
 * PNL_PAGES, BROKER_PAGES, DIRECT_BUYER_PAGES, FARMER_PAGES); everything else
 * keeps the placeholder skeleton. Access is checked against the active persona's route
 * map — mirrors mobile ProfileRoutes.canAccess.
 */
export default function ToolPage() {
  const t = useT();
  const { toolId = '' } = useParams();
  const activeProfile = useDashboardStore((s) => s.activeProfile) ?? 'farmer';
  const [toolsOpen, setToolsOpen] = useState(false);

  const tool = TOOL_BY_ID[toolId];
  if (!tool || !canAccess(activeProfile, toolId)) {
    return <Navigate to="/dashboard" replace />;
  }

  const TradePage = TRADE_PAGES[toolId];
  const TransportPage = TRANSPORT_PAGES[toolId];
  const DiaryPage = DIARY_PAGES[toolId];
  const DairyPage = DAIRY_PAGES[toolId];
  const GaushalaPage = GAUSHALA_PAGES[toolId];
  const VetPage = VET_PAGES[toolId];
  const AnimalPage = ANIMAL_PAGES[toolId];
  const PnlPage = PNL_PAGES[toolId];
  const BrokerPage = BROKER_PAGES[toolId];
  const DirectBuyerPage = DIRECT_BUYER_PAGES[toolId];
  const FarmerPage = FARMER_PAGES[toolId];
  const LandlordPage = LANDLORD_PAGES[toolId];
  const EquipmentPage = EQUIPMENT_PAGES[toolId];
  const CustomerPage = CUSTOMER_PAGES[toolId];
  const InstructorPage = INSTRUCTOR_PAGES[toolId];
  const DairyMarketPage = DAIRY_MARKET_PAGES[toolId];
  const RealPage =
    TradePage ?? TransportPage ?? DiaryPage ?? DairyPage ?? GaushalaPage ?? VetPage ?? AnimalPage
    ?? PnlPage ?? BrokerPage ?? DirectBuyerPage ?? FarmerPage ?? LandlordPage ?? EquipmentPage
    ?? CustomerPage ?? InstructorPage ?? DairyMarketPage;

  // Trade/transport pages render their own chrome via ToolShell (also used by deep routes).
  if (RealPage) {
    return <RealPage />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader />
      <MenuBar onOpenAllTools={() => setToolsOpen(true)} />
      <main className="dash-content" style={{ flex: 1 }}>
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

        <div className="dash-placeholder-body">🛠️ {t('dashPlaceholderBody')}</div>

        <div className="dash-skeleton-grid">
          <SkeletonCard />
          <SkeletonCard />
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
