/**
 * Persona navigation map — single source of truth for the Sidebar menu and
 * the global page-identity bar (dashboard name plate + feature page title).
 * Keeping both consumers on one map guarantees the page header always shows
 * the same name as the menu item the user selected.
 */
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Layers,
  FileCheck,
  Truck,
  BookOpen,
  Wrench,
  ShieldAlert,
  FileText,
  Gift,
  Droplets,
  Store,
  DollarSign,
  Milk,
  GraduationCap,
  Sparkles,
  ShoppingBag,
  Bot,
  ScanLine,
  Radio,
  FileSpreadsheet,
  Users,
  Ship,
  Calendar,
  Stethoscope,
  Snowflake,
  Boxes,
  Heart,
  Inbox,
  Star,
  Megaphone,
  Search,
  Handshake,
  Sprout,
  Tag,
  TreePine,
  Bookmark,
  ClipboardList,
  Briefcase,
  HandCoins,
  Landmark,
  Award,
  Mountain,
  Plus,
  CalendarCheck,
} from 'lucide-react';
import type { PersonaType } from '../types';
import { normalizePersona } from './personas';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}
export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Display name for every persona — used by the dashboard name plate. */
export const PERSONA_LABELS: Record<PersonaType, string> = {
  farmer: 'Farmer / Kisan',
  landlord: 'Farm Landlord',
  transporter: 'Transporter / Gadi',
  seller: 'Agri Vyapari',
  equipmentOwner: 'Equipment Owner',
  broker: 'Agri Broker / Dalal',
  dairyManager: 'Dudh Dairy Manager',
  milkSeller: 'Milk Vendor / Doodh Vala',
  vet: 'Veterinary Doctor',
  fpoManager: 'FPO / Cooperative Leader',
  womenHub: 'Woman Hub',
  agriMarketSeller: 'Agri Market Seller',
  exporter: 'Agri Exporter',
  instructor: 'Gurukul Instructor',
  directBuyer: 'Industrial / Direct Buyer',
  bankManager: 'Bank Loan Manager',
  insuranceProvider: 'Crop Insurance Desk',
  coldStorageProvider: 'Cold Storage Owner',
  gaushalaManager: 'Gaushala & Sanctuary',
  nursery: 'Plant Nursery',
  superadmin: 'Superadmin Platform Ops',
};

/** Persona cockpit routes — these render the "Namaste, name — persona" plate. */
const DASHBOARD_PATHS = new Set([
  '/farmer',
  '/landlord',
  '/transporter',
  '/seller',
  '/equipment',
  '/equipmentOwner',
  '/milkSeller/dashboard',
  '/womenHub',
  '/agriMarketSeller',
  '/exporter',
  '/instructor/dashboard',
  '/directbuyer',
  '/gaushalaManager',
  '/coldStorageProvider',
  '/nursery',
]);

export function isDashboardPath(pathname: string): boolean {
  return DASHBOARD_PATHS.has(pathname);
}

/** Dashboards whose name plate is rendered inside the view itself — the
 *  global bar must not render a second plate on top of it. */
const IN_PAGE_DASHBOARD_PATHS = new Set([
  '/farmer',
  '/seller',
  '/landlord',
  '/equipment',
  '/equipmentOwner',
  '/transporter',
  '/exporter',
  '/directbuyer',
  '/gaushalaManager',
  '/coldStorageProvider',
  '/milkSeller/dashboard',
  '/instructor/dashboard',
  '/nursery',
]);

/** Feature routes whose page title (the selected menu label) is rendered
 *  inside the view itself — the global breadcrumb must not duplicate it.
 *  Routes NOT listed here have no in-view title and get the breadcrumb. */
