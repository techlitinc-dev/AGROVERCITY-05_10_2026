/**
 * Dashboard registry — mirrors the mobile app's dashboard structure:
 *   TOOL_BY_ID            ← apps/mobile/lib/components/navigation/all_tools_sheet.dart
 *   PROFILE_ROUTES        ← apps/mobile/lib/state/profile_routes.dart
 *   PERSONA_HOME_CONFIG   ← apps/mobile/lib/views/home_view.dart + views/profile_home/*
 * Everything here is static config; the views render placeholders only.
 */

export interface Tool {
  id: string;
  icon: string;
  color: string;
}

const TOOL_LIST: Tool[] = [
  // All Tools sheet — 26 master modules (all_tools_sheet.dart order)
  { id: 'home', icon: '🏠', color: '#16A34A' },
  { id: 'gyanHub', icon: '🎓', color: '#D97706' },
  { id: 'treePlantation', icon: '🌳', color: '#15803D' },
  { id: 'liveChannels', icon: '📺', color: '#E11D48' },
  { id: 'agriNews', icon: '📰', color: '#0284C7' },
  { id: 'livestockDairy', icon: '🐄', color: '#D97706' },
  { id: 'farmDiary', icon: '📖', color: '#4F46E5' },
  { id: 'referEarn', icon: '🎁', color: '#CA8A04' },
  { id: 'advisory', icon: '📷', color: '#0284C7' },
  { id: 'mandi', icon: '📈', color: '#EA580C' },
  { id: 'marketplace', icon: '🛒', color: '#84CC16' },
  { id: 'myProducts', icon: '📦', color: '#EA580C' },
  { id: 'buyers', icon: '🤝', color: '#D97706' },
  { id: 'profitLoss', icon: '📊', color: '#10B981' },
  { id: 'water', icon: '💧', color: '#06B6D4' },
  { id: 'schemes', icon: '🏛️', color: '#6366F1' },
  { id: 'finance', icon: '💳', color: '#8B5CF6' },
  { id: 'cropInsurance', icon: '🛡️', color: '#047857' },
  { id: 'myBookings', icon: '✅', color: '#0D9488' },
  { id: 'womenFarmer', icon: '💖', color: '#EC4899' },
  { id: 'fpo', icon: '👥', color: '#14B8A6' },
  { id: 'equipment', icon: '🚜', color: '#F59E0B' },
  { id: 'landLegal', icon: '📜', color: '#78716C' },
  { id: 'climate', icon: '🌿', color: '#22C55E' },
  { id: 'postHarvest', icon: '❄️', color: '#3B82F6' },
  { id: 'krishiRatna', icon: '🏅', color: '#EAB308' },
  // Persona-specific routes that also appear as dashboard tiles
  { id: 'sellProduce', icon: '🌾', color: '#43A047' },
  { id: 'buyDemands', icon: '📢', color: '#43A047' },
  { id: 'landlordPlots', icon: '🗺️', color: '#8B5CF6' },
  { id: 'landListings', icon: '🏞️', color: '#8B5CF6' },
  { id: 'leaseRequests', icon: '📩', color: '#8B5CF6' },
  { id: 'loadBoard', icon: '🚛', color: '#0284C7' },
  { id: 'bookingInbox', icon: '📥', color: '#0284C7' },
  { id: 'vehicleManage', icon: '🚚', color: '#0284C7' },
  { id: 'transporterProfile', icon: '🪪', color: '#0284C7' },
  { id: 'liveTracking', icon: '🛰️', color: '#0284C7' },
  { id: 'biltyView', icon: '📄', color: '#0284C7' },
  { id: 'tripDetail', icon: '🛣️', color: '#0284C7' },
  { id: 'vehicleCalendar', icon: '📅', color: '#0284C7' },
  { id: 'settlements', icon: '💸', color: '#0284C7' },
  { id: 'sellerProducts', icon: '🏷️', color: '#EA580C' },
  { id: 'brokerHome', icon: '🤝', color: '#14B8A6' },
  { id: 'deals', icon: '🤝', color: '#14B8A6' },
  { id: 'commissions', icon: '💰', color: '#14B8A6' },
  { id: 'brokerProfile', icon: '🪪', color: '#14B8A6' },
  { id: 'brokerOffers', icon: '🤝', color: '#14B8A6' },
  { id: 'machineManage', icon: '⚙️', color: '#F59E0B' },
  { id: 'slotCalendarManage', icon: '📅', color: '#F59E0B' },
  { id: 'courses', icon: '🎥', color: '#7C3AED' },
  { id: 'myLibrary', icon: '📚', color: '#7C3AED' },
  { id: 'dairyConsole', icon: '🥛', color: '#0D9488' },
  { id: 'gaushalaConsole', icon: '🛕', color: '#0D9488' },
  { id: 'vetNetwork', icon: '🩺', color: '#0D9488' },
  { id: 'orderTracking', icon: '📍', color: '#DB2777' },
  { id: 'wishlist', icon: '💝', color: '#DB2777' },
  { id: 'coupons', icon: '🎟️', color: '#DB2777' },
  { id: 'addressBook', icon: '📒', color: '#DB2777' },
  { id: 'demands', icon: '📣', color: '#4F46E5' },
  { id: 'browseLots', icon: '🔍', color: '#4F46E5' },
  { id: 'chats', icon: '💬', color: '#4F46E5' },
  { id: 'purchases', icon: '🧾', color: '#4F46E5' },
  { id: 'myOffers', icon: '💬', color: '#4F46E5' },
  { id: 'savedFarmers', icon: '⭐', color: '#4F46E5' },
  { id: 'directBuyerHome', icon: '🏭', color: '#4F46E5' },
  { id: 'contracts', icon: '📜', color: '#4F46E5' },
  { id: 'myContracts', icon: '📜', color: '#43A047' },
  { id: 'analytics', icon: '📊', color: '#10B981' },
  { id: 'khata', icon: '🧮', color: '#D97706' },
  { id: 'pos', icon: '🧾', color: '#0284C7' },
  { id: 'procurement', icon: '🚜', color: '#7C3AED' },
  { id: 'rates', icon: '🏷️', color: '#EA580C' },
  { id: 'loanDashboard', icon: '🏦', color: '#334155' },
  { id: 'loanReview', icon: '🖋️', color: '#334155' },
  { id: 'loanTracking', icon: '🧮', color: '#8B5CF6' },
  { id: 'insurancePolicyReview', icon: '📋', color: '#0F766E' },
  { id: 'insuranceClaimReview', icon: '⚖️', color: '#0F766E' },
  { id: 'bankAccounts', icon: '🏧', color: '#64748B' },
  { id: 'notifications', icon: '🔔', color: '#64748B' },
  { id: 'settings', icon: '⚙️', color: '#64748B' },
  { id: 'profileEdit', icon: '✏️', color: '#64748B' },
  { id: 'helpSupport', icon: '🆘', color: '#64748B' },
];

