import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const EquipmentOwnerHome = lazy(() => import('./EquipmentOwnerHome').then((m) => ({ default: m.EquipmentOwnerHome })));

/** 5. Equipment Owner Console */
export const EquipmentRouteElements = () => (
  <>
    <Route path="/equipmentOwner" element={<EquipmentOwnerHome />} />
    <Route path="/equipment" element={<EquipmentOwnerHome />} />
    <Route path="/equipment/fleet" element={<EquipmentOwnerHome />} />
    <Route path="/equipment/calendar" element={<EquipmentOwnerHome />} />
    <Route path="/equipment/bookings" element={<EquipmentOwnerHome />} />
    <Route path="/equipment/roi" element={<EquipmentOwnerHome />} />
  </>
);
