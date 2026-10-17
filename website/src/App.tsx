import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';

// Per-domain route fragments — add/edit routes in website/src/views/<domain>/routes.tsx
import { PublicRouteElements } from './views/public/routes';
import { AuthRouteElements } from './views/auth/routes';
import { FarmerRouteElements } from './views/farmer/routes';
import { LandlordRouteElements } from './views/landlord/routes';
import { TransporterRouteElements } from './views/transporter/routes';
import { SellerRouteElements } from './views/seller/routes';
import { EquipmentRouteElements } from './views/equipment/routes';
import { DirectBuyerRouteElements } from './views/directbuyer/routes';
import { BrokerRouteElements } from './views/broker/routes';
import { DairyRouteElements } from './views/dairy/routes';
import { LivestockRouteElements } from './views/livestock/routes';
import { AcademyRouteElements } from './views/academy/routes';
import { FinanceRouteElements } from './views/finance/routes';
import { MallRouteElements } from './views/mall/routes';
import { CommunityRouteElements } from './views/community/routes';
import { SharedRouteElements } from './views/shared/routes';
import { AdminRouteElements } from './views/admin/routes';

const LoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
    <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    <p className="text-xs font-bold text-slate-500 animate-pulse">Loading Agrovercity Workspace...</p>
  </div>
);

export const App: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          {PublicRouteElements()}
          {AuthRouteElements()}
          {FarmerRouteElements()}
          {LandlordRouteElements()}
          {TransporterRouteElements()}
          {SellerRouteElements()}
          {EquipmentRouteElements()}
          {DirectBuyerRouteElements()}
          {BrokerRouteElements()}
          {DairyRouteElements()}
          {LivestockRouteElements()}
          {AcademyRouteElements()}
          {FinanceRouteElements()}
          {MallRouteElements()}
          {CommunityRouteElements()}
          {SharedRouteElements()}
          {AdminRouteElements()}

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default App;
