import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';

const GaushalaDashboard = lazy(() => import('./GaushalaDashboard').then((m) => ({ default: m.GaushalaDashboard })));
const GaushalaProfilePage = lazy(() => import('./GaushalaProfilePage').then((m) => ({ default: m.GaushalaProfilePage })));
const CattleInventoryView = lazy(() => import('./CattleInventoryView').then((m) => ({ default: m.CattleInventoryView })));
const AdoptionsDonationsView = lazy(() => import('./AdoptionsDonationsView').then((m) => ({ default: m.AdoptionsDonationsView })));
const ReceiptsRegister = lazy(() => import('./ReceiptsRegister').then((m) => ({ default: m.ReceiptsRegister })));
const GaushalaExpensesView = lazy(() => import('./GaushalaExpensesView').then((m) => ({ default: m.GaushalaExpensesView })));
const VetWorkspace = lazy(() => import('./VetWorkspace').then((m) => ({ default: m.VetWorkspace })));
const VetScheduleEditor = lazy(() => import('./VetScheduleEditor').then((m) => ({ default: m.VetScheduleEditor })));
const VetAppointmentsView = lazy(() => import('./VetAppointmentsView').then((m) => ({ default: m.VetAppointmentsView })));
const VetCampaignsView = lazy(() => import('./VetCampaignsView').then((m) => ({ default: m.VetCampaignsView })));
const VetEarningsView = lazy(() => import('./VetEarningsView').then((m) => ({ default: m.VetEarningsView })));
const VetRecordsView = lazy(() => import('./VetRecordsView').then((m) => ({ default: m.VetRecordsView })));

/** Gaushala manager + veterinarian workspaces (split out of the dairy domain). */
export const LivestockRouteElements = () => (
  <>
    {/* Gaushala manager */}
    <Route path="/gaushalaManager" element={<GaushalaDashboard />} />
    <Route path="/gaushalaManager/profile" element={<GaushalaProfilePage />} />
    <Route path="/gaushalaManager/cattle" element={<CattleInventoryView />} />
    <Route path="/gaushalaManager/adoptions" element={<AdoptionsDonationsView />} />
    <Route path="/gaushalaManager/receipts" element={<ReceiptsRegister />} />
    <Route path="/gaushalaManager/expenses" element={<GaushalaExpensesView />} />
    {/* Vet workspace */}
    <Route path="/vet" element={<VetWorkspace />} />
    <Route path="/vet/schedule" element={<VetScheduleEditor />} />
    <Route path="/vet/appointments" element={<VetAppointmentsView />} />
    <Route path="/vet/campaigns" element={<VetCampaignsView />} />
    <Route path="/vet/earnings" element={<VetEarningsView />} />
    <Route path="/vet/records" element={<VetRecordsView />} />
    {/* Convenience aliases */}
    <Route path="/gaushala" element={<Navigate to="/gaushalaManager" replace />} />
    <Route path="/vets/me" element={<Navigate to="/vet" replace />} />
  </>
);
