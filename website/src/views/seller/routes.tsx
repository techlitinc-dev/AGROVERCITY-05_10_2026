import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const SellerHome = lazy(() => import('./SellerHome').then((m) => ({ default: m.SellerHome })));
const SellerProfileView = lazy(() => import('./SellerProfileView').then((m) => ({ default: m.SellerProfileView })));
const SellerLotDiscoveryView = lazy(() => import('./SellerLotDiscoveryView').then((m) => ({ default: m.SellerLotDiscoveryView })));
const SellerPurchasesView = lazy(() => import('./SellerPurchasesView').then((m) => ({ default: m.SellerPurchasesView })));
const SellerAiInsightsView = lazy(() => import('./SellerAiInsightsView').then((m) => ({ default: m.SellerAiInsightsView })));
const SellerDirectBuyersView = lazy(() => import('./SellerDirectBuyersView').then((m) => ({ default: m.SellerDirectBuyersView })));
const SellerRatingsView = lazy(() => import('./SellerRatingsView').then((m) => ({ default: m.SellerRatingsView })));
const SellerAdsView = lazy(() => import('./SellerAdsView').then((m) => ({ default: m.SellerAdsView })));
const SellerDiaryView = lazy(() => import('./SellerDiaryView').then((m) => ({ default: m.SellerDiaryView })));
const SellerChatbotView = lazy(() => import('./SellerChatbotView').then((m) => ({ default: m.SellerChatbotView })));
const SellerDemandsManager = lazy(() => import('./SellerDemandsManager').then((m) => ({ default: m.SellerDemandsManager })));
const SellerProcurementPage = lazy(() => import('./SellerProcurementPage').then((m) => ({ default: m.SellerProcurementPage })));
const SellerStockPage = lazy(() => import('./SellerStockPage').then((m) => ({ default: m.SellerStockPage })));
const SellerOrderDetailPage = lazy(() => import('./SellerOrderDetailPage').then((m) => ({ default: m.SellerOrderDetailPage })));
const SellerPosPage = lazy(() => import('./SellerPosPage').then((m) => ({ default: m.SellerPosPage })));
const SellerMandiRatesPage = lazy(() => import('./SellerMandiRatesPage').then((m) => ({ default: m.SellerMandiRatesPage })));
const SellerAnalyticsPage = lazy(() => import('./SellerAnalyticsPage').then((m) => ({ default: m.SellerAnalyticsPage })));
const SellerCompliancePage = lazy(() => import('./SellerCompliancePage').then((m) => ({ default: m.SellerCompliancePage })));
const SellerSettlementsView = lazy(() => import('./SellerSettlementsView').then((m) => ({ default: m.SellerSettlementsView })));
const SellerPnlView = lazy(() => import('./SellerPnlView').then((m) => ({ default: m.SellerPnlView })));

// Shared platform utilities for Vyapari
const KisanCoinsView = lazy(() => import('../community/KisanCoinsView').then((m) => ({ default: m.KisanCoinsView })));
const ReferralsView = lazy(() => import('../farmer/ReferralsView').then((m) => ({ default: m.ReferralsView })));
const LandRecordsView = lazy(() => import('../farmer/LandRecordsView').then((m) => ({ default: m.LandRecordsView })));
const TreePlantationView = lazy(() => import('../community/TreePlantationView').then((m) => ({ default: m.TreePlantationView })));
const AgriNewsChannelsView = lazy(() => import('../community/AgriNewsChannelsView').then((m) => ({ default: m.AgriNewsChannelsView })));

/**
 * 4. Seller / Vyapari Hub (Complete 23 Page & Feature Suite).
 */
export const SellerRouteElements = () => (
  <>
    {/* Core Vyapari Cockpit & Profile */}
    <Route path="/seller" element={<SellerHome />} />
    <Route path="/seller/profile" element={<SellerProfileView />} />

    {/* Produce Marketplace & Trade Lifecycle */}
    <Route path="/seller/lots" element={<SellerLotDiscoveryView />} />
    <Route path="/seller/purchases" element={<SellerPurchasesView />} />
    <Route path="/seller/pickup" element={<Navigate to="/seller/purchases" replace />} />
    <Route path="/seller/direct-buyers" element={<SellerDirectBuyersView />} />
    <Route path="/seller/ai" element={<SellerAiInsightsView />} />

    {/* Rates & Trade Relations */}
    <Route path="/seller/rates" element={<SellerMandiRatesPage />} />
    <Route path="/seller/ratings" element={<SellerRatingsView />} />
    <Route path="/seller/ads" element={<SellerAdsView />} />
    <Route path="/seller/diary" element={<SellerDiaryView />} />
    <Route path="/seller/chatbot" element={<SellerChatbotView />} />

    {/* Procurement & Storefront Operations */}
    <Route path="/seller/procure" element={<SellerProcurementPage />} />
    <Route path="/seller/procurement" element={<SellerProcurementPage />} />
    <Route path="/seller/demands" element={<SellerDemandsManager />} />
    <Route path="/seller/stock" element={<SellerStockPage />} />
    <Route path="/seller/pos" element={<SellerPosPage />} />
    <Route path="/seller/finance" element={<SellerPosPage />} />
    <Route path="/seller/catalog" element={<SellerHome />} />
    <Route path="/seller/orders" element={<SellerHome />} />
    <Route path="/seller/orders/:id" element={<SellerOrderDetailPage />} />
    <Route path="/seller/compliance" element={<SellerCompliancePage />} />
    <Route path="/seller/analytics" element={<SellerAnalyticsPage />} />
    <Route path="/seller/settlements" element={<SellerSettlementsView />} />
    <Route path="/seller/pnl" element={<SellerPnlView />} />

    {/* Shared Platform Utilities for Vyapari */}
    <Route path="/seller/news" element={<AgriNewsChannelsView />} />
    <Route path="/seller/coins" element={<KisanCoinsView />} />
    <Route path="/seller/referrals" element={<ReferralsView />} />
    <Route path="/seller/712" element={<LandRecordsView />} />
    <Route path="/seller/trees" element={<TreePlantationView />} />
  </>
);