export const TOOL_BY_ID: Record<string, Tool> = Object.fromEntries(
  TOOL_LIST.map((tool) => [tool.id, tool])
);

/** The 26 master modules shown in the All Tools sheet (all_tools_sheet.dart). */
export const ALL_TOOLS_IDS = TOOL_LIST.slice(0, 26).map((tool) => tool.id);

/** Route access map — copied from mobile profile_routes.dart. */
const COMMON = [
  'profileEdit',
  'finance',
  'bankAccounts',
  'krishiRatna',
  'gyanHub',
  'agriNews',
  'referEarn',
  'chats',
  'notifications',
  'settings',
  'helpSupport',
  'accountDelete',
];

/** Routes every persona can open (mobile _universalRoutes). */
const UNIVERSAL = ['courses', 'courseDetail', 'myLibrary', 'vetHome', 'milkSlips', 'wishlist', 'coupons', 'myProducts'];

export const PROFILE_ROUTES: Record<string, string[]> = {
  farmer: [
    'home', 'mandi', 'sellProduce', 'marketplace', 'orderTracking', 'addressBook', 'buyers',
    'brokerOffers', 'myContracts',
    'advisory', 'profitLoss', 'water', 'schemes', 'loanTracking', 'loanDetail', 'landlordPlots',
    'landListings', 'leaseRequests',
    'landlordLeases', 'landlordRent', 'womenFarmer', 'fpo', 'equipment', 'landLegal', 'climate',
    'postHarvest', 'treePlantation', 'liveChannels', 'livestockDairy', 'farmDiary', 'cropInsurance',
    'myBookings', 'loadBoard', 'liveTracking', 'biltyView', 'buyDemands', 'myOffers', 'purchases',
    ...COMMON,
  ],
  farmLandlord: [
    'landlordHome', 'landLegal', 'schemes', 'cropInsurance', 'myBookings', 'profitLoss',
    'landlordPlots', 'landlordLeases', 'landlordRent', 'landListings', 'leaseRequests',
    'marketplace', 'orderTracking', 'addressBook', 'treePlantation', 'farmDiary', ...COMMON,
  ],
  transport: [
    'transportHome', 'tripDetail', 'vehicleManage', 'vehicleCalendar', 'bookingInbox', 'loadBoard',
    'transporterProfile', 'liveTracking', 'biltyView', 'myBookings', 'postHarvest', 'marketplace',
    'orderTracking', 'addressBook', 'settlements', 'farmDiary', 'liveChannels', ...COMMON,
  ],
  seller: [
    'sellerHome', 'sellerProducts', 'sellerAnalytics', 'mandi', 'buyers', 'marketplace',
    'orderTracking', 'myBookings', 'addressBook', 'profitLoss', 'postHarvest', 'livestockDairy',
    'treePlantation', 'browseLots', 'demands', 'purchases', 'myOffers', 'savedFarmers',
    'analytics', 'khata', 'pos', 'procurement', 'rates', 'farmDiary', ...COMMON,
  ],
  equipmentRental: [
    'equipmentOwnerHome', 'machineManage', 'slotCalendarManage', 'equipment', 'settlements',
    'profitLoss', 'liveChannels', ...COMMON,
  ],
  broker: [
    'brokerHome', 'deals', 'mandi', 'buyers', 'commissions', 'brokerProfile',
    'settlements', 'profitLoss', 'liveChannels', ...COMMON,
  ],
  instructor: ['instructorHome', 'courseDetail', 'settlements', ...COMMON],
  dairyManager: [
    'dairyManagerHome', 'livestock', 'livestockDairy', 'dairyConsole', 'gaushalaConsole',
    'vetNetwork', 'settlements', ...COMMON,
  ],
  bankManager: ['bankManagerHome', 'loanDashboard', 'loanReview', 'settlements', ...COMMON],
  insuranceProvider: [
    'insuranceProviderHome', 'cropInsurance', 'insurancePolicyReview', 'insuranceClaimReview',
    'settlements', ...COMMON,
  ],
  coldStorageProvider: ['coldStorageHome', 'postHarvest', 'myBookings', 'settlements', ...COMMON],
  customer: [
    'emarketHome', 'marketplace', 'orderTracking', 'addressBook', 'myBookings', 'liveChannels',
    ...COMMON,
  ],
  directBuyer: [
    'directBuyerHome', 'demands', 'demandDetail', 'purchases', 'purchaseDetail', 'savedFarmers',
    'myOffers', 'browseLots', 'profitLoss', 'marketplace', 'orderTracking', 'myBookings',
    'contracts', 'mandi', ...COMMON,
  ],
};

