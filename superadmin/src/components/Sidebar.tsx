import React from 'react';
import {
  LayoutDashboard,
  Sprout,
  Truck,
  Briefcase,
  HeartHandshake,
  Flower2,
  ShoppingBag,
  Users2,
  ChevronRight,
  ShieldAlert,
  Newspaper,
  Building2,
  Wrench,
  Globe2,
  Heart,
  Building,
  GraduationCap,
  Landmark,
  Snowflake,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AdminRole, ROLE_INFO } from '../types/auth';

export type ActiveTab =
  | 'overview'
  | 'farmer_pages'
  | 'farmer'
  | 'landlord'
  | 'transporter'
  | 'vyapari'
  | 'equipment'
  | 'trade_desk'
  | 'livestock'
  | 'fpo'
  | 'mahila'
  | 'gurukul'
  | 'banking_insurance'
  | 'cold_storage'
  | 'nursery'
  | 'customer'
  | 'rbac';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { currentRole } = useAuth();
  const roleMeta = ROLE_INFO[currentRole] || ROLE_INFO.superadmin;

  const coreNav: Array<{ id: ActiveTab; label: string; sub: string; icon: any }> = [
    {
      id: 'overview',
      label: 'Overview & Analytics',
      sub: 'Platform KPI Wall & Pulse',
      icon: LayoutDashboard,
    },
    {
      id: 'farmer_pages',
      label: 'Farmer Pages & CMS',
      sub: 'News, Channels, Workshops & Schemes',
      icon: Newspaper,
    },
  ];

  const personaNav: Array<{ id: ActiveTab; label: string; sub: string; icon: any }> = [
    {
      id: 'farmer',
      label: '1. Farmer Governance',
      sub: 'Lots, Mandi Rates, Diary & Soil',
      icon: Sprout,
    },
    {
      id: 'landlord',
      label: '2. Farm Landlord Desk',
      sub: 'Plot Leases & 7/12 Land Audit',
      icon: Building2,
    },
    {
      id: 'transporter',
      label: '3. Transport & Logistics',
      sub: 'Fleet RC, Dispatch & Bookings',
      icon: Truck,
    },
    {
      id: 'vyapari',
      label: '4. Vyapari Trader Desk',
      sub: 'Rates, B2B Deals & Escrow',
      icon: Briefcase,
    },
    {
      id: 'equipment',
      label: '5. Machinery & Yantra',
      sub: 'Tractors, Harvesters & Booking Slots',
      icon: Wrench,
    },
    {
      id: 'trade_desk',
      label: '6, 11, 12. Export & Trade Desk',
      sub: 'APEDA Exporters, Millers & Brokers',
      icon: Globe2,
    },
    {
      id: 'livestock',
      label: '7, 8, 13, 18. Livestock Hub',
      sub: 'Vets, Gaushalas, Dairies & Milkmen',
      icon: Heart,
    },
    {
      id: 'fpo',
      label: '9. FPO & Cooperatives',
      sub: 'Registered FPOs & Bulk Pools',
      icon: Building,
    },
    {
      id: 'mahila',
      label: '10. Mahila Graha Udyog',
      sub: 'SHG Queue & FSSAI Certs',
      icon: HeartHandshake,
    },
    {
      id: 'gurukul',
      label: '14. Gurukul Academy',
      sub: 'Certified Courses & ICAR Faculty',
      icon: GraduationCap,
    },
    {
      id: 'banking_insurance',
      label: '15, 16. Banking & Insurance',
      sub: 'KCC Underwriting & PMFBY Claims',
      icon: Landmark,
    },
    {
      id: 'cold_storage',
      label: '17. Cold Storage Hub',
      sub: 'Controlled Atmosphere Warehouses',
      icon: Snowflake,
    },
    {
      id: 'nursery',
      label: '19. Nursery & Agroforestry',
      sub: 'Saplings, Accreditations & Trees',
      icon: Flower2,
    },
    {
      id: 'customer',
      label: '20. eMarket Customer Mall',
      sub: 'Fresh Cart Orders, Catalog & Refunds',
      icon: ShoppingBag,
    },
  ];

  const adminNav: Array<{ id: ActiveTab; label: string; sub: string; icon: any }> = [
    {
      id: 'rbac',
      label: 'Multi-User & RBAC Desk',
      sub: 'Operator Roster & Audit Trail',
      icon: Users2,
    },
  ];

  const renderNavGroup = (title: string, items: typeof coreNav) => (
    <div className="space-y-1">
      <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center gap-2.5 group relative ${
              isActive
                ? 'bg-gradient-to-r from-emerald-600/20 to-teal-600/10 border border-emerald-500/30 text-emerald-300'
                : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'group-hover:text-white'}`}>
                  {item.label}
                </span>
                {isActive && <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0" />}
              </div>
              <p className="text-[10px] text-slate-500 truncate group-hover:text-slate-400">{item.sub}</p>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/60 flex flex-col shrink-0 h-[calc(100vh-4rem)]">
      {/* Current Operator Role Pill */}
      <div className="p-3.5 border-b border-slate-800">
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Operator Policy</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs font-bold text-white">{roleMeta.title}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{roleMeta.description}</p>
        </div>
      </div>

      {/* Nav List with Scrollbar */}
      <nav className="p-2 space-y-2 flex-1 overflow-y-auto">
        {renderNavGroup('Core Platform', coreNav)}
        {renderNavGroup('All 20 Rural Personas', personaNav)}
        {renderNavGroup('Access Governance', adminNav)}
      </nav>

      {/* Rule 8 Compliance Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[9px] text-slate-400 leading-tight">
            <span className="font-semibold text-slate-300">Rule 8 Enforced:</span> All mutations require verified audit reasons into <code className="text-emerald-400 font-mono">audit_logs</code>.
          </div>
        </div>
      </div>
    </aside>
  );
};
