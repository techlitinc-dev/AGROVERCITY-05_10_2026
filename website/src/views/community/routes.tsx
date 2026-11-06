import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const AiAgronomistView = lazy(() => import('./AiAgronomistView').then((m) => ({ default: m.AiAgronomistView })));
const DiseaseScanView = lazy(() => import('./DiseaseScanView').then((m) => ({ default: m.DiseaseScanView })));
const AgriNewsChannelsView = lazy(() => import('./AgriNewsChannelsView').then((m) => ({ default: m.AgriNewsChannelsView })));
const KisanCoinsView = lazy(() => import('./KisanCoinsView').then((m) => ({ default: m.KisanCoinsView })));
const ColdStorageView = lazy(() => import('./ColdStorageView').then((m) => ({ default: m.ColdStorageView })));
const TreePlantationView = lazy(() => import('./TreePlantationView').then((m) => ({ default: m.TreePlantationView })));

/** 12. Community, Verticals & AI Tools.
 * v2: the FPO hub (/fpoManager, /fpo/*) moves back here from the community domain. */
export const CommunityRouteElements = () => (
  <>
    <Route path="/community/ai" element={<AiAgronomistView />} />
    <Route path="/community/scan" element={<DiseaseScanView />} />
    <Route path="/community/news" element={<AgriNewsChannelsView />} />
    <Route path="/community/coins" element={<KisanCoinsView />} />
    <Route path="/community/cold" element={<ColdStorageView />} />
    <Route path="/community/trees" element={<TreePlantationView />} />
    {/* Carbon Footprint & Eco and the Mahila Gruh Udyog hub (incl. its
        /womenShg persona aliases) were removed from the frontend — the routes
        redirect for compat. Backend APIs unchanged. */}
    <Route path="/community/carbon" element={<Navigate to="/community/trees" replace />} />
    <Route path="/community/women" element={<Navigate to="/mall" replace />} />
    <Route path="/womenShg" element={<Navigate to="/mall" replace />} />
    <Route path="/womenShg/products" element={<Navigate to="/mall" replace />} />
    <Route path="/womenShg/batches" element={<Navigate to="/mall" replace />} />
    <Route path="/womenShg/certs" element={<Navigate to="/mall" replace />} />
    <Route path="/womenShg/savings" element={<Navigate to="/mall" replace />} />
    <Route path="/gruhUdyog" element={<Navigate to="/mall" replace />} />
  </>
);
