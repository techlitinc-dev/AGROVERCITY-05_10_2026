/**
 * Persona registry — the single source of truth for the UAT walk.
 *
 * Route lists were extracted from website/src/views/<domain>/routes.tsx.
 * Detail routes with :id parameters are intentionally skipped; list pages
 * are walked instead (the walker discovers rows visually).
 *
 * Login strategy (dev backend):
 *  - quickLogin personas → POST /v1/auth/quick-login { persona, mpin } — the
 *    account auto-creates with rich seeded data (backend/app/routers/auth.py).
 *  - onboard personas   → POST /v1/auth/onboard { phone, name, mpin, persona }
 *    creates a full account with that persona active and seeded content.
 * The browser session itself is then 100% UI — only session minting uses APIs.
 */

export interface PersonaDef {
  id: string;
  label: string;
  /** Human story used in the report — how a UAT tester would describe themselves. */
  roleplay: string;
  /** Backend quick-login persona key when available. */
  quickLogin?: string;
  /** Fresh-account onboarding when no quick-login preset exists. */
  onboard?: { phone: string; name: string };
  home: string;
  /** Every top-level option this persona can open in the website nav. */
  routes: string[];
  /** Routes where the generic probe may try to open (never submit) a create-dialog. */
  createProbe?: string[];
}

