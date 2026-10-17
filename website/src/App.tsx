import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';

// Eager Views (Splash / Landing / Auth / Legal)
import { LandingPage } from './views/public/LandingPage';
import { LegalPage } from './views/public/LegalPage';
import { LoginPage } from './views/auth/LoginPage';
import { RegisterPage } from './views/auth/RegisterPage';
import { ProfileSwitchPage } from './views/auth/ProfileSwitchPage';

// Lazy Farmer Views
const FarmerHome = lazy(() => import('./views/farmer/FarmerHome').then((m) => ({ default: m.FarmerHome })));
const MandiPricesView = lazy(() => import('./views/farmer/MandiPricesView').then((m) => ({ default: m.MandiPricesView })));
const ProduceLotsView = lazy(() => import('./views/farmer/ProduceLotsView').then((m) => ({ default: m.ProduceLotsView })));
const BuyerDemandsView = lazy(() => import('./views/farmer/BuyerDemandsView').then((m) => ({ default: m.BuyerDemandsView })));
const PurchasesView = lazy(() => import('./views/farmer/PurchasesView').then((m) => ({ default: m.PurchasesView })));
const BuyerContractsView = lazy(() => import('./views/farmer/BuyerContractsView').then((m) => ({ default: m.BuyerContractsView })));
const TransportBookingView = lazy(() => import('./views/farmer/TransportBookingView').then((m) => ({ default: m.TransportBookingView })));
const FarmDiaryView = lazy(() => import('./views/farmer/FarmDiaryView').then((m) => ({ default: m.FarmDiaryView })));
const EquipmentRentalView = lazy(() => import('./views/farmer/EquipmentRentalView').then((m) => ({ default: m.EquipmentRentalView })));
const LoanFintechView = lazy(() => import('./views/farmer/LoanFintechView').then((m) => ({ default: m.LoanFintechView })));
const CropInsuranceView = lazy(() => import('./views/farmer/CropInsuranceView').then((m) => ({ default: m.CropInsuranceView })));
const LandRecordsView = lazy(() => import('./views/farmer/LandRecordsView').then((m) => ({ default: m.LandRecordsView })));
const GovtSchemesView = lazy(() => import('./views/farmer/GovtSchemesView').then((m) => ({ default: m.GovtSchemesView })));
const WaterClimateView = lazy(() => import('./views/farmer/WaterClimateView').then((m) => ({ default: m.WaterClimateView })));

// Lazy Commercial & Logistics Views
const LandlordHome = lazy(() => import('./views/landlord/LandlordHome').then((m) => ({ default: m.LandlordHome })));
const TransporterHome = lazy(() => import('./views/transporter/TransporterHome').then((m) => ({ default: m.TransporterHome })));
const SellerHome = lazy(() => import('./views/seller/SellerHome').then((m) => ({ default: m.SellerHome })));
const EquipmentOwnerHome = lazy(() => import('./views/equipment/EquipmentOwnerHome').then((m) => ({ default: m.EquipmentOwnerHome })));
const DirectBuyerHome = lazy(() => import('./views/directbuyer/DirectBuyerHome').then((m) => ({ default: m.DirectBuyerHome })));
const BrokerHome = lazy(() => import('./views/broker/BrokerHome').then((m) => ({ default: m.BrokerHome })));

// Lazy Verticals, Academy & Finance
const DairyHome = lazy(() => import('./views/dairy/DairyHome').then((m) => ({ default: m.DairyHome })));
const CourseCatalogView = lazy(() => import('./views/academy/CourseCatalogView').then((m) => ({ default: m.CourseCatalogView })));
const BankManagerDeskView = lazy(() => import('./views/finance/BankManagerDeskView').then((m) => ({ default: m.BankManagerDeskView })));
const InsuranceClaimsDeskView = lazy(() => import('./views/finance/InsuranceClaimsDeskView').then((m) => ({ default: m.InsuranceClaimsDeskView })));

