import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

// Core Nursery Views
const NurseryHome = lazy(() => import('./NurseryHome').then((m) => ({ default: m.NurseryHome })));
const NurseryProfileView = lazy(() => import('./NurseryProfileView').then((m) => ({ default: m.NurseryProfileView })));
const NurseryInventoryView = lazy(() => import('./NurseryInventoryView').then((m) => ({ default: m.NurseryInventoryView })));
const NurseryBatchesView = lazy(() => import('./NurseryBatchesView').then((m) => ({ default: m.NurseryBatchesView })));
const NurseryOrdersView = lazy(() => import('./NurseryOrdersView').then((m) => ({ default: m.NurseryOrdersView })));
const NurseryRatingsView = lazy(() => import('./NurseryRatingsView').then((m) => ({ default: m.NurseryRatingsView })));
const NurseryOffersView = lazy(() => import('./NurseryOffersView').then((m) => ({ default: m.NurseryOffersView })));
const NurseryPayoutsView = lazy(() => import('./NurseryPayoutsView').then((m) => ({ default: m.NurseryPayoutsView })));
const NurseryAiView = lazy(() => import('./NurseryAiView').then((m) => ({ default: m.NurseryAiView })));
const NurseryDiaryView = lazy(() => import('./NurseryDiaryView').then((m) => ({ default: m.NurseryDiaryView })));
const NurseryChatbotView = lazy(() => import('./NurseryChatbotView').then((m) => ({ default: m.NurseryChatbotView })));

// Shared utilities
const CustomerHomeView = lazy(() => import('../mall/CustomerHomeView').then((m) => ({ default: m.CustomerHomeView })));
const PnlDashboardView = lazy(() => import('../farmer/PnlDashboardView').then((m) => ({ default: m.PnlDashboardView })));
const SellerAdsView = lazy(() => import('../seller/SellerAdsView').then((m) => ({ default: m.SellerAdsView })));
const CourseCatalogView = lazy(() => import('../academy/CourseCatalogView').then((m) => ({ default: m.CourseCatalogView })));
const AgriNewsChannelsView = lazy(() => import('../community/AgriNewsChannelsView').then((m) => ({ default: m.AgriNewsChannelsView })));
const ReferralsView = lazy(() => import('../farmer/ReferralsView').then((m) => ({ default: m.ReferralsView })));
const KisanCoinsView = lazy(() => import('../community/KisanCoinsView').then((m) => ({ default: m.KisanCoinsView })));
const TreePlantationView = lazy(() => import('../community/TreePlantationView').then((m) => ({ default: m.TreePlantationView })));
const LandRecordsView = lazy(() => import('../farmer/LandRecordsView').then((m) => ({ default: m.LandRecordsView })));
const SettingsPage = lazy(() => import('../shared/SettingsPage').then((m) => ({ default: m.SettingsPage })));

/**
 * Complete Nursery Persona Routes (21 Pages & Feature Suite).
 */
export const NurseryRouteElements = () => (
  <>
    {/* Core Operations */}
    <Route path="/nursery" element={<NurseryHome />} />
    <Route path="/nursery/profile" element={<NurseryProfileView />} />
    <Route path="/nursery/inventory" element={<NurseryInventoryView />} />
    <Route path="/nursery/batches" element={<NurseryBatchesView />} />
    <Route path="/nursery/orders" element={<NurseryOrdersView />} />
    <Route path="/nursery/ratings" element={<NurseryRatingsView />} />

    {/* Growth & Business */}
    <Route path="/nursery/offers" element={<NurseryOffersView />} />
    <Route path="/nursery/payouts" element={<NurseryPayoutsView />} />
    <Route path="/nursery/ai" element={<NurseryAiView />} />
    <Route path="/nursery/diary" element={<NurseryDiaryView />} />
    <Route path="/nursery/ads" element={<SellerAdsView />} />
    <Route path="/nursery/finance" element={<PnlDashboardView />} />

    {/* Shared Ecosystem & Utilities */}
    <Route path="/nursery/shop" element={<CustomerHomeView />} />
    <Route path="/nursery/chatbot" element={<NurseryChatbotView />} />
    <Route path="/nursery/gyan" element={<CourseCatalogView />} />
    <Route path="/nursery/news" element={<AgriNewsChannelsView />} />
    <Route path="/nursery/coins" element={<KisanCoinsView />} />
    <Route path="/nursery/referrals" element={<ReferralsView />} />
    <Route path="/nursery/trees" element={<TreePlantationView />} />
    <Route path="/nursery/land-records" element={<LandRecordsView />} />
    <Route path="/nursery/712" element={<Navigate to="/nursery/land-records" replace />} />
    <Route path="/nursery/settings" element={<SettingsPage />} />
  </>
);
