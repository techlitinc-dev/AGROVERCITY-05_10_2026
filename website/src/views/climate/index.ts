import type { ComponentType } from 'react';
import ClimateHomePage from './ClimateHomePage';

/**
 * Climate & carbon page registry — maps the `climate` dashboard tool id to the
 * real carbon-potential / variety / enrollment page.
 */
export const CLIMATE_PAGES: Record<string, ComponentType> = {
  climate: ClimateHomePage,
  climateCarbon: ClimateHomePage,
};

export { ClimateHomePage };