/** Default home route per persona (mobile UserProfileMeta.defaultHomeRoute). */
export const DEFAULT_HOME_ROUTE: Record<string, string> = {
  farmer: 'home',
  farmLandlord: 'landlordHome',
  transport: 'transportHome',
  seller: 'sellerHome',
  equipmentRental: 'equipmentOwnerHome',
  broker: 'brokerHome',
  instructor: 'instructorHome',
  dairyManager: 'dairyManagerHome',
  customer: 'emarketHome',
  directBuyer: 'directBuyerHome',
  bankManager: 'bankManagerHome',
  insuranceProvider: 'insuranceProviderHome',
  coldStorageProvider: 'coldStorageHome',
};

export function canAccess(profileType: string, toolId: string): boolean {
  if (toolId === 'home' || UNIVERSAL.includes(toolId)) return true;
  const routes = PROFILE_ROUTES[profileType];
  if (!routes) return false;
  return routes.includes(toolId);
}

export function defaultHomeFor(profileType: string): string {
  return DEFAULT_HOME_ROUTE[profileType] ?? 'home';
}

export interface PersonaHomeConfig {
  /** Metric pill labels shown in the persona banner (placeholders — no data). */
  metrics: string[];
  /** Section grids: title key + tool tiles. */
  sections: Array<{ titleKey: string; tiles: string[] }>;
  /** Title of the trailing "live data" placeholder card. */
  liveCardKey: string;
  /** Extra promo banners (farmer dashboard). */
  banners?: Array<'buyDemands' | 'hotOffer' | 'mandi' | 'referEarn'>;
}

