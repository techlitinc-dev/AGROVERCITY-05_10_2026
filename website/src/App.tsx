import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { fetchMe } from './lib/api/auth';
import { isApiError } from './lib/api/client';
import { track } from './lib/analytics';
import { loadLocale } from './lib/i18n/loadLocale';
import { useT } from './lib/i18n';
import { useOnboardingStore } from './stores/onboarding';
import { useDashboardStore } from './stores/dashboard';
import { useSessionStore } from './stores/session';
import { ADMIN_MODULES, RequireAdminRole } from './views/admin/AdminShell';

// Eager: splash / auth / legal render before the app shell is warmed.
import Splash from './views/Splash';
import AuthView from './views/auth/AuthView';
import LegalPage from './views/legal/LegalPage';

// Route-level code splitting (WS-06 task 6.13) — heavy persona/module views
// load on demand so the first-load bundle stays under 400 KB.
const RegisterWizard = lazy(() => import('./views/auth/RegisterWizard'));
const DashboardHome = lazy(() => import('./views/dashboard/DashboardHome'));
const PlaceholderPage = lazy(() => import('./views/dashboard/PlaceholderPage'));
const ProfilesPage = lazy(() => import('./views/dashboard/ProfilesPage'));
const SearchResultsPage = lazy(() => import('./views/dashboard/SearchResultsPage'));
const ToolPage = lazy(() => import('./views/dashboard/ToolPage'));
const ChatsHubPage = lazy(() => import('./views/chat/ChatsHubPage'));
const AdminShell = lazy(() => import('./views/admin/AdminShell'));
const AdminHomePage = lazy(() => import('./views/admin/AdminHomePage'));
const ModerationQueuePage = lazy(() => import('./views/admin/ModerationQueuePage'));
const FraudQueuePage = lazy(() => import('./views/admin/FraudQueuePage'));
const LocaleReviewPage = lazy(() => import('./views/admin/LocaleReviewPage'));
const MetricsPage = lazy(() => import('./views/admin/MetricsPage'));
const NotificationPrefsPage = lazy(() => import('./views/settings/NotificationPrefsPage'));
const ConsentCenterPage = lazy(() => import('./views/settings/ConsentCenterPage'));
const DeleteAccountPage = lazy(() => import('./views/settings/DeleteAccountPage'));
const HelpCenterPage = lazy(() => import('./views/support/HelpCenterPage'));
const FarmMap = lazy(() => import('./views/onboarding/FarmMap'));
const LanguageSelect = lazy(() => import('./views/onboarding/LanguageSelect'));
const ProfileSelect = lazy(() => import('./views/onboarding/ProfileSelect'));
const ToolShell = lazy(() => import('./components/trade/ToolShell'));

const named = <K extends string>(loader: () => Promise<Record<string, unknown>>, name: K) =>
  lazy(() => loader().then((mod) => ({ default: mod[name] as ComponentType })));

