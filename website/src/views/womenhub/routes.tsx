import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const WomanHubDashboardView = lazy(() => import('./DashboardView').then((m) => ({ default: m.WomanHubDashboardView })));
const MyBusinessesView = lazy(() => import('./MyBusinessesView').then((m) => ({ default: m.MyBusinessesView })));
const GardenPlannerView = lazy(() => import('./GardenPlannerView').then((m) => ({ default: m.GardenPlannerView })));
const EnterpriseIncomeView = lazy(() => import('./EnterpriseIncomeView').then((m) => ({ default: m.EnterpriseIncomeView })));
const WomanHubOrdersView = lazy(() => import('./OrdersView').then((m) => ({ default: m.WomanHubOrdersView })));
const WomanHubInsightsView = lazy(() => import('./InsightsView').then((m) => ({ default: m.WomanHubInsightsView })));

/** Woman Hub persona (womeninstructions.md). */
export const WomanHubRouteElements = () => (
  <>
    <Route path="/womenHub" element={<WomanHubDashboardView />} />
    <Route path="/womenHub/businesses" element={<MyBusinessesView />} />
    <Route path="/womenHub/garden" element={<GardenPlannerView />} />
    <Route path="/womenHub/enterprise" element={<EnterpriseIncomeView />} />
    <Route path="/womenHub/orders" element={<WomanHubOrdersView />} />
    <Route path="/womenHub/insights" element={<WomanHubInsightsView />} />
  </>
);
