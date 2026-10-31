import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const LandlordHome = lazy(() => import('./LandlordHome').then((m) => ({ default: m.LandlordHome })));
const LandlordListingsView = lazy(() => import('./LandlordListingsView').then((m) => ({ default: m.LandlordListingsView })));
const LandlordRequestsView = lazy(() => import('./LandlordRequestsView').then((m) => ({ default: m.LandlordRequestsView })));
const LandlordConnectionsView = lazy(() => import('./LandlordConnectionsView').then((m) => ({ default: m.LandlordConnectionsView })));

/** Land Verification destination — the document-verification surface lives
 * inside My Land Listings (spec §4 keeps it as a simple destination). */
const LandVerificationRedirect: React.FC = () => <Navigate to="/landlord/listings" replace />;

/**
 * 2. Farm Landlord — DIRECT-CONNECT farmland-leasing hub.
 *
 * Essential destinations only (spec §4): Home, My Land Listings, Land
 * Verification, Interest Requests, My Connections / Leases, Profile &
 * Verification (shared /profile). Legacy modules (rent collection & ledger,
 * settlements, profit dashboard, plots registry, leads CRM, lease detail
 * management, agreement PDFs) are removed from the primary surface; their
 * routes redirect for compatibility and the old view files remain on disk.
 */
export const LandlordRouteElements = () => (
  <>
    {/* Essential direct-connect destinations */}
    <Route path="/landlord" element={<LandlordHome />} />
    <Route path="/landlord/listings" element={<LandlordListingsView />} />
    <Route path="/landlord/verification" element={<LandVerificationRedirect />} />
    <Route path="/landlord/requests" element={<LandlordRequestsView />} />
    <Route path="/landlord/connections" element={<LandlordConnectionsView />} />

    {/* Legacy routes — disabled from the leasing flow, redirected.
        (listings/:id manage → listings, plots/leads/rent/profit/inbox/
        leases retired to their direct-connect counterparts) */}
    <Route path="/landlord/listings/:id" element={<Navigate to="/landlord/listings" replace />} />
    <Route path="/landlord/plots" element={<Navigate to="/landlord/listings" replace />} />
    <Route path="/landlord/leads" element={<Navigate to="/landlord/connections" replace />} />
    <Route path="/landlord/inbox" element={<Navigate to="/landlord/requests" replace />} />
    <Route path="/landlord/rent" element={<Navigate to="/landlord" replace />} />
    <Route path="/landlord/profit" element={<Navigate to="/landlord" replace />} />
    <Route path="/landlord/leases/:id" element={<Navigate to="/landlord/connections" replace />} />
  </>
);
