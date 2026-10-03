import type { ComponentType } from 'react';
import GaushalaHubPage from './GaushalaHubPage';
import GaushalaConsoleHome from './GaushalaConsoleHome';
import CattlePage from './CattlePage';
import CattleFormPage from './CattleFormPage';
import CattleDetailPage from './CattleDetailPage';
import AdoptionsPage from './AdoptionsPage';
import DonationsPage from './DonationsPage';
import ExpensesPage from './ExpensesPage';
import ByproductsPage from './ByproductsPage';
import ReceiptsPage from './ReceiptsPage';
import GaushalaAnalyticsPage from './GaushalaAnalyticsPage';

/** Gaushala pages registry — `gaushalaConsole` tool id → hub page (plan/dairy_plan.md §14 P8). */
export const GAUSHALA_PAGES: Record<string, ComponentType> = {
  gaushalaConsole: GaushalaHubPage,
};

export {
  GaushalaConsoleHome,
  CattlePage,
  CattleFormPage,
  CattleDetailPage,
  AdoptionsPage,
  DonationsPage,
  ExpensesPage,
  ByproductsPage,
  ReceiptsPage,
  GaushalaAnalyticsPage,
};
