import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const SellerDashboardView = lazy(() => import('./DashboardView').then((m) => ({ default: m.SellerDashboardView })));
const ShopProfileView = lazy(() => import('./ShopProfileView').then((m) => ({ default: m.ShopProfileView })));
const ProductsView = lazy(() => import('./ProductsView').then((m) => ({ default: m.ProductsView })));
const StockView = lazy(() => import('./StockView').then((m) => ({ default: m.StockView })));
const OrdersView = lazy(() => import('./OrdersView').then((m) => ({ default: m.OrdersView })));
const EnquiriesView = lazy(() => import('./EnquiriesView').then((m) => ({ default: m.EnquiriesView })));
const QuotationsView = lazy(() => import('./QuotationsView').then((m) => ({ default: m.QuotationsView })));
const CouponsView = lazy(() => import('./CouponsView').then((m) => ({ default: m.CouponsView })));
const EarningsView = lazy(() => import('./EarningsView').then((m) => ({ default: m.EarningsView })));
const ReviewsView = lazy(() => import('./ReviewsView').then((m) => ({ default: m.ReviewsView })));
const ReportsView = lazy(() => import('./ReportsView').then((m) => ({ default: m.ReportsView })));
const InsightsView = lazy(() => import('./InsightsView').then((m) => ({ default: m.InsightsView })));

/** Agri Market Seller persona (agrisellerinstructions.md). */
export const AgriMarketSellerRouteElements = () => (
  <>
    <Route path="/agriMarketSeller" element={<SellerDashboardView />} />
    <Route path="/agriMarketSeller/shop" element={<ShopProfileView />} />
    <Route path="/agriMarketSeller/products" element={<ProductsView />} />
    <Route path="/agriMarketSeller/stock" element={<StockView />} />
    <Route path="/agriMarketSeller/orders" element={<OrdersView />} />
    <Route path="/agriMarketSeller/enquiries" element={<EnquiriesView />} />
    <Route path="/agriMarketSeller/quotations" element={<QuotationsView />} />
    <Route path="/agriMarketSeller/coupons" element={<CouponsView />} />
    <Route path="/agriMarketSeller/earnings" element={<EarningsView />} />
    <Route path="/agriMarketSeller/reviews" element={<ReviewsView />} />
    <Route path="/agriMarketSeller/reports" element={<ReportsView />} />
    <Route path="/agriMarketSeller/insights" element={<InsightsView />} />
  </>
);
