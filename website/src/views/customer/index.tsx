import type { ComponentType } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import CustomerHomeBoard from './CustomerHomeBoard';

export const CUSTOMER_PAGES: Record<string, ComponentType> = {
  emarketHome: () => (
    <ToolShell toolId="emarketHome">
      <CustomerHomeBoard embedded />
    </ToolShell>
  ),
  orderTracking: () => (
    <ToolShell toolId="orderTracking">
      <CustomerHomeBoard embedded />
    </ToolShell>
  ),
};

export { CustomerHomeBoard };
