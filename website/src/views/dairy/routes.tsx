import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';

const DairyHome = lazy(() => import('./DairyHome').then((m) => ({ default: m.DairyHome })));
const DairyMembersPage = lazy(() => import('./DairyMembersPage').then((m) => ({ default: m.DairyMembersPage })));
const DairyRateChartPage = lazy(() => import('./DairyRateChartPage').then((m) => ({ default: m.DairyRateChartPage })));
const DairyPaymentsPage = lazy(() => import('./DairyPaymentsPage').then((m) => ({ default: m.DairyPaymentsPage })));
const DairySalesPage = lazy(() => import('./DairySalesPage').then((m) => ({ default: m.DairySalesPage })));
const DairyReportsPage = lazy(() => import('./DairyReportsPage').then((m) => ({ default: m.DairyReportsPage })));
const DairyMarketPage = lazy(() => import('./DairyMarketPage').then((m) => ({ default: m.DairyMarketPage })));
const MilkSellerDesk = lazy(() => import('./MilkSellerDesk').then((m) => ({ default: m.MilkSellerDesk })));
const VetNetworkCampaigns = lazy(() =>
  import('./gaushala/VetNetworkCampaigns').then((m) => ({ default: m.VetNetworkCampaigns })),
);

/** 8. Dairy manager console + milk seller desk + gaushala vet-network surface. */
export const DairyRouteElements = () => (
  <>
    <Route path="/dairyManager" element={<DairyHome />} />
    <Route path="/dairy" element={<DairyHome />} />
    <Route path="/dairy/members" element={<DairyMembersPage />} />
    <Route path="/dairy/batches" element={<DairyPaymentsPage />} />
    <Route path="/dairy/rates" element={<DairyRateChartPage />} />
    <Route path="/dairy/market" element={<DairyMarketPage />} />
    <Route path="/dairy/sales" element={<DairySalesPage />} />
    <Route path="/dairy/reports" element={<DairyReportsPage />} />
    <Route path="/milkSeller" element={<MilkSellerDesk />} />
    {/* Gaushala + vet workspaces live in views/livestock/routes.tsx (LivestockRouteElements) */}
    <Route path="/dairy/gaushala" element={<Navigate to="/gaushalaManager" replace />} />
    <Route path="/dairy/vets" element={<Navigate to="/vet" replace />} />
    {/* Gaushala manager's vet directory + vaccination campaigns (livestock-domain) */}
    <Route path="/gaushalaManager/vets" element={<VetNetworkCampaigns />} />
  </>
);