const ChatRoomPage = named(() => import('./views/trade'), 'ChatRoomPage');
const DemandForm = named(() => import('./views/trade'), 'DemandForm');
const LotDetailPage = named(() => import('./views/trade'), 'LotDetailPage');
const LotForm = named(() => import('./views/trade'), 'LotForm');
const MandiChartsPage = named(() => import('./views/trade'), 'MandiChartsPage');
const OfferDetailPage = named(() => import('./views/trade'), 'OfferDetailPage');
const PriceAlertsPage = named(() => import('./views/trade'), 'PriceAlertsPage');
const PurchaseDetailPage = named(() => import('./views/trade'), 'PurchaseDetailPage');
const LoadDetailPage = named(() => import('./views/transport'), 'LoadDetailPage');
const LoadForm = named(() => import('./views/transport'), 'LoadForm');
const TripPage = named(() => import('./views/transport'), 'TripPage');
const VehicleForm = named(() => import('./views/transport'), 'VehicleForm');
const AdvisoryHubPage = named(() => import('./views/advisory'), 'AdvisoryHubPage');
const CropPlannerPage = named(() => import('./views/advisory'), 'CropPlannerPage');
const DiseaseScanPage = named(() => import('./views/advisory'), 'DiseaseScanPage');
const SchemeDetailPage = named(() => import('./views/schemes'), 'SchemeDetailPage');
const LandRecordDetailPage = named(() => import('./views/land'), 'LandRecordDetailPage');
const FpoMachineryPage = named(() => import('./views/fpo'), 'FpoMachineryPage');
const FpoPoolsPage = named(() => import('./views/fpo'), 'FpoPoolsPage');
const GradingPage = named(() => import('./views/postharvest'), 'GradingPage');
const MyBookingsPage = named(() => import('./views/postharvest'), 'MyBookingsPage');
const ReceiptsVaultPage = named(() => import('./views/postharvest'), 'ReceiptsVaultPage');
const WaterHomePage = named(() => import('./views/water'), 'WaterHomePage');
const ClimateHomePage = named(() => import('./views/climate'), 'ClimateHomePage');
const RewardsStorePage = named(() => import('./views/rewards'), 'RewardsStorePage');
const ReferralHubPage = named(() => import('./views/referrals'), 'ReferralHubPage');
const WomenHubPage = named(() => import('./views/women'), 'WomenHubPage');
const BiofuelPage = named(() => import('./views/trees'), 'BiofuelPage');
const NgoDirectoryPage = named(() => import('./views/trees'), 'NgoDirectoryPage');
const CreditScorePage = named(() => import('./views/finance'), 'CreditScorePage');
const EmiCalculatorPage = named(() => import('./views/finance'), 'EmiCalculatorPage');
const LoanMarketplacePage = named(() => import('./views/finance'), 'LoanMarketplacePage');
const LoanStatusPage = named(() => import('./views/finance'), 'LoanStatusPage');
const LoanWizardPage = named(() => import('./views/finance'), 'LoanWizardPage');
const AddressBookPage = named(() => import('./views/marketplace'), 'AddressBookPage');
const CartPage = named(() => import('./views/marketplace'), 'CartPage');
const CheckoutPage = named(() => import('./views/marketplace'), 'CheckoutPage');
const MarketplaceOrderDetailPage = named(() => import('./views/marketplace'), 'OrderDetailPage');
const MarketplaceOrdersPage = named(() => import('./views/marketplace'), 'OrdersPage');
const ProductDetailPage = named(() => import('./views/marketplace'), 'ProductDetailPage');
const ProductFormPage = named(() => import('./views/marketplace'), 'ProductFormPage');
const ReturnsPage = named(() => import('./views/marketplace'), 'ReturnsPage');
const SellerProductsPage = named(() => import('./views/marketplace'), 'SellerProductsPage');
const WishlistPage = named(() => import('./views/marketplace'), 'WishlistPage');
const DealDetailPage = named(() => import('./views/broker'), 'DealDetailPage');
const DealFormPage = named(() => import('./views/broker'), 'DealFormPage');
const ContractDetailPage = named(() => import('./views/directbuyer'), 'ContractDetailPage');
const ContractFormPage = named(() => import('./views/directbuyer'), 'ContractFormPage');
const DemandDetailPage = named(() => import('./views/directbuyer'), 'DemandDetailPage');
const TeamPage = named(() => import('./views/directbuyer'), 'TeamPage');
const ColdStorageDirectoryPage = named(() => import('./views/farmer'), 'ColdStorageDirectoryPage');
const FarmerClaimIntimatePage = named(() => import('./views/farmer'), 'FarmerClaimIntimatePage');
const FarmerClaimTrackerPage = named(() => import('./views/farmer'), 'FarmerClaimTrackerPage');
const FarmerContractDetailPage = named(() => import('./views/farmer'), 'FarmerContractDetailPage');
const FarmerDealDetailPage = named(() => import('./views/farmer'), 'FarmerDealDetailPage');
const LoanTrackingPage = named(() => import('./views/farmer'), 'LoanTrackingPage');
const MyStorageBookingsPage = named(() => import('./views/farmer'), 'MyStorageBookingsPage');
const WarehouseReceiptPage = named(() => import('./views/farmer'), 'WarehouseReceiptPage');
const LoanDetailPage = named(() => import('./views/bank'), 'LoanDetailPage');
const ClaimDetailPage = named(() => import('./views/insurance'), 'ClaimDetailPage');
const ClaimsQueuePage = named(() => import('./views/insurance'), 'ClaimsQueuePage');
const DisbursePage = named(() => import('./views/insurance'), 'DisbursePage');
const InsuranceHubPage = named(() => import('./views/insurance'), 'InsuranceHubPage');
const PolicyReviewPage = named(() => import('./views/insurance'), 'PolicyReviewPage');
const InsuranceRatesPage = named(() => import('./views/insurance'), 'RatesPage');
const SurveyorsPage = named(() => import('./views/insurance'), 'SurveyorsPage');
const BookingsQueuePage = named(() => import('./views/coldstorage'), 'BookingsQueuePage');
const ChambersPage = named(() => import('./views/coldstorage'), 'ChambersPage');
const FacilitiesPage = named(() => import('./views/coldstorage'), 'FacilitiesPage');
const InwardRegisterPage = named(() => import('./views/coldstorage'), 'InwardRegisterPage');
const ReleasePage = named(() => import('./views/coldstorage'), 'ReleasePage');
const UtilizationPage = named(() => import('./views/coldstorage'), 'UtilizationPage');
const LandAnalyticsPageRoute = named(() => import('./views/landlord'), 'LandAnalyticsPageRoute');
const LeasesPageRoute = named(() => import('./views/landlord'), 'LeasesPageRoute');
const ListingsPageRoute = named(() => import('./views/landlord'), 'ListingsPageRoute');
const ListingWizardRoute = named(() => import('./views/landlord'), 'ListingWizardRoute');
const PlotsPageRoute = named(() => import('./views/landlord'), 'PlotsPageRoute');
const RequestsInboxPageRoute = named(() => import('./views/landlord'), 'RequestsInboxPageRoute');
const RentTrackerPageRoute = named(() => import('./views/landlord'), 'RentTrackerPageRoute');
const Vault712PageRoute = named(() => import('./views/landlord'), 'Vault712PageRoute');
const BookingQueuePageRoute = named(() => import('./views/equipment'), 'BookingQueuePageRoute');
const DamageClaimsPageRoute = named(() => import('./views/equipment'), 'DamageClaimsPageRoute');
const DispatchPageRoute = named(() => import('./views/equipment'), 'DispatchPageRoute');
const EquipmentSlotsPageRoute = named(() => import('./views/equipment'), 'EquipmentSlotsPageRoute');
const FleetPageRoute = named(() => import('./views/equipment'), 'FleetPageRoute');
const MaintenancePageRoute = named(() => import('./views/equipment'), 'MaintenancePageRoute');
const OwnerOverviewPageRoute = named(() => import('./views/equipment'), 'OwnerOverviewPageRoute');
const RoiAnalyticsPageRoute = named(() => import('./views/equipment'), 'RoiAnalyticsPageRoute');
const BatchDetailPage = named(() => import('./views/dairy'), 'BatchDetailPage');
const CollectionEntryPage = named(() => import('./views/dairy'), 'CollectionEntryPage');
const CollectionsPage = named(() => import('./views/dairy'), 'CollectionsPage');
const CustomerFormPage = named(() => import('./views/dairy'), 'CustomerFormPage');
const CustomersPage = named(() => import('./views/dairy'), 'CustomersPage');
const DairyConsoleHome = named(() => import('./views/dairy'), 'DairyConsoleHome');
const MemberFormPage = named(() => import('./views/dairy'), 'MemberFormPage');
const MemberStatementPage = named(() => import('./views/dairy'), 'MemberStatementPage');
const MembersPage = named(() => import('./views/dairy'), 'MembersPage');
const MyDairyPage = named(() => import('./views/dairy'), 'MyDairyPage');
const DairyOrderDetailPage = named(() => import('./views/dairy'), 'OrderDetailPage');
const DairyOrdersPage = named(() => import('./views/dairy'), 'OrdersPage');
const PaymentsPage = named(() => import('./views/dairy'), 'PaymentsPage');
const RateChartPage = named(() => import('./views/dairy'), 'RateChartPage');
const ReportsPage = named(() => import('./views/dairy'), 'ReportsPage');
const StockPage = named(() => import('./views/dairy'), 'StockPage');
const AnalyticsPage = named(() => import('./views/dairy'), 'AnalyticsPage');
const FarmerRfqsPage = named(() => import('./views/dairyMarket'), 'FarmerRfqsPage');
const BidComparePage = named(() => import('./views/dairyMarket'), 'BidComparePage');
const AdoptionsPage = named(() => import('./views/gaushala'), 'AdoptionsPage');
const ByproductsPage = named(() => import('./views/gaushala'), 'ByproductsPage');
const CattleDetailPage = named(() => import('./views/gaushala'), 'CattleDetailPage');
const CattleFormPage = named(() => import('./views/gaushala'), 'CattleFormPage');
const CattlePage = named(() => import('./views/gaushala'), 'CattlePage');
const DonationsPage = named(() => import('./views/gaushala'), 'DonationsPage');
const ExpensesPage = named(() => import('./views/gaushala'), 'ExpensesPage');
const GaushalaAnalyticsPage = named(() => import('./views/gaushala'), 'GaushalaAnalyticsPage');
const GaushalaConsoleHome = named(() => import('./views/gaushala'), 'GaushalaConsoleHome');
const GaushalaTransparencyPage = named(() => import('./views/gaushala'), 'GaushalaTransparencyPage');
const GaushalaReceiptsPage = named(() => import('./views/gaushala'), 'ReceiptsPage');
const AppointmentsPage = named(() => import('./views/vetnet'), 'AppointmentsPage');
const CampaignDetailPage = named(() => import('./views/vetnet'), 'CampaignDetailPage');
const CampaignsPage = named(() => import('./views/vetnet'), 'CampaignsPage');
const PrescriptionsPage = named(() => import('./views/vetnet'), 'PrescriptionsPage');
const VetFormPage = named(() => import('./views/vetnet'), 'VetFormPage');
const VetsPage = named(() => import('./views/vetnet'), 'VetsPage');
const AnimalDetailPage = named(() => import('./views/animals'), 'AnimalDetailPage');
const AnimalFormPage = named(() => import('./views/animals'), 'AnimalFormPage');
const AnimalsHomePage = named(() => import('./views/animals'), 'AnimalsHomePage');
const CertificatePage = named(() => import('./views/academy'), 'CertificatePage');
const CourseDetailPage = named(() => import('./views/academy'), 'CourseDetailPage');
const CoursePlayerPage = named(() => import('./views/academy'), 'CoursePlayerPage');
const PurchaseSheet = named(() => import('./views/academy'), 'PurchaseSheet');
const SkillPassportPage = named(() => import('./views/academy'), 'SkillPassportPage');
const VerifyCertificatePage = named(() => import('./views/academy'), 'VerifyCertificatePage');
const WorkshopsPage = named(() => import('./views/gyan'), 'WorkshopsPage');
const NewsDetailPage = named(() => import('./views/news'), 'NewsDetailPage');
const ChannelPlayerPage = named(() => import('./views/channels'), 'ChannelPlayerPage');
const InspectionPage = named(() => import('./views/customer'), 'InspectionPage');
const StorefrontPage = named(() => import('./views/customer'), 'StorefrontPage');

