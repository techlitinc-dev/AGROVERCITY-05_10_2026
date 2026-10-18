import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const AiAgronomistView = lazy(() => import('./AiAgronomistView').then((m) => ({ default: m.AiAgronomistView })));
const DiseaseScanView = lazy(() => import('./DiseaseScanView').then((m) => ({ default: m.DiseaseScanView })));
const AgriNewsChannelsView = lazy(() => import('./AgriNewsChannelsView').then((m) => ({ default: m.AgriNewsChannelsView })));
const KisanCoinsView = lazy(() => import('./KisanCoinsView').then((m) => ({ default: m.KisanCoinsView })));
const WomenGruhUdyogView = lazy(() => import('./WomenGruhUdyogView').then((m) => ({ default: m.WomenGruhUdyogView })));
const ColdStorageView = lazy(() => import('./ColdStorageView').then((m) => ({ default: m.ColdStorageView })));
const FpoHubView = lazy(() => import('./FpoHubView').then((m) => ({ default: m.FpoHubView })));
const TreePlantationView = lazy(() => import('./TreePlantationView').then((m) => ({ default: m.TreePlantationView })));

/** 12. Community, Verticals & AI Tools */
export const CommunityRouteElements = () => (
  <>
    <Route path="/community/ai" element={<AiAgronomistView />} />
    <Route path="/community/scan" element={<DiseaseScanView />} />
    <Route path="/community/news" element={<AgriNewsChannelsView />} />
    <Route path="/community/coins" element={<KisanCoinsView />} />
    <Route path="/community/women" element={<WomenGruhUdyogView />} />
    <Route path="/community/cold" element={<ColdStorageView />} />
    <Route path="/community/fpo" element={<FpoHubView />} />
    <Route path="/community/trees" element={<TreePlantationView />} />

    {/* Dedicated Persona Aliases */}
    <Route path="/fpoManager" element={<FpoHubView />} />
    <Route path="/fpo/pools" element={<FpoHubView />} />
    <Route path="/fpo/machinery" element={<FpoHubView />} />
    <Route path="/fpo/directory" element={<FpoHubView />} />

    <Route path="/womenShg" element={<WomenGruhUdyogView />} />
    <Route path="/womenShg/products" element={<WomenGruhUdyogView />} />
    <Route path="/womenShg/batches" element={<WomenGruhUdyogView />} />
    <Route path="/womenShg/certs" element={<WomenGruhUdyogView />} />
    <Route path="/womenShg/savings" element={<WomenGruhUdyogView />} />
    <Route path="/gruhUdyog" element={<WomenGruhUdyogView />} />
  </>
);
