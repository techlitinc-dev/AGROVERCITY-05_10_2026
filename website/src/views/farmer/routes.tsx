import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const FarmerHome = lazy(() => import('./FarmerHome').then((m) => ({ default: m.FarmerHome })));
const MandiPricesView = lazy(() => import('./MandiPricesView').then((m) => ({ default: m.MandiPricesView })));
const ProduceLotsView = lazy(() => import('./ProduceLotsView').then((m) => ({ default: m.ProduceLotsView })));
const BuyerDemandsView = lazy(() => import('./BuyerDemandsView').then((m) => ({ default: m.BuyerDemandsView })));
const PurchasesView = lazy(() => import('./PurchasesView').then((m) => ({ default: m.PurchasesView })));
const PurchaseDetailView = lazy(() => import('./PurchaseDetailView').then((m) => ({ default: m.PurchaseDetailView })));
const BuyerContractsView = lazy(() => import('./BuyerContractsView').then((m) => ({ default: m.BuyerContractsView })));
const ContractDetailView = lazy(() => import('./ContractDetailView').then((m) => ({ default: m.ContractDetailView })));
const TransportBookingView = lazy(() => import('./TransportBookingView').then((m) => ({ default: m.TransportBookingView })));
const FarmDiaryView = lazy(() => import('./FarmDiaryView').then((m) => ({ default: m.FarmDiaryView })));
const PnlDashboardView = lazy(() => import('./PnlDashboardView').then((m) => ({ default: m.PnlDashboardView })));
const EquipmentRentalView = lazy(() => import('./EquipmentRentalView').then((m) => ({ default: m.EquipmentRentalView })));
const LoanFintechView = lazy(() => import('./LoanFintechView').then((m) => ({ default: m.LoanFintechView })));
const LoanDetailView = lazy(() => import('./LoanDetailView').then((m) => ({ default: m.LoanDetailView })));
const BankAccountsView = lazy(() => import('./BankAccountsView').then((m) => ({ default: m.BankAccountsView })));
const CropInsuranceView = lazy(() => import('./CropInsuranceView').then((m) => ({ default: m.CropInsuranceView })));
const PolicyListView = lazy(() => import('./PolicyListView').then((m) => ({ default: m.PolicyListView })));
const ClaimTrackerView = lazy(() => import('./ClaimTrackerView').then((m) => ({ default: m.ClaimTrackerView })));
const LandRecordsView = lazy(() => import('./LandRecordsView').then((m) => ({ default: m.LandRecordsView })));
const GovtSchemesView = lazy(() => import('./GovtSchemesView').then((m) => ({ default: m.GovtSchemesView })));
const WaterClimateView = lazy(() => import('./WaterClimateView').then((m) => ({ default: m.WaterClimateView })));
const VaultView = lazy(() => import('./VaultView').then((m) => ({ default: m.VaultView })));
const ReferralsView = lazy(() => import('./ReferralsView').then((m) => ({ default: m.ReferralsView })));
const KisanCoinsView = lazy(() => import('../community/KisanCoinsView').then((m) => ({ default: m.KisanCoinsView })));
const DairyHome = lazy(() => import('../dairy/DairyHome').then((m) => ({ default: m.DairyHome })));

/** 1. Farmer / Kisan Hub (18 journeys) */
export const FarmerRouteElements = () => (
  <>
    <Route path="/farmer" element={<FarmerHome />} />
    <Route path="/farmer/mandi" element={<MandiPricesView />} />
    <Route path="/farmer/lots" element={<ProduceLotsView />} />
    <Route path="/farmer/demands" element={<BuyerDemandsView />} />
    <Route path="/farmer/purchases" element={<PurchasesView />} />
    <Route path="/farmer/purchases/:id" element={<PurchaseDetailView />} />
    <Route path="/farmer/contracts" element={<BuyerContractsView />} />
    <Route path="/farmer/contracts/:id" element={<ContractDetailView />} />
    <Route path="/farmer/transport" element={<TransportBookingView />} />
    <Route path="/farmer/diary" element={<FarmDiaryView />} />
    <Route path="/farmer/pnl" element={<PnlDashboardView />} />
    <Route path="/farmer/equipment" element={<EquipmentRentalView />} />
    <Route path="/farmer/loans" element={<LoanFintechView />} />
    <Route path="/farmer/loans/:id" element={<LoanDetailView />} />
    <Route path="/farmer/bank-accounts" element={<BankAccountsView />} />
    <Route path="/farmer/insurance" element={<CropInsuranceView />} />
    <Route path="/farmer/insurance/policies" element={<PolicyListView />} />
    <Route path="/farmer/insurance/claims/:id" element={<ClaimTrackerView />} />
    <Route path="/farmer/712" element={<LandRecordsView />} />
    <Route path="/farmer/schemes" element={<GovtSchemesView />} />
    <Route path="/farmer/water" element={<WaterClimateView />} />
    <Route path="/farmer/vault" element={<VaultView />} />
    <Route path="/farmer/referrals" element={<ReferralsView />} />
    <Route path="/farmer/coins" element={<KisanCoinsView />} />
    <Route path="/farmer/dairy" element={<DairyHome />} />
  </>
);