// Phase-07 admin console module pages.
const AdminP1 = () => import('./views/admin/AdminPagesP1');
const AdminP2 = () => import('./views/admin/AdminPagesP2');
const AdminP3 = () => import('./views/admin/AdminPagesP3');
const AdminP45 = () => import('./views/admin/AdminPagesP45');
const UsersPage = named(AdminP1, 'UsersPage');
const SessionsPage = named(AdminP1, 'SessionsPage');
const KycQueuePage = named(AdminP1, 'KycQueuePage');
const ConfigPage = named(AdminP1, 'ConfigPage');
const BroadcastPage = named(AdminP1, 'BroadcastPage');
const ModerationPage = named(AdminP1, 'ModerationPage');
const ConsentAuditPage = named(AdminP1, 'ConsentAuditPage');
const MandiRatesPage = named(AdminP2, 'MandiRatesPage');
const LotsDealsPage = named(AdminP2, 'LotsDealsPage');
const OrdersPage = named(AdminP2, 'OrdersPage');
const BuyersPage = named(AdminP2, 'BuyersPage');
const FleetPage = named(AdminP2, 'FleetPage');
const EquipmentPage = named(AdminP2, 'EquipmentPage');
const DiaryPage = named(AdminP2, 'DiaryPage');
const SettlementsPage = named(AdminP2, 'SettlementsPage');
const LandLeasesPage = named(AdminP3, 'LandLeasesPage');
const AdvisoryOpsPage = named(AdminP3, 'AdvisoryOpsPage');
const ChatbotOpsPage = named(AdminP3, 'ChatbotOpsPage');
const LandRecordsHealthPage = named(AdminP3, 'LandRecordsHealthPage');
const WaterSchedulesPage = named(AdminP3, 'WaterSchedulesPage');
const ColdStoragePage = named(AdminP3, 'ColdStoragePage');
const DisputesInboxPage = named(AdminP3, 'DisputesInboxPage');
const BankingPage = named(AdminP45, 'BankingPage');
const LoansPage = named(AdminP45, 'LoansPage');
const InsuranceClaimsPage = named(AdminP45, 'InsuranceClaimsPage');
const AdminInsuranceRatesPage = named(AdminP45, 'InsuranceRatesPage');
const FpoPage = named(AdminP45, 'FpoPage');
const AdminVetsPage = named(AdminP45, 'VetsPage');
const ContentCmsPage = named(AdminP45, 'ContentCmsPage');
const TreesPage = named(AdminP45, 'TreesPage');
const GamificationPage = named(AdminP45, 'GamificationPage');
const ShgPage = named(AdminP45, 'ShgPage');
const CoursesPage = named(AdminP45, 'CoursesPage');
const AiHealthPage = named(AdminP45, 'AiHealthPage');

