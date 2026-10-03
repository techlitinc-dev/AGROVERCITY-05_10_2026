import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { fetchMe } from './lib/api/auth';
import { isApiError } from './lib/api/client';
import { useOnboardingStore } from './stores/onboarding';
import { useDashboardStore } from './stores/dashboard';
import { useSessionStore } from './stores/session';
import Splash from './views/Splash';
import AuthView from './views/auth/AuthView';
import RegisterWizard from './views/auth/RegisterWizard';
import DashboardHome from './views/dashboard/DashboardHome';
import PlaceholderPage from './views/dashboard/PlaceholderPage';
import ProfilesPage from './views/dashboard/ProfilesPage';
import ToolPage from './views/dashboard/ToolPage';
import LegalPage from './views/legal/LegalPage';
import FarmMap from './views/onboarding/FarmMap';
import LanguageSelect from './views/onboarding/LanguageSelect';
import ProfileSelect from './views/onboarding/ProfileSelect';
import {
  ChatRoomPage,
  DemandForm,
  LotDetailPage,
  LotForm,
  OfferDetailPage,
  PurchaseDetailPage,
} from './views/trade';
import { LoadDetailPage, LoadForm, TripPage, VehicleForm } from './views/transport';
import { DealDetailPage, DealFormPage } from './views/broker';
import { ContractDetailPage, ContractFormPage } from './views/directbuyer';
import { FarmerContractDetailPage, FarmerDealDetailPage } from './views/farmer';
import {
  BatchDetailPage,
  CollectionEntryPage,
  CollectionsPage,
  CustomerFormPage,
  CustomersPage,
  DairyConsoleHome,
  MemberFormPage,
  MemberStatementPage,
  MembersPage,
  MyDairyPage,
  OrderDetailPage,
  OrdersPage,
  PaymentsPage,
  RateChartPage,
  ReportsPage,
  StockPage,
} from './views/dairy';
import { AnalyticsPage } from './views/dairy';
import {
  AdoptionsPage,
  ByproductsPage,
  CattleDetailPage,
  CattleFormPage,
  CattlePage,
  DonationsPage,
  ExpensesPage,
  GaushalaAnalyticsPage,
  GaushalaConsoleHome,
  ReceiptsPage,
} from './views/gaushala';
import {
  AppointmentsPage,
  CampaignDetailPage,
  CampaignsPage,
  PrescriptionsPage,
  VetFormPage,
  VetsPage,
} from './views/vetnet';
import { AnimalDetailPage, AnimalFormPage, AnimalsHomePage } from './views/animals';

/** Re-hydrate the persisted session on first load (mirrors mobile loadPersistedState). */
function useSessionHydration() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const clear = useSessionStore((s) => s.clear);

  useEffect(() => {
    if (!accessToken || user) return;
    fetchMe()
      .then((fresh) => {
        setUser(fresh);
        // Backend is the source of truth for role checks — reconcile the
        // dashboard preference in case another client changed activeProfile.
        if (fresh.activeProfile) {
          useDashboardStore.setState({ activeProfile: fresh.activeProfile });
        }
      })
      .catch((e) => {
        if (isApiError(e) && (e.status === 401 || e.status === 403 || e.status === 404)) {
          clear();
        }
      });
  }, [accessToken, user, setUser, clear]);
}

