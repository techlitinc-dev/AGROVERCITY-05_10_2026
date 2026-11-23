import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const KrishiMallCatalogView = lazy(() => import('./KrishiMallCatalogView').then((m) => ({ default: m.KrishiMallCatalogView })));
const CartCheckoutView = lazy(() => import('./CartCheckoutView').then((m) => ({ default: m.CartCheckoutView })));
const MallProductDetailView = lazy(() => import('./MallProductDetailView').then((m) => ({ default: m.MallProductDetailView })));
const WishlistView = lazy(() => import('./WishlistView').then((m) => ({ default: m.WishlistView })));
const BuyerOrdersView = lazy(() => import('./BuyerOrdersView').then((m) => ({ default: m.BuyerOrdersView })));
const BuyerOrderDetailView = lazy(() => import('./BuyerOrdersView').then((m) => ({ default: m.BuyerOrderDetailView })));

/** 11. Shopping Mall (shared across personas). */
export const MallRouteElements = () => (
  <>
    <Route path="/mall" element={<KrishiMallCatalogView />} />
    <Route path="/mall/product/:id" element={<MallProductDetailView />} />
    <Route path="/mall/cart" element={<CartCheckoutView />} />
    <Route path="/mall/wishlist" element={<WishlistView />} />
    <Route path="/mall/orders" element={<BuyerOrdersView />} />
    <Route path="/mall/orders/:id" element={<BuyerOrderDetailView />} />
  </>
);