const IN_PAGE_TITLE_PATHS = new Set([
  // farmer
  '/farmer/crops', '/farmer/crop-plan', '/farmer/crop-doctor', '/farmer/equipment',
  '/farmer/lots', '/farmer/demands', '/farmer/land', '/farmer/connections', '/farmer/mandi',
  '/farmer/transport', '/farmer/schemes', '/farmer/water', '/farmer/712', '/farmer/diary',
  '/farmer/referrals', '/farmer/pnl',
  // ecosystem hubs
  '/mall', '/academy', '/community/news', '/ratings', '/saved', '/community/ai',
  '/community/scan', '/community/trees', '/ads', '/community/coins',
  // landlord
  '/landlord/listings', '/landlord/requests', '/landlord/connections',
  // transporter
  '/transporter/fleet', '/transporter/inbox', '/transporter/connections',
  // seller
  '/seller/lots', '/seller/demands', '/seller/connections', '/seller/rates',
  // equipment owner
  '/equipment/machines', '/equipment/availability', '/equipment/requests', '/equipment/jobs',
  // exporter
  '/exporter/rfqs', '/exporter/applications', '/exporter/connections',
  // milk vendor desks
  '/milkSeller/punch', '/milkSeller/clients', '/milkSeller/bills', '/milkSeller/analytics',
  '/milkSeller/vendor', '/milkSeller/vendor/clients', '/milkSeller/vendor/bills', '/milkSeller/vendor/rates',
  // gaushala
  '/gaushalaManager/cattle', '/gaushalaManager/adoptions', '/gaushalaManager/receipts',
  '/gaushalaManager/expenses', '/gaushalaManager/vets',
  // cold storage
  '/coldStorageProvider/facilities', '/coldStorageProvider/bookings', '/coldStorageProvider/fees',
  // woman hub
  '/womenHub/businesses', '/womenHub/garden', '/womenHub/enterprise',
  // unified AI analysis (title rendered in the view)
  '/ai-analysis',
  // direct buyer
  '/directbuyer/requirements/new', '/directbuyer/requirements', '/directbuyer/applications',
  '/directbuyer/suppliers',
  // instructor
  '/instructor/home', '/instructor/courses', '/instructor/enquiries',
  // nursery
  '/nursery/inventory', '/nursery/batches', '/nursery/orders', '/nursery/ratings',
  '/nursery/offers', '/nursery/payouts', '/nursery/ai', '/nursery/diary', '/nursery/ads',
  '/nursery/finance', '/nursery/shop', '/nursery/chatbot', '/nursery/gyan', '/nursery/news',
  '/nursery/coins', '/nursery/referrals', '/nursery/trees', '/nursery/land-records',
]);

