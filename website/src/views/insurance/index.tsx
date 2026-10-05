import type { ComponentType } from 'react';
import ClaimsDeskHome from './ClaimsDeskHome';
import ClaimsQueuePage from './ClaimsQueuePage';
import ClaimDetailPage from './ClaimDetailPage';
import SurveyorsPage from './SurveyorsPage';
import DisbursePage from './DisbursePage';
import PolicyReviewPage from './PolicyReviewPage';
import RatesPage from './RatesPage';
import FarmerClaimTrackerPage from '../farmer/FarmerClaimTrackerPage';
import './insurance.css';

/**
 * Insurance pages registry — maps dashboard tool ids to real implementations
 * (insuranceProvider console + the farmer crop-insurance claim mirror).
 * ToolPage merges this into its per-tool switch; deep-route pages are exported
 * individually for App.tsx.
 */
export const INSURANCE_PAGES: Record<string, ComponentType> = {
  insuranceProviderHome: ClaimsDeskHome,
  insuranceClaimReview: ClaimsQueuePage,
  insurancePolicyReview: PolicyReviewPage,
  cropInsurance: FarmerClaimTrackerPage,
};

export {
  ClaimsDeskHome,
  ClaimsQueuePage,
  ClaimDetailPage,
  SurveyorsPage,
  DisbursePage,
  PolicyReviewPage,
  RatesPage,
};
