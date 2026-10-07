import type { ComponentType } from 'react';
import ReferralHubPage from './ReferralHubPage';

/**
 * Refer & Earn page registry — maps the `referEarn` master tile to the real
 * referral hub, following the `views/marketplace/index.ts` pattern.
 */
export const REFERRALS_PAGES: Record<string, ComponentType> = {
  referEarn: ReferralHubPage,
  referralHub: ReferralHubPage,
};

export { ReferralHubPage };
