import type { ComponentType } from 'react';
import BrowsePage from './BrowsePage';
import DemandsPage from './DemandsPage';
import EMarketHome from './EMarketHome';
import FavoritesPage from './FavoritesPage';
import InspectionPage from './InspectionPage';
import OrdersPage from './OrdersPage';
import QuotesPage from './QuotesPage';
import StorefrontPage from './StorefrontPage';

/**
 * FarmGate customer page registry (phase-04 WS-03) — merged into the generic
 * tool route (views/dashboard/ToolPage.tsx) the same way as ACADEMY_PAGES /
 * INSTRUCTOR_PAGES. Each page renders its own chrome via ToolShell.
 *
 * `orderTracking` resolves to OrdersPage (parent order → per-farmer child
 * shipments); `storefront` and `inspection` are reached through the deep routes
 * /dashboard/p/storefront/:farmerId and /dashboard/p/orders/:orderId/inspect.
 */
export const CUSTOMER_PAGES: Record<string, ComponentType> = {
  emarketHome: EMarketHome,
  browse: BrowsePage,
  storefront: StorefrontPage,
  demands: DemandsPage,
  quotes: QuotesPage,
  orderTracking: OrdersPage,
  inspection: InspectionPage,
  favorites: FavoritesPage,
};

export {
  BrowsePage,
  DemandsPage,
  EMarketHome,
  FavoritesPage,
  InspectionPage,
  OrdersPage,
  QuotesPage,
  StorefrontPage,
};
