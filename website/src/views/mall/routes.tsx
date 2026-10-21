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
const SellerStorefrontView = lazy(() => import('./SellerStorefrontView').then((m) => ({ default: m.SellerStorefrontView })));
const CustomerDemandsView = lazy(() => import('./CustomerDemandsView').then((m) => ({ default: m.CustomerDemandsView })));
const ProduceBrowseView = lazy(() => import('./ProduceBrowseView').then((m) => ({ default: m.ProduceBrowseView })));
const ProduceQuotesView = lazy(() => import('./ProduceQuotesView').then((m) => ({ default: m.ProduceQuotesView })));
const CustomerProcurementsView = lazy(() => import('./CustomerProcurementsView').then((m) => ({ default: m.CustomerProcurementsView })));
const CustomerProcurementDetailView = lazy(() => import('./CustomerProcurementsView').then((m) => ({ default: m.CustomerProcurementDetailView })));
const SeasonalCalendarView = lazy(() => import('./SeasonalCalendarView').then((m) => ({ default: m.SeasonalCalendarView })));
const CustomerDiaryView = lazy(() => import('./CustomerDiaryView').then((m) => ({ default: m.CustomerDiaryView })));
const CustomerFinanceView = lazy(() => import('./CustomerFinanceView').then((m) => ({ default: m.CustomerFinanceView })));
const KisanCoinsView = lazy(() => import('../community/KisanCoinsView').then((m) => ({ default: m.KisanCoinsView })));
const AgriNewsChannelsView = lazy(() => import('../community/AgriNewsChannelsView').then((m) => ({ default: m.AgriNewsChannelsView })));
const TreePlantationView = lazy(() => import('../community/TreePlantationView').then((m) => ({ default: m.TreePlantationView })));
const LandRecordsView = lazy(() => import('../farmer/LandRecordsView').then((m) => ({ default: m.LandRecordsView })));

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
    <Route path="/customer/demands" element={<CustomerDemandsView />} />
    <Route path="/customer/quotes" element={<ProduceQuotesView />} />
    <Route path="/customer/procurements" element={<CustomerProcurementsView />} />
    <Route path="/customer/procurements/:id" element={<CustomerProcurementDetailView />} />
    <Route path="/customer/produce" element={<ProduceBrowseView />} />
    <Route path="/customer/seasonal" element={<SeasonalCalendarView />} />
    <Route path="/customer/diary" element={<CustomerDiaryView />} />
    <Route path="/customer/finance" element={<CustomerFinanceView />} />
    <Route path="/customer/coins" element={<KisanCoinsView />} />
    <Route path="/customer/news" element={<AgriNewsChannelsView />} />
    <Route path="/customer/trees" element={<TreePlantationView />} />
    <Route path="/customer/712" element={<LandRecordsView />} />

    {/* Krishi Mall */}
    <Route path="/mall" element={<KrishiMallCatalogView />} />
    <Route path="/mall/product/:id" element={<MallProductDetailView />} />
    <Route path="/mall/seller/:farmerId" element={<SellerStorefrontView />} />
    <Route path="/mall/cart" element={<CartCheckoutView />} />
    <Route path="/mall/wishlist" element={<WishlistView />} />
  </>
);
