import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const MilkSellerDesk = lazy(() =>
  import('../dairy/MilkSellerDesk').then((m) => ({ default: m.MilkSellerDesk }))
);
const VendorDesk = lazy(() =>
  import('./VendorDesk').then((m) => ({ default: m.VendorDesk }))
);
const MilkVendorDashboard = lazy(() =>
  import('./MilkVendorDashboard').then((m) => ({ default: m.MilkVendorDashboard }))
);

/** Milk Vendor (Doodh Vala) Persona Dedicated Routes */
export const MilkSellerRouteElements = () => (
  <>
    <Route path="/milkSeller/dashboard" element={<MilkVendorDashboard />} />
    {/* Persona root opens the dashboard; the Punch Sheet desk lives at /milkSeller/punch */}
    <Route path="/milkSeller" element={<Navigate to="/milkSeller/dashboard" replace />} />
    <Route path="/milkSeller/punch" element={<MilkSellerDesk initialTab="deliveries" />} />
    <Route path="/milkSeller/clients" element={<MilkSellerDesk initialTab="clients" />} />
    <Route path="/milkSeller/bills" element={<MilkSellerDesk initialTab="bills" />} />
    <Route path="/milkSeller/analytics" element={<MilkSellerDesk initialTab="analytics" />} />

    {/* Milk Vendor (Doodhwala) desk — Today, Clients, Bills & Payments, Milk & Rates, Settings */}
    <Route path="/milkSeller/vendor" element={<VendorDesk initialTab="today" />} />
    <Route path="/milkSeller/vendor/clients" element={<VendorDesk initialTab="clients" />} />
    <Route path="/milkSeller/vendor/bills" element={<VendorDesk initialTab="bills" />} />
    <Route path="/milkSeller/vendor/rates" element={<VendorDesk initialTab="rates" />} />
    <Route path="/milkSeller/vendor/settings" element={<VendorDesk initialTab="settings" />} />
  </>
);
