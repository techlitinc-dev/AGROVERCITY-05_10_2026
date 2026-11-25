import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/utils';
import { normalizePersona } from '../../lib/personas';
import { getNavSections, ECOSYSTEM_ITEMS } from '../../lib/navItems';

export const Sidebar: React.FC = () => {
  const { activePersona } = useAuthStore();
  const navSections = getNavSections(activePersona);

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
          {ECOSYSTEM_ITEMS.filter(
            (item) =>
              normalizePersona(activePersona) !== 'transporter' || !item.hideForTransporter
          ).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )
              }
            >
              <item.icon className={cn('w-4 h-4 flex-shrink-0', item.className)} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
      )}
    </aside>
  );
};
