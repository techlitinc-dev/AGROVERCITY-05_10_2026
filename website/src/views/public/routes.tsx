import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import { LegalPage } from './LegalPage';
import { useAuthStore } from '../../stores/authStore';

/**
 * RootRoute: If user is authenticated, takes them straight to their active dashboard cockpit.
 * If not authenticated, renders the public showcase landing page.
 */
const RootRoute: React.FC = () => {
  const { isAuthenticated, activePersona } = useAuthStore();
  if (isAuthenticated) {
    return <Navigate to={`/${activePersona || 'farmer'}`} replace />;
  }
  return <LandingPage />;
};

/**
 * DashboardRoute: Universal /dashboard shortcut that routes directly to the user's active cockpit.
 */
const DashboardRoute: React.FC = () => {
  const { isAuthenticated, activePersona } = useAuthStore();
  if (isAuthenticated) {
    return <Navigate to={`/${activePersona || 'farmer'}`} replace />;
  }
  return <Navigate to="/login" replace />;
};

/** Public & landing routes. */
export const PublicRouteElements = () => (
  <>
    <Route path="/" element={<RootRoute />} />
    <Route path="/landing" element={<LandingPage />} />
    <Route path="/dashboard" element={<DashboardRoute />} />
    <Route path="/legal" element={<LegalPage />} />
  </>
);
