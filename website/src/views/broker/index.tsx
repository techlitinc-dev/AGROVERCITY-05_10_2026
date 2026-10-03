import type { ComponentType } from 'react';
import { useDashboardStore } from '../../stores/dashboard';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import BrokerHomeBoard from './BrokerHomeBoard';
import BrokerProfilePage from './BrokerProfilePage';
import CommissionsPage from './CommissionsPage';
import DealDetailPage from './DealDetailPage';
import DealFormPage from './DealFormPage';
import DealsPage from './DealsPage';
import LeadsPage from './LeadsPage';

/**
 * `buyers` is a shared tool id — farmer/seller routes can access it too. The
 * real leads CRM is broker-only; other personas keep the generic empty
 * placeholder instead of leaking the CRM.
 */
const BuyersGate: ComponentType = () => {
  const activeProfile = useDashboardStore((s) => s.activeProfile) ?? 'farmer';
  if (activeProfile === 'broker') return <LeadsPage />;
  return (
    <ToolShell toolId="buyers">
      <EmptyState icon="📇" titleKey="buyersComingSoon" bodyKey="buyersComingSoonBody" />
    </ToolShell>
  );
};

/**
 * Broker pages registry — maps dashboard tool ids to real implementations.
 * ToolPage renders these inside the tool shell; deep-route pages are exported
 * individually for App.tsx.
 */
export const BROKER_PAGES: Record<string, ComponentType> = {
  brokerHome: BrokerHomeBoard,
  deals: DealsPage,
  buyers: BuyersGate,
  commissions: CommissionsPage,
  brokerProfile: BrokerProfilePage,
};

export {
  BrokerHomeBoard,
  BrokerProfilePage,
  CommissionsPage,
  DealDetailPage,
  DealFormPage,
  LeadsPage,
};
