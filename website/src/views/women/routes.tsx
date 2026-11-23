import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const DirectoryView = lazy(() => import('./DirectoryView').then((m) => ({ default: m.DirectoryView })));
const MyBusinessesView = lazy(
  () => import('./MyBusinessesView').then((m) => ({ default: m.MyBusinessesView }))
);
const GardenPlannerView = lazy(
  () => import('./GardenPlannerView').then((m) => ({ default: m.GardenPlannerView }))
);
const EnterpriseIncomeView = lazy(
  () => import('./EnterpriseIncomeView').then((m) => ({ default: m.EnterpriseIncomeView }))
);

/** Women SHG economy — farmer-facing surfaces (the hub itself lives under /community). */
export const WomenRouteElements = () => (
  <>
    <Route path="/women/directory" element={<DirectoryView />} />
    {/* Women Hub (womenhub 21nov.xlsx) */}
    <Route path="/women/hub/businesses" element={<MyBusinessesView />} />
    <Route path="/women/hub/garden" element={<GardenPlannerView />} />
    <Route path="/women/hub/enterprise" element={<EnterpriseIncomeView />} />
  </>
);
