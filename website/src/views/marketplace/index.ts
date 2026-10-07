import type { ComponentType } from 'react';
import AddressBookPage from './AddressBookPage';
import CartPage from './CartPage';
import CatalogPage from './CatalogPage';
import CheckoutPage from './CheckoutPage';
import OrderDetailPage from './OrderDetailPage';
import OrdersPage from './OrdersPage';
import ProductDetailPage from './ProductDetailPage';
import ProductFormPage from './ProductFormPage';
import ReturnsPage from './ReturnsPage';
import SellerProductsPage from './SellerProductsPage';
import WishlistPage from './WishlistPage';

/**
 * Marketplace page registry — maps dashboard tool ids to the real marketplace
 * pages, following the `views/trade/index.ts` pattern. Registered into the
 * generic tool route (views/dashboard/ToolPage.tsx) as
 * `... ?? MarketplacePage`.
 *
 * NOTE on `orderTracking`: the CUSTOMER_PAGES registry (phase-04 WS-03) already
 * owns that tool id and is looked up *earlier* in the ToolPage chain, so the
 * FarmGate customer order list keeps the tile. The marketplace order list here
 * is reached through the deep routes `/dashboard/p/orders` and
 * `/dashboard/p/orders/:orderId` (registered in App.tsx), which are linked from
 * the catalog, cart, checkout and the task-engine deep link.
 */
export const MARKETPLACE_PAGES: Record<string, ComponentType> = {
  marketplace: CatalogPage,
  cart: CartPage,
  wishlist: WishlistPage,
  addressBook: AddressBookPage,
  sellerProducts: SellerProductsPage,
  myProducts: SellerProductsPage,
  returns: ReturnsPage,
};

export {
  AddressBookPage,
  CartPage,
  CatalogPage,
  CheckoutPage,
  OrderDetailPage,
  OrdersPage,
  ProductDetailPage,
  ProductFormPage,
  ReturnsPage,
  SellerProductsPage,
  WishlistPage,
};
