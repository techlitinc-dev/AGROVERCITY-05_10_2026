import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const SellerHome = lazy(() => import('./SellerHome').then((m) => ({ default: m.SellerHome })));
const SellerDemandsManager = lazy(() => import('./SellerDemandsManager').then((m) => ({ default: m.SellerDemandsManager })));
const SellerProcurementPage = lazy(() => import('./SellerProcurementPage').then((m) => ({ default: m.SellerProcurementPage })));
const SellerStockPage = lazy(() => import('./SellerStockPage').then((m) => ({ default: m.SellerStockPage })));
const SellerOrderDetailPage = lazy(() => import('./SellerOrderDetailPage').then((m) => ({ default: m.SellerOrderDetailPage })));
const SellerPosPage = lazy(() => import('./SellerPosPage').then((m) => ({ default: m.SellerPosPage })));
const SellerMandiRatesPage = lazy(() => import('./SellerMandiRatesPage').then((m) => ({ default: m.SellerMandiRatesPage })));
const SellerAnalyticsPage = lazy(() => import('./SellerAnalyticsPage').then((m) => ({ default: m.SellerAnalyticsPage })));
const SellerCompliancePage = lazy(() => import('./SellerCompliancePage').then((m) => ({ default: m.SellerCompliancePage })));

/**
 * 4. Seller / Vyapari Hub. `/seller/demands` deliberately renders the
 * seller-owned SellerDemandsManager (the old farmer BuyerDemandsView borrow
 * is replaced here without touching the farmer folder).
 */
export const SellerRouteElements = () => (
  <>
    <Route path="/seller" element={<SellerHome />} />
    <Route path="/seller/catalog" element={<SellerHome />} />
    <Route path="/seller/orders" element={<SellerHome />} />
    <Route path="/seller/orders/:id" element={<SellerOrderDetailPage />} />
    <Route path="/seller/procure" element={<SellerProcurementPage />} />
    <Route path="/seller/procurement" element={<SellerProcurementPage />} />
    <Route path="/seller/demands" element={<SellerDemandsManager />} />
    <Route path="/seller/pos" element={<SellerPosPage />} />
    <Route path="/seller/stock" element={<SellerStockPage />} />
    <Route path="/seller/rates" element={<SellerMandiRatesPage />} />
    <Route path="/seller/analytics" element={<SellerAnalyticsPage />} />
    <Route path="/seller/compliance" element={<SellerCompliancePage />} />
  </>
);
