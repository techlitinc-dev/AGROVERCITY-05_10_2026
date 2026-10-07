import type { ComponentType } from 'react';
import LandRecordDetailPage from './LandRecordDetailPage';
import LandRecordsPage from './LandRecordsPage';

/**
 * Land & Legal page registry — maps dashboard tool ids to the real 7/12 & 8A
 * pages, following the `views/marketplace/index.ts` pattern. Registered into
 * the generic tool route (views/dashboard/ToolPage.tsx).
 *
 * NOTE: this is a distinct domain from `views/legal/` (the static legal-pages
 * domain) — do not collide.
 */
export const LAND_PAGES: Record<string, ComponentType> = {
  landLegal: LandRecordsPage,
  landRecordView: LandRecordDetailPage,
};

export { LandRecordDetailPage, LandRecordsPage };
