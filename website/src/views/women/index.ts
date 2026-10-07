import type { ComponentType } from 'react';
import WomenHubPage from './WomenHubPage';

/**
 * Women Farmer Hub page registry — maps the `womenFarmer` master tile (farmer /
 * farmLandlord routes) to the 4-tab hub, following the
 * `views/marketplace/index.ts` pattern.
 */
export const WOMEN_PAGES: Record<string, ComponentType> = {
  womenFarmer: WomenHubPage,
  womenHub: WomenHubPage,
};

export { WomenHubPage };