// Lazy Krishi Shopping Mall
const KrishiMallCatalogView = lazy(() => import('./views/mall/KrishiMallCatalogView').then((m) => ({ default: m.KrishiMallCatalogView })));
const CartCheckoutView = lazy(() => import('./views/mall/CartCheckoutView').then((m) => ({ default: m.CartCheckoutView })));

// Lazy Community & AI Tools
const AiAgronomistView = lazy(() => import('./views/community/AiAgronomistView').then((m) => ({ default: m.AiAgronomistView })));
const DiseaseScanView = lazy(() => import('./views/community/DiseaseScanView').then((m) => ({ default: m.DiseaseScanView })));
const AgriNewsChannelsView = lazy(() => import('./views/community/AgriNewsChannelsView').then((m) => ({ default: m.AgriNewsChannelsView })));
const KisanCoinsView = lazy(() => import('./views/community/KisanCoinsView').then((m) => ({ default: m.KisanCoinsView })));
const WomenGruhUdyogView = lazy(() => import('./views/community/WomenGruhUdyogView').then((m) => ({ default: m.WomenGruhUdyogView })));
const ColdStorageView = lazy(() => import('./views/community/ColdStorageView').then((m) => ({ default: m.ColdStorageView })));
const FpoHubView = lazy(() => import('./views/community/FpoHubView').then((m) => ({ default: m.FpoHubView })));

