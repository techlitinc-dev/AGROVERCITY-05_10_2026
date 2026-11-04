import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { NotificationCenter } from '../common/NotificationCenter';
import { AiChatbotDrawer } from '../common/AiChatbotDrawer';
import { useAuthStore, isRestrictedRegistration } from '../../stores/authStore';
import { isPersonaEnabled } from '../../lib/personas';
import type { PersonaType } from '../../types';

/** First path segment → the persona whose pages live under it.
 * v2 prefixes (route removed for v1): broker, vet/vets, fpo/fpoManager,
 * bank/bankManager, insurance/insuranceProvider, admin/superadmin,
 * dairy/dairyManager. */
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
  milkSeller: 'milkSeller',
  gaushala: 'gaushalaManager',
  gaushalaManager: 'gaushalaManager',
  women: 'womenShg',
  womenShg: 'womenShg',
  gruhUdyog: 'womenShg',
  instructor: 'instructor',
  coldStorageProvider: 'coldStorageProvider',
  nursery: 'nursery',
  customer: 'customer',
};

/** Routes anyone may view without an active session. */
const PUBLIC_PATHS = new Set(['/', '/landing', '/legal', '/login', '/register', '/onboarding']);

const isPublicPath = (pathname: string): boolean =>
  PUBLIC_PATHS.has(pathname) || pathname.startsWith('/track/') || pathname.startsWith('/public/');

export const AppShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, activePersona, isAuthenticated } = useAuthStore();
  // History-aware back affordance: react-router records the history index in
  // history.state — >0 means there is a previous in-app screen to return to.
  // SPA back preserves the previous page's component state (no lost form data).
  const canGoBack = typeof window !== 'undefined' && (window.history.state?.idx ?? 0) > 0;
  const isFullWidthPage =
    location.pathname === '/' ||
    location.pathname === '/landing' ||
    location.pathname === '/legal' ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/onboarding' ||
    location.pathname.startsWith('/track/') ||
    location.pathname.startsWith('/public/');

  // Auth gate: persona pages need a session — bounce to /login remembering
  // where the user was headed so login can return them there.
  if (!isAuthenticated && !isPublicPath(location.pathname)) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Registration gate: users whose registration is incomplete (mobile verified
  // but profile or KYC pending) may only use the registration journey,
  // verification support and safe account screens. Everything else redirects
  // into the pending step. Their onboarding token is rejected by protected
  // APIs server-side anyway — roaming would only produce 401 noise.
  if (isAuthenticated && isRestrictedRegistration(user)) {
    const path = location.pathname;
    const allowed =
      path.startsWith('/register') ||
      path.startsWith('/kyc/callback') ||
      path.startsWith('/mock-digilocker') ||
      path.startsWith('/login') ||
      path.startsWith('/support');
    if (!allowed) {
      const resume = user?.registrationStatus === 'pendingKyc' ? 'kyc' : undefined;
      return <Navigate to="/register" state={resume ? { resume } : undefined} replace />;
    }
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

      {/* Global back button — every page, appears only when there is history
          to return to. Sits above the mobile bottom nav. */}
      {!isFullWidthPage && canGoBack && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="fixed bottom-20 lg:bottom-6 left-3 z-40 p-2.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg text-slate-600 hover:text-emerald-700 hover:border-emerald-300 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
