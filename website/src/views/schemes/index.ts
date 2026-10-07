import type { ComponentType } from 'react';
import SchemesListPage from './SchemesListPage';
import SchemeDetailPage from './SchemeDetailPage';

/**
 * Schemes page registry — maps dashboard tool ids to real implementations.
 * `schemes` is the discovery list; the detail page is reached via the deep route
 * `/dashboard/p/schemes/:schemeId` (registered in App.tsx).
 */
export const SCHEMES_PAGES: Record<string, ComponentType> = {
  schemes: SchemesListPage,
};

export { SchemesListPage, SchemeDetailPage };
