import type { ComponentType } from 'react';
import StoreHouseHome from './StoreHouseHome';
import FacilitiesPage from './FacilitiesPage';
import ChambersPage from './ChambersPage';
import BookingsQueuePage from './BookingsQueuePage';
import InwardRegisterPage from './InwardRegisterPage';
import ReleasePage from './ReleasePage';
import UtilizationPage from './UtilizationPage';

/**
 * Cold-storage "StoreHouse" provider pages registry — `coldStorageHome` tool
 * id → console home. Deep-route pages are exported individually for App.tsx.
 */
export const COLD_STORAGE_PAGES: Record<string, ComponentType> = {
  coldStorageHome: StoreHouseHome,
};

export {
  StoreHouseHome,
  FacilitiesPage,
  ChambersPage,
  BookingsQueuePage,
  InwardRegisterPage,
  ReleasePage,
  UtilizationPage,
};
