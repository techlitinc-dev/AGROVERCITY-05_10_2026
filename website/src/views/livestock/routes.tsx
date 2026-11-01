import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';

const GaushalaDashboard = lazy(() => import('./GaushalaDashboard').then((m) => ({ default: m.GaushalaDashboard })));
const GaushalaProfilePage = lazy(() => import('./GaushalaProfilePage').then((m) => ({ default: m.GaushalaProfilePage })));
const CattleInventoryView = lazy(() => import('./CattleInventoryView').then((m) => ({ default: m.CattleInventoryView })));
const AdoptionsDonationsView = lazy(() => import('./AdoptionsDonationsView').then((m) => ({ default: m.AdoptionsDonationsView })));
const ReceiptsRegister = lazy(() => import('./ReceiptsRegister').then((m) => ({ default: m.ReceiptsRegister })));
const GaushalaExpensesView = lazy(() => import('./GaushalaExpensesView').then((m) => ({ default: m.GaushalaExpensesView })));
const VetNetworkCampaigns = lazy(() =>
  import('../dairy/gaushala/VetNetworkCampaigns').then((m) => ({ default: m.VetNetworkCampaigns })),
);

/** Gaushala manager workspace (split out of the dairy domain).
 * v2: the veterinary doctor workspace (/vet*) and the dairy manager console
 * (/dairyManager, /dairy*) return here. */
export const LivestockRouteElements = () => (
  <>
    {/* Gaushala manager */}
    <Route path="/gaushalaManager" element={<GaushalaDashboard />} />
    <Route path="/gaushalaManager/profile" element={<GaushalaProfilePage />} />
    <Route path="/gaushalaManager/cattle" element={<CattleInventoryView />} />
    <Route path="/gaushalaManager/adoptions" element={<AdoptionsDonationsView />} />
    <Route path="/gaushalaManager/receipts" element={<ReceiptsRegister />} />
    <Route path="/gaushalaManager/expenses" element={<GaushalaExpensesView />} />
    {/* Gaushala manager's vet directory + vaccination campaigns */}
    <Route path="/gaushalaManager/vets" element={<VetNetworkCampaigns />} />
    {/* Convenience aliases */}
    <Route path="/gaushala" element={<Navigate to="/gaushalaManager" replace />} />
    <Route path="/dairy/gaushala" element={<Navigate to="/gaushalaManager" replace />} />
  </>
);
