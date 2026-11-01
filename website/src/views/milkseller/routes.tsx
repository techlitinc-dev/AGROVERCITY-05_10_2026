import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const MilkSellerDesk = lazy(() =>
  import('../dairy/MilkSellerDesk').then((m) => ({ default: m.MilkSellerDesk }))
);
const VendorDesk = lazy(() =>
  import('./VendorDesk').then((m) => ({ default: m.VendorDesk }))
);

/** Milk Vendor (Doodh Vala) Persona Dedicated Routes */
export const MilkSellerRouteElements = () => (
  <>
    <Route path="/milkSeller" element={<MilkSellerDesk initialTab="deliveries" />} />
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
