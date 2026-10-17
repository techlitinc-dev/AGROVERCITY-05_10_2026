import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const LandlordHome = lazy(() => import('./LandlordHome').then((m) => ({ default: m.LandlordHome })));
const LandlordPlotsView = lazy(() => import('./LandlordPlotsView').then((m) => ({ default: m.LandlordPlotsView })));
const ListingManageView = lazy(() => import('./ListingManageView').then((m) => ({ default: m.ListingManageView })));
const LeadsCrmView = lazy(() => import('./LeadsCrmView').then((m) => ({ default: m.LeadsCrmView })));
const LeaseDetailView = lazy(() => import('./LeaseDetailView').then((m) => ({ default: m.LeaseDetailView })));
const RentCollectionView = lazy(() => import('./RentCollectionView').then((m) => ({ default: m.RentCollectionView })));
const LandlordProfitView = lazy(() => import('./LandlordProfitView').then((m) => ({ default: m.LandlordProfitView })));

/** 2. Farm Landlord Hub */
export const LandlordRouteElements = () => (
  <>
    <Route path="/landlord" element={<LandlordHome />} />
    <Route path="/landlord/plots" element={<LandlordPlotsView />} />
    <Route path="/landlord/listings" element={<LandlordHome />} />
    <Route path="/landlord/listings/:id" element={<ListingManageView />} />
    <Route path="/landlord/leads" element={<LeadsCrmView />} />
    <Route path="/landlord/leases/:id" element={<LeaseDetailView />} />
    <Route path="/landlord/inbox" element={<LandlordHome />} />
    <Route path="/landlord/rent" element={<RentCollectionView />} />
    <Route path="/landlord/profit" element={<LandlordProfitView />} />
  </>
);