/** Dynamic persona navigation mapping (was inline in the Sidebar). */
export function getNavSections(persona: PersonaType | string): NavSection[] {
  switch (normalizePersona(persona)) {
    case 'farmer':
      return [
        {
          title: 'Farmer Menu',
          items: [
            { to: '/farmer', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/farmer/crops', label: 'My Crops / माझी पिके', icon: Sprout },
            { to: '/farmer/crop-plan', label: 'AI Crop Plan / पीक नियोजन', icon: Sparkles },
            { to: '/farmer/crop-doctor', label: 'AI Doctor', icon: Stethoscope },
            { to: '/farmer/equipment', label: 'Rent Machinery', icon: Wrench },
            { to: '/farmer/lots', label: 'My Produce / माझे उत्पादन', icon: Package },
            { to: '/farmer/demands', label: 'Vyapari Requirements / व्यापारी मागण्या', icon: Layers },
            { to: '/farmer/land', label: 'Rent Land', icon: Mountain },
            { to: '/farmer/connections', label: 'My Connections / माझे संपर्क', icon: Handshake },
            { to: '/farmer/mandi', label: 'Mandi Prices / बाजारभाव', icon: TrendingUp },
            { to: '/farmer/transport', label: 'Book Vehicle', icon: Truck },
            { to: '/mall', label: 'Agri Market', icon: ShoppingBag },
            { to: '/academy', label: 'Courses', icon: GraduationCap },
            { to: '/community/news', label: 'Agriculture News & Audio', icon: Radio },
            { to: '/ratings', label: 'Ratings & Reviews', icon: Star },
            { to: '/saved', label: 'Saved & Following', icon: Bookmark },
            { to: '/ai-analysis', label: 'AI Analysis', icon: Sparkles },
            { to: '/farmer/schemes', label: 'Government Schemes', icon: Gift },
            { to: '/farmer/water', label: 'Climate', icon: Droplets },
            { to: '/farmer/712', label: 'My Land Records (7/12)', icon: FileSpreadsheet },
            { to: '/farmer/diary', label: 'My Diary', icon: BookOpen },
            { to: '/community/scan', label: 'AI Crop Scanner', icon: ScanLine },
            { to: '/community/trees', label: 'Tree Plantation', icon: TreePine },
            { to: '/farmer/referrals', label: 'Invite & Earn', icon: Users },
            { to: '/ads', label: 'Ads & Promotions', icon: Megaphone },
            { to: '/farmer/pnl', label: 'Profit & Loss', icon: DollarSign },
            { to: '/community/coins', label: 'Coins & Rewards', icon: Sparkles },
          ],
        },
      ];

    case 'landlord':
      return [
        {
          title: 'Farmland Leasing',
          items: [
            { to: '/landlord', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/landlord/listings', label: 'Post Land Request', icon: Mountain },
            { to: '/landlord/requests', label: 'Requirement Requests', icon: FileCheck },
            { to: '/landlord/connections', label: 'My Connections', icon: Handshake },
          ],
        },
      ];

    case 'transporter':
      return [
        {
          title: 'Logistics Desk',
          items: [
            // The cockpit hosts the Load Board, Live Trips, Bilty and
            // Trip P&L as tabs — one entry, no duplicate deep-links.
            { to: '/transporter', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/transporter/fleet', label: 'Vehicles and Drivers', icon: Wrench },
            { to: '/transporter/inbox', label: 'Booking Requests', icon: Inbox },
            { to: '/transporter/connections', label: 'My Connections', icon: Handshake },
          ],
        },
      ];

    case 'seller':
      return [
        {
          title: 'Vyapari Trade',
          items: [
            { to: '/seller', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/seller/lots', label: 'Find Produce', icon: Search },
            { to: '/seller/demands', label: 'Post Requirement', icon: Megaphone },
            { to: '/seller/connections', label: 'My Connections', icon: Handshake },
            { to: '/seller/rates', label: 'Mandi Prices', icon: TrendingUp },
          ],
        },
      ];

    case 'equipmentOwner':
      return [
        {
          title: 'Equipment Service',
          items: [
            { to: '/equipment', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/equipment/machines', label: 'My Equipment', icon: Wrench },
            { to: '/equipment/availability', label: 'Equipment Schedule', icon: Calendar },
            { to: '/equipment/requests', label: 'Booking Request', icon: FileCheck },
            { to: '/equipment/jobs', label: 'Progress Status', icon: Briefcase },
          ],
        },
      ];

    case 'exporter':
      return [
        {
          title: 'Global Export Hub',
          items: [
            { to: '/exporter', label: 'Home', icon: LayoutDashboard },
            { to: '/exporter/rfqs?new=1', label: 'Post Export Requirement', icon: Plus },
            { to: '/exporter/rfqs', label: 'My Export Requirements', icon: Ship },
            { to: '/exporter/applications', label: 'Applications Received', icon: Inbox },
            { to: '/exporter/connections', label: 'My Connections', icon: Handshake },
          ],
        },
      ];

    case 'milkSeller':
      return [
        {
          title: 'Milk Vendor (Doodhwala)',
          items: [
            { to: '/milkSeller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/milkSeller/vendor', label: 'Todays Schedule', icon: CalendarCheck },
            { to: '/milkSeller/vendor/clients', label: 'Clients', icon: Users },
            { to: '/milkSeller/vendor/bills', label: 'Bills & Payments', icon: FileText },
            { to: '/milkSeller/vendor/rates', label: 'Milk and Rates', icon: Milk },
            { to: '/milkSeller/punch', label: 'Punch Sheet', icon: ClipboardList },
            { to: '/milkSeller/clients', label: 'Customer Passbook', icon: Users },
            { to: '/milkSeller/bills', label: 'Monthly Billing and Pay', icon: DollarSign },
            { to: '/milkSeller/analytics', label: 'Delivery Analytics', icon: TrendingUp },
          ],
        },
      ];

    case 'gaushalaManager':
      return [
        {
          title: 'Gaushala Sanctuary',
          items: [
            { to: '/gaushalaManager', label: 'Gaushala Dashboard', icon: LayoutDashboard },
            { to: '/gaushalaManager/cattle', label: 'Cattle Herd Registry', icon: Heart },
            { to: '/gaushalaManager/adoptions', label: '80G Donations & Adoptions', icon: Gift },
            { to: '/gaushalaManager/receipts', label: 'Receipts Register', icon: FileText },
            { to: '/gaushalaManager/expenses', label: 'Fodder & Expenses', icon: DollarSign },
            { to: '/gaushalaManager/vets', label: 'Vet Network Camps', icon: ShieldAlert },
          ],
        },
      ];

    case 'coldStorageProvider':
      return [
        {
          title: 'Post-Harvest Warehousing',
          items: [
            { to: '/coldStorageProvider', label: 'Facility Dashboard', icon: LayoutDashboard },
            { to: '/coldStorageProvider/facilities', label: 'Chambers & Temperature', icon: Snowflake },
            { to: '/coldStorageProvider/bookings', label: 'Inward & Release Bookings', icon: Boxes },
            { to: '/coldStorageProvider/fees', label: 'Rent Ledger & e-NWR Fees', icon: DollarSign },
          ],
        },
      ];

    case 'womenHub':
      return [
        {
          title: 'Woman Hub',
          items: [
            { to: '/womenHub', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/womenHub/businesses', label: 'My Business & Management', icon: Briefcase },
            { to: '/womenHub/garden', label: 'Kitchen Garden Planner', icon: Sprout },
            { to: '/womenHub/enterprise', label: 'Home Enterprise Income', icon: HandCoins },
          ],
        },
      ];

    case 'directBuyer':
      return [
        {
          title: 'Industrial Sourcing',
          items: [
            { to: '/directbuyer', label: 'Home / Dashboard', icon: LayoutDashboard },
            { to: '/directbuyer/requirements/new', label: 'Post Requirement', icon: Megaphone },
            { to: '/directbuyer/requirements', label: 'My Requirements', icon: Layers },
            { to: '/directbuyer/applications', label: 'Applications Received', icon: Inbox },
            { to: '/directbuyer/suppliers', label: 'My Suppliers', icon: Handshake },
          ],
        },
      ];

    case 'instructor':
      return [
        {
          title: 'Gurukul Studio',
          items: [
            { to: '/instructor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/instructor/home', label: 'Academic Studio', icon: GraduationCap },
            { to: '/instructor/courses', label: 'Course Builder', icon: BookOpen },
            { to: '/instructor/enquiries', label: 'Batches & Questions', icon: Users },
          ],
        },
      ];

    case 'agriMarketSeller':
      return [
        {
          title: 'Agri Market Seller',
          items: [
            { to: '/agriMarketSeller', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/agriMarketSeller/shop', label: 'Shop Profile', icon: Store },
            { to: '/agriMarketSeller/products', label: 'My Products', icon: Package },
            { to: '/agriMarketSeller/stock', label: 'Stock Management', icon: Boxes },
            { to: '/agriMarketSeller/orders', label: 'Orders Received', icon: ShoppingBag },
            { to: '/agriMarketSeller/enquiries', label: 'Enquiry Management', icon: Handshake },
            { to: '/agriMarketSeller/quotations', label: 'Quotation Management', icon: FileText },
            { to: '/agriMarketSeller/coupons', label: 'Offers & Discounts', icon: Tag },
          ],
        },
      ];

    case 'nursery':
      return [
        {
          title: 'Nursery Operations',
          items: [
            { to: '/nursery', label: 'Nursery Cockpit', icon: LayoutDashboard },
            { to: '/nursery/inventory', label: 'My Plants / Inventory', icon: Sprout },
            { to: '/nursery/batches', label: 'Batches & Stock In/Out', icon: Package },
            { to: '/nursery/orders', label: 'Orders Received', icon: FileCheck },
            { to: '/nursery/ratings', label: 'Reviews & Ratings', icon: Star },
          ],
        },
        {
          title: 'Growth & Business',
          items: [
            { to: '/nursery/offers', label: 'Offers & Discounts', icon: Tag },
            { to: '/nursery/payouts', label: 'Earnings & Payouts', icon: DollarSign },
            { to: '/ai-analysis', label: 'AI Analysis', icon: Sparkles },
            { to: '/nursery/diary', label: 'Nursery Care Diary', icon: BookOpen },
            { to: '/nursery/ads', label: 'Ad Manager', icon: Megaphone },
            { to: '/nursery/finance', label: 'Finance CEO (P&L)', icon: Landmark },
          ],
        },
        {
          title: 'Ecosystem & Utilities',
          items: [
            { to: '/nursery/shop', label: 'E-Market Shopping', icon: ShoppingBag },
            { to: '/nursery/chatbot', label: 'Chatbot Support', icon: Bot },
            { to: '/nursery/gyan', label: 'Gyansetu Learning', icon: GraduationCap },
            { to: '/nursery/news', label: 'Agri News Feed', icon: Radio },
            { to: '/nursery/coins', label: 'Coin Rewards Wallet', icon: Award },
            { to: '/nursery/referrals', label: 'Invite & Earn', icon: Gift },
            { to: '/nursery/trees', label: 'Tree Plantation', icon: Droplets },
            { to: '/nursery/land-records', label: 'My Land Records (7/12)', icon: FileText },
          ],
        },
      ];

    default:
      return [
        {
          title: 'Navigation',
          items: [{ to: '/farmer', label: 'Dashboard', icon: LayoutDashboard }],
        },
      ];
  }
}

/** Ecosystem shortcuts shown under every non-farmer sidebar (single source
 * for both the Sidebar rendering and the page-identity resolver). */
export const ECOSYSTEM_ITEMS: (NavItem & { className?: string; hideForTransporter?: boolean })[] = [
  { to: '/ai-analysis', label: 'AI Analysis', icon: Sparkles, className: 'text-teal-600' },
  { to: '/community/scan', label: 'AI Crop Scanner', icon: ScanLine, className: 'text-rose-500' },
  { to: '/mall', label: 'Agri Market', icon: ShoppingBag, className: 'text-emerald-600' },
  { to: '/academy', label: 'Courses', icon: GraduationCap, className: 'text-sky-600' },
  { to: '/community/news', label: 'Agriculture News & Audio', icon: Radio, className: 'text-indigo-500' },
  { to: '/farmer/schemes', label: 'Government Schemes', icon: Gift, className: 'text-emerald-600' },
  { to: '/farmer/water', label: 'Climate', icon: Droplets, className: 'text-sky-600' },
  { to: '/farmer/712', label: 'My Land Records (7/12)', icon: FileSpreadsheet, className: 'text-emerald-600' },
  { to: '/farmer/diary', label: 'My Diary', icon: BookOpen, className: 'text-indigo-500', hideForTransporter: true },
  { to: '/community/trees', label: 'Tree Plantation', icon: TreePine, className: 'text-emerald-600' },
  { to: '/ads', label: 'Ads & Promotions', icon: Megaphone, className: 'text-emerald-600', hideForTransporter: true },
  { to: '/farmer/pnl', label: 'Profit & Loss', icon: DollarSign, className: 'text-emerald-600' },
  { to: '/community/coins', label: 'Coins & Rewards', icon: Sparkles, className: 'text-amber-500' },
  { to: '/ratings', label: 'Ratings & Reviews', icon: Star, className: 'text-amber-500', hideForTransporter: true },
  { to: '/saved', label: 'Saved & Following', icon: Bookmark, className: 'text-rose-500' },
  { to: '/farmer/referrals', label: 'Invite & Earn', icon: Users, className: 'text-amber-500' },
];

export type PageIdentity = { kind: 'dashboard' } | { kind: 'page'; label: string } | null;

/**
 * Resolve what the page-identity bar should show for a location.
 * Dashboards get the name plate; anything else matched in the persona menu
 * gets a page-title breadcrumb; unknown deep links get nothing.
 */
export function resolvePageIdentity(
  persona: PersonaType | string,
  pathname: string,
  search: string,
): PageIdentity {
  if (isDashboardPath(pathname)) {
    return IN_PAGE_DASHBOARD_PATHS.has(pathname) ? null : { kind: 'dashboard' };
  }
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  if (IN_PAGE_TITLE_PATHS.has(cleanPath)) return null;
  const candidates: NavItem[] = [];
  for (const section of getNavSections(persona)) {
    for (const item of section.items) {
      const itemPath = item.to.split('?')[0].replace(/\/+$/, '') || '/';
      if (itemPath === cleanPath) candidates.push(item);
    }
  }
  if (candidates.length === 0) {
    // Fallback: ecosystem shortcuts (visible to every non-farmer persona).
    const eco = ECOSYSTEM_ITEMS.find((item) => {
      const itemPath = item.to.split('?')[0].replace(/\/+$/, '') || '/';
      return itemPath === cleanPath;
    });
    return eco ? { kind: 'page', label: eco.label } : null;
  }
  const exact =
    candidates.find((c) => c.to.includes('?') && c.to.split('?')[1] === (search.startsWith('?') ? search.slice(1) : search)) ||
    candidates.find((c) => !c.to.includes('?')) ||
    candidates[0];
  return { kind: 'page', label: exact.label };
}

/**
 * True for persona feature pages — anything matched in the persona menu,
 * the in-page-title set, or the ecosystem shortcuts — but never a persona
 * dashboard. The page bar uses this to place the Back button.
 */
export function isPersonaFeaturePath(persona: PersonaType | string, pathname: string): boolean {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  if (isDashboardPath(cleanPath)) return false;
  if (IN_PAGE_TITLE_PATHS.has(cleanPath)) return true;
  for (const section of getNavSections(persona)) {
    for (const item of section.items) {
      const itemPath = item.to.split('?')[0].replace(/\/+$/, '') || '/';
      if (itemPath === cleanPath) return true;
    }
  }
  return ECOSYSTEM_ITEMS.some((item) => {
    const itemPath = item.to.split('?')[0].replace(/\/+$/, '') || '/';
    return itemPath === cleanPath;
  });
}
