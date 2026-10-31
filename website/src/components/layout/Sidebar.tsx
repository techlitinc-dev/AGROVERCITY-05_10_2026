import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Layers,
  FileCheck,
  Truck,
  BookOpen,
  Wrench,
  Landmark,
  ShieldAlert,
  FileText,
  Gift,
  Droplets,
  Building2,
  Store,
  DollarSign,
  Milk,
  GraduationCap,
  Sparkles,
  ShoppingBag,
  HeartHandshake,
  Bot,
  ScanLine,
  Radio,
  FileSpreadsheet,
  Award,
  Users,
  Ship,
  Calendar,
  Stethoscope,
  Syringe,
  Snowflake,
  Boxes,
  Heart,
  Scale,
  Inbox,
  User,
  Star,
  Megaphone,
  HandCoins,
  Search,
  Handshake,
  Sprout,
  Tag,
  TreePine,
  Leaf,
  Bookmark,
  ArrowLeftRight,
  ClipboardList,
  PawPrint,
  Briefcase,
  Mountain,
  BadgeCheck,
  Globe2,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/utils';
import { normalizePersona } from '../../lib/personas';

export const Sidebar: React.FC = () => {
  const { activePersona } = useAuthStore();

  // Dynamic persona navigation mapping
  const getNavSections = () => {
    switch (normalizePersona(activePersona)) {
      case 'farmer':
        return [
          {
            title: 'Trade — Buy & Sell',
            items: [
              { to: '/farmer/lots', label: 'My Produce / माझे उत्पादन', icon: Package },
              { to: '/farmer/demands', label: 'Buyer Requirements / खरेदी मागण्या', icon: Layers },
              { to: '/farmer/land', label: 'Lease Farm Land / शेतजमीन भाड्याने', icon: Mountain },
              { to: '/farmer/connections', label: 'My Connections / माझे संपर्क', icon: Handshake },
              { to: '/farmer/export', label: 'Export Opportunities / निर्यात संधी', icon: Globe2 },
              { to: '/farmer/export/applications', label: 'My Export Applications', icon: FileText },
              { to: '/farmer/export/connections', label: 'Export Connections', icon: Handshake },
              { to: '/farmer/export/readiness', label: 'Export Readiness', icon: ClipboardList },
              { to: '/farmer/mandi', label: 'Mandi Prices / बाजारभाव', icon: TrendingUp },
              { to: '/farmer/transport', label: 'Book Gadi / Transport', icon: Truck },
            ],
          },
          {
            title: 'Kisan Core Hub',
            items: [
              { to: '/farmer', label: 'Farmer Cockpit', icon: LayoutDashboard },
              { to: '/farmer/crops', label: 'My Crops / माझी पिके', icon: Sprout },
              { to: '/farmer/crop-plan', label: 'AI Crop Plan / पीक नियोजन', icon: Sparkles },
              { to: '/farmer/crop-doctor', label: 'AI Crop Doctor (रोग निदान)', icon: Stethoscope },
              { to: '/farmer/diary', label: 'Farm Diary', icon: BookOpen },
              { to: '/farmer/pnl', label: 'Profit & Loss', icon: DollarSign },
              { to: '/farmer/equipment', label: 'Rent Machinery', icon: Wrench },
              { to: '/farmer/livestock', label: 'Pashu Dhan / पशुधन', icon: PawPrint },
              { to: '/women/directory', label: 'Mahila Bachat Gat', icon: HandCoins },
            ],
          },
          {
            title: 'Finance & Security',
            items: [
              { to: '/farmer/loans', label: 'KCC & Agri Loans', icon: Landmark },
              { to: '/farmer/bank-accounts', label: 'Bank Accounts', icon: Building2 },
              { to: '/farmer/insurance', label: 'PMFBY Crop Insurance', icon: ShieldAlert },
              { to: '/farmer/712', label: '7/12 Land Records', icon: FileSpreadsheet },
              { to: '/farmer/schemes', label: 'Govt Schemes', icon: Gift },
              { to: '/farmer/vault', label: 'Document Vault', icon: Award },
              { to: '/farmer/water', label: 'Water & Weather', icon: Droplets },
              { to: '/farmer/dairy', label: 'My Milk & Payments / दूध व पैसे', icon: Milk },
            ],
          },
          {
            title: 'Growth & Community',
            items: [
              { to: '/farmer/referrals', label: 'Refer & Earn', icon: Users },
              { to: '/farmer/coins', label: 'Kisan Coins', icon: Sparkles },
              { to: '/community/trees', label: 'Tree Plantation Hub', icon: TreePine },
              { to: '/community/carbon', label: 'Carbon Footprint & Eco', icon: Leaf },
            ],
          },
        ];

      case 'landlord':
        return [
          {
            title: 'Farmland Leasing',
            items: [
              { to: '/landlord', label: 'Home', icon: LayoutDashboard },
              { to: '/landlord/listings', label: 'My Land Listings', icon: Mountain },
              { to: '/landlord/verification', label: 'Land Verification', icon: BadgeCheck },
              { to: '/landlord/requests', label: 'Interest Requests', icon: FileCheck },
              { to: '/landlord/connections', label: 'My Connections / Leases', icon: Handshake },
              { to: '/profile', label: 'Profile & Verification', icon: User },
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
              { to: '/transporter', label: 'Transporter Cockpit', icon: LayoutDashboard },
              { to: '/transporter/fleet', label: 'Fleet & Drivers', icon: Wrench },
              { to: '/transporter/inbox', label: 'Booking Requests', icon: Inbox },
              { to: '/transporter/ratings', label: 'Ratings', icon: Star },
              { to: '/transporter/ads', label: 'Advertisements', icon: Megaphone },
              { to: '/transporter/diary', label: 'Diary', icon: BookOpen },
              { to: '/transporter/profile', label: 'Profile', icon: User },
            ],
          },
        ];

      case 'seller':
        return [
          {
            title: 'Vyapari Trade',
            items: [
              { to: '/seller', label: 'Home', icon: LayoutDashboard },
              { to: '/seller/lots', label: 'Find Produce / शेतमाल शोधा', icon: Search },
              { to: '/seller/demands', label: 'Post Requirement / मागणी टाका', icon: Megaphone },
              { to: '/seller/connections', label: 'My Connections / माझे संपर्क', icon: Handshake },
              { to: '/seller/rates', label: 'Mandi Prices / बाजारभाव', icon: TrendingUp },
              { to: '/seller/profile', label: 'Profile & Verification', icon: Building2 },
            ],
          },
        ];

      case 'equipmentOwner':
        return [
          {
            title: 'Equipment Service',
            items: [
              { to: '/equipment', label: 'Home', icon: LayoutDashboard },
              { to: '/equipment/machines', label: 'My Equipment', icon: Wrench },
              { to: '/equipment/availability', label: 'Availability', icon: Calendar },
              { to: '/equipment/requests', label: 'Booking Requests', icon: FileCheck },
              { to: '/equipment/jobs', label: 'My Jobs', icon: Briefcase },
              { to: '/profile', label: 'Profile & Verification', icon: User },
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
              { to: '/profile', label: 'Business Profile & Verification', icon: BadgeCheck },
            ],
          },
        ];

      case 'milkSeller':
        return [
          {
            title: 'Milk Vendor Desk',
            items: [
              { to: '/milkSeller', label: 'Daily Delivery Punch-Sheet', icon: Milk },
              { to: '/milkSeller/clients', label: 'Customer Passbooks', icon: Users },
              { to: '/milkSeller/bills', label: 'Monthly Billing & Pay', icon: DollarSign },
              { to: '/milkSeller/analytics', label: 'Delivery Analytics', icon: TrendingUp },
            ],
          },
        ];

      case 'vet':
        return [
          {
            title: 'Veterinary Workspace',
            items: [
              { to: '/vet', label: 'Clinical Cockpit', icon: LayoutDashboard },
              { to: '/vet/appointments', label: 'Appointments Queue', icon: Calendar },
              { to: '/vet/schedule', label: 'Weekly Schedule Editor', icon: BookOpen },
              { to: '/vet/campaigns', label: 'Vaccination Drives', icon: Syringe },
              { to: '/vet/records', label: 'Animal Health History', icon: Stethoscope },
              { to: '/vet/earnings', label: 'Consultation Ledger & DBT', icon: DollarSign },
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

      case 'customer':
        return [
          {
            title: 'Shopping Mall',
            items: [
              { to: '/customer', label: 'Customer Cockpit', icon: LayoutDashboard },
              { to: '/mall', label: 'Shop Fresh & Inputs', icon: ShoppingBag },
              { to: '/customer/produce', label: 'Farm-Fresh Produce', icon: Sprout },
              { to: '/customer/quotes', label: 'My Quotes & Negotiations', icon: Tag },
              { to: '/customer/procurements', label: 'FarmGate Procurements', icon: FileSpreadsheet },
              { to: '/customer/seasonal', label: 'Seasonal & Nutrition Guide', icon: Leaf },
              { to: '/customer/orders', label: 'My Orders & Delivery', icon: Package },
              { to: '/customer/demands', label: 'Purchase Requests', icon: ClipboardList },
              { to: '/customer/subscriptions', label: 'Subscription Veggie Box', icon: Calendar },
              { to: '/mall/wishlist', label: 'Saved Wishlist', icon: Heart },
            ],
          },
          {
            title: 'Household & Finance',
            items: [
              { to: '/customer/diary', label: 'Household Diary', icon: BookOpen },
              { to: '/customer/finance', label: 'Finance CEO (Household)', icon: Landmark },
              { to: '/customer/wallet', label: 'Wallet & Cashback', icon: DollarSign },
              { to: '/customer/coins', label: 'Coin Rewards (Krushi Ratna)', icon: Sparkles },
              { to: '/customer/trees', label: 'Tree Hub (Plant-a-Tree)', icon: TreePine },
              { to: '/customer/712', label: '7/12 Land Records', icon: FileSpreadsheet },
              { to: '/customer/news', label: 'Agri News & Stories', icon: Radio },
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

      case 'fpoManager':
        return [
          {
            title: 'FPO Collective Console',
            items: [
              { to: '/fpoManager', label: 'FPO Cockpit', icon: LayoutDashboard },
              { to: '/fpo/pools', label: 'Produce Pooling Batches', icon: Layers },
              { to: '/fpo/machinery', label: 'Custom Hiring Center', icon: Wrench },
              { to: '/fpo/directory', label: 'Federation Directory', icon: Building2 },
            ],
          },
        ];

      case 'womenShg':
        return [
          {
            title: 'Mahila Gruh Udyog',
            items: [
              { to: '/womenShg', label: 'Enterprise Dashboard', icon: LayoutDashboard },
              { to: '/women/directory', label: 'Bachat Gat Directory', icon: Users },
              { to: '/womenShg/products', label: 'Cottage Catalog', icon: Store },
              { to: '/womenShg/batches', label: 'Production Batches', icon: Package },
              { to: '/womenShg/certs', label: 'FSSAI Certifications', icon: Award },
              { to: '/womenShg/savings', label: 'SHG Savings & Micro-Loan', icon: Landmark },
            ],
          },
        ];

      case 'directBuyer':
        return [
          {
            title: 'B2B Procurement',
            items: [
              { to: '/directbuyer', label: 'Buyer Dashboard', icon: LayoutDashboard },
              { to: '/directbuyer/demands', label: 'Bulk Crop Demands', icon: Layers },
              { to: '/directbuyer/qc', label: 'Produce QC Inspections', icon: Award },
              { to: '/directbuyer/contracts', label: 'Institutional Contracts', icon: FileText },
            ],
          },
        ];

      case 'broker':
        return [
          {
            title: 'Broker Desk',
            items: [
              { to: '/broker', label: 'Deal Desk', icon: LayoutDashboard },
              { to: '/broker/matchmaker', label: 'Lot ↔ Demand Matcher', icon: HeartHandshake },
              { to: '/broker/commissions', label: 'Commission Ledger', icon: DollarSign },
            ],
          },
        ];

      case 'dairyManager':
        return [
          {
            title: 'Dudh Dairy & Livestock',
            items: [
              { to: '/dairy', label: 'Milk Collection Desk', icon: Milk },
              { to: '/dairy/members', label: 'Member Passbook', icon: Users },
              { to: '/dairy/batches', label: 'Payout Batches', icon: DollarSign },
              { to: '/dairy/rates', label: 'FAT / SNF Rate Chart', icon: TrendingUp },
              { to: '/dairy/gaushala', label: 'Gaushala & 80G Receipts', icon: Building2 },
              { to: '/dairy/vets', label: 'VetNet & Vaccinations', icon: ShieldAlert },
            ],
          },
        ];

      case 'instructor':
        return [
          {
            title: 'Gurukul Studio',
            items: [
              { to: '/instructor', label: 'Academy Studio', icon: GraduationCap },
              { to: '/instructor/courses', label: 'Course Builder', icon: BookOpen },
              { to: '/instructor/enquiries', label: 'Batches & Questions', icon: Users },
            ],
          },
        ];

      case 'bankManager':
        return [
          {
            title: 'Credit Underwriting',
            items: [
              { to: '/bank', label: 'Loan Underwriting Queue', icon: Landmark },
              { to: '/bank/appraisals', label: '7/12 & CIBIL Appraisal', icon: FileSpreadsheet },
              { to: '/bank/portfolio', label: 'Disbursal & Recovery', icon: DollarSign },
            ],
          },
        ];

      case 'insuranceProvider':
        return [
          {
            title: 'PMFBY Desk',
            items: [
              { to: '/insurance', label: 'Claims Intimation Queue', icon: ShieldAlert },
              { to: '/insurance/surveyors', label: 'Surveyor Assignment', icon: Users },
              { to: '/insurance/dbt', label: 'Loss Assessment & DBT', icon: DollarSign },
            ],
          },
        ];

      case 'nursery':
        return [
          {
            title: 'Nursery Operations',
            items: [
              { to: '/nursery', label: 'Nursery Cockpit', icon: LayoutDashboard },
              { to: '/nursery/profile', label: 'Profile & Shop KYC', icon: Building2 },
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
              { to: '/nursery/ai', label: 'AI Analysis & Forecast', icon: Sparkles },
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
              { to: '/nursery/referrals', label: 'Refer & Earn', icon: Gift },
              { to: '/nursery/trees', label: 'Tree Plantation Hub', icon: Droplets },
              { to: '/nursery/land-records', label: '7/12 Land Records', icon: FileText },
            ],
          },
        ];

      case 'superadmin':
        return [
          {
            title: 'Platform Operations',
            items: [
              { to: '/admin', label: 'Master Ops Console (SOP 01-27)', icon: Sparkles },
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
  };

  const navSections = getNavSections();

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-slate-200/80 min-h-[calc(100vh-4rem)] p-4 space-y-6">
      {/* Persona Dynamic Links */}
      {navSections.map((sec, idx) => (
        <div key={idx} className="space-y-1">
          <h4 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {sec.title}
          </h4>
          <div className="space-y-1 mt-2">
            {sec.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === `/${activePersona}` || item.to === '/admin'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover-lift',
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      {/* Universal Ecosystem Shortcuts */}
      <div className="space-y-1 pt-2 border-t border-slate-100">
        <h4 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Ecosystem Hubs
        </h4>
        <div className="space-y-1 mt-2">
          <NavLink
            to="/mall"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>Shopping Mall</span>
          </NavLink>

          <NavLink
            to="/academy"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <GraduationCap className="w-4 h-4 text-sky-600" />
            <span>Courses</span>
          </NavLink>

          <NavLink
            to="/community/ai"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <Bot className="w-4 h-4 text-teal-600" />
            <span>AI Agronomist (Kisan Mitra)</span>
          </NavLink>

          <NavLink
            to="/community/scan"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <ScanLine className="w-4 h-4 text-rose-500" />
            <span>AI Scanner</span>
          </NavLink>

          <NavLink
            to="/community/news"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <Radio className="w-4 h-4 text-indigo-500" />
            <span>News & Audio</span>
          </NavLink>

          <NavLink
            to="/academy/my-learning"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <BookOpen className="w-4 h-4 text-sky-600" />
            <span>My Learning</span>
          </NavLink>

          <NavLink
            to="/payments"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
            <span>Payments & Transactions</span>
          </NavLink>

          <NavLink
            to="/ratings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <Star className="w-4 h-4 text-amber-500" />
            <span>Ratings & Reviews</span>
          </NavLink>

          <NavLink
            to="/saved"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <Bookmark className="w-4 h-4 text-rose-500" />
            <span>Saved & Following</span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
};
