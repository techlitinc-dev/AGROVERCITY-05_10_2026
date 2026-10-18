import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';

const ExporterHome = lazy(() => import('./ExporterHome').then((m) => ({ default: m.ExporterHome })));
const ExporterRfqsPage = lazy(() => import('./ExporterRfqsPage').then((m) => ({ default: m.ExporterRfqsPage })));
const ExporterOrdersPage = lazy(() => import('./ExporterOrdersPage').then((m) => ({ default: m.ExporterOrdersPage })));
const ExporterSuppliersPage = lazy(() => import('./ExporterSuppliersPage').then((m) => ({ default: m.ExporterSuppliersPage })));
const ExporterAnalyticsPage = lazy(() => import('./ExporterAnalyticsPage').then((m) => ({ default: m.ExporterAnalyticsPage })));

/** Global Agri Exporter Persona Routes */
export const ExporterRouteElements = () => (
  <>
    <Route path="/exporter" element={<ExporterHome />} />
    <Route path="/exporter/rfqs" element={<ExporterRfqsPage />} />
    <Route path="/exporter/orders" element={<ExporterOrdersPage />} />
    <Route path="/exporter/orders/:id" element={<ExporterOrdersPage />} />
    <Route path="/exporter/suppliers" element={<ExporterSuppliersPage />} />
    <Route path="/exporter/analytics" element={<ExporterAnalyticsPage />} />
    {/* Aliases */}
    <Route path="/export" element={<Navigate to="/exporter" replace />} />
  </>
);
