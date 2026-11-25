import React from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, UserRound } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { normalizePersona } from '../../lib/personas';
import { PERSONA_LABELS, resolvePageIdentity } from '../../lib/navItems';

/**
 * Global page-identity bar rendered above every shell page (all personas):
 *  - persona cockpit (dashboard) routes → the name plate
 *    "Namaste, {user name} — {persona name}";
 *  - any other route matched in the persona menu → a slim breadcrumb-style
 *    title with the page name the user selected;
 *  - unmatched deep links → nothing (views keep their own headings).
 */
export const PageIdentityBar: React.FC = () => {
  const { pathname, search } = useLocation();
  const { user, activePersona } = useAuthStore();
  const personaId = normalizePersona(activePersona);
  const personaLabel = PERSONA_LABELS[personaId] || personaId;
  const identity = resolvePageIdentity(personaId, pathname, search);

  if (!identity) return null;

  if (identity.kind === 'dashboard') {
    const name = (user?.name || '').trim();
    return (
      <div className="mb-4 sm:mb-6 rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white p-5 shadow-sm shadow-emerald-600/20 flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
          <UserRound className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-base sm:text-lg font-extrabold truncate">
            {name ? `Namaste, ${name}` : 'Namaste!'}
          </p>
          <p className="text-[11px] font-bold text-emerald-50 uppercase tracking-wide truncate">
            — {personaLabel}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 sm:mb-6 flex items-center gap-2 text-sm min-w-0">
      <span className="font-bold text-slate-400 uppercase tracking-wide text-[10px] shrink-0 hidden sm:block">
        {personaLabel}
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 hidden sm:block" />
      <h2 className="font-extrabold text-slate-900 truncate">{identity.label}</h2>
      <span className="h-px flex-1 bg-slate-200 ml-2 hidden sm:block" />
    </div>
  );
};