/** Per-persona dashboard layout — mirrors mobile views/profile_home/*. */
export const PERSONA_HOME_CONFIG: Record<string, PersonaHomeConfig> = {
  farmer: {
    metrics: ['Live APMC', 'Farm Diary', 'Agri Coins'],
    sections: [
      {
        titleKey: 'tradeSectionFarmer',
        tiles: ['sellProduce', 'brokerOffers', 'myOffers', 'purchases', 'buyDemands', 'mandi', 'bankAccounts'],
      },
      {
        titleKey: 'transportSectionFarmer',
        tiles: ['loadBoard', 'myBookings', 'liveTracking', 'biltyView'],
      },
      {
        titleKey: 'dashOurServices',
        tiles: ['equipment', 'mandi', 'advisory', 'finance', 'profitLoss', 'farmDiary'],
      },
      {
        titleKey: 'dashSpecialModules',
        tiles: [
          'cropInsurance', 'treePlantation', 'liveChannels', 'livestockDairy',
          'farmDiary', 'agriNews', 'gyanHub',
        ],
      },
    ],
    liveCardKey: 'dashLiveMandi',
    banners: ['buyDemands', 'hotOffer', 'mandi', 'referEarn'],
  },
  farmLandlord: {
    metrics: ['Total Land', 'Active Tenants', 'Monthly Income'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['landLegal', 'schemes', 'profitLoss', 'marketplace', 'landlordPlots', 'landListings'],
      },
    ],
    liveCardKey: 'dashActiveLeases',
  },
  transport: {
    metrics: ['Active Vehicles', "Today's Trips", 'Daily Freight'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['loadBoard', 'bookingInbox', 'vehicleManage', 'transporterProfile', 'postHarvest', 'gyanHub'],
      },
      {
        titleKey: 'tradeSectionSeller',
        tiles: ['farmDiary', 'profitLoss', 'myBookings', 'settlements', 'liveTracking', 'biltyView', 'mandi'],
      },
    ],
    liveCardKey: 'dashActiveTrips',
  },
  seller: {
    metrics: ["Today's Turnover", 'Stock Available', 'Active Buyers'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['mandi', 'buyers', 'profitLoss', 'marketplace', 'sellerProducts'],
      },
      {
        titleKey: 'tradeSectionSeller',
        tiles: [
          'browseLots', 'demands', 'purchases', 'myOffers', 'savedFarmers',
          'analytics', 'khata', 'pos', 'procurement', 'rates', 'farmDiary', 'profitLoss',
        ],
      },
    ],
    liveCardKey: 'dashProcurementLedger',
  },
  equipmentRental: {
    metrics: ['Machine Fleet', 'Active Slots', 'Weekly Income'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['machineManage', 'slotCalendarManage', 'profitLoss', 'krishiRatna'],
      },
    ],
    liveCardKey: 'dashFleetStatus',
  },
  broker: {
    metrics: ['Active Deals', 'Farmer Leads', 'Total Commission'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['brokerHome', 'deals', 'buyers', 'commissions', 'brokerProfile', 'mandi', 'profitLoss', 'finance'],
      },
    ],
    liveCardKey: 'dashActiveDeals',
  },
  instructor: {
    metrics: ['Total Courses', 'Sales', 'Earnings'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['courses', 'gyanHub', 'krishiRatna'],
      },
    ],
    liveCardKey: 'dashMyCourses',
  },
  dairyManager: {
    metrics: ["Today's Collection", 'Total Animals', 'Active Adoptions'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['dairyConsole', 'gaushalaConsole', 'vetNetwork', 'livestockDairy'],
      },
    ],
    liveCardKey: 'dashMilkProcurement',
  },
  customer: {
    metrics: ['Total Spent', 'Orders', 'Wishlist'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['marketplace', 'orderTracking', 'wishlist', 'coupons', 'myProducts', 'addressBook'],
      },
    ],
    liveCardKey: 'dashRecentOrders',
  },
  directBuyer: {
    metrics: ['Total Spend', 'Total Volume', 'Active Demands'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['demands', 'browseLots', 'purchases', 'myOffers', 'savedFarmers'],
      },
    ],
    liveCardKey: 'dashRecentPurchases',
  },
  bankManager: {
    metrics: ['Pending Review', 'Total Applications', 'Total Sanctioned'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['loanDashboard', 'loanReview', 'finance', 'bankAccounts'],
      },
    ],
    liveCardKey: 'dashReviewQueue',
  },
  insuranceProvider: {
    metrics: ['Pending Review', 'Active Cover', 'Pending Claims'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['cropInsurance', 'insurancePolicyReview', 'insuranceClaimReview'],
      },
    ],
    liveCardKey: 'dashClaimsPending',
  },
  coldStorageProvider: {
    metrics: ['Total Capacity', 'Utilization', 'Active Lots'],
    sections: [
      {
        titleKey: 'dashQuickActions',
        tiles: ['postHarvest', 'myBookings', 'finance'],
      },
    ],
    liveCardKey: 'dashActiveLots',
  },
};

export function personaHomeConfig(profileType: string): PersonaHomeConfig {
  return PERSONA_HOME_CONFIG[profileType] ?? PERSONA_HOME_CONFIG.farmer;
}
