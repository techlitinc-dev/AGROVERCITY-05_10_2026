import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const EquipmentOwnerHome = lazy(() => import('./EquipmentOwnerHome').then((m) => ({ default: m.EquipmentOwnerHome })));
const EquipmentMachinesView = lazy(() => import('./EquipmentMachinesView').then((m) => ({ default: m.EquipmentMachinesView })));
const EquipmentAvailabilityView = lazy(() => import('./EquipmentAvailabilityView').then((m) => ({ default: m.EquipmentAvailabilityView })));
const EquipmentRequestsView = lazy(() => import('./EquipmentRequestsView').then((m) => ({ default: m.EquipmentRequestsView })));
const EquipmentJobsView = lazy(() => import('./EquipmentJobsView').then((m) => ({ default: m.EquipmentJobsView })));

/**
 * 5. Equipment Owner — DIRECT-CONNECT service hub.
 *
 * Essential destinations only (spec §4): Home, My Equipment, Availability,
 * Booking Requests, My Jobs, Profile & Verification (the shared /profile
 * route). Legacy modules (damage-claim settlements, ROI/market intel,
 * maintenance suite, gate-PIN dispatch, TDS statements) are removed from the
 * primary surface; their routes redirect for compatibility. The old view
 * files remain in this directory, unused, until a future cleanup.
 */
export const EquipmentRouteElements = () => (
  <>
    {/* Essential direct-connect destinations */}
    <Route path="/equipmentOwner" element={<EquipmentOwnerHome />} />
    <Route path="/equipment" element={<EquipmentOwnerHome />} />
    <Route path="/equipment/machines" element={<EquipmentMachinesView />} />
    <Route path="/equipment/availability" element={<EquipmentAvailabilityView />} />
    <Route path="/equipment/requests" element={<EquipmentRequestsView />} />
    <Route path="/equipment/jobs" element={<EquipmentJobsView />} />

    {/* Legacy routes — disabled from the direct-connect flow, redirected.
        (fleet→machines, calendar→availability, bookings→requests,
        claims/settlements/roi/market retired to home) */}
    <Route path="/equipment/fleet" element={<Navigate to="/equipment/machines" replace />} />
    <Route path="/equipment/calendar" element={<Navigate to="/equipment/availability" replace />} />
    <Route path="/equipment/bookings" element={<Navigate to="/equipment/requests" replace />} />
    <Route path="/equipment/claims" element={<Navigate to="/equipment" replace />} />
    <Route path="/equipment/settlements" element={<Navigate to="/equipment" replace />} />
    <Route path="/equipment/roi" element={<Navigate to="/equipment" replace />} />
    <Route path="/equipment/market" element={<Navigate to="/equipment" replace />} />
  </>
);
