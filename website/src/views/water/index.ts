import type { ComponentType } from 'react';
import WaterHomePage from './WaterHomePage';

/**
 * Water module page registry — maps the `water` dashboard tool id to the real
 * water home page, following the `views/marketplace/index.ts` pattern.
 */
export const WATER_PAGES: Record<string, ComponentType> = {
  water: WaterHomePage,
  waterSchedule: WaterHomePage,
};

export { WaterHomePage };