function adminRolesFor(path: string): string[] {
  return ADMIN_MODULES.find((m) => m.path === path)?.roles ?? ['superadmin'];
}

const ADMIN_ROUTES: { path: string; Component: ComponentType }[] = [
  { path: '/admin/users', Component: UsersPage },
  { path: '/admin/auth', Component: SessionsPage },
  { path: '/admin/kyc', Component: KycQueuePage },
  { path: '/admin/config', Component: ConfigPage },
  { path: '/admin/broadcasts', Component: BroadcastPage },
  { path: '/admin/moderation', Component: ModerationPage },
  { path: '/admin/consents', Component: ConsentAuditPage },
  { path: '/admin/mandi', Component: MandiRatesPage },
  { path: '/admin/lots', Component: LotsDealsPage },
  { path: '/admin/orders', Component: OrdersPage },
  { path: '/admin/buyers', Component: BuyersPage },
  { path: '/admin/fleet', Component: FleetPage },
  { path: '/admin/equipment', Component: EquipmentPage },
  { path: '/admin/diary', Component: DiaryPage },
  { path: '/admin/settlements', Component: SettlementsPage },
  { path: '/admin/land', Component: LandLeasesPage },
  { path: '/admin/advisory', Component: AdvisoryOpsPage },
  { path: '/admin/chatbot', Component: ChatbotOpsPage },
  { path: '/admin/land-records', Component: LandRecordsHealthPage },
  { path: '/admin/water', Component: WaterSchedulesPage },
  { path: '/admin/cold-storage', Component: ColdStoragePage },
  { path: '/admin/disputes', Component: DisputesInboxPage },
  { path: '/admin/banking', Component: BankingPage },
  { path: '/admin/loans', Component: LoansPage },
  { path: '/admin/insurance', Component: InsuranceClaimsPage },
  { path: '/admin/insurance-rates', Component: AdminInsuranceRatesPage },
  { path: '/admin/fpos', Component: FpoPage },
  { path: '/admin/vets', Component: AdminVetsPage },
  { path: '/admin/content', Component: ContentCmsPage },
  { path: '/admin/trees', Component: TreesPage },
  { path: '/admin/gamification', Component: GamificationPage },
  { path: '/admin/shgs', Component: ShgPage },
  { path: '/admin/courses', Component: CoursesPage },
  { path: '/admin/ai-health', Component: AiHealthPage },
];

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