export default function App() {
  useSessionHydration();

  const isOnboarded = useOnboardingStore((s) => s.isOnboarded);
  const otpVerified = useOnboardingStore((s) => s.wizard.otpVerified);
  const hasToken = useSessionStore((s) => !!s.accessToken);

  // Language/profile steps are part of the register continuation: they need a
  // verified phone (wizard state) and are skipped by onboarded users.
  const resumeOrAuth = otpVerified && !(hasToken && isOnboarded);
  // Onboarded users can still revisit these pages later (change language,
  // complete a deferred persona/profile setup).
  const loggedIn = hasToken && isOnboarded;

  return (
    <div className="av-shell">
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/auth" element={hasToken && isOnboarded ? <Navigate to="/dashboard" replace /> : <AuthView />} />
        <Route
          path="/register"
          element={otpVerified ? <RegisterWizard /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/onboarding/language"
          element={resumeOrAuth || loggedIn ? <LanguageSelect /> : <Navigate to={hasToken && isOnboarded ? '/dashboard' : '/auth'} replace />}
        />
        <Route
          path="/onboarding/profiles"
          element={resumeOrAuth || loggedIn ? <ProfileSelect /> : <Navigate to={hasToken && isOnboarded ? '/dashboard' : '/auth'} replace />}
        />
        <Route
          path="/onboarding/farm-map"
          element={hasToken ? <FarmMap /> : <Navigate to="/auth" replace />}
        />
        <Route path="/legal/:page" element={<LegalPage />} />
        <Route
          path="/dashboard"
          element={loggedIn ? <DashboardHome /> : <Navigate to="/auth" replace />}
        />
        {/* Deep-linkable tool pages (backend DEEP_LINKS) resolve here:
            path="/dashboard/p/machineManage" (equipment),
            path="/dashboard/p/landlordLeases" (land),
            path="/dashboard/p/courses" (courses).
            Static deep routes (myOffers, transport/trips, purchases,
            broker/deals, contracts, chats, dairy/console) are registered above. */}
        <Route
          path="/dashboard/p/:toolId"
          element={loggedIn ? <ToolPage /> : <Navigate to="/auth" replace />}
        />
        {/* Trade deep routes (plan/seller_plan.md §4.2) */}
        <Route
          path="/dashboard/p/sellProduce/new"
          element={loggedIn ? <LotForm /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/sellProduce/:lotId/edit"
          element={loggedIn ? <LotForm /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/browseLots/:lotId"
          element={loggedIn ? <LotDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/myOffers/:offerId"
          element={loggedIn ? <OfferDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/myOffers/:offerId/chat"
          element={loggedIn ? <ChatRoomPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/chats/:roomId"
          element={loggedIn ? <ChatRoomPage /> : <Navigate to="/auth" replace />}
        />
        {/* Transport deep routes (plan/transporters_plan.md §4.2) */}
        <Route
          path="/dashboard/p/loadBoard/new"
          element={loggedIn ? <LoadForm /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/loadBoard/:loadId"
          element={loggedIn ? <LoadDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/vehicleManage/new"
          element={loggedIn ? <VehicleForm /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/vehicleManage/:vehicleId/edit"
          element={loggedIn ? <VehicleForm /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/transport/trips/:tripId"
          element={loggedIn ? <TripPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/transport/trips/:tripId/chat"
          element={loggedIn ? <ChatRoomPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/purchases/:purchaseId"
          element={loggedIn ? <PurchaseDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/purchases/:purchaseId/chat"
          element={loggedIn ? <ChatRoomPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/demands/new"
          element={loggedIn ? <DemandForm /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/demands/:demandId/edit"
          element={loggedIn ? <DemandForm /> : <Navigate to="/auth" replace />}
        />
        {/* Broker / dalal deep routes (plan/broker_plan.md §4.2) */}
        <Route
          path="/dashboard/p/broker/deals/new"
          element={loggedIn ? <DealFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/broker/deals/:dealId"
          element={loggedIn ? <DealDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/broker/deals/:dealId/edit"
          element={loggedIn ? <DealFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/farmer/deals/:dealId"
          element={loggedIn ? <FarmerDealDetailPage /> : <Navigate to="/auth" replace />}
        />
        {/* Direct-contract deep routes (buyer desk + farmer offer inbox) */}
        <Route
          path="/dashboard/p/contracts/new"
          element={loggedIn ? <ContractFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/contracts/:contractId/edit"
          element={loggedIn ? <ContractFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/contracts/:contractId"
          element={loggedIn ? <ContractDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/myContracts/:contractId"
          element={loggedIn ? <FarmerContractDetailPage /> : <Navigate to="/auth" replace />}
        />
        {/* Dairy deep routes (plan/dairy_plan.md §4.2) */}
        <Route
          path="/dairy/me"
          element={loggedIn ? <MyDairyPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console"
          element={loggedIn ? <DairyConsoleHome /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/collections"
          element={loggedIn ? <CollectionsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/collections/new"
          element={loggedIn ? <CollectionEntryPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/members"
          element={loggedIn ? <MembersPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/members/new"
          element={loggedIn ? <MemberFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/members/:memberId"
          element={loggedIn ? <MemberFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/members/:memberId/statement"
          element={loggedIn ? <MemberStatementPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/rate-chart"
          element={loggedIn ? <RateChartPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/payments"
          element={loggedIn ? <PaymentsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/payments/:batchId"
          element={loggedIn ? <BatchDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/sales/customers"
          element={loggedIn ? <CustomersPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/sales/customers/new"
          element={loggedIn ? <CustomerFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/sales/orders"
          element={loggedIn ? <OrdersPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/sales/orders/:orderId"
          element={loggedIn ? <OrderDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/stock"
          element={loggedIn ? <StockPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/reports"
          element={loggedIn ? <ReportsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/analytics"
          element={loggedIn ? <AnalyticsPage /> : <Navigate to="/auth" replace />}
        />
        {/* Gaushala console deep routes (plan/dairy_plan.md §14 P8) */}
        <Route
          path="/gaushala/console"
          element={loggedIn ? <GaushalaConsoleHome /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/gaushala/console/cattle"
          element={loggedIn ? <CattlePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/gaushala/console/cattle/new"
          element={loggedIn ? <CattleFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/gaushala/console/cattle/:animalId"
          element={loggedIn ? <CattleDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/gaushala/console/adoptions"
          element={loggedIn ? <AdoptionsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/gaushala/console/donations"
          element={loggedIn ? <DonationsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/gaushala/console/expenses"
          element={loggedIn ? <ExpensesPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/gaushala/console/byproducts"
          element={loggedIn ? <ByproductsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/gaushala/console/receipts"
          element={loggedIn ? <ReceiptsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/gaushala/console/analytics"
          element={loggedIn ? <GaushalaAnalyticsPage /> : <Navigate to="/auth" replace />}
        />
        {/* Vet network deep routes (plan/dairy_plan.md §14 P9) */}
        <Route
          path="/vetnet"
          element={loggedIn ? <VetsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/vetnet/appointments"
          element={loggedIn ? <AppointmentsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/vetnet/vets"
          element={loggedIn ? <VetsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/vetnet/vets/new"
          element={loggedIn ? <VetFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/vetnet/campaigns"
          element={loggedIn ? <CampaignsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/vetnet/campaigns/:campaignId"
          element={loggedIn ? <CampaignDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/vetnet/prescriptions"
          element={loggedIn ? <PrescriptionsPage /> : <Navigate to="/auth" replace />}
        />
        {/* Herd registry deep routes (plan/dairy_plan.md §14 P10) */}
        <Route
          path="/livestock/animals"
          element={loggedIn ? <AnimalsHomePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/livestock/animals/new"
          element={loggedIn ? <AnimalFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/livestock/animals/:animalId"
          element={loggedIn ? <AnimalDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/profiles"
          element={loggedIn ? <ProfilesPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/wallet"
          element={
            loggedIn ? (
              <PlaceholderPage icon="👛" titleKey="dashWallet" subKey="dashWalletSub" />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route
          path="/dashboard/profile"
          element={
            loggedIn ? (
              <PlaceholderPage icon="👤" titleKey="dashProfile" subKey="dashProfileSub" />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route path="/done" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
