import type { ComponentType } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { useDashboardStore } from '../../stores/dashboard';
import EquipmentBrowsePage from '../farmer/EquipmentBrowsePage';
import EquipmentSlotsPage from '../farmer/EquipmentSlotsPage';
import BookingQueuePage from './BookingQueuePage';
import DamageClaimsPage from './DamageClaimsPage';
import DispatchPage from './DispatchPage';
import EquipmentOwnerHomeBoard from './EquipmentOwnerHomeBoard';
import FleetPage from './FleetPage';
import MaintenancePage from './MaintenancePage';
import OwnerOverviewPage from './OwnerOverviewPage';
import RoiAnalyticsPage from './RoiAnalyticsPage';

/**
 * Equipment pages registry — maps dashboard tool ids to real implementations
 * (phase-02 WS-04 monolith split). ToolPage renders these inside the tool
 * shell; deep-route pages are exported individually for App.tsx.
 * slotCalendarManage keeps the slimmed legacy board until a dedicated slot
 * calendar view lands. The shared `equipment` toolId is persona-split:
 * owners land on their overview, farmers on the machine browse.
 */
function withShell(toolId: string, Page: ComponentType) {
  return function ShelledPage() {
    return (
      <ToolShell toolId={toolId}>
        <Page />
      </ToolShell>
    );
  };
}

function EquipmentByPersona() {
  const active = useDashboardStore((s) => s.activeProfile);
  return active === 'equipmentRental' ? <OwnerOverviewPage /> : <EquipmentBrowsePage />;
}

export const EQUIPMENT_PAGES: Record<string, ComponentType> = {
  equipmentOwnerHome: withShell('equipmentOwnerHome', OwnerOverviewPage),
  equipment: withShell('equipment', EquipmentByPersona),
  machineManage: withShell('machineManage', FleetPage),
  slotCalendarManage: () => (
    <ToolShell toolId="slotCalendarManage">
      <EquipmentOwnerHomeBoard embedded />
    </ToolShell>
  ),
  bookingQueue: withShell('bookingQueue', BookingQueuePage),
  dispatch: withShell('dispatch', DispatchPage),
  damageClaims: withShell('damageClaims', DamageClaimsPage),
  maintenance: withShell('maintenance', MaintenancePage),
  roiAnalytics: withShell('roiAnalytics', RoiAnalyticsPage),
};

/** Deep-route components (App.tsx). */
export const OwnerOverviewPageRoute = withShell('equipmentOwnerHome', OwnerOverviewPage);
export const FleetPageRoute = withShell('machineManage', FleetPage);
export const BookingQueuePageRoute = withShell('bookingQueue', BookingQueuePage);
export const DispatchPageRoute = withShell('dispatch', DispatchPage);
export const DamageClaimsPageRoute = withShell('damageClaims', DamageClaimsPage);
export const MaintenancePageRoute = withShell('maintenance', MaintenancePage);
export const RoiAnalyticsPageRoute = withShell('roiAnalytics', RoiAnalyticsPage);
export const EquipmentSlotsPageRoute = withShell('equipment', EquipmentSlotsPage);

export { EquipmentOwnerHomeBoard };
