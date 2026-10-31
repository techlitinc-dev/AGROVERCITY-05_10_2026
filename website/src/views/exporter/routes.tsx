import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';

const ExporterHome = lazy(() => import('./ExporterHome').then((m) => ({ default: m.ExporterHome })));
const ExporterRfqsPage = lazy(() => import('./ExporterRfqsPage').then((m) => ({ default: m.ExporterRfqsPage })));
const ExporterApplicationsPage = lazy(() => import('./ExporterApplicationsPage').then((m) => ({ default: m.ExporterApplicationsPage })));
const ExportConnectionsView = lazy(() => import('../export/ExportConnectionsView').then((m) => ({ default: m.ExportConnectionsView })));
// Legacy seller-trade pipeline — kept for compatibility only, hidden from the
// farmer–exporter direct-connect sourcing navigation (orders / LC / shipping).
const ExporterOrdersPage = lazy(() => import('./ExporterOrdersPage').then((m) => ({ default: m.ExporterOrdersPage })));
const ExporterSuppliersPage = lazy(() => import('./ExporterSuppliersPage').then((m) => ({ default: m.ExporterSuppliersPage })));
const ExporterAnalyticsPage = lazy(() => import('./ExporterAnalyticsPage').then((m) => ({ default: m.ExporterAnalyticsPage })));

/** Global Agri Exporter Persona Routes */
export const ExporterRouteElements = () => (
  <>
    {/* Direct-connect sourcing workflow (active) */}
    <Route path="/exporter" element={<ExporterHome />} />
    <Route path="/exporter/rfqs" element={<ExporterRfqsPage />} />
    <Route path="/exporter/applications" element={<ExporterApplicationsPage />} />
    <Route path="/exporter/connections" element={<ExportConnectionsView persona="exporter" />} />
    {/* Legacy seller-trade pipeline (compatibility only) */}
    <Route path="/exporter/orders" element={<ExporterOrdersPage />} />
    <Route path="/exporter/orders/:id" element={<ExporterOrdersPage />} />
    <Route path="/exporter/suppliers" element={<ExporterSuppliersPage />} />
    <Route path="/exporter/analytics" element={<ExporterAnalyticsPage />} />
    {/* Aliases */}
    <Route path="/export" element={<Navigate to="/exporter" replace />} />
  </>
);
