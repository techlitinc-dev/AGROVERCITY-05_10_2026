import type { ComponentType } from 'react';
import ColdStoragePage from './ColdStoragePage';
import GradingPage from './GradingPage';
import MyBookingsPage from './MyBookingsPage';
import ReceiptsVaultPage from './ReceiptsVaultPage';

/**
 * Post-harvest farmer-face page registry — maps dashboard tool ids to the real
 * cold-storage / bookings / receipts / grading pages, following the
 * `views/marketplace/index.ts` pattern. (The provider console lives separately
 * under `views/coldstorage/` and is not touched here.)
 */
export const POSTHARVEST_PAGES: Record<string, ComponentType> = {
  postHarvest: ColdStoragePage,
  coldStorage: ColdStoragePage,
  myBookings: MyBookingsPage,
  receiptsVault: ReceiptsVaultPage,
  grading: GradingPage,
};

export { ColdStoragePage, GradingPage, MyBookingsPage, ReceiptsVaultPage };
