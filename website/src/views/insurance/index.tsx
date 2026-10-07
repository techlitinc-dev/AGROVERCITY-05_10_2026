import type { ComponentType } from 'react';
import ClaimsDeskHome from './ClaimsDeskHome';
import ClaimsQueuePage from './ClaimsQueuePage';
import ClaimDetailPage from './ClaimDetailPage';
import SurveyorsPage from './SurveyorsPage';
import DisbursePage from './DisbursePage';
import PolicyReviewPage from './PolicyReviewPage';
import RatesPage from './RatesPage';
import InsuranceHubPage from './InsuranceHubPage';
import FarmerClaimTrackerPage from '../farmer/FarmerClaimTrackerPage';
import './insurance.css';

/**
 * Insurance pages registry — maps dashboard tool ids to real implementations
 * (insuranceProvider console + the farmer crop-insurance faces).
 * ToolPage merges this into its per-tool switch; deep-route pages are exported
 * individually for App.tsx. WS-05 adds the farmer 4-tab hub under the new
 * `insuranceHub` tool id (the phase-03 provider console keeps its own ids).
 */
export const INSURANCE_PAGES: Record<string, ComponentType> = {
  insuranceProviderHome: ClaimsDeskHome,
  insuranceClaimReview: ClaimsQueuePage,
  insurancePolicyReview: PolicyReviewPage,
  cropInsurance: FarmerClaimTrackerPage,
  insuranceHub: InsuranceHubPage,
};

export {
  ClaimsDeskHome,
  ClaimsQueuePage,
  ClaimDetailPage,
  SurveyorsPage,
  DisbursePage,
  PolicyReviewPage,
  RatesPage,
  InsuranceHubPage,
  FarmerClaimTrackerPage,
};
