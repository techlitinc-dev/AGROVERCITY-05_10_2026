import type { ComponentType } from 'react';
import RewardsStorePage from './RewardsStorePage';
import WalletPage from './WalletPage';

/**
 * Krishi Ratna (gamification) page registry — maps dashboard tool ids to the
 * real wallet and rewards-store pages, following the `views/marketplace/index.ts`
 * pattern. `krishiRatna` is the master-module tile (COMMON route) and resolves
 * to the wallet; the store is reached via the deep route `/dashboard/p/rewards`.
 */
export const REWARDS_PAGES: Record<string, ComponentType> = {
  krishiRatna: WalletPage,
  krishiRatnaWallet: WalletPage,
  rewardsStore: RewardsStorePage,
};

export { RewardsStorePage, WalletPage };
