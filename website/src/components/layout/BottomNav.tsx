import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Package, ShoppingBag, Bot } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/utils';

export const BottomNav: React.FC = () => {
  const { activePersona } = useAuthStore();

  const getPersonaHomePath = () => {
    return `/${activePersona}`;
  };

  const tabs = [
    { to: getPersonaHomePath(), label: 'Home', icon: LayoutDashboard },
    { to: '/farmer/mandi', label: 'Mandi', icon: TrendingUp },
    { to: '/farmer/lots', label: 'Trade', icon: Package },
    { to: '/mall', label: 'Mall', icon: ShoppingBag },
    { to: '/community/ai', label: 'Kisan AI', icon: Bot },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 shadow-lg">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.to === getPersonaHomePath()}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all active:scale-95 hover-lift',
                isActive
                  ? 'text-emerald-700 font-extrabold scale-105'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              )
            }
          >
            <tab.icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