/** Route-change analytics (WS-09 task 9.5). */
function RouteAnalytics() {
  const location = useLocation();
  useEffect(() => {
    track('screen_view', { path: location.pathname });
  }, [location.pathname]);
  return null;
}

export default function App() {
  useSessionHydration();

  const t = useT();
  const isOnboarded = useOnboardingStore((s) => s.isOnboarded);
  const language = useOnboardingStore((s) => s.language);

  // Lazily load a non-en/hi locale dictionary when it is selected.
  useEffect(() => {
    void loadLocale(language);
  }, [language]);
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
      <RouteAnalytics />
      <Suspense
        fallback={
          <div className="dash-content">
            <p className="trade-hint">{t('appLoading')}</p>
          </div>
        }
      >
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
        {/* Public certificate verification (task 1.16/1.17) — works logged out. */}
        <Route path="/verify/cert/:certificateId" element={<VerifyCertificatePage />} />
        <Route
          path="/dashboard"
          element={loggedIn ? <DashboardHome /> : <Navigate to="/auth" replace />}
        />
        {/* Global search results (phase-05 WS-09) — deep-linkable ?q=query. */}
        <Route
          path="/search"
          element={loggedIn ? <SearchResultsPage /> : <Navigate to="/auth" replace />}
        />
        {/* Chats hub (phase-06 WS-01) — all deal conversations with unread badges. */}
        <Route
          path="/chats"
          element={loggedIn ? <ChatsHubPage /> : <Navigate to="/auth" replace />}
        />
        {/* Phase-07 superadmin console shell — role-gated /admin/* section. */}
        <Route
          path="/admin"
          element={loggedIn ? <AdminShell /> : <Navigate to="/auth" replace />}
        >
          <Route index element={<AdminHomePage />} />
          {ADMIN_ROUTES.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                loggedIn ? (
                  <RequireAdminRole roles={adminRolesFor(route.path)}>
                    <route.Component />
                  </RequireAdminRole>
                ) : (
                  <Navigate to="/auth" replace />
                )
              }
            />
          ))}
        </Route>
        {/* Admin moderation queue (phase-06 WS-01; phase-07 restyles). */}
        <Route
          path="/admin/moderation-queue"
          element={loggedIn ? <ModerationQueuePage /> : <Navigate to="/auth" replace />}
        />
        {/* Admin fraud/hold queue (phase-06 WS-03; phase-07 restyles). */}
        <Route
          path="/admin/fraud-queue"
          element={loggedIn ? <FraudQueuePage /> : <Navigate to="/auth" replace />}
        />
        {/* Admin locale review (phase-06 WS-07; phase-07 restyles). */}
        <Route
          path="/admin/locale-review"
          element={loggedIn ? <LocaleReviewPage /> : <Navigate to="/auth" replace />}
        />
        {/* Admin north-star metrics (phase-06 WS-09; phase-07 restyles). */}
        <Route
          path="/admin/metrics"
          element={loggedIn ? <MetricsPage /> : <Navigate to="/auth" replace />}
        />
        {/* Notification preferences center (phase-06 WS-02 G6). */}
        <Route
          path="/settings/notifications"
          element={loggedIn ? <NotificationPrefsPage /> : <Navigate to="/auth" replace />}
        />
        {/* Consent center + account deletion (phase-06 WS-04). */}
        <Route
          path="/settings/consents"
          element={loggedIn ? <ConsentCenterPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/settings/delete-account"
          element={loggedIn ? <DeleteAccountPage /> : <Navigate to="/auth" replace />}
        />
        {/* Help center + AI support agent (phase-06 WS-05). */}
        <Route
          path="/support"
          element={loggedIn ? <HelpCenterPage /> : <Navigate to="/auth" replace />}
        />
        {/* Deep-linkable tool pages (backend DEEP_LINKS) resolve here:
            path="/dashboard/p/machineManage" (equipment),
            path="/dashboard/p/landlordLeases" (land),
            path="/dashboard/p/courses" (courses).
            Static deep routes (myOffers, transport/trips, purchases,
            broker/deals, contracts, chats, dairy/console) are registered above. */}
        {/* Landlord LandBank deep routes (phase-02 WS-01) */}
        <Route
          path="/dashboard/p/landlord/plots"
          element={loggedIn ? <PlotsPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/landlord/listings"
          element={loggedIn ? <ListingsPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/landlord/listings/new"
          element={loggedIn ? <ListingWizardRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/landlord/requests"
          element={loggedIn ? <RequestsInboxPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/landlord/leases"
          element={loggedIn ? <LeasesPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/landlord/rent"
          element={loggedIn ? <RentTrackerPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/landlord/analytics"
          element={loggedIn ? <LandAnalyticsPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/landlord/vault"
          element={loggedIn ? <Vault712PageRoute /> : <Navigate to="/auth" replace />}
        />
        {/* Equipment owner deep routes (phase-02 WS-04) */}
        <Route
          path="/dashboard/p/equipment/overview"
          element={loggedIn ? <OwnerOverviewPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/equipment/fleet"
          element={loggedIn ? <FleetPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/equipment/bookings"
          element={loggedIn ? <BookingQueuePageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/equipment/dispatch"
          element={loggedIn ? <DispatchPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/equipment/claims"
          element={loggedIn ? <DamageClaimsPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/equipment/maintenance"
          element={loggedIn ? <MaintenancePageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/equipment/analytics"
          element={loggedIn ? <RoiAnalyticsPageRoute /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/equipment/:equipmentId/slots"
          element={loggedIn ? <EquipmentSlotsPageRoute /> : <Navigate to="/auth" replace />}
        />
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
          path="/dashboard/p/mandiCharts"
          element={loggedIn ? <MandiChartsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/priceAlerts"
          element={loggedIn ? <PriceAlertsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/advisoryHub"
          element={loggedIn ? <AdvisoryHubPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/diseaseScan"
          element={
            loggedIn ? (
              <ToolShell toolId="advisory">
                <DiseaseScanPage />
              </ToolShell>
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route
          path="/dashboard/p/cropPlanner"
          element={
            loggedIn ? (
              <ToolShell toolId="advisory">
                <CropPlannerPage />
              </ToolShell>
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        {/* WS-05 finance & protection deep routes */}
        <Route
          path="/dashboard/p/schemes/:schemeId"
          element={loggedIn ? <SchemeDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/creditScore"
          element={loggedIn ? <CreditScorePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/loanMarketplace"
          element={loggedIn ? <LoanMarketplacePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/emiCalculator"
          element={loggedIn ? <EmiCalculatorPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/loanWizard"
          element={loggedIn ? <LoanWizardPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/loanStatus"
          element={loggedIn ? <LoanStatusPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/insuranceHub"
          element={loggedIn ? <InsuranceHubPage /> : <Navigate to="/auth" replace />}
        />
        {/* WS-06 land, FPO & post-harvest deep routes */}
        <Route
          path="/dashboard/p/landRecordView"
          element={loggedIn ? <LandRecordDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/fpoPools"
          element={loggedIn ? <FpoPoolsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/fpoMachinery"
          element={loggedIn ? <FpoMachineryPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/storageBookings"
          element={loggedIn ? <MyBookingsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/receiptsVault"
          element={loggedIn ? <ReceiptsVaultPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/grading"
          element={loggedIn ? <GradingPage /> : <Navigate to="/auth" replace />}
        />
        {/* WS-07 water, climate & green deep routes */}
        <Route
          path="/dashboard/p/waterSchedule"
          element={loggedIn ? <WaterHomePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/climateCarbon"
          element={loggedIn ? <ClimateHomePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/treeNgo"
          element={loggedIn ? <NgoDirectoryPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/biofuel"
          element={loggedIn ? <BiofuelPage /> : <Navigate to="/auth" replace />}
        />
        {/* WS-08 engagement deep routes (Krishi Ratna, Refer & Earn, Women Hub) */}
        <Route
          path="/dashboard/p/rewards"
          element={loggedIn ? <RewardsStorePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/rewardsStore"
          element={loggedIn ? <RewardsStorePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/referralHub"
          element={loggedIn ? <ReferralHubPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/womenHub"
          element={loggedIn ? <WomenHubPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/marketplace/cart"
          element={loggedIn ? <CartPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/marketplace/checkout"
          element={loggedIn ? <CheckoutPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/marketplace/returns"
          element={loggedIn ? <ReturnsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/marketplace/products/new"
          element={loggedIn ? <ProductFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/marketplace/products/:productId/edit"
          element={loggedIn ? <ProductFormPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/marketplace/:productId"
          element={loggedIn ? <ProductDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/orders"
          element={loggedIn ? <MarketplaceOrdersPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/orders/:orderId"
          element={loggedIn ? <MarketplaceOrderDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/wishlist"
          element={loggedIn ? <WishlistPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/addressBook"
          element={loggedIn ? <AddressBookPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/sellerProducts"
          element={loggedIn ? <SellerProductsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/myProducts"
          element={loggedIn ? <SellerProductsPage /> : <Navigate to="/auth" replace />}
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
        {/* ProcurePro team + demand detail (phase-03 WS-02) */}
        <Route
          path="/dashboard/p/contracts/team"
          element={loggedIn ? <TeamPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/demands/:demandId"
          element={loggedIn ? <DemandDetailPage /> : <Navigate to="/auth" replace />}
        />
        {/* CreditDesk loan detail (phase-03 WS-03) */}
        <Route
          path="/dashboard/p/loanReview/:applicationId"
          element={loggedIn ? <LoanDetailPage /> : <Navigate to="/auth" replace />}
        />
        {/* ClaimsDesk provider console (phase-03 WS-04) */}
        <Route
          path="/insurance/console/claims"
          element={loggedIn ? <ClaimsQueuePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/insurance/console/claims/:claimId"
          element={loggedIn ? <ClaimDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/insurance/console/surveyors"
          element={loggedIn ? <SurveyorsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/insurance/console/disburse"
          element={loggedIn ? <DisbursePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/insurance/console/policies"
          element={loggedIn ? <PolicyReviewPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/insurance/console/rates"
          element={loggedIn ? <InsuranceRatesPage /> : <Navigate to="/auth" replace />}
        />
        {/* Farmer claim mirror (phase-03 WS-04) */}
        <Route
          path="/insurance/claims/new"
          element={loggedIn ? <FarmerClaimIntimatePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/insurance/my-claims"
          element={loggedIn ? <FarmerClaimTrackerPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/insurance/my-claims/:claimId"
          element={loggedIn ? <FarmerClaimTrackerPage /> : <Navigate to="/auth" replace />}
        />
        {/* StoreHouse provider console + farmer storage (phase-03 WS-05) */}
        <Route
          path="/storage/console/facilities"
          element={loggedIn ? <FacilitiesPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/storage/console/chambers"
          element={loggedIn ? <ChambersPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/storage/console/bookings"
          element={loggedIn ? <BookingsQueuePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/storage/console/inward"
          element={loggedIn ? <InwardRegisterPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/storage/console/release"
          element={loggedIn ? <ReleasePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/storage/console/utilization"
          element={loggedIn ? <UtilizationPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/storage/directory"
          element={loggedIn ? <ColdStorageDirectoryPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/storage/my-bookings"
          element={loggedIn ? <MyStorageBookingsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/storage/receipts/:receiptNumber"
          element={loggedIn ? <WarehouseReceiptPage /> : <Navigate to="/auth" replace />}
        />
        {/* Public gaushala transparency page (phase-03 WS-06 — no auth guard) */}
        <Route path="/gaushala/:id/transparent" element={<GaushalaTransparencyPage />} />
        {/* Dairy marketplace RFQs & Bid Compare */}
        <Route
          path="/dairy-market/rfqs"
          element={loggedIn ? <FarmerRfqsPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy-market/bids/compare/:demandId"
          element={loggedIn ? <BidComparePage /> : <Navigate to="/auth" replace />}
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
          element={loggedIn ? <DairyOrdersPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dairy/console/sales/orders/:orderId"
          element={loggedIn ? <DairyOrderDetailPage /> : <Navigate to="/auth" replace />}
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
          element={loggedIn ? <GaushalaReceiptsPage /> : <Navigate to="/auth" replace />}
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
        {/* Krishi Academy learner deep routes (phase-04 WS-01) */}
        <Route
          path="/dashboard/p/courses/:courseId"
          element={loggedIn ? <CourseDetailPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/courses/:courseId/purchase"
          element={loggedIn ? <PurchaseSheet /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/courses/:courseId/learn"
          element={loggedIn ? <CoursePlayerPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/courses/:courseId/certificate"
          element={loggedIn ? <CertificatePage /> : <Navigate to="/auth" replace />}
        />
        {/* Gyan Hub workshop detail (phase-04 WS-04) */}
        <Route
          path="/dashboard/p/gyanWorkshops/:workshopId"
          element={loggedIn ? <WorkshopsPage /> : <Navigate to="/auth" replace />}
        />
        {/* Agri News article (phase-04 WS-05) */}
        <Route
          path="/dashboard/p/agriNews/:newsId"
          element={loggedIn ? <NewsDetailPage /> : <Navigate to="/auth" replace />}
        />
        {/* Live channel player (phase-04 WS-05) */}
        <Route
          path="/dashboard/p/liveChannels/:channelId"
          element={loggedIn ? <ChannelPlayerPage /> : <Navigate to="/auth" replace />}
        />
        {/* FarmGate farmer storefront + order inspection (phase-04 WS-03) */}
        <Route
          path="/dashboard/p/storefront/:farmerId"
          element={loggedIn ? <StorefrontPage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/dashboard/p/orders/:orderId/inspect"
          element={loggedIn ? <InspectionPage /> : <Navigate to="/auth" replace />}
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
          element={loggedIn ? <SkillPassportPage /> : <Navigate to="/auth" replace />}
        />
        <Route path="/done" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </div>
  );
}
