import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const DirectBuyerHome = lazy(() => import('./DirectBuyerHome').then((m) => ({ default: m.DirectBuyerHome })));
const BuyerContractDesk = lazy(() => import('./BuyerContractDesk').then((m) => ({ default: m.BuyerContractDesk })));
const BuyerIntelPage = lazy(() => import('./BuyerIntelPage').then((m) => ({ default: m.BuyerIntelPage })));
const OfferInboxPage = lazy(() => import('./OfferInboxPage').then((m) => ({ default: m.OfferInboxPage })));
const BuyerFeedPage = lazy(() => import('./BuyerFeedPage').then((m) => ({ default: m.BuyerFeedPage })));
const PurchaseDetailPage = lazy(() => import('./PurchaseDetailPage').then((m) => ({ default: m.PurchaseDetailPage })));
const StandingOrdersPage = lazy(() => import('./StandingOrdersPage').then((m) => ({ default: m.StandingOrdersPage })));
const BuyerAnalyticsPage = lazy(() => import('./BuyerAnalyticsPage').then((m) => ({ default: m.BuyerAnalyticsPage })));
const BuyerTeamPage = lazy(() => import('./BuyerTeamPage').then((m) => ({ default: m.BuyerTeamPage })));
const BuyerOrgSetupPage = lazy(() => import('./BuyerOrgSetupPage').then((m) => ({ default: m.BuyerOrgSetupPage })));

/**
 * 6. Direct Buyer Console. `/directbuyer/contracts` renders the buyer-owned
 * BuyerContractDesk (the old farmer BuyerContractsView borrow is replaced
 * here without touching the farmer folder).
 */
export const DirectBuyerRouteElements = () => (
  <>
    <Route path="/directBuyer" element={<DirectBuyerHome />} />
    <Route path="/directbuyer" element={<DirectBuyerHome />} />
    <Route path="/directbuyer/demands" element={<DirectBuyerHome />} />
    <Route path="/directbuyer/qc" element={<DirectBuyerHome />} />
    <Route path="/directbuyer/contracts" element={<BuyerContractDesk />} />
    <Route path="/directbuyer/intel" element={<BuyerIntelPage />} />
    <Route path="/directbuyer/offers" element={<OfferInboxPage />} />
    <Route path="/directbuyer/feed" element={<BuyerFeedPage />} />
    <Route path="/directbuyer/purchases/:id" element={<PurchaseDetailPage />} />
    <Route path="/directbuyer/standing" element={<StandingOrdersPage />} />
    <Route path="/directbuyer/analytics" element={<BuyerAnalyticsPage />} />
    <Route path="/directbuyer/team" element={<BuyerTeamPage />} />
    <Route path="/directbuyer/org" element={<BuyerOrgSetupPage />} />
  </>
);
