import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const FarmerHome = lazy(() => import('./FarmerHome').then((m) => ({ default: m.FarmerHome })));
const MandiPricesView = lazy(() => import('./MandiPricesView').then((m) => ({ default: m.MandiPricesView })));
const ProduceLotsView = lazy(() => import('./ProduceLotsView').then((m) => ({ default: m.ProduceLotsView })));
const BuyerDemandsView = lazy(() => import('./BuyerDemandsView').then((m) => ({ default: m.BuyerDemandsView })));
const AgriExportView = lazy(() => import('./AgriExportView').then((m) => ({ default: m.AgriExportView })));
const MyIndustrialApplicationsView = lazy(() => import('./MyIndustrialApplicationsView').then((m) => ({ default: m.MyIndustrialApplicationsView })));
const TransportBookingView = lazy(() => import('./TransportBookingView').then((m) => ({ default: m.TransportBookingView })));
const TransportBookingDetailView = lazy(() => import('./TransportBookingDetailView').then((m) => ({ default: m.TransportBookingDetailView })));
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
const LivestockHubView = lazy(() => import('./LivestockHubView').then((m) => ({ default: m.LivestockHubView })));
const MyCropsView = lazy(() => import('./MyCropsView').then((m) => ({ default: m.MyCropsView })));
const AiCropPlanView = lazy(() => import('./AiCropPlanView').then((m) => ({ default: m.AiCropPlanView })));
const AiCropDoctorView = lazy(() => import('./AiCropDoctorView').then((m) => ({ default: m.AiCropDoctorView })));
const MyConnectionsView = lazy(() => import('../trade/MyConnectionsView').then((m) => ({ default: m.MyConnectionsView })));
const PostToBuyersView = lazy(() => import('./PostToBuyersView').then((m) => ({ default: m.PostToBuyersView })));
const FarmlandView = lazy(() => import('./FarmlandView').then((m) => ({ default: m.FarmlandView })));

/** 1. Farmer / Kisan Hub (18 journeys) */
export const FarmerRouteElements = () => (
  <>
    <Route path="/farmer" element={<FarmerHome />} />
    <Route path="/farmer/crop-doctor" element={<AiCropDoctorView />} />
    <Route path="/farmer/mandi" element={<MandiPricesView />} />
    <Route path="/farmer/lots" element={<ProduceLotsView />} />
    <Route path="/farmer/land" element={<FarmlandView />} />
    <Route path="/farmer/demands" element={<BuyerDemandsView />} />
    <Route path="/farmer/industrial" element={<BuyerDemandsView />} />
    {/* My Industrial Applications merged into My Industry as a tab. */}
    <Route path="/farmer/industrial/applications" element={<Navigate to="/farmer/demands?tab=applications" replace />} />
    <Route path="/farmer/post-to-buyers" element={<PostToBuyersView />} />
    <Route path="/farmer/connections" element={<MyConnectionsView persona="farmer" />} />
    <Route path="/farmer/transport" element={<TransportBookingView />} />
    <Route path="/farmer/transport/:id" element={<TransportBookingDetailView />} />
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
    {/* My Milk & Payments is a milk-vendor desk feature — removed from the
        farmer persona (manual-test finding); the route redirects for compat. */}
    <Route path="/farmer/dairy" element={<Navigate to="/farmer" replace />} />
    <Route path="/farmer/livestock" element={<LivestockHubView />} />
    <Route path="/farmer/crops" element={<MyCropsView />} />
    <Route path="/farmer/crop-plan" element={<AiCropPlanView />} />
    {/* Export sourcing — merged Agri Export desk (opportunities / applications /
        connections / readiness live as tabs on /farmer/export) */}
    <Route path="/farmer/export" element={<AgriExportView />} />
    <Route path="/farmer/export/applications" element={<Navigate to="/farmer/export?tab=applications" replace />} />
    <Route path="/farmer/export/connections" element={<Navigate to="/farmer/export?tab=connections" replace />} />
    <Route path="/farmer/export/readiness" element={<Navigate to="/farmer/export?tab=readiness" replace />} />
  </>
);