// Lazy Superadmin Master Console
const SuperadminMasterConsole = lazy(() => import('./views/admin/SuperadminMasterConsole').then((m) => ({ default: m.SuperadminMasterConsole })));

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
          {/* Public & Landing */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/legal" element={<LegalPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profiles" element={<ProfileSwitchPage />} />

          {/* 1. Farmer / Kisan Hub (18 Journeys) */}
          <Route path="/farmer" element={<FarmerHome />} />
          <Route path="/farmer/mandi" element={<MandiPricesView />} />
          <Route path="/farmer/lots" element={<ProduceLotsView />} />
          <Route path="/farmer/demands" element={<BuyerDemandsView />} />
          <Route path="/farmer/purchases" element={<PurchasesView />} />
          <Route path="/farmer/contracts" element={<BuyerContractsView />} />
          <Route path="/farmer/transport" element={<TransportBookingView />} />
          <Route path="/farmer/diary" element={<FarmDiaryView />} />
          <Route path="/farmer/equipment" element={<EquipmentRentalView />} />
          <Route path="/farmer/loans" element={<LoanFintechView />} />
          <Route path="/farmer/insurance" element={<CropInsuranceView />} />
          <Route path="/farmer/712" element={<LandRecordsView />} />
          <Route path="/farmer/schemes" element={<GovtSchemesView />} />
          <Route path="/farmer/water" element={<WaterClimateView />} />
          <Route path="/farmer/coins" element={<KisanCoinsView />} />
          <Route path="/farmer/dairy" element={<DairyHome />} />

          {/* 2. Farm Landlord Hub */}
          <Route path="/landlord" element={<LandlordHome />} />
          <Route path="/landlord/plots" element={<LandRecordsView />} />
          <Route path="/landlord/listings" element={<LandlordHome />} />
          <Route path="/landlord/inbox" element={<LandlordHome />} />
          <Route path="/landlord/rent" element={<LandlordHome />} />

          {/* 3. Transporter Logistics Hub */}
          <Route path="/transporter" element={<TransporterHome />} />
          <Route path="/transporter/loads" element={<TransporterHome />} />
          <Route path="/transporter/trips" element={<TransporterHome />} />
          <Route path="/transporter/bilty" element={<TransporterHome />} />
          <Route path="/transporter/settlements" element={<TransporterHome />} />
          <Route path="/transporter/fleet" element={<TransporterHome />} />

          {/* 4. Seller / Vyapari Hub */}
          <Route path="/seller" element={<SellerHome />} />
          <Route path="/seller/catalog" element={<SellerHome />} />
          <Route path="/seller/orders" element={<SellerHome />} />
          <Route path="/seller/procure" element={<SellerHome />} />
          <Route path="/seller/demands" element={<BuyerDemandsView />} />
          <Route path="/seller/pos" element={<SellerHome />} />

          {/* 5. Equipment Owner Console */}
          <Route path="/equipmentOwner" element={<EquipmentOwnerHome />} />
          <Route path="/equipment" element={<EquipmentOwnerHome />} />
          <Route path="/equipment/fleet" element={<EquipmentOwnerHome />} />
          <Route path="/equipment/calendar" element={<EquipmentOwnerHome />} />
          <Route path="/equipment/bookings" element={<EquipmentOwnerHome />} />
          <Route path="/equipment/roi" element={<EquipmentOwnerHome />} />

          {/* 6. Direct Buyer Console */}
          <Route path="/directBuyer" element={<DirectBuyerHome />} />
          <Route path="/directbuyer" element={<DirectBuyerHome />} />
          <Route path="/directbuyer/demands" element={<DirectBuyerHome />} />
          <Route path="/directbuyer/qc" element={<DirectBuyerHome />} />
          <Route path="/directbuyer/contracts" element={<BuyerContractsView />} />

          {/* 7. Agri Broker / Dalal */}
          <Route path="/broker" element={<BrokerHome />} />
          <Route path="/broker/matchmaker" element={<BrokerHome />} />
          <Route path="/broker/commissions" element={<BrokerHome />} />

          {/* 8. Dairy & Gaushala Manager */}
          <Route path="/dairyManager" element={<DairyHome />} />
          <Route path="/dairy" element={<DairyHome />} />
          <Route path="/dairy/members" element={<DairyHome />} />
          <Route path="/dairy/batches" element={<DairyHome />} />
          <Route path="/dairy/gaushala" element={<DairyHome />} />
          <Route path="/dairy/vets" element={<DairyHome />} />
          <Route path="/gaushalaManager" element={<DairyHome />} />

          {/* 9. Gurukul Instructor & Academy */}
          <Route path="/instructor" element={<CourseCatalogView />} />
          <Route path="/instructor/courses" element={<CourseCatalogView />} />
          <Route path="/instructor/enquiries" element={<CourseCatalogView />} />
          <Route path="/academy" element={<CourseCatalogView />} />

          {/* 10. Financial Institutions */}
          <Route path="/bankManager" element={<BankManagerDeskView />} />
          <Route path="/bank" element={<BankManagerDeskView />} />
          <Route path="/bank/appraisals" element={<BankManagerDeskView />} />
          <Route path="/bank/portfolio" element={<BankManagerDeskView />} />
          <Route path="/insuranceProvider" element={<InsuranceClaimsDeskView />} />
          <Route path="/insurance" element={<InsuranceClaimsDeskView />} />
          <Route path="/insurance/surveyors" element={<InsuranceClaimsDeskView />} />
          <Route path="/insurance/dbt" element={<InsuranceClaimsDeskView />} />

          {/* 11. Krishi Shopping Mall & Customer */}
          <Route path="/customer" element={<KrishiMallCatalogView />} />
          <Route path="/mall" element={<KrishiMallCatalogView />} />
          <Route path="/mall/cart" element={<CartCheckoutView />} />

          {/* 12. Community, Verticals & AI Tools */}
          <Route path="/community/ai" element={<AiAgronomistView />} />
          <Route path="/community/scan" element={<DiseaseScanView />} />
          <Route path="/community/news" element={<AgriNewsChannelsView />} />
          <Route path="/community/women" element={<WomenGruhUdyogView />} />
          <Route path="/community/cold" element={<ColdStorageView />} />
          <Route path="/coldStorageProvider" element={<ColdStorageView />} />
          <Route path="/community/fpo" element={<FpoHubView />} />

          {/* 13. Superadmin Platform Master Console (SOP 01-27) */}
          <Route path="/superadmin" element={<SuperadminMasterConsole />} />
          <Route path="/admin" element={<SuperadminMasterConsole />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default App;
