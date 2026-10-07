import { registerLocale } from '../index';

/**
 * Farmer finance ("KisanCredit") strings — merged into `en`.
 * Key catalog is the contract for every view under views/finance/.
 */

const enFinance: Record<string, string> = {
  // ---- Tool-tile labels for the finance sub-pages ----
  tool_creditScore: 'Credit Score',
  tool_creditScore_sub: 'Kisan credit rating',
  tool_loanMarketplace: 'Loan Marketplace',
  tool_loanMarketplace_sub: 'Compare your offers',
  tool_emiCalculator: 'EMI Calculator',
  tool_emiCalculator_sub: 'Plan your repayment',
  tool_loanWizard: 'Apply for a Loan',
  tool_loanWizard_sub: 'Multi-step application',
  tool_loanStatus: 'Loan Status',
  tool_loanStatus_sub: 'Track your application',

  // ---- Credit score ----
  financeTitle: 'KisanCredit',
  financeIntro: 'Your credit score, KCC, loan marketplace and application tracker.',
  financeCreditTitle: 'Kisan Credit Score',
  financeScoreLabel: 'Score',
  financeTierLabel: 'Tier',
  financeLimitLabel: 'Credit limit',
  financeFactors: 'Factors',
  financeNoScore: 'No score yet',
  financeNoScoreBody: 'Your Kisan credit score appears here once the bureau reports it.',
  financeLoadFailed: 'Could not load finance data. Please try again.',

  // ---- KCC card ----
  financeKccTitle: 'Kisan Credit Card',
  financeKccBank: 'Bank',
  financeKccCard: 'Card',
  financeKccLimit: 'Limit',
  financeKccAvailable: 'Available',
  financeKccNotLinked: 'No KCC linked',
  financeKccNotLinkedBody: 'A Kisan Credit Card linked to your account appears here.',

  // ---- Loan marketplace ----
  financeMarketTitle: 'Loan marketplace',
  financeMarketIntro: 'Compare your loan applications side-by-side.',
  financeMarketEmpty: 'No loan applications yet',
  financeMarketEmptyBody: 'Apply for a loan and your offers appear here for comparison.',
  financeOfferAmount: 'Amount',
  financeOfferRate: 'Rate',
  financeOfferTenure: 'Tenure',
  financeOfferEmi: 'EMI',

  // ---- EMI calculator ----
  financeEmiTitle: 'EMI calculator',
  financeEmiPrincipal: 'Principal (₹)',
  financeEmiRate: 'Interest rate (% / year)',
  financeEmiTenure: 'Tenure (months)',
  financeEmiResult: 'Result',
  financeEmiMonthly: 'Monthly EMI',
  financeEmiTotalInterest: 'Total interest',
  financeEmiTotalPayable: 'Total payable',
  financeEmiInvalid: 'Enter a principal, a rate and a tenure',

  // ---- Loan wizard ----
  financeWizardTitle: 'Apply for a loan',
  financeWizardIntro: 'Three quick steps: amount, purpose, review.',
  financeWizardAmount: 'Loan amount (₹)',
  financeWizardTenure: 'Tenure (months)',
  financeWizardPurpose: 'Purpose',
  financeWizardSubmit: 'Submit application',
  financeWizardSuccess: 'Application submitted',
  financeWizardInvalid: 'Fill the amount, tenure and purpose',
  financeWizardViewStatus: 'View status',

  // ---- Loan status ----
  financeStatusTitle: 'Loan status',
  financeStatusEmpty: 'No loan applications yet',
  financeStatusEmptyBody: 'Applications you submit appear here with a status timeline.',
  financeStatusTimeline: 'Status timeline',
  financeStatusApplication: 'Application',
};

registerLocale('en', enFinance);
