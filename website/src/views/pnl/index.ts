import type { ComponentType } from 'react';
import FarmCeoPage from './FarmCeoPage';

/**
 * Farm P&L ("Finance CEO") registry — full cashbook-powered P&L and
 * cash-flow analysis dashboard.
 */
export const PNL_PAGES: Record<string, ComponentType> = {
  profitLoss: FarmCeoPage,
};

export { FarmCeoPage };
