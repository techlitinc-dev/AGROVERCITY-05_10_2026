import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const TransporterHome = lazy(() => import('./TransporterHome').then((m) => ({ default: m.TransporterHome })));
const TripDetailView = lazy(() => import('./TripDetailView').then((m) => ({ default: m.TripDetailView })));
const JobInboxView = lazy(() => import('./JobInboxView').then((m) => ({ default: m.JobInboxView })));
const FleetView = lazy(() => import('./FleetView').then((m) => ({ default: m.FleetView })));
const TransportWalletView = lazy(() => import('./TransportWalletView').then((m) => ({ default: m.TransportWalletView })));
const TransportComplianceView = lazy(() => import('./TransportComplianceView').then((m) => ({ default: m.TransportComplianceView })));

/** 3. Transporter Logistics Hub */
export const TransporterRouteElements = () => (
  <>
    <Route path="/transporter" element={<TransporterHome />} />
    <Route path="/transporter/loads" element={<TransporterHome />} />
    <Route path="/transporter/trips" element={<TransporterHome />} />
    <Route path="/transporter/trips/:id" element={<TripDetailView />} />
    <Route path="/transporter/inbox" element={<JobInboxView />} />
    <Route path="/transporter/bilty" element={<TransporterHome />} />
    <Route path="/transporter/settlements" element={<TransporterHome />} />
    <Route path="/transporter/fleet" element={<FleetView />} />
    <Route path="/transporter/wallet" element={<TransportWalletView />} />
    <Route path="/transporter/compliance" element={<TransportComplianceView />} />
  </>
);