export const PERSONAS: PersonaDef[] = [
  {
    id: 'farmer',
    label: 'Farmer / Kisan',
    roleplay: 'Ram Singh, grape & tomato farmer from Nashik checking mandi rates, posting produce lots and booking transport.',
    quickLogin: 'farmer',
    home: '/farmer',
    routes: [
      '/farmer',
      '/farmer/crop-doctor',
      '/farmer/mandi',
      '/farmer/lots',
      '/farmer/land',
      '/farmer/demands',
      '/farmer/industrial',
      '/farmer/industrial/applications',
      '/farmer/connections',
      '/farmer/transport',
      '/farmer/diary',
      '/farmer/pnl',
      '/farmer/equipment',
      '/farmer/712',
      '/farmer/schemes',
      '/farmer/water',
      '/farmer/referrals',
      '/farmer/coins',
      '/farmer/dairy',
      '/farmer/crops',
      '/farmer/crop-plan',
      '/farmer/export',
      '/farmer/export/applications',
      '/farmer/export/connections',
      '/farmer/export/readiness',
    ],
    createProbe: ['/farmer/lots', '/farmer/diary', '/farmer/transport'],
  },
  {
    id: 'landlord',
    label: 'Farm Landlord',
    roleplay: 'Suresh Patel, landowner leasing 45 acres around Nashik with 7/12-synced listings.',
    quickLogin: 'farmLandlord',
    home: '/landlord',
    routes: [
      '/landlord',
      '/landlord/listings',
      '/landlord/verification',
      '/landlord/requests',
      '/landlord/connections',
    ],
    createProbe: ['/landlord/listings'],
  },
  {
    id: 'transporter',
    label: 'Transporter / Gadi',
    roleplay: 'Rajesh Kumar, fleet owner running the FT-1 bilty desk from Nashik APMC hub.',
    quickLogin: 'transport',
    home: '/transporter',
    routes: [
      '/transporter',
      '/transporter/loads',
      '/transporter/trips',
      '/transporter/bilty',
      '/transporter/settlements',
      '/transporter/inbox',
      '/transporter/fleet',
      '/transporter/compliance',
      '/transporter/profile',
      '/transporter/ratings',
      '/transporter/ads',
      '/transporter/diary',
    ],
    createProbe: ['/transporter/fleet'],
  },
  {
    id: 'seller',
    label: 'Agri Vyapari (Trader)',
    roleplay: 'Amit Agarwal, mandi vyapari procuring from farmers and running a inputs storefront.',
    quickLogin: 'seller',
    home: '/seller',
    routes: [
      '/seller',
      '/seller/lots',
      '/seller/demands',
      '/seller/connections',
      '/seller/rates',
      '/seller/profile',
    ],
    createProbe: ['/seller/demands'],
  },
  {
    id: 'equipmentOwner',
    label: 'Equipment Owner / CHC',
    roleplay: 'Harpreet Singh, CHC owner renting tractors and harvesters per hour.',
    quickLogin: 'equipmentRental',
    home: '/equipmentOwner',
    routes: [
      '/equipmentOwner',
      '/equipment/machines',
      '/equipment/availability',
      '/equipment/requests',
      '/equipment/jobs',
    ],
    createProbe: ['/equipment/machines'],
  },
  {
    id: 'exporter',
    label: 'Agri Exporter',
    roleplay: 'PW Test Exporter, APEDA-certified exporter answering global RFQs.',
    onboard: { phone: '+919100000101', name: 'PW Test Exporter' },
    home: '/exporter',
    routes: [
      '/exporter',
      '/exporter/rfqs',
      '/exporter/applications',
      '/exporter/connections',
      '/exporter/orders',
      '/exporter/suppliers',
      '/exporter/analytics',
    ],
  },
  {
    id: 'milkSeller',
    label: 'Milk Vendor / Doodh Vala',
    roleplay: 'PW Test Milk Vendor, door-collection dairy vendor with FAT/SNR billing.',
    onboard: { phone: '+919100000102', name: 'PW Test Milk Vendor' },
    home: '/milkSeller',
    routes: [
      '/milkSeller',
      '/milkSeller/clients',
      '/milkSeller/bills',
      '/milkSeller/analytics',
      '/milkSeller/vendor',
      '/milkSeller/vendor/clients',
      '/milkSeller/vendor/bills',
      '/milkSeller/vendor/rates',
      '/milkSeller/vendor/settings',
    ],
    createProbe: ['/milkSeller/clients'],
  },
  {
    id: 'directBuyer',
    label: 'Industrial / Direct Buyer',
    roleplay: 'Shree Foods Pvt Ltd, processor posting bulk escrow demands and running gate QC.',
    quickLogin: 'directBuyer',
    home: '/directBuyer',
    routes: [
      '/directBuyer',
      '/directBuyer/demands',
      '/directBuyer/qc',
      '/directBuyer/requirements',
      '/directBuyer/requirements/new',
      '/directBuyer/applications',
      '/directBuyer/suppliers',
      '/directBuyer/contracts',
      '/directBuyer/intel',
      '/directBuyer/offers',
      '/directBuyer/feed',
      '/directBuyer/standing',
      '/directBuyer/analytics',
      '/directBuyer/team',
      '/directBuyer/org',
    ],
    createProbe: ['/directBuyer/requirements/new'],
  },
  {
    id: 'instructor',
    label: 'Gurukul Instructor',
    roleplay: 'PW Test Instructor, agronomist running courses, batches and certificates on Gurukul Academy.',
    onboard: { phone: '+919100000104', name: 'PW Test Instructor' },
    home: '/instructor/home',
    routes: [
      '/instructor/home',
      '/instructor/courses',
      '/instructor/enrollment-requests',
      '/instructor/enquiries',
      '/instructor/students',
      '/instructor/chat',
      '/instructor/batches',
      '/instructor/assignments',
      '/instructor/certificates',
    ],
  },
  {
    id: 'coldStorageProvider',
    label: 'Cold Storage Owner',
    roleplay: 'Vikram Shinde, WDRA-licensed cold chain operator with IoT chambers.',
    quickLogin: 'coldStorageProvider',
    home: '/coldStorageProvider',
    routes: [
      '/coldStorageProvider',
      '/coldStorageProvider/facilities',
      '/coldStorageProvider/bookings',
      '/coldStorageProvider/fees',
    ],
    createProbe: ['/coldStorageProvider/facilities'],
  },
  {
    id: 'gaushalaManager',
    label: 'Gaushala & Sanctuary',
    roleplay: 'PW Test Gaushala, cattle-shelter manager tracking inventory, adoptions and expenses.',
    onboard: { phone: '+919100000105', name: 'PW Test Gaushala' },
    home: '/gaushalaManager',
    routes: [
      '/gaushalaManager',
      '/gaushalaManager/profile',
      '/gaushalaManager/cattle',
      '/gaushalaManager/adoptions',
      '/gaushalaManager/receipts',
      '/gaushalaManager/expenses',
      '/gaushalaManager/vets',
    ],
    createProbe: ['/gaushalaManager/cattle'],
  },
  {
    id: 'nursery',
    label: 'Plant Nursery',
    roleplay: 'PW Test Nursery, plant nursery owner managing inventory, batches and orders.',
    onboard: { phone: '+919100000106', name: 'PW Test Nursery' },
    home: '/nursery',
    routes: [
      '/nursery',
      '/nursery/profile',
      '/nursery/inventory',
      '/nursery/batches',
      '/nursery/orders',
      '/nursery/ratings',
      '/nursery/offers',
      '/nursery/payouts',
      '/nursery/ai',
      '/nursery/diary',
      '/nursery/finance',
      '/nursery/shop',
      '/nursery/gyan',
      '/nursery/news',
      '/nursery/coins',
      '/nursery/referrals',
      '/nursery/trees',
      '/nursery/land-records',
      '/nursery/settings',
    ],
    createProbe: ['/nursery/inventory', '/nursery/batches'],
  },
  {
    id: 'customer',
    label: 'E-Market Customer',
    roleplay: 'PW Test Customer, agri-mall buyer browsing produce, mall catalog and academy courses.',
    onboard: { phone: '+919100000107', name: 'PW Test Customer' },
    home: '/customer',
    routes: [
      '/customer',
      '/customer/orders',
      '/customer/subscriptions',
      '/customer/wallet',
      '/customer/demands',
      '/customer/quotes',
      '/customer/procurements',
      '/customer/produce',
      '/customer/seasonal',
      '/customer/diary',
      '/customer/finance',
      '/customer/coins',
      '/customer/news',
      '/customer/trees',
      '/customer/712',
      '/mall',
      '/academy',
      '/academy/my-learning',
    ],
  },
];

export const SHARED_ROUTES = [
  '/notifications',
  '/support',
  '/settings',
  '/billing',
  '/kyc',
  '/bank-accounts',
  '/chat',
  '/payments',
  '/ratings',
  '/profile',
  '/saved',
];

export const PERSONA_MAP = new Map(PERSONAS.map((p) => [p.id, p]));
