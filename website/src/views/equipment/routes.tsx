import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const EquipmentOwnerHome = lazy(() => import('./EquipmentOwnerHome').then((m) => ({ default: m.EquipmentOwnerHome })));
const EquipmentFleetView = lazy(() => import('./EquipmentFleetView').then((m) => ({ default: m.EquipmentFleetView })));
const EquipmentBookingsView = lazy(() => import('./EquipmentBookingsView').then((m) => ({ default: m.EquipmentBookingsView })));
const EquipmentClaimsView = lazy(() => import('./EquipmentClaimsView').then((m) => ({ default: m.EquipmentClaimsView })));
const EquipmentSettlementsView = lazy(() => import('./EquipmentSettlementsView').then((m) => ({ default: m.EquipmentSettlementsView })));
const EquipmentMarketIntelView = lazy(() => import('./EquipmentMarketIntelView').then((m) => ({ default: m.EquipmentMarketIntelView })));

/** 5. Equipment Owner Console Routes */
export const EquipmentRouteElements = () => (
  <>
    <Route path="/equipmentOwner" element={<EquipmentOwnerHome />} />
    <Route path="/equipment" element={<EquipmentOwnerHome />} />
    <Route path="/equipment/fleet" element={<EquipmentFleetView />} />
    <Route path="/equipment/bookings" element={<EquipmentBookingsView />} />
    <Route path="/equipment/claims" element={<EquipmentClaimsView />} />
    <Route path="/equipment/settlements" element={<EquipmentSettlementsView />} />
    <Route path="/equipment/roi" element={<EquipmentSettlementsView />} />
    <Route path="/equipment/market" element={<EquipmentMarketIntelView />} />
    <Route path="/equipment/calendar" element={<EquipmentFleetView />} />
  </>
);
