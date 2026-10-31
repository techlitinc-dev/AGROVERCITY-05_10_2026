import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const TransporterHome = lazy(() => import('./TransporterHome').then((m) => ({ default: m.TransporterHome })));
const TripDetailView = lazy(() => import('./TripDetailView').then((m) => ({ default: m.TripDetailView })));
const JobInboxView = lazy(() => import('./JobInboxView').then((m) => ({ default: m.JobInboxView })));
const FleetView = lazy(() => import('./FleetView').then((m) => ({ default: m.FleetView })));
const TransportComplianceView = lazy(() => import('./TransportComplianceView').then((m) => ({ default: m.TransportComplianceView })));
const TransporterProfileView = lazy(() => import('./TransporterProfileView').then((m) => ({ default: m.TransporterProfileView })));
const TransporterRatingsView = lazy(() => import('./TransporterRatingsView').then((m) => ({ default: m.TransporterRatingsView })));
const TransporterAdsView = lazy(() => import('./TransporterAdsView').then((m) => ({ default: m.TransporterAdsView })));
const TransporterDiaryView = lazy(() => import('./TransporterDiaryView').then((m) => ({ default: m.TransporterDiaryView })));

/** 3. Transporter Logistics Hub — cockpit (load board / trips / bilty / P&L
 * tabs), fleet, booking requests, ratings, ads, diary, profile. */
export const TransporterRouteElements = () => (
  <>
    <Route path="/transporter" element={<TransporterHome />} />
    {/* Tab deep-links — all render the cockpit with the matching tab. */}
    <Route path="/transporter/loads" element={<TransporterHome />} />
    <Route path="/transporter/trips" element={<TransporterHome />} />
    <Route path="/transporter/bilty" element={<TransporterHome />} />
    <Route path="/transporter/settlements" element={<TransporterHome />} />
    <Route path="/transporter/trips/:id" element={<TripDetailView />} />
    <Route path="/transporter/inbox" element={<JobInboxView />} />
    <Route path="/transporter/fleet" element={<FleetView />} />
    <Route path="/transporter/compliance" element={<TransportComplianceView />} />
    <Route path="/transporter/profile" element={<TransporterProfileView />} />
    <Route path="/transporter/ratings" element={<TransporterRatingsView />} />
    <Route path="/transporter/ads" element={<TransporterAdsView />} />
    <Route path="/transporter/diary" element={<TransporterDiaryView />} />
  </>
);
