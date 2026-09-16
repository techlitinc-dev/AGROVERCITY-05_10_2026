import { lazy } from 'react';

export const Pages = {
  Splash: lazy(() => import('@/modules/onboarding/SplashPage')),
  Language: lazy(() => import('@/modules/onboarding/LanguagePage')),
  Profiles: lazy(() => import('@/modules/onboarding/ProfilesPage')),
  Login: lazy(() => import('@/modules/onboarding/LoginPage')),
  Register: lazy(() => import('@/modules/onboarding/RegisterPage')),
  FarmMap: lazy(() => import('@/modules/onboarding/FarmMapPage')),

  FarmerHome: lazy(() => import('@/modules/home/FarmerHome')),
  LandlordHome: lazy(() => import('@/modules/home/LandlordHome')),
  TransportHome: lazy(() => import('@/modules/home/TransportHome')),
  SellerHome: lazy(() => import('@/modules/home/SellerHome')),
  EquipmentOwnerHome: lazy(() => import('@/modules/home/EquipmentOwnerHome')),
  BrokerHome: lazy(() => import('@/modules/home/BrokerHome')),
  WeatherDetail: lazy(() => import('@/modules/home/WeatherDetailPage')),

  Mandi: lazy(() => import('@/modules/mandi/MandiPage')),
  PriceHistory: lazy(() => import('@/modules/mandi/PriceHistoryPage')),

  Marketplace: lazy(() => import('@/modules/marketplace/MarketplacePage')),
  ProductDetail: lazy(() => import('@/modules/marketplace/ProductDetailPage')),
  Cart: lazy(() => import('@/modules/marketplace/CartPage')),
  Orders: lazy(() => import('@/modules/marketplace/OrdersPage')),
  OrderTracking: lazy(() => import('@/modules/marketplace/OrderTrackingPage')),

  Buyers: lazy(() => import('@/modules/buyers/BuyersPage')),

  VehicleManage: lazy(() => import('@/modules/transport/VehicleManagePage')),
  VehicleCalendar: lazy(() => import('@/modules/transport/VehicleCalendarPage')),
  TripDetail: lazy(() => import('@/modules/transport/TripDetailPage')),
  BookingRequests: lazy(() => import('@/modules/transport/BookingRequestsPage')),
  Settlements: lazy(() => import('@/modules/transport/SettlementsPage')),

  Equipment: lazy(() => import('@/modules/equipment/EquipmentPage')),
  MachineManage: lazy(() => import('@/modules/equipment/MachineManagePage')),
  SlotCalendarManage: lazy(() => import('@/modules/equipment/SlotCalendarManagePage')),
  EquipmentRequests: lazy(() => import('@/modules/equipment/EquipmentRequestsPage')),
  MaintenanceLog: lazy(() => import('@/modules/equipment/MaintenanceLogPage')),

  Fpo: lazy(() => import('@/modules/fpo/FpoPage')),
  FpoDiscover: lazy(() => import('@/modules/fpo/FpoDiscoverPage')),

  ProfitLoss: lazy(() => import('@/modules/finance/ProfitLossPage')),
  Diary: lazy(() => import('@/modules/finance/DiaryPage')),
  Finance: lazy(() => import('@/modules/finance/FinancePage')),
  LoanTracking: lazy(() => import('@/modules/finance/LoanTrackingPage')),

  PlotManage: lazy(() => import('@/modules/landlord/PlotManagePage')),
  LeaseManage: lazy(() => import('@/modules/landlord/LeaseManagePage')),
  RentTracking: lazy(() => import('@/modules/landlord/RentTrackingPage')),
  LandListings: lazy(() => import('@/modules/landlord/LandListingsPage')),
  LeaseRequests: lazy(() => import('@/modules/landlord/LeaseRequestsPage')),
  LandBrowse: lazy(() => import('@/modules/landlord/LandBrowsePage')),
  MyLeaseRequests: lazy(() => import('@/modules/landlord/MyLeaseRequestsPage')),

  Schemes: lazy(() => import('@/modules/schemes/SchemesPage')),
  Vault: lazy(() => import('@/modules/schemes/VaultPage')),
  LandRecords: lazy(() => import('@/modules/schemes/LandRecordsPage')),
  Water: lazy(() => import('@/modules/schemes/WaterPage')),

  Insurance: lazy(() => import('@/modules/insurance/InsurancePage')),

  News: lazy(() => import('@/modules/content/NewsPage')),
  Channels: lazy(() => import('@/modules/content/ChannelsPage')),
  ChannelDetail: lazy(() => import('@/modules/content/ChannelDetailPage')),
  GyanHub: lazy(() => import('@/modules/content/GyanHubPage')),

  Livestock: lazy(() => import('@/modules/livestock/LivestockPage')),
  Tree: lazy(() => import('@/modules/tree/TreePage')),

  Advisory: lazy(() => import('@/modules/assistant/AdvisoryPage')),
  FarmTasks: lazy(() => import('@/modules/assistant/FarmTasksPage')),

  KrishiRatna: lazy(() => import('@/modules/engage/KrishiRatnaPage')),
  ReferEarn: lazy(() => import('@/modules/engage/ReferEarnPage')),

  WomenHub: lazy(() => import('@/modules/women/WomenHubPage')),
  Climate: lazy(() => import('@/modules/climate/ClimatePage')),

  PostHarvest: lazy(() => import('@/modules/postharvest/PostHarvestPage')),
  SoilTests: lazy(() => import('@/modules/postharvest/SoilTestsPage')),

  SellProduce: lazy(() => import('@/modules/sell/SellProducePage')),

  Notifications: lazy(() => import('@/modules/account/NotificationsPage')),
  Settings: lazy(() => import('@/modules/account/SettingsPage')),
  Help: lazy(() => import('@/modules/account/HelpPage')),
  AccountDelete: lazy(() => import('@/modules/account/AccountDeletePage')),
  ProfileEdit: lazy(() => import('@/modules/account/ProfileEditPage')),
  AddressBook: lazy(() => import('@/modules/account/AddressBookPage')),
  BankAccounts: lazy(() => import('@/modules/account/BankAccountsPage')),
  MyBookings: lazy(() => import('@/modules/account/MyBookingsPage')),
  ChatList: lazy(() => import('@/modules/account/ChatListPage')),
  ChatThread: lazy(() => import('@/modules/account/ChatThreadPage')),
  SupportThread: lazy(() => import('@/modules/account/SupportThreadPage')),

  SearchResults: lazy(() => import('@/modules/search/SearchResultsPage')),

  RatePost: lazy(() => import('@/modules/sellermanage/RatePostPage')),
  Inventory: lazy(() => import('@/modules/sellermanage/InventoryPage')),
  SalesEntry: lazy(() => import('@/modules/sellermanage/SalesEntryPage')),
  Procurement: lazy(() => import('@/modules/sellermanage/ProcurementPage')),
  BuyerLedgers: lazy(() => import('@/modules/sellermanage/BuyerLedgersPage')),

  DealManage: lazy(() => import('@/modules/brokermanage/DealManagePage')),
  DealRoom: lazy(() => import('@/modules/brokermanage/DealRoomPage')),
  LeadManage: lazy(() => import('@/modules/brokermanage/LeadManagePage')),
  CommissionLedger: lazy(() => import('@/modules/brokermanage/CommissionLedgerPage')),
  BuyerRequirements: lazy(() => import('@/modules/brokermanage/BuyerRequirementsPage')),
};
