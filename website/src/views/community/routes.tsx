import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const AiAgronomistView = lazy(() => import('./AiAgronomistView').then((m) => ({ default: m.AiAgronomistView })));
const AiAnalysisView = lazy(() => import('../shared/AiAnalysisView').then((m) => ({ default: m.AiAnalysisView })));
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
    <Route path="/ai-analysis" element={<AiAnalysisView />} />
    {/* Requirements / Demand Board removed from the frontend — redirect for compat. */}
    <Route path="/community/demands" element={<Navigate to="/womenHub" replace />} />
    <Route path="/community/scan" element={<DiseaseScanView />} />
    <Route path="/community/news" element={<AgriNewsChannelsView />} />
    <Route path="/community/coins" element={<KisanCoinsView />} />
    <Route path="/community/cold" element={<ColdStorageView />} />
    <Route path="/community/trees" element={<TreePlantationView />} />
    {/* Carbon Footprint & Eco stays removed from the frontend — redirect for compat. */}
    <Route path="/community/carbon" element={<Navigate to="/community/trees" replace />} />
  </>
);
