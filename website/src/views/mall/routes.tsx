import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const KrishiMallCatalogView = lazy(() => import('./KrishiMallCatalogView').then((m) => ({ default: m.KrishiMallCatalogView })));
const CartCheckoutView = lazy(() => import('./CartCheckoutView').then((m) => ({ default: m.CartCheckoutView })));
const MallProductDetailView = lazy(() => import('./MallProductDetailView').then((m) => ({ default: m.MallProductDetailView })));
const WishlistView = lazy(() => import('./WishlistView').then((m) => ({ default: m.WishlistView })));
const CustomerHomeView = lazy(() => import('./CustomerHomeView').then((m) => ({ default: m.CustomerHomeView })));
const CustomerOrdersView = lazy(() => import('./CustomerOrdersView').then((m) => ({ default: m.CustomerOrdersView })));
const CustomerOrderDetailView = lazy(() => import('./CustomerOrdersView').then((m) => ({ default: m.CustomerOrderDetailView })));
const CustomerSubscriptionsView = lazy(() => import('./CustomerSubscriptionsView').then((m) => ({ default: m.CustomerSubscriptionsView })));
const CustomerWalletView = lazy(() => import('./CustomerWalletView').then((m) => ({ default: m.CustomerWalletView })));

/** 11. Krishi Shopping Mall & Customer */
export const MallRouteElements = () => (
  <>
    {/* Customer hub */}
    <Route path="/customer" element={<CustomerHomeView />} />
    <Route path="/customer/home" element={<CustomerHomeView />} />
    <Route path="/customer/orders" element={<CustomerOrdersView />} />
    <Route path="/customer/orders/:id" element={<CustomerOrderDetailView />} />
    <Route path="/customer/subscriptions" element={<CustomerSubscriptionsView />} />
    <Route path="/customer/wallet" element={<CustomerWalletView />} />

    {/* Krishi Mall */}
    <Route path="/mall" element={<KrishiMallCatalogView />} />
    <Route path="/mall/product/:id" element={<MallProductDetailView />} />
    <Route path="/mall/cart" element={<CartCheckoutView />} />
    <Route path="/mall/wishlist" element={<WishlistView />} />
  </>
);
