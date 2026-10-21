import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const TransporterHome = lazy(() => import('./TransporterHome').then((m) => ({ default: m.TransporterHome })));
const TripDetailView = lazy(() => import('./TripDetailView').then((m) => ({ default: m.TripDetailView })));
const JobInboxView = lazy(() => import('./JobInboxView').then((m) => ({ default: m.JobInboxView })));
const FleetView = lazy(() => import('./FleetView').then((m) => ({ default: m.FleetView })));
const TransportWalletView = lazy(() => import('./TransportWalletView').then((m) => ({ default: m.TransportWalletView })));
const TransportComplianceView = lazy(() => import('./TransportComplianceView').then((m) => ({ default: m.TransportComplianceView })));
const TransporterProfileView = lazy(() => import('./TransporterProfileView').then((m) => ({ default: m.TransporterProfileView })));
const TransporterBookingsView = lazy(() => import('./TransporterBookingsView').then((m) => ({ default: m.TransporterBookingsView })));
const TransporterRatingsView = lazy(() => import('./TransporterRatingsView').then((m) => ({ default: m.TransporterRatingsView })));
const TransporterAdsView = lazy(() => import('./TransporterAdsView').then((m) => ({ default: m.TransporterAdsView })));
const TransporterAiView = lazy(() => import('./TransporterAiView').then((m) => ({ default: m.TransporterAiView })));
const TransporterChatbotView = lazy(() => import('./TransporterChatbotView').then((m) => ({ default: m.TransporterChatbotView })));
const TransporterDiaryView = lazy(() => import('./TransporterDiaryView').then((m) => ({ default: m.TransporterDiaryView })));

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
    <Route path="/transporter/profile" element={<TransporterProfileView />} />
    <Route path="/transporter/bookings" element={<TransporterBookingsView />} />
    <Route path="/transporter/ratings" element={<TransporterRatingsView />} />
    <Route path="/transporter/ads" element={<TransporterAdsView />} />
    <Route path="/transporter/ai" element={<TransporterAiView />} />
    <Route path="/transporter/chatbot" element={<TransporterChatbotView />} />
    <Route path="/transporter/diary" element={<TransporterDiaryView />} />
  </>
);
