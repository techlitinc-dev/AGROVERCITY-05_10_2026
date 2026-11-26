import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, UserRound } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { normalizePersona } from '../../lib/personas';
import { PERSONA_LABELS, isDashboardPath, isPersonaFeaturePath, resolvePageIdentity } from '../../lib/navItems';

/**
 * Global page-identity bar rendered above every shell page (all personas):
 *  - persona cockpit (dashboard) routes → the name plate
 *    "Namaste, {user name} — {persona name}" (or nothing when the view
 *    renders its own plate);
 *  - persona feature pages → a Back button, plus a slim breadcrumb-style
 *    title when the page name comes from the persona menu (views with an
 *    in-page title get the Back button alone);
 *  - unmatched deep links → nothing (views keep their own headings).
 */
export const PageIdentityBar: React.FC = () => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { user, activePersona } = useAuthStore();
  const personaId = normalizePersona(activePersona);
  const personaLabel = PERSONA_LABELS[personaId] || personaId;
  const identity = resolvePageIdentity(personaId, pathname, search);

  if (isDashboardPath(pathname)) {
    if (identity?.kind !== 'dashboard') return null;
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

  if (!isPersonaFeaturePath(personaId, pathname)) return null;

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(`/${personaId}`);
  };

  return (
    <div className="mb-4 sm:mb-6 flex items-center gap-2 text-sm min-w-0">
      <button
        onClick={goBack}
        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:border-emerald-600 hover:text-emerald-700 transition-colors shrink-0"
        title="Go back"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back</span>
      </button>
      {identity?.kind === 'page' && (
        <>
          <span className="font-bold text-slate-400 uppercase tracking-wide text-[10px] shrink-0 hidden sm:block">
            {personaLabel}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 hidden sm:block" />
          <h2 className="font-extrabold text-slate-900 truncate">{identity.label}</h2>
        </>
      )}
      <span className="h-px flex-1 bg-slate-200 ml-2 hidden sm:block" />
    </div>
  );
};
