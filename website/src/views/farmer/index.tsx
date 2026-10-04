import type { ComponentType } from 'react';
import FarmerContractDetailPage from './FarmerContractDetailPage';
import FarmerContractsPage from './FarmerContractsPage';
import FarmerDealDetailPage from './FarmerDealDetailPage';
import FarmerOffersPage from './FarmerOffersPage';
import FarmerProcurementPage from './FarmerProcurementPage';

/**
 * Farmer-side registries — the brokerOffers tool (incoming dalal offers, P2)
 * and the myContracts tool (buyer offers + supply agreements, accept via MPIN
 * e-sign). Deep-route pages are exported individually for App.tsx.
 */
export const FARMER_PAGES: Record<string, ComponentType> = {
  brokerOffers: FarmerOffersPage,
  myContracts: FarmerContractsPage,
  farmerProcurement: FarmerProcurementPage,
};

export {
  FarmerContractDetailPage,
  FarmerContractsPage,
  FarmerDealDetailPage,
  FarmerOffersPage,
  FarmerProcurementPage,
};
