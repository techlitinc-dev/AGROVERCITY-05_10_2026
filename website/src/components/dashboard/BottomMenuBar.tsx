import { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useT } from '../../lib/i18n';
import { TOOL_BY_ID } from '../../lib/dashboard';
import { PERSONAS, personaByType } from '../../lib/personas';
import { useDashboardStore } from '../../stores/dashboard';

/**
 * Per-profile bottom menu bar — mirrors the mobile app's BottomMenuBar
 * (apps/mobile/lib/components/navigation/bottom_menu_bar.dart).
 *
 * Fixed 5-slot layout for every profile: [Home, Work A, Work B, Wallet, Profile].
 * The two middle tabs are persona-specific modules (existing tool placeholder
 * pages); Wallet & Profile are universal placeholder routes (/dashboard/wallet,
 * /dashboard/profile). No mock data — every tab links to a real route.
 */

/** Persona-specific middle tabs — ids from TOOL_BY_ID (all_tools_sheet.dart). */
const PERSONA_TABS: Record<string, [string, string]> = {
  farmer: ['mandi', 'sellProduce'],
  farmLandlord: ['landlordPlots', 'leaseRequests'],
  transport: ['loadBoard', 'bookingInbox'],
  seller: ['mandi', 'sellerProducts'],
  equipmentRental: ['machineManage', 'slotCalendarManage'],
  broker: ['mandi', 'buyers'],
  instructor: ['courses', 'myLibrary'],
  dairyManager: ['livestockDairy', 'dairyConsole'],
  customer: ['marketplace', 'orderTracking'],
  directBuyer: ['demands', 'purchases'],
  bankManager: ['loanDashboard', 'loanReview'],
  insuranceProvider: ['cropInsurance', 'insurancePolicyReview'],
  coldStorageProvider: ['postHarvest', 'myBookings'],
};

interface BottomTab {
  to: string;
  labelKey: string;
  icon: string;
}

export default function BottomMenuBar() {
  const t = useT();
  const { pathname } = useLocation();
  const activeProfile = useDashboardStore((s) => s.activeProfile) ?? 'farmer';
  const persona = personaByType(activeProfile) ?? PERSONAS[0];

  const tabs: BottomTab[] = [
    { to: '/dashboard', labelKey: 'dashHomeTab', icon: '🏠' },
    ...(PERSONA_TABS[persona.type] ?? PERSONA_TABS.farmer)
      .filter((id) => TOOL_BY_ID[id])
      .map((id) => ({
        to: `/dashboard/p/${id}`,
        labelKey: `tool_${id}`,
        icon: TOOL_BY_ID[id].icon,
      })),
    { to: '/dashboard/wallet', labelKey: 'dashWallet', icon: '👛' },
    { to: '/dashboard/profile', labelKey: 'dashProfile', icon: '👤' },
  ];

  return (
    <>
      {/* Keeps page content clear of the fixed bar. */}
      <div className="dash-bottombar-space" aria-hidden="true" />
      <nav
        className="dash-bottombar"
        aria-label={t('dashBottomNav')}
        style={
          {
            '--tab-color': persona.color,
            '--tab-glow': `${persona.color}80`,
          } as CSSProperties
        }
      >
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={`dash-bottombar-tab${pathname === tab.to ? ' is-active' : ''}`}
          >
            <span className="dash-bottombar-iconpill">{tab.icon}</span>
            <span className="dash-bottombar-label">{t(tab.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
