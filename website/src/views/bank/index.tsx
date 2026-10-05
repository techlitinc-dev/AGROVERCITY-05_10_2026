import type { ComponentType } from 'react';
import BankHomeBoard from './BankHomeBoard';
import LoanQueuePage from './LoanQueuePage';
import LoanDetailPage from './LoanDetailPage';
import PortfolioPage from './PortfolioPage';
import LoanTrackingPage from '../farmer/LoanTrackingPage';

/**
 * Bank "CreditDesk" pages registry — maps dashboard tool ids to real
 * implementations. Consistent with the other *_PAGES maps (DAIRY_PAGES etc.):
 * each page renders its own ToolShell, so ToolPage renders it directly.
 *
 * NOTE: `bankManagerHome` is not yet in dashboard.ts TOOL_LIST — the integrator
 * must add `{ id: 'bankManagerHome', icon: '🏦', color: '#334155' }` there (it
 * already appears in PROFILE_ROUTES.bankManager and DEFAULT_HOME_ROUTE), and
 * import BANK_PAGES into views/dashboard/ToolPage.tsx (see SHARED WIRING).
 */
export const BANK_PAGES: Record<string, ComponentType> = {
  bankManagerHome: BankHomeBoard,
  loanDashboard: PortfolioPage,
  loanReview: LoanQueuePage,
  loanTracking: LoanTrackingPage,
};

export { BankHomeBoard, LoanQueuePage, LoanDetailPage, PortfolioPage, LoanTrackingPage };
