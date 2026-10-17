import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const BrokerHome = lazy(() => import('./BrokerHome').then((m) => ({ default: m.BrokerHome })));
const BrokerLeadsPage = lazy(() => import('./BrokerLeadsPage').then((m) => ({ default: m.BrokerLeadsPage })));
const DealDetailPage = lazy(() => import('./DealDetailPage').then((m) => ({ default: m.DealDetailPage })));
const TrustTierPage = lazy(() => import('./TrustTierPage').then((m) => ({ default: m.TrustTierPage })));

/** 7. Agri Broker / Dalal */
export const BrokerRouteElements = () => (
  <>
    <Route path="/broker" element={<BrokerHome />} />
    <Route path="/broker/matchmaker" element={<BrokerHome />} />
    <Route path="/broker/commissions" element={<BrokerHome />} />
    <Route path="/broker/leads" element={<BrokerLeadsPage />} />
    <Route path="/broker/deals" element={<BrokerHome />} />
    <Route path="/broker/deals/:id" element={<DealDetailPage />} />
    <Route path="/broker/trust" element={<TrustTierPage />} />
  </>
);
