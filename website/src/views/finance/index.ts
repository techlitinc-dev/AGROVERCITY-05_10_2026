import type { ComponentType } from 'react';
import CreditScorePage from './CreditScorePage';
import LoanMarketplacePage from './LoanMarketplacePage';
import EmiCalculatorPage from './EmiCalculatorPage';
import LoanWizardPage from './LoanWizardPage';
import LoanStatusPage from './LoanStatusPage';

/**
 * Finance page registry — maps dashboard tool ids to real implementations.
 * `finance` is the credit-score landing page; the sub-pages are deep-routed
 * (`/dashboard/p/loanMarketplace`, `/dashboard/p/emiCalculator`,
 * `/dashboard/p/loanWizard`, `/dashboard/p/loanStatus`) and registered here so
 * the generic tool route + tiles resolve too.
 */
export const FINANCE_PAGES: Record<string, ComponentType> = {
  finance: CreditScorePage,
  creditScore: CreditScorePage,
  loanMarketplace: LoanMarketplacePage,
  emiCalculator: EmiCalculatorPage,
  loanWizard: LoanWizardPage,
  loanStatus: LoanStatusPage,
};

export {
  CreditScorePage,
  LoanMarketplacePage,
  EmiCalculatorPage,
  LoanWizardPage,
  LoanStatusPage,
};
