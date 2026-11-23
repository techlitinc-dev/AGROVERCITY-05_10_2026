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
  Store,
  DollarSign,
  Milk,
  GraduationCap,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
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
  Snowflake,
  Boxes,
  Heart,
  Scale,
  Inbox,
  Star,
  Megaphone,
  Search,
  Handshake,
  Sprout,
  Tag,
  TreePine,
  Leaf,
  Bookmark,
  ArrowLeftRight,
  ClipboardList,
  Briefcase,
  Mountain,
  Globe2,
  Plus,
  CalendarCheck,
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
              { to: '/payments', label: 'Payment & Transactions', icon: ArrowLeftRight },
              { to: '/ratings', label: 'Ratings & Reviews', icon: Star },
              { to: '/saved', label: 'Saved & Following', icon: Bookmark },
              { to: '/community/ai', label: 'AI Advisor', icon: Bot },
              { to: '/farmer/schemes', label: 'Government Schemes', icon: Gift },
              { to: '/farmer/water', label: 'Climate & Water', icon: Droplets },
              { to: '/farmer/712', label: 'My Land Records (7/12)', icon: FileSpreadsheet },
              { to: '/farmer/diary', label: 'My Diary', icon: BookOpen },
              { to: '/community/scan', label: 'AI Crop Scanner', icon: ScanLine },
              { to: '/community/trees', label: 'Tree Plantation', icon: TreePine },
              { to: '/farmer/referrals', label: 'Invite & Earn', icon: Users },
              { to: '/ads', label: 'Ads & Promotions', icon: Megaphone },
              { to: '/farmer/pnl', label: 'Profit & Loss', icon: DollarSign },
              { to: '/community/coins', label: 'Coins & Rewards', icon: Sparkles },
              { to: '/farmer/women-hub', label: 'Woman Hub Businesses', icon: Store },
              { to: '/farmer/women-hub/orders', label: 'Woman Hub Orders', icon: ShoppingBag },
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
              { to: '/milkSeller', label: 'Punch Sheet', icon: ClipboardList },
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
              { to: '/womenHub/enterprise', label: 'Enterprise Income', icon: Store },
              { to: '/womenHub/orders', label: 'My Orders & Track', icon: Package },
              { to: '/womenHub/insights', label: 'AI Analysis', icon: TrendingUp },
              { to: '/community/demands', label: 'Requirements / Demand Board', icon: Megaphone },
              { to: '/farmer/diary', label: 'Diary', icon: BookOpen },
              { to: '/ads', label: 'Give Advertisement', icon: Tag },
              { to: '/community/news', label: 'Agri News', icon: Radio },
              { to: '/community/trees', label: 'Tree Hub', icon: TreePine },
              { to: '/mall', label: 'Agri Market / Shopping', icon: ShoppingBag },
              { to: '/farmer/referrals', label: 'Refer & Earn', icon: Gift },
              { to: '/community/coins', label: 'Coin Rewards / Krushi Ratna', icon: Sparkles },
              { to: '/farmer/712', label: '7/12 & Land Records', icon: FileSpreadsheet },
              { to: '/community/scan', label: 'Chatbot & AI Crop Scanner', icon: Bot },
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
              { to: '/instructor', label: 'Academic Studio', icon: GraduationCap },
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
              { to: '/agriMarketSeller/earnings', label: 'Earnings & Payouts', icon: Landmark },
              { to: '/agriMarketSeller/reviews', label: 'Customer Reviews', icon: Star },
              { to: '/agriMarketSeller/reports', label: 'Sales Reports', icon: ClipboardList },
              { to: '/agriMarketSeller/insights', label: 'AI Analysis', icon: TrendingUp },
            ],
          },
          {
            title: 'Shop & Grow',
            items: [
              { to: '/ads', label: 'Advertisement Manager', icon: Megaphone },
              { to: '/mall', label: 'E-Market Shopping', icon: ShoppingCart },
              { to: '/farmer/diary', label: 'Farm Diary', icon: BookOpen },
              { to: '/academy', label: 'Gyansetu Learning Hub', icon: GraduationCap },
              { to: '/community/news', label: 'Agri News', icon: Radio },
              { to: '/farmer/referrals', label: 'Refer & Earn', icon: Gift },
              { to: '/community/coins', label: 'Coin Rewards / Krushi Ratna', icon: Sparkles },
              { to: '/community/trees', label: 'Tree Hub', icon: TreePine },
              { to: '/farmer/pnl', label: 'Profit & Loss', icon: DollarSign },
              { to: '/farmer/712', label: '7/12 & Land Records', icon: FileSpreadsheet },
              { to: '/community/scan', label: 'Chatbot & AI Crop Scanner', icon: Bot },
              { to: '/notifications', label: 'Notification Center', icon: Inbox },
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
                end={item.to === `/${activePersona}`}
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

      {/* Universal Ecosystem Shortcuts — hidden for farmer (every hub already lives in the farmer menu). */}
      {normalizePersona(activePersona) !== 'farmer' && (
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
            <span>Agri Market</span>
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
            <span>Agriculture News & Audio</span>
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
            <span>Payment & Transactions</span>
          </NavLink>

          {normalizePersona(activePersona) !== 'transporter' && (
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
          )}

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
            <span>AI Advisor</span>
          </NavLink>

          <NavLink
            to="/farmer/schemes"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <Gift className="w-4 h-4 text-emerald-600" />
            <span>Government Schemes</span>
          </NavLink>

          <NavLink
            to="/farmer/water"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <Droplets className="w-4 h-4 text-sky-600" />
            <span>Climate & Water</span>
          </NavLink>

          <NavLink
            to="/farmer/712"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>My Land Records (7/12)</span>
          </NavLink>

          {normalizePersona(activePersona) !== 'transporter' && (
          <NavLink
            to="/farmer/diary"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <span>My Diary</span>
          </NavLink>
          )}

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
            <span>AI Crop Scanner</span>
          </NavLink>

          <NavLink
            to="/community/trees"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <TreePine className="w-4 h-4 text-emerald-600" />
            <span>Tree Plantation</span>
          </NavLink>

          <NavLink
            to="/farmer/referrals"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <Users className="w-4 h-4 text-amber-500" />
            <span>Invite & Earn</span>
          </NavLink>

          {normalizePersona(activePersona) !== 'transporter' && (
          <NavLink
            to="/ads"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <Megaphone className="w-4 h-4 text-emerald-600" />
            <span>Ads & Promotions</span>
          </NavLink>
          )}

          <NavLink
            to="/farmer/pnl"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>Profit & Loss</span>
          </NavLink>

          <NavLink
            to="/community/coins"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )
            }
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Coins & Rewards</span>
          </NavLink>
        </div>
      </div>
      )}
    </aside>
  );
};
