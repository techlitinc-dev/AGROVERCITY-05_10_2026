import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import { LegalPage } from './LegalPage';
import { useAuthStore } from '../../stores/authStore';

const PublicMilkBill = lazy(() =>
  import('./PublicMilkBill').then((m) => ({ default: m.PublicMilkBill }))
);

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
    <Route path="/" element={<LandingPage />} />
    <Route path="/landing" element={<LandingPage />} />
    <Route path="/dashboard" element={<DashboardRoute />} />
    <Route path="/legal" element={<LegalPage />} />
    {/* Secure customer milk bill — reachable via the vendor's share link, no login */}
    <Route path="/public/milk-bills/:token" element={<PublicMilkBill />} />
  </>
);
