import type { ComponentType } from 'react';
import ColdStorageDirectoryPage from './ColdStorageDirectoryPage';
import FarmerClaimIntimatePage from './FarmerClaimIntimatePage';
import FarmerClaimTrackerPage from './FarmerClaimTrackerPage';
import FarmerContractDetailPage from './FarmerContractDetailPage';
import FarmerContractsPage from './FarmerContractsPage';
import FarmerDealDetailPage from './FarmerDealDetailPage';
import FarmerOffersPage from './FarmerOffersPage';
import FarmerProcurementPage from './FarmerProcurementPage';
import LoanTrackingPage from './LoanTrackingPage';
import MyStorageBookingsPage from './MyStorageBookingsPage';
import WarehouseReceiptPage from './WarehouseReceiptPage';

/**
 * Farmer-side registries — the brokerOffers tool (incoming dalal offers, P2),
 * the myContracts tool (buyer offers + supply agreements, accept via MPIN
 * e-sign), the loanTracking tool (CreditDesk farmer mirror, phase-03 WS-03),
 * and the postHarvest/myBookings tools (StoreHouse farmer face, phase-03 WS-05).
 * Deep-route pages are exported individually for App.tsx.
 */
export const FARMER_PAGES: Record<string, ComponentType> = {
  brokerOffers: FarmerOffersPage,
  myContracts: FarmerContractsPage,
  farmerProcurement: FarmerProcurementPage,
  postHarvest: ColdStorageDirectoryPage,
  myBookings: MyStorageBookingsPage,
};

export {
  ColdStorageDirectoryPage,
  FarmerClaimIntimatePage,
  FarmerClaimTrackerPage,
  FarmerContractDetailPage,
  FarmerContractsPage,
  FarmerDealDetailPage,
  FarmerOffersPage,
  FarmerProcurementPage,
  LoanTrackingPage,
  MyStorageBookingsPage,
  WarehouseReceiptPage,
};
