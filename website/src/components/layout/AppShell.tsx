import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { NotificationCenter } from '../common/NotificationCenter';
import { AiChatbotDrawer } from '../common/AiChatbotDrawer';
import { useAuthStore } from '../../stores/authStore';
import { isPersonaEnabled } from '../../lib/personas';
import type { PersonaType } from '../../types';

/** First path segment → the persona whose pages live under it. */
const PERSONA_ROUTE_PREFIXES: Record<string, PersonaType> = {
  farmer: 'farmer',
  landlord: 'landlord',
  transporter: 'transporter',
  seller: 'seller',
  equipment: 'equipmentOwner',
  equipmentOwner: 'equipmentOwner',
  export: 'exporter',
  exporter: 'exporter',
  directbuyer: 'directBuyer',
  directBuyer: 'directBuyer',
  broker: 'broker',
  dairy: 'dairyManager',
  dairyManager: 'dairyManager',
  milkSeller: 'milkSeller',
  vet: 'vet',
  vets: 'vet',
  gaushala: 'gaushalaManager',
  gaushalaManager: 'gaushalaManager',
  fpo: 'fpoManager',
  fpoManager: 'fpoManager',
  women: 'womenShg',
  womenShg: 'womenShg',
  gruhUdyog: 'womenShg',
  instructor: 'instructor',
  bank: 'bankManager',
  bankManager: 'bankManager',
  insurance: 'insuranceProvider',
  insuranceProvider: 'insuranceProvider',
  coldStorageProvider: 'coldStorageProvider',
  nursery: 'nursery',
  customer: 'customer',
  admin: 'superadmin',
  superadmin: 'superadmin',
};

/** Routes anyone may view without an active session. */
const PUBLIC_PATHS = new Set(['/', '/landing', '/legal', '/login', '/register', '/onboarding']);

const isPublicPath = (pathname: string): boolean =>
  PUBLIC_PATHS.has(pathname) || pathname.startsWith('/track/');

export const AppShell: React.FC = () => {
  const location = useLocation();
  const { user, activePersona, isAuthenticated } = useAuthStore();
  const isFullWidthPage =
    location.pathname === '/' ||
    location.pathname === '/landing' ||
    location.pathname === '/legal' ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/onboarding' ||
    location.pathname.startsWith('/track/');

  // Auth gate: persona pages need a session — bounce to /login remembering
  // where the user was headed so login can return them there.
  if (!isAuthenticated && !isPublicPath(location.pathname)) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Persona visibility: a route owned by a hidden persona redirects to the
  // active persona's cockpit (hidden ≠ deleted — enabling it restores access).
  const firstSegment = location.pathname.split('/')[1] || '';
  const routePersona = PERSONA_ROUTE_PREFIXES[firstSegment];
  const personaBlocked =
    !!routePersona && isAuthenticated && !isPersonaEnabled(user?.disabledPersonas, routePersona);

  if (personaBlocked) {
    return <Navigate to={`/${activePersona}`} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Body with Responsive Sidebar and Dynamic Content */}
      {isFullWidthPage ? (
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      ) : (
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          <Sidebar />
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-12 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      )}

      {/* Floating Global Micro-Services */}
      <NotificationCenter />
      <AiChatbotDrawer />

      {/* Mobile Bottom Navigation Bar */}
      {!isFullWidthPage && <BottomNav />}
    </div>
  );
};
