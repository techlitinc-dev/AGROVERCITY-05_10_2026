import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const SellerHome = lazy(() => import('./SellerHome').then((m) => ({ default: m.SellerHome })));
const SellerProfileView = lazy(() => import('./SellerProfileView').then((m) => ({ default: m.SellerProfileView })));
const SellerLotDiscoveryView = lazy(() => import('./SellerLotDiscoveryView').then((m) => ({ default: m.SellerLotDiscoveryView })));
const SellerDemandsManager = lazy(() => import('./SellerDemandsManager').then((m) => ({ default: m.SellerDemandsManager })));
const SellerMandiRatesPage = lazy(() => import('./SellerMandiRatesPage').then((m) => ({ default: m.SellerMandiRatesPage })));
const MyConnectionsView = lazy(() => import('../trade/MyConnectionsView').then((m) => ({ default: m.MyConnectionsView })));

/**
 * 4. Seller / Agri Vyapari — DIRECT-CONNECT trade hub.
 *
 * The direct-connect marketplace keeps only six destinations (spec §3B):
 * Home, Find Produce, Post Requirement, My Connections, Mandi Prices,
 * Profile & Verification. Legacy modules (POS, khata, mall storefront,
 * stock/resale, procurement/J-Form, purchases & escrow, settlements, wallet,
 * P&L, commission invoices, ads, coins/referrals, news/trees/7-12, industrial
 * buyer network, AI tools) are REMOVED from the primary navigation and their
 * routes redirect home for compatibility. Their view files remain in this
 * directory, unused, until a future cleanup — documented in the change notes.
 */
export const SellerRouteElements = () => (
  <>
    {/* Essential direct-connect destinations */}
    <Route path="/seller" element={<SellerHome />} />
    <Route path="/seller/lots" element={<SellerLotDiscoveryView />} />
    <Route path="/seller/demands" element={<SellerDemandsManager />} />
    <Route path="/seller/connections" element={<MyConnectionsView persona="seller" />} />
    <Route path="/seller/rates" element={<SellerMandiRatesPage />} />
    <Route path="/seller/profile" element={<SellerProfileView />} />

    {/* Legacy routes — disabled from the trade flow, redirect home.
        (purchases/pickup/direct-buyers/ai/ratings/ads/diary/chatbot/
        procure/procurement/stock/pos/finance/catalog/orders/compliance/
        analytics/settlements/pnl/news/coins/referrals/712/trees) */}
    <Route path="/seller/purchases" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/pickup" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/direct-buyers" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/ai" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/ratings" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/ads" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/diary" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/chatbot" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/procure" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/procurement" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/stock" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/pos" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/finance" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/catalog" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/orders" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/orders/:id" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/compliance" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/analytics" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/settlements" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/pnl" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/news" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/coins" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/referrals" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/712" element={<Navigate to="/seller" replace />} />
    <Route path="/seller/trees" element={<Navigate to="/seller" replace />} />
  </>
);
