import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const MilkSellerDesk = lazy(() =>
  import('../dairy/MilkSellerDesk').then((m) => ({ default: m.MilkSellerDesk }))
);

/** Milk Vendor (Doodh Vala) Persona Dedicated Routes */
export const MilkSellerRouteElements = () => (
  <>
    <Route path="/milkSeller" element={<MilkSellerDesk initialTab="deliveries" />} />
    <Route path="/milkSeller/clients" element={<MilkSellerDesk initialTab="clients" />} />
    <Route path="/milkSeller/bills" element={<MilkSellerDesk initialTab="bills" />} />
    <Route path="/milkSeller/analytics" element={<MilkSellerDesk initialTab="analytics" />} />
  </>
);
